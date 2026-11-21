# EventFlow — Freemium Pricing & Event Billing System

## 1. Overview & Business Model

EventFlow operates on a simple, transparent freemium pricing structure designed for event organisers (marathons, sports meets, college fests, charity runs):

* **Free Tier (First 3 Events):**
  * Every organisation receives its first **3 events completely free** (₹0 platform access fee).
  * Full access to core features: registration pages, custom categories, online Cashfree checkout, QR check-in, CSV data export, and WhatsApp messaging links.
  * No credit card or pre-authorization required.
* **Pay-Per-Event Tier (4th Event Onwards):**
  * **₹999 per event** (99,900 paise INR).
  * **One-time payment** per event.
  * **No monthly subscription** and **no annual commitment**.
  * Each subsequent event requires a separate ₹999 payment to unlock public publishing and participant registrations.
  * **Strict Separation of Funds:** The ₹999 platform fee is independent of participant ticket fees (organisers keep 100% of participant ticket collections).

---

## 2. Organisation-Level Quota Architecture

The 3-event free quota is enforced **strictly at the organisation level**, not per user account:

* Multiple staff or admin members in the same organisation share the same 3-event free quota.
* Creating secondary accounts within an existing organisation does not grant additional free events.
* An organisation cannot bypass quota by renaming or duplicating events.

### Database Schema Changes (`supabase/migrations/20261121_freemium_event_billing.sql`)

1. **`public.organizations` Table:**
   * `free_event_limit` (`integer not null default 3`): Organisation-level free event cap.
   * `billing_notes` (`text`): Administrative notes.

2. **`public.events` Table:**
   * `billing_type` (`text`): `'free'`, `'paid'`, or `'complimentary'`.
   * `platform_fee_amount` (`numeric(10,2)`): Default `0.00` for free events, `999.00` for paid events.
   * `platform_fee_currency` (`text`): Default `'INR'`.
   * `billing_status` (`text`): `'free'`, `'pending'`, `'paid'`, or `'failed'`.
   * `platform_fee_order_id` (`text`): Reference to Cashfree order (`ef_fee_...`).
   * `platform_fee_paid_at` (`timestamptz`): Timestamp when payment was verified.
   * `complimentary_reason` (`text`): Reason if unlocked via admin waiver.
   * `complimentary_granted_by` (`uuid`): Admin user ID who authorized waiver.
   * **Database Constraint:** `check (status != 'published' or billing_status in ('free', 'paid'))` prevents any event from being published while billing is pending.

3. **`public.platform_fee_orders` Table:**
   * Dedicated table tracking all platform fee transactions separately from participant tickets.
   * Columns: `id`, `organization_id`, `event_id`, `provider`, `provider_order_id`, `payment_session_id`, `amount`, `currency`, `status`, `provider_payment_id`, `provider_payload`, `created_at`, `paid_at`.
   * Protected with Row Level Security (RLS).

4. **Security Definer Database Functions (RPCs):**
   * `get_organization_event_quota(p_organization_id)`: Atomically calculates free events used, remaining quota, paid events count, and total platform fees paid.
   * `confirm_platform_fee_payment(p_provider_order_id, p_provider_payment_id, p_paid_amount)`: Idempotently verifies order and updates both `platform_fee_orders` and `events.billing_status = 'paid'`.
   * `grant_complimentary_event(p_event_id, p_reason)`: Authorised organisation administrator waiver RPC.
   * `get_platform_billing_overview()`: Platform administration overview metrics.

---

## 3. Cashfree Payment Integration

### Edge Functions:

1. **`supabase/functions/cashfree-create-order/index.ts`:**
   * Supports `order_type: 'event_platform_fee'` for ₹999 platform fee orders.
   * Uses Cashfree Order API (`x-api-version: 2025-01-01`).
   * Generates unique order ID with prefix `ef_fee_...`.
   * Customer details assigned to organisation context.
   * Return URL: `/admin?billing_return=1&event_id={event_id}&order_id={order_id}`.
   * Also provides direct server verification via `action: 'verify_platform_fee'`, verifying order status directly against Cashfree's server.

2. **`supabase/functions/cashfree-webhook/index.ts`:**
   * Inspects webhook payload order ID.
   * Orders starting with `ef_fee_` route to `confirm_platform_fee_payment`.
   * Participant ticket orders route to `confirm_cashfree_payment`.

3. **Frontend SDK Helper (`src/lib/cashfree.js`):**
   * `startPlatformFeeCheckout(eventId)`: Launches Cashfree checkout for ₹999.
   * `verifyPlatformFeeOrder(orderId)`: Calls backend verification without relying on browser client redirects.

---

## 4. Organiser Dashboard Experience

* **Sidebar Quota Tracker:** Shows current organisation quota (`X / 3 Free Events Used`) with progress bar and status badge.
* **Event Creation Form:** Automatically informs organiser whether the new event will be created on the Free Plan or under the ₹999 Pay-Per-Event plan.
* **Publishing Guard & Unlock Banner:**
  * Draft events created after the 3 free events show a banner: *"₹999 Platform Access Fee Required to Publish"*.
  * The *"Publish event"* button is replaced by *"Pay ₹999 to publish"*.
* **Payment Unlock Modal (`PaymentUnlockModal`):**
  * Displays transparent fee details (₹999 INR, one-time payment, no subscriptions).
  * Value checklist of all included features.
  * Launches Cashfree checkout.
* **Billing & Quota Tab (`BillingPanel`):**
  * Visual quota progress bar (`3 / 3 Free Events Used`).
  * 4 Summary metrics cards (Free available, Free used, Paid events created, Total fees paid).
  * Pricing Tier comparison cards (Free Plan vs Pay-Per-Event).
  * Complete Event Billing History table with receipt links and status indicators.
* **Printable Receipt (`FeeReceiptModal`):**
  * Official tax invoice / receipt with organisation name, date, event details, order reference, and 1-click print option.
* **Administrative Waiver Modal (`AdminWaiverModal`):**
  * Allows authorized admins to unlock events with an audit-logged reason.
