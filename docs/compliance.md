# Compliance audit

The implementation checked against what the Model Context Protocol and Anthropic recommend for an MCP server.

- Audited on 2026-10-11, on version 0.2.0.
- A security review on 2026-10-12 read S1, S5 and S6 again in full and searched every file for secrets and
  internal data.
- On the same day the owner of the project decided each open proposal, one by one, and asked for new tools. This
  page describes the result: version 0.3.0.
- Still on that day, an independent pass looked in the code for five kinds of risk found in another MCP server,
  which the owner brought. What it found and what was done is in
  [Review against five risk categories](#review-against-five-risk-categories).
- After the review the owner decided, one by one, the proposals that were left: A29 to A33.
- Still on 2026-10-12 the owner asked for the package to be published to npm: A34. Its scope, `@campos-codes`,
  is the npm user of the owner.
- Before it was published, the package was checked against the documentation of the versions in use, of npm,
  Node.js, TypeScript, Zod and the SDK: see [Review of the npm package](#review-of-the-npm-package) and A35.
- The first try to publish stopped at the scenarios: on a loaded machine one call failed with
  `fetch failed: other side closed`. The owner then asked for reads to be tried twice and for the error to say
  what to tell the user: A36.

**Rules of this audit**

- A recommendation is listed only if its page was read on the audit date. The URL is the one that was fetched.
- A quotation is copied from that page. Where a page could only be read through a summary, the row says so.
- Evidence is a line of [`src/index.ts`](../src/index.ts) or a scenario of [`test/smoke.mjs`](../test/smoke.mjs)
  as they are in version 0.3.0. The line numbers of this page are looked up in the files when it is written.
- Status: **Compliant**, **Partial**, **Non-compliant**, or **N/A** (does not apply to this server).
- Every Partial and Non-compliant row has an action that was applied (A1 to A36) or a proposal that is still open.

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
| S23 | MCP Bundles (`.mcpb`): specification, CLI and Claude documentation | <https://github.com/modelcontextprotocol/mcpb>, <https://claude.com/docs/connectors/building/mcpb.md> (read on 2026-10-12 by a separate research pass that reported quotations; `MANIFEST.md` and `CLI.md` of the repository were then fetched again and read through a summary, and the manifest of this project was validated by the packaging tool itself) |
| S24 | npm docs, Generating provenance statements | <https://docs.npmjs.com/generating-provenance-statements> (fetched on 2026-10-12, read through a summary that reported quotations) |
| S25 | npm docs, version 11, package.json | <https://docs.npmjs.com/cli/v11/configuring-npm/package-json> (fetched on 2026-10-12, read through a summary that reported quotations) |
| S26 | npm docs, version 11, npm-shrinkwrap.json | <https://docs.npmjs.com/cli/v11/configuring-npm/npm-shrinkwrap-json> (fetched on 2026-10-12, read through a summary that reported quotations) |
| S27 | npm docs, version 11, scripts | <https://docs.npmjs.com/cli/v11/using-npm/scripts> (fetched on 2026-10-12, read through a summary that reported quotations) |
| S28 | Node.js, release schedule | <https://github.com/nodejs/Release/blob/main/schedule.json> (its raw file, read on 2026-10-12) |
| S29 | Node.js documentation, globals, of v20 and of v22 | <https://nodejs.org/docs/latest-v20.x/api/globals.html>, <https://nodejs.org/docs/latest-v22.x/api/globals.html> (fetched on 2026-10-12, read through a summary that reported quotations) |
| S30 | TypeScript handbook, Choosing compiler options | <https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html> (read on 2026-10-12) |
| S31 | Zod 4, migration guide | <https://zod.dev/v4/changelog> (fetched on 2026-10-12, read through a summary that reported quotations) |
| S32 | MCP TypeScript SDK v2, Tools and stdio | <https://ts.sdk.modelcontextprotocol.io/v2/servers/tools>, <https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html> (fetched on 2026-10-12, read through a summary that reported quotations) |
| S33 | VS Code, MCP configuration reference and Use MCP servers | <https://code.visualstudio.com/docs/agents/reference/mcp-configuration>, <https://code.visualstudio.com/docs/copilot/customization/mcp-servers> (fetched on 2026-10-13, read through a summary that reported quotations) |
| S34 | Cursor, Model Context Protocol | <https://cursor.com/docs/context/mcp> (fetched on 2026-10-13, read through a summary that reported quotations) |

S7, S8, S9 and S11 were also read through a summary that returns short quotations. Their rows quote only those.

## Matrix

### Transport and protocol

| # | Recommendation | Source | Status | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| C01 | "The server **MUST NOT** write anything to its `stdout` that is not a valid MCP message." | S2 | Compliant | `src/index.ts:1188` (the SDK transport owns stdout), `src/index.ts:1197` and `src/index.ts:1201` (messages for people go to stderr) | – |
| C02 | Log to stderr: "The server **MAY** write UTF-8 strings to `stderr` for any logging purposes". The protocol's own Logging feature is deprecated: "log to `stderr` (stdio) or use OpenTelemetry instead of Logging" | S2, S3 | Compliant | `src/index.ts:1197`; no logging capability is declared (`src/index.ts:1189`) | – |
| C03 | "Messages are delimited by newlines, and **MUST NOT** contain embedded newlines." | S2 | Compliant | `src/index.ts:1188`: messages are written by the stdio transport of the SDK; the pretty-printed JSON of `src/index.ts:63` is a string inside the message | – |
| C04 | "Servers **SHOULD** exit promptly when their standard input is closed or reads return end-of-file." | S2 | Compliant | No code needed: the process ends when stdin closes. `test/smoke.mjs:423` checks exit code 0, and so does the end of every other server the scenarios start | A7 (test) |
| C05 | "Servers **MUST** implement `server/discover`", and every request carries its protocol version in `_meta` (revision 2026-07-28) | S3, S4 | Compliant (was Non-compliant) | `package.json:55`: version 2 of the SDK; `src/index.ts:1188` serves that revision and the older ones on the same connection (the type declarations of the installed SDK say of `serveStdio`: "the opening exchange selects the era, ONE instance from the factory is pinned for the connection lifetime"). `test/smoke.mjs:237` | A12 |
| C06 | Stay on a supported SDK line: `main` is v2, and v1.x "continues to receive bug fixes and security updates for at least six months after the v2 release (2026-07-27)" | S8 | Compliant (was Partial) | `package.json:55` | A12 |
| C07 | An unknown tool is a protocol error: "They are returned as standard JSON-RPC errors" with code `-32602` | S1 | Compliant (was Partial) | `test/smoke.mjs:234` | A12 |
| C08 | "Servers that support tools **MUST** declare the `tools` capability" | S1 | Compliant | `src/index.ts:1189`: the SDK declares it. `test/smoke.mjs:237` reads the tool list through both openings | – |
| C09 | The tool list "**MUST NOT** vary per-connection or as a side effect of other requests", and "Servers **SHOULD** return tools in a deterministic order" | S1 | Compliant | `src/index.ts:1182` and `src/index.ts:1183`: the set is decided once, at start, and listed in registration order; `test/smoke.mjs:430` and `test/smoke.mjs:613` check the order | – |

### Tool definitions

| # | Recommendation | Source | Status | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| C10 | Tool names of 1 to 128 characters, only letters, digits, underscore, hyphen and dot, unique in the server | S1 | Compliant | `src/index.ts:486` to `src/index.ts:1070`: 18 names of the form `taiga_<resource>_<action>` | – |
| C11 | "Namespacing (grouping related tools under common prefixes) can help delineate boundaries between lots of tools" | S7 | Compliant | The same lines: every name starts with `taiga_` and groups by resource | – |
| C12 | "`title`: Optional human-readable name of the tool for display purposes." | S1 | Compliant | Every `registerTool` call has a `title`, for example `src/index.ts:488` | – |
| C13 | For a tool without parameters, `{ "type": "object", "additionalProperties": false }` is "**Recommended**: explicitly accepts only empty objects" | S1 | Compliant (was Partial) | `src/index.ts:490`, `src/index.ts:506`; `test/smoke.mjs:222` | A1 |
| C14 | "input parameters should be unambiguously named", and descriptions written as "you would describe your tool to a new hire on your team" | S7 | Compliant (was Partial) | Every parameter has a description: `src/index.ts:325`, `src/index.ts:841` and the lines after each | A2 |
| C15 | Say which tools change things: "tool annotations help disclose which tools require open-world access or make destructive changes"; `destructiveHint`: "If true, the tool may perform destructive updates to its environment." | S7, S13 | Compliant | `src/index.ts:25`, `src/index.ts:26`; the three tools that edit and the one that deletes are marked destructive (`src/index.ts:954` is the first of the four); `test/smoke.mjs:430` | – |
| C16 | `readOnlyHint`: "If true, the tool does not modify its environment." | S13 | Compliant (was Partial) | `src/index.ts:27`: `taiga_attachments_get`, which can save a file on the machine, no longer claims to be read-only (`src/index.ts:795`); `test/smoke.mjs:215` | A13 |
| C17 | `openWorldHint`: "If false, the tool's domain of interaction is closed. For example, the world of a web search tool is open, whereas that of a memory tool is not." | S13 | Compliant | `src/index.ts:25`, `src/index.ts:26`: every tool talks to the one Taiga installation of `TAIGA_URL`. The text it returns is still written by other people: see C32 | – |
| C18 | `outputSchema` and `structuredContent` (optional): "a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block" | S1 | Compliant (was N/A) | `src/index.ts:67`: every answer that is data goes as `structuredContent` and as the same JSON in a text block; the shapes start at `src/index.ts:341`. `test/smoke.mjs:225`, `test/smoke.mjs:734` | A14 |
| C19 | Image content as `type: "image"` with base64 `data` and `mimeType` | S1 | Compliant | `src/index.ts:813` | – |
| C20 | Server `instructions` should help the model use the server and not repeat the tool descriptions (summary of the schema comment) | S13 | Compliant (was Partial) | `src/index.ts:10`: what the items are, where to start, and what to do when a change is refused or a deletion is asked for | A3 |

### Answers and errors

| # | Recommendation | Source | Status | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| C21 | Tool execution errors "are reported in tool results with `isError: true`" and "contain actionable feedback that language models can use to self-correct" | S1 | Compliant | `src/index.ts:58`; messages that list the valid values: `src/index.ts:203`, `src/index.ts:217`, `src/index.ts:234` | – |
| C22 | "prompt-engineer your error responses to clearly communicate specific and actionable improvements" | S7 | Compliant | `src/index.ts:145` (how to get a new token), `src/index.ts:421`, `src/index.ts:889`, and the refusal for lack of permission, which lists what the role may do instead (`src/index.ts:303`) | – |
| C23 | Input validation errors are tool execution errors, not protocol errors | S1 | Compliant | Wrong types are answered by the SDK with `isError: true` (`test/smoke.mjs:229`); rules of the server itself: `src/index.ts:421`, `src/index.ts:901` | A7 (test) |
| C24 | "tool implementations should take care to return only high signal information back to agents", "resolving arbitrary alphanumeric UUIDs to more semantically meaningful and interpretable language" | S7 | Compliant | `src/index.ts:241`: one summary line per item, with names in place of ids; `src/index.ts:200` turns names into ids | – |
| C25 | "implementing some combination of pagination, range selection, filtering, and/or truncation" "with sensible default parameter values" | S7 | Compliant | Filters: `src/index.ts:325`; page 1 and 50 items by default, 200 at most: `src/index.ts:377`, `src/index.ts:378` | – |
| C26 | "If you choose to truncate responses, be sure to steer agents with helpful instructions." | S7 | Compliant (was Partial) | `src/index.ts:193`: a cut text ends with how much was cut; `test/smoke.mjs:344` | A4 |
| C27 | Keep answers inside what clients accept: Claude Code "displays a warning when MCP tool output exceeds 10,000 tokens and limits output to 25,000 tokens by default" | S9 | Partial | Default answers are small. Two calls can pass the limit: `size: 200` on a list (`src/index.ts:334`) and `include` on an item with a long history (`src/index.ts:736`, up to 1,000 entries) | P4, and documented in [docs/usage.md](usage.md) |
| C28 | "We recommend building a few thoughtful tools targeting specific high-impact workflows"; "Make sure each tool you build has a clear, distinct purpose." | S7 | Compliant | 18 tools; one tool reads any kind of item (`src/index.ts:689`) and one deletes any kind (`src/index.ts:1070`) | – |
| C29 | "Building an evaluation allows you to systematically measure the performance of your tools." | S7 | Non-compliant | The 74 scenarios of `test/smoke.mjs:179` onwards call the tools directly: no model takes part. A list of requests for a model and what a good run does is written in [docs/testing.md](testing.md#requests-to-try-with-a-model), and was not run | P5 |

### Security

| # | Recommendation | Source | Status | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| C30 | Servers **MUST** "Validate all tool inputs" | S1 | Compliant | Schemas: `src/index.ts:325`, `src/index.ts:841`; names checked against the project: `src/index.ts:200`, `src/index.ts:208`, `src/index.ts:225`; the upload must be a file of up to 25 MB (`src/index.ts:466`) that does not look like a credential (`src/index.ts:461`) | – |
| C31 | Servers **MUST** "Implement proper access controls" | S1 | Compliant | Taiga enforces the permissions of the token (`src/index.ts:125`); write tools exist only with `TAIGA_WRITE=1` and the delete tool only with `TAIGA_DELETE=1` as well (`src/index.ts:1182`, `src/index.ts:1184`); before it creates, changes or deletes an item the server checks the permission Taiga lists for the project (`src/index.ts:303`); `test/smoke.mjs:570` | A21 |
| C32 | Servers **MUST** "Sanitize tool outputs" | S1 | Partial | The token is never in an answer (`test/smoke.mjs:396`, `test/smoke.mjs:606`); file names are rebuilt before reaching the disk (`src/index.ts:826`); long texts are cut (`src/index.ts:193`). Text written by other people is returned as written, because it is what was asked for | A6 (documented in [docs/security.md](security.md)) |
| C33 | Servers **MUST** "Rate limit tool invocations" | S1 | Compliant (was Non-compliant) | `src/index.ts:35`, `src/index.ts:52`: 120 calls a minute; `test/smoke.mjs:726` | A5 |
| C34 | "there **SHOULD** always be a human in the loop with the ability to deny tool invocations" (a duty of the application) | S1 | Compliant | The server gives the client what it needs to ask: `src/index.ts:26`, `src/index.ts:954`. A deletion takes two calls, and the first one only shows: the code that confirms it is random, kept by the server, good once and only for the item that was shown (`src/index.ts:1106`; `test/smoke.mjs:637`). Where the client can put a question to its user, the server asks for the yes itself before it deletes (`src/index.ts:1123`; `test/smoke.mjs:678`). In a client that cannot, the second call is still made by the model | A26, A29; documented in the client guides |
| C35 | Local servers **SHOULD** "Use the `stdio` transport to limit access to just the MCP client" | S6 | Compliant | `src/index.ts:1188` | – |
| C36 | "MCP servers **MUST NOT** accept any tokens that were not explicitly issued for the MCP server." (token passthrough) | S6 | N/A | The server accepts no token from an MCP client. The Taiga token comes from its own environment (`src/index.ts:1176`), goes only to `TAIGA_URL` (`src/index.ts:125`) and is not sent to attachment addresses (`src/index.ts:106`; `test/smoke.mjs:396`) | – |
| C37 | "Pass secrets per server, not globally." | S5 | Compliant | `src/index.ts:1150`, `src/index.ts:1174`: four variables are read, from the environment of the process | Client guides set them per server |
| C38 | "Scope tokens narrowly." | S5 | Partial | The token is the whole Taiga session of the user (`src/index.ts:125`). Taiga 6 has no token with a narrower scope: see P6 | P6, and documented in [docs/security.md](security.md) |
| C39 | "Keep long-lived secrets out of plaintext config." | S5 | Partial | `src/index.ts:1176`: the server takes the token from its environment and stores it nowhere. The token expires, but in a configuration written by hand it sits in the file of the client as plain text. A Claude Desktop extension, which asks for the token in a form, can be built (A31) | A6 (documented in [docs/security.md](security.md) and the client guides); A31 |
| C40 | "Grant the narrowest root that works." (file access) | S5 | Partial | Reading attachments writes only inside one folder of the temp folder of the system, made by `mkdtemp` for the run (`src/index.ts:450`; `test/smoke.mjs:378`). `taiga_attachments_add` refuses what looks like a credential (`src/index.ts:461`; `test/smoke.mjs:548`) and still reads any other path the user can read: the owner chose a deny list over one allowed folder | A15, and documented in [docs/security.md](security.md) |
| C41 | "Know where a server should be talking." | S5 | Compliant | Two destinations: `TAIGA_URL` (`src/index.ts:85`), which must be `https://` unless it is this machine (`src/index.ts:1158`), and the attachment addresses its API lists (`src/index.ts:106`) | A6 (listed in [docs/security.md](security.md)), A16 |
| C42 | SSRF: "MCP clients deployed to a server **MUST** consider SSRF risks ... when fetching OAuth-related URLs" | S6 | N/A | The server fetches no OAuth URL. The nearest case, the attachment address returned by the Taiga API (`src/index.ts:106`), is in the threat model | – |
| C43 | "Pin the version." and "Check Provenance Before You Install" | S5 | Partial | `package.json:2`: the package is on npm, and the README and the guide of each client show how to name one version (`docs/readme.md:225`). It carries no provenance attestation: S24 says "To publish a package with provenance, you must build your package with a supported cloud CI/CD provider", and this one was published from a machine, which `docs/security.md:101` tells the reader. The two dependencies have exact versions (`package.json:55`), so an install from npm brings the packages the scenarios run with, and `package-lock.json` pins them with their hashes for a build from source | A34, A35, P16 |
| C44 | Implementors **SHOULD** "Provide clear documentation of security implications" | S14 | Compliant | `docs/security.md:1`: what the server can touch, trust boundaries, threats and what is left to the user | A6 |

### Distribution and documentation

| # | Recommendation | Source | Status | Evidence | Action |
| --- | --- | --- | --- | --- | --- |
| C45 | Registry: an `mcpName` property in `package.json` and a `server.json` whose `name` matches it | S12 | Compliant (was N/A) | `package.json:4`, `server.json:3`; `test/smoke.mjs:737` fails when they differ. The package is on npm (A34); the entry of the registry is not published yet | A32 |
| C46 | Tools registered with `registerTool` and a schema object. The type declarations of SDK 2 mark the older form, a bare record of fields, as "@deprecated Wrap with `z.object({...})` instead" | S8, S19 | Compliant | `src/index.ts:537` and the 17 other calls: each `inputSchema` and `outputSchema` is a Zod object | A12 |
| C47 | Document each tool with its inputs and its annotations, as the Filesystem reference server does (a practice, not a rule) | S15 | Compliant | [docs/tools.md](tools.md); `test/smoke.mjs:619` fails when it drifts from `tools/list` | A6 |
| C48 | Installation documented with the commands and files each client documents | S9, S10, S11 | Compliant | `docs/clients/claude-code.md:1`, `docs/clients/claude-desktop.md:1`, `docs/clients/codex.md:1`: each guide names the page its commands and files come from | A6 |
| C49 | Claude Desktop installs local servers as extensions (`.mcpb` files), which avoid "manually configuring JSON files and managing dependencies" | S16 | Partial (was N/A) | `manifest.json:2`, `scripts/pack-mcpb.mjs:1`: `npm run pack:mcpb` builds the extension, and the packaging tool validates the manifest; `test/smoke.mjs:745`. It was not installed in a real Claude Desktop | A31 |

Totals: 49 rows. 39 Compliant, 7 Partial (C27, C32, C38, C39, C40, C43, C49), 1 Non-compliant (C29), 2 N/A (C36, C42). In version 0.2.0 they were 33, 9, 2 and 5.

## Applied

From the audit of 2026-10-11:

| Id | Change | Where |
| --- | --- | --- |
| A1 | The two tools without parameters declare a schema that accepts only an empty object | `src/index.ts:490`, `src/index.ts:506` |
| A2 | The seven parameters that had no description got one (`tag`, `page`, `severity`, `priority`, `text` of the search, `subject`, `tags`); examples no longer use names of one installation | `src/index.ts:325`, `src/index.ts:841` |
| A3 | The server instructions no longer say which language the texts are in | `src/index.ts:10` |
| A4 | A text that is cut ends with `… (cut: the first N of M characters)` | `src/index.ts:193` |
| A5 | At most 120 tool calls a minute; the call above the limit is answered with a tool error that says how long to wait. The owner confirmed the value on 2026-10-12 | `src/index.ts:35` |
| A6 | Documentation: tool reference, threat model, client guides, this audit | `docs/`, `docs/security.md`, `docs/readme.md` |
| A7 | Tests for the items above, for exit on end of input and for wrong argument types; the test data names no company | `test/smoke.mjs` |

From the security review of 2026-10-12:

| Id | Change | Where |
| --- | --- | --- |
| A8 | A saved attachment goes to a folder made by `mkdtemp`, in place of the fixed folder `taiga-mcp` of the temp folder, which on a machine with several users another of them could read or prepare in advance. S18: the name ends in "six random characters" and the folder is created "as if by a call to" `mkdir(pathname, S_IRWXU)`. The whole saved name is cleaned. General secure-coding practice, not a recommendation of the MCP or Anthropic pages. See A20 for how many folders | `src/index.ts:450` |
| A9 | A test that the token is in nothing the server writes, on stdout or on stderr | `test/smoke.mjs:396`, `test/smoke.mjs:606` |
| A10 | `.gitignore` covers `.mcp.json` and `.codex/`, the project-scoped configurations S9 and S11 describe, where a token can end up | `.gitignore:10`, `.gitignore:11` |
| A11 | The guides say that a token typed in a registration command stays in the history of the shell | `docs/clients/claude-code.md:47`, `docs/clients/codex.md:40`, `docs/security.md:85` |

From the decisions of the owner on 2026-10-12, each a proposal of this audit:

| Id | Change | Where |
| --- | --- | --- |
| A12 | P1: version 2 of the TypeScript SDK (`@modelcontextprotocol/server`), started with `serveStdio`. Node 20 or newer, which that SDK requires. The installed tree went from 98 packages to 6: the SDK and its core, `zod`, TypeScript, and the Node types with the one package they need | `package.json:55`, `package.json:39`, `src/index.ts:1188` |
| A13 | P2: `taiga_attachments_get` is declared `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true` | `src/index.ts:27` |
| A14 | P3: every tool that answers data declares an `outputSchema` and answers with `structuredContent` and the same JSON as text. `taiga_projects_list` and `taiga_sprints_list`, which answered a bare array, now answer `{ "projects": [...] }` and `{ "sprints": [...] }`. A value Taiga may leave out is optional in the schema, so that an answer is never refused for it | `src/index.ts:67`, `src/index.ts:341` |
| A15 | P7, in another form. The owner did not want users to move a file into an allowed folder before attaching it. `taiga_attachments_add` refuses, after following links, a path with a name that starts with a dot, the folder where programs keep the data of the user (except the temp folder inside it) and key files. A deny list, not a sandbox | `src/index.ts:461` |
| A16 | P10, in part: `TAIGA_URL` must be `https://`, except for this machine, and must not carry a user or a password. Redirects are still followed: `fetch` drops `Authorization` when a redirect leaves the origin (measured on Node 18.18 and again on Node 24.15) | `src/index.ts:1158` |
| A17 | P11, in part: every request to Taiga has a limit of 120 seconds. The download is still read whole, on the size the API reports | `src/index.ts:34` |
| A18 | P12: the nine SVG diagrams no longer import web fonts and name one generic font family per text | `docs/diagrams/` |
| A19 | P13: the two actions of the CI are pinned by commit SHA, and Dependabot proposes their updates. The CI now runs on Linux, macOS and Windows, on Node 20 and 24, and from A35 on Node 22 and 26 too | `.github/workflows/ci.yml:23`, `.github/workflows/ci.yml:24`, `.github/dependabot.yml:1` |
| A20 | A8 revisited: one folder for the whole run of the server, in place of one per file. A folder deleted while the server runs is replaced | `src/index.ts:450` |
| A23 | P8, in part: the licence is MIT (`LICENSE`). Publishing to npm is A34, and the registry is P8 | `package.json:26` |

Asked for by the owner on 2026-10-12, beyond the audit:

| Id | Change | Where |
| --- | --- | --- |
| A21 | New tools: `taiga_userstories_update`, `taiga_issues_create`, `taiga_issues_update`, and `taiga_items_delete` behind a second variable, `TAIGA_DELETE=1`, in two calls. `taiga_attachments_add` takes any kind of item. Before it creates, changes or deletes an item, the server checks the permissions Taiga lists for the project and, when one is missing, sends nothing and says what the role may do instead, telling the model to offer the alternatives and wait. An attachment is sent without that check: Taiga decides. The permission names and what a deletion takes with it come from S21: `update_perms = CommentAndOrUpdatePerm('modify_us', 'comment_us')`, and the `user_story` field of a task has `on_delete=models.CASCADE` | `src/index.ts:883`, `src/index.ts:303`, `src/index.ts:279`, `src/index.ts:1070` |
| A22 | Tests: 74 scenarios against a simulated Taiga, a coverage measure with no dependency, a live test for a real Taiga, and their report | `test/smoke.mjs`, `test/coverage.mjs`, `test/live.mjs`, [docs/testing.md](testing.md) |

## Review against five risk categories

The owner brought five kinds of risk that a review of another, much larger MCP server had found: scope creep,
secret exposure, insufficient authorization, intent flow subversion and lack of audit. They are not a page read for
this audit, so no row of the matrix cites them. On 2026-10-12 a separate pass, which had not written the code,
looked for each of them in `src/index.ts` and tried to reproduce what it found against a simulated Taiga.

| Category | Verdict | What was found | Action |
| --- | --- | --- | --- |
| Scope creep | Covered | Without `TAIGA_WRITE=1` the write tools do not exist, a value other than `1` does not turn them on, and parameters a tool does not declare are dropped before they reach Taiga. The one read tool that writes to disk does not claim to be read-only | – |
| Secret exposure | Found | (1) On Windows, a file in the profile folder that was refused by its plain path was sent by its network name, `\\localhost\C$\...`: reproduced. (2) On Linux, `/proc/self/environ`, the environment of the server with the token in it, passed the check: read in the code, not run. (3) A token with a line break in it made Node name the whole token in an error that went to stderr: reproduced | A24, A25 |
| Insufficient authorization | Found | (1) The code of a deletion was not bound to the project: the code given for #7 of one project deleted #7 of another: reproduced. (2) A member listed first whose full name was the username of a colleague was taken for that colleague: reproduced. Numbers, user stories and attachments were already resolved inside the project of the call | A26, A27 |
| Intent flow subversion | Found | The code of a deletion could be worked out from the kind, the number and the version of the item, and a wrong guess was answered with the right code, so one call could delete without the item ever being shown: reproduced. A task added to a user story after it was shown went with it. An edit read the version of the item right before writing, so it could replace what a person had just written | A26, then A29 and A30 |
| Lack of audit | Found for the trail, covered for the answer | A refused call was already an error for the client, never a success. But the server wrote nothing after its start line: no record of a change, a deletion or a refusal, and a refusal made by the server itself never reached Taiga | A28 |

| Id | Change | Where |
| --- | --- | --- |
| A24 | `taiga_attachments_add` refuses a network path before touching the disk, a real path that turns out to be one (a drive mapped to a share), and on Linux the files under `/proc`, `/sys`, `/dev` and `/run` | `src/index.ts:457`, `src/index.ts:473`; `test/smoke.mjs:548` |
| A25 | A token with a space, a line break or a character no token has stops the server at start, without being shown | `src/index.ts:1178`; `test/smoke.mjs:196` |
| A26 | The code that confirms a deletion is random and kept by the server, with the project, the item, its version and, for a user story, its tasks. It is good once and for ten minutes, and showing another item replaces it | `src/index.ts:881`, `src/index.ts:1106`; `test/smoke.mjs:637`, `test/smoke.mjs:659` |
| A27 | A person is looked up by id, then by username, then by full name, and a full name that two members share is refused | `src/index.ts:214`; `test/smoke.mjs:305` |
| A28 | A trail on stderr: one line for every change sent to Taiga, with the status it answered, and one for every tool error, with the time. Never the token, never the content of an item | `src/index.ts:38`; `test/smoke.mjs:594` |

After these fixes the live test was run again against a real Taiga, with the same result.

Decided by the owner after the review, on the same day:

| Id | Change | Where |
| --- | --- | --- |
| A29 | P14: on the second call of a deletion, a client that says it can put a question to its user is made to ask, and only a yes given there deletes. The types of the SDK describe the mechanism: a handler returns `inputRequired` with an `inputRequired.elicit` request and reads the answer on re-entry. It runs on both generations of the protocol. A client that cannot be asked keeps the two calls | `src/index.ts:1123`; `test/smoke.mjs:678`, `test/smoke.mjs:705` |
| A30 | P15: `taiga_items_get` answers `version`, and an edit that gives `description` or `tags`, which replace what is there, must give the version it was made on. An edit on a version that is not the current one is not sent | `src/index.ts:906`; `test/smoke.mjs:489` |
| A31 | P9: `npm run pack:mcpb` builds a Claude Desktop extension from `manifest.json`. The form of the extension writes a ticked box as `true`, so `TAIGA_WRITE` and `TAIGA_DELETE` are on with `1` or with `true`. The packaging tool, `@anthropic-ai/mcpb`, is fetched at an exact version when the script runs and is not a dependency of the project: on 2026-10-12 `npm audit` reported open advisories in what it depends on (`node-forge`, "No fix available", and `tmp`). Not installed in a real Claude Desktop | `manifest.json:2`, `scripts/pack-mcpb.mjs:1`, `src/index.ts:1181`; `test/smoke.mjs:745`, `test/smoke.mjs:437` |
| A32 | P8, the part that is not an action of the owner: the package is named `@campos-codes/taiga-r2da-mcp`, `"private"` is gone, and `mcpName` and `server.json` follow S12 | `package.json:4`, `server.json:3`; `test/smoke.mjs:737` |
| A33 | P6: what a screen that hands out a token for this server has to do, written down. No change in the code | `docs/security.md:142` |
| A34 | P8, the npm part: version 0.3.0 is published, since 2026-10-13, as `@campos-codes/taiga-r2da-mcp`. `npm publish` builds the server and runs the scenarios first, and writes the README of the page of the package from `docs/readme.md`. The README and the guides of the three clients start the server with `npx` | `package.json:50`, `scripts/npm-readme.mjs:11`, `docs/readme.md:82` |
| A35 | The review of the npm package: exact versions of the two dependencies, the package reduced to what an installation runs, `verbatimModuleSyntax`, TypeScript 7.0.2 with the types of Node.js 20, Node 22 and 26 in the CI, Dependabot for the npm packages, and the README saying which Node to prefer | `package.json:56`, `package.json:32`, `tsconfig.json:9`, `.github/workflows/ci.yml:20`, `.github/dependabot.yml:9` |
| A36 | Asked by the owner: a read that does not get through is sent a second time, a write is sent once, and the errors for an unreachable Taiga and for a refused token tell the model what to say to the user. The simulated Taiga of the scenarios keeps its idle connections for the whole run, and each run has a folder of its own | `src/index.ts:172`, `src/index.ts:167`, `src/index.ts:146`; `test/smoke.mjs:411`, `test/smoke.mjs:416`, `test/smoke.mjs:461` |

What changed for someone who used version 0.2.0:

- No tool or parameter was renamed or removed.
- An edit that gives `description` or `tags` needs the `version` that `taiga_items_get` gave.
- `TAIGA_WRITE=true` and `TAIGA_DELETE=true` now turn the tools on, as `1` does.
- The package is `@campos-codes/taiga-r2da-mcp`. The command and the name of the server are still `taiga-mcp`.
- A person given by a full name that two members of the project share is refused: give the username.
- `taiga_attachments_add` refuses a network path and, on Linux, the files the system makes up.
- Node 20 or newer is needed.
- `taiga_projects_list` and `taiga_sprints_list` answer an object in place of an array.
- `taiga_attachments_get` is not marked read-only, and saves to one folder per run.
- `taiga_attachments_add` takes user stories and issues too, and refuses files that look like credentials.
- A `TAIGA_URL` over plain `http://` to another machine stops the server at start.
- A write the role of the user does not allow is refused by the server before Taiga is asked.
- Two error messages say more: `#13 is not a user story: it is a task.` and `#12 is not a task: it is a user story.`

## Review of the npm package

Made on 2026-10-12, before the first publication, on the file that `npm pack` writes. Each line was checked
against the documentation of the version in use: npm 11.12.1, Node.js 24.15.0 to build and 20 as the lowest
version allowed, TypeScript 5.9.3 when the review began and 7.0.2 when it ended, Zod 4.6.5 and `@modelcontextprotocol/server` 2.3.1. The owner asked for
Context7 to be the reader; it answered that its monthly quota was exceeded, so each page was fetched from its
own site.

| # | What was checked | Source | Result |
| --- | --- | --- | --- |
| R1 | "Please make sure that your file(s) referenced in `bin` starts with `#!/usr/bin/env node`" | S25 | Met. In the packed file the first line of `dist/index.js` is that one, with a Unix line ending, although the file was packed on Windows |
| R2 | What goes in the package. "Certain files are always included": `package.json`, `README`, `LICENSE`, the file in `main` and the files in `bin` | S25 | Changed (A35): the package held 32 files and 244 kB, the documents included, which nothing in an installation reads. It holds 4 files and 28 kB (`package.json:32`), and its README links the documents on GitHub |
| R3 | The versions installed with the package. For "daemons and command-line tools intended as global installs or devDependencies" npm has `npm-shrinkwrap.json`, which "may be included when publishing a package" | S26 | Changed (A35), by a shorter way: the two dependencies have exact versions (`package.json:56`), and the SDK names its own core at an exact version, so an install brings the three packages the scenarios run with. With the range that was there, an install on 2026-10-12 brought `zod` 4.6.7 in place of 4.6.5. No shrinkwrap is published, so the hashes of `package-lock.json` do not travel with the package: P17 |
| R4 | `engines`: "this field is advisory only and will only produce warnings when your package is installed as a dependency" | S25 | `package.json:39`, which is what the SDK declares for itself. The scenarios pass on 20.0.0, 22.23.3, 24.15.0 and 26.11.1 ([docs/testing.md](testing.md#the-package-as-npm-delivers-it)) |
| R5 | The lines of Node.js that are maintained: v20 ended on 2026-04-30, v22 ends on 2027-04-30, v24 on 2028-04-30, and v26 becomes LTS on 2026-10-28 | S28 | The lowest version allowed is past its end of life. It stays allowed, because the SDK allows it and the scenarios pass on it; the README says to prefer 22 or 24 (`docs/readme.md:58`). The CI ran 20 and 24 only: 22 and 26 were added (`.github/workflows/ci.yml:20`, A35) |
| R6 | `fetch` and `FormData`, which carry every call to Taiga. The documentation of v20 says "Stability: 1 - Experimental"; the history in the documentation of v22 says "v21.0.0: No longer experimental" | S29 | Nothing to change in the code: it works on Node 20, where the scenarios use it. It is the second reason the README gives for 22 or 24 |
| R7 | What `npm publish` runs, in order: `prepublishOnly`, `prepack`, `prepare`, `postpack`, `publish`, `postpublish` | S27 | Met: the build and the scenarios are in `prepublishOnly` (`package.json:50`), the README of the package is written in `prepack` and removed in `postpack` |
| R8 | TypeScript for code that runs in Node.js: `"module": "nodenext"` under "Required", `"verbatimModuleSyntax": true` under "Recommended" | S30 | `module` was already `NodeNext`. `verbatimModuleSyntax` was turned on (`tsconfig.json:9`, A35): the built file is the same, byte for byte |
| R9 | What Zod 4 deprecates: the method forms of the string formats ("still exist and work as before, but are now deprecated"), `.strict()` and `.passthrough()` ("Instead use the top-level `z.strictObject()` and `z.looseObject()` functions"), the `message` parameter and `z.nativeEnum()` | S31 | Met: the source uses none of them. A tool that takes no argument is declared with `z.strictObject` (`src/index.ts:490`) |
| R10 | The SDK: "`inputSchema` is a Zod schema", "Add `outputSchema` and return the matching value as `structuredContent`, next to the human-readable `content`", "`serveStdio` takes a factory", "Log to stderr, never stdout", and a server that holds nothing "exits on its own" when the client closes its end | S32 | Met (`src/index.ts:1188`; `test/smoke.mjs:423`). One difference, kept on purpose: the guide says "A tool that takes no arguments omits `inputSchema`", and here such a tool declares an empty object that refuses any argument |
| R11 | Known flaws and origin of what the server runs on | `npm audit` and `npm audit signatures`, npm 11.12.1, on 2026-10-12 | 0 vulnerabilities, and "3 packages have verified attestations". Their licences are Apache-2.0 (the SDK and its core) and MIT (`zod`) |
| R12 | Versions in use against the newest on 2026-10-12 | The npm registry and GitHub | `@modelcontextprotocol/server` 2.3.1 is the newest. Two were moved after the review, and the built file stayed the same, byte for byte: `typescript` from 5.9.3 to 7.0.2 (`package.json:60`) and `@types/node` from 22 to 20.19.43, the line of the lowest Node.js allowed, so that the types do not offer what that version lacks (A35). Left as they are: `zod` 4.6.5, which is the version the live test ran with: its release notes on GitHub say that 4.6.6, of 2026-10-11, checks the size bounds of an array before it parses the elements, and 4.6.7 came out on the day of the review with no notes, so neither is a reason for a release of its own. After the release, `actions/checkout` and `actions/setup-node` went from 4.4.0 to 7.0.1 and 7.1.0, by two proposals of Dependabot that were merged when their 12 jobs passed. Dependabot now proposes the npm ones too, except a line of `@types/node` newer than the lowest Node.js allowed (`.github/dependabot.yml:9`, A35) |

## Proposals still open

| Id | Proposal | State |
| --- | --- | --- |
| P4 | Page the history and the comments of `taiga_items_get` | Declined for now by the owner: no real case of an answer too long was reported |
| P5 | An evaluation: realistic requests run by a model against a test Taiga, with expected outcomes | The list of requests is written in [docs/testing.md](testing.md#requests-to-try-with-a-model). Running it needs a model and a client |
| P6 | A narrower or renewable credential | Studied on 2026-10-12 (S22). Taiga 6 has no token with a chosen lifetime or a reduced scope. What it has: (1) the refresh token: "This token has an expiration time so you must update it with a refresh API call", and each refresh replaces the refresh token, so a server that renews would end the browser session the token was copied from; (2) application tokens, sent as "Authorization: Application ${AUTH_TOKEN}": they do not expire and can be revoked, but carry every permission of the user and need an application created by an administrator; (3) a dedicated user with a restricted role, the only native way to narrow what the token can do. Decision of the owner: no change in the server now. The owner plans a screen in Taiga that hands out a token for this server, and the server already works with any token the Taiga API accepts as `Bearer`: what such a screen has to do is written in [docs/security.md](security.md) (A33). Application tokens stay unsupported. `[not verified]`: none of this was tried against an installation |
| P8 | Publish to the MCP Registry | The package is on npm (A34). What is left is an action of the owner: publishing `server.json` with the tool of the registry. S12: "The MCP Registry only hosts metadata, not artifacts, so we must publish the package to npm before publishing the server to the MCP Registry." `[not verified]`: whether the registry accepts capital letters in the user name of `mcpName` |
| P10 | Stop following redirects on calls to the API | Declined by the owner: an installation behind a proxy that redirects would stop working, and it could not be tried against one. The half that closes the real exposure, refusing plain http, is A16 |
| P11 | Stop a download at 25 MB of bytes received | Declined by the owner: only a Taiga that misreports sizes is affected, and `TAIGA_URL` is trusted. The time limit is A17 |
| P14 | A human yes before a deletion, in every client | Applied where the client can put a question to its user (A29). What is left: a client that does not declare that capability still lets the model make both calls, and there the person in the loop is the permission prompt of the client. Refusing to delete in such a client was the other choice, and the owner did not take it |
| P16 | Publish from the CI of the repository, with provenance | Open. S24: "To publish a package with provenance, you must build your package with a supported cloud CI/CD provider" and "Today this includes GitHub Actions and GitLab CI/CD." It needs a workflow that publishes, and a decision of the owner on how that workflow logs in to npm |
| P17 | Publish `npm-shrinkwrap.json` with the package | Open. S26: it "may be included when publishing a package", and the case it is meant for is "daemons and command-line tools intended as global installs or devDependencies". It would carry the hashes of the three packages with the package. The command that makes it renames `package-lock.json`, so it waits for the owner. The versions are already exact (A35) |

## Not verified

These were not read on the audit dates and are not stated as fact anywhere in this documentation:

- The MCP authorization specification, including what it says about servers on stdio.
- The Anthropic Software Directory Policy, which replaced the MCP Directory Policy on 2026-04-15.
- The Claude Code documentation on permissions for MCP tools, and the last part of its MCP page.
- The Codex commands to inspect or remove one server: the page read documents `codex mcp add`, `codex mcp list`
  and `codex mcp --help`.
- Which MCP clients declare the elicitation capability, and so which of them the server asks before a deletion; and
  how each shows a tool marked `destructiveHint`.
- The server in VS Code and in Cursor: the READMEs give the configuration their documentation describes (S33, S34),
  and neither client was tried.
- `npx` as the command of the server in Claude Desktop and in Codex on Windows: only Claude Code was tried there
  (see [docs/testing.md](testing.md#the-package-as-npm-delivers-it)).
- The extension in a real Claude Desktop: how it installs, which Node it runs the server on, and how the token
  field is stored.
- Whether the MCP Registry accepts capital letters in the user name of `mcpName`.

Measured by the CI, on 2026-10-13 (<https://github.com/CamposCodes/taiga-r2da-mcp/actions/runs/38340095969>): the
74 scenarios passed on Linux, macOS and Windows, each with Node 20, 22, 24 and 26. That run is where the mode
of the folder `mkdtemp` makes (S18), the refusal of a link to a secret and, on Linux, the refusal of `/proc` were
checked: the machine the server was written on is Windows.

Not measured:

- **The time limit.** No scenario waits 120 seconds to see it fire.
- **The ten minutes of a deletion code.** No scenario waits for one to grow old.
- **A drive mapped to a share**, which `realpath` gives back as a network path: reasoned from the code, not tried.
- **The configuration files of the MCP clients and the history of the shell**, outside this repository, where a
  real token may be: they were not opened.
- **A real Taiga.** Run on 2026-10-12 with `npm run test:live`, in one project of a Taiga 6 installation, and repeated after each change of that day: in the last run 16 of 16 steps passed and no test item was left behind. A separate check in a second project, where the role may not create a user story, showed the refusal with its alternatives and no request sent. See [docs/testing.md](testing.md#live-test).
