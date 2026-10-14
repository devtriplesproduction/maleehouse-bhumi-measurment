# Production readiness checklist (Malee House)

Target: **controlled production deploy** (internal ERP).  
Last code hardening pass includes auth gateway, public finance RPCs, health checks, wipe guard.

## 1. Environment (Vercel / host)

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server only — never `NEXT_PUBLIC_`) |
| `CRON_SECRET` | Yes in production |
| `NEXT_PUBLIC_SITE_URL` | Strongly recommended |
| `ALLOW_SYSTEM_WIPE` | Must stay **unset** / not `true` |

Verify: `GET /api/health` → `"status":"ok"` (public body is status/latency only; use `?detail=1` + `X-Health-Secret` when `HEALTH_CHECK_SECRET` is set for ops detail).

## 2. Supabase migrations (critical)

Apply in order (or `supabase db push`):

1. `20260724000003_distributed_rate_limiting.sql`
2. `20260731140000_production_hot_indexes.sql`
3. `20260731150000_admin_kpis_and_finance_summary.sql`
4. `20260731160000_sync_auth_claims_role_active.sql`
5. `20260731170000_transition_project_stage_rpc.sql`
6. `20260731180000_public_invoice_receipt_rpcs.sql`
7. `20260731190000_fix_public_and_finance_rpc_enums.sql`
8. `20260731191000_public_share_tokens.sql`

**Status on linked project `MaleeHouse_testing`:** critical RPCs applied and verified via `npm run go-live` (2026-07-31).

Check:

```bash
npm run verify:migrations
# with env:
# NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run verify:migrations
```

## 3. Security

- [ ] Rotate any service_role key that ever lived in git history
- [ ] Debug routes return 404 in production (`/api/test*`, `/api/benchmark`, …)
- [ ] System wipe disabled unless break-glass
- [ ] Public invoice/receipt use `get_public_*` RPCs (no admin client)
- [ ] Users re-login once after claims migration

## 4. Smoke test

```bash
BASE_URL=https://your-domain npm run smoke:prod
```

Manual path:

1. Login (sales) → create lead  
2. Accounts → quotation → invoice → payment  
3. Dispatch / stage transitions to `completed`  
4. Admin dashboard loads  
5. Logout / suspended user blocked  

## 5. Ops

- [ ] Supabase PITR / daily backups on  
- [ ] Uptime monitor on `/api/health`  
- [ ] Vercel crons use `Authorization: Bearer $CRON_SECRET` (or `?cron_secret=`)  
- [ ] Custom SMTP for auth emails (Supabase)

## 6. Post-deploy

- [ ] `npm run smoke:prod` green  
- [ ] No 5xx on health  
- [ ] One full lead→complete project in staging or first prod day  
