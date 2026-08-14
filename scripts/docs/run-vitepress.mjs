import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const command = process.argv[2]
if (!['dev', 'build', 'preview'].includes(command)) {
  throw new TypeError('Expected VitePress command: dev, build, or preview')
}

const defaultBase = command === 'dev' ? '/' : '/karkata/'
const child = spawn(process.execPath, [
  resolve('node_modules/vitepress/bin/vitepress.js'),
  command,
  resolve('website'),
  ...process.argv.slice(3),
], {
  env: {
    ...process.env,
    KARKATA_DOCS_BASE: process.env.KARKATA_DOCS_BASE ?? defaultBase,
  },
  stdio: 'inherit',
  windowsHide: true,
})

child.once('error', (error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
child.once('exit', (code, signal) => {
  if (signal) {
    process.stderr.write(`VitePress stopped by ${signal}.\n`)
    process.exitCode = 1
  } else {
    process.exitCode = code ?? 1
  }
})
