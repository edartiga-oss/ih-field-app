const SHEET_ID = '1cfnQs2_1j-utujXlNg63SsXJiObLE5l8yuXoyXErY_0';
const SHEET_NAME = 'Surveys';
const RAW_SHEET = 'SurveysRaw';
const EQUIP_SHEET = 'Equipment';
const EQUIP_RAW_SHEET = 'EquipmentRaw';
const AIR_SHEET = 'AirSurveys';
const AIR_RAW_SHEET = 'AirSurveysRaw';
const SOUND_SHEET = 'SoundLevel';
const SOUND_RAW_SHEET = 'SoundLevelRaw';
const VENT_SHEET = 'Ventilation';
const VENT_RAW_SHEET = 'VentilationRaw';

// ══════════════════════════════════════════════════════════════════════
//  IH PROJECTS FOLDER (Drive scope anchor)
//  All photo routing reads/writes happen INSIDE this folder and its
//  descendants — never anywhere else in the IH's Drive. Constrains the
//  blast radius if anything goes wrong and prevents accidental matches
//  against same-named folders elsewhere in Drive.
//
//  How to set it:
//    1. Open the "IH Projects" folder in Drive (or whatever you call
//       the one you want to anchor on).
//    2. Copy the folder ID from the URL — it's the long string after
//       /folders/ in:
//         https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQ...
//                                                ^^^^^^^^^^^^^^^^^^^^^^
//    3. Paste it as the value below, between the quotes.
//    4. Run authorizeRouting() once from the editor and accept the
//       Drive permission prompt (grants the script access to the folder).
//    5. Deploy → Manage deployments → New version → Deploy.
// ══════════════════════════════════════════════════════════════════════
const IH_PROJECTS_FOLDER_ID = 'PASTE_FOLDER_ID_HERE';

