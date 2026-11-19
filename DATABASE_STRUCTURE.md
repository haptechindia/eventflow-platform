# EventFlow Platform — Database Structure

> **Database:** Supabase Postgres (project ref: `vdfgwpocjacvfqfhctua`)  
> **Last Updated:** 2026-11-19  
> **Source files:** `supabase/schema.sql`, `supabase/migrations/` (6 files)

---

## Overview

The EventFlow database is built in layers:

1. **`supabase/schema.sql`** — Base schema applied to a fresh project
2. **6 additive migrations** — Applied in strict order to an existing project; they add new columns, tables, RPCs, triggers, and RLS policies

> [!IMPORTANT]
> Never re-run `schema.sql` on an existing project — it will conflict with existing tables. On an existing project, **only apply the 6 migrations in order**.

---

## Base Tables

### `organizations`

Represents a sporting event organisation or club. One user can belong to multiple organisations.

```sql
CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

**Migration 1 adds:**

| Column | Type | Default | Description |
|---|---|---|---|
| `logo_url` | `text` | `NULL` | Supabase Storage URL of organisation logo |
| `brand_primary_color` | `text` | `NULL` | Hex colour for primary branding |
| `brand_secondary_color` | `text` | `NULL` | Hex colour for secondary branding |

---

### `organization_members`

Join table linking users to organisations with a role. One user can be a member of many organisations.

```sql
CREATE TABLE organization_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text NOT NULL,
  role             text NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
```

---

### `events`

An event created by an organisation. Identified publicly by its unique `slug`.

```sql
CREATE TABLE events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  description           text,
  venue                 text,
  city                  text,
  starts_on             date,
  base_fee              numeric(10,2),
  currency              text NOT NULL DEFAULT 'INR',
  categories            jsonb,                -- Array of category objects {name, fee, description}
  upi_id                text,
  payment_instructions  text,
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'closed')),
  registration_open     boolean NOT NULL DEFAULT false,
  next_bib_number       integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

**Migration 1 adds:**

| Column | Type | Default | Description |
|---|---|---|---|
| `tagline` | `text` | `NULL` | Short marketing tagline |
| `event_logo_url` | `text` | `NULL` | Event-specific logo |
| `banner_url` | `text` | `NULL` | Hero banner image |
| `brand_primary_color` | `text` | `NULL` | Event-level primary brand colour |
| `brand_secondary_color` | `text` | `NULL` | Event-level secondary brand colour |
| `sponsor_logos` | `jsonb` | `NULL` | Array of sponsor logo URLs |
| `confirmation_message` | `text` | `NULL` | Custom message shown after registration |
| `starts_at` | `timestamptz` | `NULL` | Full datetime of event start |
| `platform_fee_enabled` | `boolean` | `false` | Whether EventFlow platform fee is added |
| `platform_fee_percent` | `numeric(5,2)` | `5.00` | Platform fee percentage |
| `cashfree_enabled` | `boolean` | `false` | Whether Cashfree online payments are enabled |
| `whatsapp_updates_enabled` | `boolean` | `false` | Whether WhatsApp notifications are enabled for this event |

---

### `registrations`

A single participant registration for a specific event.

