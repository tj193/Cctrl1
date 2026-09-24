# University catalogue sources

This folder documents the source catalogue used to generate the frontend data. It is not a database and never stores user registration data.

## Files

- `universities-source.json`: the single reviewed list of public and private universities and colleges, including each institution's governorate, type and source group.
- `SOURCES.md`: provenance, scope and refresh notes for that list.

The browser does not load either file directly. Run `python tools/prepare-registration-data.py` after reviewing changes to regenerate `js/data/iraq-catalogue.js`.

## Sources

Reviewed on 2026-09-22.

- Federal public universities: Ministry of Higher Education and Scientific Research, all pages of https://mohesr.gov.iq/ar/home/public_universities, cross-checked with https://studyiniraq.mohesr.gov.iq/.
- Federal private universities and colleges: the ministry's official 2025–2026 directory at https://mohesr.gov.iq/ar/assets/img/uploaded_files/241120250.pdf.
- Kurdistan Region universities: https://gov.krd/mohe-en/publications/universities/ and https://lfu.edu.krd/univesity/.

## Scope and updates

The catalogue groups institutions by their primary campus or the provincial branch explicitly named by an official directory. It is a reviewed snapshot and does not update automatically.

When an official source changes, update `universities-source.json`, change its `reviewed` date, run the preparation script, then run `node tools/check-registration.cjs` before publishing.
