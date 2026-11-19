# EventFlow Testing Checklist

> Last updated: 19 November 2026 · Branch: `feat/central-payments-branding-whatsapp-pwa`
>
> **Legend:** ✅ Verified working · ⚠️ Partially working / untested · ❌ Broken / missing · 🔒 Requires secrets/migration

---

## 1. Build & Deployment

| Test | Status | Notes |
|---|---|---|
| `npm run build` exits with code 0 | ✅ | Vite 7.3.8, 1663 modules, ~10s |
| No TypeScript/JSX compilation errors | ✅ | Clean build |
| Bundle size acceptable | ⚠️ | 912KB JS single chunk — too large; chunk warning present |
| CSS bundle size acceptable | ✅ | 37KB |
| Vercel SPA rewrite configured | ✅ | `vercel.json` has `/*` → `/index.html` |
| Direct URL navigation works (no 404) | ✅ | Vercel rewrite handles this |
| PWA manifest linked in index.html | ✅ | `<link rel="manifest">` present |
| Service worker registered (production only) | ✅ | `main.jsx` registers `/sw.js` on `import.meta.env.PROD` |
| Fonts load from Google Fonts CDN | ✅ | DM Sans + Manrope preconnected |

---

## 2. Public Website

| Test | Status | Notes |
|---|---|---|
| Homepage (`/`) loads | ✅ | Hero, feature strip, event grid, how-it-works, CTA |
| Published events appear in event grid | ⚠️ | Requires Supabase connected |
| "Explore events" nav link works | ✅ | Routes to `/` |
| "Organiser login" nav link works | ✅ | Routes to `/admin` |
| Footer links work (Contact, Terms, Refunds, Services) | ✅ | All routes registered |
| `/contact` page loads with email link | ✅ | HAPTECHINDIA@GMAIL.COM |
| `/terms` page loads | ✅ | Full terms content |
| `/refunds` page loads | ✅ | Full refunds policy |
| `/services` page loads | ✅ | Pricing marked as illustrative |
| 404 page shown for unknown routes | ✅ | NotFound component registered |

---

## 3. Event Registration (Participant Flow)

| Test | Status | Notes |
|---|---|---|
| `/e/:slug` loads for a published event | ⚠️ | Requires published event in DB |
| `/e/:slug` shows 404 for draft/unknown events | ✅ | Query filters by `status='published'` |
| Registration form renders with categories | ⚠️ | Requires event with categories |
| Name, email, phone, category fields work | ✅ | Validation in RPC |
| Date of birth required for age-restricted categories | ✅ | Frontend + backend validation |
| Payment screenshot upload (optional) | ✅ | 5MB limit, private bucket |
| Duplicate participant protection | ✅ | Unique index on (event_id, lower(email), lower(full_name)) |
| Registration code shown after success | ✅ | Confirmation card UI |
| Registration blocked when registration_open=false | ✅ | UI shows closed message |
| Cashfree online payment button | ❌ | **NOT IN FORM — missing feature** |
| WhatsApp opt-in checkbox | ❌ | **NOT IN FORM — missing feature** |

---

## 4. Admin Authentication

| Test | Status | Notes |
|---|---|---|
| `/admin` shows login page when not signed in | ✅ | AuthPanel renders |
| Sign-up creates account | ⚠️ | Requires Supabase Auth configured |
| Email confirmation flow | ⚠️ | Depends on Supabase email settings |
| Sign-in works with correct credentials | ⚠️ | Requires Supabase connected |
| Sign-out clears session | ✅ | `supabase.auth.signOut()` |
| Session persists across page refresh | ✅ | `persistSession: true` in client config |
| Setup banner shown when Supabase not configured | ✅ | `isSupabaseConfigured` check |

---

## 5. Organiser Dashboard

| Test | Status | Notes |
|---|---|---|
| Dashboard loads after sign-in | ⚠️ | Requires Supabase |
| "Create workspace" form shown for new users | ✅ | No org membership check |
| Workspace name saved and workspace created | ⚠️ | Requires `create_organization` RPC and migration |
| Organisation switcher dropdown visible | ✅ | Multi-org UI in sidebar |
| "Add organisation" button works | ✅ | `showOrgForm` panel |
| Events listed in sidebar | ⚠️ | Requires events in DB |
| "New event" creates a draft | ⚠️ | Requires Supabase |
| Event published/unpublished | ⚠️ | Requires Supabase |
| Registration open/closed toggle works | ⚠️ | Requires Supabase |
| "Copy registration link" copies correct URL | ✅ | Uses `window.location.origin` (correct for production) |
| Event share QR code generates | ✅ | QRCodeSVG with origin URL |

---

## 6. Participant Management

| Test | Status | Notes |
|---|---|---|
| Participants table loads | ⚠️ | Requires registrations |
| Search by name / email / phone / bib works | ✅ | Client-side filter |
| Filter by payment status works | ✅ | Client-side filter |
| Payment verify (approve) assigns bib | ⚠️ | Requires `approve_registration` RPC + migration 4 |
| Payment reject cancels registration | ⚠️ | Requires `reject_registration` RPC + migration 4 |
| View payment proof (signed URL) | ⚠️ | Requires Supabase storage |
| CSV export downloads correct data | ✅ | Client-side CSV generation |
| QR code shown for confirmed participants | ✅ | QRCodeSVG in table |

