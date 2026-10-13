import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const target = resolve(process.argv[2] ?? 'dist/index.js')
const folder = mkdtempSync(join(tmpdir(), 'taiga-mcp-coverage-'))
const run = spawnSync(process.execPath, ['test/smoke.mjs', target], { env: { ...process.env, NODE_V8_COVERAGE: folder }, stdio: 'inherit' })
if (run.status !== 0) {
  process.exit(run.status ?? 1)
}

const source = readFileSync(target, 'utf8')
const covered = new Uint8Array(source.length)
let processes = 0
for (const name of readdirSync(folder)) {
  const script = JSON.parse(readFileSync(join(folder, name), 'utf8')).result.find((entry) => entry.url === pathToFileURL(target).href)
  if (!script) continue
  processes++
  const ran = new Uint8Array(source.length)
  for (const fn of script.functions) for (const range of fn.ranges) ran.fill(range.count > 0 ? 1 : 0, range.startOffset, range.endOffset)
  for (let i = 0; i < ran.length; i++) covered[i] |= ran[i]
}
rmSync(folder, { recursive: true })

let offset = 0
let total = 0
const missed = []
source.split('\n').forEach((line, index) => {
  const start = offset
  offset += line.length + 1
  if (!line.trim()) return
  total++
  for (let i = 0; i < line.length; i++) {
    if (line[i].trim() && !covered[start + i]) return missed.push(`  ${index + 1}: ${line.trim()}`)
  }
})
const percent = (((total - missed.length) / total) * 100).toFixed(1)
console.log(`coverage: ${total - missed.length} of ${total} lines of dist/index.js run in full (${percent}%), over ${processes} server processes`)
if (missed.length) {
  console.log(`not run in full:\n${missed.join('\n')}`)
}
