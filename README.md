# IH Field — Noise Dosimetry App

A Progressive Web App (PWA) for industrial hygiene field data collection, built for noise dosimetry surveys. Hosted at [edartiga-oss.github.io/ih-field-app](https://edartiga-oss.github.io/ih-field-app/).

---

## Features

- Noise dosimetry survey data entry with live QA validation
- Pre/post calibration checks (timing, 1-hour window, 5% difference)
- Equipment inventory check-in and library
- LASmax impact/impulse noise protocol (>115 dBA and >140 dBA follow-up)
- Hourly field observations log
- Engineering controls, administrative controls, and PPE documentation
- Frequency weighting and detector response fields
- Works fully offline after first load
- Installable on iPhone, Android, and desktop as a native-style app
- Export to PDF report, Excel workbook, and summary table
- Auto-sync to Google Sheets — real-time access from any device
- Device nickname — surveys automatically tagged per field IH
- Filter surveys by individual field IH or view all
- Delete from Google Sheets when deleted in the app
- Conflict detection when same survey edited on two devices
- Filtered batch export — export a single IH's surveys only

---

## Files

| File | Description |
|------|-------------|
| `index.html` | The complete app — all libraries bundled inline, works offline |
| `sw.js` | Service worker — enables PWA install and offline caching |
| `README.md` | This file |

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
On the **Export** tab, the **Batch Export — Single Field IH** section lets you select one IH and export only their surveys to PDF, Excel, or a summary table.

---

## Data & Sync

### Delete sync
When a survey is deleted in the app, a delete request is automatically sent to Google Sheets to remove the matching rows from both the **Surveys** and **SurveysRaw** sheets. If the device is offline when the survey is deleted, the deletion is queued locally and sent automatically when internet is restored.

### Conflict detection
When the same survey (same Survey ID) is edited on two different devices and both versions sync to Sheets, the app detects the conflict on next pull:
- The more recently saved version is kept as the primary record
- The survey card is flagged with an amber **⚠ Conflict** badge
- Hovering the badge shows: *"Edited on multiple devices — review and re-save to resolve"*
- To resolve: open the survey, verify the data, and tap **Save & Finalize** — this writes a clean version and removes the conflict flag

Conflicts only trigger when the same survey was edited on different devices within 24 hours. Routine syncs (e.g. pulling a remote survey for the first time) do not flag as conflicts.

### Filtered batch export
The Export tab includes a **Batch Export — Single Field IH** section:
1. Select a field IH from the dropdown (auto-populated from all synced surveys)
2. The survey count for that IH is shown
3. Export to PDF, Excel, or Summary Table — only that IH's surveys are included
4. Files are named with the IH's name and today's date

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
- **Employee information** — name, ID, employer, job title, department, location, task description
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
- **Equipment inventory** — dosimeter and calibrator records checked in via the Equipment tab

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

**PDF export:** Generated offline using bundled jsPDF. Individual, batch (all), or filtered (single IH).

**Excel export:** Generated offline using bundled SheetJS. Individual, batch (all), or filtered (single IH).

**Summary table:** Copies tab-separated data to clipboard for pasting into Word or Excel. Available for all surveys or a single IH.

### Data retention and deletion

- localStorage data is retained until explicitly deleted via **Export → Delete All** or browser data is cleared
- Deleting in the app also removes records from Google Sheets
- Device nicknames are stored separately and not affected by survey deletion
- Always export a JSON backup before clearing browser data

### Offline operation

After first load, the app runs fully offline:
- All data entry, QA, and local saves work without internet
- PDF, Excel, and JSON exports work offline
- Sync operations queue locally and flush when connection returns
- Only requires internet: initial load, Google Sheets sync, deployment date in header

---

## Updating the App

1. Download new `index.html` and `sw.js` from the developer
2. In GitHub: **Add file → Upload files** → upload both → **Commit changes**
3. GitHub Pages redeploys within 2 minutes
4. All devices update automatically on next open with internet

**Also update the Apps Script** if the `apps-script.js` file was changed — paste the new script into the Apps Script editor and redeploy as a new version.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| App framework | Vanilla HTML/CSS/JavaScript — no build tools required |
| PDF generation | jsPDF 2.5.1 (bundled inline) |
| Excel generation | SheetJS 0.18.5 (bundled inline) |
| Offline caching | Service Worker (Cache API) |
| Local data storage | Browser localStorage |
| Cloud sync | Google Apps Script Web App → Google Sheets |
| Hosting | GitHub Pages (free) |
| PWA install | Web App Manifest + Service Worker |
| Multi-IH identification | Device nickname (localStorage) |
| Conflict detection | Timestamp + device comparison on sync merge |
