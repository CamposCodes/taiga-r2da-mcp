import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\s*[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
)
for (const name of ['TAIGA_URL', 'TAIGA_TOKEN', 'TAIGA_TEST_PROJECT']) assert.ok(env[name], `.env needs ${name}`)
const slug = env.TAIGA_TEST_PROJECT
const label = env.TAIGA_TEST_LABEL ?? '[MCP TEST]'
const note = env.TAIGA_TEST_NOTE ?? 'Created by the automated test of the taiga-mcp server. Safe to delete.'

const child = spawn(process.execPath, [process.argv[2]], { env: { ...process.env, TAIGA_URL: env.TAIGA_URL, TAIGA_TOKEN: env.TAIGA_TOKEN, TAIGA_WRITE: '1', TAIGA_DELETE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
let buffer = ''
let wrote = ''
const waiting = new Map()
child.stderr.on('data', (d) => (wrote += d))
child.stdout.on('data', (d) => {
  buffer += d
  wrote += d
  let i
  while ((i = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, i); buffer = buffer.slice(i + 1)
    if (!line.trim()) continue
    const m = JSON.parse(line)
    if (m.method === 'elicitation/create') {
      asked.push(m.params.message)
      const ours = m.params.message.includes(label) || [...mineWiki, ...mineSprints].some((name) => m.params.message.includes(`"${name}"`))
      const answer = ours ? answers.shift() : undefined
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: answer ?? { action: 'cancel' } }) + '\n')
    } else if (!m.method) waiting.get(m.id)?.(m)
  }
})
const asked = []
const answers = []
const exited = new Promise((r) => child.on('exit', r))
let id = 0
const rpc = (method, params) => Promise.race([
  new Promise((resolve) => { const n = ++id; waiting.set(n, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n') }),
  exited.then((code) => { throw new Error(`the server stopped with code ${code}: ${wrote.replaceAll(env.TAIGA_TOKEN, '<token>').trim()}`) }),
])

const mine = new Map()
const mineWiki = new Set()
const mineSprints = new Set()
const described = new Map()
async function call(name, args = {}) {
  if ('project' in args) assert.equal(args.project, slug)
  if (/^taiga_wiki_(update|delete)$/.test(name)) assert.ok(mineWiki.has(args.slug), `the wiki page ${args.slug} was not created by this test`)
  else if (/^taiga_sprints_(update|delete)$/.test(name)) assert.ok(mineSprints.has(args.sprint), `the sprint ${args.sprint} was not created by this test`)
  else if (/_(update|delete)$|attachments_add$/.test(name)) assert.ok(mine.has(args.ref), `#${args.ref} was not created by this test`)
  if (name === 'taiga_userstories_update' && args.sprint && args.sprint !== 'backlog') assert.ok(mineSprints.has(args.sprint), `the sprint ${args.sprint} was not created by this test`)
  const result = (await rpc('tools/call', { name, arguments: args })).result
  if (result.isError) return { error: result.content[0].text }
  if (result.structuredContent === undefined) return result.content
  assert.deepEqual(result.structuredContent, JSON.parse(result.content[0].text), name)
  return result.structuredContent
}

const steps = []
async function step(title, body) {
  const outcome = (await body()) ?? 'passed'
  steps.push({ step: `L${String(steps.length + 1).padStart(2, '0')}`, title, outcome })
  console.log(`ok ${steps.at(-1).step} ${title}${outcome === 'passed' ? '' : ` (${outcome})`}`)
}
const REFUSED = 'refused for lack of permission, as designed'
let project
const may = (permission) => project.myPermissions.includes(permission)
async function write(permission, name, args) {
  const result = await call(name, args)
  if (!result.error) return result
  assert.match(result.error, /Nothing was (done|changed)\.[^]*Do not work around this on your own/, result.error)
  assert.ok(!may(permission) || result.error.startsWith('Taiga refused'), result.error)
  return null
}
const other = (list, current) => list.find((entry) => entry.name !== current && !entry.closed)?.name ?? list.find((entry) => entry.name !== current)?.name

const report = { when: new Date().toISOString(), node: process.version, project: slug, label }
const folder = mkdtempSync(join(tmpdir(), 'taiga-mcp-live-'))
try {
  await step('The server starts with the token of .env and lists 26 tools', async () => {
    const opened = (await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: { elicitation: {} }, clientInfo: { name: 'live', version: '0' } })).result
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    report.server = opened.serverInfo
    assert.equal((await rpc('tools/list', {})).result.tools.length, 26)
  })
  let me
  await step('taiga_me, taiga_projects_list and taiga_projects_get answer in the declared shape', async () => {
    me = await call('taiga_me')
    assert.ok(me.username)
    const listed = await call('taiga_projects_list')
    assert.ok(listed.projects.some((p) => p.slug === slug), `the user of the token is not a member of ${slug}`)
    project = await call('taiga_projects_get', { project: slug })
    assert.equal(project.slug, slug)
    Object.assign(report, { user: me.username, projects: listed.projects.length, permissions: project.myPermissions, modules: project.modules })
  })
  await step('The lists and the search answer in the declared shape on the real data', async () => {
    const counts = {}
    for (const [name, key] of [['taiga_userstories_list', 'userStories'], ['taiga_tasks_list', 'tasks'], ['taiga_issues_list', 'issues']]) {
      const page = await call(name, { project: slug, size: 50 })
      assert.equal(page.error, undefined, page.error)
      assert.ok(page.items.length <= 50 && page.total >= page.items.length)
      counts[key] = page.total
    }
    const sprints = await call('taiga_sprints_list', { project: slug })
    assert.equal(sprints.error, undefined, sprints.error)
    const found = await call('taiga_search', { project: slug, text: 'a' })
    assert.equal(found.error, undefined, found.error)
    report.read = { ...counts, sprints: sprints.sprints.length, searchHits: found.items.length }
  })
  await step('taiga_wiki_list and taiga_wiki_get read the wiki of the project without changing it', async () => {
    const listed = await call('taiga_wiki_list', { project: slug })
    assert.equal(listed.error, undefined, listed.error)
    report.read.wikiPages = listed.pages.length
    if (!listed.pages.length) return 'skipped: the project has no wiki page'
    const page = await call('taiga_wiki_get', { project: slug, slug: listed.pages[0].slug })
    assert.equal(page.error, undefined, page.error)
    assert.ok(page.slug === listed.pages[0].slug && typeof page.content === 'string' && Number.isInteger(page.version))
  })
  await step('taiga_items_get reads items that already exist, with comments and history, without changing them', async () => {
    let read = 0
    for (const name of ['taiga_userstories_list', 'taiga_tasks_list', 'taiga_issues_list']) {
      for (const line of (await call(name, { project: slug, size: 3 })).items) {
        const item = await call('taiga_items_get', { project: slug, ref: line.ref, include: ['comments', 'history'] })
        assert.equal(item.error, undefined, item.error)
        assert.deepEqual([item.ref, item.type], [line.ref, line.type])
        read++
      }
    }
    report.read.itemsOpened = read
  })

  let story, task, issue
  await step('taiga_userstories_create creates a user story marked as a test', async () => {
    story = await write('add_us', 'taiga_userstories_create', { project: slug, subject: `${label} User story`, description: note })
    if (!story) return REFUSED
    mine.set(story.ref, 'us')
    assert.ok(story.subject.startsWith(label) && story.url.includes(`/project/${slug}/us/${story.ref}`))
  })
  await step('taiga_userstories_update moves it to another status, blocks it, unblocks it and comments', async () => {
    if (!story) return 'skipped: no user story was created'
    const to = other(project.userStoryStatuses, story.status)
    const moved = await write('modify_us', 'taiga_userstories_update', { project: slug, ref: story.ref, ...(to ? { status: to } : {}), blocked: note, comment: `${label} ${note}` })
    if (!moved) return REFUSED
    assert.deepEqual([moved.status, moved.blocked], [to ?? story.status, note])
    assert.equal((await call('taiga_userstories_update', { project: slug, ref: story.ref, blocked: 'none' })).blocked, false)
  })
  await step('taiga_tasks_create creates a task in that user story', async () => {
    if (!story) return 'skipped: no user story was created'
    task = await write('add_task', 'taiga_tasks_create', { project: slug, subject: `${label} Task`, description: note, userStory: story.ref })
    if (!task) return REFUSED
    mine.set(task.ref, 'task')
    assert.ok(task.subject.startsWith(label) && task.url.includes(`/project/${slug}/task/${task.ref}`))
  })
  await step('taiga_tasks_update moves the task, assigns it, sets and clears a due date, and comments', async () => {
    if (!task) return 'skipped: no task was created'
    const to = other(project.taskStatuses, task.status)
    const moved = await write('modify_task', 'taiga_tasks_update', { project: slug, ref: task.ref, ...(to ? { status: to } : {}), assignee: me.username, dueDate: '2030-01-31', comment: `${label} ${note}` })
    if (!moved) return REFUSED
    assert.deepEqual([moved.status, moved.assignees, moved.dueDate], [to ?? task.status, [me.username], '2030-01-31'])
    const cleared = await call('taiga_tasks_update', { project: slug, ref: task.ref, assignee: 'none', dueDate: 'none' })
    assert.deepEqual([cleared.assignees, cleared.dueDate], [[], null])
  })
  await step('An edit of a description needs the version that was read, and one made on an old version is refused', async () => {
    if (!task) return 'skipped: no task was created'
    const read = await call('taiga_items_get', { project: slug, ref: task.ref })
    assert.ok(Number.isInteger(read.version))
    const text = `${note} (edited)`
    const edited = await write('modify_task', 'taiga_tasks_update', { project: slug, ref: task.ref, description: text, version: read.version })
    if (!edited) return REFUSED
    described.set(task.ref, text)
    assert.match((await call('taiga_tasks_update', { project: slug, ref: task.ref, description: 'x' })).error, /give its version/)
    assert.match((await call('taiga_tasks_update', { project: slug, ref: task.ref, description: 'x', version: read.version })).error, /changed since version/)
    assert.equal((await call('taiga_items_get', { project: slug, ref: task.ref })).description, text)
  })
  await step('taiga_issues_create and taiga_issues_update create an issue and move it', async () => {
    if (!project.modules.issues) return 'skipped: the project has no issues module'
    issue = await write('add_issue', 'taiga_issues_create', { project: slug, subject: `${label} Issue`, description: note })
    if (!issue) return REFUSED
    mine.set(issue.ref, 'issue')
    const to = other(project.issueStatuses, issue.status)
    const moved = await write('modify_issue', 'taiga_issues_update', { project: slug, ref: issue.ref, ...(to ? { status: to } : {}), comment: `${label} ${note}` })
    if (moved) assert.equal(moved.status, to ?? issue.status)
  })
  await step('taiga_attachments_add sends a file to each item, and taiga_attachments_get reads it back', async () => {
    if (!mine.size) return 'skipped: no item was created'
    const file = join(folder, 'mcp-test.txt')
    writeFileSync(file, note)
    let sent = 0
    for (const [ref, kind] of mine) {
      const attached = await write(`modify_${kind}`, 'taiga_attachments_add', { project: slug, ref, path: file, description: label })
      if (!attached) continue
      const back = await call('taiga_attachments_get', { project: slug, ref, attachment: String(attached.id) })
      assert.equal(back[0].text, note)
      sent++
    }
    return sent ? undefined : REFUSED
  })
  await step('taiga_attachments_add refuses a file that looks like a credential, before anything is sent', async () => {
    if (!mine.size) return 'skipped: no item was created'
    mkdirSync(join(folder, '.ssh'))
    writeFileSync(join(folder, '.ssh', 'id_test'), 'made-up')
    const refused = await call('taiga_attachments_add', { project: slug, ref: [...mine.keys()][0], path: join(folder, '.ssh', 'id_test') })
    assert.match(refused.error, /is not sent: it looks like a credential/)
  })
  await step('taiga_items_get shows what the test wrote: the comment, the attachment, the task of the story', async () => {
    if (!mine.size) return 'skipped: no item was created'
    for (const [ref, kind] of mine) {
      const item = await call('taiga_items_get', { project: slug, ref, include: ['comments', 'history'] })
      assert.deepEqual([item.type, item.description], [kind, described.get(ref) ?? note])
      assert.ok(Array.isArray(item.history) && Array.isArray(item.commentList))
    }
    if (story && task) assert.deepEqual((await call('taiga_items_get', { project: slug, ref: story.ref })).taskList.map((t) => t.ref), [task.ref])
  })
  await step('A wrong kind, an unknown name and an edit of nothing are refused by the server', async () => {
    if (!mine.size) return 'skipped: no item was created'
    const [ref, kind] = [...mine][0]
    const wrong = kind === 'issue' ? 'taiga_tasks_update' : 'taiga_issues_update'
    assert.match((await call(wrong, { project: slug, ref, subject: 'x' })).error, /is not an? (task|issue): it is/)
    const tool = { us: 'taiga_userstories_update', task: 'taiga_tasks_update', issue: 'taiga_issues_update' }[kind]
    assert.match((await call(tool, { project: slug, ref, status: 'no such status 0000' })).error, /Unknown .* status "no such status 0000"\. Valid: /)
    assert.match((await call(tool, { project: slug, ref })).error, /Nothing to change/)
  })
  const wikiSlug = `teste-mcp-${Date.now().toString(36)}`
  await step('taiga_wiki_create, taiga_wiki_update and taiga_wiki_get create a page marked as a test and replace its text with the version read', async () => {
    if (!project.modules.wiki) return 'skipped: the project has no wiki module'
    const page = await write('add_wiki_page', 'taiga_wiki_create', { project: slug, slug: wikiSlug, content: `# ${label}\n\n${note}` })
    if (!page) return REFUSED
    mineWiki.add(wikiSlug)
    assert.ok(page.slug === wikiSlug && page.version >= 1 && page.url.includes(`/project/${slug}/wiki/${wikiSlug}`))
    const text = `# ${label}\n\n${note} (edited)`
    const edited = await write('modify_wiki_page', 'taiga_wiki_update', { project: slug, slug: wikiSlug, content: text, version: page.version })
    if (!edited) return REFUSED
    assert.ok(edited.version > page.version)
    assert.match((await call('taiga_wiki_update', { project: slug, slug: wikiSlug, content: 'x', version: page.version })).error, /changed since version/)
    assert.equal((await call('taiga_wiki_get', { project: slug, slug: wikiSlug })).content, text)
    assert.ok((await call('taiga_wiki_list', { project: slug })).pages.some((entry) => entry.slug === wikiSlug))
  })
  const sprintName = `${label} Sprint`
  await step('taiga_sprints_create and taiga_sprints_update create a sprint marked as a test, move its days, close and reopen it, and take the test story in', async () => {
    const made = await write('add_milestone', 'taiga_sprints_create', { project: slug, name: sprintName, start: '2030-01-01', finish: '2030-01-14' })
    if (!made) return REFUSED
    mineSprints.add(sprintName)
    assert.deepEqual([made.name, made.start, made.finish, made.closed], [sprintName, '2030-01-01', '2030-01-14', false])
    const longer = await write('modify_milestone', 'taiga_sprints_update', { project: slug, sprint: sprintName, finish: '2030-01-21' })
    if (!longer) return REFUSED
    assert.equal(longer.finish, '2030-01-21')
    assert.equal((await call('taiga_sprints_update', { project: slug, sprint: sprintName, closed: true })).closed, true)
    assert.equal((await call('taiga_sprints_update', { project: slug, sprint: sprintName, closed: false })).closed, false)
    assert.match((await call('taiga_sprints_update', { project: slug, sprint: sprintName, start: '2030-02-01', finish: '2030-01-21' })).error, /cannot come after/)
    assert.ok((await call('taiga_sprints_list', { project: slug })).sprints.some((entry) => entry.name === sprintName))
    if (story) assert.equal((await call('taiga_userstories_update', { project: slug, ref: story.ref, sprint: sprintName })).sprint, sprintName)
  })
  await step('taiga_sprints_delete and taiga_wiki_delete show first, ask the user, and delete only with the code and the yes', async () => {
    if (!mineWiki.size && !mineSprints.size) return 'skipped: no wiki page and no sprint was created'
    for (const [tool, key, name, kind] of [['taiga_sprints_delete', 'sprint', sprintName, 'sprint'], ['taiga_wiki_delete', 'slug', wikiSlug, 'wiki page']]) {
      if (!(kind === 'sprint' ? mineSprints : mineWiki).has(name)) continue
      const shown = await write(`delete_${kind === 'sprint' ? 'milestone' : 'wiki_page'}`, tool, { project: slug, [key]: name })
      if (!shown) continue
      assert.equal(shown.deleted, false)
      if (kind === 'sprint' && story) assert.deepEqual(shown.userStoriesInIt, [`#${story.ref} ${story.subject}`])
      assert.equal((await call(tool, { project: slug, [key]: name, confirm: 'no' })).deleted, false)
      const refused = await call(tool, { project: slug, [key]: name })
      answers.push({ action: 'decline' })
      assert.equal((await call(tool, { project: slug, [key]: name, confirm: refused.confirm })).deleted, false)
      const last = await call(tool, { project: slug, [key]: name })
      answers.push({ action: 'accept', content: { delete: true } })
      assert.equal((await call(tool, { project: slug, [key]: name, confirm: last.confirm })).deleted, true)
      assert.ok(asked.at(-1).includes(`"${name}"`))
      ;(kind === 'sprint' ? mineSprints : mineWiki).delete(name)
    }
    if (story && !mineSprints.has(sprintName)) assert.equal((await call('taiga_items_get', { project: slug, ref: story.ref })).sprint, null)
    const refusals = [mineWiki.size, mineSprints.size].filter(Boolean).length
    return refusals ? `${refusals} ${REFUSED}` : undefined
  })
  await step('taiga_items_delete shows first, asks the user, and deletes only with the code and the yes: every item of the test is removed', async () => {
    if (!mine.size) return 'skipped: no item was created'
    let refusals = 0
    const order = [...mine].sort(([, a], [, b]) => (a === 'us') - (b === 'us'))
    if (story && task) {
      const shown = await call('taiga_items_delete', { project: slug, ref: story.ref })
      if (!shown.error) assert.deepEqual(shown.tasksDeletedWithIt, [`#${task.ref} ${task.subject}`])
    }
    for (const [ref, kind] of order) {
      const shown = await write(`delete_${kind}`, 'taiga_items_delete', { project: slug, ref })
      if (!shown) { refusals++; continue }
      assert.ok(shown.deleted === false && shown.item.subject.startsWith(label), 'refusing to delete an item this test did not mark')
      const again = await call('taiga_items_delete', { project: slug, ref, confirm: 'no' })
      assert.ok(again.deleted === false && again.confirm !== shown.confirm)
      assert.equal((await call('taiga_items_delete', { project: slug, ref, confirm: shown.confirm })).deleted, false)
      assert.equal((await call('taiga_items_get', { project: slug, ref })).ref, ref)
      const refused = await call('taiga_items_delete', { project: slug, ref })
      answers.push({ action: 'decline' })
      assert.equal((await call('taiga_items_delete', { project: slug, ref, confirm: refused.confirm })).deleted, false)
      assert.equal((await call('taiga_items_get', { project: slug, ref })).ref, ref)
      const last = await call('taiga_items_delete', { project: slug, ref })
      answers.push({ action: 'accept', content: { delete: true } })
      assert.equal((await call('taiga_items_delete', { project: slug, ref, confirm: last.confirm })).deleted, true)
      assert.ok(asked.length >= 2 && asked.at(-1).includes(`#${ref} `) && asked.at(-1).includes(label))
      mine.delete(ref)
      if (kind === 'us' && task) mine.delete(task.ref)
      assert.match((await call('taiga_items_get', { project: slug, ref })).error ?? '', /./)
    }
    return refusals ? `${refusals} ${REFUSED}` : undefined
  })
  await step('The token is in nothing the server wrote', async () => {
    assert.ok(!wrote.includes(env.TAIGA_TOKEN))
  })
} finally {
  report.steps = steps
  report.left = [...[...mine].map(([ref, kind]) => ({ ref, kind })), ...[...mineSprints].map((name) => ({ name, kind: 'sprint' })), ...[...mineWiki].map((slug) => ({ slug, kind: 'wiki' }))]
  rmSync(folder, { recursive: true, force: true })
  mkdirSync('docs/internal', { recursive: true })
  writeFileSync('docs/internal/live-test.json', JSON.stringify(report, null, 2) + '\n')
  child.stdin.end()
}
const refusedSteps = steps.filter((s) => s.outcome.includes('refused')).length
const skipped = steps.filter((s) => s.outcome.startsWith('skipped')).length
console.log(`ok: ${steps.length} live steps, ${refusedSteps} with a refusal for lack of permission, ${skipped} skipped; ${mine.size + mineSprints.size + mineWiki.size} test items left in the project. Details: docs/internal/live-test.json`)
