// Read-only check (anon key, same access the browser app uses): do the V4.2
// columns recipes.production_loss_pct / yield_pct exist yet?
//   node audit/verify_migration.cjs
const { readFileSync } = require('node:fs')

const env = readFileSync('D:/Downloads/files/catering-platform-v4_1/.env.local', 'utf8')
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/) || [])[1]?.trim()
const anon = (env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/) || [])[1]?.trim()

async function main() {
  const endpoint = `${url}/rest/v1/recipes?select=id,production_loss_pct,yield_pct&limit=1`
  const res = await fetch(endpoint, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } })
  const body = await res.text()
  if (res.ok) {
    console.log('✅ columns EXIST — migration applied. Sample row:')
    console.log('   ' + body)
  } else {
    console.log(`❌ columns NOT present yet (HTTP ${res.status}).`)
    console.log('   ' + body.slice(0, 300))
  }
}
main().catch((e) => console.log('connection error:', e.message))
