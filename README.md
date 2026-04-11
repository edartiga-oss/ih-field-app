# IH Field — Noise Dosimetry App

A Progressive Web App (PWA) for industrial hygiene field data collection, built for noise dosimetry surveys.

## Features

- Noise dosimetry survey data entry with live QA validation
- Pre/post calibration checks (timing, 1-hour window, 5% difference)
- Equipment inventory and library
- LASmax impact/impulse noise protocol (>115 dBA and >140 dBA)
- Hourly field observations log
- Engineering controls, administrative controls, and PPE documentation
- Works fully offline after first load
- Installable on iPhone, Android, and desktop
- Export to PDF, Excel, and summary table

## Files

| File | Description |
|------|-------------|
| `index.html` | The complete app — all libraries bundled, works offline |
| `sw.js` | Service worker — enables PWA install and offline caching |

## Deployment

This app is hosted via GitHub Pages.

## Usage

1. Open the app URL in your browser
2. On iPhone: Safari → Share → Add to Home Screen
3. On Android: Chrome → Install banner or ⋮ → Add to Home Screen
4. On desktop: Chrome/Edge install icon in address bar

## Data

All survey data is stored locally in the browser (localStorage).
Use Export → Download .json to back up data and transfer between devices.
