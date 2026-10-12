// Runs dist/index.js over stdio against a fake Taiga that answers with the field names measured on the real one.
// Each scenario below is a row of docs/TESTING.md. Usage, after "npm run build": npm test
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'

const seen = []
const KINDS = ['us', 'task', 'issue']
const ALL = ['view_project', 'view_us', 'view_tasks', 'view_issues', ...KINDS.flatMap((k) => [`add_${k}`, `modify_${k}`, `comment_${k}`, `delete_${k}`])]
const project = {
  id: 32, slug: 'my-project', name: 'My Project', description: 'Example project', is_private: true, my_permissions: ALL,
  is_backlog_activated: true, is_kanban_activated: false, is_issues_activated: true, is_wiki_activated: true,
  us_statuses: [{ id: 1, name: 'A fazer', is_closed: false }, { id: 2, name: 'Concluído', is_closed: true }],
  task_statuses: [{ id: 11, name: 'A fazer', is_closed: false }, { id: 12, name: 'Em andamento', is_closed: false }],
  issue_statuses: [{ id: 21, name: 'A fazer', is_closed: false }, { id: 22, name: 'Fechado', is_closed: true }],
  points: [{ id: 1, name: '?', value: null }], issue_types: [{ id: 5, name: 'Bug' }],
  severities: [{ id: 6, name: 'Normal' }], priorities: [{ id: 7, name: 'Alta' }],
  members: [{ id: 9, username: 'ana', full_name: 'Ana Rocha', full_name_display: 'Ana Rocha', role_name: 'Developer' }],
  milestones: [{ id: 3, name: 'Sprint 12', slug: 'sprint-12', closed: false }],
}
// A role that may create tasks and comment, and little else.
const locked = { ...project, id: 33, slug: 'locked-project', name: 'Locked', my_permissions: ['view_us', 'view_tasks', 'view_issues', 'add_task', 'comment_us', 'comment_task', 'modify_issue'], members: [{ id: 66, username: 'zeca', full_name_display: 'ana', role_name: 'Guest' }, ...project.members, { id: 10, username: 'bia', full_name: 'Bia Lima', role_name: 'Guest' }, { id: 67, username: 'bia2', full_name: 'Bia Lima', role_name: 'Guest' }], milestones: [] }
// A project that leaves out everything it may leave out, the list of permissions included.
const bare = { id: 34, slug: 'bare-project', name: 'Bare', members: [] }
const projects = { 'my-project': project, 'locked-project': locked, 'bare-project': bare }

const us = { id: 100, ref: 12, subject: 'História', status: 1, status_extra_info: { name: 'A fazer', is_closed: false }, is_closed: false, milestone: 3, assigned_to: 9, assigned_users: [9], total_points: 5, tags: [['api', '#fff']], due_date: null, is_blocked: false, blocked_note: '', total_comments: 2, created_date: '2026-10-01T12:00:00Z', modified_date: '2026-10-09T15:30:00Z', finish_date: null }
const task = { id: 200, ref: 13, subject: 'Tarefa', status: 12, status_extra_info: { name: 'Em andamento', is_closed: false }, is_closed: false, milestone: 3, assigned_to: null, user_story: 100, user_story_extra_info: { id: 100, ref: 12, subject: 'História' }, tags: [], due_date: '2026-10-15', is_blocked: true, blocked_note: 'espera', total_comments: 0, created_date: '2026-10-01T12:00:00Z', modified_date: '2026-10-09T15:30:00Z', finished_date: null }
const issue = { id: 300, ref: 14, subject: 'Erro', status: 21, status_extra_info: { name: 'A fazer', is_closed: false }, is_closed: false, milestone: null, assigned_to: 9, type: 5, severity: 6, priority: 7, tags: [], due_date: null, is_blocked: false, total_comments: 0, created_date: '2026-10-01T12:00:00Z', modified_date: '2026-10-09T15:30:00Z', finished_date: null }
// What the bare project lists: no status name, somebody who left the project, a plain tag, blocked with no reason.
const sparse = [{ id: 400, ref: 20, subject: 'Solta', status: 99, assigned_to: 77, tags: ['x'], is_blocked: true, blocked_note: '' }, { id: 401, ref: 21, subject: 'Mais solta', status_extra_info: { is_closed: true } }]

// The files behind the attachments. Taiga gives each an address with a key of its own and a fragment.
const media = {
  '/media/tela.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  '/media/notas.txt': Buffer.from('olá', 'utf8'),
  '/media/antigo.csv': Buffer.from('ação;1', 'latin1'),
  '/media/laudo.pdf': Buffer.from('%PDF-1.4 fake'),
  '/media/grande.png': Buffer.alloc(3.7 * 1024 * 1024, 1),
  '/media/longo.txt': Buffer.from('a'.repeat(50_001)),
}
const attached = (id, name, file, extra = {}) => ({ id, name, size: media[file]?.length ?? 1, url: `${base}${file}?token=k#_taiga-refresh=task:${id}`, description: '', is_deprecated: false, created_date: '2026-10-01T12:00:00Z', ...extra })
const answer = (status, body, headers = {}) => ({ answer: true, status, body, headers })
const refs = { 12: { us: 100 }, 13: { task: 200 }, 14: { issue: 300 } }
// What changes between two looks at an item: its version, and the tasks of the user story.
const version = { us: 4, task: 7, issue: 2 }
let oneMoreTask = false

