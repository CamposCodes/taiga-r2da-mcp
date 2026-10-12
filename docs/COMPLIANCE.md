# Compliance audit

The implementation checked against what the Model Context Protocol and Anthropic recommend for an MCP server.

- Audited on 2026-10-11, on version 0.2.0.
- A security review on 2026-10-12 read S1, S5 and S6 again in full and searched every file for secrets and
  internal data.
- On the same day the owner of the project decided each open proposal, one by one, and asked for new tools. This
  page describes the result: version 0.3.0.

**Rules of this audit**

- A recommendation is listed only if its page was read on the audit date. The URL is the one that was fetched.
- A quotation is copied from that page. Where a page could only be read through a summary, the row says so.
- Evidence is a line of [`src/index.ts`](../src/index.ts) or a scenario of [`test/smoke.mjs`](../test/smoke.mjs)
  as they are in version 0.3.0. The line numbers of this page are looked up in the files when it is written.
- Status: **Compliant**, **Partial**, **Non-compliant**, or **N/A** (does not apply to this server).
- Every Partial and Non-compliant row has an action that was applied (A1 to A23) or a proposal that is still open.

## Sources

| Id | Page | URL |
| --- | --- | --- |
| S1 | MCP specification 2026-07-28, Tools | <https://modelcontextprotocol.io/specification/2026-07-28/server/tools.md> |
| S2 | MCP specification 2026-07-28, stdio transport | <https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio.md> |
| S3 | MCP specification 2026-07-28, Key Changes | <https://modelcontextprotocol.io/specification/2026-07-28/changelog.md> |
| S4 | MCP specification 2026-07-28, Versioning and Compatibility | <https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning.md> |
| S5 | MCP docs, Local Server Security | <https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/local-server-security.md> |
| S6 | MCP docs, Security Best Practices | <https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md> |
| S7 | Anthropic, Writing effective tools for agents | <https://www.anthropic.com/engineering/writing-tools-for-agents> |
| S8 | MCP TypeScript SDK, README | <https://github.com/modelcontextprotocol/typescript-sdk> (read again on 2026-10-12) |
| S9 | Claude Code, Connect Claude Code to tools via MCP | <https://code.claude.com/docs/en/mcp> |
| S10 | MCP docs, Connect to local MCP servers (Claude Desktop) | <https://modelcontextprotocol.io/docs/develop/connect-local-servers> |
| S11 | Codex, Model Context Protocol | <https://learn.chatgpt.com/docs/extend/mcp?surface=cli> (where <https://developers.openai.com/codex/mcp> redirects) |
| S12 | MCP Registry, Quickstart | <https://modelcontextprotocol.io/registry/quickstart.md> (read again in full on 2026-10-12) |
| S13 | MCP schema 2026-07-28, `ToolAnnotations` and `instructions` | <https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/2026-07-28/schema.ts> (read through a summary; the annotation texts quoted below were compared with the copy that version 1 of the SDK shipped) |
| S14 | MCP specification, overview, Security and Trust & Safety | <https://modelcontextprotocol.io/specification/latest> |
| S15 | MCP reference server Filesystem, README | <https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md> (read through a summary) |
| S16 | Claude Help Center, Getting started with local MCP servers on Claude Desktop | <https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop> (read through a summary) |
| S17 | GitHub Docs, Secure use reference (GitHub Actions) | <https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions> (fetched on 2026-10-12; the page that answers is titled "Secure use reference"; read through a summary) |
| S18 | What `mkdtemp` guarantees: Node.js `fsPromises.mkdtemp`, libuv `uv_fs_mkdtemp`, POSIX `mkdtemp()` | <https://nodejs.org/docs/latest-v18.x/api/fs.html>, <https://docs.libuv.org/en/v1.x/fs.html>, <https://pubs.opengroup.org/onlinepubs/9799919799/functions/mkdtemp.html> (fetched on 2026-10-12, read through a summary) |
| S19 | MCP TypeScript SDK, Upgrade to v2 | <https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2> (fetched on 2026-10-12, read through a summary; what it says was then checked against the type declarations of the installed package) |
| S20 | MCP TypeScript SDK, Support for 2026-07-28 | <https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28.html> (fetched on 2026-10-12, read through a summary) |
| S21 | Taiga back end, permission names and what each write needs | <https://raw.githubusercontent.com/taigaio/taiga-back/main/taiga/permissions/choices.py>, <https://raw.githubusercontent.com/taigaio/taiga-back/main/taiga/projects/userstories/permissions.py>, <https://raw.githubusercontent.com/taigaio/taiga-back/main/taiga/projects/tasks/models.py> (fetched on 2026-10-12, read through a summary) |
| S22 | Taiga, API documentation and back-end source on authentication | <https://docs.taiga.io/api.html>, <https://github.com/taigaio/taiga-back> (read on 2026-10-12 by a separate research pass that reported quotations; used only in P6) |
| S23 | MCP Bundles (`.mcpb`): specification, CLI and Claude documentation | <https://github.com/modelcontextprotocol/mcpb>, <https://claude.com/docs/connectors/building/mcpb.md> (read on 2026-10-12 by a separate research pass that reported quotations; used only in P9) |

