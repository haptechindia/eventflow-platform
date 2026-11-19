# EventFlow Platform — Project Audit

> **Audit Date:** 2026-11-19  
> **Auditor:** Automated Code Review Agent  
> **Scope:** Full codebase review — architecture, security, performance, code quality, and deployment readiness

---

## Executive Summary

EventFlow is a full-stack SaaS event management platform enabling organisers to create events, collect registrations, verify payments, generate participant QR codes, and perform event-day check-ins. The platform is built on a modern React + Supabase stack and deployed to Vercel.

The core organiser workflow is **functionally complete** and the build passes cleanly. However, the codebase carries several significant risks before it can be considered production-ready:

- **Cashfree online payments are non-functional end-to-end** — the Edge Function is undeployed, secrets are unconfigured, and the `/payment-return` redirect route is missing from the router.
- **WhatsApp notification dispatch is non-functional** — the Edge Function is undeployed and no opt-in mechanism exists in the registration form.
- **6 database migrations are unconfirmed as applied** — new tables and columns may not exist in the production database.
- **The main JavaScript bundle is 912 KB** (unminified) with no code splitting, causing slow initial loads.
- **The entire application UI lives in a single 424-line `App.jsx` file** — this is a maintainability liability.

Addressing the critical blockers in the [TODO list](TODO.md) is required before the platform can process real online payments.

---

## Repository & Branch Info

| Property | Value |
|---|---|
| **Repository URL** | https://github.com/muppidathishanmugavel/eventflow-platform |
| **Active Branch** | `feat/central-payments-branding-whatsapp-pwa` |
| **Commits Ahead of `main`** | 36 |
| **Total Branches** | 2 (`main`, `feat/central-payments-branding-whatsapp-pwa`) |
| **Open Pull Requests** | None visible |
| **Production URL** | https://eventflow-platform-eta.vercel.app/ |
| **Supabase Project Ref** | `vdfgwpocjacvfqfhctua` |

> [!WARNING]
> The feature branch is 36 commits ahead of `main` with no open PR. If `main` is used as the deployment source, it is severely out of date. Confirm that Vercel is deploying from the feature branch or merge to `main` before the next release.

---

## Tech Stack

### Frontend
| Technology | Version | Role |
|---|---|---|
| **React** | `^19.1.1` | UI framework |
| **React DOM** | `^19.1.1` | DOM renderer |
| **Vite** | `^7.1.12` | Build tool and dev server |
| **react-router-dom** | `^7.9.4` | Client-side routing |
| **lucide-react** | `^0.468.0` | Icon library |
| **qrcode.react** | `^4.2.0` | QR code generation (participant QR) |
| **html5-qrcode** | `^2.3.8` | Camera-based QR scanner (check-in) |
| **JavaScript (ES2022+)** | — | No TypeScript |

### Backend / Infrastructure
| Technology | Version / Tier | Role |
|---|---|---|
| **Supabase Auth** | Cloud (free/pro) | Authentication (email+password) |
| **Supabase Postgres** | Cloud | Primary database with RLS |
| **Supabase Storage** | Cloud | Payment proof file uploads |
| **Supabase Edge Functions** | Deno runtime | Cashfree payment processing, WhatsApp dispatch |
| **Vercel** | Hobby/Pro | Frontend hosting and CDN |
| **Cashfree Payments** | API v2025-01-01 | Online payment gateway |
| **WhatsApp Cloud API** | Meta Graph API | Participant notifications |

### Key Libraries
| Library | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | `^2.58.0` | Supabase client SDK |
| `@vitejs/plugin-react` | `^5.0.4` | Vite React plugin (SWC) |

---

## File Structure Analysis

