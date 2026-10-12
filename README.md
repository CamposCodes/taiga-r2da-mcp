# taiga-mcp

[Português (Brasil)](README.pt-BR.md)

An [MCP](https://modelcontextprotocol.io) server that connects an AI model to a [Taiga](https://taiga.io) 6
installation. With it, Claude Code, Claude Desktop, Codex or any MCP client can read projects, sprints, user
stories, tasks, issues and their attachments in the name of the person who logged in, and answer questions such
as "what is open in the current sprint?" or "which tasks have nobody assigned?".

By default the server **only reads**: every request to Taiga is a `GET`. Started with `TAIGA_WRITE=1` it can also
create, edit and move user stories, tasks and issues and attach files to them. It deletes only when
`TAIGA_DELETE=1` is set as well, and then in two calls: the first only shows what would be deleted.

- **18 tools**: 10 to read, 7 to write, 1 to delete.
- **Names, not ids**: the model says `"In progress"` or a username, and the server looks the id up.
- **Short answers**: one summary line per item, with paging, so a board of hundreds of items fits in context.
- **Works behind single sign-on**: it uses the session token of the browser, so no Taiga password is needed.
- **Follows the permissions of Taiga**: when the role of the user may not create, change or delete an item,
  nothing is sent and the model is told what that role may do instead.
- **Two dependencies**: `@modelcontextprotocol/server` and `zod`.

## How it works

The figure shows the pieces of a session: the client and the server run on your machine, and the server talks to
your Taiga.

![Architecture of taiga-mcp: client and server on the user's machine, Taiga API and attachment files on the Taiga installation](docs/diagrams/01-architecture.svg)

Your MCP client starts `node dist/index.js` with the address of your Taiga and your token. The server checks the
token, registers its tools and waits. Each tool call becomes one or more requests to the Taiga REST API, and the
answer goes back to the model as short JSON. More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start

Requires Node 20 or newer and a Taiga 6 you can log in to, reached over `https://`.

**1. Build**

```bash
git clone https://github.com/CamposCodes/taiga-r2da-mcp.git taiga-mcp
cd taiga-mcp
npm ci
npm run build
```

**2. Get a token.** Log in to your Taiga in the browser, open the developer tools (F12), go to **Application**,
**Local Storage**, the address of your Taiga, and copy the value of the key `token`.

**3. Register the server in your client.** In Claude Code:

```bash
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" --transport stdio --scope local taiga -- node /absolute/path/to/taiga-mcp/dist/index.js
```

Step by step, for each client:

| Client | Guide |
| --- | --- |
| Claude Code | [docs/clients/claude-code.md](docs/clients/claude-code.md) |
| Claude Desktop | [docs/clients/claude-desktop.md](docs/clients/claude-desktop.md) |
| Codex (CLI, IDE extension, desktop app) | [docs/clients/codex.md](docs/clients/codex.md) |

Any other client that starts an MCP server over stdio works the same way: the command is `node`, the argument is
the absolute path of `dist/index.js`, and the variables below go in the environment of the server.

**4. Ask.** "Which projects do I have in Taiga?" You never have to name a tool.

## Tools

Read, always present:

| Tool | What it does |
| --- | --- |
| `taiga_me` | The user of the token |
| `taiga_projects_list` | Projects the user is a member of |
| `taiga_projects_get` | One project: statuses, members, sprints, points, issue types, severities, priorities and the permissions of the user |
| `taiga_sprints_list` | Sprints with dates, open and closed user stories and points, newest first |
| `taiga_userstories_list` | User stories, one line each, with filters |
| `taiga_tasks_list` | Tasks, each with the user story it belongs to, with filters |
| `taiga_issues_list` | Issues, with filters by type, severity and priority |
| `taiga_items_get` | One item by its number, of any kind, with description and attachment list; comments and history on request |
| `taiga_search` | Search by words in user stories, tasks, issues and wiki pages |
| `taiga_attachments_get` | The content of an attachment: an image, a text, or the path of a saved file. It can save a file on the machine, so it is not marked read-only |

Write, only with `TAIGA_WRITE=1`:

| Tool | What it does |
| --- | --- |
| `taiga_userstories_create` | Creates a user story |
| `taiga_userstories_update` | Edits or moves a user story, and comments on it. Changes only the fields given |
| `taiga_tasks_create` | Creates a task in a user story or in a sprint |
| `taiga_tasks_update` | Edits or moves a task, and comments on it. Changes only the fields given |
| `taiga_issues_create` | Creates an issue |
| `taiga_issues_update` | Edits or moves an issue, and comments on it. Changes only the fields given |
| `taiga_attachments_add` | Sends a file of the machine to a user story, a task or an issue. A file that looks like a credential is refused |

Delete, only with `TAIGA_DELETE=1` on top of `TAIGA_WRITE=1`:

| Tool | What it does |
| --- | --- |
| `taiga_items_delete` | Deletes a user story, a task or an issue for good, in two calls: the first deletes nothing, shows the item and gives a code; the second, with that code, deletes |

Before it creates, changes or deletes an item, the server checks what Taiga says the user may do in the project
(`myPermissions` of `taiga_projects_get`). When the permission is missing, nothing is sent and the error tells the
model what that role may do instead: for example, create a task in a user story that already exists, register an
issue or leave a comment. The model is told not to pick one on its own: it reports the refusal, offers the
alternatives and waits for the choice. A refusal that comes from Taiga itself carries the same request.

Parameters, example calls, example answers and errors: [docs/TOOLS.md](docs/TOOLS.md). Workflows and example
requests: [docs/USAGE.md](docs/USAGE.md).

## Configuration

| Variable | Required | What it is for |
| --- | --- | --- |
| `TAIGA_URL` | yes | Address of the Taiga site, with or without `/api/v1` at the end. It must start with `https://`: only this machine (`localhost`, `127.0.0.1`, `[::1]`) may be reached over `http://`. An address with a user or a password in it is refused |
| `TAIGA_TOKEN` | yes | Session token of Taiga 6, copied from the browser |
| `TAIGA_WRITE` | no | `1` registers the seven write tools. Any other value, or none, keeps the server read-only |
| `TAIGA_DELETE` | no | `1` registers `taiga_items_delete`, the tool that deletes. It needs `TAIGA_WRITE=1`: without it the server stops at start |

The server reads these from its environment and from nowhere else. [`.env.example`](.env.example) lists them.

The token expires after a time set by your Taiga. When it does, tools answer
`Taiga refused the token: it expired or is wrong.` and you copy a new one. The server does not renew it.

## Security

The token **is your session in Taiga**: whoever has it reads everything you read, until it expires.

- Set it in the configuration of your client, per server. Do not paste it in a chat, an issue or a repository.
- `TAIGA_URL` must start with `https://`: over plain `http://` the token would travel in clear text, so the server
  refuses such an address, except for this machine.
- Text in a task, a comment or an attachment is written by other people and may carry instructions for the model.
- With `TAIGA_WRITE=1`, what the model creates or edits goes out in your name. The server does not ask for
  confirmation by itself: the client does. Read what the model proposes before allowing it.
- With `TAIGA_DELETE=1`, what is deleted is gone: Taiga keeps no trash, and deleting a user story deletes its
  tasks. The first call of `taiga_items_delete` only shows what would go and gives a random code that is good
  once, for that item as it was shown. The second call is still made by the model: what keeps you in the loop is
  the permission prompt of your client.
- `taiga_attachments_add` refuses a file that looks like a credential: a name that starts with a dot anywhere in
  the path, the folder where programs keep the data of the user, a key file, a file of the system or a network
  path. It is a deny list, not a sandbox: any other file your user can read can be sent. Check the path before
  allowing it.
- Every change sent to Taiga and every tool error leaves a line on stderr, which your client keeps in its log of
  the server: the trail of what the model did and tried.

The threat model, what the server can touch and how to report a vulnerability: [SECURITY.md](SECURITY.md).

## Documentation

| Page | What is in it |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, start sequence, a read call and a write call, with diagrams |
| [docs/USAGE.md](docs/USAGE.md) | Workflows, example requests, limits and troubleshooting |
| [docs/TOOLS.md](docs/TOOLS.md) | Every tool: parameters, example call, example answer, errors |
| [docs/clients/](docs/clients/) | Installation in Claude Code, Claude Desktop and Codex |
| [SECURITY.md](SECURITY.md) | Threat model and how to report a vulnerability |
| [docs/COMPLIANCE.md](docs/COMPLIANCE.md) | Audit against the MCP specification and Anthropic's guidance, with sources, and what was done about each finding |
| [docs/TESTING.md](docs/TESTING.md) | How the server is tested, the list of every scenario and the report of the last run |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to build, test and change the server |
| [CHANGELOG.md](CHANGELOG.md) | What changed in each version |

## Status and limits

- Version 0.3.0. Target: Taiga 6. Transport: stdio only.
- Protocol: MCP revision `2026-07-28` and the older ones, on the same stdio connection, through version 2 of the
  TypeScript SDK (`@modelcontextprotocol/server`).
- Writing covers user stories, tasks and issues: create, edit, move, comment, attach a file and, with
  `TAIGA_DELETE=1`, delete. Sprints and wiki pages are not changed, attachments are not deleted and the points of
  a user story are not set.
- At most 120 tool calls a minute, and 120 seconds for each request to Taiga.
- The assignee filter of user stories finds only the main assignee.
- The token is renewed by hand.
- The package is not published to npm, where the name `taiga-mcp` belongs to another project: install it from
  this repository, as in [Quick start](#quick-start).
- Not covered: content of wiki pages, epics, timelines, notifications, statistics and custom fields.

## Development

```bash
npm run check      # types
npm run build      # compiles to dist/
npm test           # end-to-end scenarios against a simulated Taiga, needs the build
npm run coverage   # the same scenarios, and how much of the built server they run
```

These never talk to a real Taiga. `npm run test:live` does, in one project: it is run by hand and never in CI.
See [docs/TESTING.md](docs/TESTING.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Origin and licence

The organization (one HTTP client and tools named `taiga_<resource>_<action>`) follows that of
[illodev/taiga-mcp](https://github.com/illodev/taiga-mcp), which is MIT licensed. The code here was written from
scratch and contains no code of Taiga: it only uses its public REST API. "Taiga" is a trademark of its owners and
appears here only to say what the server connects to.

This project is released under the MIT licence: see [LICENSE](LICENSE).
