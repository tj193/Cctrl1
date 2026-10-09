# Nationwide catalogue import readiness and schema proposal

Date: 2026-10-09. Decision: **NOT READY FOR NEON IMPORT**. No production
connection, Neon write, schema migration, seed, frontend edit, commit, push
or deployment occurred. `tools/nationwide_catalogue_import.py --development`
ran a forced read-only comparison against the verified development endpoint.
It confirmed revision `20261009_0006`, 0 existing `area` rows, 13 institution
candidate names absent from `university`, and 0 exact/conflicting matches.
These are **hypothetical** inserts, not approved changes. Approved inserts
and updates are both 0.

## Source and coverage decision

The manifest verifies names of 19 governorates through an older COSIT
publication plus the 2025 Halabja law. It contains **zero** import-ready
districts, subdistricts, neighborhoods or pickup areas. The university files
contain 5 public and 8 private first-page candidates. Private names may have
changed or differ from Study in Iraq labels; for example the Ministry page
lists `كلية التراث الجامعة` while Study in Iraq lists `جامعة التراث`.
Treat this as a possible rename/alias, never two automatically distinct
institutions. Ministry HTML list reuse terms and complete private/public
coverage remain unverified. See the per-governorate matrix and source review.

## Existing schema and registration compatibility

Current `area` stores a display name and free-text `city`; it has no
governorate FK, parent, administrative level or pickup-eligibility marker.
Current `university` has a free-text governorate and no public/private kind.
`route.from_area_id`, Student profile/demand `area_id`, and
`route.to_university_id` use stable integer business IDs. Simply placing
districts into `area` would expose broad administrative units as pickup
choices. The existing Student/Driver APIs do not support a validated
Governorate → Area filter, and currently return all active areas/universities.
Student destination university must remain selectable across governorates.

The proposed, **unapplied** revision `20261009_0007` adds `governorate` and
`catalogue_location` hierarchy tables, one nullable `area` link and six
nullable `university` fields (governorate FK, kind, catalogue key, source
URL/date and verification status). It preserves all old columns, IDs, FKs
and records; it contains no data copy, rename, delete or enum change.
The guarded downgrade refuses to drop new structure if any new table contains
rows or any new link/metadata field is populated. It does not touch the
known `area.uq_area_name_city` mismatch.

The current SQLModel models intentionally remain at revision `0006` so the
running API continues to query only columns that exist today. Before any
approved `0007` upgrade, prepare matching SQLModel models and catalogue
endpoints as a coordinated release. The proposed migration is for review,
not execution. Its DDL establishes level values, source attribution and
unique keys, but application validation must additionally enforce correct
parent level, same-governorate ancestry, pickup eligibility and university
governorate mapping. Existing `university.governorate` is a legacy string;
it must be reconciled explicitly, not silently rewritten.

## Importer and dry-run behavior

The command below validates all 19 names, Halabja, source references,
normalized-name uniqueness and institution governorate links, then prints
coverage and blockers. It opens a direct development connection only with
`--development`, using `.env.development` and read-only transactions.
`--apply` refuses before opening any connection while coverage is incomplete.

```powershell
.venv\Scripts\python.exe tools\nationwide_catalogue_import.py --development
```

Dry-run output: 19 verified governorate names; 0 subdivisions and pickup
areas; 13 institution candidates (5 public, 8 private); 0 approved inserts,
0 approved updates; development revision `20261009_0006`; candidate-only
university comparison 13 absent, 0 conflicts. No catalogue was changed.
The scoped isolated suite returned **31 passed, 6 skipped, 1 dependency
deprecation warning**. Local PostgreSQL `test_` was unavailable, so
PostgreSQL migration and transactional import behavior remain **NOT TESTED**.
The write-flag refusal was reviewed statically: it raises before manifest
loading and before any database connection. An attempt to run the refusal
check with `--apply` was rejected by automatic approval review because the
flag names a write mode; it was not executed. No workaround was attempted.

A future write-capable importer must require a source-verified complete
manifest, migration/model alignment, a current restorable snapshot, exact
count review and separate approval. It must preserve DB IDs; match by
source key plus conservative normalized spelling; reject ambiguous names,
aliases and divergent parent/governorate mappings; never auto-delete/rename;
write transactionally; and show zero changes on replay. Failed validation
or write must leave the last valid catalogue intact. No schedule or live
external dependency is proposed.

Synthetic Student/Driver fixture planning remains offline. Without verified
canonical pickup areas and an applied hierarchy, routes and requests cannot
be safely built. The existing `example.test` plan has no credentials or
real contacts. No fixture record was inserted.

## Approval blockers and next safe action

1. Obtain current government-verified subdivision files for all 19
   governorates, especially post-2025 Halabja. Verify dates, hierarchy,
   licences and the full contents of the advertised Baghdad NOGP workbook.
2. Identify a government or municipal source for residential neighborhoods
   and pickup areas; review an explicit eligibility map per governorate.
3. Finish the official public/private institution pages and reconcile
   alternate names, current status, governorate and reuse terms.
4. Review `0007` and coordinate model/API changes; run migration and importer
   tests on an isolated local PostgreSQL `test_` database.
5. Confirm a fresh, restorable development snapshot. Only then produce exact
   final insert/update counts and request separate approval for Neon writes.

No Baghdad-only fallback is proposed. Nationwide completeness remains a
required gate, not a claimed feature of these candidate files.
