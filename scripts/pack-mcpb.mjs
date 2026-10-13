import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'

const TOOL = '@anthropic-ai/mcpb@2.1.2'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
if (manifest.version !== pkg.version) {
  throw new Error(`manifest.json says version ${manifest.version} and package.json says ${pkg.version}: make them the same.`)
}

const stage = join('build', 'mcpb')
rmSync(stage, { recursive: true, force: true })
mkdirSync(join(stage, 'dist'), { recursive: true })
for (const file of ['manifest.json', 'package.json', 'LICENSE', join('dist', 'index.js')]) {
  cpSync(file, join(stage, file))
}
cpSync(join('docs', 'readme.md'), join(stage, 'README.md'))
const needed = execSync('npm ls --omit=dev --all --parseable', { encoding: 'utf8' }).trim().split(/\r?\n/).slice(1)
for (const folder of needed) {
  cpSync(folder, join(stage, relative(process.cwd(), folder)), { recursive: true })
}

const output = join('build', `taiga-mcp-${pkg.version}.mcpb`)
rmSync(output, { force: true })
const tool = (args) => execSync(`npx --yes ${TOOL} ${args}`, { stdio: 'inherit' })
tool(`validate ${join(stage, 'manifest.json')}`)
tool(`pack ${stage} ${output}`)
console.log(`${output}: ${needed.length} packages bundled`)
