// Registers the resolver hook (tests/hooks.mjs) for `node --test`.
//   node --import ./tests/register.mjs --test tests/calc.test.ts
import { register } from 'node:module'
register('./hooks.mjs', import.meta.url)
