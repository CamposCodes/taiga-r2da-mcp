# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 0.3.0 - 2026-10-12

User stories and issues can be edited and moved, items can be deleted behind a second variable, the server checks
the permissions of Taiga before a change, and it moves to version 2 of the MCP TypeScript SDK. The release also
has the changes made after 0.2.0 by the audit recorded in [docs/COMPLIANCE.md](docs/COMPLIANCE.md). No tool or
parameter was renamed or removed.

### Breaking

What to look at when upgrading from 0.2.0:

- Node 20 or newer is required. It was Node 18.
- `taiga_projects_list` answers `{ "projects": [...] }` and `taiga_sprints_list` answers `{ "sprints": [...] }`.
  Both answered a bare array.
- `taiga_attachments_get` is no longer marked read-only: it has `readOnlyHint: false`, `destructiveHint: false`
  and `idempotentHint: true`, because it can save a file on the machine. A client that asks before every tool not
  marked read-only now asks before opening an attachment. The other 9 read tools are still marked read-only.
- A saved attachment goes to one folder per run of the server, `taiga-mcp-` and six random characters inside the
  temp folder of the system. It went to the fixed folder `taiga-mcp`.
- `TAIGA_URL` over plain `http://` stops the server at start, except for this machine (`localhost`, `127.0.0.1`,
  `[::1]`). An address with a user or a password in it stops it too.
- `taiga_attachments_add` refuses a file that looks like a credential: see Security for what is refused. Such a
  file is sent only after the user copies it to another place under another name.
- Two error messages changed. `#13 is not a user story: it is a task.` was `#13 is not a user story.`, and
  `#12 is not a task: it is a user story.` ended with `only tasks can be changed.`
- An edit that gives `description` or `tags` must give `version`, the version of the item as `taiga_items_get`
  answers it, because both replace what is there. This applies to `taiga_tasks_update`, which 0.2.0 had, and to
  the two new tools that edit. Without the version the call is refused with
  `A description or the tags replace what #13 has now: read it with taiga_items_get and give its version, so that a change somebody made in the meantime is not lost.`
  With a version that is not the current one it is refused with
  `#13 changed since version 6: it is at version 7 now. Read it again with taiga_items_get, look at what changed and send the edit with the new version.`
  Nothing is changed in either case. A move, an assignee, a due date, a block or a comment needs no version.

### Added

- Writing for user stories and issues, with `TAIGA_WRITE=1`: `taiga_userstories_update` edits or moves a user
  story, `taiga_issues_create` creates an issue and `taiga_issues_update` edits or moves one. An edit changes only
  the fields given, and a comment can go alone or with the changes.
- `taiga_attachments_add` sends a file to a user story, a task or an issue. It took only tasks.
- Deleting, only with `TAIGA_DELETE=1` on top of `TAIGA_WRITE=1`: `taiga_items_delete` deletes a user story, a
  task or an issue, in two calls. The first, without `confirm`, deletes nothing: it shows the item (and, for a
  user story, the tasks that go with it) and gives a random code. Only a second call with that code can delete,
  and the code of an item that changed since is refused. `TAIGA_DELETE=1` without `TAIGA_WRITE=1` stops the
  server at start.
- A question to the user before a deletion. On the second call of `taiga_items_delete`, when the client has
  declared that it can put a question from a server to its user (the `elicitation` capability of MCP), the server
  asks through the client, for example
  `Delete the user story #12 "História" of my-project, with its tasks #13? Taiga keeps no trash: this cannot be undone.`
  Only a yes deletes. A no, a cancel or an answer without the yes deletes nothing, spends the code, and the tool
  answers `deleted: false`. It works as a request from the server before revision `2026-07-28` and as an
  `input_required` answer on it. In a client that did not declare the capability nothing changes.
- `taiga_items_get` answers `version`. The three tools that edit take a `version` parameter and answer with the
  version the write left.
- A Claude Desktop extension can be built: `npm run pack:mcpb`, after `npm ci` and `npm run build`, writes
  `build/taiga-mcp-0.3.0.mcpb` from the built server, the three packages it needs to run and `manifest.json`. Its
  form asks for the address, the token (marked sensitive) and two switches, writing and deleting, both off by
  default. The packaging tool validated the manifest; the extension was not installed in a real Claude Desktop.
  The file is not committed and not published.
