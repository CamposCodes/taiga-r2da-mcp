# Claude Desktop

How to install `taiga-mcp` and register it in Claude Desktop.

The configuration file, its location and the steps come from the MCP documentation,
[Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers), read on
2026-10-11. What is specific to this server is the name `taiga`, the four variables and the path.

## 1. Build the server

Requires Node 20 or newer. The page above also asks for Node on the machine: check with `node --version`.

```bash
git clone https://github.com/CamposCodes/taiga-r2da-mcp.git taiga-mcp
cd taiga-mcp
npm ci
npm run build
```

The server is `dist/index.js`. Note its absolute path: the page says paths in the configuration must be
"absolute and not relative".

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
what it proposes before approving, and read [SECURITY.md](../../SECURITY.md) first.

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
the first deletes nothing, shows the item and gives a code, and only a second call with that code deletes. Taiga
keeps no trash, and a user story takes its tasks with it, so read what the model shows before approving. See
[TOOLS.md](../TOOLS.md) and [SECURITY.md](../../SECURITY.md).

## When it does not connect

Source: the troubleshooting section of the page above.

1. Restart Claude Desktop completely.
2. Check the syntax of `claude_desktop_config.json` and that the path is absolute.
3. Read the logs. They are in `~/Library/Logs/Claude` on macOS and `%APPDATA%\Claude\logs` on Windows:
   `mcp.log` has the connections and their failures, and `mcp-server-taiga.log` has what this server writes to
   stderr, including the reason it stopped (`Missing environment variable ...` or `Taiga refused the token ...`).
4. Run the server by hand, with the two variables set, to see the same message in the terminal:
   `node /absolute/path/to/taiga-mcp/dist/index.js`.

## Extensions

Claude Desktop can also install a local server as an extension, a `.mcpb` file, from **Settings**, **Extensions**
([Getting started with local MCP servers on Claude Desktop](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)).
This project does not ship one. It is proposal P9 in [COMPLIANCE.md](../COMPLIANCE.md).
