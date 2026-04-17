# IH Field — Noise Dosimetry App

A Progressive Web App (PWA) for industrial hygiene field data collection, built for noise dosimetry surveys. Hosted at [edartiga-oss.github.io/ih-field-app](https://edartiga-oss.github.io/ih-field-app/).

---

## Features

### Data collection
- Noise dosimetry survey data entry with live QA validation
- Pre/post calibration checks (timing, 1-hour window, 5% difference)
- Equipment inventory check-in and library with cal-due tracking
- LASmax impact/impulse noise protocol (>115 dBA and >140 dBA follow-up)
- Hourly field observations log (hours 1–10)
- Engineering controls, administrative controls, and PPE documentation
- Frequency weighting and detector response fields
- Impact/impulse SEG interview notes and corrective action documentation

### Analysis
- **Lognormal statistics** — geometric mean (GM), geometric standard deviation (GSD), arithmetic mean (AM), 95% UCL, and 95th-percentile / 95% UTL
- **UCL method: Land's Exact** (Land 1971/1975) — AIHA/EPA-recommended gold standard, matches IHSTAT v2.0 and EPA ProUCL 5.1 to within 0.1 dBA
- **UTL method: Hahn-Meeker K-factor** (1991) — matches IHSTAT v2.0 / R 'tolerance' package
- Filter stats by SEG, field IH, or location
- Standard selectable: ACGIH, OSHA HC, OSHA PEL
- **Noise RAC** — Risk Assessment Code visualization

### Reports and exports
- **Survey PDF report** — per-survey noise dosimetry field record with employee, instrument, calibration, QA, and results sections
- **Equipment Library PDF** — landscape summary of dosimeters and calibrators with color-coded cal-due status (green >90 days, amber ≤90, red past due)
- **Batch PDF** — all surveys for a campaign in one document
- **Filtered batch export** — PDF / Excel / Summary Table by field IH, location, or both
- **Per-survey PDF export** — one-click PDF from the Survey tab for any completed or QA-flagged survey
- **Hearing Conservation Program letters** — batch HCP notification letters for every employee in SEGs with a calculated UTL; by-location filtering available
- **Excel exports** — individual, batch, and filtered, with raw and formatted columns
- **Summary table** — tab-separated clipboard copy for pasting into Word or Excel
- **JSON backup** — full portable backup for cross-device transfer

### Sync and multi-device
- Auto-sync to Google Sheets — real-time access from any device
- Device nickname — surveys automatically tagged per field IH
- Filter surveys by individual field IH or view all
- Delete from Google Sheets when deleted in the app
- Conflict detection when same survey edited on two devices

### PWA
- Works fully offline after first load
- Installable on iPhone, Android, and desktop as a native-style app
- All libraries (jsPDF, SheetJS, PDF.js) bundled inline for offline operation

---

## Files

| File | Description |
|------|-------------|
| `index.html` | Main app shell — HTML, CSS, inlined libraries (jsPDF, SheetJS, PDF.js), and the main application script |
| `stats.js` | Lognormal statistics module — Land's H-table, Hahn-Meeker K-factors, and the Statistics tab rendering |
| `pdf-reports.js` | PDF report builders — survey reports and equipment library |
| `hcp-letters.js` | Hearing Conservation Program notification letters |
| `sw.js` | Service worker — PWA install and offline caching |
| `README.md` | This file |

### Architecture

The app is a single-page PWA. Code started out all in `index.html` but has been split into focused JS modules as features grew:

- **`stats.js`** owns the Statistics tab — UCL/UTL math (Land's Exact, Hahn-Meeker), and the render logic for the tab itself. All functions live on `window` so inline onclick handlers in `index.html` continue to resolve.
- **`pdf-reports.js`** owns every PDF report type except HCP letters. Organized into four sections: brand constants (`PDF_BRAND`), shared helper stubs (header/footer/logo — being filled in as patterns repeat across builders), the Noise Dosimetry surveys report, and the Equipment Library report. New report types go here as new sections.
- **`hcp-letters.js`** stays separate — hearing-conservation letters are a distinct product concern with their own template and compliance requirements, not just another report variant.
- **`index.html`** retains HTML structure, CSS, the main application script (state, persistence, form logic, tab routing, Google Sheets sync), and the inlined third-party libraries.

When adding a new PDF report: extend `pdf-reports.js`. When adding a new UI element (button, tab, filter): update both the HTML and the relevant JS module. See "Updating the App" below for the full deploy checklist.

---

## Tabs

| Tab | Purpose |
|-----|---------|
| **Equipment** | Check in dosimeters and calibrators before a job; maintain the library; export library PDF |
| **Data Entry** | Create or edit a noise dosimetry survey |
| **Verify** | Cross-reference a dosimeter report file against your survey records to catch transcription errors |
| **Surveys** | Browse, filter, and manage all saved surveys; quick-export per-survey PDFs |
| **Statistics** | Lognormal analysis by SEG / IH / location with Land's Exact UCL and Hahn-Meeker UTL |
| **Noise RAC** | Risk Assessment Code visualization |
| **Export** | Batch exports, filtered exports, HCP letters, JSON backup, data management |

---

## Installation

**iPhone / iPad (Safari only)**
1. Open `https://edartiga-oss.github.io/ih-field-app/` in Safari
2. Tap the Share button (box with arrow) at the bottom
3. Tap **Add to Home Screen**
4. Tap **Add**

**Android (Chrome)**
1. Open the URL in Chrome
2. Tap the Install banner at the bottom, or tap ⋮ → **Add to Home Screen**

**Windows / Mac (Chrome or Edge)**
1. Open the URL in Chrome or Edge
2. Click the install icon in the address bar
3. Click **Install**

---

## Device Nickname — Multi-IH Setup

Each device registers a personal nickname on first launch. This allows multiple field IHs to use the same app URL while keeping their surveys identifiable and filterable.

### First launch setup
1. On first open, a prompt appears asking **"What is your name?"**
2. The field IH enters their name or initials (e.g. "Eduardo V." or "EV")
3. Tap **Save Name** — stored permanently on that device
4. The name appears as a teal chip in the top-right header at all times

### How tagging works
- Every survey saved on a device is automatically tagged with that device's nickname
- No manual action required — tagging happens invisibly on every save
- The nickname travels with the survey record to Google Sheets and to any device that imports the data

### Changing your name
Tap the name chip in the top-right header at any time, enter a new name, and tap **Save Name**.

### Filtering surveys
On the **Surveys** tab, a **Filter by IH** dropdown auto-populates from all unique IH names in the survey records. Select any individual name or **All field IHs**.

### Filtered batch export
On the **Export** tab, the **Batch Export — Filtered** section lets you filter by field IH, by location, or both — and export only the matching surveys to PDF, Excel, or a summary table. Either filter alone works; picking both narrows to the intersection.

---

## Data & Sync

### Delete sync
When a survey is deleted in the app, a delete request is automatically sent to Google Sheets to remove the matching rows from both the **Surveys** and **SurveysRaw** sheets. If the device is offline when the survey is deleted, the deletion is queued locally and sent automatically when internet is restored.

### Conflict detection
When the same survey (same Survey ID) is edited on two different devices and both versions sync to Sheets, the app detects the conflict on next pull:
- The more recently saved version is kept as the primary record
- The survey card is flagged with an amber **Conflict** badge
- Hovering the badge shows: *"Edited on multiple devices — review and re-save to resolve"*
- To resolve: open the survey, verify the data, and tap **Save & Finalize** — this writes a clean version and removes the conflict flag

Conflicts only trigger when the same survey was edited on different devices within 24 hours. Routine syncs (e.g. pulling a remote survey for the first time) do not flag as conflicts.

### Filtered batch export
The Export tab includes a **Batch Export — Filtered** section:
1. Pick a field IH, a location, or both from the two dropdowns
2. The count of matching surveys updates live
3. Export to PDF, Excel, or Summary Table
4. Files are named with the active filters and today's date

### Single-survey exports
- **From the Export tab** — use the **Single Survey Export** dropdown to pick any finalized employee and export their individual PDF or Excel
- **From the Survey tab** — each completed or QA-flagged survey card has its own **PDF** button for one-click export; drafts don't show the button since their data would be incomplete

### Equipment library export
The Equipment tab has an **Export Library PDF** button, and the Export tab has a matching **Equipment Library** group. Output is a landscape summary of all dosimeters and calibrators with color-coded cal-due / NIST-due status:
- **Green** — current (>90 days until due)
- **Amber** — due within 90 days
- **Red** — past due
- **Gray** — no date on file

---

## Statistics — UCL / UTL Methods

The Statistics tab computes lognormal statistics on TWA dBA values, grouped by SEG (or IH, or location). All values assume lognormal-distributed exposures, which is standard per AIHA Strategy / Noise Manual 6th Ed.

**UCL (95% Upper Confidence Limit on the arithmetic mean)**
- Method: Land's Exact (Land 1971/1975) — AIHA/EPA gold standard
- Formula: `exp(ȳ + s²/2 + H(n, δ) · s/√n)` where `δ = s · √n`
- H-table: bilinear interpolation across 17 sample sizes (n=2–50) and 20 delta values (0.0–4.0)
- Matches IHSTAT v2.0 and EPA ProUCL 5.1 to within 0.1 dBA
- Replaces an earlier t-distribution approximation which under-covered at small n and high GSD

**UTL (95th percentile / 95% confidence Upper Tolerance Limit)**
- Method: Hahn & Meeker (1991) K-factor
- Formula: `exp(ȳ + K(n) · s)`
- Matches IHSTAT v2.0 / R `tolerance` package

**GSD bands** (informational):
- GSD < 1.5 = homogeneous SEG
- GSD 1.5–2.0 = moderate spread
- GSD > 2.0 = consider splitting the SEG

Standards available in the tab's toolbar: **ACGIH** (85 dBA criterion / 3 dB exchange), **OSHA HC** (85 dBA AL / 5 dB exchange), **OSHA PEL** (90 dBA PEL / 5 dB exchange).

---

## Data Handling and Storage

### Where data is stored

All survey data entered in the app is stored in the device's **browser localStorage** — a private, sandboxed storage area built into every web browser. Data stored in localStorage:

- Lives entirely on the device where it was entered
- Is never automatically sent anywhere without an explicit action
- Persists between sessions and app restarts
- Is not accessible to any other website or application
- Is not stored on GitHub — GitHub only hosts the app code, not user data

### What data is collected

The app collects the following categories of field survey data:

- **Project information** — project name, survey date, applicable standard
- **Device nickname** — the name set by the field IH on first launch, stored only on that device
- **Employee information** — name, ID, employer, job title, department, location, SEG, task description
- **Instrument data** — dosimeter make/model/serial, factory calibration date, exchange rate, criterion level, frequency weighting, detector response
- **Calibrator data** — make/model/serial, NIST calibration due date, reference level
- **Calibration records** — pre and post calibration timestamps and readings
- **Survey window** — start and end times
- **QA results** — automated pass/fail checks stored with each survey record
- **Dosimetry results** — dose %, Lavg/LEQ, LASmax, run time, TWA, exposure category
- **Field observations** — hourly notes (hours 1–10), sampling notes
- **Controls and PPE** — engineering controls, administrative controls, PPE used
- **Impact/impulse notes** — SEG interview notes (>115 dBA), corrective measures or investigation documentation (>140 dBA)
- **Placement details** — microphone location, type, windscreen use, obstructions
- **IH professional** — name, credentials, firm, phone
- **Equipment inventory** — dosimeter and calibrator records checked in via the Equipment tab, including condition history

No location data, device identifiers, or usage analytics are collected beyond what is explicitly entered by the user.

### Google Sheets sync

The app syncs survey data to a Google Sheet via a Google Apps Script Web App when an internet connection is available.

**How it works:**
- Every save sends the full survey record to the Apps Script endpoint via HTTPS POST
- The Apps Script writes to two sheets: **Surveys** (formatted columns) and **SurveysRaw** (JSON for pull-back sync)
- On app open, all surveys are pulled from SurveysRaw and merged with local data
- Deletions are synced to Sheets — rows are removed from both sheets
- Offline saves and deletions are queued locally and flushed when internet returns
- Conflicts between devices are detected and flagged for review

**Data in transit:** All data is transmitted over HTTPS within Google's infrastructure. No third-party servers are involved.

**Data in Google Sheets:** The sheet is owned by the account holder. Access is controlled by standard Google Sheets sharing permissions.

### Data backup and transfer

**JSON export:** Export tab → **Download .json** — saves all survey records. Import on any device via **Import .json**.

**PDF exports:** Generated offline using bundled jsPDF.
- **Individual survey** — from the Survey tab's PDF button, or the Export tab's Single Survey dropdown
- **Equipment library** — landscape summary, Equipment tab or Export tab
- **Campaign batch** — all surveys in one document
- **Filtered batch** — by IH, location, or both
- **HCP letters** — batch notification letters, all locations or one

**Excel exports:** Generated offline using bundled SheetJS. Individual, batch (all), or filtered (by IH and/or location).

**Summary table:** Copies tab-separated data to clipboard for pasting into Word or Excel. Available for all surveys or filtered.

### Data retention and deletion

- localStorage data is retained until explicitly deleted via **Export → Delete All** or browser data is cleared
- Deleting in the app also removes records from Google Sheets
- Device nicknames are stored separately and not affected by survey deletion
- Always export a JSON backup before clearing browser data

### Offline operation

After first load, the app runs fully offline:
- All data entry, QA, and local saves work without internet
- PDF, Excel, and JSON exports work offline
- Statistics calculations run locally (no server round-trip)
- Sync operations queue locally and flush when connection returns
- Only requires internet: initial load, Google Sheets sync, deployment date in header

---

## Updating the App

The app now consists of five deployable files. **All must be uploaded together**, and the service worker cache version must be bumped so devices fetch the updated copies instead of using their cached versions.

### Files to upload

1. `index.html`
2. `stats.js`
3. `pdf-reports.js`
4. `hcp-letters.js`
5. `sw.js` — **version string updated**

### Deploy procedure

1. Download the new files from the developer
2. Open `sw.js` and bump the cache version string (search for `DEPLOYMENT STAMP` or the `CACHE_NAME` constant near the top)
3. In GitHub: **Add file → Upload files** → upload all modified files → **Commit changes**
4. GitHub Pages redeploys within 2 minutes
5. Installed devices pick up the new version on their next open with internet — the bumped cache name forces the service worker to fetch fresh copies of every listed file

**If you skip the cache bump**, users may continue to run the old version for days because their browser's service worker is serving stale files from cache.

**Also update the Apps Script** if the `apps-script.js` file was changed — paste the new script into the Apps Script editor and redeploy as a new version.

### Which file changed for which feature

- Change to stats math or the Statistics tab → `stats.js`
- Change to a PDF report layout, new PDF report type → `pdf-reports.js`
- Change to HCP letter template or logic → `hcp-letters.js`
- Change to the HTML structure, a new button / tab / form field, main app state, sync, or QA logic → `index.html`
- Any time *any* file above changes → also bump `sw.js`

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| App framework | Vanilla HTML/CSS/JavaScript — no build tools required |
| Statistics engine | Land's Exact H-table (bilinear interpolation) + Hahn-Meeker K-factor — pure JS, no external dependency |
| PDF generation | jsPDF 2.5.1 (bundled inline) |
| Excel generation | SheetJS 0.18.5 (bundled inline) |
| PDF reading (Verify tab) | PDF.js 3.11.174 (bundled inline) |
| Offline caching | Service Worker (Cache API) |
| Local data storage | Browser localStorage |
| Cloud sync | Google Apps Script Web App → Google Sheets |
| Hosting | GitHub Pages (free) |
| PWA install | Web App Manifest + Service Worker |
| Multi-IH identification | Device nickname (localStorage) |
| Conflict detection | Timestamp + device comparison on sync merge |

---

## Author

Built and maintained by **Eduardo E. Artiga, CIH, CSP, PMP** — industrial hygienist in the Greater Houston area. Feature requests and issue reports welcome from authorized users.

---

## License

© Eduardo E. Artiga. All rights reserved.

This software is proprietary. No part of this repository — source code, compiled output, documentation, assets, or design — may be copied, modified, merged, published, distributed, sublicensed, sold, or used in any form without the prior written consent of the author.

Access to this repository or to the deployed application does not constitute permission to reuse, redistribute, or derive works from it. Use is restricted to individuals or organizations who have been explicitly granted permission by the author.

Unauthorized use is prohibited.
