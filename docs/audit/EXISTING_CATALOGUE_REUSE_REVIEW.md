# Existing DarbGo catalogue reuse review

Date: 2026-10-09. This is a project-provided catalogue audit, not a new government verification. No database write, migration, frontend edit, commit, push, or deployment was made.

## Source and actual use

- `tools/prepare-registration-data.py` contains the 19 governorate identifiers, Arabic and English display names, and area suggestions. It generates `js/data/iraq-catalogue.js` from those rows and `reference-data/universities-source.json`.
- `reference-data/universities-source.json` supplies university/college names, source groups, type, and governorate keys. Its generated university array matches `js/data/iraq-catalogue.js` exactly. `reference-data/SOURCES.md` records the project's 2026-09-22 review, not a live registry guarantee.
- `student/register.html` loads that generated catalogue plus `js/data/iraq-map.js`, `js/components/governorate-map.js`, and `student/registration.js`. The map geometry originates in `assets/maps/iraq-source.svg`; the governorate component maps selection by the existing slug keys and accepts click/keyboard selection.
- `student/registration.js` uses the 19 governorates and their areas. It currently filters listed universities **to the chosen governorate**. The `Other university / campus` free-text choice permits an out-of-governorate entry, but does not give the same listed choices. Future frontend integration must offer all canonical universities irrespective of home governorate while retaining governorate → area → university steps and map interaction. This frontend was not changed here.
- Student registration currently creates a browser account through `js/auth/account-store.js`, using string keys/names, not backend integer IDs. The existing backend expects canonical integer `area_id` and `university_id`.
- `student/dashboard-data.js` is dashboard demo route/request data, not a source catalogue. `driver/demo-data.js` contains `Sample` entries and demo numeric IDs such as 101/201. Those are not database IDs. `driver/app.js` uses them only for its demo route form; its live route selectors remain unavailable. `driver/register.html` / `driver/registration.js` collect applicant details and do not yet use the catalogue. `admin/JS-file/main.js` consumes backend area/university rows, not the original JS catalogue.

## Actual counts

Counts are from the checked-in generated catalogue; university data was cross-compared with its source JSON. `Other` / free-text options are excluded.

| Governorate key | Arabic display name | Areas | Universities/colleges |
| --- | --- | ---: | ---: |
| baghdad | بغداد | 27 | 44 |
| basra | البصرة | 19 | 11 |
| nineveh | نينوى | 18 | 10 |
| erbil | أربيل | 16 | 15 |
| sulaymaniyah | السليمانية | 16 | 13 |
| duhok | دهوك | 12 | 7 |
| halabja | حلبجة | 5 | 1 |
| kirkuk | كركوك | 13 | 5 |
| diyala | ديالى | 13 | 4 |
| saladin | صلاح الدين | 12 | 5 |
| anbar | الأنبار | 15 | 6 |
| babil | بابل | 14 | 7 |
| karbala | كربلاء | 11 | 11 |
| najaf | النجف | 13 | 9 |
| qadisiyah | القادسية | 13 | 2 |
| wasit | واسط | 13 | 2 |
| maysan | ميسان | 12 | 4 |
| dhiqar | ذي قار | 15 | 7 |
| muthanna | المثنى | 13 | 3 |
| **Total** | **19** | **270** | **166** |

University types: 55 `public`, 111 `private`. Every governorate has at least five area suggestions and one institution.

## Quality findings and limits

- No duplicate governorate key/name, duplicate area **within one governorate**, duplicate institution name globally, empty area list, or institution with an unknown governorate key was found. Conservative Arabic normalization (diacritics, tatweel, hamza-alif, alef maqsura, ta marbuta, and spacing) found no within-governorate area collisions or institution-name collisions.
- Names such as `الإسكان`, `حي الجامعة`, and `حي الحسين` occur in different governorates and are distinct composite `(name, governorate)` choices. A bare area name must never resolve an ID without governorate context. Similar or composite names such as `عنكاوا` / `عينكاوة الجديدة` may refer to related localities, but the repository alone cannot establish whether these are spelling variants or separate areas; no entries were merged.
- The area list mixes neighborhoods, city centers, towns, and districts. It is a curated set of registration suggestions and does **not** establish coverage of every residential area in Iraq. Free-text `Other area` and `Other university / campus` choices are UI escape hatches, not canonical rows; backend handling needs a reviewed resolution process.
- No entries in the university source are marked `Sample`, `Example`, or demo-only. `driver/demo-data.js` does contain fictional universities and IDs and is excluded from import. The source's claimed associations and current institutional status were not independently validated in this task.

## Database mapping and revision 0007

At the current `20261009_0006` schema, `area.id` and `university.id` are stable PostgreSQL integer IDs. `area` has `(Area_name, city)` uniqueness; `university` has globally unique `University_name` and a nullable governorate string. The original keys map to the existing Arabic governorate names, `area.city`, and `university.governorate`. `student_profile`, `route`, and `routedemand` already reference the integer area/university IDs. Do not use the JS governorate slugs or `driver/demo-data.js` IDs as database IDs.

