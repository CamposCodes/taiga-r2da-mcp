# Claude Code

How to install `taiga-mcp` and register it in Claude Code.

Every command and file format on this page comes from the Claude Code documentation,
[Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp), read on 2026-10-11 and again on 2026-10-12. What is specific
to this server is the name `taiga`, the four variables and the name of the package.

## 1. Check Node

Requires Node 20 or newer: check with `node --version`. There is nothing else to install: the server is on npm as
[`@campos-codes/taiga-r2da-mcp`](https://www.npmjs.com/package/@campos-codes/taiga-r2da-mcp), and the client starts it with `npx`, which downloads the package the first time it runs.

The commands of this page end in `@latest`, the newest version published. To stay on one version until you choose
another, write it in place of `@latest`: `@campos-codes/taiga-r2da-mcp@0.4.0`.

The other way to get the package is `npm install -g @campos-codes/taiga-r2da-mcp`, which leaves the command `taiga-mcp`
on the machine: the client then starts `taiga-mcp`, with no arguments, in place of `npx` and its arguments.

To run the server from
a copy of this repository in place of npm, see
[Other ways to install](../readme.md#other-ways-to-install).

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
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" --transport stdio --scope local taiga -- npx -y @campos-codes/taiga-r2da-mcp@latest
```

Three things the documentation says about this command:

- `--` separates the options of Claude Code (`--transport`, `--env`, `--scope`) from the command of the server
  and its arguments. Everything after it is passed to the server untouched.
- `--env` takes several `KEY=value` pairs, so the name of the server must not come right after it: put another
  option, such as `--transport stdio`, between them.
- The short forms are `-e` (env), `-t` (transport) and `-s` (scope).

A note of this project, not of the documentation: on Windows 11, Claude Code 2.1.296 started the server with this
command as it is, with Node 24 and npm 11. Other versions were not tried.

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
      "command": "npx",
      "args": ["-y", "@campos-codes/taiga-r2da-mcp@latest"],
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
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<NEW_TOKEN>" --transport stdio --scope local taiga -- npx -y @campos-codes/taiga-r2da-mcp@latest
```

## Turn writing on

Register with one more variable:

```bash
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" --env TAIGA_WRITE=1 --transport stdio --scope local taiga -- npx -y @campos-codes/taiga-r2da-mcp@latest
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
claude mcp add --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" --env TAIGA_WRITE=1 --env TAIGA_DELETE=1 --transport stdio --scope local taiga -- npx -y @campos-codes/taiga-r2da-mcp@latest
```

It adds one tool, `taiga_items_delete`, which deletes a user story, a task or an issue. Deleting takes two calls:
the first deletes nothing, shows the item and gives a code, and only a second call with that code can delete. On
that second call, a client that has declared that it can put a question from a server to its user is made to ask
you, and nothing is deleted without your yes there. Taiga keeps no trash, and a user story takes its tasks with
it, so keep this tool off any allow list. See [docs/tools.md](../tools.md) and [docs/security.md](../security.md).

## Things the documentation says that matter here

- **Trust.** "Verify you trust each server before connecting it. Servers that fetch external content can expose
  you to prompt injection risk". This server returns text written by other people in Taiga: see
  [docs/security.md](../security.md).
- **Large answers.** "Claude Code displays a warning when MCP tool output exceeds 10,000 tokens and limits output
  to 25,000 tokens by default. To change the token limit, set the `MAX_MCP_OUTPUT_TOKENS` environment variable".
  The default answers of this server are far smaller; a list with `size: 200` or an item with a long history can
  get there.
