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
3. Tap **Save Name** — this is stored permanently on that device
4. The name appears as a teal chip in the top-right header at all times

### How tagging works
- Every survey saved on a device is automatically tagged with that device's nickname
- No manual action required from field IHs — tagging happens invisibly on every save
- The nickname travels with the survey record to Google Sheets and to any device that imports the data

### Changing your name
- Tap the name chip in the top-right header at any time
- Enter a new name and tap **Save Name**

### Filtering surveys
- On the **Surveys** tab, a **Filter by IH** dropdown appears above the survey list
- Select **All field IHs** to see every survey from every device
- Select any individual name to see only that person's surveys
- The dropdown auto-populates from all unique IH names found in the survey records
- A count shows how many surveys are currently displayed

### Supervisor workflow
As data syncs from all field IHs via Google Sheets, all surveys appear on the supervisor's device tagged with each IH's name. The supervisor can filter to any one field IH or view the full campaign at once.

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

The app syncs survey data to a Google Sheet via a Google Apps Script Web App when an internet connection is available. This enables real-time data sharing across multiple devices and field personnel.

**How it works:**
- Every time a survey is saved or a draft is saved, the app sends the full survey record to the configured Google Apps Script endpoint via an HTTPS POST request
- The Apps Script writes the data to two sheets: a formatted **Surveys** sheet (human-readable columns) and a **SurveysRaw** sheet (JSON records used for pull-back sync)
- When the app opens with internet, it automatically pulls all surveys from the SurveysRaw sheet and merges them with local data — the most recently updated version of each survey wins
- If the device is offline when a survey is saved, the record is queued locally and synced automatically when internet is restored
- Each survey record includes the device nickname so all records are identifiable by field IH in the sheet

**Data in transit:**
- All data is transmitted over HTTPS (encrypted in transit)
- The Google Apps Script endpoint is deployed under the user's own Google account
- No data passes through any third-party servers — the flow is: device → Google Apps Script → Google Sheets (all within Google's infrastructure)

**Data in Google Sheets:**
- The Google Sheet is owned by and accessible only to the account holder and anyone they explicitly share it with
- Survey records in Google Sheets are not deleted when surveys are deleted from the app — Sheets serves as a permanent audit log
- The sheet can be exported, shared with supervisors, or used as a data source for further reporting

### Data backup and transfer

**JSON export:** The Export tab provides a **Download .json** option that saves all survey records to a single file. This file:
- Can be used as a complete backup of all local data
- Can be imported on any other device running the app via **Import .json**
- Should be saved to cloud storage (iCloud, Google Drive, OneDrive) or emailed at the end of each field day as a precaution

**PDF export:** Individual or batch PDF reports can be generated entirely offline. PDFs are generated in-browser using the bundled jsPDF library.

**Excel export:** Individual or batch Excel workbooks can be generated offline using the bundled SheetJS library. Each row represents one survey with all fields as columns, including the device nickname column.

**Summary table:** Copies a tab-separated summary of all surveys to the clipboard for direct pasting into Word or Excel.

### Data retention and deletion

- Data in localStorage is retained indefinitely until the user explicitly deletes it via **Export → Delete All**, or until the browser's site data is cleared
- Clearing browser history, cache, or site data in Safari/Chrome/Edge will permanently delete all locally stored surveys — always export a JSON backup before clearing browser data
- Device nicknames are stored separately in localStorage and are not affected by survey deletion
- Data in Google Sheets is retained according to the Google account owner's own retention policies and is not affected by app-side deletions
- There is no server-side copy of data outside of the user's own Google Sheet

### Offline operation

After the first load with internet, the app is fully cached by the service worker and operates completely offline:
- All data entry, QA calculations, and local saves work without internet
- PDF and Excel exports work offline (libraries are bundled in the app)
- JSON import and export work offline
- Device nickname is stored locally and works offline
- Google Sheets sync queues locally and flushes when connection is restored
- The only features requiring internet: initial load, Google Sheets sync, and the deployment date in the header

---

## Updating the App

1. Download the new `index.html` and `sw.js` from the developer
2. In GitHub, navigate to the repository
3. Click **Add file → Upload files**
4. Upload both files (they overwrite the existing versions)
5. Click **Commit changes**
6. GitHub Pages redeploys automatically within 2 minutes
7. All devices receive the update the next time they open the app with internet
8. The deployment date in the app header updates automatically

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