- `server.json`, which describes the server for the MCP Registry, and `mcpName` in `package.json`. The server is
  not published to the registry yet.
- A check of permissions: before it creates, changes or deletes an item, the server looks for the permission in
  the list Taiga gives for the project (`myPermissions` of `taiga_projects_get`). When it is missing, nothing is
  sent and the error lists what that role may do instead, and tells the model to report the refusal, offer the
  alternatives and wait for the choice. A 403 from Taiga carries the same request. An edit that is only a comment
  needs only the comment permission.
- Structured answers: every tool that answers data declares an `outputSchema` and answers with
  `structuredContent` plus the same JSON as text. `taiga_attachments_get` is the exception: it answers with
  content.
- MCP revision `2026-07-28` (`server/discover`, requests without a handshake), served on the same stdio
  connection as the older revisions, which open with the `initialize` handshake.
- A time limit of 120 seconds on every request to Taiga.
- A limit of 120 tool calls a minute. The call above it is answered with a tool error that says how long to wait.
- Descriptions for the parameters that had none: `tag`, `page`, `severity`, `priority`, `text` of
  `taiga_search`, `subject` and `tags`.
- A licence: MIT, in `LICENSE`. `package.json` says `"license": "MIT"`.
- Documentation in English: architecture, usage, tool reference, testing, client guides for Claude Code, Claude
  Desktop and Codex, security policy, compliance audit and contribution guide. Diagrams in Mermaid and SVG.
- CI on Linux, macOS and Windows, with Node 20 and Node 24. It runs `npm ci`, `npm run check`, `npm run build` and
  `npm run coverage`.
- Tests: exit when the input closes, wrong argument types, the cut notice, the call limit, a check that
  `docs/TOOLS.md` lists the tools and parameters of `tools/list`, and a check that `package.json`, `server.json`
  and `manifest.json` name the same version and the same variables.
- `npm test` runs 70 scenarios against a simulated Taiga, and fails when `docs/TESTING.md` does not list exactly
  those scenarios. `npm run coverage` measures how much of the built server they run: the figure of the last run
  is in [docs/TESTING.md](docs/TESTING.md). `npm run test:live` runs against a real Taiga, in one project: by
  hand, never in CI.

### Changed

- The READMEs follow the layout of established MCP servers: features, requirements, getting started with one
  block per client, configuration, the tools with their parameters, examples, security, development and licence.
  The list of tools is written from `tools/list` by `npm run docs:tools`, and `npm test` fails when it drifts.
  `README.pt-BR.md` is in Portuguese throughout, the list of tools and the diagrams included.

- The server is built on version 2 of the MCP TypeScript SDK: `@modelcontextprotocol/server` 2.x replaces
  `@modelcontextprotocol/sdk` 1.x, and the server is started with `serveStdio`.
- A call to a tool that does not exist is a protocol error, `-32602`. It was a tool result with `isError: true`.
- A request that does not get through says why: `Taiga API unreachable at <address>: fetch failed: <cause>`, where
  the cause is what Node reports (a name that does not resolve, a refused connection, a certificate that is not
  accepted). It said only `fetch failed`.
- The line the server writes to stderr at start says what it may do: `(read-only)`,
  `(writes user stories, tasks, issues and attachments)` or
  `(writes user stories, tasks, issues and attachments, and deletes them)`.
- A text that is cut now ends with `… (cut: the first N of M characters)` in place of a bare `…`. This applies to
  comments, to history entries and to text attachments, whose notice used to be
  `(the first N of M characters)` on a line of its own.
- `taiga_me` and `taiga_projects_list` declare a schema that accepts only an empty object.
- Examples in parameter descriptions use neutral names (`"my-project"`, `"In progress"`, `"New"`).
- The server instructions no longer say which language the texts are in.
- The package is named `@camposcodes/taiga-r2da-mcp`. It was `taiga-mcp`, a name that belongs to another project
  on npm. The command of the server is still `taiga-mcp`, and the server still calls itself `taiga-mcp`.
- `package.json` has keywords, repository links and the list of published files, and is no longer marked private.
  The package is not published yet, neither to npm nor to the MCP Registry: installation is still `git clone`,
  `npm ci` and `npm run build`.
