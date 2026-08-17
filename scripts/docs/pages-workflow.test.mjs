import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { parse } from 'yaml'

const workflowPath = resolve('.github/workflows/docs-pages.yml')

describe('GitHub Pages workflow', () => {
  it('builds pull requests but deploys only main pushes or manual runs', async () => {
    const source = await readFile(workflowPath, 'utf8')
    const workflow = parse(source)

    assert.ok(Object.hasOwn(workflow.on, 'pull_request'))
    assert.deepEqual(workflow.on.push.branches, ['main'])
    assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'))
    assert.deepEqual(workflow.permissions, { contents: 'read' })
    assert.equal(workflow.jobs.build.permissions.contents, 'read')
    assert.match(workflow.jobs.deploy.if, /workflow_dispatch/)
    assert.match(workflow.jobs.deploy.if, /refs\/heads\/main/)
  })

  it('uses a Pages artifact, isolated deploy permissions, and concurrency protection', async () => {
    const source = await readFile(workflowPath, 'utf8')
    const workflow = parse(source)
    const buildUses = workflow.jobs.build.steps.map((step) => step.uses).filter(Boolean)
    const deployUses = workflow.jobs.deploy.steps.map((step) => step.uses).filter(Boolean)

    assert.ok(buildUses.some((value) => value.startsWith('actions/upload-pages-artifact@')))
    assert.ok(deployUses.some((value) => value.startsWith('actions/deploy-pages@')))
    assert.deepEqual(workflow.jobs.deploy.permissions, { pages: 'write', 'id-token': 'write' })
    assert.equal(workflow.jobs.deploy.environment.name, 'github-pages')
    assert.ok(workflow.concurrency.group)
    assert.equal(workflow.concurrency['cancel-in-progress'], true)
    assert.match(source, /KARKATA_DOCS_BASE:\s*\/karkata\//)
    assert.doesNotMatch(source, /gh-pages|git\s+push/i)
  })
})
