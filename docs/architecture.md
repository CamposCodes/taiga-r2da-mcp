# Architecture

How the server is built and what happens between a request in plain language and the Taiga API. For the list of
tools see [docs/tools.md](tools.md); for the threat model see [docs/security.md](security.md).

## Components

The diagram shows the processes involved in a session and what travels between them.

![Architecture of taiga-mcp: client and server on the user's machine, Taiga API and attachment files on the Taiga installation](diagrams/01-architecture.svg)

<details>
<summary>The same diagram in Mermaid, with every label</summary>

```mermaid
flowchart LR
    user(["User"])
    subgraph machine["User's machine"]
        client["MCP client: Claude Code, Claude Desktop or Codex"]
        server["taiga-mcp server: node dist/index.js"]
        temp[("Temp folder: taiga-mcp-XXXXXX")]
        files[("Local files")]
    end
    subgraph remote["Taiga installation"]
        api["Taiga REST API: /api/v1"]
        media["Attachment file server"]
    end
    user -->|"asks in plain language"| client
    client <-->|"stdio: JSON-RPC, one message per line"| server
    server -->|"HTTPS with the Bearer token"| api
    server -->|"HTTPS without the token"| media
    server -->|"saves PDFs and other binaries"| temp
    files -.->|"read only by taiga_attachments_add"| server
```

</details>

| Component | What it is | Notes |
| --- | --- | --- |
| MCP client | Claude Code, Claude Desktop, Codex or any client that starts a stdio server | Starts the server as a child process and decides when to ask the user for permission. A client that declared it can also carries to the user the question the server asks before a deletion |
| `taiga-mcp` | One Node process, `node dist/index.js` | Holds the token in memory. Keeps no cache of Taiga. Between calls it remembers only the number of calls of the current minute, the folder where it saves files and the code of the last deletion it showed |
| Taiga REST API | `<TAIGA_URL>/api/v1` | Every request carries `Authorization: Bearer <token>` and has a time limit of 120 seconds |
| Attachment file server | The address Taiga lists for each attachment | Read without the session token: where files are protected, the address carries its own short-lived key |
| Temp folder | One folder per run of the server, `taiga-mcp-` and six random characters, inside the temp folder of the system | Receives the attachments that are neither a text nor an image of up to 3.5 MB. Made by `mkdtemp` on the first file saved, so on Linux and macOS only the user of the process opens it. Made again if it is deleted while the server runs |
| Local files | Any file the user can read | Read only by `taiga_attachments_add`, and only the path given in the call. A path that looks like a credential is refused |

The whole server is one file, [`src/index.ts`](../src/index.ts): a small HTTP client for Taiga, the conversion of
names into ids, the permission check, the tools and the start sequence.

## Start and the two gates

The diagram shows what the server does between being started and being ready, and where the decisions to register
the write tools and the delete tool are taken. The drawing groups the start checks into one step and the Mermaid
version shows each of them.

![Start sequence of taiga-mcp: start checks, the 10 read tools, the 7 write tools behind TAIGA_WRITE and the delete tool behind TAIGA_DELETE](diagrams/02-startup-write-gate.svg)

<details>
<summary>The same diagram in Mermaid, with every label</summary>

```mermaid
flowchart TD
    start(["Client starts node dist/index.js"])
    url{"TAIGA_URL set?"}
    address{"An https address, or this machine, with no user or password?"}
    token{"TAIGA_TOKEN set?"}
    pair{"TAIGA_DELETE is on and TAIGA_WRITE is not?"}
    missing["Exit 1: Missing environment variable"]
    unsafe["Exit 1: TAIGA_URL refused"]
    alone["Exit 1: TAIGA_DELETE=1 needs TAIGA_WRITE=1"]
    me["GET /users/me"]
    valid{"Token accepted?"}
    refused["Exit 1: Taiga refused the token"]
    listen["serveStdio: listen on the stdio connection"]
    ready(["Ready: one status line on stderr"])
    read["Register the 10 read tools"]
    gate{"TAIGA_WRITE is 1 or true?"}
    write["Register the 7 write tools"]
    dgate{"TAIGA_DELETE is 1 or true?"}
    del["Register the 1 delete tool"]
    serving(["The connection is served"])
    start --> url
    url -->|"no"| missing
    url -->|"yes"| address
    address -->|"no"| unsafe
    address -->|"yes"| token
    token -->|"no"| missing
    token -->|"yes"| pair
    pair -->|"yes"| alone
    pair -->|"no"| me
    me --> valid
    valid -->|"no"| refused
    valid -->|"yes"| listen
    listen --> ready
    ready -->|"the client opens the connection"| read
    read --> gate
    gate -->|"no"| serving
    gate -->|"yes"| write
    write --> dgate
    dgate -->|"no"| serving
    dgate -->|"yes"| del
    del --> serving
```

</details>

- A missing variable, a refused address, `TAIGA_DELETE=1` without `TAIGA_WRITE=1`, a Taiga that does not answer or
  a refused token ends the process with exit code 1 and one line on stderr, before any tool exists. The client
  shows that line in its server log.
- `TAIGA_URL` must start with `https://`: over plain `http://` the token would travel in clear text. Only this
  machine (`localhost`, `127.0.0.1`, `[::1]`) may be reached over `http://`. An address with a user or a password
  in it is refused too. The address is checked before any request is made.
- `TAIGA_WRITE` and `TAIGA_DELETE` are read once, at start. Each is on with `1` or with `true`, so that a client
  that builds the environment from a form can write a ticked box as `true`, and with nothing else: `yes`, `on`,
  `TRUE` and `0` leave it off. `TAIGA_WRITE=1` registers the 7 write tools. `TAIGA_DELETE=1` on top of it
  registers `taiga_items_delete`; alone, it stops the server with
  `TAIGA_DELETE=1 needs TAIGA_WRITE=1: deleting is a kind of writing.`
- The tools behind a closed gate are not hidden or disabled: they do not exist, so `tools/list` never shows them
  and a call to one is a protocol error.
- The tools are registered when the client opens the connection. `serveStdio` takes a function that builds the
  server, and calls it when the opening message of the client shows which revision of the protocol it speaks. The
  set of tools is the same for the whole run, because the two variables were read at start. The drawing shows the
  registration as a step of the start.
- After that, every change sent to Taiga and every tool error leaves one line on stderr, with the time: the
  trail of what the server did and refused. See [What 0.3.0 added to the design](#what-030-added-to-the-design).
- The server writes one status line to stderr when it is ready, for example
  `taiga-mcp: https://taiga.example.com as ana (read-only)`. With writing on the line ends with
  `(writes user stories, tasks, issues and attachments)`, and with deleting on with
  `(writes user stories, tasks, issues and attachments, and deletes them)`. stdout carries only protocol messages.
- The server leaves by itself when the client closes its input.

## A read call

The diagram shows one read call from the model to Taiga and back, with the two conversions the server makes:
names into ids on the way in, ids into names on the way out.

![Sequence of a read call: the server reads the project, turns names into ids and summarizes the answer](diagrams/03-read-call.svg)

<details>
<summary>The same diagram in Mermaid, with every label</summary>

```mermaid
sequenceDiagram
    participant M as Model
    participant C as MCP client
    participant S as taiga-mcp
    participant T as Taiga API
    M->>C: tool call taiga_tasks_list
    Note over M,C: project my-project, status In progress, assignee ana
    C->>S: tools/call over stdio
    S->>T: GET /projects/by_slug?slug=my-project
    T-->>S: project with statuses, members and sprints
    Note over S: names become ids, status 12 and assignee 9
    S->>T: GET /tasks?project=32&status=12&assigned_to=9&page=1&page_size=50
    T-->>S: one page of tasks and the x-pagination-count header
    Note over S: ids become names, one summary line per task
    S-->>C: total, page, size and items, as structured content and as JSON text
    C-->>M: tool result
```

</details>

- The model never needs an id. It writes `"In progress"`, a sprint name or a username; the server reads the
  project on every call and looks the name up. There is no cache, which costs one `GET` and never serves a stale
  name.
- A name that does not exist is answered with the valid ones, for example
  `Unknown task status "Inexistente". Valid: A fazer, Em andamento`, so the model corrects itself in one step.
- Lists return one summary line per item, without the description, and the total Taiga counted. The default page
  has 50 items and the largest has 200.
- The answer goes out twice, as structured content and as the same JSON in a text block: see
  [Structured answers](#structured-answers).

## A write call

The diagram shows a write call, with the places where it can stop: the permission prompt of the client, the
permission check and the version check of the server, and a refusal from Taiga. The drawing shows the first and
the last.

![Sequence of a write call: permission prompt, version read, PATCH and the error path](diagrams/04-write-call.svg)

<details>
<summary>The same diagram in Mermaid, with every label</summary>

```mermaid
sequenceDiagram
    participant M as Model
    participant C as MCP client
    participant U as User
    participant S as taiga-mcp
    participant T as Taiga API
    M->>C: tool call taiga_tasks_update
    C->>U: permission prompt, the tool is not read-only
    alt user denies
        U-->>C: deny
        C-->>M: call refused, nothing reaches the server
    else user allows
        U-->>C: allow
        C->>S: tools/call over stdio
        S->>T: GET /projects/by_slug and GET /resolver
        T-->>S: project and the id of the task
        Note over S: modify_task is in the permissions of the project, or the call stops here with an error
        Note over S: a description or tags come with a version, or the call stops here with an error
        S->>T: GET /tasks/200
        T-->>S: task with version 7
        Note over S: a version given in the call is 7, or the call stops here with an error
        S->>T: PATCH /tasks/200 with version 7 and only the fields given
        alt Taiga accepts
            T-->>S: 200 and the task as it was left
            S-->>C: summary of the task, its new version and its URL
        else Taiga refuses
            T-->>S: 4xx and the reason
            S-->>C: isError true and a readable message
        end
        C-->>M: tool result
    end
```

</details>

- The server does not ask for confirmation of a create or an edit by itself. It declares each write tool as not
  read-only (`readOnlyHint: false`), and the three tools that edit and the one that deletes as destructive
  (`destructiveHint: true`), and the client decides to ask. Whether and when a client asks is a property of the
  client: see the guide of yours in [`docs/clients/`](clients/). A deletion is the one write the server asks
  about itself, where the client can carry the question: see [Deleting in two calls](#deleting-in-two-calls).
- Before anything is sent, the server looks for the permission the write needs in the list Taiga gives for the
  project: see [The permission check](#the-permission-check).
- Taiga refuses an edit that does not say which version of the item it was made on. The server reads the item
  immediately before the `PATCH` and sends the version it has just read. For a move, an assignee, a due date, a
  block or a comment that is all: such an edit loses nothing, so it goes on the version of now.
- An edit that gives `description` or `tags` replaces what is there, so the call must give `version`, the one
  `taiga_items_get` answered for the item. Without it the call stops before the item is read:
  `A description or the tags replace what #13 has now: read it with taiga_items_get and give its version, so that a change somebody made in the meantime is not lost.`
  With a version that is not the one the server has just read, the `PATCH` is not sent:
  `#13 changed since version 6: it is at version 7 now. Read it again with taiga_items_get, look at what changed and send the edit with the new version.`
  The `version` parameter is optional in the three tools that edit, and required only in this case.
- The answer of an edit has `version`, the one the write left, to give back in the next edit of the description
  or the tags.
- Only the fields given in the call are sent. `"none"` empties a field (assignee, due date, block), and
  `"backlog"` takes a user story or an issue out of every sprint.
- Every write goes through one function, `TaigaClient.send`. Without `TAIGA_DELETE=1` the only methods it uses are
  `POST` and `PATCH`, and nothing is deleted. With it, `DELETE` is sent by one tool only, `taiga_items_delete`, and
  only on its second call.

## What 0.3.0 added to the design

New in how a call is handled: a permission check before a write, a version on the edits that replace a text (see
[A write call](#a-write-call)), a deletion in two calls with a question to the user, a trail on stderr, and
answers that are data as well as text.

### The permission check

- Taiga gives, with each project, the list of what the current user may do in it. The server reads the project on
  every call anyway, so the check costs no request. `taiga_projects_get` shows the list as `myPermissions`.
- Before a write, the server looks for the permission the write needs: `add_`, `modify_` or `delete_` followed by
  `us` (user story), `task` or `issue`. When it is missing nothing is sent, and the tool error says what that role
  may do in its place. Only the alternatives the role has the permission for are listed, and the last one is
  always to ask a project admin. The table of alternatives is in [docs/tools.md](tools.md#permissions).
- The error ends by telling the model not to work around the refusal on its own: it tells the user what was
  refused, offers the alternatives and waits for the choice. The instructions of the server say the same, and so
  does the error for a `403` that comes from Taiga.
- An edit that is only a `comment` needs only the comment permission, as in Taiga.
- A project that gives no list is not judged by the server: the write is sent and Taiga decides. Taiga also
  decides alone for `taiga_attachments_add`, which the server does not check.
- The check is a help to the model and to the user. The permissions themselves are enforced by Taiga.

### Deleting in two calls

The first diagram shows the first call of a deletion, which deletes nothing, and the question the model then puts
to the user in the conversation.

```mermaid
sequenceDiagram
    participant U as User
    participant M as Model
    participant C as MCP client
    participant S as taiga-mcp
    participant T as Taiga API
    U->>M: Delete user story 12 of my-project
    M->>C: taiga_items_delete with ref 12 and no confirm
    C->>S: tools/call over stdio
    S->>T: GET the project, the user story and its tasks
    T-->>S: user story 12 at version 4, with task 13
    Note over S: keeps the code with what it stands for
    S-->>C: deleted false, the item, its tasks and a random code
    C-->>M: tool result
    M->>U: shows what would go and asks whether to delete it
    U-->>M: yes
```

The second diagram shows the second call: the server checks the code and then either asks the user through the
client, when the client declared that it can carry such a question, or asks nobody, and the permission prompt of
the client was the only check.

```mermaid
sequenceDiagram
    participant U as User
    participant M as Model
    participant C as MCP client
    participant S as taiga-mcp
    participant T as Taiga API
    M->>C: taiga_items_delete with ref 12 and that code in confirm
    C->>U: permission prompt, the tool is marked as destructive
    U-->>C: allow
    C->>S: tools/call over stdio
    S->>T: GET the project, the user story and its tasks again
    T-->>S: user story 12, still at version 4
    Note over S: the code is the one kept, for this item as it is now
    alt the client declared that it can ask its user
        S->>C: question, delete user story 12 with its task 13
        C->>U: the question of the server, yes or no
        U-->>C: yes
        C-->>S: accepted, with the yes
    else the client did not declare it
        Note over S: asks nobody, the prompt of the client was the only check
    end
    S->>T: DELETE /userstories/100
    T-->>S: 204
    S-->>C: deleted true, the item and its tasks
    C-->>M: tool result
    M-->>U: user story 12 and task 13 are deleted
```

- The first call, without `confirm`, deletes nothing. It answers with `deleted: false`, the item, for a user story
  the tasks that go with it (`tasksDeletedWithIt`), a code in `confirm` and, in `next`, what the model must do
  before calling again: show this to the user and ask.
- The code is random. The server keeps the last one it gave, in memory, with what it stands for: the project, the
  item, the version Taiga had of it and, for a user story, its tasks. On the second call it reads the item again
  and goes on only when the code is the one kept, is at most ten minutes old, and still stands for the item as it
  is now. A code is spent by the deletion, by a no of the user and by a call with a wrong code. So a deletion
  cannot be done in one call, a code of one project does not work in another, and an item that changed since it
  was shown is shown again.
- It is the only state the server keeps between two calls, with the count of calls in the minute and the folder
  of saved files. It is one code, not a list: showing another item replaces it.
- On the second call, once the code is accepted, the server looks at what the client declared. When the client
  declared that it can put a question from a server to its user (the `elicitation` capability of MCP), the server
  asks through the client:
  `Delete the user story #12 "História" of my-project, with its tasks #13? Taiga keeps no trash: this cannot be undone.`
  The question has one yes/no field, `delete`, and only a yes deletes. The model cannot answer it: it is the
  client that carries it to the person. A call with a code that is not accepted is never put to the user.
- A no, a cancel or an answer without the yes deletes nothing and spends the code. It leaves a line on stderr,
  and the tool answers `deleted: false` with this in `next`:
  `The user did not approve the deletion: nothing was deleted. Do not ask again unless the user brings it up.`
- The question works on both generations of the protocol. What the client can do comes with the handshake before
  revision `2026-07-28`, and with each request on it. Before `2026-07-28` the question is a request the server
  sends to the client (`elicitation/create`) while the tool call waits. On `2026-07-28` the tool call is answered
  with `input_required` and the question, and the client makes the call again with the answer.
- In a client that did not declare the capability nothing changed: the two calls with the code, both made by the
  model. The code proves that the item was shown, not that a person said yes. The person in the loop there is the
  permission prompt of the client, which the annotation `destructiveHint: true` feeds. Whether and when a client
  asks is a property of the client. The second diagram shows the prompt before the call that deletes; the first
  call is a call of the same tool, so a client may ask before it as well. Which clients declare the capability
  was not checked.
- The permission to delete is checked on both calls, before the item is shown.
- Taiga keeps no trash. A user story goes with its tasks, and every item with its comments and attachments.

### The trail on stderr

Every change the server sends to Taiga leaves a line on stderr with the time, the method, the path and the status
Taiga answered, for example `taiga-mcp: 2026-10-12T15:03:02.776Z DELETE /tasks/200 204`. Every tool error leaves
one with its message, cut at 300 characters: a refusal for lack of permission, a file that is not sent, a call
above the limit. A deletion the user did not approve leaves one too, for example
`taiga-mcp: 2026-10-12T15:03:02.776Z deletion of us #12 in my-project not approved by the user (decline)`. A read
leaves no line. The token is never in a line, and neither is the content of an item. The client keeps stderr in
its log of the server, so the trail lasts as long as that log.

### Structured answers

- Every tool that answers data declares an `outputSchema` and answers with `structuredContent` in that shape, plus
  the same JSON in one `text` block, for the clients that read only text. One function, `run`, makes both from the
  same object.
- `taiga_attachments_get` is the exception. It answers with content (an image, a text, or the path of a saved
  file) and declares no `outputSchema`.
- The schema of an answer is an object, so the two tools that used to answer a bare array now answer an object
  with the list inside: `taiga_projects_list` gives `{ "projects": [...] }` and `taiga_sprints_list` gives
  `{ "sprints": [...] }`.
- In the schemas, a value Taiga may leave out may be missing or null, so that an answer is never refused for it.
- An error does not follow the schema: it is a result with `isError: true` and one readable sentence.

## Taiga endpoints used

| Method and path | Used by |
| --- | --- |
| `GET /users/me` | start check, `taiga_me`, `taiga_projects_list` |
| `GET /projects`, `GET /projects/by_slug`, `GET /projects/<id>` | `taiga_projects_list`, and every tool that takes `project` |
| `GET /milestones` | `taiga_sprints_list` |
| `GET /userstories`, `GET /tasks`, `GET /issues` | the three list tools, and the task list of a user story in `taiga_items_get` and `taiga_items_delete` |
| `GET /resolver` | finding an item by its number |
| `GET /userstories/<id>`, `GET /tasks/<id>`, `GET /issues/<id>` | `taiga_items_get`, the version read of the three tools that edit, and `taiga_items_delete` |
| `GET /userstories/attachments`, `GET /tasks/attachments`, `GET /issues/attachments` | `taiga_items_get`, `taiga_attachments_get` |
| `GET /history/userstory/<id>`, `GET /history/task/<id>`, `GET /history/issue/<id>` | `taiga_items_get` with `include` |
| `GET /search` | `taiga_search` |
| `POST /userstories`, `PATCH /userstories/<id>` | `taiga_userstories_create`, `taiga_userstories_update` |
| `POST /tasks`, `PATCH /tasks/<id>` | `taiga_tasks_create`, `taiga_tasks_update` |
| `POST /issues`, `PATCH /issues/<id>` | `taiga_issues_create`, `taiga_issues_update` |
| `POST /userstories/attachments`, `POST /tasks/attachments`, `POST /issues/attachments` | `taiga_attachments_add` |
| `DELETE /userstories/<id>`, `DELETE /tasks/<id>`, `DELETE /issues/<id>` | `taiga_items_delete`, on its second call |

## Protocol support

- Transport: stdio only. Each person runs their own process with their own token; there is no shared HTTP mode.
- SDK: version 2 of the MCP TypeScript SDK, package `@modelcontextprotocol/server` 2.x (2.3.1 in the lock file).
  It replaces `@modelcontextprotocol/sdk` 1.x and needs Node 20 or newer.
- Both protocol eras on one connection. The server is started with `serveStdio`, and the opening message of the
  client decides how the connection is served. A client of revision `2026-07-28` sends its requests without a
  handshake and can ask `server/discover` what the server supports. A client of an older revision starts with the
  `initialize` handshake. Both get the same tools, built by the same function.
- Capabilities declared: `tools`. The server has no resources, no prompts and uses no sampling, roots or protocol
  logging. It uses one capability of the client, when the client declares it: `elicitation`, for the question
  before a deletion.
- A call to a tool that does not exist is a protocol error, `-32602`. An argument of the wrong type comes back as
  a tool error, and so does every failure inside a tool.

## Design decisions

- **Session token, not a password.** The server uses the token Taiga gives the browser after login, so it also
  works where people enter through an identity provider and have no password in Taiga.
- **Read-only by default, writing behind a gate, deleting behind a second one.** Without `TAIGA_WRITE=1` every
  request to the API is a `GET`. Without `TAIGA_DELETE=1` on top of it no `DELETE` is sent. A configuration made
  for reading stays read-only after an update of the server, and one made for writing does not start deleting.
- **Confirmation by the client.** The write tools describe themselves through annotations and the client asks.
  Deleting adds steps of its own: a first call that only shows and, where the client can put a question from a
  server to its user, a question the server asks through the client before it deletes. In a client that cannot,
  the second call is still made by the model.
- **An edit that replaces a text says which version it read.** A description and the tags are replaced whole. If
  two people, or a person and the model, edit the same item, the later edit would erase the earlier one without a
  word. So the call gives the version it read and the server refuses when the item is at another one. A move or a
  comment loses nothing and needs no version.
- **A refusal comes with the way out.** When the role of the user lacks a permission, the error lists what that
  role may do instead and leaves the choice to the user.
- **A task is always on a board.** The API accepts a task with no user story and no sprint, which no screen shows.
  The server refuses that call before sending anything.
- **A file is sent by its path, not by its content.** The server runs on the machine of the user and reads the
  file from disk. Passing the content through the model would spend context and does not work for binaries.
- **An attachment is read without the session token.** The server downloads only addresses the API listed for
  that item and does not send the token to them, so the token does not leave the Taiga API if the files live on
  another host.
- **An attachment arrives according to its kind.** Images and texts go in the answer, which any client
  understands. A PDF or a spreadsheet would need a library to extract text, so it becomes a local file.
- **Short answers.** Lists carry one line per item and the total. A real project has hundreds of items.
- **Answers as data and as text.** A client that reads structured content gets an object in a declared shape. A
  client that reads only text gets the same JSON.
- **An error is a tool result.** A wrong name or a refusal from the API comes back as readable text.
- **One source file.** Eighteen tools over a small client: splitting it would only spread what is read at once.

## Source layout

```
taiga-mcp/
├── src/index.ts            API client, name conversion, permission check, tools and start sequence
├── test/smoke.mjs          scenarios against a simulated Taiga
├── test/coverage.mjs       runs the scenarios and measures how much of the built server they run
├── test/live.mjs           the same server against a real Taiga, run by hand
├── scripts/pack-mcpb.mjs   builds the Claude Desktop extension into build/
├── docs/                   this documentation
├── dist/                   build output (not in git)
├── build/                  the Claude Desktop extension and the folder it is packed from (not in git)
├── manifest.json           manifest of the Claude Desktop extension
├── server.json             description of the server for the MCP Registry
├── package.json
└── tsconfig.json
```