const routes = {
  // Another valid token, of an account for which Taiga gives less.
  'GET /users/me': (q, req) => (req.headers.authorization === 'Bearer plain' ? { id: 9, username: 'ana', full_name: 'Ana Rocha' } : { id: 9, username: 'ana', full_name_display: 'Ana Rocha', email: 'ana@example.com' }),
  'GET /projects': () => [project, locked],
  'GET /projects/32': () => project,
  'GET /projects/by_slug': (q) => (q.get('slug') === 'expired' ? answer(401, { _error_message: 'no' }) : projects[q.get('slug')] ?? answer(404, { detail: 'No Project matches the given query.' })),
  'GET /milestones': (q) => (q.get('project') === '34' ? answer(502, 'Bad Gateway') : q.get('project') === '33' ? [{ name: 'Sprint vazio', closed: true }] : [{ name: 'Sprint 12', estimated_start: '2026-10-09', estimated_finish: '2026-10-16', closed: false, total_points: 8, closed_points: 3, user_stories: [{ is_closed: true }, { is_closed: false }] }]),
  // The bare project answers with no total: the server counts what came.
  'GET /userstories': (q) => (q.get('project') === '34' ? answer(200, sparse, { 'x-pagination-count': undefined }) : [us]),
  'GET /tasks': (q) => (q.get('project') === '34' ? [{ id: 402, ref: 22, subject: 'Sem história', status: 11 }] : oneMoreTask ? [task, { ...task, id: 202, ref: 18, subject: 'Outra tarefa' }] : [task]),
  'GET /issues': () => [issue],
  'GET /resolver': (q) => ({ project: 32, ...refs[q.get('ref')] }),
  'GET /userstories/100': () => ({ ...us, description: 'texto', version: version.us, owner_extra_info: { username: 'ana' } }),
  'GET /tasks/200': () => ({ ...task, description: 'faça', version: version.task, owner_extra_info: { username: 'ana' } }),
  'GET /issues/300': () => ({ ...issue, description: null, version: version.issue }),
  'GET /userstories/attachments': () => [],
  'GET /tasks/attachments': () => [attached(501, 'tela.png', '/media/tela.png', { description: 'print' }), attached(502, 'notas.txt', '/media/notas.txt'), attached(503, 'antigo.csv', '/media/antigo.csv'), attached(504, 'laudo final.pdf', '/media/laudo.pdf', { is_deprecated: true })],
  // The attachments that go wrong, or that are too much to show.
  'GET /issues/attachments': () => [
    { ...attached(601, 'proibido.txt', '/media/notas.txt'), url: `${base}/media/notas.txt` },
    { ...attached(602, 'fora.txt', '/media/notas.txt'), url: 'http://127.0.0.1:1/fora.txt' },
    attached(603, 'enorme.bin', '/media/laudo.pdf', { size: 26 * 1024 * 1024 }),
    attached(604, 'grande.png', '/media/grande.png'),
    attached(605, 'longo.txt', '/media/longo.txt'),
  ],
  'GET /history/userstory/100': () => [{ created_at: '2026-10-09T15:30:00Z', user: { username: 'ana' }, comment: 'oi', delete_comment_date: null, values_diff: { status: ['a', 'b'] } }, { created_at: '2026-10-09T15:31:00Z', user: { username: 'ana' }, comment: 'apagado', delete_comment_date: 'x', values_diff: {} }],
  'GET /history/task/200': () => [{ created_at: '2026-10-09T15:30:00Z', user: { username: 'ana' }, comment: 'x'.repeat(2100), delete_comment_date: null, values_diff: {} }],
  // An entry of the system, and one of somebody whose account is gone.
  'GET /history/issue/300': () => [{ created_at: '2026-10-09T15:30:00Z', user: { name: 'Sistema' }, comment: 'y'.repeat(310), delete_comment_date: null }, { created_at: '2026-10-09T15:31:00Z', user: null, comment: '', values_diff: { status: ['a', 'b'] } }, { created_at: '2026-10-09T15:32:00Z', user: null, comment: 'órfão', delete_comment_date: null }],
  'GET /search': (q) => (q.get('project') === '33' ? { count: 0 } : { count: 2, userstories: [{ ref: 12, subject: 'História', status: 1 }], tasks: [{ ref: 13, subject: 'Tarefa', status: 12 }], issues: [], wikipages: [{ slug: 'home' }] }),
  // A write is answered with the item as it was left, as Taiga does.
  'POST /userstories': (sent) => ({ ...us, id: 101, ref: 16, subject: sent.subject }),
  'PATCH /userstories/100': () => ({ ...us, version: version.us + 1 }),
  'POST /tasks': (sent) => (sent.subject === 'boom' ? answer(400, { subject: ['This field is wrong.'] }) : { ...task, id: 201, ref: 15, subject: sent.subject }),
  'PATCH /tasks/200': () => ({ ...task, version: version.task + 1 }),
  'POST /issues': (sent) => ({ ...issue, id: 301, ref: 17, subject: sent.subject }),
  'PATCH /issues/300': () => issue,
  'POST /userstories/attachments': () => ({ id: 506, name: 'envio.txt', size: 9, url: `${base}/media/envio.txt?token=k` }),
  'POST /tasks/attachments': () => ({ id: 505, name: 'envio.txt', size: 9, url: `${base}/media/envio.txt?token=k#_taiga-refresh=task:505` }),
  'POST /issues/attachments': () => ({ id: 507, name: 'envio.txt', size: 9, url: `${base}/media/envio.txt?token=k` }),
  'DELETE /userstories/100': () => answer(204, ''),
  'DELETE /tasks/200': () => answer(204, ''),
  'DELETE /issues/300': () => answer(204, ''),
}
const fake = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  let sent = ''
  for await (const chunk of req) sent += chunk
  // A file goes as a form, kept as text; everything else that is sent is JSON.
  const type = req.headers['content-type'] ?? ''
  const body = type.startsWith('application/json') ? JSON.parse(sent) : sent || undefined
  seen.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), auth: req.headers.authorization, type, body })
  if (media[url.pathname]) {
    const allowed = url.searchParams.get('token') === 'k'
    res.writeHead(allowed ? 200 : 403)
    return res.end(allowed ? media[url.pathname] : '')
  }
  const reply = ({ status, body: data, headers }) => {
    const all = { 'Content-Type': 'application/json', 'x-pagination-count': '77', ...headers }
    for (const name of Object.keys(all)) if (all[name] === undefined) delete all[name]
    res.writeHead(status, all)
    res.end(typeof data === 'string' ? data : JSON.stringify(data))
  }
  if (!['Bearer good', 'Bearer plain'].includes(req.headers.authorization)) return reply(answer(401, { _error_message: 'no' }))
  // Taiga itself refuses a write to the bare project, which gave no list of permissions to check first.
  if (req.method !== 'GET' && (body?.project === 34 || String(body).includes('name="project"\r\n\r\n34'))) return reply(answer(403, { _error_message: 'You do not have permission to perform this action.' }))
  const route = routes[`${req.method} ${url.pathname.replace('/api/v1', '')}`]
  const data = route ? route(req.method === 'GET' ? url.searchParams : body, req) : answer(404, { _error_message: 'not found' })
  reply(data?.answer ? data : answer(200, data))
})
await new Promise((r) => fake.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${fake.address().port}`
const sent = (from = 0) => seen.slice(from).filter((r) => r.method !== 'GET')

let structured = 0
// "can" is what the client says it can do, and "answers" what its user will say to each question of the server.
function start(token, extra = {}, can = {}) {
  const asked = []
  const answers = []
  const env = { ...process.env, TAIGA_WRITE: null, TAIGA_DELETE: null, TAIGA_URL: base, TAIGA_TOKEN: token, ...extra }
  for (const [name, value] of Object.entries(env)) if (value == null) delete env[name]
  const child = spawn(process.execPath, [process.argv[2]], { env, stdio: ['pipe', 'pipe', 'pipe'] })
  let buffer = ''
  let out = ''
  let err = ''
  const waiting = new Map()
  child.stderr.on('data', (d) => (err += d))
  child.stdout.on('data', (d) => {
    buffer += d
    out += d
    let i
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i); buffer = buffer.slice(i + 1)
      if (!line.trim()) continue
      const m = JSON.parse(line)
      // A message with a method is a request of the server to the client: the question it puts to the user.
      if (m.method === 'elicitation/create') {
        asked.push(m.params)
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: answers.shift() ?? { action: 'cancel' } }) + '\n')
      } else if (!m.method) waiting.get(m.id)?.(m)
    }
  })
  let id = 0
  const rpc = (method, params) => new Promise((resolve) => { const n = ++id; waiting.set(n, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n') })
  const raw = async (name, args = {}) => (await rpc('tools/call', { name, arguments: args })).result
  // An answer that is data comes twice, as text and as structured content: the two must say the same.
  const call = async (name, args = {}) => {
    const result = await raw(name, args)
    const text = result.content[0].text
    if (result.isError) return { error: text }
    const data = JSON.parse(text)
    if (name !== 'taiga_attachments_get') { assert.deepEqual(result.structuredContent, data, name); structured++ }
    return data
  }
  // The opening every client before 2026-07-28 makes.
  const open = async () => {
    const opened = (await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: can, clientInfo: { name: 'smoke', version: '0' } })).result
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    return { ...opened, tools: (await rpc('tools/list', {})).result.tools }
  }
  const exited = new Promise((r) => child.on('exit', r))
  // A client stops the server by closing its input: the server leaves by itself.
  const stop = async () => { child.stdin.end(); assert.equal(await exited, 0) }
  return { rpc, raw, call, open, stop, exited, asked, answers, stderr: () => err, wrote: () => out + err }
}

const done = []
async function scenario(name, body) {
  await body()
  done.push(name)
  console.log(`ok ${String(done.length).padStart(2, '0')} ${name}`)
}
const refused = async (extra, pattern) => {
  const before = seen.length
  const server = start('good', extra)
  assert.equal(await server.exited, 1)
  assert.match(server.stderr(), pattern)
  return seen.length - before
}

// ---------------------------------------------------------------------------------------------------- start
await scenario('A wrong token stops the server at start, with the way out in the message', async () => {
  const bad = start('bad')
  assert.equal(await bad.exited, 1)
  assert.match(bad.stderr(), /copy the value of "token"/)
})
await scenario('A missing TAIGA_URL or TAIGA_TOKEN stops the server at start', async () => {
  assert.equal(await refused({ TAIGA_URL: null }, /Missing environment variable TAIGA_URL/), 0)
  assert.equal(await refused({ TAIGA_TOKEN: null }, /Missing environment variable TAIGA_TOKEN/), 0)
})
await scenario('An address that would expose the token is refused before any request', async () => {
  assert.equal(await refused({ TAIGA_URL: 'taiga' }, /TAIGA_URL is not an address/), 0)
  assert.equal(await refused({ TAIGA_URL: 'http://taiga.example.com' }, /must start with https:\/\/: over http the token would travel in clear text/), 0)
  const withPassword = start('good', { TAIGA_URL: base.replace('http://', 'http://ana:secret@') })
  assert.equal(await withPassword.exited, 1)
  assert.match(withPassword.stderr(), /must not carry a user or a password/)
  assert.ok(!withPassword.stderr().includes('secret'))
})
await scenario('A token with a line break or a space in it is refused at start, and is not shown', async () => {
  for (const token of ['made-up\ntoken', 'made-up token', '""']) {
    const before = seen.length
    const broken = start(token)
    assert.equal(await broken.exited, 1)
    assert.match(broken.stderr(), /TAIGA_TOKEN has a space, a line break or another character no token has/)
    assert.ok(!broken.stderr().includes('made-up') && seen.length === before)
  }
})
await scenario('A Taiga that does not answer stops the server at start', async () => {
  assert.equal(await refused({ TAIGA_URL: 'http://127.0.0.1:1' }, /Taiga API unreachable at http:\/\/127\.0\.0\.1:1\/api\/v1/), 0)
})
await scenario('TAIGA_DELETE=1 without TAIGA_WRITE=1 stops the server at start', async () => {
  assert.equal(await refused({ TAIGA_DELETE: '1' }, /TAIGA_DELETE=1 needs TAIGA_WRITE=1/), 0)
})

// ------------------------------------------------------------------------------------------------- protocol
// The browser stores the token with quotes: they are dropped.
const s = start('"good"')
const opened = await s.open()
const tools = opened.tools
await scenario('Read-only by default: 10 tools, none of them a write, and the instructions say so', async () => {
  assert.equal(tools.length, 10)
  assert.match(opened.instructions, /Nothing can be changed through this server\./)
  assert.deepEqual(tools.filter((t) => t.annotations.readOnlyHint !== true).map((t) => t.name), ['taiga_attachments_get'])
  // Opening an attachment can leave a file on the machine, so it does not claim to be read-only.
  assert.deepEqual(tools.at(-1).annotations, { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true })
  assert.match(s.stderr(), new RegExp(`^taiga-mcp: ${base} as ana \\(read-only\\)\\s*$`))
})
await scenario('A tool without parameters accepts only an empty object', async () => {
  assert.deepEqual(tools.filter((t) => t.inputSchema.additionalProperties === false).map((t) => t.name), ['taiga_me', 'taiga_projects_list'])
})
await scenario('Every tool that answers data declares the shape of its answer', async () => {
  assert.deepEqual(tools.filter((t) => !t.outputSchema).map((t) => t.name), ['taiga_attachments_get'])
  assert.ok(tools.filter((t) => t.outputSchema).every((t) => t.outputSchema.type === 'object'))
})
await scenario('An argument of the wrong type comes back as a tool error the model can read', async () => {
  const invalid = await s.raw('taiga_items_get', { project: 'my-project', ref: 'abc' })
  assert.equal(invalid.isError, true)
  assert.match(invalid.content[0].text, /ref: Invalid input: expected number, received string/)
})
await scenario('A tool that does not exist is a protocol error', async () => {
  assert.equal((await s.rpc('tools/call', { name: 'taiga_nope', arguments: {} })).error.code, -32602)
})
await scenario('The 2026-07-28 opening (server/discover, no handshake) is served too', async () => {
  const m = start('plain')
  const _meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'smoke', version: '0' }, 'io.modelcontextprotocol/clientCapabilities': {} }
  const found = (await m.rpc('server/discover', { _meta })).result
  assert.deepEqual(found.supportedVersions, ['2026-07-28'])
  assert.match(found.instructions, /Start with taiga_projects_list/)
  assert.equal((await m.rpc('tools/list', { _meta })).result.tools.length, 10)
  const me = (await m.rpc('tools/call', { name: 'taiga_me', arguments: {}, _meta })).result
  assert.deepEqual(me.structuredContent, { id: 9, username: 'ana', fullName: 'Ana Rocha' })
  assert.deepEqual(me._meta['io.modelcontextprotocol/serverInfo'], { name: 'taiga-mcp', version: '0.3.0' })
  await m.stop()
})

// --------------------------------------------------------------------------------------------------- reading
await scenario('taiga_me gives the current user', async () => {
  assert.deepEqual(await s.call('taiga_me'), { id: 9, username: 'ana', fullName: 'Ana Rocha', email: 'ana@example.com' })
})
await scenario('taiga_projects_list gives the projects of the user', async () => {
  const list = await s.call('taiga_projects_list')
  assert.deepEqual(list.projects.map((p) => p.slug), ['my-project', 'locked-project'])
  assert.deepEqual(list.projects[0], { slug: 'my-project', name: 'My Project', description: 'Example project', private: true, admin: false, modules: { backlog: true, kanban: false, issues: true, wiki: true } })
  assert.deepEqual(seen.at(-1).query, { member: '9', order_by: 'user_order', page_size: '200' })
})
await scenario('taiga_projects_get gives the names the other tools accept, by slug or by id', async () => {
  const detail = await s.call('taiga_projects_get', { project: 'my-project' })
  assert.deepEqual(detail.taskStatuses, [{ name: 'A fazer', closed: false }, { name: 'Em andamento', closed: false }])
  assert.deepEqual(detail.members, [{ username: 'ana', fullName: 'Ana Rocha', role: 'Developer' }])
  assert.deepEqual([detail.points, detail.issueTypes, detail.severities, detail.priorities, detail.sprints], [[{ name: '?', value: null }], ['Bug'], ['Normal'], ['Alta'], [{ name: 'Sprint 12', closed: false }]])
  assert.deepEqual(detail.myPermissions, ALL)
  assert.equal((await s.call('taiga_projects_get', { project: '32' })).slug, 'my-project')
  assert.equal(seen.at(-1).path, '/api/v1/projects/32')
})
await scenario('A project that leaves values out is still answered', async () => {
  assert.deepEqual(await s.call('taiga_projects_get', { project: 'bare-project' }), { slug: 'bare-project', name: 'Bare', private: false, myPermissions: [], modules: { backlog: false, kanban: false, issues: false, wiki: false }, userStoryStatuses: [], taskStatuses: [], issueStatuses: [], points: [], issueTypes: [], severities: [], priorities: [], members: [], sprints: [] })
  const loose = await s.call('taiga_userstories_list', { project: 'bare-project' })
  assert.equal(loose.total, 2)
  assert.deepEqual(loose.items[1], { type: 'us', ref: 21, subject: 'Mais solta', status: null, closed: true, sprint: null, assignees: [], points: null, tags: [], dueDate: null, blocked: false, comments: null, createdAt: null, modifiedAt: null, finishedAt: null })
  // A task with no user story, a sprint with no user story, a member with one name only, a search that finds nothing.
  assert.equal((await s.call('taiga_tasks_list', { project: 'bare-project' })).items[0].userStory, null)
  assert.deepEqual(await s.call('taiga_sprints_list', { project: 'locked-project' }), { sprints: [{ name: 'Sprint vazio', closed: true, userStoriesOpen: 0, userStoriesClosed: 0 }] })
  const lockedDetail = await s.call('taiga_projects_get', { project: 'locked-project' })
  assert.deepEqual([lockedDetail.members[2], lockedDetail.sprints], [{ username: 'bia', fullName: 'Bia Lima', role: 'Guest' }, []])
  assert.deepEqual(await s.call('taiga_search', { project: 'locked-project', text: 'nada' }), { count: 0, items: [], wikiPages: [] })
  assert.deepEqual(loose.items[0], { type: 'us', ref: 20, subject: 'Solta', status: null, closed: false, sprint: null, assignees: ['user 77'], points: null, tags: ['x'], dueDate: null, blocked: true, comments: null, createdAt: null, modifiedAt: null, finishedAt: null })
})
await scenario('taiga_sprints_list counts the user stories and the points of each sprint', async () => {
  assert.deepEqual(await s.call('taiga_sprints_list', { project: 'my-project', closed: false }), { sprints: [{ name: 'Sprint 12', start: '2026-10-09', finish: '2026-10-16', closed: false, userStoriesOpen: 1, userStoriesClosed: 1, pointsTotal: 8, pointsClosed: 3 }] })
  assert.deepEqual(seen.at(-1).query, { project: '32', closed: 'false', page_size: '200' })
})
await scenario('taiga_userstories_list turns names into the filters Taiga expects', async () => {
  const stories = await s.call('taiga_userstories_list', { project: 'my-project', status: 'concluído', assignee: 'Ana Rocha', closed: false, sprint: 'backlog', tag: 'api', text: 'pdf', page: 2, size: 10 })
  assert.equal(stories.total, 77)
  assert.deepEqual([stories.page, stories.size], [2, 10])
  assert.deepEqual(seen.at(-1).query, { project: '32', status: '2', assigned_to: '9', status__is_closed: 'false', milestone: 'null', tags: 'api', q: 'pdf', page: '2', page_size: '10' })
  assert.deepEqual(stories.items[0], { type: 'us', ref: 12, subject: 'História', status: 'A fazer', closed: false, sprint: 'Sprint 12', assignees: ['ana'], points: 5, tags: ['api'], dueDate: null, blocked: false, comments: 2, createdAt: '2026-10-01T12:00:00Z', modifiedAt: '2026-10-09T15:30:00Z', finishedAt: null })
  // A status, a member and a sprint are also found by their id.
  await s.call('taiga_userstories_list', { project: 'my-project', status: '1', assignee: '9', sprint: '3' })
  assert.deepEqual(seen.at(-1).query, { project: '32', status: '1', assigned_to: '9', milestone: '3', page: '1', page_size: '50' })
})
await scenario('taiga_tasks_list filters by user story, by nobody and by sprint', async () => {
  const tasks = await s.call('taiga_tasks_list', { project: 'my-project', userStory: 12, assignee: 'none', sprint: 'sprint-12' })
  assert.deepEqual([seen.at(-1).query.user_story, seen.at(-1).query.assigned_to, seen.at(-1).query.milestone], ['100', 'null', '3'])
  assert.deepEqual([tasks.items[0].userStory, tasks.items[0].blocked, tasks.items[0].dueDate], ['#12 História', 'espera', '2026-10-15'])
})
await scenario('A name that does not exist is refused with the names that do', async () => {
  assert.match((await s.call('taiga_tasks_list', { project: 'my-project', userStory: 13 })).error, /#13 is not a user story: it is a task\./)
  assert.match((await s.call('taiga_tasks_list', { project: 'my-project', status: 'Inexistente' })).error, /Unknown task status "Inexistente"\. Valid: A fazer, Em andamento/)
  assert.match((await s.call('taiga_tasks_list', { project: 'my-project', assignee: 'bia' })).error, /"bia" is not a member of this project\. Members: ana/)
  assert.match((await s.call('taiga_tasks_list', { project: 'my-project', sprint: 'Sprint 99' })).error, /Unknown sprint "Sprint 99"\. Sprints: Sprint 12\. Use "backlog" for no sprint\./)
  assert.match((await s.call('taiga_userstories_list', { project: 'locked-project', sprint: 'Sprint 1' })).error, /Sprints: \(no sprints\)/)
})
await scenario('A person is found by username before any full name, and a full name two people share is refused', async () => {
  // In this project somebody listed first chose "ana", the username of a colleague, as full name.
  await s.call('taiga_tasks_list', { project: 'locked-project', assignee: 'ana' })
  assert.equal(seen.at(-1).query.assigned_to, '9')
  await s.call('taiga_tasks_list', { project: 'locked-project', assignee: 'Ana Rocha' })
  assert.equal(seen.at(-1).query.assigned_to, '9')
  assert.match((await s.call('taiga_tasks_list', { project: 'locked-project', assignee: 'Bia Lima' })).error, /^"Bia Lima" is the full name of 2 members of this project: give the username of one \(bia, bia2\)\.$/)
  await s.call('taiga_tasks_list', { project: 'locked-project', assignee: 'bia2' })
  assert.equal(seen.at(-1).query.assigned_to, '67')
})
await scenario('taiga_issues_list filters by type, severity and priority', async () => {
  const issues = await s.call('taiga_issues_list', { project: 'my-project', issueType: 'bug', severity: 'Normal', priority: 'alta' })
  assert.deepEqual([seen.at(-1).query.type, seen.at(-1).query.severity, seen.at(-1).query.priority], ['5', '6', '7'])
  assert.deepEqual([issues.items[0].issueType, issues.items[0].severity, issues.items[0].priority], ['Bug', 'Normal', 'Alta'])
  assert.equal((await s.call('taiga_issues_list', { project: 'my-project' })).items.length, 1)
  assert.deepEqual(seen.at(-1).query, { project: '32', page: '1', page_size: '50' })
})
await scenario('taiga_items_get gives a user story with its tasks, comments and history', async () => {
  const item = await s.call('taiga_items_get', { project: 'my-project', ref: 12, include: ['comments', 'history'] })
  assert.deepEqual([item.type, item.description, item.createdBy, item.attachments], ['us', 'texto', 'ana', []])
  assert.deepEqual(item.taskList, [{ ref: 13, subject: 'Tarefa', status: 'Em andamento', closed: false, assignees: [] }])
  // A deleted comment is not shown.
  assert.deepEqual(item.commentList, [{ when: '2026-10-09T15:30:00Z', who: 'ana', body: 'oi' }])
  assert.deepEqual(item.history.map((entry) => entry.changed), [['status'], []])
  // Taiga gives 30 history entries unless more are asked for.
  assert.equal(seen.at(-1).query.page_size, '1000')
})
await scenario('taiga_items_get gives a task with what is attached to it', async () => {
  const whole = await s.call('taiga_items_get', { project: 'my-project', ref: 13 })
  assert.deepEqual(seen.at(-1).query, { project: '32', object_id: '200', page_size: '200' })
  assert.equal(whole.description, 'faça')
  assert.deepEqual(whole.attachments.map((a) => `${a.id} ${a.name} ${a.size}`), ['501 tela.png 4', '502 notas.txt 4', '503 antigo.csv 6', '504 laudo final.pdf 13'])
  assert.deepEqual([whole.attachments[0].description, whole.attachments[3].deprecated], ['print', true])
  assert.equal(whole.taskList, undefined)
})
await scenario('taiga_items_get gives an issue, and says who wrote each entry when Taiga knows', async () => {
  const bug = await s.call('taiga_items_get', { project: 'my-project', ref: 14, include: ['comments', 'history'] })
  assert.deepEqual([bug.type, bug.description, bug.createdBy, bug.issueType], ['issue', '', null, 'Bug'])
  assert.deepEqual(bug.history.map((entry) => entry.who), ['Sistema', null, null])
  assert.deepEqual(bug.commentList.map((entry) => [entry.who, entry.body.length]), [['Sistema', 310], [null, 5]])
  assert.match(bug.history[0].comment, /^y{300}… \(cut: the first 300 of 310 characters\)$/)
})
await scenario('A text that is cut says so, with its real length', async () => {
  const long = await s.call('taiga_items_get', { project: 'my-project', ref: 13, include: ['comments'] })
  assert.match(long.commentList[0].body, /^x{2000}… \(cut: the first 2000 of 2100 characters\)$/)
  const text = (await s.raw('taiga_attachments_get', { project: 'my-project', ref: 14, attachment: 'longo.txt' })).content[0].text
  assert.match(text, /^a{50000}… \(cut: the first 50000 of 50001 characters\)$/)
})
await scenario('A number that is no item of the project is refused', async () => {
  assert.match((await s.call('taiga_items_get', { project: 'my-project', ref: 99 })).error, /#99 is not a user story, task or issue of my-project\./)
})
await scenario('taiga_search finds items and wiki pages', async () => {
  const found = await s.call('taiga_search', { project: 'my-project', text: 'x' })
  assert.deepEqual(seen.at(-1).query, { project: '32', text: 'x' })
  assert.deepEqual(found.items.map((i) => `${i.type} ${i.ref} ${i.status}`), ['us 12 A fazer', 'task 13 Em andamento'])
  assert.deepEqual([found.count, found.wikiPages], [2, ['home']])
})

// ----------------------------------------------------------------------------------------------- attachments
const mediaFrom = seen.length
await scenario('taiga_attachments_get shows an image as an image and a text as text', async () => {
  const image = await s.raw('taiga_attachments_get', { project: 'my-project', ref: 13, attachment: 'tela.png' })
  assert.deepEqual(image.content, [{ type: 'text', text: 'tela.png' }, { type: 'image', data: media['/media/tela.png'].toString('base64'), mimeType: 'image/png' }])
  assert.equal(image.structuredContent, undefined)
  assert.equal((await s.raw('taiga_attachments_get', { project: 'my-project', ref: 13, attachment: '502' })).content[0].text, 'olá')
})
await scenario('A text that is not UTF-8 keeps its accents', async () => {
  assert.equal((await s.raw('taiga_attachments_get', { project: 'my-project', ref: 13, attachment: 'ANTIGO.csv' })).content[0].text, 'ação;1')
})
let folder
await scenario('Any other file is saved under a name that cannot leave the folder', async () => {
  const pdf = await s.call('taiga_attachments_get', { project: 'my-project', ref: 13, attachment: 'laudo final.pdf' })
  assert.equal(basename(pdf.savedTo), 'my-project-13-504-laudo_final.pdf')
  assert.deepEqual(readFileSync(pdf.savedTo), media['/media/laudo.pdf'])
  assert.deepEqual([pdf.name, pdf.size], ['laudo final.pdf', 13])
  folder = dirname(pdf.savedTo)
})
await scenario('The folder of saved files is new, only of this user, one for the run, and made again if deleted', async () => {
  assert.match(basename(folder), /^taiga-mcp-.{6,}$/)
  // Windows has no such mode: there the temp folder is already inside the profile of the user.
  assert.ok(process.platform === 'win32' || (statSync(folder).mode & 0o777) === 0o700)
  // An image too large for a model goes to a file as well, in the same folder.
  const large = await s.call('taiga_attachments_get', { project: 'my-project', ref: 14, attachment: 'grande.png' })
  assert.deepEqual([dirname(large.savedTo), basename(large.savedTo), large.size], [folder, 'my-project-14-604-grande.png', media['/media/grande.png'].length])
  rmSync(folder, { recursive: true })
  const again = await s.call('taiga_attachments_get', { project: 'my-project', ref: 13, attachment: '504' })
  assert.notEqual(dirname(again.savedTo), folder)
  assert.deepEqual(readFileSync(again.savedTo), media['/media/laudo.pdf'])
  rmSync(dirname(again.savedTo), { recursive: true })
})
await scenario('An attachment that cannot be opened says why', async () => {
  const open = (attachment) => s.call('taiga_attachments_get', { project: 'my-project', ref: 14, attachment })
  assert.match((await open('x.png')).error, /Unknown attachment "x\.png"\. Valid: proibido\.txt, fora\.txt, enorme\.bin, grande\.png, longo\.txt/)
  assert.match((await open('enorme.bin')).error, /enorme\.bin has 27262976 bytes: more than the 26214400 this server opens\./)
  assert.match((await open('proibido.txt')).error, /403 Forbidden on the file of the attachment/)
  assert.match((await open('fora.txt')).error, /Attachment unreachable: /)
})
await scenario('The token goes to the API and nowhere else', async () => {
  // The files are read with the key of their own address: the session token does not go to them.
  const files = seen.slice(mediaFrom).filter((r) => r.path.startsWith('/media/'))
  assert.equal(files.length, 7)
  assert.ok(files.every((r) => r.auth === undefined))
  assert.ok(seen.filter((r) => r.path.startsWith('/api/')).every((r) => ['Bearer good', 'Bearer plain', 'Bearer bad'].includes(r.auth)))
  // It is in no answer, no error and no line of stderr.
  assert.ok(!s.wrote().includes('good'))
})

// ---------------------------------------------------------------------------------------------------- errors
await scenario('What Taiga refuses comes back as it said it, or as the status when it said nothing', async () => {
  assert.match((await s.call('taiga_projects_get', { project: 'nope' })).error, /^No Project matches the given query\.$/)
  assert.match((await s.call('taiga_sprints_list', { project: 'bare-project' })).error, /^502 Bad Gateway on GET \/milestones$/)
})
await scenario('A token that expires in the middle of a run says how to renew it', async () => {
  assert.match((await s.call('taiga_projects_get', { project: 'expired' })).error, /Taiga refused the token: it expired or is wrong\..*set TAIGA_TOKEN again/)
})
await scenario('Without TAIGA_WRITE nothing but GET leaves the server, and it stops when its input closes', async () => {
  assert.deepEqual(sent(), [])
  await s.stop()
})

// --------------------------------------------------------------------------------------------------- writing
const w = start('good', { TAIGA_WRITE: '1' })
const writer = await w.open()
await scenario('TAIGA_WRITE=1 adds 7 tools that write, and none that deletes', async () => {
  assert.deepEqual(writer.tools.slice(10).map((t) => t.name), ['taiga_userstories_create', 'taiga_userstories_update', 'taiga_tasks_create', 'taiga_tasks_update', 'taiga_issues_create', 'taiga_issues_update', 'taiga_attachments_add'])
  assert.ok(writer.tools.slice(10).every((t) => t.annotations.readOnlyHint === false && t.outputSchema))
  // An edit replaces what was there: only the three tools that edit are marked as destructive.
  assert.deepEqual(writer.tools.filter((t) => t.annotations.destructiveHint).map((t) => t.name), ['taiga_userstories_update', 'taiga_tasks_update', 'taiga_issues_update'])
  assert.match(writer.instructions, /do not work around it.*Nothing can be deleted\./)
  assert.match(w.stderr(), /\(writes user stories, tasks, issues and attachments\)/)
})
await scenario('TAIGA_WRITE and TAIGA_DELETE are on with 1 or with true, and with nothing else', async () => {
  const count = async (extra) => {
    const server = start('good', extra)
    const { tools } = await server.open()
    await server.stop()
    return tools.length
  }
  assert.equal(await count({ TAIGA_WRITE: 'true' }), 17)
  assert.equal(await count({ TAIGA_WRITE: 'true', TAIGA_DELETE: 'true' }), 18)
  for (const value of ['yes', 'on', 'TRUE', '0', 'false', '']) assert.equal(await count({ TAIGA_WRITE: value, TAIGA_DELETE: value }), 10, value)
})
await scenario('A task that would be on no board is refused before anything is sent', async () => {
  assert.match((await w.call('taiga_tasks_create', { project: 'my-project', subject: 'Solta' })).error, /needs a user story or a sprint/)
  assert.match((await w.call('taiga_tasks_create', { project: 'my-project', subject: 'Solta', sprint: 'backlog' })).error, /cannot go to the backlog/)
  assert.deepEqual(sent(), [])
})
await scenario('taiga_tasks_create sends names as ids and answers with the number and the address', async () => {
  const created = await w.call('taiga_tasks_create', { project: 'my-project', subject: 'Nova', description: 'faça', userStory: 12, status: 'em andamento', assignee: 'Ana Rocha', tags: ['api'], dueDate: '2026-10-20' })
  assert.equal(`${seen.at(-1).method} ${seen.at(-1).path}`, 'POST /api/v1/tasks')
  assert.deepEqual(seen.at(-1).body, { project: 32, subject: 'Nova', description: 'faça', status: 12, assigned_to: 9, user_story: 100, tags: ['api'], due_date: '2026-10-20' })
  assert.deepEqual([created.ref, created.subject, created.url], [15, 'Nova', `${base}/project/my-project/task/15`])
  // With no user story, a task goes to the row of a sprint.
  await w.call('taiga_tasks_create', { project: 'my-project', subject: 'Sem história', sprint: 'Sprint 12' })
  assert.deepEqual(seen.at(-1).body, { project: 32, subject: 'Sem história', milestone: 3 })
})
await scenario('taiga_tasks_update moves and edits: what is not said is not sent, and "none" empties', async () => {
  const moved = await w.call('taiga_tasks_update', { project: 'my-project', ref: 13, status: 'a fazer', assignee: 'none', dueDate: 'none', blocked: 'none', comment: 'feito' })
  assert.equal(`${seen.at(-1).method} ${seen.at(-1).path}`, 'PATCH /api/v1/tasks/200')
  // The version read goes along: Taiga refuses a change that does not say which version it was made on.
  assert.deepEqual(seen.at(-1).body, { version: 7, status: 11, assigned_to: null, due_date: null, is_blocked: false, blocked_note: '', comment: 'feito' })
  assert.equal(moved.url, `${base}/project/my-project/task/13`)
  await w.call('taiga_tasks_update', { project: 'my-project', ref: 13, subject: 'Outra', userStory: 12, sprint: 'Sprint 12', blocked: 'espera o cliente' })
  assert.deepEqual(seen.at(-1).body, { version: 7, subject: 'Outra', user_story: 100, milestone: 3, is_blocked: true, blocked_note: 'espera o cliente' })
})
await scenario('taiga_userstories_create takes the statuses of user stories, and "backlog" is a place for it', async () => {
  const story = await w.call('taiga_userstories_create', { project: 'my-project', subject: 'Nova história', status: 'a fazer', assignee: 'ana', sprint: 'backlog' })
  assert.equal(`${seen.at(-1).method} ${seen.at(-1).path}`, 'POST /api/v1/userstories')
  assert.deepEqual(seen.at(-1).body, { project: 32, subject: 'Nova história', status: 1, assigned_to: 9, milestone: null })
  assert.deepEqual([story.type, story.ref, story.url], ['us', 16, `${base}/project/my-project/us/16`])
  assert.match((await w.call('taiga_userstories_create', { project: 'my-project', subject: 'x', status: 'Em andamento' })).error, /Unknown us status "Em andamento"\. Valid: A fazer, Concluído/)
})
await scenario('taiga_userstories_update moves a user story on the kanban and between sprints', async () => {
  const story = await w.call('taiga_userstories_update', { project: 'my-project', ref: 12, status: 'Concluído', sprint: 'backlog', tags: ['pronto'], comment: 'entregue', version: 4 })
  assert.equal(`${seen.at(-1).method} ${seen.at(-1).path}`, 'PATCH /api/v1/userstories/100')
  assert.deepEqual(seen.at(-1).body, { version: 4, status: 2, milestone: null, tags: ['pronto'], comment: 'entregue' })
  assert.deepEqual([story.url, story.version], [`${base}/project/my-project/us/12`, 5])
})
await scenario('An edit that replaces a description or the tags needs the version that was read, and is refused if the item changed', async () => {
  const before = seen.length
  assert.equal((await w.call('taiga_items_get', { project: 'my-project', ref: 13 })).version, 7)
  for (const change of [{ description: 'novo texto' }, { tags: ['novo'] }]) {
    assert.match((await w.call('taiga_tasks_update', { project: 'my-project', ref: 13, ...change })).error, /^A description or the tags replace what #13 has now: read it with taiga_items_get and give its version/)
  }
  // Somebody edited the task after it was read: the edit made on the old version is not sent.
  assert.match((await w.call('taiga_tasks_update', { project: 'my-project', ref: 13, description: 'novo texto', version: 6 })).error, /^#13 changed since version 6: it is at version 7 now\. Read it again with taiga_items_get/)
  assert.deepEqual(sent(before), [])
  const edited = await w.call('taiga_tasks_update', { project: 'my-project', ref: 13, description: 'novo texto', tags: ['novo'], version: 7 })
  assert.deepEqual(seen.at(-1).body, { version: 7, description: 'novo texto', tags: ['novo'] })
  // The answer has the version the write left, for the next edit.
  assert.equal(edited.version, 8)
})
await scenario('taiga_issues_create and taiga_issues_update take type, severity and priority by name', async () => {
  const bug = await w.call('taiga_issues_create', { project: 'my-project', subject: 'Falha', description: 'não abre', issueType: 'Bug', severity: 'normal', priority: 'Alta', assignee: 'ana' })
  assert.equal(`${seen.at(-1).method} ${seen.at(-1).path}`, 'POST /api/v1/issues')
  assert.deepEqual(seen.at(-1).body, { project: 32, subject: 'Falha', description: 'não abre', assigned_to: 9, type: 5, severity: 6, priority: 7 })
  assert.deepEqual([bug.type, bug.ref, bug.url], ['issue', 17, `${base}/project/my-project/issue/17`])
  await w.call('taiga_issues_update', { project: 'my-project', ref: 14, status: 'fechado', sprint: 'Sprint 12', blocked: 'none' })
  assert.equal(`${seen.at(-1).method} ${seen.at(-1).path}`, 'PATCH /api/v1/issues/300')
  assert.deepEqual(seen.at(-1).body, { version: 2, status: 22, milestone: 3, is_blocked: false, blocked_note: '' })
  assert.match((await w.call('taiga_issues_create', { project: 'my-project', subject: 'x', severity: 'Grave' })).error, /Unknown severity "Grave"\. Valid: Normal/)
})
await scenario('An edit of the wrong kind, of nothing or of an unknown name is refused before anything is sent', async () => {
  const before = seen.length
  assert.match((await w.call('taiga_tasks_update', { project: 'my-project', ref: 12, subject: 'x' })).error, /#12 is not a task: it is a user story\./)
  assert.match((await w.call('taiga_userstories_update', { project: 'my-project', ref: 14, subject: 'x' })).error, /#14 is not a user story: it is an issue\./)
  assert.match((await w.call('taiga_issues_update', { project: 'my-project', ref: 13, subject: 'x' })).error, /#13 is not an issue: it is a task\./)
  assert.match((await w.call('taiga_tasks_update', { project: 'my-project', ref: 13 })).error, /Nothing to change/)
  assert.match((await w.call('taiga_tasks_update', { project: 'my-project', ref: 13, status: 'Inexistente' })).error, /Valid: A fazer, Em andamento/)
  assert.deepEqual(sent(before), [])
})
await scenario('What Taiga refuses in a write comes back with the fields at fault', async () => {
  assert.match((await w.call('taiga_tasks_create', { project: 'my-project', subject: 'boom', userStory: 12 })).error, /^400 Bad Request on POST \/tasks: \{"subject":\["This field is wrong\."\]\}$/)
})

const smoke = join(tmpdir(), 'taiga-mcp-smoke')
mkdirSync(join(smoke, '.ssh'), { recursive: true })
const sending = join(smoke, 'envio.txt')
writeFileSync(sending, 'conteúdo')
await scenario('taiga_attachments_add sends a file to a task, a user story or an issue, as a form', async () => {
  const attachment = await w.call('taiga_attachments_add', { project: 'my-project', ref: 13, path: sending, description: 'nota' })
  assert.equal(`${seen.at(-1).method} ${seen.at(-1).path}`, 'POST /api/v1/tasks/attachments')
  assert.match(seen.at(-1).type, /^multipart\/form-data; boundary=/)
  for (const part of ['name="project"\r\n\r\n32\r\n', 'name="object_id"\r\n\r\n200\r\n', 'name="description"\r\n\r\nnota\r\n', 'filename="envio.txt"', '\r\n\r\nconteúdo\r\n']) {
    assert.ok(seen.at(-1).body.includes(part), part)
  }
  assert.deepEqual(attachment, { id: 505, name: 'envio.txt', size: 9, url: `${base}/media/envio.txt?token=k#_taiga-refresh=task:505` })
  assert.equal((await w.call('taiga_attachments_add', { project: 'my-project', ref: 12, path: sending })).id, 506)
  assert.equal(seen.at(-1).path, '/api/v1/userstories/attachments')
  assert.ok(seen.at(-1).body.includes('name="object_id"\r\n\r\n100\r\n') && !seen.at(-1).body.includes('name="description"'))
  assert.equal((await w.call('taiga_attachments_add', { project: 'my-project', ref: 14, path: sending })).id, 507)
  assert.equal(seen.at(-1).path, '/api/v1/issues/attachments')
})
await scenario('taiga_attachments_add refuses what is not a file', async () => {
  const before = seen.length
  assert.match((await w.call('taiga_attachments_add', { project: 'my-project', ref: 13, path: `${sending}.missing` })).error, /ENOENT/)
  assert.match((await w.call('taiga_attachments_add', { project: 'my-project', ref: 13, path: smoke })).error, /is not a file of up to 26214400 bytes/)
  assert.deepEqual(sent(before), [])
})
await scenario('taiga_attachments_add refuses a file that looks like a credential', async () => {
  const before = seen.length
  const send = async (path) => (await w.call('taiga_attachments_add', { project: 'my-project', ref: 13, path })).error
  const secrets = [join(smoke, '.ssh', 'id_test'), join(smoke, 'cert.PEM'), join(smoke, '.env')]
  // The folder where programs keep the data of the user, outside the temp folder: client configurations live there.
  const profile = { win32: join(homedir(), 'AppData', 'Local'), darwin: join(homedir(), 'Library') }[process.platform]
  if (profile) secrets.push(join(profile, 'taiga-mcp-smoke-profile.txt'))
  for (const path of secrets) {
    writeFileSync(path, 'made-up')
    assert.match(await send(path), /is not sent: it looks like a credential or a configuration file/, path)
  }
  if (profile) rmSync(secrets.at(-1))
  // A network path is refused before the disk is touched: \\localhost\C$ is another name for every folder above,
  // and another host would be offered the credentials of the user.
  for (const path of ['\\\\localhost\\C$\\Users\\ana\\AppData\\Roaming\\config.json', '//files.example.com/share/notes.txt']) {
    assert.match(await send(path), /is not sent: a network path is refused/, path)
  }
  // On Linux the environment of the server itself, token included, is a file under /proc.
  if (process.platform === 'linux') assert.match(await send('/proc/self/environ'), /is not sent: it looks like a credential/)
  // A link with an innocent name that leads to one of them is followed first. Windows asks for a privilege to make one.
  if (process.platform !== 'win32') {
    symlinkSync(secrets[0], join(smoke, 'foto.txt'))
    assert.match(await send(join(smoke, 'foto.txt')), /is not sent/)
  }
  assert.deepEqual(sent(before), [])
})