function getProjectsRoot_() {
  if (!IH_PROJECTS_FOLDER_ID || IH_PROJECTS_FOLDER_ID === 'PASTE_FOLDER_ID_HERE') {
    throw new Error('IH_PROJECTS_FOLDER_ID is not configured. See the comment ' +
      'block above the constant in code.gs for setup instructions.');
  }
  try {
    return DriveApp.getFolderById(IH_PROJECTS_FOLDER_ID);
  } catch (e) {
    throw new Error('Could not open IH Projects folder (id=' + IH_PROJECTS_FOLDER_ID +
      '). Check the ID is correct and the Apps Script owner has access. ' +
      'Underlying error: ' + e.toString());
  }
}

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

    // ── Sound Level routing ───────────────────────────────────────────
    if (data._type === 'sound_level') {
      if (data._action === 'delete' && data.id) {
        return handleSoundDelete(ss, data.id);
      }
      return handleSoundUpsert(ss, data);
    }

    // ── Sound Level photo upload (Drive, smart-routed) ───────────────
    if (data._type === 'sound_photo') {
      return handleRoutedPhotoUpload_(data, 'Sound');
    }

    // ── Ventilation routing ──────────────────────────────────────────
    if (data._type === 'ventilation') {
      if (data._action === 'delete' && data.id) {
        return handleVentDelete(ss, data.id);
      }
      return handleVentUpsert(ss, data);
    }

    // ── Noise Dosimetry photo upload (Drive, smart-routed) ───────────
    if (data._type === 'noise_photo') {
      return handleRoutedPhotoUpload_(data, '04_Noise');
    }

    // ── Ventilation photo upload (Drive, smart-routed) ───────────────
    if (data._type === 'vent_photo') {
      return handleRoutedPhotoUpload_(data, '02_Vents');
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

/* Legacy flat-bucket root for air photos when the client doesn't send
   routing hints. Anchored under IH Projects so it stays inside the
   sandbox the script is scoped to. */
function getAirPhotoRoot_() {
  const projectsRoot = getProjectsRoot_();
  const it = projectsRoot.getFoldersByName(AIR_PHOTO_ROOT_NAME);
  return it.hasNext() ? it.next() : projectsRoot.createFolder(AIR_PHOTO_ROOT_NAME);
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

/* ══════════════════════════════════════════════════════════════════════
   AUTHORIZE ROUTING SCOPE
   Run this ONCE from the Apps Script editor after:
     - Setting IH_PROJECTS_FOLDER_ID at the top of code.gs
     - Pasting any code update that touches photo routing

   How to run:
     1. Editor → function dropdown → "authorizeRouting" → Run
     2. Accept the Drive permission prompt
     3. Check View → Logs to see the IH Projects folder name + child
        count — confirms the script can read/write inside it

   What it does: opens IH_PROJECTS_FOLDER_ID via DriveApp.getFolderById
   and iterates its direct children, exercising the same Drive
   operations uploadToFolderPath_ uses so Apps Script's scope inference
   can grant the necessary scope during OAuth. Nothing is created or
   modified outside the IH Projects folder.
   ══════════════════════════════════════════════════════════════════════ */
function authorizeRouting() {
  const root = getProjectsRoot_();
  let count = 0;
  const it = root.getFolders();
  while (it.hasNext()) { it.next(); count++; }
  Logger.log('OK — Drive routing authorized.');
  Logger.log('IH Projects folder: ' + root.getName());
  Logger.log('URL: ' + root.getUrl());
  Logger.log('Direct child folders: ' + count);
  Logger.log('All photo uploads will land inside this folder and its descendants.');
}

function handleAirPhotoUpload(data) {
  if (!data.surveyId || data.hour == null || !data.dataUri) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'missing surveyId, hour, or dataUri' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  /* If the client supplied routing hints (parent / facility), walk the
     project tree under MyDrive/<parent>/<facility>/03_Air Samples — the
     same path the IH navigates in Drive — instead of dropping into the
     flat "Air Sampling Photos/<surveyId>" bucket. The flat bucket stays
     as the fallback for legacy clients that don't send hints.

     When the client supplied a fileName (newer clients with caption
     support), use it; otherwise build the legacy "hour-N.jpg" name. */
  const legacyName = 'hour-' + data.hour + '.jpg';
  const name = data.fileName || legacyName;
  if (data.parent) {
    const subfolderName = data.subfolder || '03_Air Samples';
    return uploadToFolderPath_({
      parent: data.parent,
      facility: data.facility,
      subfolder: subfolderName,
      fileName: name,
      dataUri: data.dataUri,
      /* When the client computed a caption-aware filename, do NOT
         replaceByName — two photos at the same hour with different
         captions should coexist. Legacy filenames (hour-N.jpg) still
         replace, since they intentionally overwrite. */
      replaceByName: !data.fileName
    });
  }

  /* Legacy path: flat "Air Sampling Photos/<surveyId>/hour-N.jpg". */
  const root = getAirPhotoRoot_();
  const subIt = root.getFoldersByName(data.surveyId);
  const surveyFolder = subIt.hasNext() ? subIt.next() : root.createFolder(data.surveyId);
  return saveBlobToFolder_(surveyFolder, legacyName, data.dataUri, true);
}

// ══════════════════════════════════════════════════════════════════════
//  SMART DRIVE FOLDER ROUTING
//  Photos for Sound / Noise / Vent (and Air Sampling when routing hints
//  are supplied) land under MyDrive/<parent>/<facility>/<subfolder>/.
//  Missing folders are created on demand. Facility may be empty — in
//  which case the file is dropped one level shallower.
//
//  Body shape:
//    { _type: 'sound_photo' | 'noise_photo' | 'vent_photo',
//      surveyId, fileName, dataUri,
//      parent, facility, subfolder? }
//
//  defaultSub is the fallback subfolder name when the client doesn't
//  supply one (e.g. '04_Noise' for noise_photo).
// ══════════════════════════════════════════════════════════════════════
function handleRoutedPhotoUpload_(data, defaultSub) {
  if (!data.fileName || !data.dataUri) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'missing fileName or dataUri' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (!data.parent) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'missing parent (project) hint — cannot route' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return uploadToFolderPath_({
    parent: data.parent,
    facility: data.facility,
    subfolder: data.subfolder || defaultSub,
    fileName: data.fileName,
    dataUri: data.dataUri,
    replaceByName: data.replaceByName !== false
  });
}

/* Walks <IH Projects>/<parent>/<facility?>/<subfolder?>, fuzzy-matching
   existing folders before creating new ones, then writes the file.
   The whole walk is anchored on IH_PROJECTS_FOLDER_ID — the script
   never reads or writes outside that subtree.

   Parent: searched as direct children of IH Projects (exact name first,
   then each meaningful word — "ARNG" finds "KS ARNG", and vice versa).
   If nothing matches, parent is skipped and the facility is created
   directly under IH Projects.

   Facility: fuzzy match inside whichever parent resolved (or directly
   under IH Projects if no parent matched). So canonical "AASF#1" finds
   the IH's existing "1. AASF 1 Topeka, KS". If nothing matches, the
   canonical name is created (per spec).

   Subfolder (03_Air Samples / 04_Noise / Sound / 02_Vents): exact-name
   get-or-create — well-known and always one level under the facility. */
function uploadToFolderPath_(opts) {
  try {
    const projectsRoot = getProjectsRoot_();

    /* Resolve parent within IH Projects — falls back to IH Projects
       itself if no folder matches the parent token. */
    let folder = opts.parent
      ? resolveProjectFolder_(projectsRoot, opts.parent)
      : projectsRoot;

    /* Resolve facility under whatever resolved above. */
    if (opts.facility) folder = resolveFacilityFolder_(folder, opts.facility);

    /* Drop the subfolder — fuzzy match by token so canonical "04_Noise"
       finds an existing "03_Noise" / "Noise" folder instead of creating
       a duplicate. */
    if (opts.subfolder) folder = resolveSubfolder_(folder, opts.subfolder);

    return saveBlobToFolder_(folder, opts.fileName, opts.dataUri, opts.replaceByName);
  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'route failed: ' + e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* Exact-name get-or-create inside a known parent folder. Used for
   subfolders like "03_Air Samples" where the IH expects a specific
   name. */
function getOrCreateChildFolder_(parentFolder, name) {
  const it = parentFolder.getFoldersByName(name);
  return it.hasNext() ? it.next() : parentFolder.createFolder(name);
}

/* Parent resolution: fuzzy-match a direct child of IH Projects. If
   no child matches, return IH Projects itself (the facility will be
   created directly under it). */
function resolveProjectFolder_(projectsRoot, parentName) {
  if (!parentName) return projectsRoot;
  const exact = projectsRoot.getFoldersByName(parentName);
  if (exact.hasNext()) return exact.next();
  const fuzzy = findFolderByToken_(projectsRoot, parentName);
  return fuzzy || projectsRoot;
}

/* Facility resolution: fuzzy-match inside the parent (e.g. canonical
   "AASF#1" finds existing "1. AASF 1 Topeka, KS"). If nothing matches,
   create with the canonical name under the parent. */
function resolveFacilityFolder_(parentFolder, facilityName) {
  if (!facilityName) return parentFolder;
  const exact = parentFolder.getFoldersByName(facilityName);
  if (exact.hasNext()) return exact.next();
  const fuzzy = findFolderByToken_(parentFolder, facilityName);
  if (fuzzy) return fuzzy;
  return parentFolder.createFolder(facilityName);
}

/* Subfolder resolution: well-known names like "03_Air Samples",
   "04_Noise", "Sound", "02_Vents". Different facilities use different
   leading numbers (one facility has "03_Noise", another has
   "04_Noise"), so we fuzzy-match on the trailing word(s) instead of
   exact name.

   Strategy:
     1. Try exact-name match (cheap and correct most of the time)
     2. Strip leading "NN_" / "NN-" / "NN. " from the canonical name to
        get the keyword(s), e.g. "04_Noise" → "Noise"
     3. Iterate the parent's direct children; first child whose name
        contains the keyword as a whole word wins
     4. If nothing matches, create with the canonical name (per spec) */
function resolveSubfolder_(parentFolder, canonicalName) {
  if (!canonicalName) return parentFolder;
  const exact = parentFolder.getFoldersByName(canonicalName);
  if (exact.hasNext()) return exact.next();

  /* Strip a leading number prefix like "03_", "04-", "02. " and split
     into significant words. */
  const stripped = String(canonicalName).replace(/^\s*\d+\s*[_\-\.]\s*/, '').trim();
  const tokens = stripped.split(/\s+/).filter(function(w) { return w.length >= 3; });
  if (!tokens.length) return parentFolder.createFolder(canonicalName);

  const it = parentFolder.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    const name = f.getName().toUpperCase();
    for (let i = 0; i < tokens.length; i++) {
      const tokenRe = new RegExp('\\b' + tokens[i].toUpperCase() + '\\b');
      if (tokenRe.test(name)) return f;
    }
  }
  return parentFolder.createFolder(canonicalName);
}

/* Walks every child folder of `parentFolder` and returns the first one
   whose name fuzzy-matches `canonicalName`.

   Rules:
   - Extract the leading letters (prefix) and optional trailing digit
     from `canonicalName`. E.g. "AASF#1" → prefix="AASF", digit="1";
     "FMS8" → prefix="FMS", digit="8"; "KS ARNG" → prefix="KS",
     digit="" (we then also try "ARNG" as a secondary prefix).
   - A child folder matches when:
     * Prefix appears as a whole word in the folder name, AND
     * If a digit is required, that digit appears adjacent to the
       prefix (e.g. "AASF 1", "AASF1", "FMS 8 Ottawa").
   - For multi-word tokens like "KS ARNG", any meaningful word matches
     ("ARNG" is enough).

   Returns null if no folder qualifies. */
function findFolderByToken_(parentFolder, canonicalName) {
  if (!canonicalName) return null;
  const wanted = String(canonicalName).toUpperCase().trim();

  /* Pull (prefix, digit) — e.g. "AASF#1" → ["AASF", "1"]. */
  const m = wanted.match(/^([A-Z][A-Z#]*[A-Z]|[A-Z]+)\s*#?\s*(\d+)?/);
  let prefix = '', digit = '';
  if (m) {
    prefix = m[1].replace(/#/g, '');
    digit = m[2] || '';
  }

  /* For multi-word canonicals ("KS ARNG"), also try each word
     individually as a search term — most IH parent folders are named
     after one word ("ARNG" alone is common). Skip very short noise
     tokens like "KS" alone unless they're the only thing we have. */
  const words = wanted.split(/\s+/).filter(Boolean);
  const searchTokens = [];
  if (prefix && digit) searchTokens.push({ prefix: prefix, digit: digit });
  if (prefix && !digit) searchTokens.push({ prefix: prefix, digit: '' });
  words.forEach(function (w) {
    const ww = w.replace(/[^A-Z0-9]/g, '');
    if (ww.length >= 3 && ww !== prefix) searchTokens.push({ prefix: ww, digit: '' });
  });

  const it = parentFolder.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    const name = f.getName().toUpperCase();
    for (let i = 0; i < searchTokens.length; i++) {
      const tok = searchTokens[i];
      const prefixRe = new RegExp('\\b' + tok.prefix + '\\b');
      if (!prefixRe.test(name)) continue;
      if (!tok.digit) return f;
      /* Digit required — must appear within ~6 chars of the prefix
         token (handles "FMS 8 Ottawa", "AASF #1", "1. AASF 1 Topeka").
         Use a slightly looser regex than \b\d\b so "AASF1" matches too. */
      const digitRe = new RegExp(tok.prefix + '\\s*#?\\s*' + tok.digit + '(?!\\d)');
      if (digitRe.test(name)) return f;
    }
  }
  return null;
}

function saveBlobToFolder_(folder, name, dataUri, replaceByName) {
  /* Parse the data URI: data:image/jpeg;base64,XXXX */
  const m = String(dataUri).match(/^data:(.+?);base64,(.+)$/);
  if (!m) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'malformed dataUri' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const mimeType = m[1];
  const bytes = Utilities.base64Decode(m[2]);

  if (replaceByName) {
    const existing = folder.getFilesByName(name);
    while (existing.hasNext()) existing.next().setTrashed(true);
  }

  const blob = Utilities.newBlob(bytes, mimeType, name);
  const file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { /* org may forbid link sharing — file still saved */ }
  const fileId = file.getId();
  const url = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true, url: url, fileId: fileId, name: name,
      folder: folder.getName(), folderId: folder.getId()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════════
//  SOUND LEVEL HANDLERS
//  Schema mirrors air sampling: flat tab (SoundLevel, one row per
//  measurement) + raw JSON tab (SoundLevelRaw, one row per survey id).
// ══════════════════════════════════════════════════════════════════════
function handleSoundUpsert(ss, data) {
  // Raw JSON tab
  let rawSheet = ss.getSheetByName(SOUND_RAW_SHEET);
  if (!rawSheet) {
    rawSheet = ss.insertSheet(SOUND_RAW_SHEET);
    rawSheet.appendRow(['sound_survey_id', 'updated_at', 'json_data']);
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

  // Flat tab — one row per measurement
  let sheet = ss.getSheetByName(SOUND_SHEET);
  if (!sheet) sheet = ss.insertSheet(SOUND_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SOUND_HEADERS);
    sheet.getRange(1, 1, 1, SOUND_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  // Drop existing rows for this survey id (we'll re-append below). Iterate
  // backwards so deleteRow doesn't shift our index.
  if (sheet.getLastRow() > 1) {
    const existingIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = existingIds.length - 1; i >= 0; i--) {
      if (existingIds[i][0] === data.id) sheet.deleteRow(i + 2);
    }
  }
  const submittedAt = new Date().toLocaleString();
  const rows = buildSoundRows_(data, submittedAt);
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SOUND_HEADERS.length).setValues(rows);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, type: 'sound_level', id: data.id }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSoundDelete(ss, id) {
  const sheet = ss.getSheetByName(SOUND_SHEET);
  const rawSheet = ss.getSheetByName(SOUND_RAW_SHEET);
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
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, action: 'deleted', type: 'sound_level', id: id }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════════
//  doGet — returns surveys + equipment + air sampling + sound level
// ══════════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const surveys = readRawJson_(ss, RAW_SHEET);
    const equipment = readRawJson_(ss, EQUIP_RAW_SHEET);
    const airSurveys = readRawJson_(ss, AIR_RAW_SHEET);
    const soundSurveys = readRawJson_(ss, SOUND_RAW_SHEET);
    const ventSurveys = readRawJson_(ss, VENT_RAW_SHEET);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        surveys: surveys,
        equipment: equipment,
        airSurveys: airSurveys,
        soundSurveys: soundSurveys,
        ventSurveys: ventSurveys
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: err.toString(),
        surveys: [],
        equipment: [],
        airSurveys: [],
        soundSurveys: [],
        ventSurveys: []
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

// ══════════════════════════════════════════════════════════════════════
//  SOUND LEVEL SCHEMA — headers + row builder
//  One row per measurement in a Sound Level Survey, with general info +
//  SLM / Microphone / Calibrator + Pre/Post field cal + signoff repeated
//  on every row so the flat tab is pivot-ready in Sheets.
// ══════════════════════════════════════════════════════════════════════
const SOUND_HEADERS = [
  // Identity & metadata
  'Survey ID','Submitted At','Updated At','Device Nickname',
  // Measurement position
  'Measurement Index',
  // General information (DD 2214 boxes 1, 2)
  'Survey Date','Type Survey (1=Initial 2=ReSurvey 3=Other)',
  'Project / Client','Shop / Activity','SEG','Work Location',
  // Sound Level Meter (box 3)
  'SLM Make','SLM Model','SLM Serial','SLM Last Cal Date',
  // Microphone (box 4)
  'Mic Make','Mic Model','Mic Serial','Mic Last Cal Date',
  // Calibrator (box 5) + reference level
  'Cal Make','Cal Model','Cal Serial','Cal Last Cal Date','Cal Reference Level (dB)',
  // Pre/Post field cal
  'Pre-Cal Date','Pre-Cal Time','Pre-Cal Reading (dB)','Pre-Cal Initials',
  'Post-Cal Date','Post-Cal Time','Post-Cal Reading (dB)','Post-Cal Initials',
  'Drift (dB)','Drift Status',
  // Survey conditions (boxes 6, 7)
  'Wind Screen','Measurements Obtained',
  // SLM settings
  'SLM Weighting','SLM Time Response',
  // Description + sources (boxes 8, 9, 10)
  'Area Description','Primary Source of Noise','Secondary Source of Noise',
  // Measurement (box 11) — per row
  'Location','Meter Action (S/F)','dBC','dBA','Risk Assessment Code','Measurement Notes',
  // HPD (box 12) — auto-calculated per row from dBA
  'HPD: None (<85)','HPD: Plug or Muff (85-108)','HPD: Plug+Muff (108-118)','HPD: Plug+Muff+Time Limit (>118)',
  // Remarks (box 13)
  'Remarks',
  // Box 14
  'More Detailed Eval Required','More Eval Type',
  // Box 15
  'Audiometric Monitoring Names',
  // Box 16
  'Supervisor Name','Supervisor Phone','Supervisor Organization',
  // Boxes 17, 18
  'Survey Performed By','Hearing Conservation Monitor',
];

function buildSoundRows_(data, submittedAt) {
  const g = data.general || {};
  const stamp = submittedAt || new Date().toLocaleString();
  const updatedAt = data.updatedAt || new Date().toISOString();
  const device = data.deviceNickname || '';
  const meas = data.measurements || [];

  function hpdFor(dba) {
    const v = parseFloat(dba);
    if (isNaN(v)) return ['','','',''];
    if (v < 85)  return ['YES','','',''];
    if (v <= 108) return ['','YES','',''];
    if (v <= 118) return ['','','YES',''];
    return ['','','','YES'];
  }

  function commonHead(idx) {
    return [
      data.id || '', stamp, updatedAt, device, idx,
      g.survey_date || '', g.survey_type || '',
      g.project || '', g.shop_name || '', g.seg || '', g.work_location || '',
      g.slm_make || '', g.slm_model || '', g.slm_serial || '', g.slm_last_cal || '',
      g.mic_make || '', g.mic_model || '', g.mic_serial || '', g.mic_last_cal || '',
      g.cal_make || '', g.cal_model || '', g.cal_serial || '', g.cal_last_nist || '', g.cal_ref_level || '',
      g.precal_date || '', g.precal_time || '', g.precal_reading || '', g.precal_initials || '',
      g.postcal_date || '', g.postcal_time || '', g.postcal_reading || '', g.postcal_initials || '',
      g.drift || '', g.drift_status || '',
      g.wind_screen || '', g.meas_location || '',
      g.slm_weighting || '', g.slm_response || '',
      g.area_description || '', g.primary_source || '', g.secondary_source || '',
    ];
  }
  function commonTail() {
    return [
      g.remarks || '',
      g.more_eval || '', g.more_eval_type || '',
      g.audiometric_names || '',
      g.supervisor_name || '', g.supervisor_phone || '', g.supervisor_org || '',
      g.performed_by || '', g.hcm_name || '',
    ];
  }

  const rows = [];
  meas.forEach(function (m, i) {
    const hpd = hpdFor(m.dba);
    const row = commonHead(i + 1).concat([
      m.location || '', m.action || '', m.dbc || '', m.dba || '', m.rac || '', m.notes || '',
    ]).concat(hpd).concat(commonTail());
    rows.push(row);
  });

  // Survey with no measurements: still leave a single row so the IH sees it
  if (!rows.length) {
    const row = commonHead(0).concat(['','','','','','']).concat(['','','','']).concat(commonTail());
    rows.push(row);
  }

  // Safety: pad each row to exactly match header count
  rows.forEach(function (r) {
    while (r.length < SOUND_HEADERS.length) r.push('');
    if (r.length > SOUND_HEADERS.length) r.length = SOUND_HEADERS.length;
  });
  return rows;
}

// ══════════════════════════════════════════════════════════════════════
//  SOUND LEVEL MIGRATION (optional) — rebuild SoundLevel from raw JSON
//
//  Run from the editor: pick migrateSoundFromRaw, click Run. Backs up the
//  existing flat SoundLevel tab to SoundLevel_backup_<timestamp> first.
//  Safe to re-run.
// ══════════════════════════════════════════════════════════════════════
function migrateSoundFromRaw() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const rawSheet = ss.getSheetByName(SOUND_RAW_SHEET);
  if (!rawSheet || rawSheet.getLastRow() <= 1) {
    Logger.log('No data in ' + SOUND_RAW_SHEET + ' — nothing to migrate.');
    return;
  }
  const existing = ss.getSheetByName(SOUND_SHEET);
  if (existing && existing.getLastRow() > 0) {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    existing.copyTo(ss).setName(SOUND_SHEET + '_backup_' + stamp);
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
    } catch (e) { parseFailures++; }
  });
  Logger.log('Parsed ' + surveys.length + ' sound surveys from ' + SOUND_RAW_SHEET +
             (parseFailures ? ' (' + parseFailures + ' failed)' : ''));

  let sheet = ss.getSheetByName(SOUND_SHEET);
  if (sheet) sheet.clear();
  else sheet = ss.insertSheet(SOUND_SHEET);
  sheet.appendRow(SOUND_HEADERS);
  sheet.getRange(1, 1, 1, SOUND_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  let totalRows = 0;
  surveys.forEach(function (s) {
    const rows = buildSoundRows_(s, submittedAtById[s.id] || '');
    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SOUND_HEADERS.length).setValues(rows);
      totalRows += rows.length;
    }
  });
  Logger.log('Sound level migration complete: ' + surveys.length + ' surveys / ' + totalRows + ' rows written to ' + SOUND_SHEET);
  Logger.log('Schema: ' + SOUND_HEADERS.length + ' columns');
}

// ══════════════════════════════════════════════════════════════════════
//  VENTILATION HANDLERS
//  Flat tab (Ventilation, one row per system inside a survey for pivot
//  use in Sheets) + raw JSON tab (VentilationRaw, one row per survey
//  id) that the client reads via doGet for sync-back.
// ══════════════════════════════════════════════════════════════════════
function handleVentUpsert(ss, data) {
  // Raw JSON tab
  let rawSheet = ss.getSheetByName(VENT_RAW_SHEET);
  if (!rawSheet) {
    rawSheet = ss.insertSheet(VENT_RAW_SHEET);
    rawSheet.appendRow(['vent_survey_id', 'updated_at', 'json_data']);
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

  // Flat tab — one row per system
  let sheet = ss.getSheetByName(VENT_SHEET);
  if (!sheet) sheet = ss.insertSheet(VENT_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(VENT_HEADERS);
    sheet.getRange(1, 1, 1, VENT_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  // Drop existing rows for this survey id (re-appended below). Iterate
  // backwards so deleteRow doesn't shift our index.
  if (sheet.getLastRow() > 1) {
    const existingIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = existingIds.length - 1; i >= 0; i--) {
      if (existingIds[i][0] === data.id) sheet.deleteRow(i + 2);
    }
  }
  const submittedAt = new Date().toLocaleString();
  const rows = buildVentRows_(data, submittedAt);
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, VENT_HEADERS.length).setValues(rows);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, type: 'ventilation', id: data.id }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleVentDelete(ss, id) {
  const sheet = ss.getSheetByName(VENT_SHEET);
  const rawSheet = ss.getSheetByName(VENT_RAW_SHEET);
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
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, action: 'deleted', type: 'ventilation', id: id }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════════
//  VENTILATION SCHEMA — headers + row builder
//  One row per system in a Ventilation Survey. General info (org, shop,
//  date, room, velocity meter, surveyor/reviewer) repeats on every row
//  so the flat tab is pivot-ready in Sheets.
// ══════════════════════════════════════════════════════════════════════
const VENT_HEADERS = [
  // Identity & metadata
  'Survey ID','Submitted At','Updated At','Device Nickname',
  // Position
  'System Index',
  // General Information
  'Organization','Location','Shop','Date',
  // Room (for ACH calcs)
  'Room Length (ft)','Room Width (ft)','Room Height (ft)','Design ACH',
  // Velocity meter
  'Meter Make','Meter Model','Meter Serial','Meter Cal Date',
  // System fields (per row)
  'System #','Component #','Duct Shape','Diameter (in)','L — Length (in)','W — Width (in)',
  'M1 (FPM)','M2 (FPM)','M3 (FPM)','M4 (FPM)','M5 (FPM)',
  'AVG FPM','Duct Area (ft²)','CFM (Q)',
  'Engine','Vehicle','Design CFM','Min FPM','Status',
  // Narrative + signoff (survey-wide, repeated)
  'Notes','Design Criteria','Recommendations',
  'Surveyed By','Surveyed Date','Reviewed By','Reviewed Date'
];

function buildVentRows_(data, submittedAt) {
  const g = data.general || {};
  const stamp = submittedAt || new Date().toLocaleString();
  const updatedAt = data.updatedAt || new Date().toISOString();
  const device = data.deviceNickname || '';
  const systems = data.systems || [];

  function commonHead(idx) {
    return [
      data.id || '', stamp, updatedAt, device, idx,
      g.organization || '', g.location || '', g.shop || '', g.date || '',
      g.room_length || '', g.room_width || '', g.room_height || '', g.room_design_ach || '',
      g.meter_make || '', g.meter_model || '', g.meter_serial || '', g.meter_cal_date || ''
    ];
  }
  function commonTail() {
    return [
      g.notes || '', g.design_criteria_text || '', g.recommendations || '',
      g.surveyed_by || '', g.surveyed_date || '', g.reviewed_by || '', g.reviewed_date || ''
    ];
  }

  const rows = [];
  systems.forEach(function (s, i) {
    const row = commonHead(i + 1).concat([
      s.system || '', s.component || '', s.shape || '', s.dia || '', s.width || '', s.height || '',
      s.m1 || '', s.m2 || '', s.m3 || '', s.m4 || '', s.m5 || '',
      s.avg_fpm || '', s.area_ft2 || '', s.cfm || '',
      s.engine || '', s.vehicle || '', s.design_cfm || '', s.min_fpm || '', s.status || ''
    ]).concat(commonTail());
    rows.push(row);
  });

  // Survey with no systems — leave one header-only row so the IH still
  // sees it in the flat tab.
  if (!rows.length) {
    const row = commonHead(0);
    while (row.length < VENT_HEADERS.length) row.push('');
    rows.push(row);
  }

  // Safety: pad each row to exactly match header count.
  rows.forEach(function (r) {
    while (r.length < VENT_HEADERS.length) r.push('');
    if (r.length > VENT_HEADERS.length) r.length = VENT_HEADERS.length;
  });
  return rows;
}

// ══════════════════════════════════════════════════════════════════════
//  VENTILATION MIGRATION (optional) — rebuild Ventilation from raw JSON
//
//  Run from the editor: pick migrateVentFromRaw, click Run. Backs up
//  the existing flat Ventilation tab to Ventilation_backup_<timestamp>
//  first. Safe to re-run.
// ══════════════════════════════════════════════════════════════════════
function migrateVentFromRaw() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const rawSheet = ss.getSheetByName(VENT_RAW_SHEET);
  if (!rawSheet || rawSheet.getLastRow() <= 1) {
    Logger.log('No data in ' + VENT_RAW_SHEET + ' — nothing to migrate.');
    return;
  }
  const existing = ss.getSheetByName(VENT_SHEET);
  if (existing && existing.getLastRow() > 0) {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    existing.copyTo(ss).setName(VENT_SHEET + '_backup_' + stamp);
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
    } catch (e) { parseFailures++; }
  });
  Logger.log('Parsed ' + surveys.length + ' vent surveys from ' + VENT_RAW_SHEET +
             (parseFailures ? ' (' + parseFailures + ' failed)' : ''));

  let sheet = ss.getSheetByName(VENT_SHEET);
  if (sheet) sheet.clear();
  else sheet = ss.insertSheet(VENT_SHEET);
  sheet.appendRow(VENT_HEADERS);
  sheet.getRange(1, 1, 1, VENT_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  let totalRows = 0;
  surveys.forEach(function (s) {
    const rows = buildVentRows_(s, submittedAtById[s.id] || '');
    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, VENT_HEADERS.length).setValues(rows);
      totalRows += rows.length;
    }
  });
  Logger.log('Ventilation migration complete: ' + surveys.length + ' surveys / ' + totalRows + ' rows written to ' + VENT_SHEET);
  Logger.log('Schema: ' + VENT_HEADERS.length + ' columns');
}