```sql
CREATE TABLE registrations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_code     text NOT NULL UNIQUE DEFAULT ('EF-' || substring(gen_random_uuid()::text, 1, 8)),
  full_name             text NOT NULL,
  email                 text NOT NULL,
  phone                 text NOT NULL,
  category              text,
  date_of_birth         date,
  emergency_contact     text,
  amount_due            numeric(10,2),
  transaction_reference text,               -- UPI transaction reference (manual)
  proof_path            text,               -- Supabase Storage path
  payment_status        text NOT NULL DEFAULT 'pending'
                          CHECK (payment_status IN ('pending', 'verified', 'rejected')),
  status                text NOT NULL DEFAULT 'submitted'
                          CHECK (status IN ('submitted', 'confirmed', 'cancelled')),
  bib_number            integer,
  checked_in_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

**Migration 1 adds:**

| Column | Type | Default | Description |
|---|---|---|---|
| `cashfree_order_id` | `text` | `NULL` | Cashfree order ID (`order_xxx`) |
| `cashfree_payment_id` | `text` | `NULL` | Cashfree payment ID after success |
| `platform_fee_amount` | `numeric(10,2)` | `0` | Platform fee charged |
| `total_paid` | `numeric(10,2)` | `NULL` | Total amount actually paid |
| `paid_at` | `timestamptz` | `NULL` | Timestamp of successful payment |
| `whatsapp_opt_in` | `boolean` | `false` | Whether participant consented to WhatsApp updates |

---

## New Tables (from Migrations)

### `payment_orders` *(Migration 1)*

Tracks individual Cashfree payment orders. One registration may have at most one active (non-failed) order.

```sql
CREATE TABLE payment_orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id      uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  event_id             uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  provider             text NOT NULL DEFAULT 'cashfree',
  provider_order_id    text NOT NULL UNIQUE,         -- Cashfree order_id
  provider_payment_id  text,                          -- Cashfree payment_id (after success)
  base_amount          numeric(10,2) NOT NULL,
  platform_fee_amount  numeric(10,2) NOT NULL DEFAULT 0,
  total_amount         numeric(10,2) NOT NULL,
  currency             text NOT NULL DEFAULT 'INR',
  payment_session_id   text,                          -- Used to initialise Cashfree JS SDK
  status               text NOT NULL DEFAULT 'created'
                         CHECK (status IN (
                           'created', 'pending', 'paid',
                           'failed', 'amount_mismatch', 'refunded'
                         )),
  provider_payload     jsonb,                          -- Raw webhook payload
  paid_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_active_order_per_registration
    UNIQUE NULLS NOT DISTINCT (registration_id) -- enforced via partial index on non-failed
);
```

---

### `event_assignments` *(Migration 2)*

Assigns volunteers or helpers to specific events with granular permissions. Separate from `organization_members` which is org-level.

```sql
CREATE TABLE event_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text NOT NULL,
  assignment_type  text NOT NULL CHECK (assignment_type IN ('volunteer', 'helper')),
  permissions      jsonb NOT NULL DEFAULT '{
    "view_participants": false,
    "approve_payments":  false,
    "send_messages":     false,
    "check_in":          true
  }'::jsonb,
  assigned_by      uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