```
eventflow-platform/
├── index.html                        # App shell, PWA meta tags, manifest link
├── vite.config.js                    # Vite config — no manual chunks configured
├── vercel.json                       # SPA rewrite rule (/* → /index.html)
├── package.json                      # Dependencies
├── supabase/
│   ├── schema.sql                    # Base schema — complete
│   ├── migrations/                   # 6 additive migration files
│   │   ├── 20261119_eventflow_platform_upgrade.sql
│   │   ├── 20261119_eventflow_event_permissions.sql
│   │   ├── 20261119_eventflow_security_and_permissions_hardening.sql
│   │   ├── 20261119_eventflow_whatsapp_optin_guard.sql
│   │   ├── 20261119_eventflow_multi_organisation_team_scope.sql
│   │   └── 20261119_eventflow_fund_claims.sql
│   └── functions/                    # 3 Deno Edge Functions
│       ├── cashfree-create-order/    # Creates Cashfree payment orders
│       ├── cashfree-webhook/         # Handles Cashfree payment webhooks
│       └── dispatch-whatsapp/        # Sends WhatsApp template messages
├── src/
│   ├── App.jsx                       # ⚠️ MONOLITHIC — 424 lines, entire app UI
│   ├── LegalPages.jsx                # Legal page components
│   ├── main.jsx                      # Entry point, SW registration
│   ├── styles.css                    # Global styles
│   └── lib/
│       ├── supabase.js               # Supabase client singleton
│       └── cashfree.js               # Cashfree JS SDK helper
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service worker
│   └── icons/                        # PWA icons
└── docs/                             # Additional documentation
```

### Critical Structural Issues

| File | Issue | Severity |
|---|---|---|
| `src/App.jsx` | 424-line monolith containing all routes, state, and UI | 🔴 High |
| `vite.config.js` | No `build.rollupOptions.output.manualChunks` configured | 🟠 Medium |
| `src/lib/cashfree.js` | Written but payment button not wired into registration form | 🔴 High |
| `supabase/migrations/` | 6 files written but not confirmed applied to production | 🔴 High |

---

## Build Status

```
✅ BUILD PASSES (exit code 0)

Tool: Vite 7.3.8
Modules transformed: 1,663
Output:
  dist/assets/index-[hash].js    912 KB   ⚠️ CHUNK SIZE WARNING
  dist/assets/index-[hash].css   37 KB
  dist/index.html                ~2 KB

Warning: Some chunks are larger than 500 kB after minification.
```

> [!WARNING]
> Vite itself reports a chunk size warning. The 912 KB JavaScript bundle will significantly harm Largest Contentful Paint (LCP) and Time to Interactive (TTI), particularly on mobile connections. Code splitting is required.

---

## Security Analysis

### ✅ Positive Security Controls
- **Row Level Security (RLS)** is enabled on all Supabase tables.
- **Private storage bucket** (`payment-proofs`) — not publicly readable.
- **Service-role-only RPCs** — `confirm_cashfree_payment` is callable only by the service role, not by anonymous or authenticated users.
- **Webhook signature verification** — the Cashfree webhook Edge Function should verify the `x-webhook-signature` header using `CASHFREE_SECRET_KEY`.
- **CORS handling** — Edge Functions include CORS headers for preflight requests.

### ⚠️ Security Risks

| Risk | Severity | Detail |
|---|---|---|
| Secrets in `VITE_*` env vars | 🔴 Critical | `VITE_*` variables are embedded in the client bundle. Payment secrets and WhatsApp tokens must NEVER be `VITE_*` — use Supabase Edge Function secrets only. |
| No CAPTCHA on registration form | 🟠 Medium | High-volume events are vulnerable to spam registrations that consume storage and database resources. |
| No rate limiting on Edge Functions | 🟠 Medium | `cashfree-create-order` has no per-IP or per-email rate limit. |
| No `.env.example` for `VITE_CASHFREE_MODE` | 🟡 Low | Developers cloning the repo won't know this variable is required. |
| `organization_members` email column | 🟡 Low | Email is stored redundantly alongside `user_id`; ensure it is always validated against `auth.users`. |

---

## Code Quality Issues

| Issue | Location | Impact |
|---|---|---|
| **Monolithic component** | `src/App.jsx` (424 lines) | All routes, state management, auth, and dashboard logic in one file. Near-impossible to test, review, or maintain at scale. |
| **No TypeScript** | Entire `src/` | No compile-time type safety. Supabase response shapes are unvalidated. |
| **No automated tests** | Entire project | Zero unit, integration, or E2E tests. |
| **Inline state management** | `src/App.jsx` | All state (`useState`, `useEffect`) lives in the root component with no context, Zustand, or Redux. Prop drilling will worsen as features grow. |
| **No error boundaries** | `src/App.jsx` | A runtime error in any component crashes the entire app. |
| **Console logging** | Multiple files | `console.log` / `console.error` calls should be replaced with a structured logger before production. |
| **Hardcoded strings** | `src/App.jsx` | UI strings, error messages, and labels are not externalised. Internationalisation will require a full refactor. |
| **Missing loading states** | Multiple routes | Some async Supabase calls may not display a loading spinner, causing blank UI flashes. |

