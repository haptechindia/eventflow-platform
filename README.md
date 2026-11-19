# EventFlow — reusable event registration & operations platform

A multi-organisation web application for event organisers. One deployment can host multiple organisations and as many events as each organisation needs. The starter is designed for marathons, sports meets, charity runs, college festivals and community events.

## Included in this starter

- Public event directory and shareable event registration pages (`/e/:slug`).
- Organiser sign-up/sign-in with Supabase Auth.
- Separate organisation workspaces with tenant-scoped database access.
- One user account can own or join multiple organisations, switch between workspaces, and create additional organisations from the dashboard.
- Each organisation has its own events, team membership, branding and event-level operations; users only see workspaces they belong to.
- Workspace team management: add existing accounts as admins or check-in staff.
- Event creation with description, date, venue, currency, UPI instructions, categories and category fees.
- Draft/published event state and public registration links / QR codes.
- Participant registration with duplicate participant protection per event (same email and participant name).
- Optional private payment-proof upload and transaction reference.
- Admin payment verification / rejection.
- Sequential bib allocation on payment approval.
- Participant search, payment filters and CSV export.
- QR pass for confirmed participants and camera/manual check-in.
- Supabase Postgres RLS and private Storage policies.
- Vercel SPA routing configuration.

## Stack

- React + Vite
- Supabase Auth, Postgres, RPC functions, Row Level Security and Storage
- Vercel for frontend hosting

## 1. Create and configure Supabase

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open **SQL Editor → New query**.
3. Copy the complete contents of `supabase/schema.sql` into the editor and run it.
4. Open **Project Settings → API** (or the Connect panel) and copy:
   - Project URL
   - Publishable key (or legacy `anon` key)
5. In **Authentication → URL Configuration**, set your Site URL to your Vercel URL after deployment. Add redirect URLs for your production domain and `http://localhost:5173/**`.
6. Keep email confirmation enabled for production. New users may need to confirm their email before signing in.

The SQL creates the private `payment-proofs` Storage bucket and its policies. Do not change that bucket to public.

## 2. Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Then start the app:

```bash
npm run dev
```

Open `http://localhost:5173`.

## 3. First organiser setup

1. Open `/admin`.
2. Create an organiser account with an email address and password.
3. Confirm the email if Supabase email confirmation is enabled, then sign in.
4. Create your organisation workspace, e.g. `Natura's Trust`.
5. Create an event and save it as a draft.
6. Publish the event when the details, categories and fees are correct.
7. Copy the registration link or QR code from the Event page tab.

Participants can register without creating an account. They receive a unique registration code. Their payment remains pending until an organiser verifies it.

## 4. Deploy through GitHub + Vercel

1. Create a new GitHub repository, for example `eventflow-platform`.
2. Upload/push the contents of this folder to the repository root (do not upload `.env.local` or `node_modules`).
3. In [Vercel](https://vercel.com/dashboard), choose **Add New → Project**, import the GitHub repository and keep the detected Vite settings:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
4. In Vercel **Project → Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Deploy. Add your Vercel domain to Supabase Auth URL Configuration and redeploy if needed.

Vercel will create a new deployment when you push later changes to the connected Git branch.

## 5. Suggested first live test

Before sharing a public registration link:

1. Create one draft test event with two categories and small test fees.
2. Publish it and open the public page in a private/incognito browser.
3. Register with a test email and upload a small JPG/PNG payment screenshot.
4. Sign into `/admin`, open the event and verify the payment.
5. Confirm that a bib number was assigned and a QR pass appears.
6. Open **Event-day check-in**, scan that QR from another screen or enter its code manually.
7. Export the participant CSV and check the downloaded file.
8. Test that one organiser cannot access another organisation's unpublished events or registrations.

## Security notes and current scope

- The frontend uses only the Supabase publishable/anon key. **Never put a Supabase `service_role` or secret key in a `VITE_*` variable, browser code, or GitHub.**
- RLS restricts organisation, event and participant records. Public registrations go through a database function that checks event state and category selection.
- Payment screenshots are held in a private bucket; the public cannot read stored screenshots. Admins obtain short-lived signed links.
- A participant's confirmation code is unguessable and is used for check-in; check-in requires a confirmed registration and organisation membership.
- The initial MVP has one owner-created workspace per signed-in account and supports multiple separate organisations in the same deployment. Team access is managed in the **Team** tab. Each added person must create and confirm their EventFlow account first; then an owner/admin can add that email as `staff` (view registrations and check in) or `admin` (manage events and verify payments).
- The app currently records payment transaction references and uploaded evidence, but it does **not** charge cards or verify UPI transactions automatically. Connect a payment gateway (for example, Razorpay/Cashfree) through a server-side integration before advertising automatic online payment.
- For a high-volume public event, add CAPTCHA / bot protection and server-side rate limiting to the registration endpoint. The database prevents the same participant name and email from being registered twice for one event, but that is not a complete anti-spam system.
- Camera QR scanning requires HTTPS and browser camera permission. Vercel production deployments use HTTPS.
- This project is a functional MVP starter; review event rules, privacy wording, payment workflow and operational recovery requirements before using it for paid events.

## Useful commands

```bash
npm run dev       # local development
npm run build     # production build
npm run preview   # preview the production build locally
```

## Project layout

```text
src/
  App.jsx                 # public pages, organiser workspace and registration flow
  styles.css              # responsive UI
  lib/supabase.js         # Supabase client setup
supabase/
  schema.sql              # schema, RPC functions, RLS and private proof bucket
.env.example              # required frontend environment variables
vercel.json               # SPA route fallback
```
