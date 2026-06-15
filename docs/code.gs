const SHEET_ID = '1cfnQs2_1j-utujXlNg63SsXJiObLE5l8yuXoyXErY_0';
const SHEET_NAME = 'Surveys';
const RAW_SHEET = 'SurveysRaw';
const EQUIP_SHEET = 'Equipment';
const EQUIP_RAW_SHEET = 'EquipmentRaw';
const AIR_SHEET = 'AirSurveys';
const AIR_RAW_SHEET = 'AirSurveysRaw';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);

    // ── Equipment routing ─────────────────────────────────────────────
    if (data._type === 'equipment') {
      if (data._action === 'delete' && data.id) {
        return handleEquipDelete(ss, data.id);
      }
      return handleEquipUpsert(ss, data);
    }

    // ── Air Sampling routing ──────────────────────────────────────────
    if (data._type === 'air_sampling') {
      if (data._action === 'delete' && data.id) {
        return handleAirDelete(ss, data.id);
      }
      return handleAirUpsert(ss, data);
    }

    // ── Air Sampling photo upload (Drive) ─────────────────────────────
    if (data._type === 'air_photo') {
      return handleAirPhotoUpload(data);
    }

    // ── Handle delete action (surveys) ────────────────────────────────
    if (data._action === 'delete' && data.id) {
      const sheet = ss.getSheetByName(SHEET_NAME);
      const rawSheet = ss.getSheetByName(RAW_SHEET);
      if (sheet && sheet.getLastRow() > 1) {
        const vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
        for (let i = vals.length - 1; i >= 0; i--) {
          if (vals[i][0] === data.id) { sheet.deleteRow(i + 2); break; }
        }
      }
      if (rawSheet && rawSheet.getLastRow() > 1) {
        const rawVals = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 1).getValues();
        for (let i = rawVals.length - 1; i >= 0; i--) {
          if (rawVals[i][0] === data.id) { rawSheet.deleteRow(i + 2); break; }
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, action: 'deleted', id: data.id }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Write to formatted Surveys sheet ──────────────────────────────
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(SURVEY_HEADERS);
      sheet.getRange(1, 1, 1, SURVEY_HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    const s = data;
    const row = buildSurveyRow_(s, new Date().toLocaleString());

    // Update existing row or append new one
    const existing = sheet.getDataRange().getValues();
    let existingRow = -1;
    for (let i = 1; i < existing.length; i++) {
      if (existing[i][0] === s.id) { existingRow = i + 1; break; }
    }
    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    // ── Full JSON to SurveysRaw for pull-back ─────────────────────────
    let rawSheet = ss.getSheetByName(RAW_SHEET);
    if (!rawSheet) {
      rawSheet = ss.insertSheet(RAW_SHEET);
      rawSheet.appendRow(['survey_id', 'updated_at', 'json_data']);
      rawSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
      rawSheet.setFrozenRows(1);
    }

    const rawData = rawSheet.getDataRange().getValues();
    let rawRow = -1;
    for (let i = 1; i < rawData.length; i++) {
      if (rawData[i][0] === s.id) { rawRow = i + 1; break; }
    }
    const jsonRow = [s.id, new Date().toISOString(), JSON.stringify(s)];
    if (rawRow > 0) {
      rawSheet.getRange(rawRow, 1, 1, 3).setValues([jsonRow]);
    } else {
      rawSheet.appendRow(jsonRow);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ══════════════════════════════════════════════════════════════════════
//  EQUIPMENT HANDLERS
// ══════════════════════════════════════════════════════════════════════
function handleEquipUpsert(ss, data) {
  let sheet = ss.getSheetByName(EQUIP_SHEET);
  if (!sheet) sheet = ss.insertSheet(EQUIP_SHEET);

  const headers = [
    'Equip ID','Updated At','Type','Make','Model','Serial',
    'Factory Cal','NIST Cal Due','Status','Condition','Checked Out To',
    'Checked In At','Checked Out At','Notes','Condition History (JSON)'
  ];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const row = [
    data.id || '',
    data.updatedAt || new Date().toISOString(),
    data.type || '',
    data.make || '',
    data.model || '',
    data.serial || '',
    data.factoryCal || '',
    data.nistDue || '',
    data.status || '',
    data.condition || '',
    data.checkedOutTo || '',
    data.checkedInAt || '',
    data.checkedOutAt || '',
    data.notes || '',
    data.conditionHistory ? JSON.stringify(data.conditionHistory) : ''
  ];

  const existing = sheet.getDataRange().getValues();
  let existingRow = -1;
  for (let i = 1; i < existing.length; i++) {
    if (existing[i][0] === data.id) { existingRow = i + 1; break; }
  }
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  // Raw JSON for equipment pull-back
  let rawSheet = ss.getSheetByName(EQUIP_RAW_SHEET);
  if (!rawSheet) {
    rawSheet = ss.insertSheet(EQUIP_RAW_SHEET);
    rawSheet.appendRow(['equip_id', 'updated_at', 'json_data']);
    rawSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    rawSheet.setFrozenRows(1);
  }
  const rawData = rawSheet.getDataRange().getValues();
  let rawRowIdx = -1;
  for (let i = 1; i < rawData.length; i++) {
    if (rawData[i][0] === data.id) { rawRowIdx = i + 1; break; }
  }
  const jsonRow = [data.id, new Date().toISOString(), JSON.stringify(data)];
  if (rawRowIdx > 0) {
    rawSheet.getRange(rawRowIdx, 1, 1, 3).setValues([jsonRow]);
  } else {
    rawSheet.appendRow(jsonRow);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, type: 'equipment' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleEquipDelete(ss, id) {
  const sheet = ss.getSheetByName(EQUIP_SHEET);
  const rawSheet = ss.getSheetByName(EQUIP_RAW_SHEET);
  if (sheet && sheet.getLastRow() > 1) {
    const vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = vals.length - 1; i >= 0; i--) {
      if (vals[i][0] === id) { sheet.deleteRow(i + 2); break; }
    }
  }
  if (rawSheet && rawSheet.getLastRow() > 1) {
    const rawVals = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 1).getValues();
    for (let i = rawVals.length - 1; i >= 0; i--) {
      if (rawVals[i][0] === id) { rawSheet.deleteRow(i + 2); break; }
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, action: 'deleted', type: 'equipment', id: id }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════════
//  AIR SAMPLING HANDLERS
//  Schema mirrors equipment/surveys: a flat tab (AirSurveys, one row per
//  sample or blank inside a survey so you can pivot in Sheets) and a raw
//  JSON tab (AirSurveysRaw, one row per survey id) that the client reads
//  via doGet.
// ══════════════════════════════════════════════════════════════════════
function handleAirUpsert(ss, data) {
  // ── Raw JSON tab — one row per survey id, full document ──
  let rawSheet = ss.getSheetByName(AIR_RAW_SHEET);
  if (!rawSheet) {
    rawSheet = ss.insertSheet(AIR_RAW_SHEET);
    rawSheet.appendRow(['air_survey_id', 'updated_at', 'json_data']);
    rawSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    rawSheet.setFrozenRows(1);
  }
  const rawData = rawSheet.getDataRange().getValues();
  let rawRowIdx = -1;
  for (let i = 1; i < rawData.length; i++) {
    if (rawData[i][0] === data.id) { rawRowIdx = i + 1; break; }
  }
  const jsonRow = [data.id, new Date().toISOString(), JSON.stringify(data)];
  if (rawRowIdx > 0) {
    rawSheet.getRange(rawRowIdx, 1, 1, 3).setValues([jsonRow]);
  } else {
    rawSheet.appendRow(jsonRow);
  }

  // ── Flat tab — one row per sample / blank ──
  let sheet = ss.getSheetByName(AIR_SHEET);
  if (!sheet) sheet = ss.insertSheet(AIR_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(AIR_HEADERS);
    sheet.getRange(1, 1, 1, AIR_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // Drop any existing rows for this survey id (they'll be re-appended
  // below). Iterate backwards so deleteRow doesn't shift our index.
  if (sheet.getLastRow() > 1) {
    const existingIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = existingIds.length - 1; i >= 0; i--) {
      if (existingIds[i][0] === data.id) sheet.deleteRow(i + 2);
    }
  }

  const submittedAt = new Date().toLocaleString();
  const rows = buildAirRows_(data, submittedAt);
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, AIR_HEADERS.length).setValues(rows);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, type: 'air_sampling', id: data.id }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleAirDelete(ss, id) {
  const sheet = ss.getSheetByName(AIR_SHEET);
  const rawSheet = ss.getSheetByName(AIR_RAW_SHEET);
  if (sheet && sheet.getLastRow() > 1) {
    const vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = vals.length - 1; i >= 0; i--) {
      if (vals[i][0] === id) sheet.deleteRow(i + 2);
    }
  }
  if (rawSheet && rawSheet.getLastRow() > 1) {
    const rawVals = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 1).getValues();
    for (let i = rawVals.length - 1; i >= 0; i--) {
      if (rawVals[i][0] === id) rawSheet.deleteRow(i + 2);
    }
  }
  /* Also trash the Drive folder of photos for this survey. Best-effort —
     don't block the delete if Drive is unavailable. */
  try {
    const root = getAirPhotoRoot_();
    const subs = root.getFoldersByName(id);
    while (subs.hasNext()) subs.next().setTrashed(true);
  } catch (e) {}
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, action: 'deleted', type: 'air_sampling', id: id }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════════
//  AIR SAMPLING PHOTO UPLOAD (Drive)
//  Body: { _type:'air_photo', surveyId, hour, dataUri }
//  Returns: { success:true, url, fileId } — the URL is a Drive
//  thumbnail link usable in an <img src> for the client.
// ══════════════════════════════════════════════════════════════════════
const AIR_PHOTO_ROOT_NAME = 'Air Sampling Photos';

function getAirPhotoRoot_() {
  const it = DriveApp.getFoldersByName(AIR_PHOTO_ROOT_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(AIR_PHOTO_ROOT_NAME);
}

/* ══════════════════════════════════════════════════════════════════════
   ONE-TIME AUTHORIZATION HELPER

   Apps Script web apps don't prompt users for new OAuth scopes through
   the web. After adding the DriveApp code, run this function ONCE from
   the editor:

     1. In the Apps Script editor, pick "authorizeAirPhotoFolder" from
        the function dropdown next to the Run button.
     2. Click Run.
     3. A dialog appears asking you to authorize Drive access — accept.
     4. Check the Logs (View -> Logs) — you should see the folder URL.

   After that, the web app will be able to write photos to Drive.
   No need to redeploy after running this — the new scope is granted to
   the deployment automatically.
   ══════════════════════════════════════════════════════════════════════ */
function authorizeAirPhotoFolder() {
  const folder = getAirPhotoRoot_();
  Logger.log('Air Sampling Photos folder ready: ' + folder.getName());
  Logger.log('URL: ' + folder.getUrl());
}

function handleAirPhotoUpload(data) {
  if (!data.surveyId || data.hour == null || !data.dataUri) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'missing surveyId, hour, or dataUri' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  /* Find or create the per-survey subfolder. */
  const root = getAirPhotoRoot_();
  const subIt = root.getFoldersByName(data.surveyId);
  const surveyFolder = subIt.hasNext() ? subIt.next() : root.createFolder(data.surveyId);

  /* Parse the data URI: data:image/jpeg;base64,XXXX */
  const m = String(data.dataUri).match(/^data:(.+?);base64,(.+)$/);
  if (!m) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'malformed dataUri' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const mimeType = m[1];
  const bytes = Utilities.base64Decode(m[2]);
  const ext = mimeType.indexOf('png') >= 0 ? 'png' : 'jpg';
  const name = 'hour-' + data.hour + '.' + ext;

  /* If we're replacing an existing photo for this hour, trash the old one. */
  const existing = surveyFolder.getFilesByName(name);
  while (existing.hasNext()) existing.next().setTrashed(true);

  const blob = Utilities.newBlob(bytes, mimeType, name);
  const file = surveyFolder.createFile(blob);
  /* Make the file viewable by anyone with the link so <img src> works
     without a logged-in Google session on the client. */
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    /* Some workspaces lock down link sharing — fall back to silent failure;
       the file is still saved, the IH can grant access manually. */
  }
  const fileId = file.getId();
  const url = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, url: url, fileId: fileId, name: name }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════════
//  doGet — returns surveys + equipment + air sampling surveys for pull-back
// ══════════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const surveys = readRawJson_(ss, RAW_SHEET);
    const equipment = readRawJson_(ss, EQUIP_RAW_SHEET);
    const airSurveys = readRawJson_(ss, AIR_RAW_SHEET);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        surveys: surveys,
        equipment: equipment,
        airSurveys: airSurveys
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: err.toString(),
        surveys: [],
        equipment: [],
        airSurveys: []
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function readRawJson_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() <= 1) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  return rows
    .filter(function (r) { return r[0] && r[2]; })
    .map(function (r) {
      try { return JSON.parse(r[2]); } catch (e) { return null; }
    })
    .filter(Boolean);
}

// ══════════════════════════════════════════════════════════════════════
//  SHARED SCHEMA — headers + row builder
//  Used by doPost (live writes) and migrateSurveysFromRaw (one-time rebuild)
// ══════════════════════════════════════════════════════════════════════
const SURVEY_HEADERS = [
  // Identity & metadata
  'Survey ID','Submitted At','Device UA','Device Nickname','Conflict Flag','Status',
  'Project','Survey Date','Standard',

  // Employee
  'Employee Name','Employee ID','Employer','Job Title','Department','Location','Task',
  'SEG','Process',

  // Dosimeter (base + primary setup mirror)
  'Dosimeter Make','Dosimeter Model','Dosimeter Serial','Factory Cal Date',
  'Primary Setup Index',
  'Exchange Rate (primary)','Criterion Level (primary)',
  'Frequency Weighting (primary)','Detector Response (primary)','Threshold (primary)',

  // Multi-setup details (flattened for setups 1-3)
  'Setup 1 Exchange','Setup 1 Criterion','Setup 1 Weighting','Setup 1 Response','Setup 1 Threshold',
  'Setup 2 Exchange','Setup 2 Criterion','Setup 2 Weighting','Setup 2 Response','Setup 2 Threshold',
  'Setup 3 Exchange','Setup 3 Criterion','Setup 3 Weighting','Setup 3 Response','Setup 3 Threshold',

  // Calibrator
  'Calibrator Make','Calibrator Model','Calibrator Serial',
  'Last NIST Cal','NIST Cal Due','Cal Ref Level',

  // Calibration timing
  'Pre-Cal Time','Pre-Cal Reading','Pre-Cal Initials',
  'Survey Start','Survey End',
  'Post-Cal Time','Post-Cal Reading','Post-Cal Initials',

  // QA checks (status + numeric values)
  'QA Pre Before Start','QA Post After End',
  'QA Pre Within 1hr','QA Pre Gap (min)',
  'QA Post Within 1hr','QA Post Gap (min)',
  'QA Cal Diff <=5%','QA Cal Diff %',
  'QA TWA Match','QA TWA Diff (dBA)',
  'QA SEG Present',
  'QA Overall',

  // Results — legacy/core
  'Dose %','Lavg LEQ','LASmax','Run Time hr','TWA 8hr','Report TWA',

  // Results — standard-specific (new)
  'ACGIH Dose %','ACGIH Lavg',
  'OSHA HC Dose %','OSHA HC Lavg',
  'OSHA PEL Dose %','OSHA PEL Lavg',

  // Results — interpretation
  'Exposure Category','HPD Required',
  'Engineering Controls','Admin Controls','PPE Used',
  'LASmax >115 SEG Notes','LASmax >140 Corrective','LASmax >140 Investigation',

  // Placement
  'Mic Placement','Mic Type','Windscreen','Obstructions','Placement Notes',

  // Hourly walkthrough
  'Hour 1','Hour 2','Hour 3','Hour 4','Hour 5',
  'Hour 6','Hour 7','Hour 8','Hour 9','Hour 10',

  // Notes + IH
  'Sampling Notes',
  'IH Name','IH Credentials','IH Firm','IH Phone',

  // Setups JSON (raw, for any setup beyond 3 or future-proofing)
  'Setups JSON'
];

function buildSurveyRow_(s, submittedAt) {
  const setups = (s.dosimeter && Array.isArray(s.dosimeter.setups)) ? s.dosimeter.setups : [];
  const setup = function (i, key) {
    return (setups[i] && setups[i][key] !== undefined) ? setups[i][key] : '';
  };
  const passFail = function (v) {
    return v === true ? 'PASS' : v === false ? 'FAIL' : '';
  };
  const num = function (v, digits) {
    return (v !== undefined && v !== null && v !== '' && !isNaN(Number(v)))
      ? Number(v).toFixed(digits) : '';
  };

  const row = [
    // Identity & metadata
    s.id || '',
    submittedAt || new Date().toLocaleString(),
    s.deviceInfo || '',
    s.deviceNickname || '',
    s.conflictFlag ? 'YES' : '',
    s.status || '',
    s.project && s.project.name || '',
    s.calibration && s.calibration.surveyStart ? s.calibration.surveyStart.split('T')[0] : '',
    s.project && s.project.standard || '',

    // Employee
    s.employee && s.employee.name || '',
    s.employee && s.employee.empId || '',
    s.employee && s.employee.company || '',
    s.employee && s.employee.title || '',
    s.employee && s.employee.dept || '',
    s.employee && s.employee.location || '',
    s.employee && s.employee.task || '',
    s.employee && s.employee.seg || '',
    s.employee && s.employee.process || '',

    // Dosimeter base + primary mirror
    s.dosimeter && s.dosimeter.make || '',
    s.dosimeter && s.dosimeter.model || '',
    s.dosimeter && s.dosimeter.serial || '',
    s.dosimeter && s.dosimeter.factoryCal || '',
    (s.dosimeter && typeof s.dosimeter.primarySetupIndex === 'number') ? s.dosimeter.primarySetupIndex : '',
    s.dosimeter && s.dosimeter.exchange || '',
    s.dosimeter && s.dosimeter.criterion || '',
    s.dosimeter && s.dosimeter.weighting || '',
    s.dosimeter && s.dosimeter.response || '',
    s.dosimeter && s.dosimeter.threshold || '',

    // Setup 1
    setup(0, 'exchange'), setup(0, 'criterion'), setup(0, 'weighting'), setup(0, 'response'), setup(0, 'threshold'),
    // Setup 2
    setup(1, 'exchange'), setup(1, 'criterion'), setup(1, 'weighting'), setup(1, 'response'), setup(1, 'threshold'),
    // Setup 3
    setup(2, 'exchange'), setup(2, 'criterion'), setup(2, 'weighting'), setup(2, 'response'), setup(2, 'threshold'),

    // Calibrator
    s.calibrator && s.calibrator.make || '',
    s.calibrator && s.calibrator.model || '',
    s.calibrator && s.calibrator.serial || '',
    s.calibrator && s.calibrator.lastNistCal || '',
    s.calibrator && s.calibrator.nistDue || '',
    s.calibrator && s.calibrator.refLevel || '',

    // Calibration timing
    s.calibration && s.calibration.preTime ? s.calibration.preTime.replace('T', ' ') : '',
    s.calibration && s.calibration.preReading || '',
    s.calibration && s.calibration.preInitials || '',
    s.calibration && s.calibration.surveyStart ? s.calibration.surveyStart.replace('T', ' ') : '',
    s.calibration && s.calibration.surveyEnd ? s.calibration.surveyEnd.replace('T', ' ') : '',
    s.calibration && s.calibration.postTime ? s.calibration.postTime.replace('T', ' ') : '',
    s.calibration && s.calibration.postReading || '',
    s.calibration && s.calibration.postInitials || '',

    // QA
    passFail(s.qa && s.qa.checks && s.qa.checks.preBefore),
    passFail(s.qa && s.qa.checks && s.qa.checks.postAfter),
    passFail(s.qa && s.qa.checks && s.qa.checks.preWithin1hr),
    num(s.qa && s.qa.checks && s.qa.checks.preGap, 1),
    passFail(s.qa && s.qa.checks && s.qa.checks.postWithin1hr),
    num(s.qa && s.qa.checks && s.qa.checks.postGap, 1),
    passFail(s.qa && s.qa.checks && s.qa.checks.calWithin5pct),
    num(s.qa && s.qa.checks && s.qa.checks.calDiff, 2),
    passFail(s.qa && s.qa.checks && s.qa.checks.twaMatch),
    num(s.qa && s.qa.checks && s.qa.checks.twaDiff, 2),
    passFail(s.qa && s.qa.checks && s.qa.checks.segPresent),
    s.qa && s.qa.allPass ? 'ALL PASS' : 'FLAG',

    // Results — legacy/core
    s.results && s.results.dose || '',
    s.results && s.results.lavg || '',
    s.results && s.results.peak || '',
    s.results && s.results.runTime || '',
    s.results && s.results.twa || '',
    s.results && s.results.dosReportTWA || '',

    // Results — standard-specific
    s.results && s.results.acgihDose || '',
    s.results && s.results.acgihLavg || '',
    s.results && s.results.oshaHcDose || '',
    s.results && s.results.oshaHcLavg || '',
    s.results && s.results.oshaPelDose || '',
    s.results && s.results.oshaPelLavg || '',

    // Results — interpretation
    s.results && s.results.category || '',
    s.results && s.results.hpd || '',
    s.results && s.results.engControls || '',
    s.results && s.results.adminControls || '',
    s.results && s.results.ppe || '',
    s.results && s.results.lasmaxInterviewNotes || '',
    s.results && s.results.lasmax140CorrectiveNotes || '',
    s.results && s.results.lasmax140InvestigationNotes || '',

    // Placement
    s.placement && s.placement.location || '',
    s.placement && s.placement.micType || '',
    s.placement && s.placement.windscreen || '',
    s.placement && s.placement.obstructions || '',
    s.placement && s.placement.notes || '',

    // Hourly
    s.results && s.results.hour1 || '',
    s.results && s.results.hour2 || '',
    s.results && s.results.hour3 || '',
    s.results && s.results.hour4 || '',
    s.results && s.results.hour5 || '',
    s.results && s.results.hour6 || '',
    s.results && s.results.hour7 || '',
    s.results && s.results.hour8 || '',
    s.results && s.results.hour9 || '',
    s.results && s.results.hour10 || '',

    // Notes + IH
    s.results && s.results.notes || '',
    s.ih && s.ih.name || '',
    s.ih && s.ih.creds || '',
    s.ih && s.ih.firm || '',
    s.ih && s.ih.phone || '',

    // Setups JSON (raw, for audit / future schema changes)
    setups.length ? JSON.stringify(setups) : ''
  ];

  // Safety: pad or truncate to exactly match header count.
  if (row.length !== SURVEY_HEADERS.length) {
    while (row.length < SURVEY_HEADERS.length) row.push('');
    if (row.length > SURVEY_HEADERS.length) row.length = SURVEY_HEADERS.length;
  }
  return row;
}

// ══════════════════════════════════════════════════════════════════════
//  AIR SAMPLING SCHEMA — headers + row builder
//  One row per sample / blank in a survey, with all the survey-wide
//  General Information + Lab Information repeated on every row so the
//  flat tab is usable for pivots in Sheets without joining back to the
//  raw JSON tab.
// ══════════════════════════════════════════════════════════════════════
const AIR_HEADERS = [
  // Identity & metadata
  'Survey ID','Submitted At','Updated At','Device Nickname',

  // Sample/Blank position within survey
  'Sample or Blank','Index',

  // General Information (repeated per row)
  'Survey Date','Shop Name','Shop Priority','SEG','Building',
  'Parent Location','Work Location','Associated Processes',

  // Identification (per sample)
  'Field Sample ID','IMS Sample ID','Lab Sample ID','Task ID',

  // Analyte & Method
  'Chemical / Hazard','Sample Type','Analytical Method','Sample Media',
  'Media Lot #','Media Expiration','Inspirability','Sample Position',

  // Personnel & Work Conditions
  'Last Name First Name','Last 4 EDIPN','Job Title','Shift Hours','Exposure Origin',
  'Process / Task','Job Task Description','Associated Materials','Activity Monitored',

  // Controls
  'PPE','Engineering','Administrative','Respirator Worn','PPE Worn (other)',

  // Equipment
  'Pump Mfg','Pump Model','Pump Serial','Pump Asset Tag',
  'Calibrator Mfg / Model','Calibrator Serial','Calibrator Mfg Cal Date','Calibration Due Date',

  // Pre & Post Calibration
  'Pre-Cal Date','Pre-Cal Time','Pre-Cal Flow',
  'Post-Cal Date','Post-Cal Time','Post-Cal Flow','Cal Diff %',

  // Sample Collection
  'Start Date','Start Time','Stop Date','Stop Time',
  'Downtime (min)','Sampling Time (min)','Flow (LPM)','Total Volume (L)',

  // Gravimetric
  'Grav Pre (g)','Grav Post (g)','Grav Net (g)',

  // Ambient
  'Baro Start (in Hg)','Baro End (in Hg)','Temp Start (F)','Temp End (F)',
  'Relative Humidity (%)','Wind Speed (mph)','Wind Direction',

  // Analytes for this sample (JSON array)
  'Analytes (JSON)',

  // Lab Information (survey-wide, repeated per row)
  'Lab Name','Lab Phone','Lab Turnaround (days)',
  'Lab Date Sent','Lab Date Analyzed','Lab Date Reported','Lab Date Returned',

  // Evaluation, Comments, Sign-off (survey-wide)
  'Detailed Evaluation','Comments / Time Course','Notes',
  'Template Completed By','QA Review By',

  // Blank-specific
  'Blank Category','Blank ID','Blank Comments'
];

function buildAirRows_(data, submittedAt) {
  const g = data.general || {};
  const stamp = submittedAt || new Date().toLocaleString();
  const updatedAt = data.updatedAt || new Date().toISOString();
  const device = data.deviceNickname || '';

  const rows = [];

  function commonHead(kind, idx) {
    return [
      data.id || '', stamp, updatedAt, device,
      kind, idx,
      g.survey_date || '', g.shop_name || '', g.shop_priority || '', g.seg || '', g.building || '',
      g.parent_location || '', g.work_location || '', g.associated_processes || '',
    ];
  }
  function commonTail() {
    return [
      g.lab_name || '', g.lab_phone || '', g.lab_turnaround || '',
      g.lab_date_sent || '', g.lab_date_analyzed || '', g.lab_date_reported || '', g.lab_date_returned || '',
      g.evaluation || '', g.comments || '', g.notes_calcs || '',
      g.completed_by || '', g.qa_review_by || ''
    ];
  }

  (data.samples || []).forEach(function (sp, i) {
    const f = sp.fields || {};
    const analytes = sp.analytes || [];
    const row = commonHead('sample', i + 1).concat([
      // Identification
      f.field_id || '', f.doehrs_id || '', f.lab_id || '', f.task_id || '',
      // Analyte & Method
      f.chem || '', f.type || '', f.method || '', f.media || '',
      f.media_lot || '', f.media_exp || '', f.inspirability || '', f.position || '',
      // Personnel
      f.emp_name || '', f.emp_id || '', f.job_title || '', f.shift_hrs || '', f.exp_origin || '',
      f.process || '', f.task_desc || '', f.materials || '', f.activity || '',
      // Controls
      f.ppe || '', f.engineering || '', f.administrative || '', f.respirator || '', f.ppe_worn || '',
      // Equipment
      f.pump_mfg || '', f.pump_model || '', f.pump_serial || '', f.pump_num || '',
      f.cal_model || '', f.cal_serial || '', f.cal_mfg_date || '', f.cal_due || '',
      // Cal timing
      f.precal_date || '', f.precal_time || '', f.precal_flow || '',
      f.postcal_date || '', f.postcal_time || '', f.postcal_flow || '', f.cal_diff || '',
      // Collection
      f.start_date || '', f.start_time || '', f.stop_date || '', f.stop_time || '',
      f.downtime || '', f.duration || '', f.flow || '', f.volume || '',
      // Gravimetric
      f.grav_pre || '', f.grav_post || '', f.grav_net || '',
      // Ambient
      f.baro_start || '', f.baro_end || '', f.temp_start || '', f.temp_end || '',
      f.rh || '', f.wind_speed || '', f.wind_dir || '',
      // Analytes blob
      analytes.length ? JSON.stringify(analytes) : ''
    ]).concat(commonTail()).concat([
      // Blank-specific (empty for samples)
      '', '', ''
    ]);
    rows.push(row);
  });

  (data.blanks || []).forEach(function (bk, i) {
    const f = bk.fields || {};
    // For blanks, fill identification / method / media from the blank's
    // own fields and leave the sample-only columns empty.
    const row = commonHead('blank', i + 1).concat([
      // Identification — blank ID maps onto Field Sample ID for visibility
      f.id || '', '', '', '',
      // Analyte & Method
      f.chem || '', '', f.method || '', f.media || '',
      f.media_lot || '', f.media_exp || '', '', '',
      // Personnel (n/a for blanks)
      '', '', '', '', '',
      '', '', '', '',
      // Controls
      '', '', '', '', '',
      // Equipment
      '', '', '', '', '', '', '', '',
      // Cal timing
      '', '', '', '', '', '', '',
      // Collection
      '', '', '', '', '', '', '', '',
      // Gravimetric
      '', '', '',
      // Ambient
      '', '', '', '', '', '', '',
      // Analytes blob
      ''
    ]).concat(commonTail()).concat([
      // Blank-specific
      f.category || 'Field Blank', f.id || '', f.comments || ''
    ]);
    rows.push(row);
  });

  // Survey with no samples / no blanks: keep at least one header-only row
  // so the IH still sees it in the flat tab.
  if (!rows.length) {
    const row = commonHead('header_only', 0);
    while (row.length < AIR_HEADERS.length) row.push('');
    rows.push(row);
  }

  // Safety: pad each row to exactly match header count.
  rows.forEach(function (r) {
    while (r.length < AIR_HEADERS.length) r.push('');
    if (r.length > AIR_HEADERS.length) r.length = AIR_HEADERS.length;
  });

  return rows;
}

// ══════════════════════════════════════════════════════════════════════
//  MIGRATION — rebuild formatted Surveys sheet from SurveysRaw JSON
//
//  RUN THIS ONCE after deploying the updated schema:
//    1. In the Apps Script editor, select "migrateSurveysFromRaw"
//       from the function dropdown at the top.
//    2. Click Run. Approve permissions if prompted.
//    3. Check the execution log (View → Logs) for the row count.
//
//  What it does:
//    - Reads every JSON blob from SurveysRaw (the source of truth).
//    - Backs up the existing Surveys sheet to Surveys_backup_<timestamp>
//      so nothing is destroyed if something goes wrong.
//    - Clears Surveys and rewrites it using the new SURVEY_HEADERS schema
//      and buildSurveyRow_ — so Setup 2/3 data, ACGIH/OSHA results, TWA
//      match fields, etc. all populate for your historical records.
//
//  Safe to re-run. Each run creates a fresh backup.
// ══════════════════════════════════════════════════════════════════════
function migrateSurveysFromRaw() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const rawSheet = ss.getSheetByName(RAW_SHEET);
  if (!rawSheet || rawSheet.getLastRow() <= 1) {
    Logger.log('No data in ' + RAW_SHEET + ' — nothing to migrate.');
    return;
  }

  // 1. Backup existing formatted sheet
  const existing = ss.getSheetByName(SHEET_NAME);
  if (existing && existing.getLastRow() > 0) {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const backupName = SHEET_NAME + '_backup_' + stamp;
    existing.copyTo(ss).setName(backupName);
    Logger.log('Backed up existing ' + SHEET_NAME + ' to ' + backupName);
  }

  // 2. Read all raw JSON records
  const rawRows = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 3).getValues();
  const surveys = [];
  const submittedAtById = {};
  let parseFailures = 0;
  rawRows.forEach(function (r) {
    if (!r[0] || !r[2]) return;
    try {
      const s = JSON.parse(r[2]);
      surveys.push(s);
      submittedAtById[s.id] = r[1] ? new Date(r[1]).toLocaleString() : '';
    } catch (e) {
      parseFailures++;
    }
  });
  Logger.log('Parsed ' + surveys.length + ' surveys from ' + RAW_SHEET +
             (parseFailures ? ' (' + parseFailures + ' failed to parse)' : ''));

  // 3. Clear and recreate the formatted sheet with the new schema
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  sheet.appendRow(SURVEY_HEADERS);
  sheet.getRange(1, 1, 1, SURVEY_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 4. Bulk-write all rows (much faster than appendRow in a loop)
  if (surveys.length > 0) {
    const rows = surveys.map(function (s) {
      return buildSurveyRow_(s, submittedAtById[s.id] || '');
    });
    sheet.getRange(2, 1, rows.length, SURVEY_HEADERS.length).setValues(rows);
  }

  Logger.log('Migration complete: ' + surveys.length + ' rows written to ' + SHEET_NAME);
  Logger.log('Schema: ' + SURVEY_HEADERS.length + ' columns');
}