---

## Performance Issues

| Issue | Impact | Recommended Fix |
|---|---|---|
| **912 KB single JS chunk** | Slow initial load on all pages (including landing page which needs <100 KB) | Add `build.rollupOptions.output.manualChunks` in `vite.config.js` to split vendor, router, and page chunks |
| **No lazy loading** | All routes are eagerly imported — the QR scanner library loads even on the landing page | Use `React.lazy()` + `Suspense` for route-level code splitting |
| **`html5-qrcode` (heavy)** | The QR scanner library (~250 KB) loads for all users | Dynamically import only when the check-in route is active |
| **No image optimisation** | Supabase Storage URLs served without resizing | Use Supabase Image Transformation to serve appropriately sized images |
| **No caching headers** | Vercel serves assets without long-lived cache headers for hashed chunks | Add `Cache-Control: public, max-age=31536000, immutable` for `dist/assets/*` in `vercel.json` |

---

## Dependencies

### Production Dependencies

| Package | Version Spec | Current Role | Notes |
|---|---|---|---|
| `@supabase/supabase-js` | `^2.58.0` | Database, auth, storage, edge calls | Stable. Keep updated for security patches. |
| `html5-qrcode` | `^2.3.8` | Camera QR scanner | Last published 2023 — evaluate `@zxing/library` as alternative. |
| `lucide-react` | `^0.468.0` | Icons | Stable. Tree-shakes well with Vite. |
| `qrcode.react` | `^4.2.0` | QR code rendering | Stable. |
| `react` | `^19.1.1` | UI framework | React 19 — latest stable. |
| `react-dom` | `^19.1.1` | DOM renderer | Matches React version. |
| `react-router-dom` | `^7.9.4` | Routing | v7 — breaking changes from v6. Confirm all route APIs used are v7 compatible. |

### Dev Dependencies

| Package | Version Spec | Role |
|---|---|---|
| `@vitejs/plugin-react` | `^5.0.4` | Vite React plugin (uses SWC) |
| `vite` | `^7.1.12` | Build tool |

> [!NOTE]
> No linting (ESLint), formatting (Prettier), or type-checking (TypeScript/JSDoc) tools are present in `devDependencies`. Adding these is strongly recommended before onboarding additional developers.

---

## Key Findings and Risks

### 🔴 Critical — Must Fix Before Production Payments

1. **`/payment-return` route is missing** — Cashfree redirects users to this URL after checkout. It currently returns a 404. This will cause every online payment to end in confusion.
2. **Cashfree Edge Functions not deployed** — Without `cashfree-create-order` running, users cannot initiate online checkout.
3. **6 database migrations unconfirmed** — New columns (`cashfree_order_id`, `whatsapp_opt_in`, etc.) and new tables (`payment_orders`, `notification_outbox`, etc.) may not exist in the production Supabase project.
4. **Cashfree payment button not in UI** — Even with the backend fixed, there is no way for a user to click "Pay Online" in the registration form.

### 🟠 High — Functionality Gaps

5. **WhatsApp is entirely non-functional** — `dispatch-whatsapp` is undeployed, opt-in is not collected, and no notification controls exist in the dashboard.
6. **Fund claims only work for Cashfree payments** — Manual UPI payments never create `payment_orders` rows, so they won't appear in `get_fund_claim_summary`.
7. **Multi-org workspace switcher may be incomplete** — `loadWorkspace()` may still query only the first membership; needs verification.

### 🟡 Medium — Maintainability

8. **Monolithic `App.jsx`** — 424 lines is already hard to navigate. It will become unmanageable. Refactor into route-level components.
9. **No tests** — Any refactoring carries unquantified regression risk.
10. **No TypeScript** — Supabase query results are untyped; a schema mismatch will only surface at runtime.

### 🟢 Lower Priority

11. **No branding editor** — Logo/colour upload UI is not built despite the database columns existing.
12. **No bib lookup form** — The `lookup_participant_bib` RPC is defined but no public-facing form uses it.
13. **No volunteer assignment UI** — `event_assignments` table and `has_event_permission` RPC exist but no dashboard UI.
14. **PWA install prompt** — Manifest and SW are wired, but no "Add to Home Screen" prompt is shown to users.

---

*For actionable next steps, see [TODO.md](TODO.md). For deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). For database schema details, see [DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md).*
