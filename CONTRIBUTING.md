# Contributing

Thank you for looking into `taiga-mcp`. This page says how to build it, how to test it and what a change needs
before it is merged.

## Before you start

- Open an issue first for anything larger than a fix, so the direction is agreed before the work.
- A vulnerability is not reported in an issue: see [SECURITY.md](SECURITY.md).
- The project is under the MIT licence, in [LICENSE](LICENSE). A contribution is accepted under that licence.

## Build and test

Requires Node 20 or newer.

```bash
npm ci
npm run check      # types, without writing files
npm run build      # compiles to dist/
npm test           # end-to-end scenarios, needs the build
npm run coverage   # the same scenarios, and how much of dist/index.js they run
```

`npm test` starts the built server over stdio against a simulated Taiga that listens on `127.0.0.1`, calls every
tool through the protocol and checks what is sent and what comes back. It needs no token and no network.
`npm run coverage` runs the same scenarios itself and then says how many lines of the built server they ran. The
list of the scenarios and the report of the last run are in [`docs/TESTING.md`](docs/TESTING.md).

**Never point `npm test`, or a development session, at a real Taiga with a real token.** If a behaviour of the
real API is missing from the simulated one, add it to `test/smoke.mjs` with the field names the real API uses.
Only `npm run test:live` is made for a real Taiga: it is run by hand, works in the one project named in
`TAIGA_TEST_PROJECT` and changes only the items it creates. Its rules are in
[`docs/TESTING.md`](docs/TESTING.md).

CI runs `npm ci`, `npm run check`, `npm run build` and `npm run coverage` on Linux, macOS and Windows, each with
Node 20 and Node 24. It never runs `npm run test:live`.

## Rules for a change

1. **Read-only by default stays.** Without `TAIGA_WRITE=1` no request other than `GET` may leave the server. A
   tool that changes Taiga is registered in `registerWriting` and uses `client.send`, the only path that writes.
2. **Deleting stays behind its own gate.** Deleting exists only in `taiga_items_delete`, which is registered only
   with `TAIGA_DELETE=1` on top of `TAIGA_WRITE=1` and takes two calls: the first deletes nothing and gives the
   code the second needs. Another tool that deletes, or a shorter way to delete, needs a discussion in an issue
   first.
3. **A tool is a contract.** Do not rename or remove a tool or a parameter, and do not change what a write tool
   sends, without an issue that agrees on it. People have these names in their configurations and prompts.
4. **Names for the model, ids for the API.** Use `loadProject` and the helpers that turn names into ids. An
   unknown name is answered with the valid ones.
5. **Short answers.** A list returns one summary line per item. If a text is cut, it says so.
6. **Errors are sentences.** Throw an `Error` with a message that tells the model what to do next; `show` turns it
   into a tool result with `isError: true`.
7. **Annotations are true.** A tool that changes Taiga, or that leaves a file on the machine, is not
   `readOnlyHint: true`. A tool that overwrites or deletes is `destructiveHint: true`.
8. **No new dependency** without an issue that agrees on it. The server has two.

## Adding or changing a tool

1. Register it with `server.registerTool`, with a `title`, a `description`, a description for every parameter
   and, when it answers data, an `outputSchema`.
2. Add a scenario for it to `test/smoke.mjs`, with the answer the real API gives for that resource, and the row
   of that scenario to the table of [`docs/TESTING.md`](docs/TESTING.md).
3. Document it in [`docs/TOOLS.md`](docs/TOOLS.md): a section whose heading is the tool name in backticks, with
   the parameter table, an example call, an example answer taken from the test, and its errors.
4. Run `npm test`. It fails when a tool or a parameter of `tools/list` is not in `docs/TOOLS.md`, when the table
   of `docs/TESTING.md` and the scenarios differ in a name or in the order, and when the tools of a group are not
   the ones its scenario lists.
5. If it changes how the server meets a recommendation, update [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md).
6. Add a line to [`CHANGELOG.md`](CHANGELOG.md), under Unreleased.

## Documentation

- `README.md` and `docs/` are in English. `README.pt-BR.md` is the translation of the README: change both.
- Examples use `https://taiga.example.com`, the project `my-project`, the user `ana` and the token
  `<YOUR_TOKEN>`. No real server, project or person.
- A statement about what a specification or a vendor recommends needs the URL of the page it was read on. What
  was not read is marked `[not verified]`.
- Diagrams: each one has a Mermaid source inside the page and a drawn version in `docs/diagrams/`. Change both.
  Check the Mermaid with `npx -y @mermaid-js/mermaid-cli -i docs/ARCHITECTURE.md -o /tmp/out.md`.

## Style

Match the code around your change: its naming, its comment density, its idiom. Comments say why, in plain
sentences.