```

**`permissions` JSONB structure:**

| Key | Type | Description |
|---|---|---|
| `view_participants` | `boolean` | Can see participant list |
| `approve_payments` | `boolean` | Can approve/reject payment proofs |
| `send_messages` | `boolean` | Can trigger WhatsApp announcements |
| `check_in` | `boolean` | Can perform event-day check-in |

---

### `notification_outbox` *(Migration 4)*

Outbox pattern for reliable WhatsApp and email notifications. Rows are inserted by DB triggers or RPCs and consumed by the `dispatch-whatsapp` Edge Function.

```sql
CREATE TABLE notification_outbox (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             uuid REFERENCES events(id) ON DELETE SET NULL,
  registration_id      uuid REFERENCES registrations(id) ON DELETE SET NULL,
  channel              text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  recipient            text NOT NULL,          -- Phone or email address
  template_name        text NOT NULL,
  language_code        text NOT NULL DEFAULT 'en',
  template_parameters  jsonb,
  dedupe_key           text NOT NULL UNIQUE,   -- Prevents duplicate sends
  status               text NOT NULL DEFAULT 'queued'
                         CHECK (status IN (
                           'queued', 'processing', 'sent',
                           'failed', 'skipped'
                         )),
  attempts             integer NOT NULL DEFAULT 0,
  provider_message_id  text,
  last_error           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz
);
```

---

### `fund_claims` *(Migration 6)*

Tracks payout requests from event organisers. The EventFlow platform charges a 5% fee on each claim.

```sql
CREATE TABLE fund_claims (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by        uuid NOT NULL REFERENCES auth.users(id),
  gross_amount        numeric(10,2) NOT NULL,     -- Total collected from Cashfree
  fee_amount          numeric(10,2) NOT NULL,     -- Platform fee (5%)
  net_amount          numeric(10,2) NOT NULL,     -- gross - fee
  currency            text NOT NULL DEFAULT 'INR',
  fee_percent         numeric(5,2) NOT NULL DEFAULT 5.00,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
  cashfree_transfer_id text,                      -- Cashfree payout transfer ID
  admin_note          text,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz
);
```

---

## RPC Functions

### Base Functions (from `schema.sql`)

| Function | Signature | Caller | Purpose |
|---|---|---|---|
| `create_organization` | `(org_name text) → uuid` | Authenticated user | Creates an org and adds caller as `owner` |
| `add_organization_member` | `(org_id uuid, member_email text, member_role text) → void` *(updated M5)* | Admin/owner | Adds a user to an org by email; M5 adds `org_id` param and scoping check |
| `register_participant` | `(event_id uuid, ...) → uuid` | Anonymous | Inserts a new registration; validates event is published and registration open |
| `attach_payment_proof` | `(reg_id uuid, storage_path text) → void` *(updated M3)* | Authenticated | Attaches proof storage path to registration; M3 adds RLS guards |
| `approve_registration` | `(reg_id uuid) → void` *(updated M3)* | Staff/admin/owner | Sets `payment_status=verified`, `status=confirmed`, assigns next `bib_number` |
| `reject_registration` | `(reg_id uuid) → void` *(updated M3)* | Staff/admin/owner | Sets `payment_status=rejected` |
| `check_in_registration` | `(reg_id uuid) → void` *(updated M3)* | Staff/admin/owner/volunteer | Sets `checked_in_at = now()` |
| `can_upload_payment_proof` | `(reg_id uuid) → boolean` | Authenticated | Returns true if caller owns the registration and proof is not yet uploaded |
| `is_org_member` | `(org_id uuid) → boolean` | Authenticated | Returns true if caller is a member of the org |
| `is_org_admin` | `(org_id uuid) → boolean` | Authenticated | Returns true if caller has `admin` or `owner` role in org |

### New Functions (from Migrations)

| Function | Signature | Caller | Purpose |
|---|---|---|---|
| `has_event_permission` | `(p_event_id uuid, permission_name text) → boolean` | Authenticated | Returns true if caller has the named permission for the event (via `event_assignments`) |
| `lookup_participant_bib` | `(event_slug text, full_name text, phone text) → table(bib_number int, full_name text, status text, checked_in_at timestamptz)` | Anonymous | Public bib number lookup by name and phone |
| `confirm_cashfree_payment` | `(provider_order_id text, provider_payment_id text, paid_amount numeric) → void` | Service role only | Called by `cashfree-webhook`; updates `payment_orders` and `registrations`; triggers WhatsApp queue |
| `get_fund_claim_summary` | `(p_event_id uuid) → table(gross_amount numeric, fee_amount numeric, net_amount numeric, currency text)` | Admin/owner | Aggregates all `paid` `payment_orders` rows for an event minus existing claims |
| `request_fund_claim` | `(p_event_id uuid) → uuid` | Admin/owner | Inserts a `fund_claims` row with current summary amounts |
| `update_fund_claim` | `(claim_id uuid, new_status text, transfer_id text, note text) → void` | EventFlow platform admin | Updates claim status after processing payout |
| `set_updated_at` | `() → trigger` | DB trigger | Sets `updated_at = now()` on `events` and `registrations` |
| `queue_event_change_notifications` | `() → trigger` | DB trigger | On `registrations` update: inserts rows into `notification_outbox` for WhatsApp dispatch |

---

## Triggers

| Trigger Name | Table | Event | Function | Purpose |
|---|---|---|---|---|
| `events_set_updated_at` | `events` | `BEFORE UPDATE` | `set_updated_at()` | Keeps `updated_at` current |
| `registrations_set_updated_at` | `registrations` | `BEFORE UPDATE` | `set_updated_at()` | Keeps `updated_at` current |
| `events_queue_change_notifications` | `registrations` | `AFTER UPDATE` | `queue_event_change_notifications()` | Queues WhatsApp notification when registration `status` or `payment_status` changes |

---

## RLS Policies

### `organizations`

| Policy Name | Command | Role | Condition |
|---|---|---|---|
| `org_member_select` | `SELECT` | Authenticated | Caller is a member of the org (`is_org_member(id)`) |
| `org_owner_update` | `UPDATE` | Authenticated | Caller is an admin or owner (`is_org_admin(id)`) |

### `organization_members`

| Policy Name | Command | Role | Condition |
|---|---|---|---|
| `org_member_view` | `SELECT` | Authenticated | Caller is a member of the same org |
| `org_admin_insert` | `INSERT` | Authenticated | Caller is an admin or owner of the org |
| `org_admin_delete` | `DELETE` | Authenticated | Caller is an admin or owner of the org |

### `events`

| Policy Name | Command | Role | Condition |
|---|---|---|---|
| `public_event_select` | `SELECT` | Anon + Authenticated | Status is `published` (or caller is an org member) |
| `org_member_insert` | `INSERT` | Authenticated | Caller is a member of the org |
| `org_admin_update` | `UPDATE` | Authenticated | Caller is an admin or owner of the org |
| `org_admin_delete` | `DELETE` | Authenticated | Caller is an admin or owner of the org |

### `registrations`

| Policy Name | Command | Role | Condition |
|---|---|---|---|
| `anon_insert` | `INSERT` | Anon + Authenticated | Event is published and registration is open |
| `self_select` | `SELECT` | Authenticated | Caller's email matches `email` column (own registration) |
| `org_member_select` | `SELECT` | Authenticated | Caller is a member of the event's organisation |
| `event_assignment_select` | `SELECT` | Authenticated | Caller has `view_participants` permission via `event_assignments` |
| `org_member_update` | `UPDATE` | Authenticated | Caller is a member of the event's organisation (for approve/reject/check-in via RPCs) |

### `payment_orders`

| Policy Name | Command | Role | Condition |
|---|---|---|---|
| `org_member_select` | `SELECT` | Authenticated | Caller is a member of the event's organisation |
| `service_insert` | `INSERT` | Service role | Only `cashfree-create-order` Edge Function (service role) can insert |
| `service_update` | `UPDATE` | Service role | Only `cashfree-webhook` Edge Function (service role) can update |

### `event_assignments`

| Policy Name | Command | Role | Condition |
|---|---|---|---|
| `org_admin_all` | `ALL` | Authenticated | Caller is an admin or owner of the event's organisation |
| `self_select` | `SELECT` | Authenticated | `user_id = auth.uid()` |

### `notification_outbox`

| Policy Name | Command | Role | Condition |
|---|---|---|---|
| `org_admin_select` | `SELECT` | Authenticated | Caller is an admin or owner of the event's organisation |
| `service_all` | `ALL` | Service role | Only Edge Functions can insert/update/delete outbox rows |

### `fund_claims`

| Policy Name | Command | Role | Condition |
|---|---|---|---|
| `org_admin_select` | `SELECT` | Authenticated | Caller is an admin or owner of the organisation |
| `service_update` | `UPDATE` | Service role | Only platform admin (service role) can update status |

---

## Indexes

| Index Name | Table | Columns | Purpose |
|---|---|---|---|
| `idx_events_slug` | `events` | `slug` | Fast event lookup by public URL slug |
| `idx_events_org` | `events` | `organization_id` | List events by org |
| `idx_registrations_event` | `registrations` | `event_id` | List registrations by event |
| `idx_registrations_email` | `registrations` | `email` | Search/lookup by participant email |
| `idx_registrations_code` | `registrations` | `registration_code` | QR check-in lookup |
| `idx_payment_orders_reg` | `payment_orders` | `registration_id` | Join from registrations |
| `idx_payment_orders_provider` | `payment_orders` | `provider_order_id` | Webhook lookup by Cashfree order ID |
| `idx_event_assignments_event` | `event_assignments` | `event_id` | List assignments per event |
| `idx_event_assignments_user` | `event_assignments` | `user_id` | List events a user is assigned to |
| `idx_notification_outbox_status` | `notification_outbox` | `status, created_at` | Worker query: fetch queued rows |
| `idx_notification_outbox_dedupe` | `notification_outbox` | `dedupe_key` | Enforce idempotency |
| `idx_fund_claims_event` | `fund_claims` | `event_id` | List claims per event |
| `idx_org_members_user` | `organization_members` | `user_id` | List orgs a user belongs to |

---

## Storage Buckets

| Bucket Name | Access | Max File Size | Allowed MIME Types | Purpose |
|---|---|---|---|---|
| `payment-proofs` | **Private** | 5 MB | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` | Payment proof uploads from registration form |

