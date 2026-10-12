# Claude Desktop

How to install `taiga-mcp` and register it in Claude Desktop.

The configuration file, its location and the steps come from the MCP documentation,
[Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers), read on
2026-10-11. What is specific to this server is the name `taiga`, the four variables and the path.

The steps below register the server in the configuration file. The other way, a form in place of the file, is in
[Install as an extension](#install-as-an-extension).

## 1. Build the server

Requires Node 20 or newer. The page above also asks for Node on the machine: check with `node --version`.

```bash
git clone https://github.com/CamposCodes/taiga-r2da-mcp.git taiga-mcp
cd taiga-mcp
npm ci
npm run build
```

The server is `dist/index.js`. Note its absolute path: the page says paths in the configuration must be
"absolute and not relative". The package is not published to npm yet: what changes when it is, is in
[From npm, once it is published](../readme.md#from-npm-once-it-is-published).

## 2. Get a token

1. Log in to your Taiga in the browser.
2. Open the developer tools (F12), then **Application**, **Local Storage**, the address of your Taiga.
3. Copy the value of the key `token`. Not `refresh`.

## 3. Open the configuration file

Source: steps "Open Claude Desktop Settings" and "Access Developer Settings" of the page above.

1. Click the Claude menu in the menu bar of the system and choose **Settings...**. This is not the settings
   inside the Claude window.
2. In the Settings window, open the **Developer** tab and click **Edit Config**.

The file is created if it does not exist. It is located at:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

## 4. Add the server

Source: step "Configure the Filesystem Server" for the `mcpServers` format, and the troubleshooting section of the
same page for the `env` key.

macOS and Linux:

```json
{
  "mcpServers": {
    "taiga": {
      "command": "node",
      "args": ["/absolute/path/to/taiga-mcp/dist/index.js"],
      "env": {
        "TAIGA_URL": "https://taiga.example.com",
        "TAIGA_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```

Windows, with the backslashes doubled as in the examples of the page:

```json
{
  "mcpServers": {
    "taiga": {
      "command": "node",
      "args": ["C:\\tools\\taiga-mcp\\dist\\index.js"],
      "env": {
        "TAIGA_URL": "https://taiga.example.com",
        "TAIGA_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```

If the file already has other servers, add only the `"taiga"` entry inside the existing `"mcpServers"`.

This file holds the token as plain text. Keep it out of repositories, backups you share and screenshots.

This server refuses a `TAIGA_URL` that does not start with `https://`. Plain `http://` is accepted only for an
address of this machine (`localhost`, `127.0.0.1` or `[::1]`).

## 5. Restart and check

Source: step "Restart Claude Desktop" of the page above.

1. Quit Claude Desktop completely and open it again.
2. Click the "Add files, connectors, and more" button at the bottom left of the message box, move over
   **Connectors** and click **Manage connectors**. Select `taiga` to see its tools.
3. Ask: "Which projects do I have in Taiga?"

The tutorial of that page says of its example server that "Before executing any file system operation, Claude
will request your approval". How approval works for the tools of this server was not checked in Claude Desktop
`[not verified]`.

## Change an expired token

Open the configuration file again, replace the value of `TAIGA_TOKEN`, save, and restart Claude Desktop.

## Turn writing on

Add one line to `env` and restart:

```json
"env": {
  "TAIGA_URL": "https://taiga.example.com",
  "TAIGA_TOKEN": "<YOUR_TOKEN>",
  "TAIGA_WRITE": "1"
}
```

With it the model can create and edit user stories, tasks and issues and attach files to them, in your name. Read
what it proposes before approving, and read [docs/security.md](../security.md) first.

## Turn deleting on

Add `TAIGA_DELETE` next to `TAIGA_WRITE` in `env` and restart. Alone it does not work: without `TAIGA_WRITE` the
server stops at start.

```json
"env": {
  "TAIGA_URL": "https://taiga.example.com",
  "TAIGA_TOKEN": "<YOUR_TOKEN>",
  "TAIGA_WRITE": "1",
  "TAIGA_DELETE": "1"
}
```

It adds one tool, `taiga_items_delete`, which deletes a user story, a task or an issue. Deleting takes two calls:
the first deletes nothing, shows the item and gives a code, and only a second call with that code can delete. On
that second call, a client that has declared that it can put a question from a server to its user is made to ask
you, and nothing is deleted without your yes there. Taiga keeps no trash, and a user story takes its tasks with
it, so read what the model shows before approving. See [docs/tools.md](../tools.md) and
[docs/security.md](../security.md).

## When it does not connect

Source: the troubleshooting section of the page above.

1. Restart Claude Desktop completely.
2. Check the syntax of `claude_desktop_config.json` and that the path is absolute.
3. Read the logs. They are in `~/Library/Logs/Claude` on macOS and `%APPDATA%\Claude\logs` on Windows:
   `mcp.log` has the connections and their failures, and `mcp-server-taiga.log` has what this server writes to
   stderr, including the reason it stopped (`Missing environment variable ...` or `Taiga refused the token ...`).
4. Run the server by hand, with the two variables set, to see the same message in the terminal:
   `node /absolute/path/to/taiga-mcp/dist/index.js`.

## Install as an extension

Claude Desktop can also take a local server as an extension: one `.mcpb` file that holds the server and what it
needs to run, with a form in place of the configuration file. This repository builds that file. It is not
committed and not published anywhere: a person builds it and hands it over.

**The extension was not installed in a real Claude Desktop.** The packaging tool validated the manifest, and the
server unpacked from the file passes the scenarios of [docs/testing.md](../testing.md). What Claude Desktop shows and
does with the file is quoted below from its documentation and was not seen by this project.

The two pages quoted, both read on 2026-10-12:
[Build a desktop extension with MCPB](https://claude.com/docs/connectors/building/mcpb.md) and
[Getting started with local MCP servers on Claude Desktop](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

### Build the file

Requires Node 20 or newer and access to the npm registry.

```bash
npm ci
npm run build
npm run pack:mcpb
```

The result is `build/taiga-mcp-0.3.0.mcpb`, of about 2 MB. It holds the built server, the three packages the
server needs to run and [`manifest.json`](../../manifest.json), the manifest of the extension (manifest version
0.3). The script fetches the packaging tool, `@anthropic-ai/mcpb` at version 2.1.2, with `npx` when it runs. The
tool is not a dependency of this project, because its own dependencies carry open security advisories.

### Install the file

The first page says: "Users can install your MCPB in any of these ways:"

- "Double-click the `.mcpb` file"
- "Drag and drop the `.mcpb` file into the Claude Desktop window"
- "In Claude Desktop, go to **Settings > Extensions > Advanced settings > Install Extension…** and select the
  `.mcpb` file"

And: "Each of these install methods opens an installation UI where the user reviews extension details and
permissions, configures required settings, grants permissions, and completes installation."

### What the form asks

The four fields come from `user_config` in the manifest. Each one becomes a variable of the server:

| Field | Variable | Notes |
| --- | --- | --- |
| `Taiga address` | `TAIGA_URL` | Required. It must start with `https://` |
| `Taiga token` | `TAIGA_TOKEN` | Required, and marked sensitive. The value of `token`, as in [Get a token](#2-get-a-token) |
| `Allow writing` | `TAIGA_WRITE` | Off by default |
| `Allow deleting` | `TAIGA_DELETE` | Off by default. It needs `Allow writing`: alone, the server stops at start |

- The server takes `true` as well as `1` for the last two. That a ticked box reaches the server as `true` was not
  seen in Claude Desktop `[not verified]`.
- About a field marked sensitive, the second page says: "Mark configuration fields as "sensitive": true in your
  manifest.json. Claude Desktop will automatically encrypt these values using the operating system's secure
  storage (Keychain on macOS, Credential Manager on Windows, and your distro’s keychain manager on Linux)." Where
  the token ends up on a machine was not checked by this project.
- Of an extension that is installed, the second page says: "Navigate to Settings > Extensions and click on the
  extension to review its settings." That an expired token is replaced there was not tried `[not verified]`.
- The manifest lists the 10 read tools and says that more can appear, because the write tools and the delete
  tool exist only with the two switches on.

### Update it

There is no automatic update: a new version means building the file again and installing it again by hand. The
second page says: "For privately distributed extensions, users will need to install updated .mcpb files manually."