// ----------------------------------------------------------------------------------------------- permissions
await scenario('A change the role does not allow is refused before anything is sent, with what the role allows instead', async () => {
  const before = seen.length
  const refusedStory = (await w.call('taiga_userstories_create', { project: 'locked-project', subject: 'História nova' })).error
  assert.match(refusedStory, /^You do not have permission to create a user story in locked-project: your role lacks the Taiga permission add_us\. Nothing was done\./)
  // Only what this role may do is offered: a task and a comment, not an issue.
  assert.match(refusedStory, /instead: \(1\) create only a task, in a user story that already exists or in a sprint with no user story \(taiga_tasks_create\); \(2\) write it as a comment on a user story that already exists \(taiga_userstories_update with only comment\); \(3\) ask a project admin to do it, or to give your role this permission\./)
  assert.match(refusedStory, /Do not work around this on your own: tell the user what was refused, offer the alternatives and wait for the choice\.$/)
  assert.match((await w.call('taiga_issues_create', { project: 'locked-project', subject: 'x' })).error, /permission to create an issue.*add_issue.*instead: \(1\) create only a task.*\(2\) ask a project admin/)
  assert.match((await w.call('taiga_tasks_update', { project: 'locked-project', ref: 13, status: 'A fazer' })).error, /permission to change a task.*modify_task.*instead: \(1\) leave a comment on it saying what should change \(taiga_tasks_update with only comment\); \(2\) ask/)
  // With no comment permission either, only the admin is left.
  assert.match((await w.call('taiga_userstories_update', { project: 'locked-project', ref: 12, subject: 'x' })).error, /modify_us.*instead: \(1\) leave a comment on it/)
  assert.deepEqual(sent(before), [])
})
await scenario('What the role does allow goes through: a task, an edit it may make, a comment alone', async () => {
  assert.equal((await w.call('taiga_tasks_create', { project: 'locked-project', subject: 'Só a tarefa', userStory: 12 })).ref, 15)
  assert.deepEqual(seen.at(-1).body, { project: 33, subject: 'Só a tarefa', user_story: 100 })
  await w.call('taiga_issues_update', { project: 'locked-project', ref: 14, status: 'Fechado' })
  assert.deepEqual(seen.at(-1).body, { version: 2, status: 22 })
  // Taiga takes a change that is only a comment from a role that may comment and may not edit.
  await w.call('taiga_tasks_update', { project: 'locked-project', ref: 13, comment: 'alguém pode mover?' })
  assert.deepEqual(seen.at(-1).body, { version: 7, comment: 'alguém pode mover?' })
})
await scenario('A refusal that comes from Taiga itself asks the same of the model', async () => {
  const error = (await w.call('taiga_userstories_create', { project: 'bare-project', subject: 'x' })).error
  assert.match(error, /^Taiga refused POST \/userstories: the current user does not have the permission for it\. Nothing was changed\. taiga_projects_get shows what the user may do in a project \(myPermissions\)\. Do not work around this on your own/)
  assert.match((await w.call('taiga_attachments_add', { project: 'bare-project', ref: 13, path: sending })).error, /^Taiga refused POST \/tasks\/attachments/)
})
await scenario('Every change that reached Taiga and every tool error leaves a line on stderr', async () => {
  const lines = w.stderr().split('\n')
  const has = (pattern) => assert.ok(lines.some((line) => pattern.test(line)), String(pattern))
  has(/^taiga-mcp: \d{4}-\d\d-\d\dT[\d:.]+Z POST \/tasks 200$/)
  has(/Z PATCH \/userstories\/100 200$/)
  has(/Z POST \/issues\/attachments 200$/)
  // What Taiga refused is there with its status, and what the server refused with its reason.
  has(/Z POST \/tasks 400$/)
  has(/Z POST \/userstories 403$/)
  has(/Z tool error: You do not have permission to create a user story in locked-project: your role lacks the Taiga permission add_us\./)
  has(/Z tool error: .*is not sent: a network path is refused/)
  // A read leaves no line.
  assert.ok(!lines.some((line) => / GET /.test(line)))
})
await scenario('The token is in nothing the writing server says', async () => {
  assert.ok(!w.wrote().includes('good'))
  await w.stop()
})

