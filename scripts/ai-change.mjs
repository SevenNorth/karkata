import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workflowRoot = resolve(root, 'ai-workflows')
const templatesRoot = resolve(workflowRoot, 'templates')
const activeRoot = resolve(workflowRoot, 'changes', 'active')
const archiveRoot = resolve(workflowRoot, 'changes', 'archive')
const types = new Set(['feature', 'bugfix', 'refactor'])
const statuses = ['draft', 'approved', 'implementing', 'completed']
const transitions = { draft: 'approved', approved: 'implementing', implementing: 'completed' }
const files = ['_meta.json', 'proposal.md', 'design.md', 'tasks.md', 'progress.md']
const headings = {
  'proposal.md': ['## 背景', '## 目标', '## 范围', '## 非目标', '## 验收标准', '## 风险'],
  'design.md': ['## 现状分析', '## 方案', '## 影响范围', '## Runtime 契约', '## 兼容性与迁移', '## TDD 与验证方案'],
  'tasks.md': ['## 任务', '## TDD 记录', '## 验证记录'],
  'progress.md': ['## 当前状态', '## 已修改文件', '## 关键决策', '## 验证记录', '## 下一步'],
}

const out = (message = '') => process.stdout.write(`${message}\n`)
const fail = (message) => { console.error(`错误：${message}`); process.exitCode = 1 }

function usage() {
  out(`用法：
  npm run ai:change:new -- <change-id> <feature|bugfix|refactor> [标题]
  npm run ai:change:validate -- <change-id|all>
  npm run ai:change:status -- <change-id> <approved|implementing|completed>
  npm run ai:change:revise -- <change-id>
  npm run ai:change:list
  npm run ai:change:resume -- <change-id>
  npm run ai:change:archive -- <change-id>`)
}

