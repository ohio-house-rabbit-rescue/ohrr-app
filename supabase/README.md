# Supabase

This directory version-controls the OHRR backend so the repo matches the live
Supabase project.

## Migrations

`migrations/20260627052536_hopshop_backend.sql` is the schema described in
`docs/05-backend-and-access-control.md` and the Drive doc `06-hopshop-backend.sql`:
organizations, memberships (owner/admin/staff), the capability catalog + presets,
invite codes (master + worker), the audit log, and the Hop Shop (products +
inventory) gated by Row-Level Security. **It is already applied to the live
project** (and the OHRR org + a one-time master code are already bootstrapped).
The file is idempotent (`create … if not exists`, `on conflict do nothing`), so
re-applying is safe.

To apply a fresh copy elsewhere, paste it into the Supabase SQL editor, or with
the Supabase CLI:

```bash
supabase link --project-ref <PROJECT_REF>   # one-time
supabase db push                            # apply migrations/
```

## TypeScript types

`src/lib/database.types.ts` is the typed schema the app's Supabase client uses.
It is currently **hand-authored to mirror the applied SQL** (the CLI needs the
project ref + an access token, which aren't in the repo). Once those are
available, regenerate it from the live database to stay authoritative:

```bash
supabase link --project-ref <PROJECT_REF>   # one-time, if not already linked
npm run gen:types                            # supabase gen types typescript --linked
```

(see the `gen:types` script in `package.json`; it writes `src/lib/database.types.ts`).

## Environment

The browser client needs, in `.env.local` (gitignored — never commit):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

The `service_role` key and DB password are **server-only** — never put them in
any `VITE_`-prefixed var or in the repo.
