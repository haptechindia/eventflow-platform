# EventFlow Platform — TODO List

> **Last Updated:** 2026-11-19  
> **Branch:** `feat/central-payments-branding-whatsapp-pwa`

---

## 🔴 CRITICAL (Blockers — must fix before Cashfree goes live)

### 1. Add `/payment-return` route to `App.jsx`

**Why:** Cashfree redirects users to `{SITE_URL}/payment-return?order_id=xxx` after checkout completes (success or failure). This route does not exist in the router — users currently land on a **404 page after paying**.

**What to do:**
- Create a `PaymentReturnPage` component that reads `?order_id` from the URL
- Queries `payment_orders` table to determine payment status
- Shows appropriate success/failure message with next steps
- Add `<Route path="/payment-return" element={<PaymentReturnPage />} />` to `App.jsx`

**Files:** `src/App.jsx`

---

### 2. Apply all 6 database migrations to production Supabase

**Why:** The migrations add critical columns (`cashfree_order_id`, `whatsapp_opt_in`, `total_paid`, etc.) and new tables (`payment_orders`, `event_assignments`, `notification_outbox`, `fund_claims`). Without them, any Cashfree or WhatsApp code will throw runtime errors querying non-existent columns.

**What to do:**
1. Open Supabase Dashboard → SQL Editor
2. Apply each migration file **in order** (see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#3-database-migrations))
3. Verify all 8 tables exist after applying

**Files:** `supabase/migrations/*.sql`

---

### 3. Deploy `cashfree-create-order` Edge Function with secrets configured

**Why:** This function creates the Cashfree payment order and returns the `payment_session_id` needed to initialise the Cashfree JS SDK. Without it, no online payment can begin.

**What to do:**
```bash
supabase functions deploy cashfree-create-order
supabase secrets set CASHFREE_APP_ID="..."
supabase secrets set CASHFREE_SECRET_KEY="..."
supabase secrets set CASHFREE_ENV="sandbox"
supabase secrets set SITE_URL="https://eventflow-platform-eta.vercel.app"
```

**Files:** `supabase/functions/cashfree-create-order/`

---

### 4. Deploy `cashfree-webhook` Edge Function with `CASHFREE_SECRET_KEY` secret

**Why:** Cashfree sends payment confirmation via webhook. Without this function deployed, successful payments will never update the `payment_orders` or `registrations` tables — organisers will never see payment confirmations.

**What to do:**
```bash
supabase functions deploy cashfree-webhook
# CASHFREE_SECRET_KEY already set in step 3
```

Also register the webhook URL in the Cashfree dashboard:  
`https://vdfgwpocjacvfqfhctua.supabase.co/functions/v1/cashfree-webhook`

**Files:** `supabase/functions/cashfree-webhook/`

---

### 5. Add `VITE_CASHFREE_MODE` to `.env.example` and Vercel environment variables

**Why:** The Cashfree JS SDK requires this variable to know whether to use sandbox or production mode. Without it, the SDK will not initialise. Currently undocumented — any developer cloning the repo will not know it exists.

**What to do:**
- Add to `.env.example`:  
  ```
  VITE_CASHFREE_MODE=sandbox
  ```
- Add to Vercel: Dashboard → Project Settings → Environment Variables → `VITE_CASHFREE_MODE` = `sandbox` (change to `production` before go-live)

**Files:** `.env.example`, Vercel dashboard

---

## 🟠 HIGH PRIORITY (Functionality gaps)

### 6. Add Cashfree "Pay Online" button to registration form

**Why:** `src/lib/cashfree.js` exports `startCashfreeCheckout(paymentSessionId, returnUrl)` but this function is not called anywhere in the registration form UI. Users cannot initiate Cashfree payment.

**What to do:**
- In the registration form (inside `App.jsx`), add a "Pay Online" button
- On click: call the `cashfree-create-order` Edge Function with `registration_id` and `event_id`
- Receive `payment_session_id` in the response
- Call `startCashfreeCheckout(paymentSessionId, '/payment-return')` from `cashfree.js`

**Files:** `src/App.jsx`, `src/lib/cashfree.js`

---

### 7. Add WhatsApp opt-in checkbox to registration form

**Why:** The `whatsapp_opt_in` boolean column was added to `registrations` in Migration 1, and the `notification_outbox` trigger only queues messages for participants who opted in. Without a form field, no participant will ever receive WhatsApp notifications.

**What to do:**
- Add checkbox: `"I consent to receive WhatsApp updates about this event"`
- Conditionally show it only when `event.whatsapp_updates_enabled === true`
- Pass `whatsapp_opt_in: true/false` to the `register_participant` RPC call

**Files:** `src/App.jsx`

---

### 8. Deploy `dispatch-whatsapp` Edge Function after WhatsApp credentials are ready

**Why:** This function processes the `notification_outbox` queue. Even with outbox rows being written (once migration 4 is applied), nothing will be dispatched until this function is deployed and a cron trigger is configured.

**What to do:**
```bash
supabase functions deploy dispatch-whatsapp
supabase secrets set WHATSAPP_ACCESS_TOKEN="..."
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="..."
supabase secrets set WHATSAPP_GRAPH_VERSION="v19.0"
supabase secrets set NOTIFICATION_WORKER_SECRET="..."
```
Then set up a cron job (pg_cron or external) to call it every 2 minutes. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#8-whatsapp-configuration).

**Files:** `supabase/functions/dispatch-whatsapp/`

---

### 9. Fix code splitting: 912 KB single JS bundle is too large

**Why:** Vite warns on every build. A 912 KB unminified bundle causes poor LCP scores, slow initial loads on mobile, and loads heavy libraries (like `html5-qrcode`) for every user even on the public landing page.

**What to do:**

Add manual chunks to `vite.config.js`:

```js
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-qr': ['qrcode.react', 'html5-qrcode'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
```

Additionally, use `React.lazy()` for route-level code splitting:

```jsx
const CheckInPage = React.lazy(() => import('./pages/CheckIn'))
```

**Files:** `vite.config.js`, `src/App.jsx`

---

## 🟡 MEDIUM PRIORITY (Features not yet built)

### 10. Add `/payment-return` page component (success/failure display)

This is distinct from adding the route (item 1 above). After the route exists, build a polished page that:
- Shows a spinner while checking payment status
- Displays a success message with registration code and bib number on success
- Displays a friendly error message with support contact on failure
- Includes a "View your registration" CTA

**Files:** New file `src/pages/PaymentReturn.jsx`, `src/App.jsx`

---

### 11. Build public bib lookup form on event pages

**Why:** The `lookup_participant_bib(event_slug, full_name, phone)` RPC is defined and enabled in Migration 1 but no public UI calls it. Participants have no way to self-serve look up their bib number.

**What to do:**
- Add a "Find My Bib" section to the event page (`/e/:slug`)
- Form fields: Full Name, Phone Number
- On submit, call the `lookup_participant_bib` RPC
- Display: bib number, check-in status, event date

**Files:** `src/App.jsx`

---

### 12. Build volunteer/helper assignment UI in dashboard

**Why:** The `event_assignments` table (Migration 2) and `has_event_permission` RPC exist, but there is no dashboard screen to assign volunteers or helpers to events.

**What to do:**
- Add "Volunteers" or "Assignments" tab in the event management section
- Form to add an assignment by email, with a permission checkbox grid
- Table showing current assignments with remove button

**Files:** `src/App.jsx`

---

### 13. Build organisation branding editor

**Why:** Migration 1 adds `logo_url`, `brand_primary_color`, and `brand_secondary_color` to both `organizations` and `events`, but no UI exists to upload a logo or select colours.

**What to do:**
- Add "Branding" section to organisation/event settings
- Logo upload → Supabase Storage (requires a new public `event-assets` bucket to be created)
- Hex colour pickers for primary and secondary brand colours

**Files:** `src/App.jsx`, Supabase Storage (new bucket)

---

### 14. Create event-assets storage bucket in Supabase

**Why:** Migration 1 adds image URL columns to `events` and `organizations` but there is no storage bucket to hold these files. The branding editor (item 13) cannot be built without it.

**What to do:**
1. Supabase Dashboard → **Storage** → **New Bucket**
2. Name: `event-assets`
3. Access: **Public** (logos and banners need to be publicly accessible)
4. File size limit: 10 MB
5. Allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`
6. Add RLS storage policy: only org admins can upload; anyone can read

---

## 🟢 LOWER PRIORITY (Improvements)

### 15. Add WhatsApp notification controls to dashboard

Build a dashboard panel to:
- Send a custom WhatsApp announcement to all opted-in participants of an event
- View `notification_outbox` status (queued/sent/failed counts)
- Retry failed notifications

**Files:** `src/App.jsx`

---

### 16. Add PWA install prompt UI

The PWA manifest and service worker are wired. Add a user-friendly "Add to Home Screen" prompt using the `beforeinstallprompt` browser event so users know the app is installable.

**Files:** `src/App.jsx` or `src/main.jsx`

---

### 17. Refactor `App.jsx` into separate component files

**Why:** `src/App.jsx` is currently 424 lines and contains all routes, state, auth logic, and dashboard panels. This will become unmanageable.

**Suggested structure:**
```
src/
  pages/
    Landing.jsx
    EventRegistration.jsx
    PaymentReturn.jsx
    Dashboard.jsx
    CheckIn.jsx
  components/
    ParticipantsTable.jsx
    QRScanner.jsx
    FundClaims.jsx
    TeamManagement.jsx
  hooks/
    useAuth.js
    useWorkspace.js
  App.jsx  (routes only, ~50 lines)
```

**Files:** `src/App.jsx` → split across multiple files

---

### 18. Add CAPTCHA / rate limiting to registration form

**Why:** For high-volume events, the public registration endpoint (`register_participant` RPC + `anon` key) is reachable by anyone. Spam bots could fill up registrations and storage.

**Options:**
- Cloudflare Turnstile (free, recommended — works with Vercel)
- hCaptcha
- Supabase Edge Function rate limiting middleware

**Files:** `src/App.jsx`, possibly a new rate-limiting Edge Function

---

### 19. Add event edit form

Currently, an event cannot be edited after it is created. Add an edit form pre-populated with existing event data, calling a Supabase `UPDATE` on the `events` table.

**Files:** `src/App.jsx`

---

### 20. Add participant refund workflow

Build a UI for organisers to:
- Mark a registration as cancelled
- Record a refund amount and reference
- Trigger a Cashfree payout refund (via Cashfree Refunds API)

**Files:** `src/App.jsx`, possibly a new Edge Function

---

### 21. Add event deletion (with confirmation)

Add a delete button on the event settings panel with a confirmation dialog. Use `ON DELETE CASCADE` already in the schema to clean up registrations.

**Files:** `src/App.jsx`

---

### 22. Add member removal from team

The team management panel allows adding members but not removing them. Add a remove button that calls `DELETE` on `organization_members`.

**Files:** `src/App.jsx`

---

### 23. Add dark mode support

Add a `prefers-color-scheme` media query or a manual toggle, using CSS custom properties already partially defined in `styles.css`.

**Files:** `src/styles.css`, `src/App.jsx`

---

### 24. Write automated tests

Add testing infrastructure:
- **Unit tests:** Vitest + React Testing Library for component logic
- **Integration tests:** Test RPC calls against a Supabase local dev instance (`supabase start`)
- **E2E tests:** Playwright for critical user flows (registration, payment, check-in)

**Files:** `vitest.config.js`, `tests/` directory, `package.json` scripts

---

## ✅ COMPLETED (Do not redo)

- ✅ Public landing page (hero, feature strip, event directory, how-it-works, CTA)
- ✅ Event registration form (UPI/manual payment flow with proof upload)
- ✅ Payment proof upload to private Supabase Storage bucket
- ✅ Organiser sign-up / sign-in (Supabase Auth)
- ✅ Organiser dashboard (participants, check-in, event page, team, fund claims tabs)
- ✅ Participant management: search, filter, export CSV
- ✅ Payment verification: approve (assigns bib) / reject
- ✅ QR code generation for confirmed participants
- ✅ QR camera scanner for event-day check-in
- ✅ Manual registration code check-in
- ✅ Event share page with QR and copy link
- ✅ Multi-org workspace switcher UI + create new org
- ✅ Legal pages (`/contact`, `/terms`, `/refunds`, `/services`)
- ✅ PWA manifest + service worker (wired in `index.html` and `main.jsx`)
- ✅ Footer with legal links on all pages
- ✅ 404 not-found page
- ✅ Supabase RLS on all tables
- ✅ Base `schema.sql` (complete)
- ✅ 6 database migration files written
- ✅ 3 Edge Function code files written (`cashfree-create-order`, `cashfree-webhook`, `dispatch-whatsapp`)
- ✅ Cashfree SDK helper written (`src/lib/cashfree.js`)
- ✅ Fund claims UI + backend RPCs (`get_fund_claim_summary`, `request_fund_claim`, `update_fund_claim`)
- ✅ `vercel.json` SPA rewrite rule
- ✅ Build passes (Vite 7.3.8, exit code 0)

---

*For deployment steps, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). For full project status, see [PROJECT_STATUS.md](PROJECT_STATUS.md). For database details, see [DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md).*