S7, S8, S9 and S11 were also read through a summary that returns short quotations. Their rows quote only those.

## Matrix

### Transport and protocol

| # | Recommendation | Source | Status | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| C01 | "The server **MUST NOT** write anything to its `stdout` that is not a valid MCP message." | S2 | Compliant | `src/index.ts:1173` (the SDK transport owns stdout), `src/index.ts:1183` and `src/index.ts:1187` (messages for people go to stderr) | – |
| C02 | Log to stderr: "The server **MAY** write UTF-8 strings to `stderr` for any logging purposes". The protocol's own Logging feature is deprecated: "log to `stderr` (stdio) or use OpenTelemetry instead of Logging" | S2, S3 | Compliant | `src/index.ts:1183`; no logging capability is declared (`src/index.ts:1174`) | – |
| C03 | "Messages are delimited by newlines, and **MUST NOT** contain embedded newlines." | S2 | Compliant | `src/index.ts:1173`: messages are written by the stdio transport of the SDK; the pretty-printed JSON of `src/index.ts:86` is a string inside the message | – |
| C04 | "Servers **SHOULD** exit promptly when their standard input is closed or reads return end-of-file." | S2 | Compliant | No code needed: the process ends when stdin closes. `test/smoke.mjs:409` checks exit code 0, and so does the end of every other server the scenarios start | A7 (test) |
| C05 | "Servers **MUST** implement `server/discover`", and every request carries its protocol version in `_meta` (revision 2026-07-28) | S3, S4 | Compliant (was Non-compliant) | `package.json:54`: version 2 of the SDK; `src/index.ts:1173` serves that revision and the older ones on the same connection (the type declarations of the installed SDK say of `serveStdio`: "the opening exchange selects the era, ONE instance from the factory is pinned for the connection lifetime"). `test/smoke.mjs:233` | A12 |
| C06 | Stay on a supported SDK line: `main` is v2, and v1.x "continues to receive bug fixes and security updates for at least six months after the v2 release (2026-07-27)" | S8 | Compliant (was Partial) | `package.json:54` | A12 |
| C07 | An unknown tool is a protocol error: "They are returned as standard JSON-RPC errors" with code `-32602` | S1 | Compliant (was Partial) | `test/smoke.mjs:230` | A12 |
| C08 | "Servers that support tools **MUST** declare the `tools` capability" | S1 | Compliant | `src/index.ts:1174`: the SDK declares it. `test/smoke.mjs:233` reads the tool list through both openings | – |
| C09 | The tool list "**MUST NOT** vary per-connection or as a side effect of other requests", and "Servers **SHOULD** return tools in a deterministic order" | S1 | Compliant | `src/index.ts:1166` and `src/index.ts:1167`: the set is decided once, at start, and listed in registration order; `test/smoke.mjs:417` and `test/smoke.mjs:564` check the order | – |