- `TAIGA_WRITE` and `TAIGA_DELETE` are on with `1` or with `true`, and with nothing else: `yes`, `on`, `TRUE` and
  `0` leave them off.
- The nine SVG files of `docs/diagrams/` name only generic font families and no longer fetch web fonts.
  `07-tool-map.svg` shows the three groups of tools: 10, 7 and 1.

### Security

- `TAIGA_URL` must start with `https://`, so that the token does not travel in clear text. Only this machine may
  be reached over `http://`, and an address with a user or a password in it is refused.
- `taiga_attachments_add` refuses, after following links to the real file: a folder or a file whose name starts
  with a dot anywhere in the path (`.ssh`, `.env`, `.aws`, `.git`, `.claude.json`), the folder where programs keep
  the data of the user (`AppData` on Windows, `Library` on macOS) except the temp folder inside it, and key files
  (`.pem`, `.key`, `.p12`, `.pfx`, `.ppk`, `.kdbx`). It is a deny list, not a sandbox: a secret under an ordinary
  name in an ordinary folder is not recognised, and any other file the user can read can still be sent.
- Saved attachments go to one folder per run, made by `mkdtemp` on the first file saved (`taiga-mcp-` and six
  random characters) and made again if it is deleted meanwhile, in place of the fixed folder `taiga-mcp` of the
  temp folder. On a machine shared by several users, a fixed name in a shared temp folder could be read, or
  prepared in advance, by another of them.
- Where the client can put a question from a server to its user, a deletion needs the yes the person gives
  there: the model cannot answer in the person's place. In a client that cannot, the second call of
  `taiga_items_delete` is still made by the model, and what keeps a person in the loop is the permission prompt
  of the MCP client, fed by `destructiveHint: true`. Taiga keeps no trash, and deleting a user story deletes its
  tasks.
- The code that confirms a deletion is random, kept by the server with the item it stands for, good once, for
  ten minutes and only for the last item shown. A guess, a code of another item or of another project, or the
  code of an item that changed since it was shown deletes nothing.
- An edit of a description or of the tags is refused when the item changed since it was read, so that the edit
  of somebody else is not overwritten without a word.
- The tool that packs the Claude Desktop extension, `@anthropic-ai/mcpb` 2.1.2, is fetched with `npx` when the
  extension is built and is not a dependency of the project: its own dependencies carry open security advisories.
- `taiga_attachments_add` also refuses a network path (`\\host\share`), before the disk is touched, and, on
  Linux, the files under `/proc`, `/sys`, `/dev` and `/run`: `/proc/self/environ` holds the token.
- A token with a space or a line break in it stops the server at start, without being shown. Node used to name
  the whole token in its error.
- A person is looked up by id, then by username, then by full name, and a full name two members share is refused.
  Before, a member who chose the username of a colleague as full name could be taken for that colleague.
- A trail on stderr: one line for every change sent to Taiga, with the status it answered, one for every tool
  error, and one for a deletion the user did not approve.
- The two actions of the CI are pinned by commit SHA, and `.github/dependabot.yml` proposes their updates.
- `.gitignore` covers `.mcp.json` and `.codex/`, where a client configuration with a real token can end up.
- The client guides say that a token typed in a registration command stays in the history of the shell.
- A test that the token is in nothing the server writes: answers, errors and stderr.

## 0.2.0 - 2026-10-11

### Added

- Attachments: `taiga_items_get` lists the files of an item and `taiga_attachments_get` opens one. An image comes
  as an image, a text file as text, and any other kind is saved to the temp folder.
- Writing, only with `TAIGA_WRITE=1`: `taiga_userstories_create`, `taiga_tasks_create`, `taiga_tasks_update` and
  `taiga_attachments_add`. Without the variable the tools are not registered and every request is a `GET`.

### Fixed

- `taiga_items_get` returned only the 30 newest history entries and comments, because Taiga pages the history. It
  now asks for up to 1,000.

## 0.1.0

Rebuilt from the notes of the project: there is no version history before 0.2.0, and the date was not recorded.

First version, read-only: `taiga_me`, `taiga_projects_list`, `taiga_projects_get`, `taiga_sprints_list`,
`taiga_userstories_list`, `taiga_tasks_list`, `taiga_issues_list`, `taiga_items_get` and `taiga_search`, over
stdio, authenticated with the session token of Taiga 6.