function assertId(id) {
  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('change-id 必须是 kebab-case')
}
function activePath(id) { assertId(id); return resolve(activeRoot, id) }
function branch() {
  try { return execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { return '' }
}
function metadata(directory) {
  try { return JSON.parse(readFileSync(resolve(directory, '_meta.json'), 'utf8')) }
  catch (error) { throw new Error(`无法读取元数据：${error.message}`) }
}
function render(filename, values) {
  let content = readFileSync(resolve(templatesRoot, filename), 'utf8')
  for (const [key, value] of Object.entries(values)) content = content.replaceAll(`{{${key}}}`, value)
  return content
}
function taskProgress(content) {
  const tasks = [...content.matchAll(/^- \[([ x])\] (.+)$/gim)]
  return { completed: tasks.filter((task) => task[1].toLowerCase() === 'x').length, total: tasks.length, next: tasks.find((task) => task[1] === ' ')?.[2] ?? '' }
}
function ids() {
  mkdirSync(activeRoot, { recursive: true })
  return readdirSync(activeRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name).sort()
}

function create([id, type, ...titleParts]) {
  assertId(id)
  if (!types.has(type)) throw new Error('变更类型必须是 feature、bugfix 或 refactor')
  const directory = activePath(id)
  if (existsSync(directory)) throw new Error(`变更已存在：${id}`)
  const now = new Date().toISOString()
  const title = titleParts.join(' ').trim() || id
  mkdirSync(directory, { recursive: true })
  writeFileSync(resolve(directory, '_meta.json'), `${JSON.stringify({ id, title, type, status: 'draft', branch: branch(), createdAt: now, updatedAt: now }, null, 2)}\n`)
  for (const filename of ['proposal.md', 'design.md', 'tasks.md', 'progress.md']) writeFileSync(resolve(directory, filename), render(filename, { CHANGE_ID: id, CHANGE_TITLE: title, CHANGE_TYPE: type }))
  out(`已创建：ai-workflows/changes/active/${id}`)
}

function validateDirectory(directory) {
  const issues = []
  for (const filename of files) if (!existsSync(resolve(directory, filename))) issues.push(`缺少文件 ${filename}`)
  if (issues.length) return issues
  const meta = metadata(directory)
  if (meta.id !== directory.split(/[\\/]/).at(-1)) issues.push('_meta.json 的 id 与目录名不一致')
  if (!types.has(meta.type)) issues.push('_meta.json 的 type 无效')
  if (!statuses.includes(meta.status)) issues.push('_meta.json 的 status 无效')
  if (!meta.title?.trim()) issues.push('_meta.json 缺少 title')
  const docs = {}
  for (const [filename, required] of Object.entries(headings)) {
    const content = readFileSync(resolve(directory, filename), 'utf8'); docs[filename] = content
    for (const heading of required) if (!content.includes(heading)) issues.push(`${filename} 缺少章节：${heading}`)
  }
  if (meta.status !== 'draft') for (const [filename, content] of Object.entries(docs)) if (/<!--[\s\S]*?-->/.test(content)) issues.push(`${filename} 仍包含模板占位注释`)
  if (meta.status === 'completed') for (const filename of ['proposal.md', 'tasks.md']) if (/^- \[ \]/m.test(docs[filename])) issues.push(`${filename} 仍有未完成复选项`)
  return issues
}
function validateOne(id, silent = false) {
  const directory = activePath(id)
  if (!existsSync(directory)) throw new Error(`活动变更不存在：${id}`)
  const issues = validateDirectory(directory)
  if (issues.length) { if (!silent) { out(`校验失败：${id}`); for (const issue of issues) out(`- ${issue}`) }; return false }
  if (!silent) out(`校验通过：${id}`)
  return true
}
function validate([target]) {
  if (target === 'all' || target === '--all') { const all = ids(); if (!all.length) return out('没有活动变更'); let valid = true; for (const id of all) valid = validateOne(id) && valid; if (!valid) process.exitCode = 1; return }
  if (!target) throw new Error('请提供 change-id 或 all')
  if (!validateOne(target)) process.exitCode = 1
}

function status([id, next]) {
  const directory = activePath(id)
  if (!existsSync(directory)) throw new Error(`活动变更不存在：${id}`)
  if (!statuses.includes(next) || next === 'draft') throw new Error('目标状态必须是 approved、implementing 或 completed')
  const current = metadata(directory)
  if (transitions[current.status] !== next) throw new Error(`不允许从 ${current.status} 直接流转到 ${next}`)
  const path = resolve(directory, '_meta.json')
  writeFileSync(path, `${JSON.stringify({ ...current, status: next, updatedAt: new Date().toISOString() }, null, 2)}\n`)
  if (!validateOne(id, true)) { writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`); throw new Error(`流转到 ${next} 后校验失败，已恢复为 ${current.status}`) }
  out(`状态已更新：${id} -> ${next}`)
}
function revise([id]) {
  const directory = activePath(id); if (!existsSync(directory)) throw new Error(`活动变更不存在：${id}`)
  const current = metadata(directory); if (!['approved', 'implementing'].includes(current.status)) throw new Error('只有 approved 或 implementing 可以退回修订')
  const next = { ...current, status: 'draft', revision: (current.revision ?? 0) + 1, updatedAt: new Date().toISOString() }
  writeFileSync(resolve(directory, '_meta.json'), `${JSON.stringify(next, null, 2)}\n`); out(`已退回修订：${id} -> draft（第 ${next.revision} 次）`)
}
function list() {
  const all = ids(); if (!all.length) return out('没有活动变更')
  out('CHANGE ID\tSTATUS\tPROGRESS\tBRANCH')
  for (const id of all) { const directory = activePath(id); const meta = metadata(directory); const progress = taskProgress(readFileSync(resolve(directory, 'tasks.md'), 'utf8')); out(`${id}\t${meta.status}\t${progress.completed}/${progress.total}\t${meta.branch || '-'}`) }
}
function resume([id]) {
  const directory = activePath(id); if (!existsSync(directory)) throw new Error(`活动变更不存在：${id}`)
  const meta = metadata(directory); const progress = taskProgress(readFileSync(resolve(directory, 'tasks.md'), 'utf8')); const currentBranch = branch()
  let next = progress.next || '核对 tasks.md 与 progress.md'; if (meta.status === 'draft') next = '完善并提交方案供用户审查'; if (meta.status === 'approved') next = '核对工作区后进入 implementing'; if (meta.status === 'completed') next = '确认验证记录后归档'
  out(`变更：${meta.id}\n标题：${meta.title}\n状态：${meta.status}\n任务：${progress.completed}/${progress.total}\n记录分支：${meta.branch || '-'}\n当前分支：${currentBranch || '-'}\n下一步：${next}`)
  if (meta.branch && currentBranch && meta.branch !== currentBranch) out('警告：当前分支与变更记录不一致')
  out('恢复前读取：'); for (const filename of ['proposal.md', 'design.md', 'tasks.md', 'progress.md']) out(`- ai-workflows/changes/active/${id}/${filename}`); out('- git status --short\n- git diff')
}
function archive([id]) {
  const source = activePath(id); if (!existsSync(source)) throw new Error(`活动变更不存在：${id}`)
  const meta = metadata(source); if (meta.status !== 'completed') throw new Error('只有 completed 状态可以归档'); if (!validateOne(id, true)) throw new Error('变更校验失败，不能归档')
  const destination = resolve(archiveRoot, String(new Date().getFullYear()), id); if (existsSync(destination)) throw new Error(`归档目标已存在：${destination}`)
  const now = new Date().toISOString(); writeFileSync(resolve(source, '_meta.json'), `${JSON.stringify({ ...meta, status: 'archived', archivedAt: now, updatedAt: now }, null, 2)}\n`)
  mkdirSync(dirname(destination), { recursive: true }); renameSync(source, destination); out(`已归档：${destination.replace(`${root}\\`, '')}`)
}

const [command, ...args] = process.argv.slice(2)
try {
  if (command === 'new') create(args)
  else if (command === 'validate') validate(args)
  else if (command === 'status') status(args)
  else if (command === 'revise') revise(args)
  else if (command === 'list') list()
  else if (command === 'resume') resume(args)
  else if (command === 'archive') archive(args)
  else usage()
} catch (error) { fail(error instanceof Error ? error.message : String(error)) }