### Tool definitions

| # | Recommendation | Source | Status | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| C10 | Tool names of 1 to 128 characters, only letters, digits, underscore, hyphen and dot, unique in the server | S1 | Compliant | `src/index.ts:513` to `src/index.ts:1086`: 18 names of the form `taiga_<resource>_<action>` | – |
| C11 | "Namespacing (grouping related tools under common prefixes) can help delineate boundaries between lots of tools" | S7 | Compliant | The same lines: every name starts with `taiga_` and groups by resource | – |
| C12 | "`title`: Optional human-readable name of the tool for display purposes." | S1 | Compliant | Every `registerTool` call has a `title`, for example `src/index.ts:515` | – |
| C13 | For a tool without parameters, `{ "type": "object", "additionalProperties": false }` is "**Recommended**: explicitly accepts only empty objects" | S1 | Compliant (was Partial) | `src/index.ts:517`, `src/index.ts:533`; `test/smoke.mjs:218` | A1 |
| C14 | "input parameters should be unambiguously named", and descriptions written as "you would describe your tool to a new hire on your team" | S7 | Compliant (was Partial) | Every parameter has a description: `src/index.ts:342`, `src/index.ts:869` and the lines after each | A2 |
| C15 | Say which tools change things: "tool annotations help disclose which tools require open-world access or make destructive changes"; `destructiveHint`: "If true, the tool may perform destructive updates to its environment." | S7, S13 | Compliant | `src/index.ts:41`, `src/index.ts:42`; the three tools that edit and the one that deletes are marked destructive (`src/index.ts:968` is the first of the four); `test/smoke.mjs:417` | – |
| C16 | `readOnlyHint`: "If true, the tool does not modify its environment." | S13 | Compliant (was Partial) | `src/index.ts:44`: `taiga_attachments_get`, which can save a file on the machine, no longer claims to be read-only (`src/index.ts:821`); `test/smoke.mjs:210` | A13 |
| C17 | `openWorldHint`: "If false, the tool's domain of interaction is closed. For example, the world of a web search tool is open, whereas that of a memory tool is not." | S13 | Compliant | `src/index.ts:41`, `src/index.ts:42`: every tool talks to the one Taiga installation of `TAIGA_URL`. The text it returns is still written by other people: see C32 | – |
| C18 | `outputSchema` and `structuredContent` (optional): "a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block" | S1 | Compliant (was N/A) | `src/index.ts:84`: every answer that is data goes as `structuredContent` and as the same JSON in a text block; the shapes start at `src/index.ts:359`. `test/smoke.mjs:221`, `test/smoke.mjs:617` | A14 |
| C19 | Image content as `type: "image"` with base64 `data` and `mimeType` | S1 | Compliant | `src/index.ts:839` | – |
| C20 | Server `instructions` should help the model use the server and not repeat the tool descriptions (summary of the schema comment) | S13 | Compliant (was Partial) | `src/index.ts:26`: what the items are, where to start, and what to do when a change is refused or a deletion is asked for | A3 |

### Answers and errors

