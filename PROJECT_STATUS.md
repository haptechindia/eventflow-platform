# EventFlow Platform — Project Status

> **Last Updated:** 2026-11-21  
> **Branch:** `feat/freemium-pricing-event-billing`  
> **Build:** ✅ Passing (Vite 7.3.8, exit code 0)

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Complete and working |
| ⚠️ | Partially implemented — needs further work |
| ❌ | Broken, missing, or not yet built |
| 🔴 | Critical blocker |
| 🟠 | High priority gap |
| 🟡 | Medium priority |

---

## ✅ Completed Features

### Freemium Pricing & Event Billing (NEW)

| Feature | Detail |
|---|---|
| ✅ **Organisation-level Free Quota** | First 3 events per organisation are 100% free; tracked and enforced at the organisation level |
| ✅ **Pay-Per-Event Billing (₹999)** | 4th event onwards requires a one-time ₹999 platform access fee; no monthly/annual subscription |
| ✅ **Database Publishing Guard** | Check constraint & RLS ensure no event can be published unless billing is `'free'` or `'paid'` |
| ✅ **Dedicated Platform Fee Orders** | `platform_fee_orders` table separates platform fees from participant ticket payments |
| ✅ **Cashfree Platform Fee Integration** | Server-side order creation (`order_type: 'event_platform_fee'`) and signature-verified webhook handling |
| ✅ **Server-side Payment Verification** | On redirect return (`/admin?billing_return=1`), verifies status directly with Cashfree API without relying on client redirect |
| ✅ **Sidebar Quota Tracker** | Live progress bar showing `X / 3 Free Events Used` with quota status chip |
| ✅ **Organiser Billing & Quota Tab** | Dashboard tab with quota metrics, plan cards, event transaction history table |
| ✅ **Printable Tax Invoice / Receipt** | Organisers can view and print official platform fee payment receipts |
| ✅ **Admin Complimentary Waivers** | Authorised admins can grant complimentary waivers with audit-logged reasons |
| ✅ **Legal & Pricing Policies** | Updated Terms, Services, and Refunds pages reflecting freemium & ₹999 platform fee |

### Public / Registration Experience

| Feature | Detail |
|---|---|
| ✅ **Landing page** | Hero section, feature strip, event directory listing, how-it-works section, CTA, footer with legal links |
| ✅ **Event discovery** | Homepage lists all published events with key details |
| ✅ **Public event registration page** | Route `/e/:slug` — renders event details and registration form |
| ✅ **Registration form** | Fields: full name, email, phone, category (from event JSON), date of birth, emergency contact, UPI transaction reference, payment proof file upload |
| ✅ **Payment proof upload** | Uploads to private Supabase Storage bucket (`payment-proofs`); linked to registration record |
| ✅ **404 page** | Catch-all not-found route rendered |

### Organiser Authentication

| Feature | Detail |
|---|---|
| ✅ **Organiser sign-up** | Email + password via Supabase Auth |
| ✅ **Organiser sign-in** | Email + password, session persisted via `supabase.auth.onAuthStateChange` |
| ✅ **Session management** | Auth state drives all protected route rendering |

### Organiser Dashboard

| Feature | Detail |
|---|---|
| ✅ **Dashboard layout** | Sidebar navigation, responsive, workspace switcher in header |
| ✅ **Event creation** | Create event in `draft` status with all fields (name, slug, venue, city, date, fee, categories, UPI ID, instructions) |
| ✅ **Event publishing** | Toggle event from `draft` → `published` |
| ✅ **Registration open/close toggle** | Toggle `registration_open` boolean per event |
| ✅ **Participant management table** | Search by name/email/phone, filter by payment/check-in status, paginated |
| ✅ **Export CSV** | Export filtered participant list as CSV |
| ✅ **Payment verification** | Approve (assigns bib number) or Reject payment proofs |
| ✅ **QR code generation** | Confirmed participants get a unique QR code linking to their registration code |
| ✅ **QR camera scanner** | Uses device camera via `html5-qrcode` to scan participant QR codes on event day |
| ✅ **Manual check-in** | Enter registration code manually to check in a participant |
| ✅ **Event share page** | Displays event QR code and copyable registration link |

### Team & Organisation

| Feature | Detail |
|---|---|
| ✅ **Team management** | Add staff or admin members to an organisation by email |
| ✅ **Multi-org workspace switcher** | Dropdown to switch between organisations the user belongs to; create new organisation |
| ✅ **Fund claims panel** | UI shows gross/fee/net amounts; submit claim request; admin can update claim status |

### Legal & Infrastructure

| Feature | Detail |
|---|---|
| ✅ **Legal pages** | `/contact`, `/terms`, `/refunds`, `/services` — all implemented in `LegalPages.jsx` |
| ✅ **PWA manifest** | `manifest.json` linked in `index.html` |
| ✅ **PWA icons** | Present in `public/` |
| ✅ **Service worker** | `sw.js` registered in `main.jsx` |
| ✅ **Footer with legal links** | Present on all pages |