// -------------------------------------------------------------------------------------------------- deleting
const d = start('good', { TAIGA_WRITE: '1', TAIGA_DELETE: '1' })
const deleter = await d.open()
await scenario('TAIGA_DELETE=1 adds the one tool that deletes, marked as destructive', async () => {
  assert.deepEqual(deleter.tools.slice(17).map((t) => t.name), ['taiga_items_delete'])
  assert.deepEqual(deleter.tools.at(-1).annotations, { readOnlyHint: false, destructiveHint: true, openWorldHint: false })
  assert.match(deleter.instructions, /taiga_items_delete, in two calls.*only after a yes/)
  assert.match(d.stderr(), /\(writes user stories, tasks, issues and attachments, and deletes them\)/)
})
await scenario('docs/TOOLS.md describes exactly the tools and the parameters that tools/list gives, in the same order', async () => {
  const documented = readFileSync('docs/TOOLS.md', 'utf8').split(/^### `/m).slice(1).map((part) => [part.slice(0, part.indexOf('`')), [...part.matchAll(/^\| `(\w+)` \|/gm)].map((row) => row[1])])
  assert.deepEqual(documented, deleter.tools.map((t) => [t.name, Object.keys(t.inputSchema.properties ?? {})]))
})
const CODE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const show = (ref, extra = {}) => d.call('taiga_items_delete', { project: 'my-project', ref, ...extra })
await scenario('The first call of taiga_items_delete deletes nothing: it shows the item and gives a random code', async () => {
  const before = seen.length
  const shown = await show(13)
  assert.deepEqual([shown.deleted, shown.item.subject, shown.tasksDeletedWithIt], [false, 'Tarefa', undefined])
  assert.match(shown.confirm, CODE)
  assert.match(shown.next, /^Nothing was deleted\. Show this to the user and ask whether it is really to be deleted\. Only after a yes, call again with this code in confirm\.$/)
  // A user story takes its tasks with it, and the first call says which.
  const story = await show(12)
  assert.deepEqual([story.deleted, story.tasksDeletedWithIt], [false, ['#13 Tarefa']])
  assert.match(story.confirm, CODE)
  assert.notEqual(story.confirm, shown.confirm)
  assert.deepEqual(sent(before), [])
})
await scenario('A code the server did not give for that item, as it is now, deletes nothing', async () => {
  const before = seen.length
  // A guess on a first call, in the shape the codes once had or in the shape they have.
  for (const confirm of ['task-13-v7', 'yes', '00000000-0000-4000-8000-000000000000']) {
    const guess = await show(13, { confirm })
    assert.equal(guess.deleted, false)
    assert.match(guess.next, /^That code does not stand for this item as it is now: .* Nothing was deleted\./)
  }
  // The code of another item, and the code of the item with the same number in another project.
  assert.equal((await show(14, { confirm: (await show(13)).confirm })).deleted, false)
  assert.equal((await d.call('taiga_items_delete', { project: 'bare-project', ref: 13, confirm: (await show(13)).confirm })).deleted, false)
  // A code that is not the last one given: showing another item replaced it.
  const first = await show(13)
  await show(14)
  assert.equal((await show(13, { confirm: first.confirm })).deleted, false)
  // An item that changed since it was shown.
  const old = await show(13)
  version.task = 8
  assert.equal((await show(13, { confirm: old.confirm })).deleted, false)
  // A user story that got one more task since it was shown.
  const story = await show(12)
  oneMoreTask = true
  const grown = await show(12, { confirm: story.confirm })
  assert.deepEqual([grown.deleted, grown.tasksDeletedWithIt], [false, ['#13 Tarefa', '#18 Outra tarefa']])
  oneMoreTask = false
  assert.deepEqual(sent(before), [])
})
await scenario('With the code of the first call the item is deleted, whatever its kind, and the code works once', async () => {
  for (const [ref, path] of [[13, 'tasks/200'], [12, 'userstories/100'], [14, 'issues/300']]) {
    const shown = await show(ref)
    const gone = await show(ref, { confirm: shown.confirm })
    assert.deepEqual([gone.deleted, gone.item.ref, gone.confirm, gone.next], [true, ref, undefined, undefined])
    assert.deepEqual([seen.at(-1).method, seen.at(-1).path, seen.at(-1).body], ['DELETE', `/api/v1/${path}`, undefined])
    // The simulated Taiga still has the item: the code that deleted it does not delete it a second time.
    const before = seen.length
    assert.equal((await show(ref, { confirm: shown.confirm })).deleted, false)
    assert.deepEqual(sent(before), [])
  }
})
await scenario('A role that may not delete is told so on the first call, with what it may do instead', async () => {
  // Each deletion left its line on stderr: the last record of an item Taiga no longer has.
  assert.equal(d.stderr().split('\n').filter((line) => /Z DELETE \/(tasks\/200|userstories\/100|issues\/300) 204$/.test(line)).length, 3)
  const before = seen.length
  assert.match((await d.call('taiga_items_delete', { project: 'locked-project', ref: 14 })).error, /permission to delete an issue.*delete_issue.*instead: \(1\) close it instead, by moving it to a closed status \(taiga_issues_update\); \(2\) ask a project admin/)
  assert.match((await d.call('taiga_items_delete', { project: 'locked-project', ref: 13, confirm: 'task-13-v7' })).error, /delete_task.*instead: \(1\) leave a comment on it asking for the deletion \(taiga_tasks_update with only comment\); \(2\) ask/)
  assert.deepEqual(sent(before), [])
  await d.stop()
})
await scenario('A client that can ask its user is made to ask, and nothing is deleted without the yes given there', async () => {
  const e = start('good', { TAIGA_WRITE: '1', TAIGA_DELETE: '1' }, { elicitation: {} })
  await e.open()
  const erase = (extra = {}) => e.call('taiga_items_delete', { project: 'my-project', ref: 12, ...extra })
  const before = seen.length
  // The first call asks nobody: it only shows.
  await erase()
  assert.equal(e.asked.length, 0)
  // Any answer that is not a plain yes deletes nothing and spends the code.
  for (const answer of [{ action: 'decline' }, { action: 'cancel' }, { action: 'accept', content: { delete: false } }, { action: 'accept', content: {} }]) {
    const { confirm } = await erase()
    e.answers.push(answer)
    const result = await erase({ confirm })
    assert.deepEqual([result.deleted, result.next], [false, 'The user did not approve the deletion: nothing was deleted. Do not ask again unless the user brings it up.'])
    assert.match((await erase({ confirm })).next, /^That code does not stand for this item as it is now/)
  }
  assert.deepEqual(sent(before), [])
  // The question names the item and what would go with it, and takes a yes or a no.
  assert.equal(e.asked.length, 4)
  assert.equal(e.asked[0].message, 'Delete the user story #12 "História" of my-project, with its tasks #13? Taiga keeps no trash: this cannot be undone.')
  assert.equal(e.asked[0].requestedSchema.properties.delete.type, 'boolean')
  assert.match(e.stderr(), /Z deletion of us #12 in my-project not approved by the user \(decline\)$/m)
  // A wrong code is never put to the user.
  assert.equal((await erase({ confirm: 'yes' })).deleted, false)
  assert.equal(e.asked.length, 4)
  // With the yes of the user, it is deleted.
  const { confirm } = await erase()
  e.answers.push({ action: 'accept', content: { delete: true } })
  assert.equal((await erase({ confirm })).deleted, true)
  assert.deepEqual([seen.at(-1).method, seen.at(-1).path, e.asked.length], ['DELETE', '/api/v1/userstories/100', 5])
  await e.stop()
})
await scenario('On the 2026-07-28 revision the question goes out in the answer and the yes comes in with the call made again', async () => {
  const m = start('good', { TAIGA_WRITE: '1', TAIGA_DELETE: '1' })
  const _meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'smoke', version: '0' }, 'io.modelcontextprotocol/clientCapabilities': { elicitation: {} } }
  const erase = async (args = {}, more = {}) => (await m.rpc('tools/call', { name: 'taiga_items_delete', arguments: { project: 'my-project', ref: 14, ...args }, ...more, _meta })).result
  const { confirm } = (await erase()).structuredContent
  const before = seen.length
  const asks = await erase({ confirm })
  assert.equal(asks.resultType, 'input_required')
  assert.equal(asks.inputRequests.approve.params.message, 'Delete the issue #14 "Erro" of my-project? Taiga keeps no trash: this cannot be undone.')
  assert.deepEqual(sent(before), [])
  // A no in the retried call deletes nothing; a yes, after a new look, deletes.
  assert.equal((await erase({ confirm }, { inputResponses: { approve: { action: 'decline' } } })).structuredContent.deleted, false)
  assert.deepEqual(sent(before), [])
  const again = (await erase()).structuredContent.confirm
  await erase({ confirm: again })
  const gone = await erase({ confirm: again }, { inputResponses: { approve: { action: 'accept', content: { delete: true } } } })
  assert.equal(gone.structuredContent.deleted, true)
  assert.deepEqual([seen.at(-1).method, seen.at(-1).path], ['DELETE', '/api/v1/issues/300'])
  await m.stop()
})
rmSync(smoke, { recursive: true })

