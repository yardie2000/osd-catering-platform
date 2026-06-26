# OSD Catering Platform V5.2 - Installation & Deployment

## Local development

```bash
npm install
npm run dev
```

The development server runs on `http://localhost:3000`.

## Local production check

```bash
npm run type-check
npm run lint
npm test
npm run build
npm run start
```

## Required environment

Create `.env.local` for local development:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Do not commit real production credentials.

## Docker image

GitHub Actions builds and publishes:

```text
ghcr.io/yardie2000/osd-catering-platform:latest
ghcr.io/yardie2000/osd-catering-platform:<git-sha>
```

The workflow is `.github/workflows/docker-publish.yml`.

## Synology deployment

Synology Container Manager should use [docker-compose.synology.yml](docker-compose.synology.yml).

The app service pulls:

```text
ghcr.io/yardie2000/osd-catering-platform:latest
```

Watchtower checks for a new image and restarts the app container automatically.

Before using the V5.2 MouseClick product-demand review import, apply this migration
to the live Supabase database:

```text
supabase/migrations/20260626000001_imported_event_orders.sql
```

## Manual Synology fallback

If Watchtower does not update the container:

1. Open Synology DSM.
2. Open Container Manager.
3. Check the `Image` tab for `ghcr.io/yardie2000/osd-catering-platform:latest`.
4. Check the `osd-watchtower` logs.
5. Restart or recreate the `osd-catering` container from the latest image.

## Database

Supabase schema changes live in `supabase/migrations/`.

Migration rules:

- Use additive migrations.
- Do not delete production data without a separate backup and approval.
- Live Supabase schema is the runtime source of truth.
- Repository migrations document expected structure and future setup.
