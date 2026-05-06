# Oracle Staging Deployment

This staging shape keeps Vercel as the public Next.js frontend and runs the always-on services on an Oracle Cloud VM:

- Postgres with TLS on port 5432
- FastAPI backend on the Docker network
- BrightData FastMCP as a warm local service
- Entity pipeline worker as a long-running container
- Redis and FalkorDB as supporting services

Vercel reads Postgres through `DATABASE_URL`. Do not expose database URLs through `NEXT_PUBLIC_*`.

## 1. Create the VM

Use an Ubuntu Oracle Cloud Compute instance with enough disk for the local Postgres clone. Open these Oracle network ingress rules:

- TCP 22 from your IP for SSH
- TCP 5432 from the narrowest practical source range for Vercel staging database access

The VM firewall is configured by `scripts/oracle/bootstrap-vm.sh`, but Oracle VCN/security-list ingress rules are still required.

## 2. Bootstrap the VM

```bash
bash apps/signal-noise-app/scripts/oracle/bootstrap-vm.sh
```

Log out and back in after the script so Docker group membership applies.

## 3. Configure secrets

```bash
cd apps/signal-noise-app
cp .env.oracle.example .env.oracle
openssl rand -base64 36
```

Fill at least:

- `POSTGRES_PASSWORD`
- `FALKORDB_PASSWORD`
- `BRIGHTDATA_API_TOKEN`
- LLM keys needed by the pipeline

## 4. Start the Oracle services

```bash
docker compose -f docker-compose.oracle.yml --env-file .env.oracle up -d --build
docker compose -f docker-compose.oracle.yml --env-file .env.oracle ps
```

## 5. Clone local Postgres into Oracle

Run this from the machine that can access the working local socket database:

```bash
cd apps/signal-noise-app
bash scripts/oracle/restore-local-postgres.sh
```

If restoring from another source, pass:

```bash
SOURCE_DATABASE_URL='postgresql://user:password@host:5432/signal_noise_app' bash scripts/oracle/restore-local-postgres.sh
```

## 6. Point Vercel at Oracle Postgres

Set Vercel Preview/staging `DATABASE_URL` to:

```text
postgresql://panther_staging:<password>@<oracle-public-host>:5432/signal_noise_app?sslmode=require
```

Set `PG_POOL_MAX=5` for Vercel. `DATABASE_URL` is the source of truth for this staging environment.

Use:

```bash
vercel env pull --environment=preview .env.preview.local
vercel env run -e preview -- npm run env:check:pipeline
```

## 7. Verify staging

```bash
curl -fsS https://panther-chat.vercel.app/api/home/metrics
curl -fsS https://panther-chat.vercel.app/api/auth/get-session
```

Expected database counts after restore:

- `rfp_opportunities_unified`: 29
- `canonical_entities`: 3332
- `entity_dossiers`: 1496
- `graphiti_dossier_ingestions`: 25984
- `graphiti_materialized_opportunities`: 809

## Operational Notes

Keep `BACKEND_PUBLIC_BIND=127.0.0.1` unless Vercel must call the Python FastAPI backend directly. If it must be public, put it behind HTTPS and an auth gate before setting `BACKEND_PUBLIC_BIND=0.0.0.0`.

Take Oracle boot/block volume backups after the first verified restore, and keep the local dump created by `restore-local-postgres.sh` until staging has been accepted.
