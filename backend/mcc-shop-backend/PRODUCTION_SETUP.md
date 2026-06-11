# MCC Shop Production Setup

The backend is ready for production with:

- PostgreSQL for durable product/order/user data.
- Vercel Blob for durable product image uploads. If Blob is not configured,
  product images under 2MB are stored inline in Postgres.
- Local SQLite still available for development.

## Required Vercel env vars

Set these on the backend Vercel project:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
JWT_SECRET=replace_with_a_long_random_secret
STAFF_PASSWORD=replace_with_a_secure_admin_password
NODE_ENV=production
```

Optional:

```text
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_token
ADMIN_PASSWORD=separate_admin_password
RIDER_PASSWORD=separate_rider_password
GEMINI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYSTACK_SECRET_KEY=
```

## Database commands

Local SQLite:

```bash
npm run db:setup
```

Production env preflight:

```bash
npm run check:prod-env
```

Production Postgres:

```bash
npm run build:prod
npm run db:push:prod
npm run db:seed:prod
```

## Deploy order

1. Create a hosted Postgres database, for example Supabase or Neon.
2. Add the production `DATABASE_URL` to the backend Vercel project.
3. Optionally create/connect Vercel Blob and add `BLOB_READ_WRITE_TOKEN`.
4. Add `JWT_SECRET` and `STAFF_PASSWORD` or `ADMIN_PASSWORD`.
5. Run `npm run check:prod-env`.
6. Deploy the backend project.
7. Deploy the static frontend project.
8. Test admin login, product upload, image edit, and storefront display.
