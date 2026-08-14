import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..', '..')
const fixtureRoot = join(scriptDirectory, 'fixtures')
const packageNames = ['core', 'openai-compatible', 'javascript', 'ui']
const requiredFiles = ['LICENSE', 'README.en.md', 'README.md', 'dist/index.d.ts', 'dist/index.js', 'package.json']

export function assertPackedFiles(packageName, paths) {
  const uniquePaths = [...new Set(paths)].sort()
  for (const required of requiredFiles) {
    if (!uniquePaths.includes(required)) throw new Error(`${packageName} package is missing ${required}`)
  }
  if (packageName === 'ui') {
    for (const required of ['dist/web-component.d.ts', 'dist/web-component.js']) {
      if (!uniquePaths.includes(required)) throw new Error(`${packageName} package is missing ${required}`)
    }
  }
  for (const path of uniquePaths) {
    if (path === 'LICENSE' || path === 'README.md' || path === 'README.en.md' || path === 'package.json') continue
    if (path.startsWith('dist/')) {
      if (/(?:^|\/)\w+\.test\./.test(path)) throw new Error(`${packageName} package contains unexpected file: ${path}`)
      continue
    }
    throw new Error(`${packageName} package contains unexpected file: ${path}`)
  }
}

export async function runPackageSmoke() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'karkata-package-smoke-'))
  const artifactsRoot = join(temporaryRoot, 'artifacts')
  const consumerRoot = join(temporaryRoot, 'consumer')
  try {
    await mkdir(artifactsRoot)
    await mkdir(consumerRoot)
    await runNpm(['run', 'build'], repositoryRoot)

    const packResult = await runNpm([
      'pack', '--workspaces', '--pack-destination', artifactsRoot, '--json',
    ], repositoryRoot, { captureOutput: true })
    const packages = JSON.parse(packResult.stdout)
    assertPackResult(packages)

    const dependencies = {}
    for (const packedPackage of packages) {
      const packageName = packageNames.find((name) => packedPackage.name === `@karkata/${name}`)
      assertPackedFiles(packageName, packedPackage.files.map((file) => file.path))
      dependencies[packedPackage.name] = `file:../artifacts/${packedPackage.filename}`
    }

    await writeFile(join(consumerRoot, 'package.json'), `${JSON.stringify({
      name: 'karkata-package-smoke-consumer',
      private: true,
      type: 'module',
      dependencies,
    }, null, 2)}\n`)
    await writeFile(join(consumerRoot, 'tsconfig.json'), `${JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
      },
      include: ['consumer.ts'],
    }, null, 2)}\n`)
    await copyFile(join(fixtureRoot, 'consumer.ts'), join(consumerRoot, 'consumer.ts'))
    await copyFile(join(fixtureRoot, 'consumer.mjs'), join(consumerRoot, 'consumer.mjs'))

    await runNpm([
      'install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false',
    ], consumerRoot)
    await runNode([join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', consumerRoot], consumerRoot)
    await runNode([join(consumerRoot, 'consumer.mjs')], consumerRoot)
    process.stdout.write(`Package smoke passed for ${packages.length} tarballs.\n`)
  } finally {
    await removeTemporaryRoot(temporaryRoot)
  }
}

function assertPackResult(packages) {
  if (!Array.isArray(packages) || packages.length !== packageNames.length) {
    throw new Error(`Expected ${packageNames.length} packed workspaces`)
  }
  const actualNames = new Set(packages.map((entry) => entry.name))
  for (const packageName of packageNames) {
    if (!actualNames.has(`@karkata/${packageName}`)) throw new Error(`Missing packed workspace: ${packageName}`)
  }
}

async function removeTemporaryRoot(path) {
  const expectedParent = resolve(tmpdir())
  const actualParent = resolve(dirname(path))
  if (actualParent.toLowerCase() !== expectedParent.toLowerCase() || !basename(path).startsWith('karkata-package-smoke-')) {
    throw new Error(`Refusing to remove unexpected path: ${relative(repositoryRoot, path)}`)
  }
  await rm(path, { recursive: true, force: true })
}

function runNpm(args, cwd, options = {}) {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath) return runNode([npmExecPath, ...args], cwd, options)
  return runCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, cwd, options)
}

function runNode(args, cwd, options = {}) {
  return runCommand(process.execPath, args, cwd, options)
}

function runCommand(command, args, cwd, { captureOutput = false } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    if (captureOutput) {
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk) => { stdout += chunk })
      child.stderr.on('data', (chunk) => { stderr += chunk })
    }
    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr })
        return
      }
      const reason = signal ? `signal ${signal}` : `exit code ${code}`
      rejectPromise(new Error(`${basename(command)} failed with ${reason}${stderr ? `\n${stderr.trim()}` : ''}`))
    })
  })
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined
if (invokedPath === import.meta.url) {
  runPackageSmoke().catch((error) => {
    process.stderr.write(`Package smoke failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
