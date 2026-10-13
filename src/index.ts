#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join, sep } from "node:path";
import { z } from "zod";
import { CLIENT_CAPABILITIES_META_KEY, McpServer, inputRequired, inputResponse, type CallToolResult, type InputRequiredResult } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

/* eslint-disable @typescript-eslint/no-explicit-any -- API payloads are plain JSON */

/**
 * MCP server for a Taiga 6 installation. It reads projects, sprints, user stories, tasks and issues, with their
 * attachments. Started with TAIGA_WRITE=1 it also creates and edits user stories, tasks and issues and attaches
 * files to them; without it every call to the API is a GET. With TAIGA_DELETE=1 on top of that it deletes them,
 * in two calls: the first only shows what would go.
 *
 * It authenticates with the token Taiga gives the browser after login, so it works where people enter through
 * the company's identity provider and have no password in Taiga.
 */
// ponytail: the token lasts about a day and is pasted again when it expires; use Taiga's refresh token if that
// becomes a chore (refreshing rotates it, which ends the browser session it was copied from).
// ponytail: a write is confirmed by the permission prompt of the MCP client, which the annotations below feed.
// Deleting adds steps of its own: the item is shown first and, where the client can put a question to the person,
// the server asks for the yes itself. In a client that cannot, the second call is still made by the model.

const instructions = (write: boolean, remove: boolean) => `Access to a Taiga project management server. A project has user stories (worked on a kanban or
planned in sprints), tasks that belong to a user story or to a sprint, and issues (bugs, questions, improvements).
Projects are addressed by slug and every user story, task and issue by its number (#12 is ref 12); the number is unique in the project.
Statuses, sprints, people and issue values are given by name. Start with taiga_projects_list, then taiga_projects_get
to learn the valid names. To understand an item in full, call taiga_items_get with its comments and open each
attachment it lists with taiga_attachments_get. ${
  write
    ? `User stories, tasks and issues can be created and edited (moving one is giving it a new status or sprint) and files attached to them: everything is done in the name of the current user, so change only what was asked and attach only the files that were asked for. When Taiga or this server refuses a change because the user lacks a permission, do not work around it: tell the user what was refused, offer the alternatives the error lists and wait for the choice. ${
        remove
          ? "An item is deleted with taiga_items_delete, in two calls: the first deletes nothing and shows what would go. Ask the user whether that is really to be deleted, and call again with the code only after a yes."
          : "Nothing can be deleted."
      }`
    : "Nothing can be changed through this server."
} Names and texts are in whatever language the team writes in.`;

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
/** Opening an attachment changes nothing in Taiga, but it can leave a file on this machine: not read-only. */
const SAVES = { ...WRITE, idempotentHint: true } as const;

/** Attachments shown as they are: images as images, these extensions as text. The rest goes to a file. */
const IMAGES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const TEXTS = /^(txt|md|log|csv|tsv|json|xml|ya?ml|sql|html?|css|js|ts|py|java|cs|php|sh|ini)$/;
const MAX_FILE = 25 * 1024 * 1024;
// An image above this goes to a file too: the model API refuses images of more than 5 MB once encoded.
const MAX_IMAGE = 3.5 * 1024 * 1024;
const MAX_TEXT = 50_000;
/** A Taiga that stopped answering must not hold a tool for ever. Generous: a large file on a slow line fits. */
const TIMEOUT = 120_000;
// A model caught in a loop must not flood Taiga, least of all with writes.
// ponytail: one window for every tool; give each tool its own limit if a real workload ever reaches this one.
const MAX_CALLS_PER_MINUTE = 120;
/** How long the code of a deletion that was shown is good for. */
const DELETE_WINDOW = 10 * 60_000;

/**
 * The trail of what the server changed and of what it refused, for whoever reads the log of the client: one line
 * each on stderr, since stdout carries the protocol. Never the token, and never the content of an item.
 */
const trail = (what: string) => console.error(`taiga-mcp: ${new Date().toISOString()} ${what}`);

let windowStart = 0;
let calls = 0;

/**
 * Runs a tool and returns what it shows. A failure (unknown status name, API refusal, too many calls, ...) becomes
 * a tool error with a readable message, so the model can correct itself.
 */
async function show(body: () => Promise<CallToolResult | InputRequiredResult>): Promise<CallToolResult | InputRequiredResult> {
  try {
    const now = Date.now();
    if (now - windowStart >= 60_000) {
      windowStart = now;
      calls = 0;
    }
    if (++calls > MAX_CALLS_PER_MINUTE) {
      const wait = Math.ceil((windowStart + 60_000 - now) / 1000);
      throw new Error(`Too many calls: this server runs at most ${MAX_CALLS_PER_MINUTE} tools a minute. Wait ${wait} seconds and call again.`);
    }
    return await body();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    trail(`tool error: ${clip(text, 300)}`);
    return { isError: true, content: [{ type: "text", text }] };
  }
}

/** A result as data, and the same data as JSON text for the clients that read only text. */
function data(value: object): CallToolResult {
  const text = JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }], structuredContent: JSON.parse(text) };
}

/** The usual case: a tool that answers data. */
const run = (body: () => Promise<object>) => show(async () => data(await body()));

type Kind = "us" | "task" | "issue";

const KINDS: Record<Kind, { path: string; history: string; statuses: string; a: string }> = {
  us: { path: "userstories", history: "userstory", statuses: "us_statuses", a: "a user story" },
  task: { path: "tasks", history: "task", statuses: "task_statuses", a: "a task" },
  issue: { path: "issues", history: "issue", statuses: "issue_statuses", a: "an issue" },
};

class TaigaClient {
  /** Address of the Taiga site, without the API path: the links given to people start here. */
  readonly site: string;
  private readonly baseUrl: string;

  constructor(
    url: string,
    private readonly token: string,
  ) {
    this.site = url.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
    this.baseUrl = this.site + "/api/v1";
  }

  /** One page of a list, with the total the server counted. */
  async page(path: string, query: Record<string, unknown> = {}): Promise<{ total: number; items: any[] }> {
    const response = await this.request("GET", path, query);
    const items = await this.body(response, `GET ${path}`);
    return { total: Number(response.headers.get("x-pagination-count") ?? items.length), items };
  }

  async get(path: string, query: Record<string, unknown> = {}): Promise<any> {
    return this.body(await this.request("GET", path, query), `GET ${path}`);
  }

  /** The only way anything is written to Taiga. The payload goes as JSON, or as a form when it carries a file. */
  async send(method: "POST" | "PATCH" | "DELETE", path: string, payload?: unknown): Promise<any> {
    const response = await this.request(method, path, {}, payload);
    trail(`${method} ${path} ${response.status}`);
    return this.body(response, `${method} ${path}`);
  }

