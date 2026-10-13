// Writes README.md at the top of the package, for the page of the package on npm, and removes it again:
// "prepack" and "postpack" of package.json run it. The repository keeps its documents in docs/, and npm shows
// only a README that sits at the top. The text is docs/readme.md with every link and picture pointed at the
// repository on GitHub, at the tag of the version being packed, since the page of npm has no docs/ to follow.
// Usage: node scripts/npm-readme.mjs          writes README.md
//        node scripts/npm-readme.mjs --clean  removes it
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { posix } from 'node:path'

if (process.argv[2] === '--clean') {
  rmSync('README.md', { force: true })
  process.exit(0)
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const repository = pkg.repository.url.replace(/^git\+https:\/\/github\.com\//, '').replace(/\.git$/, '')
const tag = `v${pkg.version}`
const pages = `https://github.com/${repository}/blob/${tag}`
const pictures = `https://raw.githubusercontent.com/${repository}/${tag}`

const TARGET = /(\]\()([^)\s]+)(\))|(\b(?:src|srcset|href)=")([^"]+)(")/g
const elsewhere = (target) => /^(https?:|mailto:|#)/.test(target)
const onGitHub = (target) => {
  if (elsewhere(target)) return target
  const [file, anchor] = target.split('#')
  const path = posix.normalize(posix.join('docs', file))
  return `${/\.(svg|png|jpe?g|gif|webp)$/i.test(path) ? pictures : pages}/${path}${anchor ? `#${anchor}` : ''}`
}

const text = readFileSync('docs/readme.md', 'utf8')
  .replace(/\r\n/g, '\n')
  // npm shows a Mermaid diagram as its source: the reader is sent to where it is drawn.
  .replace(/```mermaid\n[\s\S]*?\n```/g, `_Diagram: see it drawn in [the README on GitHub](${pages}/docs/readme.md)._`)
  .replace(TARGET, (_, a, md, b, c, html, d) => (md ? a + onGitHub(md) + b : c + onGitHub(html) + d))

const left = [...text.matchAll(TARGET)].map((found) => found[2] ?? found[5]).filter((target) => !elsewhere(target))
if (left.length || text.includes('```mermaid')) {
  throw new Error(`README.md would still point inside the repository: ${left.join(', ') || 'a Mermaid diagram'}`)
}
writeFileSync('README.md', text)
console.log(`README.md written from docs/readme.md, with links to ${pages}`)
