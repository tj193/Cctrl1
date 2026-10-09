# Iraq reference data: source and mapping review

Reviewed 2026-10-09, then extended to nationwide scope on the same date.
No external dataset was imported. The five public names in
`data/reference/iraq_universities_candidates.json` and eight private names
in `data/reference/iraq_private_institutions_candidates.json` are candidates,
not an approved complete catalogue. Public candidates include their Study
in Iraq detail-page IDs for provenance only; external IDs must never be used
as DarbGo foreign keys. A separate manifest records 19 governorate names.

| Source | Format, coverage, maintenance evidence | Licence and decision |
| --- | --- | --- |
| [National Open Government Portal](https://nogp.gov.iq/) and its [documented API](https://nogp.gov.iq/ApiDocs.aspx) | Portal documents read-only dataset/resource endpoints, JSON/CSV/XML, `updated_since`, paging and OpenAPI. The [Baghdad districts/subdistricts dataset](https://nogp.gov.iq/DatasetDetailsA.aspx?id=69) advertises one 15.5 KB Excel file, updated 2026-03-30. Live resource/API responses and file contents could not be inspected here; direct page access returned 502. Coverage beyond Baghdad and refresh cadence of this specific file are unverified. | API documentation says CC BY 4.0 with attribution and warns that individual files can have a separate licence. Verify the actual file, publisher, licence metadata, hierarchy and current contents before area import. Do not treat an administrative district as a residential neighborhood. |
| [Ministry public university list](https://mohesr.gov.iq/ar/home/public_universities) | Government HTML listing with Arabic names and location text; multiple pages. No documented structured API/download or update schedule found for this list. Five candidates have explicit governorate evidence: Baghdad, Mustansiriyah, Basra, Kufa/Najaf and Qadisiyah. | Government authority for these names; reuse terms for the HTML list were not established. Keep attribution and review permission before bulk republication/import. Candidate subset is not a comprehensive university catalogue. |
| [Ministry private university/college list](https://mohesr.gov.iq/ar/home/private_universities/) and [2025/26 official guide](https://www.mohesr.gov.iq/ar/post/%D8%A5%D8%B7%D9%84%D8%A7%D9%82-%D8%AF%D9%84%D9%8A%D9%84-%D8%A7%D9%84%D8%AC%D8%A7%D9%85%D8%B9%D8%A7%D8%AA-%D9%88%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A7%D8%AA-%D8%A7%D9%84%D8%A3%D9%87%D9%84%D9%8A%D8%A9-20262025-2025-11-24-21) | Government HTML listing with governorate labels and multiple pages; eight first-page candidates transcribed. Ministry guide published 2025-11-24 as PDFs with geographical details; no documented public machine API for this list. | Name changes and alternative university/college forms require review. Full pages/guide and reuse terms must be checked before bulk import. |
| [Study in Iraq](https://studyiniraq.mohesr.gov.iq/) | Ministry-hosted HTML directory cross-checks the five names and lists many more. No documented public API or update cadence was established. | Cross-check, not an automatic sync source. |
| [Iraqi Open Source governorates repository](https://github.com/Iraqi-Open-Source/official-iraqi-governorates) | Community JSON claims 19 governorates plus districts/subdistricts, Arabic/English/Kurdish labels and MIT licence. Its title does not make it a government source. It proposes an ISO code for Halabja, a sign that some identifiers require external confirmation. | Useful comparison only; do not import its IDs or assume all subdivisions are current/official. Verify provenance and names against government data. |
| [COSIT administrative reference](https://cosit.gov.iq/documents/population/projection/%D8%AA%D8%B1%D9%83%D9%8A%D8%A8%D8%A9%20%D8%B3%D9%83%D8%A7%D9%86%D9%8A%D8%A9.pdf) | Government PDF includes administrative map material; not a machine-ready residential-area catalogue. | Supporting cross-check, not an import file. |
| [COSIT 2018 governorate list](https://cosit.gov.iq/documents/indices/CPI/%D9%85%D8%B3%D8%AA%D9%88%D9%8A%D8%A7%D8%AA%20%D8%A7%D9%84%D8%A7%D8%B3%D8%B9%D8%A7%D8%B1%20%D9%81%D9%8A%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A7%D9%82/%D9%85%D8%B3%D8%AA%D9%88%D9%8A%D8%A7%D8%AA%20%D8%A7%D9%84%D8%A7%D8%B3%D8%B9%D8%A7%D8%B1%20%D9%81%D9%8A%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A7%D9%82%20%D9%84%D8%B3%D9%86%D8%A9%202018.pdf) and [Halabja Official Gazette](https://moj.gov.iq/view.9248/) | Old official statistical publication lists the previous 18; 2025 decree establishes Halabja as nineteenth. | Validates governorate names, not current subordinate boundaries. No current subdivision counts inferred. |
| [open-admin-data divisions](https://github.com/open-admin-data/iraq-administrative-divisions) | Community JSON/CSV/NDJSON says 18 governorates, 101 districts, 294 subdistricts; last updated 2026-09-08; CC BY 4.0. Halabja absent. | Supporting comparison only. The 18-province hierarchy cannot be silently treated as current nationwide coverage. |

## Schema mapping and gaps

`area` has `id`, `Area_name`, `city`, status and timestamps; uniqueness is
intended on `(Area_name, city)`. There is no governorate table, administrative
level, source ID, or English-label column. The live database uses a unique
index for `uq_area_name_city` whereas metadata describes a constraint.
`university` has a globally unique `University_name` and optional
`governorate`. Its integer IDs are the only valid application foreign keys.

The candidate governorate name belongs in `university.governorate`. It is
not itself an `area` row. A verified district/subdistrict may fit
`area.Area_name` with its governorate in `area.city` only after product review:
Student pickup choice currently implies a usable origin, while a broad
administrative district may be too imprecise. Neighborhood coverage remains
unverified. A separate government or municipally verified neighborhood
catalogue is needed before claiming residential-area coverage. No English
labels were invented; the schema cannot retain bilingual labels yet.

## Controlled refresh proposal

1. Record immutable source URL, file date, checksum, licence and mapping
   decisions outside business rows. Keep the last reviewed manifest.
2. Normalize Unicode to NFC and collapse whitespace **for matching only**;
   preserve source Arabic display spelling. Detect normalized collisions and
   ambiguous governorate assignments for manual review.
3. Compare against existing IDs. Exact match means no action; new items are
   insert candidates; changed names/governorates are conflicts. Never rename,
   disable or delete referenced rows automatically.
4. After separate approval, use one verified development endpoint, a fresh
   restorable snapshot, transactional writes, repeatable previews and source
   attribution. Serve the resulting catalogue through DarbGo FastAPI, not
   through live external calls on each frontend page.

No schedule or write-capable importer is enabled. The nationwide dry-run tool
is read-only and refuses `--apply`; an actual importer awaits approved
hierarchy mapping, pickup-area sources and an approved schema change. The
19-governorate coverage matrix records every missing level explicitly.
Two source-observed spellings, `انبار` and `بصرة`, are retained only as
matching aliases for `الأنبار` and `البصرة`; they are not extra governorates.
