# Claude Code

How to install `taiga-mcp` and register it in Claude Code.

Every command and file format on this page comes from the Claude Code documentation,
[Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp), read on 2026-10-11. What is specific
to this server is the name `taiga`, the four variables and the path.

## 1. Build the server

Requires Node 20 or newer.

```bash
git clone https://github.com/CamposCodes/taiga-r2da-mcp.git taiga-mcp
cd taiga-mcp
npm ci
npm run build
```

The server is `dist/index.js`. Note its absolute path. The package is not published to npm yet: what changes
when it is, is in [From npm, once it is published](../../README.md#from-npm-once-it-is-published).

## 2. Get a token

1. Log in to your Taiga in the browser.
2. Open the developer tools (F12), then **Application**, **Local Storage**, the address of your Taiga.
3. Copy the value of the key `token`. Not `refresh`.

Shortcut: in the **Console** tab, run `copy(localStorage.token)`. The token goes to the clipboard without showing
on screen. The quotes around the value may come along: the server removes them.

## 3. Register the server

Source: the page above. The syntax it gives for a local stdio server is
`claude mcp add [options] <name> -- <command> [args...]`.

```bash
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" --transport stdio --scope local taiga -- node /absolute/path/to/taiga-mcp/dist/index.js
```

Three things the documentation says about this command:

- `--` separates the options of Claude Code (`--transport`, `--env`, `--scope`) from the command of the server
  and its arguments. Everything after it is passed to the server untouched.
- `--env` takes several `KEY=value` pairs, so the name of the server must not come right after it: put another
  option, such as `--transport stdio`, between them.
- The short forms are `-e` (env), `-t` (transport) and `-s` (scope).

A note of this project, not of the documentation: on Windows, give the path with forward slashes, for example
`C:/tools/taiga-mcp/dist/index.js`.

Another note of this project: a command typed in a terminal is normally saved in the history file of the shell,
the token included. On a machine other people can read, delete that line from the history afterwards.

A third note of this project: `TAIGA_URL` must start with `https://`. Plain `http://` is accepted only for an
address of this machine (`localhost`, `127.0.0.1` or `[::1]`).

### Scope

Source: the same page.

| Scope | Loads in | Shared with the team | Stored in |
| --- | --- | --- | --- |
| Local (default) | Current project only | No | `~/.claude.json` |
| Project | Current project only | Yes, via version control | `.mcp.json` in the project root |
| User | All your projects | No | `~/.claude.json` |

Use `local` or `user` for this server: both keep the token in `~/.claude.json`, outside any repository.

For the project scope, the documentation describes variable expansion in `.mcp.json` (`${VAR}` and
`${VAR:-default}`, in `command`, `args`, `env`, `url` and `headers`), which keeps the token out of the file:

```json
{
  "mcpServers": {
    "taiga": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/taiga-mcp/dist/index.js"],
      "env": {
        "TAIGA_URL": "https://taiga.example.com",
        "TAIGA_TOKEN": "${TAIGA_TOKEN}"
      }
    }
  }
}
```

Each person then needs `TAIGA_TOKEN` in the environment Claude Code starts from. That is the opposite of what the
MCP security guide prefers (secrets per server, not in the shell), so choose the project scope only when sharing
the configuration matters more.

## 4. Check

Source: the same page.

```bash
claude mcp list
claude mcp get taiga
```

Inside Claude Code, `/mcp` shows the status of each server. Then ask: "Which projects do I have in Taiga?"

## Change an expired token

```bash
claude mcp remove taiga
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<NEW_TOKEN>" --transport stdio --scope local taiga -- node /absolute/path/to/taiga-mcp/dist/index.js
```

## Turn writing on

Register with one more variable:

```bash
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" --env TAIGA_WRITE=1 --transport stdio --scope local taiga -- node /absolute/path/to/taiga-mcp/dist/index.js
```

Without `TAIGA_WRITE=1` the seven write tools do not exist for the model. With it, do not put
`taiga_userstories_create`, `taiga_userstories_update`, `taiga_tasks_create`, `taiga_tasks_update`,
`taiga_issues_create`, `taiga_issues_update` and `taiga_attachments_add` on an allow list if you want to see each
change before it happens. How Claude Code asks permission for MCP tools is described in its permissions
documentation, which was not read for this guide `[not verified]`.

## Turn deleting on

Register with `TAIGA_DELETE=1` next to `TAIGA_WRITE=1`. Alone it does not work: without `TAIGA_WRITE=1` the server
stops at start.

```bash
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" --env TAIGA_WRITE=1 --env TAIGA_DELETE=1 --transport stdio --scope local taiga -- node /absolute/path/to/taiga-mcp/dist/index.js
```

It adds one tool, `taiga_items_delete`, which deletes a user story, a task or an issue. Deleting takes two calls:
the first deletes nothing, shows the item and gives a code, and only a second call with that code can delete. On
that second call, a client that has declared that it can put a question from a server to its user is made to ask
you, and nothing is deleted without your yes there. Taiga keeps no trash, and a user story takes its tasks with
it, so keep this tool off any allow list. See [TOOLS.md](../TOOLS.md) and [SECURITY.md](../../SECURITY.md).

## Things the documentation says that matter here

- **Trust.** "Verify you trust each server before connecting it. Servers that fetch external content can expose
  you to prompt injection risk". This server returns text written by other people in Taiga: see
  [SECURITY.md](../../SECURITY.md).
- **Large answers.** "Claude Code displays a warning when MCP tool output exceeds 10,000 tokens and limits output
  to 25,000 tokens by default. To change the token limit, set the `MAX_MCP_OUTPUT_TOKENS` environment variable".
  The default answers of this server are far smaller; a list with `size: 200` or an item with a long history can
  get there.