  /**
   * The bytes of an attachment. Taiga gives each attachment an address that is read as it is (where the files
   * are protected, the address carries its own short-lived key), so the session token is not sent to it.
   */
  async download(address: string): Promise<Buffer> {
    const response = await reach(true, "Attachment unreachable", () => fetch(new URL(address, this.site), { signal: AbortSignal.timeout(TIMEOUT) }));
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} on the file of the attachment`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async request(method: string, path: string, query: Record<string, unknown>, payload?: unknown): Promise<Response> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    // A form says its own content type, with the boundary between its parts.
    const form = payload instanceof FormData;
    return reach(method === "GET", `Taiga API unreachable at ${this.baseUrl}`, () =>
      fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          ...(payload === undefined || form ? {} : { "Content-Type": "application/json" }),
        },
        body: payload === undefined ? undefined : form ? payload : JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT),
      }),
    );
  }

  private async body(response: Response, what: string): Promise<any> {
    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (response.status === 401) {
      throw new Error(
        "Taiga refused the token: it expired or is wrong. Log in to Taiga in the browser, copy the value of " +
          '"token" from Local Storage and set TAIGA_TOKEN again. Tell the user that no tool of this server works ' +
          "until then: the new token goes in the configuration of this server in the client, which has to start " +
          "the server again.",
      );
    }
    if (response.status === 403) {
      throw new Error(
        `Taiga refused ${what}: the current user does not have the permission for it. Nothing was changed. ` +
          `taiga_projects_get shows what the user may do in a project (myPermissions). ${ASK}`,
      );
    }
    if (!response.ok) {
      // A refused write may answer with the fields at fault ({"subject": ["..."]}) and no message.
      const fields = data && typeof data === "object" ? `: ${clip(JSON.stringify(data), 500)}` : "";
      throw new Error(data?._error_message || data?.detail || `${response.status} ${response.statusText} on ${what}${fields}`);
    }
    return data;
  }
}

/** Why a request did not get through. Node says only "fetch failed" and keeps the reason (DNS, TLS, a closed connection) in the cause. */
const reason = (error: unknown) => [(error as Error).message, ((error as Error).cause as Error | undefined)?.message].filter(Boolean).join(": ");

/** What the model has to tell the user when Taiga cannot be reached: the next calls would fail the same way. */
const OFFLINE =
  "Tell the user that this server cannot reach Taiga right now, so its tools will not work until it can: Taiga may " +
  "be down, or the network or the VPN of this machine may be off. Once the address opens in the browser, ask " +
  "again; if it still fails, start this server again in the client.";

/**
 * Sends one request. A read that does not get through is sent a second time: a connection that stayed idle may
 * have been closed by the other side, and reading twice changes nothing. A write is sent once, because the first
 * try may have reached Taiga, and so is a request whose time ran out, because the wait was long already.
 */
async function reach(read: boolean, what: string, send: () => Promise<Response>): Promise<Response> {
  let again = false;
  try {
    try {
      return await send();
    } catch (error) {
      if (!read || (error as Error).name === "TimeoutError") throw error;
      again = true;
      return await send();
    }
  } catch (error) {
    const tried = again
      ? "A second try failed too. "
      : read
        ? ""
        : "The request was sent once and not repeated, because it may have reached Taiga: read the item before sending the change again. ";
    throw new Error(`${what}: ${reason(error)}. ${tried}${OFFLINE}`);
  }
}

const same = (a: unknown, b: unknown) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
/** A text that is cut says so, with its real length: the model must know that something is missing. */
const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}… (cut: the first ${max} of ${text.length} characters)` : text;

/** Project with its statuses, members, sprints and value lists: what is needed to turn names into ids and back. */
function loadProject(client: TaigaClient, project: string): Promise<any> {
  return /^\d+$/.test(project) ? client.get(`/projects/${project}`) : client.get("/projects/by_slug", { slug: project });
}

function byName(list: any[], value: string, what: string): number {
  const found = list.find((entry) => String(entry.id) === value.trim()) ?? list.find((entry) => same(entry.name, value));
  if (!found) {
    throw new Error(`Unknown ${what} "${value}". Valid: ${list.map((entry) => entry.name).join(", ")}`);
  }
  return found.id;
}

/** Id, username or full name of a project member, tried in that order; "none" asks for what has nobody. */
function memberFilter(project: any, value: string): number | "null" {
  if (same(value, "none")) {
    return "null";
  }
  const members: any[] = project.members;
  const usernames = (list: any[]) => list.map((m) => m.username).join(", ");
  // An id or a username names one person. A full name comes last and must be of one member only: people choose
  // their full name, and one of them can choose the username of another.
  const named = members.filter((m) => same(m.full_name, value) || same(m.full_name_display, value));
  const found = members.find((m) => String(m.id) === value.trim()) ?? members.find((m) => same(m.username, value)) ?? named[0];
  if (!found) {
    throw new Error(`"${value}" is not a member of this project. Members: ${usernames(members)}`);
  }
  if (found === named[0] && named.length > 1) {
    throw new Error(`"${value}" is the full name of ${named.length} members of this project: give the username of one (${usernames(named)}).`);
  }
  return found.id;
}

/** Name, slug or id of a sprint; "backlog" asks for what is in none. */
function sprintFilter(project: any, value: string): number | "null" {
  if (same(value, "backlog") || same(value, "none")) {
    return "null";
  }
  const found =
    project.milestones.find((m: any) => String(m.id) === value.trim()) ??
    project.milestones.find((m: any) => same(m.name, value) || same(m.slug, value));
  if (!found) {
    const names = project.milestones.map((m: any) => m.name).join(", ") || "(no sprints)";
    throw new Error(`Unknown sprint "${value}". Sprints: ${names}. Use "backlog" for no sprint.`);
  }
  return found.id;
}

const nameOf = (list: any[] | undefined, id: unknown) => (list ?? []).find((entry) => entry.id === id)?.name ?? null;

/** One line of a list: enough to analyse a board without spending context on long descriptions. */
function summary(project: any, kind: Kind, item: any) {
  const people = [...new Set([item.assigned_to, ...(item.assigned_users ?? [])].filter((id) => id != null))];
  const username = (id: number) => project.members.find((m: any) => m.id === id)?.username ?? `user ${id}`;
  return {
    type: kind,
    ref: item.ref,
    subject: item.subject,
    status: item.status_extra_info?.name ?? nameOf(project[KINDS[kind].statuses], item.status),
    closed: Boolean(item.is_closed ?? item.status_extra_info?.is_closed),
    sprint: nameOf(project.milestones, item.milestone),
    assignees: people.map(username),
    ...(kind === "us" ? { points: item.total_points ?? null } : {}),
    ...(kind === "task"
      ? { userStory: item.user_story_extra_info ? `#${item.user_story_extra_info.ref} ${item.user_story_extra_info.subject}` : null }
      : {}),
    ...(kind === "issue"
      ? {
          issueType: nameOf(project.issue_types, item.type),
          severity: nameOf(project.severities, item.severity),
          priority: nameOf(project.priorities, item.priority),
        }
      : {}),
    tags: (item.tags ?? []).map((tag: unknown) => (Array.isArray(tag) ? tag[0] : tag)),
    dueDate: item.due_date ?? null,
    blocked: item.is_blocked ? item.blocked_note || true : false,
    comments: item.total_comments ?? null,
    createdAt: item.created_date ?? null,
    modifiedAt: item.modified_date ?? null,
    finishedAt: item.finish_date ?? item.finished_date ?? null,
  };
}

/** How a refusal for lack of permission ends: the model must not pick the way around on its own. */
const ASK = "Do not work around this on your own: tell the user what was refused, offer the alternatives and wait for the choice.";

/** Taiga gives, with each project, what the current user may do in it. A project that gives no list is not judged here: Taiga decides. */
const can = (p: any, permission: string) => !Array.isArray(p.my_permissions) || p.my_permissions.includes(permission);

type Action = "add" | "modify" | "delete";

/** What can stand in for a refused change, each with the permission it needs. */
function alternatives(action: Action, kind: Kind): [string, string][] {
  const edit = `taiga_${KINDS[kind].path}_update`;
  if (action === "modify") {
    return [[`comment_${kind}`, `leave a comment on it saying what should change (${edit} with only comment)`]];
  }
  if (action === "delete") {
    return [
      [`modify_${kind}`, `close it instead, by moving it to a closed status (${edit})`],
      [`comment_${kind}`, `leave a comment on it asking for the deletion (${edit} with only comment)`],
    ];
  }
  const story: [string, string] = ["add_us", "create it as a user story (taiga_userstories_create)"];
  const task: [string, string] = [
    "add_task",
    "create only a task, in a user story that already exists or in a sprint with no user story (taiga_tasks_create)",
  ];
  const issue: [string, string] = ["add_issue", "register it as an issue (taiga_issues_create)"];
  const comment: [string, string] = [
    "comment_us",
    "write it as a comment on a user story that already exists (taiga_userstories_update with only comment)",
  ];
  return { us: [task, issue, comment], task: [story, issue, comment], issue: [story, task] }[kind];
}

/**
 * Stops a change the role of the current user does not allow, before anything is sent, and says what that role
 * does allow in its place.
 */
function allow(p: any, action: Action, kind: Kind): void {
  const permission = `${action}_${kind}`;
  if (can(p, permission)) {
    return;
  }
  const verb = { add: "create", modify: "change", delete: "delete" }[action];
  const options = alternatives(action, kind)
    .filter(([needed]) => can(p, needed))
    .map(([, what]) => what)
    .concat("ask a project admin to do it, or to give your role this permission");
  throw new Error(
    `You do not have permission to ${verb} ${KINDS[kind].a} in ${p.slug}: your role lacks the Taiga permission ` +
      `${permission}. Nothing was done. What your role allows here instead: ` +
      `${options.map((what, i) => `(${i + 1}) ${what}`).join("; ")}. ${ASK}`,
  );
}

const project = z.string().describe('Project slug or id, as returned by taiga_projects_list (e.g. "my-project")');
const itemRef = z.number().int().positive().describe("Number of the user story, task or issue (#12 is 12)");
const storyRef = z.number().int().positive().describe("Number of the user story (#12 is 12)");
const taskRef = z.number().int().positive().describe("Number of the task (#12 is 12)");
const issueRef = z.number().int().positive().describe("Number of the issue (#12 is 12)");
const listFilters = {
  project,
  status: z.string().optional().describe('Status name, e.g. "In progress" (see taiga_projects_get)'),
  assignee: z.string().optional().describe('Username or full name of a member, or "none" (unassigned)'),
  closed: z.boolean().optional().describe("true: only in a closed status; false: only open"),
  sprint: z.string().optional().describe('Sprint name or id, or "backlog" for no sprint'),
  tag: z.string().optional().describe("Only the items that carry this tag"),
  text: z.string().optional().describe("Words to find in subject and description"),
  page: z.number().int().min(1).optional().describe("Page number, default 1"),
  size: z.number().int().min(1).max(200).optional().describe("Items per page, default 50"),
};

/** What the answers are made of. A value Taiga may leave out is nullish, so that an answer is never refused for it. */
const text = z.string().nullish();
const count = z.number().nullish();
const modules = z.object({ backlog: z.boolean(), kanban: z.boolean(), issues: z.boolean(), wiki: z.boolean() });
const status = z.object({ name: z.string(), closed: z.boolean() });
const line = z.object({
  type: z.enum(["us", "task", "issue"]).describe("us: user story"),
  ref: z.number().describe("Number of the item in the project"),
  subject: z.string(),
  status: text,
  closed: z.boolean(),
  sprint: text,
  assignees: z.array(z.string()).describe("Usernames"),
  points: count.describe("User stories only"),
  userStory: text.describe("Tasks only: number and subject of the user story"),
  issueType: text.describe("Issues only"),
  severity: text.describe("Issues only"),
  priority: text.describe("Issues only"),
  tags: z.array(z.string()),
  dueDate: text,
  blocked: z.union([z.boolean(), z.string()]).describe("false, or the reason it is blocked"),
  comments: count,
  createdAt: text,
  modifiedAt: text,
  finishedAt: text,
});
const page = z.object({ total: z.number(), page: z.number(), size: z.number(), items: z.array(line) });
const changed = line.extend({
  version: count.describe("Version of the item after this write: give it back in the next edit of its description or tags"),
  url: z.string().describe("Where a person sees the item"),
});

/** The filters every kind of item shares, as the query Taiga expects. */
function commonQuery(p: any, kind: Kind, args: any) {
  return {
    project: p.id,
    status: args.status ? byName(p[KINDS[kind].statuses], args.status, `${kind} status`) : undefined,
    assigned_to: args.assignee ? memberFilter(p, args.assignee) : undefined,
    status__is_closed: args.closed,
    milestone: args.sprint ? sprintFilter(p, args.sprint) : undefined,
    tags: args.tag,
    q: args.text,
    page: args.page ?? 1,
    page_size: args.size ?? 50,
  };
}

async function list(client: TaigaClient, kind: Kind, args: any, extra: (p: any) => Promise<Record<string, unknown>> | Record<string, unknown> = () => ({})) {
  const p = await loadProject(client, args.project);
  const query = { ...commonQuery(p, kind, args), ...(await extra(p)) };
  const result = await client.page(`/${KINDS[kind].path}`, query);
  return { total: result.total, page: query.page, size: query.page_size, items: result.items.map((item) => summary(p, kind, item)) };
}

/** Finds a user story, task or issue by its number, whatever its kind. */
async function resolve(client: TaigaClient, p: any, ref: number): Promise<{ kind: Kind; id: number }> {
  const found = await client.get("/resolver", { project: p.slug, ref });
  const kind = (["us", "task", "issue"] as Kind[]).find((k) => found[k] != null);
  if (!kind) {
    throw new Error(`#${ref} is not a user story, task or issue of ${p.slug}.`);
  }
  return { kind, id: found[kind] };
}

/** Id of the item with this number, which must be of the kind the tool works on. */
async function idOf(client: TaigaClient, p: any, ref: number, kind: Kind): Promise<number> {
  const found = await resolve(client, p, ref);
  if (found.kind !== kind) {
    throw new Error(`#${ref} is not ${KINDS[kind].a}: it is ${KINDS[found.kind].a}.`);
  }
  return found.id;
}

/** Files attached to an item. Each has the address its content is read from. */
function attachmentsOf(client: TaigaClient, p: any, kind: Kind, id: number): Promise<any[]> {
  return client.get(`/${KINDS[kind].path}/attachments`, { project: p.id, object_id: id, page_size: 200 });
}

/** The tasks of a user story, one short line each. */
async function tasksOf(client: TaigaClient, p: any, id: number) {
  const tasks: any[] = await client.get("/tasks", { project: p.id, user_story: id, page_size: 200 });
  return tasks.map((task) => {
    const { ref, subject, status, closed, assignees } = summary(p, "task", task);
    return { ref, subject, status, closed, assignees };
  });
}

/**
 * What was said about an item, as the fields Taiga expects: names become ids, "none" becomes empty and what was
 * not said is left out (an undefined field does not go in the request).
 */
async function fieldsOf(client: TaigaClient, p: any, kind: Kind, args: any) {
  const sprint = args.sprint ? sprintFilter(p, args.sprint) : undefined;
  if (kind === "task" && sprint === "null") {
    // With no story and no sprint a task is on no board: only its address would reach it.
    throw new Error("A task cannot go to the backlog: give it a sprint or a user story.");
  }
  const assignee = args.assignee ? memberFilter(p, args.assignee) : undefined;
  const blocked = args.blocked === undefined ? {} : same(args.blocked, "none") ? { is_blocked: false, blocked_note: "" } : { is_blocked: true, blocked_note: args.blocked };
  return {
    subject: args.subject,
    description: args.description,
    status: args.status ? byName(p[KINDS[kind].statuses], args.status, `${kind} status`) : undefined,
    assigned_to: assignee === "null" ? null : assignee,
    user_story: args.userStory ? await idOf(client, p, args.userStory, "us") : undefined,
    milestone: sprint === "null" ? null : sprint,
    type: args.issueType ? byName(p.issue_types, args.issueType, "issue type") : undefined,
    severity: args.severity ? byName(p.severities, args.severity, "severity") : undefined,
    priority: args.priority ? byName(p.priorities, args.priority, "priority") : undefined,
    tags: args.tags,
    due_date: args.dueDate ? (same(args.dueDate, "none") ? null : args.dueDate) : undefined,
    ...blocked,
    comment: args.comment,
  };
}

/** An item as a write left it, with the address where a person sees it. */
const written = (client: TaigaClient, p: any, kind: Kind, item: any) => ({
  ...summary(p, kind, item),
  version: item.version,
  url: `${client.site}/project/${p.slug}/${kind}/${item.ref}`,
});

let folder: string | undefined;

/**
 * Where attachments are saved: one folder for the whole run, made by mkdtemp on the first file. Nobody can guess
 * its name or prepare it in a shared temp folder and, on Linux and macOS, only this user opens it. A folder that
 * was deleted in the meantime is replaced by a new one.
 */
async function savingFolder(): Promise<string> {
  if (!folder || !(await stat(folder).catch(() => null))) {
    folder = await mkdtemp(join(tmpdir(), "taiga-mcp-"));
  }
  return folder;
}

/** A path that starts with two slashes, of either kind: a share of another machine, or of this one under another name. */
const NETWORK = /^[\\/]{2}/;

/** Inside the home of the user, the folder where programs keep their data: browser profiles, client configurations. */
const PROFILE = ({ win32: "AppData", darwin: "Library" } as Record<string, string | undefined>)[process.platform];

/**
 * The real path of a file that may be sent to Taiga. A file that looks like a credential is refused, whatever the
 * model was told: a text in a card can ask for the SSH key of the user as easily as for a screenshot.
 */
// ponytail: a deny list, not a sandbox. It stops the usual targets of a hidden instruction, not a secret kept
// under an ordinary name in an ordinary folder; limit the tool to one folder if that is ever needed.
// The file must be a regular one of up to 25 MB.
async function sendable(path: string): Promise<string> {
  // A network path is refused before the disk is touched: reaching \\host\share offers the credentials of the user
  // to that host, and \\localhost\C$ is another name for every folder that is checked below.
  if (NETWORK.test(path)) {
    throw new Error(`${path} is not sent: a network path is refused. Copy the file to a folder of this machine first.`);
  }
  const info = await stat(path);
  if (!info.isFile() || info.size > MAX_FILE) {
    throw new Error(`${path} is not a file of up to ${MAX_FILE} bytes.`);
  }
  // The real path, with links and mapped drives followed: a drive mapped to a share comes back as a network path.
  const real = await realpath(path);
  const under = async (folder: string) => `${real}${sep}`.toLowerCase().startsWith(`${await realpath(folder).catch(() => folder)}${sep}`.toLowerCase());
  const hidden = real.split(sep).some((part) => part.startsWith("."));
  const profile = PROFILE !== undefined && (await under(join(homedir(), PROFILE))) && !(await under(tmpdir()));
  // On Linux the kernel serves the environment of this very process, token included, as a file under /proc.
  const system = /^\/(proc|sys|dev|run)(\/|$)/.test(real);
  if (NETWORK.test(real) || system || hidden || profile || /\.(pem|key|p12|pfx|ppk|kdbx)$/i.test(real)) {
    throw new Error(
      `${path} is not sent: it looks like a credential or a configuration file (a name that starts with a dot, the ` +
        "folder where programs keep the data of the user, a key file, a file of the system or a network path). If it " +
        "really is to be sent, the user can copy it to another place under another name.",
    );
  }
  return real;
}

function registerTools(server: McpServer, client: TaigaClient) {
  server.registerTool(
    "taiga_me",
    {
      title: "Current user",
      description: "The Taiga user this server reads as.",
      inputSchema: z.strictObject({}),
      outputSchema: z.object({ id: z.number(), username: z.string(), fullName: text, email: text }),
      annotations: READ,
    },
    () =>
      run(async () => {
        const me = await client.get("/users/me");
        return { id: me.id, username: me.username, fullName: me.full_name_display ?? me.full_name, email: me.email };
      }),
  );

  server.registerTool(
    "taiga_projects_list",
    {
      title: "List projects",
      description: "Projects the current user is a member of.",
      inputSchema: z.strictObject({}),
      outputSchema: z.object({
        projects: z.array(z.object({ slug: z.string(), name: z.string(), description: text, private: z.boolean(), admin: z.boolean(), modules })),
      }),
      annotations: READ,
    },
    () =>
      run(async () => {
        const me = await client.get("/users/me");
        const projects: any[] = await client.get("/projects", { member: me.id, order_by: "user_order", page_size: 200 });
        return {
          projects: projects.map((p) => ({
            slug: p.slug,
            name: p.name,
            description: p.description,
            private: Boolean(p.is_private),
            admin: Boolean(p.i_am_admin),
            modules: modulesOf(p),
          })),
        };
      }),
  );

  server.registerTool(
    "taiga_projects_get",
    {
      title: "Project details",
      description:
        "One project with the statuses of user stories (the kanban columns), tasks and issues, its members, sprints " +
        "and the values accepted for points and for issue type, severity and priority, and what the current user may " +
        "do in it (myPermissions). Call this first to learn the names accepted by the other tools.",
      inputSchema: z.object({ project }),
      outputSchema: z.object({
        slug: z.string(),
        name: z.string(),
        description: text,
        private: z.boolean(),
        myPermissions: z.array(z.string()).describe("Taiga permissions of the current user here, e.g. add_task, modify_us, delete_issue"),
        modules,
        userStoryStatuses: z.array(status),
        taskStatuses: z.array(status),
        issueStatuses: z.array(status),
        points: z.array(z.object({ name: z.string(), value: count })),
        issueTypes: z.array(z.string()),
        severities: z.array(z.string()),
        priorities: z.array(z.string()),
        members: z.array(z.object({ username: z.string(), fullName: text, role: text })),
        sprints: z.array(z.object({ name: z.string(), closed: z.boolean() })),
      }),
      annotations: READ,
    },
    ({ project }) =>
      run(async () => {
        const p = await loadProject(client, project);
        const statuses = (list: any[] = []) => list.map((s) => ({ name: s.name, closed: Boolean(s.is_closed) }));
        const names = (list: any[] = []) => list.map((entry) => entry.name);
        return {
          slug: p.slug,
          name: p.name,
          description: p.description,
          private: Boolean(p.is_private),
          myPermissions: p.my_permissions ?? [],
          modules: modulesOf(p),
          userStoryStatuses: statuses(p.us_statuses),
          taskStatuses: statuses(p.task_statuses),
          issueStatuses: statuses(p.issue_statuses),
          points: (p.points ?? []).map((point: any) => ({ name: point.name, value: point.value })),
          issueTypes: names(p.issue_types),
          severities: names(p.severities),
          priorities: names(p.priorities),
          members: p.members.map((m: any) => ({ username: m.username, fullName: m.full_name_display ?? m.full_name, role: m.role_name })),
          sprints: (p.milestones ?? []).map((m: any) => ({ name: m.name, closed: Boolean(m.closed) })),
        };
      }),
  );

  server.registerTool(
    "taiga_sprints_list",
    {
      title: "List sprints",
      description: "Sprints of a project with dates, open and closed user stories and points. Newest first.",
      inputSchema: z.object({ project, closed: z.boolean().optional().describe("true: only closed sprints; false: only open") }),
      outputSchema: z.object({
        sprints: z.array(
          z.object({
            name: z.string(),
            start: text,
            finish: text,
            closed: z.boolean(),
            userStoriesOpen: z.number(),
            userStoriesClosed: z.number(),
            pointsTotal: count,
            pointsClosed: count,
          }),
        ),
      }),
      annotations: READ,
    },
    ({ project, closed }) =>
      run(async () => {
        const p = await loadProject(client, project);
        const sprints: any[] = await client.get("/milestones", { project: p.id, closed, page_size: 200 });
        return {
          sprints: sprints.map((m) => {
            const stories: any[] = m.user_stories ?? [];
            return {
              name: m.name,
              start: m.estimated_start,
              finish: m.estimated_finish,
              closed: Boolean(m.closed),
              userStoriesOpen: stories.filter((us) => !us.is_closed).length,
              userStoriesClosed: stories.filter((us) => us.is_closed).length,
              pointsTotal: m.total_points,
              pointsClosed: m.closed_points,
            };
          }),
        };
      }),
  );

  server.registerTool(
    "taiga_userstories_list",
    {
      title: "List user stories",
      description:
        "User stories of a project, one summary line each (no description). Combine filters to answer questions such " +
        "as what is open in a sprint or unassigned. The answer has the total, so ask for the next page when total is " +
        "larger than page * size.",
      inputSchema: z.object(listFilters),
      outputSchema: page,
      annotations: READ,
    },
    (args) => run(() => list(client, "us", args)),
  );

  server.registerTool(
    "taiga_tasks_list",
    {
      title: "List tasks",
      description:
        "Tasks of a project, each with the user story it belongs to. A task without a story belongs to a sprint. One " +
        "summary line each (no description). The answer has the total, so ask for the next page when total is larger " +
        "than page * size.",
      inputSchema: z.object({
        ...listFilters,
        userStory: z.number().int().positive().optional().describe("Only the tasks of this user story (its number)"),
      }),
      outputSchema: page,
      annotations: READ,
    },
    (args) =>
      run(() =>
        list(client, "task", args, async (p) => (args.userStory === undefined ? {} : { user_story: await idOf(client, p, args.userStory, "us") })),
      ),
  );

  server.registerTool(
    "taiga_issues_list",
    {
      title: "List issues",
      description:
        "Issues (bugs, questions, improvements) of a project, one summary line each (no description). The answer has " +
        "the total, so ask for the next page when total is larger than page * size.",
      inputSchema: z.object({
        ...listFilters,
        issueType: z.string().optional().describe('Issue type name, e.g. "Bug" (see taiga_projects_get)'),
        severity: z.string().optional().describe('Severity name, e.g. "Normal" (see taiga_projects_get)'),
        priority: z.string().optional().describe('Priority name, e.g. "High" (see taiga_projects_get)'),
      }),
      outputSchema: page,
      annotations: READ,
    },
    (args) =>
      run(() =>
        list(client, "issue", args, (p) => ({
          type: args.issueType ? byName(p.issue_types, args.issueType, "issue type") : undefined,
          severity: args.severity ? byName(p.severities, args.severity, "severity") : undefined,
          priority: args.priority ? byName(p.priorities, args.priority, "priority") : undefined,
        })),
      ),
  );

  server.registerTool(
    "taiga_items_get",
    {
      title: "Get an item",
      description:
        "One item by its number, whatever its kind, with the description and the list of its attachments (open one " +
        "with taiga_attachments_get). A user story comes with its tasks. Ask for comments and history only when needed.",
      inputSchema: z.object({
        project,
        ref: itemRef,
        include: z.array(z.enum(["comments", "history"])).optional().describe("Extra sections to load"),
      }),
      outputSchema: line.extend({
        version: count.describe("Version of the item: give it back when editing its description or its tags"),
        description: z.string(),
        createdBy: text,
        attachments: z.array(
          z.object({ id: z.number(), name: z.string(), size: count, description: z.string().optional(), deprecated: z.boolean().optional(), createdAt: text }),
        ),
        taskList: z.array(z.object({ ref: z.number(), subject: z.string(), status: text, closed: z.boolean(), assignees: z.array(z.string()) })).optional(),
        commentList: z.array(z.object({ when: text, who: text, body: z.string() })).optional(),
        history: z.array(z.object({ when: text, who: text, changed: z.array(z.string()), comment: z.string().optional() })).optional(),
      }),
      annotations: READ,
    },
    ({ project, ref, include = [] }) =>
      run(async () => {
        const p = await loadProject(client, project);
        const { kind, id } = await resolve(client, p, ref);
        const item = await client.get(`/${KINDS[kind].path}/${id}`);
        const result: Record<string, unknown> = {
          ...summary(p, kind, item),
          version: item.version,
          description: item.description ?? "",
          createdBy: item.owner_extra_info?.username ?? null,
          attachments: (await attachmentsOf(client, p, kind, id)).map((file) => ({
            id: file.id,
            name: file.name,
            size: file.size,
            ...(file.description ? { description: file.description } : {}),
            ...(file.is_deprecated ? { deprecated: true } : {}),
            createdAt: file.created_date,
          })),
        };
        if (kind === "us") {
          result.taskList = await tasksOf(client, p, id);
        }
        if (include.length) {
          // Unasked, Taiga gives only the 30 newest entries; 1000 is the most it gives at once.
          const entries: any[] = await client.get(`/history/${KINDS[kind].history}/${id}`, { page_size: 1000 });
          if (include.includes("comments")) {
            result.commentList = entries
              .filter((entry) => entry.comment && !entry.delete_comment_date)
              .map((entry) => ({ when: entry.created_at, who: entry.user?.username ?? entry.user?.name ?? null, body: clip(entry.comment, 2000) }));
          }
          if (include.includes("history")) {
            result.history = entries.map((entry) => ({
              when: entry.created_at,
              who: entry.user?.username ?? entry.user?.name ?? null,
              changed: Object.keys(entry.values_diff ?? {}),
              ...(entry.comment ? { comment: clip(entry.comment, 300) } : {}),
            }));
          }
        }
        return result;
      }),
  );

  server.registerTool(
    "taiga_search",
    {
      title: "Search a project",
      description: "Finds user stories, tasks, issues and wiki pages of a project by words in their text.",
      inputSchema: z.object({ project, text: z.string().min(1).describe("Words to find") }),
      outputSchema: z.object({
        count,
        items: z.array(z.object({ type: z.enum(["us", "task", "issue"]), ref: z.number(), subject: z.string(), status: text })),
        wikiPages: z.array(z.string()).describe("Slugs of the wiki pages found"),
      }),
      annotations: READ,
    },
    ({ project, text }) =>
      run(async () => {
        const p = await loadProject(client, project);
        const found = await client.get("/search", { project: p.id, text });
        const lines = (kind: Kind, items: any[] = []) =>
          items.map((item) => ({ type: kind, ref: item.ref, subject: item.subject, status: nameOf(p[KINDS[kind].statuses], item.status) }));
        return {
          count: found.count,
          items: [...lines("us", found.userstories), ...lines("task", found.tasks), ...lines("issue", found.issues)],
          wikiPages: (found.wikipages ?? []).map((page: any) => page.slug),
        };
      }),
  );

  server.registerTool(
    "taiga_attachments_get",
    {
      title: "Open an attachment",
      description:
        "The content of a file attached to a user story, task or issue. An image comes as an image and a text file " +
        "as text. Any other kind (PDF, spreadsheet, ...) is saved to a temporary folder of this machine and the " +
        "answer is its path, to be read with a file tool.",
      inputSchema: z.object({
        project,
        ref: itemRef,
        attachment: z.string().describe("Id or file name of the attachment, as listed by taiga_items_get"),
      }),
      annotations: SAVES,
    },
    ({ project, ref, attachment }) =>
      show(async () => {
        const p = await loadProject(client, project);
        const { kind, id } = await resolve(client, p, ref);
        const files = await attachmentsOf(client, p, kind, id);
        const chosen = byName(files, attachment, "attachment");
        const file = files.find((entry) => entry.id === chosen);
        if (file.size > MAX_FILE) {
          throw new Error(`${file.name} has ${file.size} bytes: more than the ${MAX_FILE} this server opens.`);
        }
        const bytes = await client.download(file.url);
        const extension = String(file.name).split(".").pop()!.toLowerCase();
        if (IMAGES[extension] && bytes.length <= MAX_IMAGE) {
          return {
            content: [
              { type: "text", text: file.name },
              { type: "image", data: bytes.toString("base64"), mimeType: IMAGES[extension] },
            ],
          };
        }
        if (TEXTS.test(extension)) {
          // Files exported by older Windows programs are not UTF-8: read those byte by byte instead of garbling them.
          let text: string;
          try {
            text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          } catch {
            text = bytes.toString("latin1");
          }
          return { content: [{ type: "text", text: clip(text, MAX_TEXT) }] };
        }
        // The name comes from whoever uploaded the file: only letters, digits, dot, dash and underscore reach the disk.
        const saved = join(await savingFolder(), `${p.slug}-${ref}-${file.id}-${file.name}`.replace(/[^\p{L}\p{N}._-]+/gu, "_"));
        await writeFile(saved, bytes);
        const answer = { name: file.name, size: bytes.length, savedTo: saved, note: "Not shown here: read this file with a file tool." };
        return { content: [{ type: "text", text: JSON.stringify(answer, null, 2) }] };
      }),
  );
}

const modulesOf = (p: any) => ({
  backlog: Boolean(p.is_backlog_activated),
  kanban: Boolean(p.is_kanban_activated),
  issues: Boolean(p.is_issues_activated),
  wiki: Boolean(p.is_wiki_activated),
});

const itemChanges = {
  description: z.string().optional().describe("Markdown"),
  assignee: z.string().optional().describe('Username or full name of a member, or "none" for nobody'),
  tags: z.array(z.string()).optional().describe("Tags of the item. On an edit this list replaces the current one"),
  dueDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|none)$/i)
    .optional()
    .describe('YYYY-MM-DD, or "none" for no due date'),
};
const storyChanges = {
  ...itemChanges,
  status: z.string().optional().describe('User story status name, e.g. "New": the column of the kanban (see taiga_projects_get)'),
  sprint: z.string().optional().describe('Sprint name, or "backlog" for no sprint'),
};
const taskChanges = {
  ...itemChanges,
  status: z.string().optional().describe('Task status name, e.g. "In progress": the column of the board (see taiga_projects_get)'),
  userStory: z.number().int().positive().optional().describe("Number of the user story the task belongs to"),
  sprint: z.string().optional().describe("Sprint name, for a task without a user story. A task with a story is always in the sprint of its story"),
};
const issueChanges = {
  ...itemChanges,
  status: z.string().optional().describe('Issue status name, e.g. "New" (see taiga_projects_get)'),
  sprint: z.string().optional().describe('Sprint name, or "backlog" for no sprint'),
  issueType: z.string().optional().describe('Issue type name, e.g. "Bug" (see taiga_projects_get)'),
  severity: z.string().optional().describe('Severity name, e.g. "Normal" (see taiga_projects_get)'),
  priority: z.string().optional().describe('Priority name, e.g. "High" (see taiga_projects_get)'),
};
/** What only an edit can say. */
const edits = (kind: Kind) => ({
  blocked: z.string().optional().describe(`Why ${KINDS[kind].a.replace(/^an? /, "the ")} is blocked, which blocks it; "none" unblocks it`),
  comment: z.string().optional().describe(`Comment to leave on ${KINDS[kind].a.replace(/^an? /, "the ")}, Markdown`),
  version: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Version of the item as taiga_items_get gave it. Required with description or tags, which replace what is there"),
});