// ---------------------------------------------------------------------------------------------------- limits
await scenario('A burst of calls is cut at the limit, and the refusal says how long to wait', async () => {
  const r = start('good')
  await r.open()
  const burst = await Promise.all(Array.from({ length: 121 }, () => r.call('taiga_me')))
  assert.equal(burst.filter((result) => result.error).length, 1)
  assert.match(burst.find((result) => result.error).error, /Too many calls: this server runs at most 120 tools a minute\. Wait \d+ seconds and call again\./)
  await r.stop()
})
await scenario('Every answer that is data said the same as text and as structured content', async () => {
  assert.ok(structured > 150, String(structured))
})
await scenario('package.json and server.json name the same server, the same version and the same variables', async () => {
  const read = (name) => JSON.parse(readFileSync(name, 'utf8'))
  const [pkg, registry] = [read('package.json'), read('server.json')]
  assert.equal(registry.name, pkg.mcpName)
  assert.deepEqual([registry.version, registry.packages[0].version, registry.packages[0].identifier], [pkg.version, pkg.version, pkg.name])
  assert.deepEqual(registry.packages[0].environmentVariables.map((v) => [v.name, v.isRequired, v.isSecret]), [['TAIGA_URL', true, false], ['TAIGA_TOKEN', true, true], ['TAIGA_WRITE', false, false], ['TAIGA_DELETE', false, false]])
  // The version the server says it is, in both openings of the protocol.
  assert.equal(opened.serverInfo.version, pkg.version)
})
await scenario('docs/TESTING.md lists exactly these scenarios, in this order', async () => {
  const listed = [...readFileSync('docs/TESTING.md', 'utf8').matchAll(/^\| S(\d+) \| (.+?) \|/gm)].map((row) => row[2])
  assert.deepEqual(listed, [...done, 'docs/TESTING.md lists exactly these scenarios, in this order'])
})
fake.close()
console.log(`ok: ${done.length} scenarios, 10 tools read-only, 7 more with TAIGA_WRITE=1, 1 more with TAIGA_DELETE=1`)
