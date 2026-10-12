// Builds the Claude Desktop extension, build/taiga-mcp-<version>.mcpb: the built server, the packages it needs
// to run and the manifest, and nothing else.
// Usage, after "npm ci" and "npm run build": npm run pack:mcpb
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'

// The packaging tool of the MCP Bundles project, fetched at this exact version when the extension is packed. It
// is not a dependency of this project: its own dependencies carry open security advisories, and nobody who only
// builds or tests the server needs it.
const TOOL = '@anthropic-ai/mcpb@2.1.2'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
if (manifest.version !== pkg.version) {
  throw new Error(`manifest.json says version ${manifest.version} and package.json says ${pkg.version}: make them the same.`)
}

const stage = join('build', 'mcpb')
rmSync(stage, { recursive: true, force: true })
mkdirSync(join(stage, 'dist'), { recursive: true })
// package.json goes along because it is what tells Node that dist/index.js is an ES module.
for (const file of ['manifest.json', 'package.json', 'LICENSE', join('dist', 'index.js')]) {
  cpSync(file, join(stage, file))
}
// The README lives in docs/: in the extension it sits at the top, under the name such a file usually has.
cpSync(join('docs', 'readme.md'), join(stage, 'README.md'))
// Only what the server needs to run: the packages npm lists when the development ones are left out.
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