### Database

| Feature | Detail |
|---|---|
| ✅ **Base `schema.sql`** | Complete — all base tables, RPCs, RLS policies, storage bucket |
| ✅ **RLS on all tables** | Row Level Security policies defined and enabled |
| ✅ **6 migration files written** | All 6 additive SQL migration files are present in `supabase/migrations/` |

### Edge Functions (Code Written)

| Feature | Detail |
|---|---|
| ✅ **`cashfree-create-order` code** | Creates a Cashfree payment order and returns `payment_session_id` |
| ✅ **`cashfree-webhook` code** | Verifies Cashfree webhook signature; calls `confirm_cashfree_payment` RPC |
| ✅ **`dispatch-whatsapp` code** | Processes `notification_outbox` queue; sends WhatsApp template messages |
| ✅ **`cashfree.js` SDK helper** | `src/lib/cashfree.js` — `startCashfreeCheckout(paymentSessionId, returnUrl)` function |

---

## ⚠️ Partially Completed Features

### ⚠️ Cashfree Online Payments

> [!CAUTION]
> Cashfree payment flow is architecturally complete but **not functional end-to-end**. Multiple pieces are missing.

| Sub-feature | Status | Detail |
|---|---|---|
| `cashfree-create-order` Edge Function code | ✅ Written | Deno function exists in `supabase/functions/cashfree-create-order/` |
| `cashfree-create-order` deployed | ❌ Not deployed | Function has never been pushed to Supabase |
| Cashfree secrets configured | ❌ Not set | `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`, `SITE_URL` not set in Supabase |
| `cashfree-webhook` deployed | ❌ Not deployed | — |
| Cashfree webhook URL registered | ❌ Not configured | URL not registered in Cashfree dashboard |
| "Pay Online" button in registration form | ✅ Built | Seamlessly integrated into participant form + confirmation card with retry option |
| `/payment-return` route | ✅ Built | Route defined in `App.jsx` with pass printing, verification polling & auto-refresh |
| `VITE_CASHFREE_MODE` env var | ✅ Documented | Added to `.env.example` and ready for Vercel |

### ✅ WhatsApp Direct Messaging (Organiser-to-Participant)

> [!NOTE]
> Per project requirements, complex Meta Business WhatsApp Cloud API integration is bypassed in favour of direct, frictionless `wa.me` links from the organiser's personal WhatsApp / WhatsApp Web.

| Sub-feature | Status | Detail |
|---|---|---|
| Table row WhatsApp action | ✅ Built | 1-click icon to send personalized confirmation / payment reminder from organiser WhatsApp |
| Broadcast / Batch WhatsApp modal | ✅ Built | Audience filtering (All, Confirmed, Pending), custom templating, and 1-click send links |
| Copy all phone numbers | ✅ Built | Quick button to copy comma-separated recipient numbers for broadcast lists |

### ℹ️ Meta WhatsApp Cloud API (Optional Backend Alternative)

