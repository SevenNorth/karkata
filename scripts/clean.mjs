import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

for (const packageName of ['core', 'openai', 'javascript']) {
  await rm(resolve('packages', packageName, 'dist'), { recursive: true, force: true })
  await rm(resolve('packages', packageName, 'tsconfig.tsbuildinfo'), { force: true })
}