This is the minimum import mapping for the approved project catalogue; it requires **no schema migration**. It retains separate governorate, area, and university concepts in the import manifest and API presentation, but the database does not yet enforce governorate identity with a foreign key. If durable governorate identity and hierarchical subdivisions are later required, review a smaller governorate-only migration first. Do not derive residential hierarchy levels from these mixed area suggestions.

The unapplied `20261009_0007` creates `governorate` and `catalogue_location`, adds source/verification/hierarchy fields, and links existing area/university records. Its required source URLs and hierarchy levels suit the earlier external research proposal and are unnecessarily complex for importing the checked-in suggestions. It also does not relax global university-name uniqueness. **Recommendation:** defer `0007` for separate review; do not apply, modify, replace, or stamp it in this task. The current import maps to existing tables only and does not assign frontend slug keys as integer IDs.

## Import preparation and dry run

`tools/import_existing_catalogue.py` validates source/generated equality, governorate relations, duplicate keys/names, and university-name uniqueness. It defaults to offline dry run. It can compare exact `(Area_name, city)` and `(University_name, governorate)` matches on the verified development endpoint with `--development`; that connection is transaction read-only. Existing IDs are reused, no existing rows are updated/deleted, and mismatched university governorates halt the process.

Offline dry run result: **19 governorates, 270 area rows, 166 institution rows**. Conditional proposed inserts for an empty target: **270 areas and 166 universities**. These are **not** claimed as exact Neon insert counts because a fresh live comparison was unavailable. The `--development` attempt stopped at `ModuleNotFoundError` in the available bundled Python runtime, before opening a database connection. No `.env.development` value was printed or changed.

For a separately approved future write, the script requires explicit write authorization, a nonempty development snapshot ID, exact approved `area:university` counts, and the verified `.env.development` endpoint. It takes a PostgreSQL transaction advisory lock, rechecks revision `20261009_0006`, compares existing rows in the same transaction, and inserts only missing rows. Any failure rolls back. **The write mode was neither invoked nor tested here.** The existing `tools/nationwide_catalogue_import.py` remains a separate external-candidate dry-run workflow and was not changed.

Review commands, to run only when the project Python environment is repaired:

```bash
python tools/import_existing_catalogue.py
python tools/import_existing_catalogue.py --development
```

Do not use `--apply` until separate approval, a fresh restorable development snapshot, a successful read-only preview with exact insert counts, a local PostgreSQL transaction test, and manual review of any existing row conflicts. Keep all database credentials only in the ignored `.env.development`.

## Synthetic fixture readiness

`tools/phase43_synthetic_plan.py` already defines an offline fixture shape: one Admin, five Drivers, twelve Students, four Routes, seven ride requests (three Pending, two Accepted, two Declined), two active enrollments, three Reports, and three Route Demand records. This is **a plan, not insertable rows**. Use only canonical `area.id` and `university.id` returned by the approved import, selected by `(Arabic area, Arabic governorate)` and `(institution name, governorate)`; preserve those IDs on repeat imports. No sample IDs, browser localStorage account IDs, or arbitrary user IDs may be reused.

Concrete catalogue keys for the later resolver include `(الكرادة, بغداد) → (جامعة بغداد, بغداد)`, `(العشار, البصرة) → (جامعة البصرة, البصرة)`, and `(عنكاوا, أربيل) → (جامعة صلاح الدين, أربيل)`. All six entries are present in the checked-in source. Resolve these to integer IDs **after** an approved import; then assign the four planned routes and related Student profiles, requests, enrollments, Reports, and Route Demand to actual created user/route IDs. The prepared counts cannot become executable records until these ID mappings exist.

Before any fixture write, the Admin must be one preconfigured account; Drivers must start with an explicit application/approval state and only approved active Drivers may publish routes. Students register directly. A Pending request does not reserve a seat; only Driver acceptance creates/links an active enrollment within capacity. Reports, requests, and demand must reference the actual seeded user/route IDs. Synthetic identities must use non-dialable `.test` addresses and no real personal IDs or phone numbers. A reviewed fixture implementation and separate write approval are still required.

## Verification and blockers

- `python -m unittest tests.test_existing_catalogue_import -v`: 3 passed. Tests cover source counts, repeat-import idempotence, and a governorate conflict.
- `node tools/check-registration.cjs`: currently fails its unrelated `driver/register.html: emoji found` assertion. Its earlier catalogue/map assertions completed before that failure; this does not prove the whole registration suite passes.
- No local Python environment with `sqlalchemy`/`psycopg` was available for live read-only comparison or PostgreSQL transaction tests. Exact Neon insert counts, live existing-row conflicts, enum/column defaults, and write path remain unverified in this turn.
- Frontend integration still needs the listed university choice to be independent of home governorate, canonical backend ID mapping, and matching Driver selectors. No frontend changes were made.

**Next safe action:** repair the local project Python environment, run `--development` read-only against the verified endpoint, review the exact insert/conflict result and a fresh snapshot, then request separate approval for a transaction-tested development import. Do not apply revision `0007` or write data before that review.
