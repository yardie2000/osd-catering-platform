// ESM resolver hook for `node --test` so the test suite can import the TS engine
// with the project's idioms (extensionless relative + "@/" alias) without adding
// ".ts" extensions to source (which the bundler/tsc build forbids).
//   node --import ./tests/hooks.mjs --test tests/calc.test.ts
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url)) // project root

export async function resolve(specifier, context, nextResolve) {
  let spec = specifier
  if (spec.startsWith('@/')) spec = pathToFileURL(path.join(ROOT, spec.slice(2))).href
  try {
    return await nextResolve(spec, context)
  } catch (err) {
    const asPath = spec.startsWith('file:') ? fileURLToPath(spec)
      : context.parentURL ? path.resolve(path.dirname(fileURLToPath(context.parentURL)), spec)
      : null
    if (asPath) {
      for (const cand of [asPath + '.ts', path.join(asPath, 'index.ts'), asPath + '.tsx']) {
        if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true }
      }
    }
    throw err
  }
}
