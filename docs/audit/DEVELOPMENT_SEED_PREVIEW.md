# Phase 4.3 development import and synthetic seed preview

Preview date: 2026-10-09. **Zero Neon writes.** The approved endpoint ID was
checked by `migrations.database.direct_development_url()` using only
`.env.development`; the direct connection asserted read-only mode. The live
Alembic revision is exactly `20261009_0006`, and `report.reason` is nullable.

| Current public table | Rows |
| --- | ---: |
| `user`, `driver_profile`, `student_profile` | 0 each |
| `area`, `university`, `route` | 0 each |
| `ride_request`, `routestudents`, `report`, `routedemand` | 0 each |
| `playing_with_neon` | 0 |

The newer nationwide read-only dry run found 19 government-sourced governorate
names and 13 institution candidates: five public and eight private. All 13
names are absent from the empty development `university` table, with zero
exact matches and zero current conflicts. This is a **candidate-only**
comparison, not 13 approved inserts. Sources: Ministry
[public](https://mohesr.gov.iq/ar/home/public_universities) and
[private](https://mohesr.gov.iq/ar/home/private_universities/) lists. No
verified subdivision or pickup-area rows exist; approved inserts and updates
remain zero. The institution lists are incomplete and source reuse terms
need review.

| Record kind | Offline synthetic plan after reference gate | Ready to insert now |
| --- | ---: | ---: |
| Admin | 1 | 0 |
| Drivers | 5: 3 active approved, 1 pending approval, 1 suspended approved | 0 |
| Students | 12 | 0 |
| Routes | 4 using resolved canonical area and university IDs | 0 |
| Ride requests | 3 pending, 2 accepted, 2 declined | 0 |
| Active enrollments | 2, attached only to accepted requests | 0 |
| Reports | 3, with owner-scoped reporter and separate public/private fields | 0 |
| Route demand | 3, never counted as occupied seats | 0 |

`tools/phase43_synthetic_plan.py` generates the deterministic offline account
handles and counts. Every email ends in `@example.test`. There are no phone
numbers, identity documents or passwords in the plan. Future Driver profile
fixtures must use explicitly non-dialable placeholder contacts and document
identifiers. A future seeder must obtain a local secret at run time, hash it
with the existing backend helper and never print or commit it. It must also
resolve actual integer foreign keys before building routes, enforce capacity
and status consistency, use a dedicated synthetic namespace, and offer a
reviewed cleanup by those exact synthetic keys. It may never delete real rows.

## Import gates and replay policy

- Inspect the actual government area files and individual licences across all
  19 governorates, validate hierarchy and pickup semantics, then produce a
  complete source-attributed manifest. A district is not automatically a
  neighborhood. Halabja needs a post-2025 subdivision source.
- Confirm a **current, restorable development snapshot** in Neon and retain
  its ID/evidence. The older pre-migration snapshot is insufficient evidence
  for this import. Snapshot state was not verifiable through the read-only SQL
  session.
- Re-run `tools/nationwide_catalogue_import.py --development` to verify the
  current `0006` baseline. After any separately approved `0007` migration,
  update the importer revision gate and repeat the read-only preview before
  any proposed import; stop if endpoint, revision or conflicts differ.
- Obtain separate approval for the exact reviewed insert/update counts.
  The present preview authorizes **zero** inserts and **zero** updates.
- An eventual importer must upsert only exact source-owned keys, retain DB
  IDs, refuse normalized collisions or divergent existing values, never
  auto-delete, and commit atomically. A second run should plan zero changes.

The seeding/import scripts are intentionally **not** write-capable. Proposed
revision `20261009_0007` has not been applied or approved. The nationwide
hierarchy, snapshot and local PostgreSQL test gates remain unresolved. No
demonstration or reference record has been inserted into Neon or elsewhere.
