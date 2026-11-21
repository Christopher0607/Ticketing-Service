# Setlist

Setlist is a Malaysia-focused secondary marketplace for live event tickets. Sellers list tickets they already hold and set their price. Buyers see the service fee before payment. The marketplace charges 3% to each side by default, with independently adjustable rates and a snapshot on every order.

## Run locally

Use Node.js 24. You can use your own PostgreSQL 16+ database or start the embedded local database as a regular, non-root user.

```sh
npm ci
cp .env.example .env.local
npm run db:local
```

In a second terminal:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). These accounts use the password `SetlistDemo2027!` and are only created by the local seed command.

| Account | Email |
| --- | --- |
| Buyer | `buyer@example.test` |
| Seller | `seller@example.test` |
| Administrator | `admin@example.test` |

Demo events are fictional, with illustrative photography. The checkout records a simulated payment. To run the inventory reconciliation job locally:

```sh
curl -fsS -X POST http://localhost:3000/api/jobs/reconcile \
  -H 'Authorization: Bearer local-demo-reconcile'
```

## Verification

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite expects the seeded demo server and database. It changes test records and removes them when complete. Use a dedicated local database for automated tests. Set `CHROMIUM_PATH` to use an existing Chromium installation.

## Deploying on a VPS or with Supabase

The application needs a Node.js host even when PostgreSQL is on Supabase. On a VPS, you can run the included Docker image or use `npm ci && npm run build && npm start` behind an HTTPS reverse proxy. Set the proxy to overwrite forwarded host, protocol and `X-Real-IP` headers. Give the app a dedicated database, keep its credentials server-side, and configure backups. With Supabase, use a direct or session-pooled PostgreSQL connection from the server, with TLS and the appropriate network connectivity for your host. The application uses PostgreSQL transactions and SQL migrations directly through `pg`.

Set the production variables listed in [.env.example](.env.example). Run `npm run db:migrate` as a release task, then provision your administrator with `npm run db:admin`. Remove the bootstrap password from the deployment environment after provisioning. Use a verified Resend sender identity to enable signup verification and account recovery. Add a regular authenticated `POST /api/jobs/reconcile` invocation, such as once a minute, using a random secret of at least 32 characters. Alert on nonzero reconciliation failures and monitor failed webhooks.

## Payments and transfers

Configure an approved Malaysia Stripe Connect account that supports separate charges and transfers with the platform bearing payment fees and loss liability. Confirm with Stripe that it accepts the intended ticket resale business and seller account types before operating. Keep sandbox and live credentials, webhooks and databases separate.

1. Set `PAYMENT_MODE=stripe`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Stripe Checkout accepts cards. Set `STRIPE_ENABLE_FPX=true` when Stripe enables FPX for your platform.
2. Subscribe the platform destination `POST /api/stripe/webhook` to `payment_intent.succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created` and `charge.dispute.closed`.
3. Configure a connected-account webhook at `POST /api/stripe/connect` for `account.updated` and set its independent signing secret in `STRIPE_CONNECT_WEBHOOK_SECRET`. Sellers must complete onboarding and have active transfers and payouts before their listings can be purchased.
4. Publish only events whose original ticket terms permit the intended resale and transfer. Approve sellers and review listing proof. The seller transfers through the original provider and records the transfer in Setlist.
5. An administrator can approve refunds or settle the seller’s proceeds after receipt confirmation and the 24-hour post-start window. Support may confirm a delivered order from documented evidence after that same window. Settlements are Stripe transfers to the connected account. The provider’s own schedule controls bank payouts.

The administration interface supports pre-settlement refunds. Handle post-settlement refunds, late chargebacks and transfer reversals in the Stripe Dashboard and keep the provider records for reconciliation. Use Stripe sandbox before enabling live transactions, including an FPX payment and refund, a seller onboarding, and an actual sandbox transfer. Production operators should publish their terms, privacy notice, seller settlement policy and support contacts for their business.

The image fixtures use [Unsplash](https://unsplash.com/license) photos. Manrope and Space Grotesk are distributed under the [SIL Open Font License](public/fonts/manrope-OFL.txt).

Set `SUPPORT_EMAIL`, `TERMS_URL` and `PRIVACY_URL` to display your support channel and policies in the storefront.

For a signed webhook regression test using the locally seeded database and no Stripe network calls, run the built server separately:

```sh
PAYMENT_MODE=stripe APP_URL=http://localhost:3001 \
STRIPE_SECRET_KEY=sk_test_fixture STRIPE_WEBHOOK_SECRET=whsec_local_fixture \
npm run start -- --port 3001
```

Then run:

```sh
STRIPE_SECRET_KEY=sk_test_fixture STRIPE_WEBHOOK_SECRET=whsec_local_fixture npm run test:webhook
```
