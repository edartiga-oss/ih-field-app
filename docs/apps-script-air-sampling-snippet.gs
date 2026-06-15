/* ============================================================
   Paste into your code.gs alongside the existing Surveys / Equipment
   handling. Adds AirSurveys + AirSurveysRaw tabs and the
   _type === 'air_sampling' branch on doPost. doGet returns a third
   field so the client's pullFromSheets() can merge them.
   ============================================================ */
const AIR_SHEET     = 'AirSurveys';
const AIR_RAW_SHEET = 'AirSurveysRaw';

/* ── add this branch INSIDE doPost(e), before the surveys default branch ── */
/*
function doPost(e) {
  ...
  if (data._type === 'equipment') { ... }
  if (data._type === 'air_sampling') {
    if (data._action === 'delete') return deleteAirSurvey_(data.id);
    return upsertAirSurvey_(data);
  }
  // ...existing surveys default handling
}
*/

function deleteAirSurvey_(id) {
  const ss  = SpreadsheetApp.openById(SHEET_ID);
  [AIR_SHEET, AIR_RAW_SHEET].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const data = sh.getDataRange().getValues();
    /* col A is always the id in our schema */
    for (let r = data.length - 1; r >= 1; r--) {
      if (data[r][0] === id) sh.deleteRow(r + 1);
    }
  });
  return ContentService.createTextOutput(JSON.stringify({ success: true, deleted: id }))
    .setMimeType(ContentService.MimeType.JSON);
}

function upsertAirSurvey_(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  /* Raw tab — full JSON blob keyed by id, so doGet can reconstruct the
     nested survey for the client. */
  let raw = ss.getSheetByName(AIR_RAW_SHEET);
  if (!raw) {
    raw = ss.insertSheet(AIR_RAW_SHEET);
    raw.appendRow(['id', 'updatedAt', 'json']);
  }
  const rawVals = raw.getDataRange().getValues();
  const rawIdx  = rawVals.findIndex((row, i) => i > 0 && row[0] === data.id);
  const rawRow  = [data.id, data.updatedAt || new Date().toISOString(), JSON.stringify(data)];
  if (rawIdx >= 0) raw.getRange(rawIdx + 1, 1, 1, 3).setValues([rawRow]);
  else raw.appendRow(rawRow);

  /* Flat tab — one row per sample so the IH can pivot in Sheets. */
  let flat = ss.getSheetByName(AIR_SHEET);
  if (!flat) {
    flat = ss.insertSheet(AIR_SHEET);
    flat.appendRow(AIR_HEADERS);
  }
  /* Drop any existing rows for this survey id, then re-append. */
  const flatVals = flat.getDataRange().getValues();
  for (let r = flatVals.length - 1; r >= 1; r--) {
    if (flatVals[r][0] === data.id) flat.deleteRow(r + 1);
  }
  buildAirRows_(data).forEach(row => flat.appendRow(row));

  return ContentService.createTextOutput(JSON.stringify({ success: true, id: data.id }))
    .setMimeType(ContentService.MimeType.JSON);
}

const AIR_HEADERS = [
  'id', 'updatedAt', 'deviceNickname',
  'survey_date', 'shop_name', 'shop_priority', 'seg', 'building',
  'parent_location', 'work_location', 'associated_processes',
  'sample_or_blank', 'sample_idx',
  'field_id', 'doehrs_id', 'lab_id', 'task_id',
  'chem', 'sample_type', 'method', 'media', 'media_lot', 'media_exp',
  'emp_name', 'emp_id', 'job_title', 'shift_hrs', 'exp_origin',
  'process', 'task_desc', 'materials', 'activity',
  'ppe', 'engineering', 'administrative', 'respirator', 'ppe_worn',
  'pump_mfg', 'pump_model', 'pump_serial', 'pump_num',
  'cal_model', 'cal_serial', 'cal_mfg_date', 'cal_due',
  'precal_date', 'precal_time', 'precal_flow',
  'postcal_date', 'postcal_time', 'postcal_flow', 'cal_diff',
  'start_date', 'start_time', 'stop_date', 'stop_time',
  'downtime', 'duration', 'flow', 'volume',
  'grav_pre', 'grav_post', 'grav_net',
  'baro_start', 'baro_end', 'temp_start', 'temp_end',
  'rh', 'wind_speed', 'wind_dir',
  'analytes_json',
  'lab_name', 'lab_phone', 'lab_turnaround',
  'lab_date_sent', 'lab_date_analyzed', 'lab_date_reported', 'lab_date_returned',
  'evaluation', 'comments', 'notes_calcs',
  'completed_by', 'qa_review_by',
];