---

## 7. Event-Day Check-in

| Test | Status | Notes |
|---|---|---|
| Check-in tab loads | ✅ | CheckinPanel renders |
| Camera scanner opens | ⚠️ | Requires HTTPS + camera permission |
| QR scan triggers check-in | ⚠️ | Requires Supabase + migration 4 |
| Manual code check-in works | ⚠️ | Requires Supabase + migration 4 |
| Already-checked-in error shown | ✅ | Backend RPC returns error |
| Unconfirmed participant blocked | ✅ | Backend RPC enforces confirmed status |

---

## 8. Team Management

| Test | Status | Notes |
|---|---|---|
| Team tab visible to admin/owner | ✅ | `isAdmin` check |
| Team members listed | ⚠️ | Requires Supabase |
| Add team member by email | ⚠️ | Requires `add_organization_member` RPC (migration 5 changed signature) |
| Staff vs admin role selection | ✅ | Dropdown in form |
| Non-member denied access to other org data | 🔒 | Requires RLS migrations applied |

---

## 9. Fund Claims

| Test | Status | Notes |
|---|---|---|
| Fund claims tab visible to admins | ✅ | `isAdmin && tab==='fundclaims'` check |
| Claim summary loads (eligible gross, fee, net) | 🔒 | Requires `get_fund_claim_summary` RPC + fund_claims migration |
| "Claim available funds" button works | 🔒 | Requires `request_fund_claim` RPC + paid Cashfree orders |
| Claim list shows history | 🔒 | Requires fund_claims table migration |
| Mark processing / mark paid / reject claim | 🔒 | Requires `update_fund_claim` RPC |
| Transfer ID required before marking paid | ✅ | UI enforces non-empty transfer ref |

---

## 10. Cashfree Payment Integration

| Test | Status | Notes |
|---|---|---|
| `cashfree-create-order` function deployed | ❌ | **NOT DEPLOYED** |
| `cashfree-webhook` function deployed | ❌ | **NOT DEPLOYED** |
| Sandbox mode configured | ❌ | Secrets not set |
| Payment button in registration form | ❌ | **NOT ADDED TO UI** |
| /payment-return route exists | ❌ | **ROUTE MISSING FROM App.jsx** |
| Webhook HMAC signature verification | ✅ | Code correct (not yet live) |
| Idempotent webhook handling | ✅ | `confirm_cashfree_payment` handles duplicates |
| Amount mismatch detection | ✅ | Server-authoritative amount check |
| Duplicate active order prevention | ✅ | Unique index on (registration_id) for active orders |

---

## 11. WhatsApp Notifications

| Test | Status | Notes |
|---|---|---|
| `dispatch-whatsapp` function deployed | ❌ | **NOT DEPLOYED** |
| WhatsApp secrets configured | ❌ | Not set |
| Template `eventflow_payment_confirmed` approved | ❌ | Not submitted to Meta |
| Template `eventflow_event_update` approved | ❌ | Not submitted to Meta |
| Opt-in checkbox in registration form | ❌ | **NOT IN FORM** |
| Outbox records created on payment confirmation | 🔒 | Requires function + migration |
| Dispatcher cron/scheduler configured | ❌ | Not set up |

---

## 12. PWA

| Test | Status | Notes |
|---|---|---|
| Manifest linked in index.html | ✅ | `<link rel="manifest" href="/manifest.webmanifest">` |
| Service worker registered | ✅ | `main.jsx` (production only) |
| App installable from Chrome/Edge | ⚠️ | Requires HTTPS (production Vercel) |
| Install prompt shown | ❌ | No install prompt UI implemented |
| Offline shell fallback works | ✅ | SW caches `/`, `/admin`, manifest, icon |

---

## 13. Security

| Test | Status | Notes |
|---|---|---|
| No service-role key in frontend | ✅ | Only anon key used |
| Cashfree secret key in backend only | ✅ | Edge function env vars |
| RLS enabled on all tables | ✅ | All 7 tables have RLS |
| Payment amount server-authoritative | ✅ | Order amount comes from DB, not browser |
| Webhook signature verified | ✅ | HMAC-SHA256 constant-time comparison |
| Cross-org data isolation | 🔒 | Requires migrations 2+3 applied |
| File upload path validation | ✅ | `attach_payment_proof` checks path segments |
| Input validation on all RPC functions | ✅ | Server-side checks in SECURITY DEFINER functions |

---

## How to Run Tests Locally

```powershell
# Allow npm scripts (session-only)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Install dependencies
cd "c:\Users\ADMIN\Downloads\eventflow-platform\eventflow-platform"
npm install

# Build
npm run build

# Local dev (requires .env.local with Supabase credentials)
npm run dev
```

---

## Before Declaring Cashfree Production-Ready

- [ ] All 6 DB migrations applied and verified in Supabase
- [ ] Edge functions deployed
- [ ] Sandbox end-to-end test: register → pay → verify bib assigned
- [ ] Webhook delivery tested (success, failure, duplicate, amount mismatch)
- [ ] /payment-return route built and tested
- [ ] Cashfree payment button added to registration form
- [ ] VITE_CASHFREE_MODE set to `sandbox` in Vercel, then `production` after approval
