# EventFlow Platform — Deployment Guide

> **Production URL:** https://eventflow-platform-eta.vercel.app/  
> **Supabase Project Ref:** `vdfgwpocjacvfqfhctua`  
> **Cashfree API Version:** `2025-01-01`  
> **Last Updated:** 2026-11-19

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Supabase Setup](#2-supabase-setup)
3. [Database Migrations](#3-database-migrations)
4. [Edge Function Deployment](#4-edge-function-deployment)
5. [Vercel Deployment](#5-vercel-deployment)
6. [Supabase Auth URL Configuration](#6-supabase-auth-url-configuration)
7. [Cashfree Configuration](#7-cashfree-configuration)
8. [WhatsApp Configuration](#8-whatsapp-configuration)
9. [PWA Notes](#9-pwa-notes)
10. [Post-Deployment Checklist](#10-post-deployment-checklist)
11. [Environment Variables Reference](#11-environment-variables-reference)

---

## 1. Prerequisites

### Tools Required

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | https://nodejs.org |
| npm | 10+ | Included with Node.js |
| Supabase CLI | Latest | `npm install -g supabase` |
| Vercel CLI (optional) | Latest | `npm install -g vercel` |
| Git | Any | https://git-scm.com |

### Accounts Required

- **Supabase** — Project already exists at ref `vdfgwpocjacvfqfhctua`
- **Vercel** — Project already deployed at https://eventflow-platform-eta.vercel.app/
- **Cashfree** — Merchant account (sandbox and/or production)
- **Meta for Developers** — For WhatsApp Business Cloud API

### Windows Note

> [!WARNING]
> On Windows with PowerShell, npm scripts may be blocked by the execution policy.  
> Run this **in each new terminal session** before executing any npm commands:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

---

## 2. Supabase Setup

### Path A — New Project (Fresh Deployment)

1. Go to https://supabase.com/dashboard → **New Project**
2. Set a strong database password and note it
3. Wait for the project to initialise (~2 minutes)
4. In the Supabase Dashboard → **SQL Editor** → **New Query**
5. Paste the full contents of `supabase/schema.sql` and click **Run**
6. Verify: go to **Table Editor** and confirm all tables exist
7. Skip to [Section 4](#4-edge-function-deployment) (migrations are already baked into `schema.sql` for fresh installs)

### Path B — Existing Project (Production — `vdfgwpocjacvfqfhctua`)

Do **NOT** re-run `schema.sql`. Instead apply only the 6 migrations as described in [Section 3](#3-database-migrations).

### Getting Your API Keys

1. Supabase Dashboard → **Project Settings** → **API**
2. Copy:
   - **Project URL** → used as `VITE_SUPABASE_URL`
   - **`anon` / public key** → used as `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **`service_role` key** → used ONLY as a Supabase Edge Function secret — never expose in frontend

---

## 3. Database Migrations

> [!IMPORTANT]
> Apply migrations **in the exact order listed below**. Each migration depends on the previous one.

For each file, follow these steps:

1. Open Supabase Dashboard → **SQL Editor** → **New Query**
2. Open the migration file from `supabase/migrations/`
3. Paste the full contents into the SQL editor
4. Click **Run**
5. Confirm the output shows no errors
6. Repeat for the next file

### Migration Order

| Step | File |
|---|---|
| **1** | `20261119_eventflow_platform_upgrade.sql` |
| **2** | `20261119_eventflow_event_permissions.sql` |
| **3** | `20261119_eventflow_security_and_permissions_hardening.sql` |
| **4** | `20261119_eventflow_whatsapp_optin_guard.sql` |
| **5** | `20261119_eventflow_multi_organisation_team_scope.sql` |
| **6** | `20261119_eventflow_fund_claims.sql` |

### Verify Migrations Applied

After all 6 migrations, run this in the SQL editor to verify new tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables: `events`, `event_assignments`, `fund_claims`, `notification_outbox`, `organization_members`, `organizations`, `payment_orders`, `registrations`

---

## 4. Edge Function Deployment

### Prerequisites

```bash
# Log in to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref vdfgwpocjacvfqfhctua
```

### Deploy All Edge Functions

```bash
# Deploy each function individually
supabase functions deploy cashfree-create-order
supabase functions deploy cashfree-webhook
supabase functions deploy dispatch-whatsapp
```

### Configure Secrets

#### `cashfree-create-order` Secrets

```bash
supabase secrets set CASHFREE_APP_ID="your_cashfree_app_id"
supabase secrets set CASHFREE_SECRET_KEY="your_cashfree_secret_key"
supabase secrets set CASHFREE_ENV="sandbox"          # or "production"
supabase secrets set SITE_URL="https://eventflow-platform-eta.vercel.app"
```

#### `cashfree-webhook` Secrets

```bash
supabase secrets set CASHFREE_SECRET_KEY="your_cashfree_secret_key"
# (Already set above — Supabase secrets are shared across all functions in a project)
```

#### `dispatch-whatsapp` Secrets

```bash
supabase secrets set WHATSAPP_ACCESS_TOKEN="your_meta_whatsapp_access_token"
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id"
supabase secrets set WHATSAPP_GRAPH_VERSION="v19.0"
supabase secrets set NOTIFICATION_WORKER_SECRET="generate_a_long_random_secret_here"
```

### Verify Secrets Are Set

```bash
supabase secrets list
```

> [!CAUTION]
> Never put `CASHFREE_SECRET_KEY` or `WHATSAPP_ACCESS_TOKEN` in `VITE_*` environment variables. These are server-side secrets that must only exist in Supabase Edge Function environment variables. Putting them in `VITE_*` embeds them in the public JavaScript bundle.

### Edge Function URLs

After deployment, your function URLs will be:

```
https://vdfgwpocjacvfqfhctua.supabase.co/functions/v1/cashfree-create-order
https://vdfgwpocjacvfqfhctua.supabase.co/functions/v1/cashfree-webhook
https://vdfgwpocjacvfqfhctua.supabase.co/functions/v1/dispatch-whatsapp
```

---

## 5. Vercel Deployment

### Environment Variables

In the Vercel Dashboard → Your Project → **Settings** → **Environment Variables**, add the following:

| Variable | Value | Environment |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://vdfgwpocjacvfqfhctua.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase `anon` public key | Production, Preview, Development |
| `VITE_CASHFREE_MODE` | `sandbox` or `production` | Production, Preview, Development |

> [!WARNING]
> `VITE_CASHFREE_MODE` is **required** for the Cashfree JS SDK to initialise. Without it, the SDK will fail silently or throw errors. Add it to both Vercel and your local `.env` file (and document it in `.env.example`).

### Deployment Commands (Vercel CLI)

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### SPA Rewrite

The `vercel.json` already contains the required SPA rewrite rule:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

This ensures all routes (including `/e/:slug`, `/dashboard`, etc.) are served by `index.html`.

### Recommended: Add Cache Headers for Assets

Add this to `vercel.json` for optimal CDN caching of hashed JS/CSS chunks:

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## 6. Supabase Auth URL Configuration

> [!IMPORTANT]
> Without correct URL configuration, Supabase Auth email redirects (email confirmation, password reset) will fail.

### Steps

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://eventflow-platform-eta.vercel.app`
3. Under **Redirect URLs**, add all allowed redirect URLs:

```
https://eventflow-platform-eta.vercel.app/**
http://localhost:5173/**
http://localhost:4173/**
```

4. Click **Save**

### Auth Email Templates

Optionally customise the confirmation and password reset email templates under **Authentication** → **Email Templates** to match your EventFlow branding.

---

## 7. Cashfree Configuration

### Step 1 — Create a Cashfree Merchant Account

1. Sign up at https://merchant.cashfree.com
2. Complete KYC for production access
3. For sandbox testing, use the Sandbox environment (no KYC required)

### Step 2 — Get API Credentials

1. Cashfree Dashboard → **Developers** → **API Keys**
2. Note your:
   - **App ID** → `CASHFREE_APP_ID`
   - **Secret Key** → `CASHFREE_SECRET_KEY`
3. Sandbox and Production have **separate** App IDs and Secret Keys

### Step 3 — Configure Webhook URL

1. Cashfree Dashboard → **Developers** → **Webhooks**
2. Add a new webhook:
   - **URL:** `https://vdfgwpocjacvfqfhctua.supabase.co/functions/v1/cashfree-webhook`
   - **Events:** Select `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_PENDING`
   - **API Version:** `2025-01-01`
3. Save and note the webhook secret (same as your `CASHFREE_SECRET_KEY`)

### Step 4 — Add `/payment-return` Route

> [!CAUTION]
> This is a **critical blocker**. Cashfree redirects users to `{SITE_URL}/payment-return?order_id=xxx` after checkout. If this route does not exist in `App.jsx`, users will land on a 404 page after paying.

Before going live with Cashfree, add the route to `src/App.jsx`:

```jsx
// Add this route inside your <Routes> block
<Route path="/payment-return" element={<PaymentReturnPage />} />
```

And create the `PaymentReturnPage` component that:
1. Reads `?order_id` from the URL query string
2. Calls `cashfree-create-order` or checks `payment_orders` to get payment status
3. Displays success or failure message to the user

### Step 5 — Sandbox Testing Checklist

- [ ] `CASHFREE_ENV` secret set to `"sandbox"`
- [ ] `VITE_CASHFREE_MODE` set to `"sandbox"` in Vercel and `.env`
- [ ] Webhook URL registered in Cashfree Sandbox dashboard
- [ ] Test a payment using Cashfree sandbox test cards
- [ ] Verify webhook is received by checking Supabase Edge Function logs
- [ ] Verify `payment_orders` row is updated to `paid`
- [ ] Verify `registrations` row is updated (`payment_status=verified`, `status=confirmed`)
- [ ] Verify participant receives WhatsApp notification (if WhatsApp is configured)

### Step 6 — Production Checklist

- [ ] KYC completed on Cashfree account
- [ ] `CASHFREE_ENV` secret updated to `"production"`
- [ ] `VITE_CASHFREE_MODE` updated to `"production"` in Vercel
- [ ] Webhook URL registered in Cashfree **Production** dashboard (separate from sandbox)
- [ ] End-to-end production payment test completed with a real card

---

## 8. WhatsApp Configuration

### Step 1 — Set Up Meta Developer App

1. Go to https://developers.facebook.com and create/open your app
2. Add the **WhatsApp** product to your app
3. Under **WhatsApp** → **API Setup**, note your:
   - **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary Access Token** (use System User token for production) → `WHATSAPP_ACCESS_TOKEN`
   - **Graph API Version** (e.g. `v19.0`) → `WHATSAPP_GRAPH_VERSION`

### Step 2 — Request Message Template Approvals

Two templates must be approved by Meta before they can be sent:

#### Template 1: `eventflow_payment_confirmed`

Purpose: Sent to participant after payment is confirmed.

| Param | Description |
|---|---|
| `{{1}}` | Participant full name |
| `{{2}}` | Event name |
| `{{3}}` | Registration code |
| `{{4}}` | Bib number |
| `{{5}}` | Event date |

Example body:
```
Hi {{1}}, your payment for {{2}} has been confirmed! 🎉
Your registration code is {{3}} and your bib number is {{4}}.
See you on {{5}}!
```

#### Template 2: `eventflow_event_update`

Purpose: Sent for general event announcements.

| Param | Description |
|---|---|
| `{{1}}` | Participant full name |
| `{{2}}` | Event name |
| `{{3}}` | Update type (e.g. "Route Change") |
| `{{4}}` | Update message |
| `{{5}}` | Event date |
| `{{6}}` | Support contact |

> [!NOTE]
> Template approvals can take 24–48 hours. Submit them early. Using an unapproved template will result in a `131009` error from the WhatsApp API.

### Step 3 — Configure dispatch-whatsapp Cron Worker

The `dispatch-whatsapp` Edge Function processes the `notification_outbox` table. It must be triggered periodically. Options:

**Option A — Supabase Cron (pg_cron, recommended)**

```sql
-- Run every 2 minutes
SELECT cron.schedule(
  'dispatch-whatsapp-job',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vdfgwpocjacvfqfhctua.supabase.co/functions/v1/dispatch-whatsapp',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.notification_worker_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Option B — External Cron (e.g. cron-job.org)**

Create a free cron job at https://cron-job.org that sends a POST request to:
```
https://vdfgwpocjacvfqfhctua.supabase.co/functions/v1/dispatch-whatsapp
```
With header:
```
Authorization: Bearer <NOTIFICATION_WORKER_SECRET>
```
Every 2 minutes.

### Step 4 — Add WhatsApp Opt-In to Registration Form

Before deploying WhatsApp notifications:

1. Add a checkbox to the registration form in `App.jsx`:
   ```jsx
   <label>
     <input type="checkbox" name="whatsapp_opt_in" />
     I consent to receive WhatsApp updates about my registration
   </label>
   ```
2. Pass `whatsapp_opt_in` to the `register_participant` RPC call
3. The `notification_outbox` trigger checks this field before queuing messages

---

## 9. PWA Notes

The Progressive Web App setup is **already complete** — no additional deployment steps are required.

| Item | Status | Location |
|---|---|---|
| Web App Manifest | ✅ Linked | `index.html` → `<link rel="manifest" href="/manifest.json">` |
| Service Worker | ✅ Registered | `src/main.jsx` → `navigator.serviceWorker.register('/sw.js')` |
| PWA Icons | ✅ Present | `public/icons/` |
| `manifest.json` | ✅ Present | `public/manifest.json` |

**To test PWA installation:**

1. Open the production URL in Chrome on mobile
2. Look for the "Add to Home Screen" prompt in the browser menu
3. Alternatively, open Chrome DevTools → **Application** → **Manifest** to inspect

> [!TIP]
> Consider adding an in-app "Install App" button using the `beforeinstallprompt` event for a better user experience. See [TODO.md](TODO.md) item 16.

---

## 10. Post-Deployment Checklist

Run through this checklist after each production deployment:

### Core Functionality
- [ ] Landing page loads and displays published events
- [ ] Registration form at `/e/:slug` renders correctly
- [ ] Registration can be submitted (UPI manual payment flow)
- [ ] Payment proof can be uploaded
- [ ] Organiser can sign in and access dashboard
- [ ] Participant management table loads
- [ ] CSV export works
- [ ] QR code scanner opens camera on mobile

### Auth
- [ ] Sign-up email confirmation works
- [ ] Password reset email works and redirects correctly

### Cashfree (after setup)
- [ ] `cashfree-create-order` Edge Function responds (check Supabase logs)
- [ ] Payment button appears in registration form
- [ ] Sandbox payment completes and returns to `/payment-return` with correct status
- [ ] Webhook received and `payment_orders` row updated

### WhatsApp (after setup)
- [ ] `dispatch-whatsapp` function health check passes
- [ ] Outbox row is created after registration is confirmed
- [ ] WhatsApp message received by test phone number

### Database
- [ ] All 8 expected tables exist in Table Editor
- [ ] RLS is enabled on all tables (check: **Authentication** → **Policies**)

### PWA
- [ ] Manifest loads without errors (Chrome DevTools → Application)
- [ ] Service worker is registered
- [ ] Site is installable on mobile

---

## 11. Environment Variables Reference

### Frontend (Vercel + `.env` / `.env.example`)

| Variable | Required | Example Value | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ Yes | `https://vdfgwpocjacvfqfhctua.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ Yes | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase `anon` key (public) |
| `VITE_CASHFREE_MODE` | ✅ Yes | `sandbox` or `production` | Controls Cashfree JS SDK environment |

### Edge Function Secrets (Supabase — set via `supabase secrets set`)

| Secret | Required For | Notes |
|---|---|---|
| `CASHFREE_APP_ID` | `cashfree-create-order` | From Cashfree Developer Dashboard |
| `CASHFREE_SECRET_KEY` | `cashfree-create-order`, `cashfree-webhook` | From Cashfree Developer Dashboard — **never expose in frontend** |
| `CASHFREE_ENV` | `cashfree-create-order` | `sandbox` or `production` |
| `SITE_URL` | `cashfree-create-order` | `https://eventflow-platform-eta.vercel.app` — used to construct `/payment-return` redirect URL |
| `WHATSAPP_ACCESS_TOKEN` | `dispatch-whatsapp` | Meta System User token — **never expose in frontend** |
| `WHATSAPP_PHONE_NUMBER_ID` | `dispatch-whatsapp` | From Meta for Developers → WhatsApp → API Setup |
| `WHATSAPP_GRAPH_VERSION` | `dispatch-whatsapp` | e.g. `v19.0` |
| `NOTIFICATION_WORKER_SECRET` | `dispatch-whatsapp` | Long random secret to authenticate cron requests |

> [!NOTE]
> Supabase secrets are automatically available as environment variables inside all Edge Functions. They are never exposed to the browser.

### Local Development (`.env` file — never commit to git)

Create `.env` in the project root (copy from `.env.example`):

```env
VITE_SUPABASE_URL=https://vdfgwpocjacvfqfhctua.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
VITE_CASHFREE_MODE=sandbox
```

Ensure `.env` is in `.gitignore`:
```
.env
.env.local
.env.*.local
```
