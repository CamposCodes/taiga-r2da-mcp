import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

const fake = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end('{"id":1,"username":"docs"}')
})
await new Promise((ready) => fake.listen(0, '127.0.0.1', ready))
const env = { ...process.env, TAIGA_URL: `http://127.0.0.1:${fake.address().port}`, TAIGA_TOKEN: 'docs', TAIGA_WRITE: '1', TAIGA_DELETE: '1' }
const child = spawn(process.execPath, ['dist/index.js'], { env, stdio: ['pipe', 'pipe', 'ignore'] })
let buffer = ''
const waiting = new Map()
child.stdout.on('data', (chunk) => {
  buffer += chunk
  let end
  while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, end)
    buffer = buffer.slice(end + 1)
    if (line.trim()) {
      const message = JSON.parse(line)
      waiting.get(message.id)?.(message)
    }
  }
})
let id = 0
const rpc = (method, params) => new Promise((resolve) => {
  waiting.set(++id, resolve)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
})
await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'docs', version: '0' } })
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
const { tools } = (await rpc('tools/list', {})).result
child.stdin.end()
fake.close()

const portuguese = JSON.parse(readFileSync('scripts/readme-tools.pt-BR.json', 'utf8'))
function translated(text) {
  if (!(text in portuguese)) throw new Error(`scripts/readme-tools.pt-BR.json has no translation for: ${text}`)
  return portuguese[text]
}

const LANGUAGES = {
  'docs/readme.md': {
    groups: ['Read tools: 10, always registered', 'Write tools: 7, only with TAIGA_WRITE on', 'Delete tool: 1, only with TAIGA_WRITE and TAIGA_DELETE on'],
    title: 'Title', description: 'Description', parameters: 'Parameters', none: 'None', optional: 'optional', readOnly: 'Read-only', destructive: 'Destructive',
    list: 'list of', or: 'or', say: (text) => text,
  },
  'docs/readme.pt-br.md': {
    groups: ['Tools de leitura: 10, sempre registradas', 'Tools de escrita: 7, só com TAIGA_WRITE ligada', 'Tool de exclusão: 1, só com TAIGA_WRITE e TAIGA_DELETE ligadas'],
    title: 'Título', description: 'Descrição', parameters: 'Parâmetros', none: 'nenhum', optional: 'opcional', readOnly: 'Somente leitura', destructive: 'Destrutiva',
    list: 'lista de', or: 'ou', say: translated,
  },
}
const firstWrite = tools.findIndex((tool) => tool.name.endsWith('_create'))
const firstDelete = tools.findIndex((tool) => tool.name.endsWith('_delete'))
const groups = [tools.slice(0, firstWrite), tools.slice(firstWrite, firstDelete), tools.slice(firstDelete)]

function typeOf(schema, language) {
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(` ${language.or} `)
  return schema.type === 'array' ? `${language.list} ${typeOf(schema.items, language)}` : schema.type
}

function entry(tool, language) {
  const required = tool.inputSchema.required ?? []
  const parameters = Object.entries(tool.inputSchema.properties ?? {}).map(([name, schema]) => {
    const kind = typeOf(schema, language) + (required.includes(name) ? '' : `, ${language.optional}`)
    return '    - `' + name + '` (' + kind + '): ' + language.say(schema.description)
  })
  return [
    `- **${tool.name}**`,
    `  - ${language.title}: ${language.say(tool.title)}`,
    `  - ${language.description}: ${language.say(tool.description)}`,
    parameters.length ? `  - ${language.parameters}:\n${parameters.join('\n')}` : `  - ${language.parameters}: ${language.none}`,
    `  - ${language.readOnly}: **${tool.annotations.readOnlyHint === true}**`,
    ...(tool.annotations.destructiveHint ? [`  - ${language.destructive}: **true**`] : []),
  ].join('\n')
}

for (const [file, language] of Object.entries(LANGUAGES)) {
  const list = groups
    .map((group, i) => `<details>\n<summary><b>${language.groups[i]}</b></summary>\n\n${group.map((tool) => entry(tool, language)).join('\n')}\n\n</details>`)
    .join('\n\n')
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const [start, end] = [text.indexOf('<!-- tools:start'), text.indexOf('<!-- tools:end -->')]
  if (start < 0 || end < start) throw new Error(`${file}: the tools:start and tools:end comments are missing`)
  const head = text.slice(0, text.indexOf('\n', start) + 1)
  writeFileSync(file, `${head}\n${list}\n\n${text.slice(end)}`)
  console.log(`${file}: ${tools.length} tools listed`)
}