function buildAirRows_(data) {
  const g = data.general || {};
  const rows = [];
  const common = [
    data.id, data.updatedAt || '', data.deviceNickname || '',
    g.survey_date || '', g.shop_name || '', g.shop_priority || '', g.seg || '', g.building || '',
    g.parent_location || '', g.work_location || '', g.associated_processes || '',
  ];
  function pushOne(label, idx, panel) {
    const f = panel.fields || {};
    const analytes = panel.analytes || [];
    const row = common.slice();
    row.push(label, idx);
    row.push(
      f.field_id || '', f.doehrs_id || '', f.lab_id || '', f.task_id || '',
      f.chem || '', f.type || '', f.method || '', f.media || '', f.media_lot || '', f.media_exp || '',
      f.emp_name || '', f.emp_id || '', f.job_title || '', f.shift_hrs || '', f.exp_origin || '',
      f.process || '', f.task_desc || '', f.materials || '', f.activity || '',
      f.ppe || '', f.engineering || '', f.administrative || '', f.respirator || '', f.ppe_worn || '',
      f.pump_mfg || '', f.pump_model || '', f.pump_serial || '', f.pump_num || '',
      f.cal_model || '', f.cal_serial || '', f.cal_mfg_date || '', f.cal_due || '',
      f.precal_date || '', f.precal_time || '', f.precal_flow || '',
      f.postcal_date || '', f.postcal_time || '', f.postcal_flow || '', f.cal_diff || '',
      f.start_date || '', f.start_time || '', f.stop_date || '', f.stop_time || '',
      f.downtime || '', f.duration || '', f.flow || '', f.volume || '',
      f.grav_pre || '', f.grav_post || '', f.grav_net || '',
      f.baro_start || '', f.baro_end || '', f.temp_start || '', f.temp_end || '',
      f.rh || '', f.wind_speed || '', f.wind_dir || '',
      JSON.stringify(analytes),
      g.lab_name || '', g.lab_phone || '', g.lab_turnaround || '',
      g.lab_date_sent || '', g.lab_date_analyzed || '', g.lab_date_reported || '', g.lab_date_returned || '',
      g.evaluation || '', g.comments || '', g.notes_calcs || '',
      g.completed_by || '', g.qa_review_by || '',
    );
    rows.push(row);
  }
  (data.samples || []).forEach((sp, i) => pushOne('sample', i + 1, sp));
  (data.blanks  || []).forEach((sp, i) => pushOne('blank',  i + 1, sp));
  if (!rows.length) {
    /* Make sure a survey with zero samples/blanks still leaves a row so
       the IH sees it in the flat tab. */
    const row = common.slice();
    row.push('header_only', 0);
    while (row.length < AIR_HEADERS.length) row.push('');
    rows.push(row);
  }
  return rows;
}

/* ── extend doGet so the client gets airSurveys too ── */
/*
function doGet(e) {
  ...
  const surveys     = pullSurveysFromRaw_();
  const equipment   = pullEquipmentFromRaw_();
  const airSurveys  = pullAirSurveysFromRaw_();
  return ContentService.createTextOutput(JSON.stringify({
    success: true, surveys, equipment, airSurveys
  })).setMimeType(ContentService.MimeType.JSON);
}
*/
function pullAirSurveysFromRaw_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(AIR_RAW_SHEET);
  if (!sh) return [];
  const vals = sh.getDataRange().getValues();
  const out = [];
  for (let r = 1; r < vals.length; r++) {
    try { out.push(JSON.parse(vals[r][2])); }
    catch (e) { /* skip malformed row */ }
  }
  return out;
}
