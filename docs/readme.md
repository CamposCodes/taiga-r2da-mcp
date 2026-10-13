<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/banner-light.svg">
    <img src="assets/banner-light.svg" alt="The logos of Taiga and of the Model Context Protocol" width="325">
  </picture>
</p>

<h1 align="center">Taiga MCP Server</h1>

<p align="center">
  <a href="https://github.com/CamposCodes/taiga-r2da-mcp/actions/workflows/ci.yml"><img src="https://github.com/CamposCodes/taiga-r2da-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@campos-codes/taiga-r2da-mcp"><img src="https://img.shields.io/npm/v/%40campos-codes%2Ftaiga-r2da-mcp.svg" alt="npm"></a>
  <a href="https://www.npmjs.com/package/@campos-codes/taiga-r2da-mcp"><img src="https://img.shields.io/npm/dm/%40campos-codes%2Ftaiga-r2da-mcp.svg" alt="npm downloads"></a>
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="../package.json"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node 20+"></a>
</p>

<p align="center"><a href="readme.pt-br.md">Português (Brasil)</a></p>

A [Model Context Protocol](https://modelcontextprotocol.io) server that connects AI tools to a
[Taiga](https://taiga.io) 6 installation. With it, Claude Code, Claude Desktop, Codex or any MCP client reads
projects, sprints, user stories, tasks, issues and their attachments in the name of the person who logged in, and
answers questions such as "what is open in the current sprint?" or "which tasks have nobody assigned?".

By default the server **only reads**: every request to Taiga is a `GET`. Started with `TAIGA_WRITE=1` it also
creates, edits and moves user stories, tasks and issues and attaches files to them. It deletes only when
`TAIGA_DELETE=1` is set as well, and then in two calls: the first only shows what would be deleted.

## Install

The server is an npm package, [`@campos-codes/taiga-r2da-mcp`](https://www.npmjs.com/package/@campos-codes/taiga-r2da-mcp), and that is how it is meant to be
installed. There is nothing to clone or to build: your MCP client starts it with

```bash
npx -y @campos-codes/taiga-r2da-mcp
```

and `npx` downloads the package the first time. What to put in each client is in
[Getting started](#getting-started).

## Features

- **18 tools**: 10 to read, 7 to write, 1 to delete.
- **Read-only by default**: writing and deleting are two separate switches, both off.
- **Names, not ids**: the model says `"In progress"` or a username, and the server looks the id up.
- **Short answers**: one summary line per item, with paging, so a board of hundreds of items fits in context.
- **Works behind single sign-on**: it uses the session token of the browser, so no Taiga password is needed.
- **Follows the permissions of Taiga**: when the role of the user may not create, change or delete an item,
  nothing is sent and the model is told what that role may do instead.
- **Asks before it deletes**: the item is shown first, and where the client can put a question to you, the
  server asks you itself.
- **Small**: one source file and two dependencies, `@modelcontextprotocol/server` and `zod`.
- **Nothing to build**: it comes from npm, and `npx` fetches it when the client starts it.

## Requirements

- Node.js 20 or newer. Prefer 22 or 24: Node 20 reached its end of life on 2026-04-30
  ([release schedule](https://github.com/nodejs/Release/blob/main/schedule.json)), and its documentation still marks `fetch`, which carries every call to
  Taiga, as experimental.
- A Taiga 6 installation you can log in to, reached over `https://`.
- An MCP client: Claude Code, Claude Desktop, Codex, VS Code, Cursor, or any other that starts a server over stdio.

## Getting started

The server comes from npm, as [`@campos-codes/taiga-r2da-mcp`](https://www.npmjs.com/package/@campos-codes/taiga-r2da-mcp). There is nothing to install beforehand: the client starts it with
`npx`, which downloads the package the first time it runs.

### 1. Get a token

Log in to your Taiga in the browser, open the developer tools (F12), go to **Application**, **Local Storage**, the
address of your Taiga, and copy the value of the key `token`.

### 2. Add the server to your client

**Standard config.** Most clients read an `mcpServers` object and take this as it is:

```json
{
  "mcpServers": {
    "taiga": {
      "command": "npx",
      "args": ["-y", "@campos-codes/taiga-r2da-mcp"],
      "env": {
        "TAIGA_URL": "https://taiga.example.com",
        "TAIGA_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" --transport stdio --scope local taiga -- npx -y @campos-codes/taiga-r2da-mcp
```

Scopes, how to change an expired token and how to turn writing on: [docs/clients/claude-code.md](clients/claude-code.md).

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Put the configuration above in `claude_desktop_config.json` and start Claude Desktop again. Where the file is and
how to check that the server came up: [docs/clients/claude-desktop.md](clients/claude-desktop.md).

Claude Desktop can also take the server as an extension, a `.mcpb` file that you build from this repository with
`npm run pack:mcpb`. It was not installed in a real Claude Desktop yet: see
[Install as an extension](clients/claude-desktop.md#install-as-an-extension).

</details>

<details>
<summary><b>Codex</b> (CLI, IDE extension, desktop app)</summary>

```bash
codex mcp add taiga --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" -- npx -y @campos-codes/taiga-r2da-mcp
```

Or, in `~/.codex/config.toml`:

```toml
[mcp_servers.taiga]
command = "npx"
args = ["-y", "@campos-codes/taiga-r2da-mcp"]
env = { TAIGA_URL = "https://taiga.example.com", TAIGA_TOKEN = "<YOUR_TOKEN>" }
```

Approval modes and time limits that matter for this server: [docs/clients/codex.md](clients/codex.md).

</details>

<details>
<summary><b>VS Code</b> (GitHub Copilot)</summary>

VS Code keeps its servers under a `servers` key, not `mcpServers`. Run the **MCP: Open User Configuration**
command and add:

```json
{
  "inputs": [
    { "type": "promptString", "id": "taiga-token", "description": "Taiga token", "password": true }
  ],
  "servers": {
    "taiga": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@campos-codes/taiga-r2da-mcp"],
      "env": {
        "TAIGA_URL": "https://taiga.example.com",
        "TAIGA_TOKEN": "${input:taiga-token}"
      }
    }
  }
}
```

The `inputs` entry makes VS Code ask for the token and keep it out of the file: its documentation says of such a
value that it "is then securely stored for subsequent use". Use the configuration of your user profile, not the
`.vscode/mcp.json` of a project, which goes into the repository. Source:
[MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration), read on 2026-10-13. This project did not try the server in VS Code
`[not verified]`.

</details>

<details>
<summary><b>Cursor</b></summary>

Put the standard config in `~/.cursor/mcp.json`, the file the Cursor documentation gives "for tools available
everywhere", and not in the `.cursor/mcp.json` of a project, which goes into the repository. Cursor fills
`${env:NAME}` from the environment it starts in, which keeps the token out of the file:

```json
{
  "mcpServers": {
    "taiga": {
      "command": "npx",
      "args": ["-y", "@campos-codes/taiga-r2da-mcp"],
      "env": {
        "TAIGA_URL": "https://taiga.example.com",
        "TAIGA_TOKEN": "${env:TAIGA_TOKEN}"
      }
    }
  }
}
```

The documentation also says: "Cursor asks for approval before using MCP tools by default." Source:
[Model Context Protocol in Cursor](https://cursor.com/docs/context/mcp), read on 2026-10-13. This project did not try the server in Cursor
`[not verified]`.

</details>

<details>
<summary><b>Any other client</b></summary>

A client that starts an MCP server over stdio needs three things: the command, `npx`; its arguments, `-y` and
`@campos-codes/taiga-r2da-mcp`; and the variables of [Configuration](#configuration) in the environment of the server.

</details>

<details>
<summary><b>Windows</b></summary>

What this project tried on Windows 11, with Node 24 and npm 11:

- Claude Code 2.1.296 starts the server with the command above as it is.
- A program that starts `npx` with no shell does not find it there (`spawn npx ENOENT`), because on Windows
  `npx` is a `.cmd` file. If your client says so, give `cmd` as the command and `/c`, `npx`, `-y` and
  `@campos-codes/taiga-r2da-mcp` as its arguments: started that way the server answered.
- Claude Desktop and Codex were not tried on Windows `[not verified]`. The page of the MCP documentation that
  [the Claude Desktop guide](clients/claude-desktop.md) follows gives `"command": "npx"` for Windows too.

</details>

### 3. Ask

"Which projects do I have in Taiga?" You never have to name a tool.

### Other ways to install

- **One version, until you choose another.** Write the version after the name, `@campos-codes/taiga-r2da-mcp@0.3.0`, wherever the name
  of the package goes. Without it, `npx` decides which version runs.
- **From source.** Build the server and give the client `node` as the command and the absolute path of
  `dist/index.js` as its argument, in place of `npx`, `-y` and the name of the package:

  ```bash
  git clone https://github.com/CamposCodes/taiga-r2da-mcp.git taiga-mcp
  cd taiga-mcp
  npm ci
  npm run build
  ```

Only the name of the package is long: the command it installs is `taiga-mcp`, and the server calls itself
`taiga-mcp`.

## Configuration

| Variable | Required | What it is for |
| --- | --- | --- |
| `TAIGA_URL` | yes | Address of the Taiga site, with or without `/api/v1` at the end. It must start with `https://`: only this machine (`localhost`, `127.0.0.1`, `[::1]`) may be reached over `http://`. An address with a user or a password in it is refused |
| `TAIGA_TOKEN` | yes | Session token of Taiga 6, copied from the browser |
| `TAIGA_WRITE` | no | `1` or `true` registers the seven write tools. Any other value (`yes`, `on`, `TRUE`, `0`), or none, keeps the server read-only |
| `TAIGA_DELETE` | no | `1` or `true` registers `taiga_items_delete`, the tool that deletes. It needs `TAIGA_WRITE` on as well: without it the server stops at start |

The server reads these from its environment and from nowhere else. [`.env.example`](../.env.example) lists them.

The diagram shows which tools exist for each setting of the two switches.

```mermaid
flowchart TD
    start(["The client starts the server"])
    read["10 read tools: always there"]
    w{"TAIGA_WRITE is 1 or true?"}
    write["7 write tools: create, edit, move, attach"]
    d{"TAIGA_DELETE is 1 or true?"}
    del["1 delete tool: shows first, asks, then deletes"]
    ro(["Read-only: every request to Taiga is a GET"])
    rw(["Reads and writes, deletes nothing"])
    all(["Reads, writes and deletes"])
    start --> read
    read --> w
    w -->|"no"| ro
    w -->|"yes"| write
    write --> d
    d -->|"no"| rw
    d -->|"yes"| del
    del --> all
```

The token expires after a time set by your Taiga. When it does, tools answer
`Taiga refused the token: it expired or is wrong.` and you copy a new one. The server does not renew it.

## Tools

The list below is written by `npm run docs:tools` from what the server answers to `tools/list`, and `npm test`
fails when the two differ. Example calls, example answers and errors of each tool are in
[docs/tools.md](tools.md).

<!-- tools:start: written by "npm run docs:tools", do not edit by hand -->

<details>
<summary><b>Read tools: 10, always registered</b></summary>

- **taiga_me**
  - Title: Current user
  - Description: The Taiga user this server reads as.
  - Parameters: None
  - Read-only: **true**
- **taiga_projects_list**
  - Title: List projects
  - Description: Projects the current user is a member of.
  - Parameters: None
  - Read-only: **true**
- **taiga_projects_get**
  - Title: Project details
  - Description: One project with the statuses of user stories (the kanban columns), tasks and issues, its members, sprints and the values accepted for points and for issue type, severity and priority, and what the current user may do in it (myPermissions). Call this first to learn the names accepted by the other tools.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
  - Read-only: **true**
- **taiga_sprints_list**
  - Title: List sprints
  - Description: Sprints of a project with dates, open and closed user stories and points. Newest first.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `closed` (boolean, optional): true: only closed sprints; false: only open
  - Read-only: **true**
- **taiga_userstories_list**
  - Title: List user stories
  - Description: User stories of a project, one summary line each (no description). Combine filters to answer questions such as what is open in a sprint or unassigned. The answer has the total, so ask for the next page when total is larger than page * size.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `status` (string, optional): Status name, e.g. "In progress" (see taiga_projects_get)
    - `assignee` (string, optional): Username or full name of a member, or "none" (unassigned)
    - `closed` (boolean, optional): true: only in a closed status; false: only open
    - `sprint` (string, optional): Sprint name or id, or "backlog" for no sprint
    - `tag` (string, optional): Only the items that carry this tag
    - `text` (string, optional): Words to find in subject and description
    - `page` (integer, optional): Page number, default 1
    - `size` (integer, optional): Items per page, default 50
  - Read-only: **true**
- **taiga_tasks_list**
  - Title: List tasks
  - Description: Tasks of a project, each with the user story it belongs to. A task without a story belongs to a sprint. One summary line each (no description). The answer has the total, so ask for the next page when total is larger than page * size.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `status` (string, optional): Status name, e.g. "In progress" (see taiga_projects_get)
    - `assignee` (string, optional): Username or full name of a member, or "none" (unassigned)
    - `closed` (boolean, optional): true: only in a closed status; false: only open
    - `sprint` (string, optional): Sprint name or id, or "backlog" for no sprint
    - `tag` (string, optional): Only the items that carry this tag
    - `text` (string, optional): Words to find in subject and description
    - `page` (integer, optional): Page number, default 1
    - `size` (integer, optional): Items per page, default 50
    - `userStory` (integer, optional): Only the tasks of this user story (its number)
  - Read-only: **true**
- **taiga_issues_list**
  - Title: List issues
  - Description: Issues (bugs, questions, improvements) of a project, one summary line each (no description). The answer has the total, so ask for the next page when total is larger than page * size.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `status` (string, optional): Status name, e.g. "In progress" (see taiga_projects_get)
    - `assignee` (string, optional): Username or full name of a member, or "none" (unassigned)
    - `closed` (boolean, optional): true: only in a closed status; false: only open
    - `sprint` (string, optional): Sprint name or id, or "backlog" for no sprint
    - `tag` (string, optional): Only the items that carry this tag
    - `text` (string, optional): Words to find in subject and description
    - `page` (integer, optional): Page number, default 1
    - `size` (integer, optional): Items per page, default 50
    - `issueType` (string, optional): Issue type name, e.g. "Bug" (see taiga_projects_get)
    - `severity` (string, optional): Severity name, e.g. "Normal" (see taiga_projects_get)
    - `priority` (string, optional): Priority name, e.g. "High" (see taiga_projects_get)
  - Read-only: **true**
- **taiga_items_get**
  - Title: Get an item
  - Description: One item by its number, whatever its kind, with the description and the list of its attachments (open one with taiga_attachments_get). A user story comes with its tasks. Ask for comments and history only when needed.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `ref` (integer): Number of the user story, task or issue (#12 is 12)
    - `include` (list of "comments" or "history", optional): Extra sections to load
  - Read-only: **true**
- **taiga_search**
  - Title: Search a project
  - Description: Finds user stories, tasks, issues and wiki pages of a project by words in their text.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `text` (string): Words to find
  - Read-only: **true**
- **taiga_attachments_get**
  - Title: Open an attachment
  - Description: The content of a file attached to a user story, task or issue. An image comes as an image and a text file as text. Any other kind (PDF, spreadsheet, ...) is saved to a temporary folder of this machine and the answer is its path, to be read with a file tool.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `ref` (integer): Number of the user story, task or issue (#12 is 12)
    - `attachment` (string): Id or file name of the attachment, as listed by taiga_items_get
  - Read-only: **false**

</details>

<details>
<summary><b>Write tools: 7, only with TAIGA_WRITE on</b></summary>

- **taiga_userstories_create**
  - Title: Create a user story
  - Description: Creates a user story. Without a status it gets the default one of the project, and without a sprint it is in no sprint (on a kanban it shows in the column of its status). The answer has the number of the new story and its address; tasks are added to it with taiga_tasks_create.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `subject` (string): Title of the user story
    - `description` (string, optional): Markdown
    - `assignee` (string, optional): Username or full name of a member, or "none" for nobody
    - `tags` (list of string, optional): Tags of the item. On an edit this list replaces the current one
    - `dueDate` (string, optional): YYYY-MM-DD, or "none" for no due date
    - `status` (string, optional): User story status name, e.g. "New": the column of the kanban (see taiga_projects_get)
    - `sprint` (string, optional): Sprint name, or "backlog" for no sprint
  - Read-only: **false**
- **taiga_userstories_update**
  - Title: Edit or move a user story
  - Description: Changes a user story: only the fields given. A description or the tags are replaced whole, and need the version taiga_items_get gave. Moving it on the kanban is giving the new status; moving it to another sprint, or out of every sprint with "backlog", is giving the sprint. A comment can go alone or with the changes.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `ref` (integer): Number of the user story (#12 is 12)
    - `subject` (string, optional): New title of the user story
    - `description` (string, optional): Markdown
    - `assignee` (string, optional): Username or full name of a member, or "none" for nobody
    - `tags` (list of string, optional): Tags of the item. On an edit this list replaces the current one
    - `dueDate` (string, optional): YYYY-MM-DD, or "none" for no due date
    - `status` (string, optional): User story status name, e.g. "New": the column of the kanban (see taiga_projects_get)
    - `sprint` (string, optional): Sprint name, or "backlog" for no sprint
    - `blocked` (string, optional): Why the user story is blocked, which blocks it; "none" unblocks it
    - `comment` (string, optional): Comment to leave on the user story, Markdown
    - `version` (integer, optional): Version of the item as taiga_items_get gave it. Required with description or tags, which replace what is there
  - Read-only: **false**
  - Destructive: **true**
- **taiga_tasks_create**
  - Title: Create a task
  - Description: Creates a task in a user story or, with no story, in a sprint: one of the two is required. Without a status it gets the default one of the project. The answer has the number of the new task and its address.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `subject` (string): Title of the task
    - `description` (string, optional): Markdown
    - `assignee` (string, optional): Username or full name of a member, or "none" for nobody
    - `tags` (list of string, optional): Tags of the item. On an edit this list replaces the current one
    - `dueDate` (string, optional): YYYY-MM-DD, or "none" for no due date
    - `status` (string, optional): Task status name, e.g. "In progress": the column of the board (see taiga_projects_get)
    - `userStory` (integer, optional): Number of the user story the task belongs to
    - `sprint` (string, optional): Sprint name, for a task without a user story. A task with a story is always in the sprint of its story
  - Read-only: **false**
- **taiga_tasks_update**
  - Title: Edit or move a task
  - Description: Changes a task: only the fields given. A description or the tags are replaced whole, and need the version taiga_items_get gave. Moving it on the board is giving the new status; moving it to another user story or sprint is giving that story or sprint. A comment can go alone or with the changes.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `ref` (integer): Number of the task (#12 is 12)
    - `subject` (string, optional): New title of the task
    - `description` (string, optional): Markdown
    - `assignee` (string, optional): Username or full name of a member, or "none" for nobody
    - `tags` (list of string, optional): Tags of the item. On an edit this list replaces the current one
    - `dueDate` (string, optional): YYYY-MM-DD, or "none" for no due date
    - `status` (string, optional): Task status name, e.g. "In progress": the column of the board (see taiga_projects_get)
    - `userStory` (integer, optional): Number of the user story the task belongs to
    - `sprint` (string, optional): Sprint name, for a task without a user story. A task with a story is always in the sprint of its story
    - `blocked` (string, optional): Why the task is blocked, which blocks it; "none" unblocks it
    - `comment` (string, optional): Comment to leave on the task, Markdown
    - `version` (integer, optional): Version of the item as taiga_items_get gave it. Required with description or tags, which replace what is there
  - Read-only: **false**
  - Destructive: **true**
- **taiga_issues_create**
  - Title: Create an issue
  - Description: Creates an issue (a bug, a question, an improvement). Without a status, type, severity or priority it gets the default ones of the project. The answer has the number of the new issue and its address.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `subject` (string): Title of the issue
    - `description` (string, optional): Markdown
    - `assignee` (string, optional): Username or full name of a member, or "none" for nobody
    - `tags` (list of string, optional): Tags of the item. On an edit this list replaces the current one
    - `dueDate` (string, optional): YYYY-MM-DD, or "none" for no due date
    - `status` (string, optional): Issue status name, e.g. "New" (see taiga_projects_get)
    - `sprint` (string, optional): Sprint name, or "backlog" for no sprint
    - `issueType` (string, optional): Issue type name, e.g. "Bug" (see taiga_projects_get)
    - `severity` (string, optional): Severity name, e.g. "Normal" (see taiga_projects_get)
    - `priority` (string, optional): Priority name, e.g. "High" (see taiga_projects_get)
  - Read-only: **false**
- **taiga_issues_update**
  - Title: Edit or move an issue
  - Description: Changes an issue: only the fields given. A description or the tags are replaced whole, and need the version taiga_items_get gave. Moving it is giving the new status, or the sprint it goes to ("backlog" for none). A comment can go alone or with the changes.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `ref` (integer): Number of the issue (#12 is 12)
    - `subject` (string, optional): New title of the issue
    - `description` (string, optional): Markdown
    - `assignee` (string, optional): Username or full name of a member, or "none" for nobody
    - `tags` (list of string, optional): Tags of the item. On an edit this list replaces the current one
    - `dueDate` (string, optional): YYYY-MM-DD, or "none" for no due date
    - `status` (string, optional): Issue status name, e.g. "New" (see taiga_projects_get)
    - `sprint` (string, optional): Sprint name, or "backlog" for no sprint
    - `issueType` (string, optional): Issue type name, e.g. "Bug" (see taiga_projects_get)
    - `severity` (string, optional): Severity name, e.g. "Normal" (see taiga_projects_get)
    - `priority` (string, optional): Priority name, e.g. "High" (see taiga_projects_get)
    - `blocked` (string, optional): Why the issue is blocked, which blocks it; "none" unblocks it
    - `comment` (string, optional): Comment to leave on the issue, Markdown
    - `version` (integer, optional): Version of the item as taiga_items_get gave it. Required with description or tags, which replace what is there
  - Read-only: **false**
  - Destructive: **true**
- **taiga_attachments_add**
  - Title: Attach a file
  - Description: Sends a file of this machine to a user story, a task or an issue, as an attachment. The answer has the address of the file in Taiga: an image is shown inside a description or a comment by writing ![name](that address) there. A file that looks like a credential is refused.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `ref` (integer): Number of the user story, task or issue (#12 is 12)
    - `path` (string): Full path of the file on this machine
    - `description` (string, optional): Short note shown next to the file
  - Read-only: **false**

</details>

<details>
<summary><b>Delete tool: 1, only with TAIGA_WRITE and TAIGA_DELETE on</b></summary>

- **taiga_items_delete**
  - Title: Delete an item
  - Description: Deletes a user story, a task or an issue with its comments and attachments, for good: Taiga keeps no trash. Deleting a user story deletes its tasks with it. It takes two calls. The first, without confirm, deletes nothing: it shows what would go and gives a code. Show that to the user, ask whether it is really to be deleted, and only after a yes call again with the code in confirm. A code is good once, for ten minutes, and only for the last item shown, as it was shown. A client that can ask the user is made to ask on that second call, and nothing is deleted without the yes given there.
  - Parameters:
    - `project` (string): Project slug or id, as returned by taiga_projects_list (e.g. "my-project")
    - `ref` (integer): Number of the user story, task or issue (#12 is 12)
    - `confirm` (string, optional): The code the first call gave. Leave it out on the first call: nothing is deleted without it
  - Read-only: **false**
  - Destructive: **true**

</details>

<!-- tools:end -->

Three things hold for the tools that write:

- **Names, not ids.** Statuses, sprints, people and issue values are given by name: `taiga_projects_get` lists the
  names a project accepts.
- **A version for what is replaced.** A description and the tags are replaced whole. So an edit of either must
  give the `version` of the item that `taiga_items_get` answered: without it, or when somebody changed the item
  since, nothing is changed and the model is told to read the item again. A move, an assignee, a due date, a block
  or a comment needs no version.
- **The permissions of Taiga.** Before it creates, changes or deletes an item, the server checks what Taiga says
  the user may do in the project (`myPermissions` of `taiga_projects_get`). When the permission is missing,
  nothing is sent and the error tells the model what that role may do instead: for example, create a task in a
  user story that already exists, register an issue or leave a comment. The model is told not to pick one on its
  own: it reports the refusal, offers the alternatives and waits for the choice. A refusal that comes from Taiga
  itself carries the same request.

## Examples

You ask in plain language, and the model picks the tools.

| You ask | What happens |
| --- | --- |
| "Which projects do I have in Taiga?" | `taiga_projects_list` |
| "What is open in the current sprint of my-project?" | `taiga_projects_get` or `taiga_sprints_list` to learn the sprint, then the lists with `sprint` and `closed: false` |
| "Explain task #13 to me, with its comments and attachments." | `taiga_items_get` with `comments`, then `taiga_attachments_get` for each attachment listed |
| "Create a task for the PDF export in user story #12." | With `TAIGA_WRITE` on, one `taiga_tasks_create` with `userStory: 12`. Without it, the model says the server is read-only |
| "Move #13 to In progress and tell the team I started." | One `taiga_tasks_update` with `status` and `comment` |
| "Delete task #13." | With `TAIGA_DELETE` on, `taiga_items_delete` twice: the first call shows the task and you are asked; only after your yes the second call deletes |

More workflows, with the calls and the answers: [docs/usage.md](usage.md).

## How it works

The figure shows the pieces of a session: the client and the server run on your machine, and the server talks to
your Taiga.

![Architecture of taiga-mcp: client and server on the user's machine, Taiga API and attachment files on the Taiga installation](diagrams/01-architecture.svg)

Your MCP client starts the package, with `npx -y @campos-codes/taiga-r2da-mcp`, and gives it the address of your Taiga and your token. The server checks the
token, registers its tools and waits. Each tool call becomes one or more requests to the Taiga REST API, and the
answer goes back to the model as short JSON. More in [docs/architecture.md](architecture.md).

The diagram follows one question from start to finish: the model picks a tool, the server turns the call into
requests to Taiga, and the answer comes back short.

```mermaid
sequenceDiagram
    participant U as You
    participant C as MCP client and model
    participant S as taiga-mcp
    participant T as Taiga API
    U->>C: What is open in the current sprint?
    C->>S: tools/call taiga_tasks_list, over stdio
    S->>T: GET the project, with the token
    T-->>S: statuses, members and sprints
    Note over S: names become ids
    S->>T: GET one page of tasks
    T-->>S: tasks
    Note over S: ids become names, one short line per task
    S-->>C: tool result
    C-->>U: the answer in plain language
```

## Security

The token **is your session in Taiga**: whoever has it reads everything you read, until it expires.

- Set it in the configuration of your client, per server. Do not paste it in a chat, an issue or a repository.
- `TAIGA_URL` must start with `https://`: over plain `http://` the token would travel in clear text, so the server
  refuses such an address, except for this machine.
- Text in a task, a comment or an attachment is written by other people and may carry instructions for the model.
- With `TAIGA_WRITE=1`, what the model creates or edits goes out in your name. The server does not ask you to
  confirm a create or an edit by itself: the client does. Read what the model proposes before allowing it.
- With `TAIGA_DELETE=1`, what is deleted is gone: Taiga keeps no trash, and deleting a user story deletes its
  tasks. The first call of `taiga_items_delete` only shows what would go and gives a random code that is good
  once, for ten minutes, for that item as it was shown. On the second call, where your client can put a question
  from a server to you, the server asks you through it and deletes only on your yes: the model cannot answer in
  your place. In a client that cannot, the second call is still made by the model, and what keeps you in the loop
  is the permission prompt of your client.
- `taiga_attachments_add` refuses a file that looks like a credential: a name that starts with a dot anywhere in
  the path, the folder where programs keep the data of the user, a key file, a file of the system or a network
  path. It is a deny list, not a sandbox: any other file your user can read can be sent. Check the path before
  allowing it.
- Every change sent to Taiga and every tool error leaves a line on stderr, which your client keeps in its log of
  the server: the trail of what the model did and tried.

The threat model, what the server can touch and how to report a vulnerability: [docs/security.md](security.md).

## Documentation

| Page | What is in it |
| --- | --- |
| [docs/architecture.md](architecture.md) | Components, start sequence, a read call and a write call, with diagrams |
| [docs/usage.md](usage.md) | Workflows, example requests, limits and troubleshooting |
| [docs/tools.md](tools.md) | Every tool: parameters, example call, example answer, errors |
| [docs/clients/](clients/) | Installation in Claude Code, Claude Desktop and Codex, and how to build the Claude Desktop extension |
| [docs/security.md](security.md) | Threat model and how to report a vulnerability |
| [docs/compliance.md](compliance.md) | Audit against the MCP specification and Anthropic's guidance, with sources, and what was done about each finding |
| [docs/testing.md](testing.md) | How the server is tested, the list of every scenario and the report of the last run |
| [docs/changelog.md](changelog.md) | What changed in each version |

## Status and limits

- Version 0.3.0. Target: Taiga 6. Transport: stdio only.
- Protocol: MCP revision `2026-07-28` and the older ones, on the same stdio connection, through version 2 of the
  TypeScript SDK (`@modelcontextprotocol/server`).
- Writing covers user stories, tasks and issues: create, edit, move, comment, attach a file and, with
  `TAIGA_DELETE=1`, delete. Sprints and wiki pages are not changed, attachments are not deleted and the points of
  a user story are not set.
- At most 120 tool calls a minute, and 120 seconds for each request to Taiga.
- A read that does not get through is tried a second time; a write is sent once, because the first try may have
  reached Taiga. When Taiga cannot be reached, or refuses the token, the error tells the model to say so to you,
  with what to do: see [Troubleshooting](usage.md#troubleshooting).
- The assignee filter of user stories finds only the main assignee.
- The token is renewed by hand.
- The package is named `@campos-codes/taiga-r2da-mcp`, because the name `taiga-mcp` belongs to another project on
  npm. It is published to npm, and not to the MCP Registry yet. The command of the server is still `taiga-mcp`.
- Not covered: content of wiki pages, epics, timelines, notifications, statistics and custom fields.

## Development

```bash
npm run check        # types
npm run build        # compiles to dist/
npm test             # end-to-end scenarios against a simulated Taiga, needs the build
npm run coverage     # the same scenarios, and how much of the built server they run
npm run docs:tools   # writes the list of tools of the READMEs from the built server
npm run pack:mcpb    # builds the Claude Desktop extension
```

The first four never talk to a real Taiga. `npm run test:live` does, in one project: it is run by hand and never
in CI. See [docs/testing.md](testing.md).

## Contributing

How to build, test and change the server, and what a release takes: [docs/contributing.md](contributing.md). To report a
vulnerability, follow [docs/security.md](security.md) and do not open a public issue.

## License

This project is released under the MIT licence: see [LICENSE](../LICENSE).

The organization (one HTTP client and tools named `taiga_<resource>_<action>`) follows that of
[illodev/taiga-mcp](https://github.com/illodev/taiga-mcp), which is MIT licensed. The code here was written from
scratch and contains no code of Taiga: it only uses its public REST API. "Taiga" and its logo, and the logo of the
Model Context Protocol, belong to their owners. They appear here only to say what the server connects to and which
protocol it speaks: this project is not affiliated with either of them, nor endorsed by them.