/**
 * The one deletion that was shown and waits for its second call. The code is random, so it cannot be had without
 * the first call, and showing another item replaces it.
 */
let waiting: { code: string; state: string; expires: number } | undefined;

/**
 * The tools that change Taiga. They exist only when the server is started with TAIGA_WRITE=1, and the one that
 * deletes only with TAIGA_DELETE=1 on top of it.
 */
function registerWriting(server: McpServer, client: TaigaClient, remove: boolean) {
  const create = (kind: Kind) => (args: any) =>
    run(async () => {
      const p = await loadProject(client, args.project);
      allow(p, "add", kind);
      if (kind === "task" && args.userStory === undefined && !args.sprint) {
        throw new Error("A task needs a user story or a sprint: with neither it is on no board.");
      }
      return written(client, p, kind, await client.send("POST", `/${KINDS[kind].path}`, { project: p.id, ...(await fieldsOf(client, p, kind, args)) }));
    });

  const update = (kind: Kind) => (args: any) =>
    run(async () => {
      const p = await loadProject(client, args.project);
      const id = await idOf(client, p, args.ref, kind);
      const fields = await fieldsOf(client, p, kind, args);
      const given = Object.keys(fields).filter((name) => (fields as Record<string, unknown>)[name] !== undefined);
      if (!given.length) {
        throw new Error("Nothing to change: give at least one field.");
      }
      // Taiga takes a change that is only a comment from a role that may comment and may not edit.
      if (!(given.length === 1 && given[0] === "comment" && can(p, `comment_${kind}`))) {
        allow(p, "modify", kind);
      }
      // A description and the tags replace what is there, so the caller says which version it read: without that
      // the edit of somebody else, made in the meantime, would be lost without a word.
      if (args.version === undefined && (fields.description !== undefined || fields.tags !== undefined)) {
        throw new Error(
          `A description or the tags replace what #${args.ref} has now: read it with taiga_items_get and give its ` +
            "version, so that a change somebody made in the meantime is not lost.",
        );
      }
      // Taiga refuses a change that does not say which version of the item it was made on. A move or a comment
      // loses nothing, so it goes on the version of now.
      const { version } = await client.get(`/${KINDS[kind].path}/${id}`);
      if (args.version !== undefined && args.version !== version) {
        throw new Error(
          `#${args.ref} changed since version ${args.version}: it is at version ${version} now. Read it again with ` +
            "taiga_items_get, look at what changed and send the edit with the new version.",
        );
      }
      return written(client, p, kind, await client.send("PATCH", `/${KINDS[kind].path}/${id}`, { version, ...fields }));
    });

  server.registerTool(
    "taiga_userstories_create",
    {
      title: "Create a user story",
      description:
        "Creates a user story. Without a status it gets the default one of the project, and without a sprint it is " +
        "in no sprint (on a kanban it shows in the column of its status). The answer has the number of the new story " +
        "and its address; tasks are added to it with taiga_tasks_create.",
      inputSchema: z.object({ project, subject: z.string().min(1).describe("Title of the user story"), ...storyChanges }),
      outputSchema: changed,
      annotations: WRITE,
    },
    create("us"),
  );

  server.registerTool(
    "taiga_userstories_update",
    {
      title: "Edit or move a user story",
      description:
        "Changes a user story: only the fields given. A description or the tags are replaced whole, and need the " +
        "version taiga_items_get gave. Moving it on " +
        'the kanban is giving the new status; moving it to another sprint, or out of every sprint with "backlog", is ' +
        "giving the sprint. A comment can go alone or with the changes.",
      inputSchema: z.object({
        project,
        ref: storyRef,
        subject: z.string().min(1).optional().describe("New title of the user story"),
        ...storyChanges,
        ...edits("us"),
      }),
      outputSchema: changed,
      annotations: { ...WRITE, destructiveHint: true },
    },
    update("us"),
  );

  server.registerTool(
    "taiga_tasks_create",
    {
      title: "Create a task",
      description:
        "Creates a task in a user story or, with no story, in a sprint: one of the two is required. Without a status " +
        "it gets the default one of the project. The answer has the number of the new task and its address.",
      inputSchema: z.object({ project, subject: z.string().min(1).describe("Title of the task"), ...taskChanges }),
      outputSchema: changed,
      annotations: WRITE,
    },
    create("task"),
  );

  server.registerTool(
    "taiga_tasks_update",
    {
      title: "Edit or move a task",
      description:
        "Changes a task: only the fields given. A description or the tags are replaced whole, and need the version " +
        "taiga_items_get gave. Moving it on the " +
        "board is giving the new status; moving it to another user story or sprint is giving that story or sprint. " +
        "A comment can go alone or with the changes.",
      inputSchema: z.object({
        project,
        ref: taskRef,
        subject: z.string().min(1).optional().describe("New title of the task"),
        ...taskChanges,
        ...edits("task"),
      }),
      outputSchema: changed,
      annotations: { ...WRITE, destructiveHint: true },
    },
    update("task"),
  );

  server.registerTool(
    "taiga_issues_create",
    {
      title: "Create an issue",
      description:
        "Creates an issue (a bug, a question, an improvement). Without a status, type, severity or priority it gets " +
        "the default ones of the project. The answer has the number of the new issue and its address.",
      inputSchema: z.object({ project, subject: z.string().min(1).describe("Title of the issue"), ...issueChanges }),
      outputSchema: changed,
      annotations: WRITE,
    },
    create("issue"),
  );

  server.registerTool(
    "taiga_issues_update",
    {
      title: "Edit or move an issue",
      description:
        "Changes an issue: only the fields given. A description or the tags are replaced whole, and need the version " +
        "taiga_items_get gave. Moving it is " +
        'giving the new status, or the sprint it goes to ("backlog" for none). A comment can go alone or with the ' +
        "changes.",
      inputSchema: z.object({
        project,
        ref: issueRef,
        subject: z.string().min(1).optional().describe("New title of the issue"),
        ...issueChanges,
        ...edits("issue"),
      }),
      outputSchema: changed,
      annotations: { ...WRITE, destructiveHint: true },
    },
    update("issue"),
  );

  server.registerTool(
    "taiga_attachments_add",
    {
      title: "Attach a file",
      description:
        "Sends a file of this machine to a user story, a task or an issue, as an attachment. The answer has the " +
        "address of the file in Taiga: an image is shown inside a description or a comment by writing " +
        "![name](that address) there. A file that looks like a credential is refused.",
      inputSchema: z.object({
        project,
        ref: itemRef,
        path: z.string().describe("Full path of the file on this machine"),
        description: z.string().optional().describe("Short note shown next to the file"),
      }),
      outputSchema: z.object({ id: z.number(), name: z.string(), size: count, url: z.string().describe("Address of the file in Taiga") }),
      annotations: WRITE,
    },
    ({ project, ref, path, description }) =>
      run(async () => {
        const p = await loadProject(client, project);
        const { kind, id } = await resolve(client, p, ref);
        const real = await sendable(path);
        const form = new FormData();
        form.set("project", String(p.id));
        form.set("object_id", String(id));
        if (description) {
          form.set("description", description);
        }
        form.set("attached_file", new Blob([await readFile(real)]), basename(path));
        const file = await client.send("POST", `/${KINDS[kind].path}/attachments`, form);
        return { id: file.id, name: file.name, size: file.size, url: file.url };
      }),
  );

  if (!remove) {
    return;
  }

  server.registerTool(
    "taiga_items_delete",
    {
      title: "Delete an item",
      description:
        "Deletes a user story, a task or an issue with its comments and attachments, for good: Taiga keeps no trash. " +
        "Deleting a user story deletes its tasks with it. It takes two calls. The first, without confirm, deletes " +
        "nothing: it shows what would go and gives a code. Show that to the user, ask whether it is really to be " +
        "deleted, and only after a yes call again with the code in confirm. A code is good once, for ten minutes, " +
        "and only for the last item shown, as it was shown. A client that can ask the user is made to ask on that " +
        "second call, and nothing is deleted without the yes given there.",
      inputSchema: z.object({
        project,
        ref: itemRef,
        confirm: z.string().optional().describe("The code the first call gave. Leave it out on the first call: nothing is deleted without it"),
      }),
      outputSchema: z.object({
        deleted: z.boolean(),
        item: line,
        tasksDeletedWithIt: z.array(z.string()).optional().describe("User stories only: the tasks that go with it"),
        confirm: z.string().optional().describe("The code that deletes this item, to be sent only after the user said yes"),
        next: z.string().optional().describe("What to do before calling again"),
      }),
      annotations: { ...WRITE, destructiveHint: true },
    },
    ({ project, ref, confirm }, ctx) =>
      show(async () => {
        const p = await loadProject(client, project);
        const { kind, id } = await resolve(client, p, ref);
        allow(p, "delete", kind);
        const item = await client.get(`/${KINDS[kind].path}/${id}`);
        const tasks = kind === "us" ? await tasksOf(client, p, id) : [];
        const shown = {
          item: summary(p, kind, item),
          ...(kind === "us" ? { tasksDeletedWithIt: tasks.map((task) => `#${task.ref} ${task.subject}`) } : {}),
        };
        // What a code stands for: this item of this project, in the version that was shown, with those tasks.
        const state = `${p.id}/${kind}/${id}/v${item.version}/${tasks.map((task) => task.ref).join(",")}`;
        const valid = confirm !== undefined && confirm === waiting?.code && state === waiting.state && Date.now() < waiting.expires;
        if (!valid) {
          // A code is of one use: a wrong one spends the one that was waiting, and a guess never finds it.
          waiting = { code: randomUUID(), state, expires: Date.now() + DELETE_WINDOW };
          return data({
            deleted: false,
            ...shown,
            confirm: waiting.code,
            next:
              (confirm === undefined
                ? ""
                : "That code does not stand for this item as it is now: it is not the last one given, was used " +
                  "already, is more than ten minutes old, or the item changed since it was shown. ") +
              "Nothing was deleted. Show this to the user and ask whether it is really to be deleted. Only after a " +
              "yes, call again with this code in confirm.",
          });
        }
        // The code proves that the item was shown, and both calls came from the model. Where the client can put a
        // question to the person, the yes has to come from there: the model cannot answer in the person's place.
        // What the client can do comes with each request on the 2026-07-28 revision, and with the handshake before it.
        const can = (ctx.mcpReq.envelope as Record<string, any> | undefined)?.[CLIENT_CAPABILITIES_META_KEY] ?? server.server.getClientCapabilities();
        if (can?.elicitation) {
          const answer = inputResponse(ctx.mcpReq.inputResponses, "approve");
          if (answer.kind !== "elicit") {
            const what = `${KINDS[kind].a.replace(/^an? /, "")} #${ref} "${clip(String(item.subject), 200)}" of ${p.slug}`;
            const withIt = tasks.length ? `, with its tasks ${tasks.map((task) => `#${task.ref}`).join(", ")}` : "";
            return inputRequired({
              inputRequests: {
                approve: inputRequired.elicit({
                  message: `Delete the ${what}${withIt}? Taiga keeps no trash: this cannot be undone.`,
                  requestedSchema: z.object({ delete: z.boolean().describe("Yes, delete it for good") }),
                }),
              },
            });
          }
          if (answer.action !== "accept" || answer.content?.delete !== true) {
            waiting = undefined;
            trail(`deletion of ${kind} #${ref} in ${p.slug} not approved by the user (${answer.action})`);
            return data({ deleted: false, ...shown, next: "The user did not approve the deletion: nothing was deleted. Do not ask again unless the user brings it up." });
          }
        }
        waiting = undefined;
        await client.send("DELETE", `/${KINDS[kind].path}/${id}`);
        return data({ deleted: true, ...shown });
      }),
  );
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

/** The address of Taiga, refused when the token would travel in clear text or the address carries a password. */
function siteOf(url: string): string {
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    throw new Error("TAIGA_URL is not an address: it must look like https://taiga.example.com");
  }
  if (address.username || address.password) {
    throw new Error("TAIGA_URL must not carry a user or a password: the token goes in TAIGA_TOKEN.");
  }
  if (address.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(address.hostname)) {
    throw new Error("TAIGA_URL must start with https://: over http the token would travel in clear text. Only this machine (localhost, 127.0.0.1) may be reached over http.");
  }
  return url;
}