| # | Recommendation | Source | Status | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| C21 | Tool execution errors "are reported in tool results with `isError: true`" and "contain actionable feedback that language models can use to self-correct" | S1 | Compliant | `src/index.ts:79`; messages that list the valid values: `src/index.ts:214`, `src/index.ts:228`, `src/index.ts:243` | – |
| C22 | "prompt-engineer your error responses to clearly communicate specific and actionable improvements" | S7 | Compliant | `src/index.ts:179` (how to get a new token), `src/index.ts:446`, `src/index.ts:914`, and the refusal for lack of permission, which lists what the role may do instead (`src/index.ts:320`) | – |
| C23 | Input validation errors are tool execution errors, not protocol errors | S1 | Compliant | Wrong types are answered by the SDK with `isError: true` (`test/smoke.mjs:225`); rules of the server itself: `src/index.ts:446`, `src/index.ts:926` | A7 (test) |
| C24 | "tool implementations should take care to return only high signal information back to agents", "resolving arbitrary alphanumeric UUIDs to more semantically meaningful and interpretable language" | S7 | Compliant | `src/index.ts:251`: one summary line per item, with names in place of ids; `src/index.ts:211` turns names into ids | – |
| C25 | "implementing some combination of pagination, range selection, filtering, and/or truncation" "with sensible default parameter values" | S7 | Compliant | Filters: `src/index.ts:342`; page 1 and 50 items by default, 200 at most: `src/index.ts:393`, `src/index.ts:394` | – |
| C26 | "If you choose to truncate responses, be sure to steer agents with helpful instructions." | S7 | Compliant (was Partial) | `src/index.ts:203`: a cut text ends with how much was cut; `test/smoke.mjs:336` | A4 |
| C27 | Keep answers inside what clients accept: Claude Code "displays a warning when MCP tool output exceeds 10,000 tokens and limits output to 25,000 tokens by default" | S9 | Partial | Default answers are small. Two calls can pass the limit: `size: 200` on a list (`src/index.ts:351`) and `include` on an item with a long history (`src/index.ts:762`, up to 1,000 entries) | P4, and documented in [USAGE.md](USAGE.md) |
| C28 | "We recommend building a few thoughtful tools targeting specific high-impact workflows"; "Make sure each tool you build has a clear, distinct purpose." | S7 | Compliant | 18 tools; one tool reads any kind of item (`src/index.ts:716`) and one deletes any kind (`src/index.ts:1086`) | – |
| C29 | "Building an evaluation allows you to systematically measure the performance of your tools." | S7 | Non-compliant | The 60 scenarios of `test/smoke.mjs:181` onwards call the tools directly: no model takes part. A list of requests for a model and what a good run does is written in [TESTING.md](TESTING.md#requests-to-try-with-a-model), and was not run | P5 |

### Security

| # | Recommendation | Source | Status | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| C30 | Servers **MUST** "Validate all tool inputs" | S1 | Compliant | Schemas: `src/index.ts:342`, `src/index.ts:869`; names checked against the project: `src/index.ts:211`, `src/index.ts:220`, `src/index.ts:234`; the upload must be a file of up to 25 MB (`src/index.ts:1065`) that does not look like a credential (`src/index.ts:496`) | – |
| C31 | Servers **MUST** "Implement proper access controls" | S1 | Compliant | Taiga enforces the permissions of the token (`src/index.ts:157`); write tools exist only with `TAIGA_WRITE=1` and the delete tool only with `TAIGA_DELETE=1` as well (`src/index.ts:1166`, `src/index.ts:1168`); before it creates, changes or deletes an item the server checks the permission Taiga lists for the project (`src/index.ts:320`); `test/smoke.mjs:529` | A21 |
| C32 | Servers **MUST** "Sanitize tool outputs" | S1 | Partial | The token is never in an answer (`test/smoke.mjs:391`, `test/smoke.mjs:556`); file names are rebuilt before reaching the disk (`src/index.ts:854`); long texts are cut (`src/index.ts:203`). Text written by other people is returned as written, because it is what was asked for | A6 (documented in [SECURITY.md](../SECURITY.md)) |
| C33 | Servers **MUST** "Rate limit tool invocations" | S1 | Compliant (was Non-compliant) | `src/index.ts:57`, `src/index.ts:75`: 120 calls a minute; `test/smoke.mjs:609` | A5 |
| C34 | "there **SHOULD** always be a human in the loop with the ability to deny tool invocations" (a duty of the application) | S1 | Compliant | The server gives the client what it needs to ask: `src/index.ts:42`, `src/index.ts:968`. A deletion takes two calls, and the first one only shows (`src/index.ts:1120`); the second is still made by the model (`src/index.ts:22`) | Documented in the client guides; P14 |
| C35 | Local servers **SHOULD** "Use the `stdio` transport to limit access to just the MCP client" | S6 | Compliant | `src/index.ts:1173` | – |
| C36 | "MCP servers **MUST NOT** accept any tokens that were not explicitly issued for the MCP server." (token passthrough) | S6 | N/A | The server accepts no token from an MCP client. The Taiga token comes from its own environment (`src/index.ts:1165`), goes only to `TAIGA_URL` (`src/index.ts:157`) and is not sent to attachment addresses (`src/index.ts:134`; `test/smoke.mjs:391`) | – |
| C37 | "Pass secrets per server, not globally." | S5 | Compliant | `src/index.ts:1137`, `src/index.ts:1162`: four variables are read, from the environment of the process | Client guides set them per server |
| C38 | "Scope tokens narrowly." | S5 | Partial | The token is the whole Taiga session of the user (`src/index.ts:20`). Taiga 6 has no token with a narrower scope: see P6 | P6, and documented in [SECURITY.md](../SECURITY.md) |
| C39 | "Keep long-lived secrets out of plaintext config." | S5 | Partial | `src/index.ts:1165`: the server takes the token from its environment and stores it nowhere. The token expires, but it sits in the configuration file of the client as plain text | A6 (documented in [SECURITY.md](../SECURITY.md) and the client guides); P9 |
| C40 | "Grant the narrowest root that works." (file access) | S5 | Partial | Reading attachments writes only inside one folder of the temp folder of the system, made by `mkdtemp` for the run (`src/index.ts:480`; `test/smoke.mjs:371`). `taiga_attachments_add` refuses what looks like a credential (`src/index.ts:496`; `test/smoke.mjs:508`) and still reads any other path the user can read: the owner chose a deny list over one allowed folder | A15, and documented in [SECURITY.md](../SECURITY.md) |
| C41 | "Know where a server should be talking." | S5 | Compliant | Two destinations: `TAIGA_URL` (`src/index.ts:107`), which must be `https://` unless it is this machine (`src/index.ts:1146`), and the attachment addresses its API lists (`src/index.ts:134`) | A6 (listed in [SECURITY.md](../SECURITY.md)), A16 |
| C42 | SSRF: "MCP clients deployed to a server **MUST** consider SSRF risks ... when fetching OAuth-related URLs" | S6 | N/A | The server fetches no OAuth URL. The nearest case, the attachment address returned by the Taiga API (`src/index.ts:134`), is in the threat model | – |
| C43 | "Pin the version." and "Check Provenance Before You Install" | S5 | Partial | `package.json:26`: no published package and no release yet. The server is built from source, with dependencies pinned by `package-lock.json` (`package.json:54`) | P8 |
| C44 | Implementors **SHOULD** "Provide clear documentation of security implications" | S14 | Compliant | `SECURITY.md:1`: what the server can touch, trust boundaries, threats and what is left to the user | A6 |

### Distribution and documentation

| # | Recommendation | Source | Status | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| C45 | Registry: an `mcpName` property in `package.json` and a `server.json` whose `name` matches it | S12 | N/A | `package.json:26`: the package is private and is not published | P8 |
| C46 | Tools registered with `registerTool` and a schema object. The type declarations of SDK 2 mark the older form, a bare record of fields, as "@deprecated Wrap with `z.object({...})` instead" | S8, S19 | Compliant | `src/index.ts:564` and the 17 other calls: each `inputSchema` and `outputSchema` is a Zod object | A12 |
| C47 | Document each tool with its inputs and its annotations, as the Filesystem reference server does (a practice, not a rule) | S15 | Compliant | [TOOLS.md](TOOLS.md); `test/smoke.mjs:570` fails when it drifts from `tools/list` | A6 |
| C48 | Installation documented with the commands and files each client documents | S9, S10, S11 | Compliant | `docs/clients/claude-code.md:1`, `docs/clients/claude-desktop.md:1`, `docs/clients/codex.md:1`: each guide names the page its commands and files come from | A6 |
| C49 | Claude Desktop installs local servers as extensions (`.mcpb` files), which avoid "manually configuring JSON files and managing dependencies" | S16 | N/A | `package.json:32`: no extension is packaged; the manual configuration of S10 is documented in `docs/clients/claude-desktop.md:1` | P9 |

Totals: 49 rows. 38 Compliant, 6 Partial (C27, C32, C38, C39, C40, C43), 1 Non-compliant (C29), 4 N/A (C36, C42, C45, C49). In version 0.2.0 they were 33, 9, 2 and 5.

## Applied

From the audit of 2026-10-11:

| Id | Change | Where |
| --- | --- | --- |
| A1 | The two tools without parameters declare a schema that accepts only an empty object | `src/index.ts:517`, `src/index.ts:533` |
| A2 | The seven parameters that had no description got one (`tag`, `page`, `severity`, `priority`, `text` of the search, `subject`, `tags`); examples no longer use names of one installation | `src/index.ts:342`, `src/index.ts:869` |
| A3 | The server instructions no longer say which language the texts are in | `src/index.ts:26` |
| A4 | A text that is cut ends with `… (cut: the first N of M characters)` | `src/index.ts:203` |
| A5 | At most 120 tool calls a minute; the call above the limit is answered with a tool error that says how long to wait. The owner confirmed the value on 2026-10-12 | `src/index.ts:57` |
| A6 | Documentation: tool reference, threat model, client guides, this audit | `docs/`, `SECURITY.md`, `README.md` |
| A7 | Tests for the items above, for exit on end of input and for wrong argument types; the test data names no company | `test/smoke.mjs` |

From the security review of 2026-10-12:

| Id | Change | Where |
| --- | --- | --- |
| A8 | A saved attachment goes to a folder made by `mkdtemp`, in place of the fixed folder `taiga-mcp` of the temp folder, which on a machine with several users another of them could read or prepare in advance. S18: the name ends in "six random characters" and the folder is created "as if by a call to" `mkdir(pathname, S_IRWXU)`. The whole saved name is cleaned. General secure-coding practice, not a recommendation of the MCP or Anthropic pages. See A20 for how many folders | `src/index.ts:480` |
| A9 | A test that the token is in nothing the server writes, on stdout or on stderr | `test/smoke.mjs:391`, `test/smoke.mjs:556` |
| A10 | `.gitignore` covers `.mcp.json` and `.codex/`, the project-scoped configurations S9 and S11 describe, where a token can end up | `.gitignore:10`, `.gitignore:11` |
| A11 | The guides say that a token typed in a registration command stays in the history of the shell | `docs/clients/claude-code.md:51`, `docs/clients/codex.md:43`, `SECURITY.md:84` |

From the decisions of the owner on 2026-10-12, each a proposal of this audit:

| Id | Change | Where |
| --- | --- | --- |
| A12 | P1: version 2 of the TypeScript SDK (`@modelcontextprotocol/server`), started with `serveStdio`. Node 20 or newer, which that SDK requires. The installed tree went from 98 packages to 6: the SDK and its core, `zod`, TypeScript, and the Node types with the one package they need | `package.json:54`, `package.json:43`, `src/index.ts:1173` |
| A13 | P2: `taiga_attachments_get` is declared `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true` | `src/index.ts:44` |
| A14 | P3: every tool that answers data declares an `outputSchema` and answers with `structuredContent` and the same JSON as text. `taiga_projects_list` and `taiga_sprints_list`, which answered a bare array, now answer `{ "projects": [...] }` and `{ "sprints": [...] }`. A value Taiga may leave out is optional in the schema, so that an answer is never refused for it | `src/index.ts:84`, `src/index.ts:359` |
| A15 | P7, in another form. The owner did not want users to move a file into an allowed folder before attaching it. `taiga_attachments_add` refuses, after following links, a path with a name that starts with a dot, the folder where programs keep the data of the user (except the temp folder inside it) and key files. A deny list, not a sandbox | `src/index.ts:496` |
| A16 | P10, in part: `TAIGA_URL` must be `https://`, except for this machine, and must not carry a user or a password. Redirects are still followed: `fetch` drops `Authorization` when a redirect leaves the origin (measured on Node 18.18 and again on Node 24.15) | `src/index.ts:1146` |
| A17 | P11, in part: every request to Taiga has a limit of 120 seconds. The download is still read whole, on the size the API reports | `src/index.ts:54` |
| A18 | P12: the nine SVG diagrams no longer import web fonts and name one generic font family per text | `docs/diagrams/` |
| A19 | P13: the two actions of the CI are pinned by commit SHA, and Dependabot proposes their updates. The CI now runs on Linux, macOS and Windows, on Node 20 and 24 | `.github/workflows/ci.yml:23`, `.github/workflows/ci.yml:24`, `.github/dependabot.yml:1` |
| A20 | A8 revisited: one folder for the whole run of the server, in place of one per file. A folder deleted while the server runs is replaced | `src/index.ts:480` |
| A23 | P8, in part: the licence is MIT (`LICENSE`). Publishing is not done: see P8 | `package.json:25` |

Asked for by the owner on 2026-10-12, beyond the audit:

| Id | Change | Where |
| --- | --- | --- |
| A21 | New tools: `taiga_userstories_update`, `taiga_issues_create`, `taiga_issues_update`, and `taiga_items_delete` behind a second variable, `TAIGA_DELETE=1`, in two calls. `taiga_attachments_add` takes any kind of item. Before it creates, changes or deletes an item, the server checks the permissions Taiga lists for the project and, when one is missing, sends nothing and says what the role may do instead, telling the model to offer the alternatives and wait. An attachment is sent without that check: Taiga decides. The permission names and what a deletion takes with it come from S21: `update_perms = CommentAndOrUpdatePerm('modify_us', 'comment_us')`, and the `user_story` field of a task has `on_delete=models.CASCADE` | `src/index.ts:908`, `src/index.ts:320`, `src/index.ts:292`, `src/index.ts:1086` |
| A22 | Tests: 60 scenarios against a simulated Taiga, a coverage measure with no dependency, a live test for a real Taiga, and their report | `test/smoke.mjs`, `test/coverage.mjs`, `test/live.mjs`, [TESTING.md](TESTING.md) |

What changed for someone who used version 0.2.0:

- No tool or parameter was renamed or removed.
- Node 20 or newer is needed.
- `taiga_projects_list` and `taiga_sprints_list` answer an object in place of an array.
- `taiga_attachments_get` is not marked read-only, and saves to one folder per run.
- `taiga_attachments_add` takes user stories and issues too, and refuses files that look like credentials.
- A `TAIGA_URL` over plain `http://` to another machine stops the server at start.
- A write the role of the user does not allow is refused by the server before Taiga is asked.
- Two error messages say more: `#13 is not a user story: it is a task.` and `#12 is not a task: it is a user story.`

## Proposals still open

| Id | Proposal | State |
| --- | --- | --- |
| P4 | Page the history and the comments of `taiga_items_get` | Declined for now by the owner: no real case of an answer too long was reported |
| P5 | An evaluation: realistic requests run by a model against a test Taiga, with expected outcomes | The list of requests is written in [TESTING.md](TESTING.md#requests-to-try-with-a-model). Running it needs a model and a client |
| P6 | A narrower or renewable credential | Studied on 2026-10-12 (S22), not applied. Taiga 6 has no token with a chosen lifetime or a reduced scope. What it has: (1) the refresh token: "This token has an expiration time so you must update it with a refresh API call", and each refresh replaces the refresh token, so a server that renews would end the browser session the token was copied from; (2) application tokens, sent as "Authorization: Application ${AUTH_TOKEN}": they do not expire and can be revoked, but carry every permission of the user and need an application created by an administrator; (3) a dedicated user with a restricted role, the only native way to narrow what the token can do. A token with a chosen lifetime would need code in the Taiga back end. `[not verified]`: none of this was tried against an installation |
| P8 | Publish to npm and to the MCP Registry | Blocked on a name. The name `taiga-mcp` on npm belongs to another project (checked on 2026-10-12 with `npm view taiga-mcp`), so the package needs another name, for example under the scope of the owner, before `mcpName` and `server.json` can be written: S12 says "The `name` property in `server.json` **must** match the `mcpName` property in `package.json`" and "`mcpName` **must** start with `io.github.my-username/`". Until then `"private": true` stays, and no guide suggests `npx` |
| P9 | Package a Claude Desktop extension (`.mcpb`) | Studied on 2026-10-12 (S23), not applied. It needs a `manifest.json` (version 0.3 of the manifest; `server.type` "node"; a `user_config` entry with `sensitive: true` for the token), the dependencies inside the bundle ("All dependencies must be bundled in `node_modules`") and a packing tool that is a new dependency (`@anthropic-ai/mcpb`). The specification says of a sensitive value only "mask input and store securely"; the help page (S16) says Claude Desktop encrypts it with the secure storage of the operating system. An extension is installed by hand and updated by hand. One change would be needed here: a boolean of the manifest reaches the server as the text `true`, and the server takes only `1` for `TAIGA_WRITE`. `[not verified]`: nothing was built or installed |
| P10 | Stop following redirects on calls to the API | Declined by the owner: an installation behind a proxy that redirects would stop working, and it could not be tried against one. The half that closes the real exposure, refusing plain http, is A16 |
| P11 | Stop a download at 25 MB of bytes received | Declined by the owner: only a Taiga that misreports sizes is affected, and `TAIGA_URL` is trusted. The time limit is A17 |
| P14 | Ask the user through the client before a deletion (`inputRequired.elicit` of SDK 2, S20), in place of trusting the model to ask | New. The two calls of `taiga_items_delete` keep a single call from deleting, but both are made by the model. An elicitation would put the question to the person. It depends on the client supporting it, which was not checked for any client |

## Not verified

These were not read on the audit dates and are not stated as fact anywhere in this documentation:

- The MCP authorization specification, including what it says about servers on stdio.
- The Anthropic Software Directory Policy, which replaced the MCP Directory Policy on 2026-04-15.
- The Claude Code documentation on permissions for MCP tools, and the last part of its MCP page.
- The Codex commands to inspect or remove one server: the page read documents `codex mcp add`, `codex mcp list`
  and `codex mcp --help`.
- Which MCP clients support elicitation, and how each shows a tool marked `destructiveHint`.
- Whether the MCP Registry treats the user name in `mcpName` as case-sensitive.

Not measured:

- **Other systems and Node versions.** Version 0.3.0 was built and tested on Windows 11 with Node 24.15. The CI
  is set to run on Linux, macOS and Windows with Node 20 and 24, and has not run yet: the repository has no remote.
  The mode of the folder `mkdtemp` makes (S18) and the refusal of a link to a secret are checked only where the
  CI runs.
- **The time limit.** No scenario waits 120 seconds to see it fire.
- **The configuration files of the MCP clients and the history of the shell**, outside this repository, where a
  real token may be: they were not opened.
- **A real Taiga.** Not run yet: it waits for a `.env` with a token. See [TESTING.md](TESTING.md#live-test).