// ══════════════════════════════════════════════════════════════════════
//  EQUIPMENT MIGRATION (optional) — rebuild Equipment sheet from raw JSON
// ══════════════════════════════════════════════════════════════════════
function migrateEquipmentFromRaw() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const rawSheet = ss.getSheetByName(EQUIP_RAW_SHEET);
  if (!rawSheet || rawSheet.getLastRow() <= 1) {
    Logger.log('No data in ' + EQUIP_RAW_SHEET + ' — nothing to migrate.');
    return;
  }

  const existing = ss.getSheetByName(EQUIP_SHEET);
  if (existing && existing.getLastRow() > 0) {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    existing.copyTo(ss).setName(EQUIP_SHEET + '_backup_' + stamp);
  }

  const rawRows = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 3).getValues();
  const items = [];
  rawRows.forEach(function (r) {
    if (!r[0] || !r[2]) return;
    try { items.push(JSON.parse(r[2])); } catch (e) {}
  });

  let sheet = ss.getSheetByName(EQUIP_SHEET);
  if (sheet) sheet.clear();
  else sheet = ss.insertSheet(EQUIP_SHEET);

  const headers = [
    'Equip ID','Updated At','Type','Make','Model','Serial',
    'Factory Cal','NIST Cal Due','Status','Condition','Checked Out To',
    'Checked In At','Checked Out At','Notes','Condition History (JSON)'
  ];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  if (items.length > 0) {
    const rows = items.map(function (d) {
      return [
        d.id || '', d.updatedAt || '', d.type || '', d.make || '', d.model || '',
        d.serial || '', d.factoryCal || '', d.nistDue || '', d.status || '',
        d.condition || '', d.checkedOutTo || '', d.checkedInAt || '',
        d.checkedOutAt || '', d.notes || '',
        d.conditionHistory ? JSON.stringify(d.conditionHistory) : ''
      ];
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  Logger.log('Equipment migration complete: ' + items.length + ' rows');
}

// ══════════════════════════════════════════════════════════════════════
//  AIR SAMPLING MIGRATION (optional) — rebuild AirSurveys from raw JSON
//
//  Run from the Apps Script editor: pick migrateAirSurveysFromRaw from
//  the function dropdown and click Run. Backs up the existing flat
//  AirSurveys tab to AirSurveys_backup_<timestamp> first, then rebuilds.
//  Safe to re-run.
// ══════════════════════════════════════════════════════════════════════
function migrateAirSurveysFromRaw() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const rawSheet = ss.getSheetByName(AIR_RAW_SHEET);
  if (!rawSheet || rawSheet.getLastRow() <= 1) {
    Logger.log('No data in ' + AIR_RAW_SHEET + ' — nothing to migrate.');
    return;
  }

  const existing = ss.getSheetByName(AIR_SHEET);
  if (existing && existing.getLastRow() > 0) {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    existing.copyTo(ss).setName(AIR_SHEET + '_backup_' + stamp);
  }

  const rawRows = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 3).getValues();
  const surveys = [];
  const submittedAtById = {};
  let parseFailures = 0;
  rawRows.forEach(function (r) {
    if (!r[0] || !r[2]) return;
    try {
      const s = JSON.parse(r[2]);
      surveys.push(s);
      submittedAtById[s.id] = r[1] ? new Date(r[1]).toLocaleString() : '';
    } catch (e) {
      parseFailures++;
    }
  });
  Logger.log('Parsed ' + surveys.length + ' air sampling surveys from ' + AIR_RAW_SHEET +
             (parseFailures ? ' (' + parseFailures + ' failed to parse)' : ''));

  let sheet = ss.getSheetByName(AIR_SHEET);
  if (sheet) sheet.clear();
  else sheet = ss.insertSheet(AIR_SHEET);

  sheet.appendRow(AIR_HEADERS);
  sheet.getRange(1, 1, 1, AIR_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  let totalRows = 0;
  surveys.forEach(function (s) {
    const rows = buildAirRows_(s, submittedAtById[s.id] || '');
    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, AIR_HEADERS.length).setValues(rows);
      totalRows += rows.length;
    }
  });

  Logger.log('Air sampling migration complete: ' + surveys.length + ' surveys / ' + totalRows + ' rows written to ' + AIR_SHEET);
  Logger.log('Schema: ' + AIR_HEADERS.length + ' columns');
}