| Sub-feature | Status | Detail |
|---|---|---|
| `dispatch-whatsapp` Edge Function code | ✅ Written | — |
| `dispatch-whatsapp` deployed | ❌ Not deployed | — |
| WhatsApp API secrets configured | ❌ Not set | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` not configured in Supabase |
| WhatsApp opt-in checkbox in registration form | ❌ Missing | No UI field; `whatsapp_opt_in` column exists in migration but cannot be populated |
| WhatsApp template approvals | ❌ Unknown | `eventflow_payment_confirmed` and `eventflow_event_update` templates must be approved by Meta |
| Notification controls in dashboard | ❌ Missing | No UI to trigger announcements or view outbox status |
| Cron worker / trigger | ❌ Not configured | `notification_outbox` rows need a periodic trigger to invoke `dispatch-whatsapp` |

### ⚠️ Fund Claims

| Sub-feature | Status | Detail |
|---|---|---|
| Fund claims UI | ✅ Complete | Claim request button, status display, admin update |
| `get_fund_claim_summary` RPC | ✅ Complete | Aggregates confirmed `payment_orders` rows |
| `request_fund_claim` RPC | ✅ Complete | Inserts a new `fund_claims` row |
| `update_fund_claim` RPC | ✅ Complete | Admin-only status update |
| Works for Cashfree payments | ✅ (once deployed) | `payment_orders` rows created by webhook |
| Works for manual UPI payments | ❌ Broken | Manual UPI proof approval does NOT create `payment_orders` rows → fund summary will be `\$0` for UPI-only events |
| Fund claims tab visibility | ⚠️ Admin-only | Tab only shown to `isAdmin` users — staff cannot see it even if entitled |

### ⚠️ Multi-Organisation Workspace

| Sub-feature | Status | Detail |
|---|---|---|
| Workspace switcher UI | ✅ Present | Dropdown renders org names |
| Create new organisation | ✅ Working | Calls `create_organization` RPC |
| `switchOrganisation()` function | ⚠️ Needs verification | `loadWorkspace()` may still query only the first `organization_members` row rather than the selected org |
| Team-scoped permissions | ✅ Written (migration 5) | `add_organization_member` updated to require `org_id` parameter |

---

## ❌ Broken / Missing Features

| Feature | Priority | Detail |
|---|---|---|
| ❌ `/payment-return` route | 🔴 Critical | Cashfree redirects here; page does not exist → blank 404 for every Cashfree customer |
| ❌ Cashfree payment button | 🔴 Critical | `startCashfreeCheckout` written but not wired to any UI element |
| ❌ WhatsApp opt-in checkbox | 🟠 High | Column exists in DB migration but no form field collects consent |
| ❌ Branding upload UI | 🟡 Medium | No logo upload or colour picker in dashboard; DB columns exist in migration 1 |
| ❌ Volunteer / helper assignment UI | 🟡 Medium | `event_assignments` table exists but no dashboard screen to assign volunteers |
| ❌ Bib lookup form | 🟡 Medium | `lookup_participant_bib` RPC exists but no public UI calls it |
| ❌ Code splitting | 🟠 High | 912 KB single JS bundle — Vite warns on every build |
| ❌ Event edit form | 🟡 Medium | Events cannot be edited after creation |
| ❌ Participant refund workflow | 🟡 Medium | No UI or backend for refunds |
| ❌ Event deletion | 🟢 Low | No UI or backend |
| ❌ Member removal from team | 🟢 Low | No UI to remove an `organization_members` row |
| ❌ PWA install prompt | 🟢 Low | Manifest/SW wired but no "Add to Home Screen" prompt UI |

---

## 🗄️ Database Migrations — Status

> [!IMPORTANT]
> These 6 migration files are **written and present** in `supabase/migrations/` but are **not confirmed as applied** to the production Supabase project. Without them, new columns and tables do not exist and the app will throw runtime errors for Cashfree, WhatsApp, and fund claims.

| Migration File | Key Changes | Applied to Production? |
|---|---|---|
| `20261119_eventflow_platform_upgrade.sql` | Adds branding columns to `organizations`/`events`; `payment_orders` table; `cashfree_order_id`/`whatsapp_opt_in` to `registrations`; `confirm_cashfree_payment` RPC | ❓ Unconfirmed |
| `20261119_eventflow_event_permissions.sql` | `event_assignments` table; `has_event_permission` RPC; RLS for event-scoped staff | ❓ Unconfirmed |
| `20261119_eventflow_security_and_permissions_hardening.sql` | Hardens RLS; updates `attach_payment_proof`, `approve_registration`, `reject_registration`, `check_in_registration` RPCs | ❓ Unconfirmed |
| `20261119_eventflow_whatsapp_optin_guard.sql` | `notification_outbox` table; `queue_event_change_notifications` trigger; `dispatch-whatsapp` RPC guards | ❓ Unconfirmed |
| `20261119_eventflow_multi_organisation_team_scope.sql` | Updates `add_organization_member` to require `org_id`; adds team-scope indexes | ❓ Unconfirmed |
| `20261119_eventflow_fund_claims.sql` | `fund_claims` table; `get_fund_claim_summary`, `request_fund_claim`, `update_fund_claim` RPCs | ❓ Unconfirmed |

**→ Apply all 6 migrations in order via the Supabase SQL editor. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for instructions.**

---

## 🚀 Edge Functions — Deployment Status

| Function | Deployed | Secrets Configured | Notes |
|---|---|---|---|
| `cashfree-create-order` | ❌ No | ❌ No | Needs: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`, `SITE_URL` |
| `cashfree-webhook` | ❌ No | ❌ No | Needs: `CASHFREE_SECRET_KEY` |
| `dispatch-whatsapp` | ❌ No | ❌ No | Needs: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, `NOTIFICATION_WORKER_SECRET` |

---

## 🔴 Deployment Blockers Summary

| # | Blocker | Impact |
|---|---|---|
| 1 | Cashfree secrets not configured in Supabase | Online payments non-functional |
| 2 | `/payment-return` route missing from `App.jsx` | Every Cashfree checkout ends in a 404 |
| 3 | Database migrations unconfirmed | New DB columns/tables may not exist in production |
| 4 | WhatsApp secrets not configured | Notification dispatch non-functional |
| 5 | `VITE_CASHFREE_MODE` not in `.env.example` or Vercel | Frontend Cashfree SDK cannot initialise |

---

## 🛠️ Local Development Note

> [!WARNING]
> On this machine, `npm run dev` and `npm run build` may be blocked by the Windows PowerShell execution policy.  
> **Workaround:** Run the following before any npm scripts:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

---

*See [TODO.md](TODO.md) for a prioritised action list. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for step-by-step deployment instructions.*