async function main() {
  const url = siteOf(required("TAIGA_URL"));
  // The browser keeps the token as a JSON string, quotes included.
  const token = required("TAIGA_TOKEN").trim().replace(/^"|"$/g, "");
  // Node refuses a header with a space or a line break in it, and says so with the whole header in the message.
  if (!/^[\x21-\x7e]+$/.test(token)) {
    throw new Error("TAIGA_TOKEN has a space, a line break or another character no token has: copy it again, in one piece.");
  }
  const client = new TaigaClient(url, token);
  // A switch is on with 1, or with true: that is how a client that builds the environment from a form writes a
  // ticked box. Anything else, "yes" and "on" included, leaves it off.
  const on = (name: string) => ["1", "true"].includes(process.env[name] ?? "");
  const write = on("TAIGA_WRITE");
  const remove = on("TAIGA_DELETE");
  if (remove && !write) {
    throw new Error("TAIGA_DELETE=1 needs TAIGA_WRITE=1: deleting is a kind of writing.");
  }
  const me = await client.get("/users/me");
  // One server for the connection, whichever revision of the protocol the client opens it with.
  serveStdio(() => {
    const server = new McpServer({ name: "taiga-mcp", version: "0.3.0" }, { instructions: instructions(write, remove) });
    registerTools(server, client);
    if (write) {
      registerWriting(server, client, remove);
    }
    return server;
  });
  // stdout carries the protocol, so messages for humans go to stderr.
  const mode = !write ? "read-only" : `writes user stories, tasks, issues and attachments${remove ? ", and deletes them" : ""}`;
  console.error(`taiga-mcp: ${client.site} as ${me.username} (${mode})`);
}

main().catch((error) => {
  console.error("taiga-mcp:", error instanceof Error ? error.message : error);
  process.exit(1);
});
