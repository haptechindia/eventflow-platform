# EventFlow platform upgrade setup

This branch adds the database and server-side foundation for the requested platform features. It does not switch the live site until the branch is merged and the Supabase migration/functions are deployed.

## 1. Apply the database migration

Run `supabase/migrations/20261119_eventflow_platform_upgrade.sql` in the Supabase SQL Editor after the existing `supabase/schema.sql`.

The migration is additive. It adds organisation/event branding fields, optional 5% platform-fee settings, Cashfree order records, event-level helper assignments, a WhatsApp notification outbox and a privacy-limited bib lookup RPC.

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

This branch is a backend foundation, not a completed production rollout. The existing React registration form and dashboard still need the payment button, brand editor/uploads, QR/certificate branding, volunteer assignment UI, participant bib lookup UI, notification controls, opt-in checkbox and PWA install prompt wired to these additions. Keep Cashfree in sandbox until all flows and webhook signatures are verified.
