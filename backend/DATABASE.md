# CampusFind Database Foundation (Phase 2)

This document describes the normalized PostgreSQL schema managed by Prisma ORM and instructions for connecting to a Supabase-hosted PostgreSQL database.

---

## 1. Relational Schema & Entities

All tables use **UUID primary keys** (`uuid`) and timezone-aware timestamps (`TIMESTAMPTZ(6)`). Binary image data is intentionally excluded from PostgreSQL; `item_images` and `claim_evidence` store object storage keys and URLs only.

| # | Prisma Model | Table Name | Purpose |
|---|--------------|------------|---------|
| 1 | `User` | `users` | University students, desk staff, and Campus Safety admins |
| 2 | `Category` | `categories` | Normalized item classification taxonomy |
| 3 | `Location` | `locations` | Campus buildings, zones, and custody desks |
| 4 | `Item` | `items` | Lost reports and found property intake records |
| 5 | `ItemImage` | `item_images` | Non-binary image storage references (`storage_key`, `public_url`) |
| 6 | `Match` | `matches` | Candidate pairings between lost and found items |
| 7 | `Claim` | `claims` | Ownership claims filed against found items |
| 8 | `ClaimEvidence` | `claim_evidence` | Structured proof items submitted with a claim |
| 9 | `AuditLog` | `audit_logs` | Immutable accountability ledger for administrative & custody actions |

---

## 2. Relationships & Deletion Restrictions

- **`User` → `Item` (`1:N`)**: `items.reported_by_id` references `users.id` with `ON DELETE RESTRICT`. Prevents deleting user accounts that own active or historical property reports.
- **`Category` → `Item` (`1:N`)**: `items.category_id` references `categories.id` with `ON DELETE RESTRICT`.
- **`Location` → `Item` (`1:N`)**: `items.location_id` references `locations.id` with `ON DELETE RESTRICT`.
- **`Item` → `ItemImage` (`1:N`)**: `item_images.item_id` references `items.id` with `ON DELETE CASCADE`.
- **`Item` ↔ `Match` (`N:M` via `matches`)**:
  - `matches.lost_item_id` → `items.id` (`ON DELETE RESTRICT`)
  - `matches.found_item_id` → `items.id` (`ON DELETE RESTRICT`)
  - `matches.reviewed_by_id` → `users.id` (`ON DELETE SET NULL`)
  - **Duplicate prevention**: `UNIQUE (lost_item_id, found_item_id)`.
- **`Item` & `User` → `Claim` (`1:N`)**:
  - `claims.item_id` → `items.id` (`ON DELETE RESTRICT`)
  - `claims.claimant_id` → `users.id` (`ON DELETE RESTRICT`)
  - `claims.reviewed_by_id` → `users.id` (`ON DELETE SET NULL`)
  - **Duplicate prevention**: `UNIQUE (item_id, claimant_id)` and `UNIQUE (claim_code)`.
- **`Claim` → `ClaimEvidence` (`1:N`)**: `claim_evidence.claim_id` references `claims.id` with `ON DELETE CASCADE`.
- **`User` / `Item` / `Match` / `Claim` → `AuditLog`**:
  - `audit_logs.actor_id` → `users.id` (`ON DELETE RESTRICT`)
  - Optional target references (`item_id`, `match_id`, `claim_id`) use `ON DELETE SET NULL` so audit trails remain intact.

---

## 3. PostgreSQL Enums

- `UserRole`: `STUDENT`, `STAFF`, `ADMIN`
- `ReportType`: `LOST`, `FOUND`
- `ItemStatus`: `OPEN`, `MATCHED`, `CLAIM_PENDING`, `VERIFIED`, `RETURNED`, `ARCHIVED`
- `MatchStatus`: `PENDING`, `CONFIRMED`, `DISMISSED`, `RESOLVED`
- `ClaimStatus`: `PENDING_REVIEW`, `NEEDS_INFO`, `APPROVED`, `REJECTED`, `COLLECTED`, `WITHDRAWN`
- `EvidenceType`: `TEXT_DESCRIPTION`, `SERIAL_NUMBER`, `RECEIPT_REFERENCE`, `EXTERNAL_DOCUMENT_URL`, `PHOTO_REFERENCE`
- `AuditAction`: `USER_REGISTERED`, `REPORT_CREATED`, `REPORT_UPDATED`, `REPORT_STATUS_CHANGED`, `MATCH_CREATED`, `MATCH_REVIEWED`, `CLAIM_SUBMITTED`, `CLAIM_REVIEWED`, `CUSTODY_RELEASED`

---

## 4. Connecting Supabase PostgreSQL

1. Create or open your project in the **Supabase Dashboard**.
2. Go to **Project Settings → Database → Connection String**.
3. Create `backend/.env` from `backend/.env.example` and configure both URLs:
   - **`DATABASE_URL`** (Transaction Pooler, port `6543`):
     Copy the **Transaction pooler** URI and append `?pgbouncer=true&connection_limit=1` (e.g., `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`).
   - **`DIRECT_URL`** (Direct connection or Session mode, port `5432`):
     Copy the **Direct connection** URI (used by `prisma migrate`) (e.g., `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`).
4. Apply the initial migration to Supabase:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

5. Seed development data (idempotent):

```bash
npm run db:seed
```

6. Verify the live database connection:

```bash
npm run db:test
```
