import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

const host = '127.0.0.1'
const port = Number(process.env.KARKATA_DOCS_PORT ?? 4173)
const baseURL = `http://${host}:${port}/karkata/`
const screenshotRoot = resolve('coverage/docs-qa')
const edgePath = process.env.KARKATA_BROWSER_PATH
  ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

await mkdir(screenshotRoot, { recursive: true })
const preview = startPreview()
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({ executablePath: edgePath, headless: true })
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  const externalRequests = []
  const failedResponses = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location()
      errors.push(`console: ${message.text()} at ${location.url || 'unknown'}:${location.lineNumber ?? 0}`)
    }
  })
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== new URL(baseURL).origin && !['data:', 'blob:'].includes(url.protocol)) {
      externalRequests.push(request.url())
    }
  })

  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.locator('karkata-panel').waitFor()
  await assertLayout(page, 'desktop')
  await assertWideHomeLayout(page)

  const panel = page.locator('karkata-panel')
  const composer = panel.locator('textarea')
  await composer.fill('Check order 1042')
  await panel.getByRole('button', { name: '发送' }).click()
  const streaming = panel.locator('[data-content-status="streaming"]')
  await streaming.waitFor()
  const animationName = await streaming.evaluate((element) => getComputedStyle(element, '::after').animationName)
  assert.equal(animationName, 'none', 'streaming cursor must respect reduced motion')
  await panel.getByRole('button', { name: '停止' }).click()
  await panel.locator('[data-content-status="incomplete"]').waitFor()

  await page.getByRole('button', { name: '错误恢复' }).click()
  await composer.fill('Check order 1042')
  await panel.getByRole('button', { name: '发送' }).click()
  await panel.getByRole('button', { name: '重试' }).waitFor()
  await panel.getByRole('button', { name: '重试' }).click()
  await panel.getByPlaceholder('回答当前问题').waitFor()
  await panel.getByPlaceholder('回答当前问题').fill('Continue')
  await panel.getByRole('button', { name: '发送' }).click()
  await panel.getByText('订单 1042 已安排在周五配送到 Market Street 18 号。').waitFor()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: resolve(screenshotRoot, 'home-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('karkata-panel').waitFor()
  await assertLayout(page, 'mobile')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: resolve(screenshotRoot, 'home-mobile.png'), fullPage: true })

  await page.goto(`${baseURL}en/`, { waitUntil: 'networkidle' })
  await page.locator('karkata-panel').waitFor()
  await page.locator('karkata-panel').getByRole('button', { name: 'Send' }).waitFor()
  await assertLayout(page, 'English mobile')

  assert.deepEqual(externalRequests, [], `unexpected external requests: ${externalRequests.join(', ')}`)
  assert.deepEqual(failedResponses, [], `failed resources: ${failedResponses.join(', ')}`)
  assert.deepEqual(errors, [], `browser errors: ${errors.join(', ')}`)
  await context.close()
  process.stdout.write(`Documentation browser smoke passed at ${baseURL}\n`)
} finally {
  await browser?.close()
  preview.kill()
}

function startPreview() {
  return spawn(process.execPath, [
    resolve('node_modules/vitepress/bin/vitepress.js'),
    'preview',
    resolve('website'),
    '--host', host,
    '--port', String(port),
  ], {
    env: { ...process.env, KARKATA_DOCS_BASE: '/karkata/' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

async function waitForPreview() {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) throw new Error(`VitePress preview exited with ${preview.exitCode}`)
    try {
      const response = await fetch(baseURL)
      if (response.ok) return
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error('Timed out waiting for VitePress preview')
}

async function assertLayout(page, label) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1')?.textContent,
    panelHeight: document.querySelector('karkata-panel')?.getBoundingClientRect().height ?? 0,
  }))
  assert.equal(metrics.scrollWidth, metrics.clientWidth, `${label}: horizontal overflow`)
  assert.equal(metrics.title, 'Karkata', `${label}: product heading`)
  assert.ok(metrics.panelHeight >= 400, `${label}: demo panel height`)
}

async function assertWideHomeLayout(page) {
  const metrics = await page.locator('.VPPage').evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      width: bounds.width,
      leftInset: bounds.left,
      rightInset: window.innerWidth - bounds.right,
    }
  })
  assert.ok(metrics.width <= 1200, `wide desktop: home content is ${metrics.width}px wide`)
  assert.ok(
    Math.abs(metrics.leftInset - metrics.rightInset) <= 1,
    `wide desktop: home content is not centered (${metrics.leftInset}px / ${metrics.rightInset}px)`,
  )
}
