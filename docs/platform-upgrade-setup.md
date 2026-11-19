# EventFlow platform upgrade setup

This branch adds the database and server-side foundation for the requested platform features. It does not switch the live site until the branch is merged and the Supabase migration/functions are deployed.

## 1. Apply the database migrations

For an existing EventFlow database, do **not** re-run the base `supabase/schema.sql`. Apply the additive migrations in this order:

1. `20261119_eventflow_platform_upgrade.sql`
2. `20261119_eventflow_event_permissions.sql`
3. `20261119_eventflow_security_and_permissions_hardening.sql`
4. `20261119_eventflow_whatsapp_optin_guard.sql`
5. `20261119_eventflow_multi_organisation_team_scope.sql`

These migrations preserve existing organisation, event and registration rows. They add organisation/event branding fields, Cashfree order records, event-level helper assignments, a WhatsApp notification outbox and a limited bib lookup RPC. The multi-organisation dashboard lets one login own or join multiple workspaces, switch the active organisation, and create additional organisations. Team invitations now include the selected organisation ID and are authorized against that organisation; the legacy RPC that silently selected the oldest workspace is removed. Cashfree is **disabled by default** on every event; enable it only after server secrets are configured and sandbox checkout/webhook tests pass.

## 2. Cashfree central gateway

Cashfree credentials belong only in Supabase Edge Function secrets, never in Vercel `VITE_*` variables or browser code.

Deploy:
- `cashfree-create-order`
- `cashfree-webhook`

Set these Supabase secrets:
- `CASHFREE_APP_ID`
- `CASHFREE_SECRET_KEY`
- `CASHFREE_ENV=sandbox` initially; change to `production` only after Cashfree live approval
- `SITE_URL=https://YOUR-VERCEL-DOMAIN`
- Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions.

Configure the Cashfree webhook URL as:
`https://YOUR-PROJECT-REF.supabase.co/functions/v1/cashfree-webhook`

Subscribe to payment success events. The handler verifies Cashfree's HMAC signature using the raw request body and only confirms payments server-side. Test success, failure, duplicate webhook delivery and amount mismatch in sandbox.

The order amount is calculated from the stored registration amount. If the event has `platform_fee_enabled=true`, the configured percentage (maximum 5%) is added to the participant checkout total. It defaults to off. Cashfree's own processing fee is separate and is not included in this setting.

## 3. WhatsApp Cloud API

Deploy `dispatch-whatsapp` and set:
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_VERSION=v27.0`
- `NOTIFICATION_WORKER_SECRET` to a long random secret.

Create and get Meta approval for WhatsApp utility templates named:
- `eventflow_payment_confirmed` with 5 body text parameters: participant, event, bib, date, venue.
- `eventflow_event_update` with 6 body text parameters: participant, event, date, time, venue, city.

Invoke the dispatcher from a trusted scheduler/cron with header `x-worker-secret: YOUR_SECRET`. Do not expose this secret in the browser. WhatsApp delivery requires participant opt-in and an approved template; free-form messages are not guaranteed to be deliverable outside the customer-service window.

The migration queues event date/time/location change notifications and successful Cashfree/bib confirmation messages only for registrations with WhatsApp opt-in. A separate authenticated organiser action still needs to be wired into the dashboard for bulk custom announcements and manual-payment status messages.

## 4. Branding and participant QR/certificates

The migration adds storage URL fields for organisation logo, event logo, cover image and sponsor logos, plus brand colours and a confirmation message. Upload assets to a public event-assets bucket with strict file size/type restrictions, then save their URLs to the corresponding organisation/event rows. QR pass and certificate rendering must consume those fields in the React UI.

## 5. Volunteers and helpers

Use `event_assignments` to assign a registered EventFlow account to an individual event. Permissions are JSON booleans:
- `view_participants`
- `approve_payments`
- `send_messages`
- `check_in`

Only organisation owners/admins should manage assignments. The dashboard must check these permissions before showing each action. Do not grant a volunteer organisation-wide admin rights.

## 6. Bib lookup

Call `supabase.rpc('lookup_participant_bib', { p_event_slug, p_full_name, p_phone })`. It requires exact name and registered mobile number and returns only the name, category, bib and payment/confirmation status. Add a public lookup form to the event page.

## 7. Mobile installation

The PWA manifest, icon and service worker are included. Add the manifest link to `index.html` and register `/sw.js` from the React entry point. Serve the site over HTTPS (Vercel does). The current worker provides a network-first shell fallback; it does not cache private participant data or payment responses.

## Important before production

The five additive migrations have been applied to the connected EventFlow Supabase project and verified. Existing counts remain 1 organisation, 1 member, 1 event and 1 registration; the new payment/assignment/outbox tables are empty. The Edge Functions have **not** been deployed because required Cashfree and WhatsApp secrets have not yet been configured, and the function code still needs final hardening and sandbox validation. WhatsApp outbox creation now requires both event-level WhatsApp enablement and participant opt-in.

This branch is a backend foundation, not a completed production rollout. The existing React registration form and dashboard still need the payment button, brand editor/uploads, QR/certificate branding, volunteer assignment UI, participant bib lookup UI, notification controls, opt-in checkbox and PWA install prompt wired to these additions. Keep Cashfree in sandbox until all flows and webhook signatures are verified.