> [!NOTE]
> A second storage bucket for event assets (logos, banners, sponsor logos) is **not yet created**. The columns (`event_logo_url`, `banner_url`, `sponsor_logos`) exist in the database but there is no bucket to store these files. This must be created before the branding editor UI can be built.

---

## Migration Execution Order

> [!CAUTION]
> These migrations **must be applied in the exact order listed below** on an existing Supabase project. Applying them out of order will cause foreign key or function-dependency errors.

Apply each file via the Supabase Dashboard → SQL Editor → "New Query" → paste contents → Run:

| Order | File | Key Dependency |
|---|---|---|
| 1 | `20261119_eventflow_platform_upgrade.sql` | Base schema must exist |
| 2 | `20261119_eventflow_event_permissions.sql` | Migration 1 (`payment_orders` table) must exist |
| 3 | `20261119_eventflow_security_and_permissions_hardening.sql` | Migration 2 (`event_assignments`, `has_event_permission`) must exist |
| 4 | `20261119_eventflow_whatsapp_optin_guard.sql` | Migration 1 (`whatsapp_opt_in` column) must exist |
| 5 | `20261119_eventflow_multi_organisation_team_scope.sql` | Migration 3 (updated `add_organization_member`) must exist |
| 6 | `20261119_eventflow_fund_claims.sql` | Migration 1 (`payment_orders`) and Migration 2 (`event_assignments`) must exist |

---

*For deployment steps, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). For current feature completion status, see [PROJECT_STATUS.md](PROJECT_STATUS.md).*
