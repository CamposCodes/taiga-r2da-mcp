# Codex

How to install `taiga-mcp` and register it in Codex.

The command, the file and the key names on this page come from the Codex documentation on MCP, read on
2026-10-11 and again on 2026-10-12 at <https://learn.chatgpt.com/docs/extend/mcp?surface=cli>, which is where
<https://developers.openai.com/codex/mcp> redirects. What is specific to this server is the name `taiga`, the
four variables and the name of the package.

That page says: "The ChatGPT desktop app, Codex CLI, and IDE extension share this configuration." One registration
serves the three.

## 1. Check Node

Requires Node 20 or newer: check with `node --version`. There is nothing else to install: the server is on npm as
[`@campos-codes/taiga-r2da-mcp`](https://www.npmjs.com/package/@campos-codes/taiga-r2da-mcp), and the client starts it with `npx`, which downloads the package the first time it runs.

The commands of this page end in `@latest`, the newest version published. To stay on one version until you choose
another, write it in place of `@latest`: `@campos-codes/taiga-r2da-mcp@0.3.0`.

The other way to get the package is `npm install -g @campos-codes/taiga-r2da-mcp`, which leaves the command `taiga-mcp`
on the machine: the client then starts `taiga-mcp`, with no arguments, in place of `npx` and its arguments.

To run the server from
a copy of this repository in place of npm, see
[Other ways to install](../readme.md#other-ways-to-install).

## 2. Get a token

1. Log in to your Taiga in the browser.
2. Open the developer tools (F12), then **Application**, **Local Storage**, the address of your Taiga.
3. Copy the value of the key `token`. Not `refresh`.

## 3. Register the server

### With the command

Source: the syntax the page gives is
`codex mcp add <server-name> --env VAR1=VALUE1 --env VAR2=VALUE2 -- <stdio server-command>`, and its own example
starts a server with `npx`: `codex mcp add context7 -- npx -y @upstash/context7-mcp`.

```bash
codex mcp add taiga --env TAIGA_URL=https://taiga.example.com --env "TAIGA_TOKEN=<YOUR_TOKEN>" -- npx -y @campos-codes/taiga-r2da-mcp@latest
```

A note of this project, not of the documentation: a command typed in a terminal is normally saved in the history
file of the shell, the token included. The configuration file below keeps it out of the history.

Another note of this project: Codex was not tried on Windows `[not verified]`. A program that starts `npx` with no
shell does not find it there, because on Windows `npx` is a `.cmd` file: if Codex says that it cannot start the
command, give `cmd` as the command and `/c`, `npx`, `-y` and the name of the package as its arguments.

A third note of this project: `TAIGA_URL` must start with `https://`, in the command and in the file. Plain
`http://` is accepted only for an address of this machine (`localhost`, `127.0.0.1` or `[::1]`).

### Or in the configuration file

Source: "Configure each MCP server with a `[mcp_servers.<server-name>]` table in the configuration file." and "By
default this is `~/.codex/config.toml`, but you can also scope MCP servers to a project with
`.codex/config.toml` (trusted projects only)."

The key names below are the ones the page lists for a stdio server: `command` (required), `args` and `env`. The
layout is plain TOML written for this guide:

```toml
[mcp_servers.taiga]
command = "npx"
args = ["-y", "@campos-codes/taiga-r2da-mcp@latest"]
env = { TAIGA_URL = "https://taiga.example.com", TAIGA_TOKEN = "<YOUR_TOKEN>" }
```

Use `~/.codex/config.toml` for this server. A `.codex/config.toml` inside a project would put the token in the
project folder.

## 4. Check

Source: the same page.

```bash
codex mcp list
```

Inside the Codex terminal interface, `/mcp` shows the active servers. `codex mcp --help` lists every MCP command.
Then ask: "Which projects do I have in Taiga?"

## Options that matter for this server

All from the same page:

| Key | What the page says | Why it matters here |
| --- | --- | --- |
| `default_tools_approval_mode` | Sets the default approval behaviour for the tools of a server. "Supported values are `auto`, `prompt`, `writes`, and `approve`." The `writes` mode asks only for tools that are not marked read-only | This server marks 9 of its 10 read tools as read-only. `taiga_attachments_get` is not marked read-only, because it can save a file, so `writes` asks before it too, as well as before the 7 write tools and the delete tool |
| `tools.<tool>.approval_mode` | Overrides the approval behaviour for one tool | To always be asked before `taiga_attachments_add`, which reads a local file |
| `enabled_tools` | A tool allow list | To expose only some tools |
| `disabled_tools` | A tool deny list, applied after `enabled_tools` | To hide one tool |
| `startup_timeout_sec` | Default `10` | At start the server makes one request to Taiga; a slow network may need more |
| `tool_timeout_sec` | Default `60` | A large attachment may need more |
| `enabled` | Set `false` to disable the server without deleting it | – |

Suggested, when writing is on (key names from the page, layout written for this guide):

```toml
[mcp_servers.taiga]
command = "npx"
args = ["-y", "@campos-codes/taiga-r2da-mcp@latest"]
env = { TAIGA_URL = "https://taiga.example.com", TAIGA_TOKEN = "<YOUR_TOKEN>", TAIGA_WRITE = "1" }
default_tools_approval_mode = "writes"
```

One caveat about `writes`: it asks before `taiga_attachments_get` too, although that tool changes nothing in
Taiga. The tool is not marked read-only because it can save a file, to one folder per run of the server inside
the temp folder of the machine. See [docs/tools.md](../tools.md).

## Change an expired token

Edit `~/.codex/config.toml`, replace the value of `TAIGA_TOKEN` and start Codex again. The page read for this
guide documents no command to change or remove one server `[not verified]`: `codex mcp --help` lists what your
version has.

## Turn writing on

Add `TAIGA_WRITE = "1"` to `env`, as in the suggestion above, or register with one more `--env TAIGA_WRITE=1`.
With it the model can create and edit user stories, tasks and issues and attach files to them, in your name. Read
[docs/security.md](../security.md) first.

## Turn deleting on

Add `TAIGA_DELETE = "1"` next to `TAIGA_WRITE = "1"` in `env`, or register with one more `--env TAIGA_DELETE=1`.
Alone it does not work: without `TAIGA_WRITE=1` the server stops at start.

```toml
[mcp_servers.taiga]
command = "npx"
args = ["-y", "@campos-codes/taiga-r2da-mcp@latest"]
env = { TAIGA_URL = "https://taiga.example.com", TAIGA_TOKEN = "<YOUR_TOKEN>", TAIGA_WRITE = "1", TAIGA_DELETE = "1" }
default_tools_approval_mode = "writes"
```

It adds one tool, `taiga_items_delete`, which deletes a user story, a task or an issue. Deleting takes two calls:
the first deletes nothing, shows the item and gives a code, and only a second call with that code can delete. On
that second call, a client that has declared that it can put a question from a server to its user is made to ask
you, and nothing is deleted without your yes there. Taiga keeps no trash, and a user story takes its tasks with
it. See [docs/tools.md](../tools.md) and [docs/security.md](../security.md).
