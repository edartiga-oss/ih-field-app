/* IH Field App — Sound Level survey module.
   Maps to the official DD Form 2214 (JAN 2000) — "Noise Survey
   (Sound Level Meter Survey)" prescribed by DODI 6055.12. The on-screen
   form fields are numbered to match the DD 2214 boxes; the official
   print layout (Air Sampling-style) reproduces the form. */
(function(){
'use strict';

const STORAGE_KEY = 'ih_sound_surveys_v1';
const QUEUE_KEY   = 'ih_sound_sync_queue_v1';

let soundSurveys = [];
let currentSurveyId = null;
let measurements = [];       /* array of { _idx, location, action, dbc, dba, rac, notes } */
let measRowCount = 0;
let measPhotos = {};         /* row idx -> data URI */
let measPhotoUrls = {};      /* row idx -> Drive URL */

/* ── helpers ── */
const num = v => { const x=parseFloat(v); return isNaN(x)?null:x; };
const el  = id => document.getElementById(id);
const fld = name => document.querySelector('#soundForm [name="'+name+'"]');
const round = (x,d=2)=>{ const f=Math.pow(10,d); return Math.round(x*f)/f; };
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function generateSoundId(){ return 'SND-' + Date.now().toString(36).toUpperCase(); }

function loadFromStorage(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) soundSurveys = JSON.parse(raw) || [];
  } catch(e) { soundSurveys = []; }
  let healed = 0;
  soundSurveys.forEach(s => { if (!s.id) { s.id = generateSoundId(); healed++; } });
  if (healed) saveToStorage();
}
function saveToStorage(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(soundSurveys)); }
  catch(e) { if (window.showToast) showToast('Storage error saving sound survey', 'error'); }
}

/* ── Drift calc (field cal pre vs post must be ≤ 0.5 dB) ── */
function recomputeDrift(){
  const pre = num((fld('precal_reading')||{}).value);
  const post = num((fld('postcal_reading')||{}).value);
  const driftEl = el('soundDrift'), statusEl = el('soundDriftStatus');
  if (pre == null || post == null) {
    if (driftEl) driftEl.value = '';
    if (statusEl) { statusEl.value = 'awaiting readings'; statusEl.style.background = ''; statusEl.style.color = ''; }
    return;
  }
  const d = round(post - pre, 2);
  if (driftEl) driftEl.value = (d > 0 ? '+' : '') + d + ' dB';
  if (statusEl) {
    const ok = Math.abs(d) <= 0.5;
    statusEl.value = ok ? 'OK (≤ 0.5 dB)' : 'INVALID (> 0.5 dB)';
    statusEl.style.background = ok ? '#e7f6ef' : '#fdecea';
    statusEl.style.color = ok ? '#0a7d56' : '#b42318';
  }
}

/* ── HPD requirement per DD 2214 box 12 ──
   None         <  85 dBA
   Plug or Muff 85 - 108 dBA
   Plug + Muff  108 - 118 dBA
   Plug+Muff+Time-Limit  > 118 dBA */
function hpdCategory(dba){
  const v = num(dba); if (v == null) return null;
  if (v < 85) return 'none';
  if (v <= 108) return 'plug_or_muff';
  if (v <= 118) return 'plug_and_muff';
  return 'plug_muff_time';
}
function hpdChecked(category, target){ return category === target ? '☒' : '☐'; }

/* ── Measurement rows ── */
function measRowHTML(idx, data){
  const d = data || {};
  const photo = measPhotos[idx] || measPhotoUrls[idx] || '';
  const hpd = hpdCategory(d.dba);
  const cell = (c) => '<td style="text-align:center;font-family:var(--mono);font-size:14px">'+(hpd === c ? '☒' : '☐')+'</td>';
  return '<tr data-row="'+idx+'">'+
    '<td style="text-align:center;color:#666">'+idx+'</td>'+
    '<td><input data-key="location" value="'+esc(d.location)+'" placeholder="e.g. Snap On Impact Wrench"></td>'+
    '<td><select data-key="action"><option value="S"'+(d.action==='S'?' selected':'')+'>S (Slow)</option><option value="F"'+(d.action==='F'?' selected':'')+'>F (Fast)</option></select></td>'+
    '<td><input type="number" step="0.1" data-key="dbc" value="'+esc(d.dbc)+'" style="text-align:right"></td>'+
    '<td><input type="number" step="0.1" data-key="dba" value="'+esc(d.dba)+'" style="text-align:right" oninput="Sound.refreshHpd&amp;&amp;Sound.refreshHpd('+idx+')"></td>'+
    '<td><input data-key="rac" value="'+esc(d.rac)+'" placeholder="e.g. 2 or IVB" style="text-align:center"></td>'+
    cell('none')+ cell('plug_or_muff')+ cell('plug_and_muff')+ cell('plug_muff_time')+
    '<td>'+
      '<textarea data-key="notes" rows="1" style="min-height:24px">'+esc(d.notes)+'</textarea>'+
      (photo
        ? '<div style="margin-top:4px"><img class="sl-photo-thumb" src="'+esc(photo)+'" referrerpolicy="no-referrer">'+
          '<button type="button" class="rm" onclick="Sound.removeMeasPhoto('+idx+')" title="Remove photo">&times;</button></div>'
        : '<label class="sl-photo-btn" style="margin-top:4px;display:inline-block">+ Photo<input type="file" accept="image/*" capture="environment" style="display:none" onchange="Sound.onMeasPhoto('+idx+', this)"></label>')+
    '</td>'+
    '<td><button type="button" class="rm" onclick="Sound.deleteMeasurement('+idx+')" title="Delete row">&times;</button></td>'+
  '</tr>';
}

function snapshotMeasurements(){
  /* Read current row values into the `measurements` array (keyed by data-row).
     Called before any rebuild so user-typed values aren't lost. */
  const body = el('soundMeasBody'); if (!body) return;
  const next = [];
  body.querySelectorAll('tr[data-row]').forEach(tr => {
    const idx = +tr.dataset.row;
    const row = { _idx: idx };
    tr.querySelectorAll('input[data-key], textarea[data-key], select[data-key]').forEach(inp => {
      row[inp.dataset.key] = inp.value;
    });
    next.push(row);
  });
  measurements = next;
}

function renderMeasurements(){
  const body = el('soundMeasBody'); if (!body) return;
  if (!measurements.length) {
    body.innerHTML = '<tr><td colspan="12" style="color:#999;font-style:italic;padding:10px">No measurements yet — click "+ Add Measurement" to start.</td></tr>';
    return;
  }
  body.innerHTML = measurements.map(r => measRowHTML(r._idx, r)).join('');
}

/* Refresh just one row's HPD checkbox cells without rerendering the entire
   table — keeps focus inside the dBA input as the user types. */
function refreshHpd(idx){
  const body = el('soundMeasBody'); if (!body) return;
  const tr = body.querySelector('tr[data-row="'+idx+'"]'); if (!tr) return;
  const dba = (tr.querySelector('[data-key="dba"]')||{}).value;
  const hpd = hpdCategory(dba);
  const tds = tr.querySelectorAll('td');
  /* Columns: 0 idx, 1 location, 2 action, 3 dbc, 4 dba, 5 rac,
              6 none, 7 plug_or_muff, 8 plug_and_muff, 9 plug_muff_time,
              10 notes, 11 delete */
  if (tds.length >= 10) {
    tds[6].textContent = hpd === 'none' ? '☒' : '☐';
    tds[7].textContent = hpd === 'plug_or_muff' ? '☒' : '☐';
    tds[8].textContent = hpd === 'plug_and_muff' ? '☒' : '☐';
    tds[9].textContent = hpd === 'plug_muff_time' ? '☒' : '☐';
  }
}

function addMeasurement(data){
  snapshotMeasurements();
  measRowCount++;
  measurements.push(Object.assign({ _idx: measRowCount, action: 'S' }, data || {}));
  renderMeasurements();
}

function duplicateLastMeasurement(){
  snapshotMeasurements();
  if (!measurements.length) {
    if (window.showToast) showToast('No measurement to duplicate', 'error');
    return addMeasurement();
  }
  const last = measurements[measurements.length - 1];
  measRowCount++;
  measurements.push({
    _idx: measRowCount,
    location: '', action: last.action || 'S',
    dbc: '', dba: '', rac: last.rac || '', notes: ''
  });
  renderMeasurements();
  if (window.showToast) showToast('Duplicated last row — Location, readings & notes cleared; Meter Action and RAC carried over', 'success');
}

function deleteMeasurement(idx){
  snapshotMeasurements();
  measurements = measurements.filter(r => r._idx !== idx);
  delete measPhotos[idx]; delete measPhotoUrls[idx];
  renderMeasurements();
}

/* ── Per-measurement photos ── */
function onMeasPhoto(idx, inputEl){
  const f = inputEl && inputEl.files && inputEl.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = function(){
    const img = new Image();
    img.onload = function(){
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUri = c.toDataURL('image/jpeg', 0.7);
      measPhotos[idx] = dataUri;
      delete measPhotoUrls[idx];
      snapshotMeasurements();
      renderMeasurements();
      inputEl.value = '';
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
}
function removeMeasPhoto(idx){
  delete measPhotos[idx]; delete measPhotoUrls[idx];
  snapshotMeasurements();
  renderMeasurements();
}

/* ── Form data <-> JSON ── */
function collectForm(){
  snapshotMeasurements();
  const P = { general: {}, measurements: [] };
  document.querySelectorAll('#soundForm [name]').forEach(f => {
    if (!f.name) return;
    if (f.type === 'radio') { if (f.checked) P.general[f.name] = f.value; }
    else P.general[f.name] = f.value;
  });
  P.measurements = measurements.map(r => {
    const out = {
      location: r.location||'', action: r.action||'S',
      dbc: r.dbc||'', dba: r.dba||'', rac: r.rac||'',
      notes: r.notes||''
    };
    if (measPhotos[r._idx])    out.photo    = measPhotos[r._idx];
    if (measPhotoUrls[r._idx]) out.photoUrl = measPhotoUrls[r._idx];
    return out;
  });
  return P;
}

function applyPrefill(data){
  if (!data) return;
  measRowCount = 0; measurements = []; measPhotos = {}; measPhotoUrls = {};
  Object.keys(data.general || {}).forEach(k => {
    const f = fld(k); if (f) f.value = data.general[k];
  });
  (data.measurements || []).forEach(m => {
    measRowCount++;
    measurements.push({
      _idx: measRowCount,
      location: m.location || '', action: m.action || 'S',
      dbc: m.dbc || '', dba: m.dba || '', rac: m.rac || '',
      notes: m.notes || ''
    });
    if (m.photo)    measPhotos[measRowCount]    = m.photo;
    if (m.photoUrl) measPhotoUrls[measRowCount] = m.photoUrl;
  });
  renderMeasurements();
  recomputeDrift();
}

/* ── Reset / new ── */
function resetForm(){
  if (!confirm('Clear all fields and start a new sound level survey?')) return;
  document.getElementById('soundForm').reset();
  currentSurveyId = null;
  measRowCount = 0; measurements = []; measPhotos = {}; measPhotoUrls = {};
  for (let i = 0; i < 3; i++) addMeasurement();
  renderSurveyList();
  recomputeDrift();
}
function newSurvey(){ resetForm(); }

/* ── Persistence + list rendering ── */
function saveSurvey(){
  const data = collectForm();
  const id = currentSurveyId || generateSoundId();
  const now = new Date().toISOString();
  const existing = soundSurveys.find(s => s.id === id);
  const record = Object.assign({}, existing || {}, data, {
    id,
    timestamp: existing ? (existing.timestamp || now) : now,
    updatedAt: now,
    deviceNickname: (window.deviceNickname || ''),
  });
  const idx = soundSurveys.findIndex(s => s.id === id);
  if (idx >= 0) soundSurveys[idx] = record; else soundSurveys.unshift(record);
  saveToStorage();
  currentSurveyId = id;
  pushToSheets(record);
  renderSurveyList();
  if (window.showToast) showToast('Sound level survey saved', 'success');
}
function loadSurvey(id){
  const s = soundSurveys.find(x => x.id === id); if (!s) return;
  currentSurveyId = id;
  applyPrefill(s);
  renderSurveyList();
  if (window.showToast) showToast('Loaded ' + (s.general && s.general.shop_name || id), 'success');
}
function deleteSurvey(id){
  if (!confirm('Delete this sound level survey? Also removes it from Google Sheets.')) return;
  soundSurveys = soundSurveys.filter(s => s.id !== id);
  saveToStorage();
  deleteFromSheets(id);
  if (currentSurveyId === id) currentSurveyId = null;
  renderSurveyList();
  if (window.showToast) showToast('Survey deleted', 'success');
}
function renderSurveyList(){
  const host = el('soundSurveysList'); const cnt = el('soundSurveysCount');
  if (!host) return;
  if (cnt) cnt.textContent = soundSurveys.length + ' survey' + (soundSurveys.length===1?'':'s');
  if (!soundSurveys.length) {
    host.innerHTML = '<div style="padding:14px;color:var(--sl-muted);font-style:italic">No saved sound level surveys yet.</div>';
    return;
  }
  host.innerHTML = soundSurveys.map(s => {
    const g = s.general || {};
    const shop = g.shop_name || g.work_location || '(unnamed)';
    const date = g.survey_date || '';
    const measN = (s.measurements || []).length;
    const updated = s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '';
    const isActive = s.id === currentSurveyId;
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--sl-line2);'+
      (isActive ? 'background:var(--sl-accent-soft);' : '')+'">'+
      '<div>'+
        '<div style="font-weight:600;color:var(--sl-ink)">'+esc(shop)+' &middot; '+esc(date)+
          (isActive ? ' <span style="font-size:11px;background:var(--sl-accent);color:#fff;padding:1px 7px;border-radius:10px;margin-left:6px">editing</span>' : '')+
        '</div>'+
        '<div style="font-size:11px;color:var(--sl-muted)">'+measN+' measurement'+(measN===1?'':'s')+' &middot; updated '+esc(updated)+' &middot; <span style="font-family:monospace">'+esc(s.id)+'</span></div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;flex-shrink:0">'+
        '<button type="button" onclick="Sound.loadSurvey(\''+esc(s.id)+'\')">Edit</button>'+
        '<button type="button" class="rm" onclick="Sound.deleteSurvey(\''+esc(s.id)+'\')" title="Delete">&times;</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

/* ── Example data: DD 2214 sample from the user's screenshot ──
   Vehicle Maintenance Bay survey, 25 Mar 2026. Source: hand-filled DD
   Form 2214 image attached during development. Use this to verify the
   printout layout. */
const EXAMPLE_DD2214 = {
  general: {
    survey_date: '2026-03-25',
    survey_type: '1',
    project: 'CSMS 2 Vehicle Maintenance Bay',
    shop_name: 'CSMS 2',
    seg: 'Vehicle Maintenance',
    work_location: 'Vehicle Maintenance Bay',
    slm_make: '3M', slm_model: '2200', slm_serial: 'KOL070041', slm_last_cal: '2025-07-21',
    mic_make: 'N/A', mic_model: 'N/A', mic_serial: 'N/A', mic_last_cal: '',
    cal_make: '3M', cal_model: 'QC-10/QC-20', cal_serial: 'QIL080123', cal_last_nist: '2025-07-21',
    cal_ref_level: '113.6',
    precal_date: '2026-03-25', precal_time: '07:30', precal_reading: '113.6', precal_initials: 'JLS',
    postcal_date: '2026-03-25', postcal_time: '15:45', postcal_reading: '113.6', postcal_initials: 'JLS',
    wind_screen: 'Used',
    meas_location: 'Indoors',
    slm_weighting: 'A',
    slm_response: 'Slow',
    area_description: 'Readings collected from Vehicle Maintenance Bay.\nPre Calibration - 113.6 dBA\nPost Calibration - 113.6 dBA',
    primary_source: 'Vehicles and Tools',
    secondary_source: 'Wind from outdoors',
    remarks: 'Bay Area posted with Hazardous Noise Area signs. Equipment labeled with Hazardous Noise stickers. Employees provided Sound Guard Ear Plugs, 3M E.A.R Classic Ear Plugs, Readymax Ear Plugs, Bilsom Thunder T2 Earmuffs and Prosafe Ear Muffs. Measurements taken at hearing point of operator.\n\nRisk Assessment Code: IVB',
    more_eval: 'No',
    more_eval_type: '',
    audiometric_names: 'Noise Dosimetry conducted on 24 and 25 March 2026 for 11 employees.',
    supervisor_name: 'Yakana, Margaret E.',
    supervisor_phone: '',
    supervisor_org: 'CSMS 2',
    performed_by: 'Scott, Jason L.',
    hcm_name: '',
  },
  measurements: [
    { location: 'Snap On 11,000 RPM Impact Wrench', action: 'S', dbc: '97.1', dba: '95.2', rac: '2', notes: '' },
    { location: 'Dewalt 3/4" Impact Wrench',        action: 'S', dbc: '88.5', dba: '91.6', rac: '2', notes: '' },
    { location: 'Dewalt 7" Angle Grinder',          action: 'S', dbc: '89.9', dba: '92.6', rac: '2', notes: '' },
    { location: 'Toyota Forklift',                  action: 'S', dbc: '87.4', dba: '81.9', rac: '4', notes: '' },
    { location: 'Clark Forklift',                   action: 'S', dbc: '97.2', dba: '84.2', rac: '4', notes: '' },
    { location: 'Welding Shop Pedestal Grinder',    action: 'S', dbc: '81.4', dba: '83.2', rac: '4', notes: '' },
  ],
};

function loadExample(){
  try {
    console.log('[Sound.loadExample] starting');
    if (window.confirm && !confirm('Load the DD 2214 example data (CSMS 2 Vehicle Maintenance Bay)? Current form contents will be replaced.')) return;
    applyPrefill(EXAMPLE_DD2214);
    if (window.showToast) showToast('Loaded DD 2214 example — click "Print DD 2214" to preview', 'success');
    else alert('Loaded DD 2214 example — click "Print DD 2214" to preview');
    console.log('[Sound.loadExample] done');
  } catch(e) {
    console.error('[Sound.loadExample] failed', e);
    alert('Load Example failed: ' + e.message);
  }
}

/* ── Save / Load JSON ── */
function downloadBlob(blob, filename){
  const a=document.createElement('a'); const url=URL.createObjectURL(blob);
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },400);
}
function saveSession(){
  const P = collectForm();
  let base = ((P.general && (P.general.shop_name || 'sound-level')) + ' ' + (P.general.survey_date || '')).trim()
              .replace(/[^\w.-]+/g,'_') || 'sound-level';
  downloadBlob(new Blob([JSON.stringify(P, null, 2)], {type: 'application/json'}), base + '.json');
}
function onLoadFile(ev){
  const file = ev.target.files && ev.target.files[0]; if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try { const data = JSON.parse(rd.result); applyPrefill(data);
          if (window.showToast) showToast('Session loaded: ' + file.name, 'success'); }
    catch(e){ if (window.showToast) showToast('Could not load file — ' + e.message, 'error'); }
  };
  rd.readAsText(file); ev.target.value = '';
}

/* ============================================================
   DD Form 2214 (JAN 2000) — official print layout
   Reproduces the single-page form. Activated by Sound.printOfficialForm()
   which injects a hidden DOM rooted at #soundOfficialPrintRoot and
   triggers window.print() while a body class flips CSS to portrait + DD
   2214 styling.
   ============================================================ */
const CB = '☐', CK = '☒';
function ddVal(v){ return v ? esc(v) : '&nbsp;'; }
function ddDate(iso){ if (!iso) return ''; const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m?(m[1]+m[2]+m[3]):iso; }

function buildOfficialDOM(){
  const existing = document.getElementById('soundOfficialPrintRoot');
  if (existing) existing.remove();
  const P = collectForm();
  const g = P.general || {};
  const meas = P.measurements || [];
  const survType = g.survey_type || '';
  const wsUsed   = g.wind_screen === 'Used';
  const wsNot    = g.wind_screen === 'Not Used';
  const measIn   = g.meas_location === 'Indoors';
  const measOut  = g.meas_location === 'Outdoors';
  const moreYes  = g.more_eval === 'Yes';
  const moreNo   = g.more_eval === 'No';

  /* Row html for measurements — keep auto-checked HPD columns. */
  const measRows = meas.map((r, i) => {
    const cat = hpdCategory(r.dba);
    return '<tr>'+
      '<td class="dd-loc">'+ddVal(r.location)+'</td>'+
      '<td class="dd-c">'+ddVal(r.action)+'</td>'+
      '<td class="dd-c">'+ddVal(r.dbc)+'</td>'+
      '<td class="dd-c">'+ddVal(r.dba)+'</td>'+
      '<td class="dd-c">'+ddVal(r.rac)+'</td>'+
      '<td class="dd-c">'+(cat==='none'?CK:CB)+'</td>'+
      '<td class="dd-c">'+(cat==='plug_or_muff'?CK:CB)+'</td>'+
      '<td class="dd-c">'+(cat==='plug_and_muff'?CK:CB)+'</td>'+
      '<td class="dd-c">'+(cat==='plug_muff_time'?CK:CB)+'</td>'+
    '</tr>';
  }).join('');
  /* Pad with blank rows so the table has a consistent height like the form. */
  const padRows = Math.max(0, 8 - meas.length);
  let blanks = '';
  for (let i = 0; i < padRows; i++) {
    blanks += '<tr>'+'<td>&nbsp;</td>'+'<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>'+'</tr>';
  }

  const html = ''+
    '<div class="dd-form">'+
      '<div class="dd-prescr">Prescribed by: <u>DODI 6055.12</u> &nbsp; <span style="float:right">(Updated 20250318)</span></div>'+
      '<div class="dd-title">NOISE SURVEY<br><span style="font-weight:normal;font-style:italic;font-size:9pt">(Sound Level Meter Survey)</span></div>'+

      /* Row 1 & 2 */
      '<table class="dd"><tr>'+
        '<td class="dd-num" style="width:50%"><b>1. DATE (YYYYMMDD)</b><div class="dd-fill">'+ddVal(ddDate(g.survey_date))+'</div></td>'+
        '<td class="dd-num"><b>2. TYPE SURVEY</b> <span style="font-weight:normal">(Enter code)</span>'+
          '<div class="dd-fill">'+ddVal(survType)+'</div>'+
          '<div class="dd-small">1 - INITIAL SURVEY &nbsp;&nbsp; 2 - RE-SURVEY &nbsp;&nbsp; 3 - OTHER</div>'+
        '</td>'+
      '</tr></table>'+

      /* Boxes 3, 4, 5 — SLM / Microphone / Calibrator */
      '<table class="dd">'+
        '<tr>'+
          '<td class="dd-hdr" colspan="2"><b>3. SOUND LEVEL METER</b></td>'+
          '<td class="dd-hdr" colspan="2"><b>4. MICROPHONE</b></td>'+
          '<td class="dd-hdr" colspan="2"><b>5. CALIBRATOR</b></td>'+
        '</tr>'+
        '<tr>'+
          '<td class="dd-num" colspan="2"><b>a. MANUFACTURER</b><div class="dd-fill">'+ddVal(g.slm_make)+'</div></td>'+
          '<td class="dd-num" colspan="2"><b>a. MANUFACTURER</b><div class="dd-fill">'+ddVal(g.mic_make)+'</div></td>'+
          '<td class="dd-num" colspan="2"><b>a. MANUFACTURER</b><div class="dd-fill">'+ddVal(g.cal_make)+'</div></td>'+
        '</tr>'+
        '<tr>'+
          '<td class="dd-num"><b>b. MODEL</b><div class="dd-fill">'+ddVal(g.slm_model)+'</div></td>'+
          '<td class="dd-num"><b>c. SERIAL NO.</b><div class="dd-fill">'+ddVal(g.slm_serial)+'</div></td>'+
          '<td class="dd-num"><b>b. MODEL</b><div class="dd-fill">'+ddVal(g.mic_model)+'</div></td>'+
          '<td class="dd-num"><b>c. SERIAL NO.</b><div class="dd-fill">'+ddVal(g.mic_serial)+'</div></td>'+
          '<td class="dd-num"><b>b. MODEL</b><div class="dd-fill">'+ddVal(g.cal_model)+'</div></td>'+
          '<td class="dd-num"><b>c. SERIAL NO.</b><div class="dd-fill">'+ddVal(g.cal_serial)+'</div></td>'+
        '</tr>'+
        '<tr>'+
          '<td class="dd-num" colspan="2"><b>d. LAST ELECTROACOUSTIC CALIB DATE</b> (YYYYMMDD)<div class="dd-fill">'+ddVal(ddDate(g.slm_last_cal))+'</div></td>'+
          '<td class="dd-num" colspan="2"><b>d. LAST ELECTROACOUSTIC CALIB DATE</b> (YYYYMMDD)<div class="dd-fill">'+ddVal(ddDate(g.mic_last_cal))+'</div></td>'+
          '<td class="dd-num" colspan="2"><b>d. LAST ELECTROACOUSTIC CALIB DATE</b> (YYYYMMDD)<div class="dd-fill">'+ddVal(ddDate(g.cal_last_nist))+'</div></td>'+
        '</tr>'+
      '</table>'+

      /* Boxes 6 & 7 — Wind Screen / Measurements Obtained */
      '<table class="dd"><tr>'+
        '<td class="dd-num" style="width:50%"><b>6. WIND SCREEN</b> <span style="font-weight:normal">(X one)</span> &nbsp;&nbsp;'+
          (wsUsed?CK:CB)+' USED &nbsp;&nbsp; '+(wsNot?CK:CB)+' NOT USED</td>'+
        '<td class="dd-num"><b>7. MEASUREMENTS OBTAINED</b> <span style="font-weight:normal">(X one)</span> &nbsp;&nbsp;'+
          (measIn?CK:CB)+' INDOORS &nbsp;&nbsp; '+(measOut?CK:CB)+' OUTDOORS</td>'+
      '</tr></table>'+

      /* Box 8 / 9 / 10 */
      '<table class="dd">'+
        '<tr>'+
          '<td class="dd-num" colspan="2" style="width:60%"><b>8. DESCRIPTION OF AREAS/DUTIES WHERE NOISE SURVEY CONDUCTED</b>'+
            '<div class="dd-small">(Illustrate on additional sheet and attach to form)</div>'+
            '<div class="dd-fill-multi">'+ddVal(g.area_description).replace(/\n/g,'<br>')+'</div></td>'+
          '<td class="dd-num"><b>9. PRIMARY SOURCE OF NOISE</b><div class="dd-fill">'+ddVal(g.primary_source)+'</div></td>'+
        '</tr>'+
        '<tr>'+
          '<td class="dd-num" colspan="2">&nbsp;</td>'+
          '<td class="dd-num"><b>10. SECONDARY SOURCE OF NOISE</b><div class="dd-fill">'+ddVal(g.secondary_source)+'</div></td>'+
        '</tr>'+
      '</table>'+

      /* Box 11 / 12 — Sound Level Data + Protection */
      '<table class="dd"><tr>'+
        '<td class="dd-hdr" colspan="6"><b>11. SOUND LEVEL DATA</b></td>'+
        '<td class="dd-hdr" colspan="4"><b>12. PROTECTION REQUIRED</b> <span style="font-weight:normal">(re: dBA - Level)</span></td>'+
      '</tr></table>'+
      '<table class="dd dd-meas"><thead><tr>'+
        '<th><b>a. LOCATION</b></th>'+
        '<th style="width:8%"><b>b. METER ACTION</b></th>'+
        '<th style="width:7%"><b>c. dBC</b></th>'+
        '<th style="width:7%"><b>d. dBA</b></th>'+
        '<th style="width:10%"><b>e. RISK ASSESSMENT CODE</b></th>'+
        '<th style="width:9%"><b>a. NONE</b><br>(Less than 85)</th>'+
        '<th style="width:9%"><b>b. PLUG OR MUFF</b><br>(85-108)</th>'+
        '<th style="width:9%"><b>c. PLUG AND MUFF</b><br>(108-118)</th>'+
        '<th style="width:11%"><b>d. PLUG + MUFF + TIME LIMIT</b><br>(Greater than 118)</th>'+
      '</tr></thead><tbody>'+
        measRows + blanks +
      '</tbody></table>'+
      '<div class="dd-small" style="border:0.5pt solid #000;border-top:none;padding:1pt 3pt">'+
        '<b>NOTES:</b> Range of levels noted by /; i.e., 102/109. At operator stations, measure at ear level.<br>'+
        '<b>METER ACTION:</b> Enter <b>F</b> for fast meter action and <b>S</b> for slow meter action.</div>'+

      /* Box 13 — Remarks */
      '<table class="dd"><tr>'+
        '<td class="dd-num"><b>13. REMARKS</b> <span style="font-weight:normal">(i.e., Area and equipment posted, hearing protection in use, etc.)</span>'+
          '<div class="dd-fill-multi" style="min-height:32pt">'+ddVal(g.remarks).replace(/\n/g,'<br>')+'</div></td>'+
      '</tr></table>'+

      /* Box 14 */
      '<table class="dd"><tr>'+
        '<td class="dd-num" style="width:60%"><b>14. MORE DETAILED NOISE EVALUATION REQUIRED:</b>'+
          (g.more_eval_type ? '<div class="dd-small">'+esc(g.more_eval_type)+'</div>' : '')+'</td>'+
        '<td class="dd-num dd-c" style="width:10%">'+(moreYes?CK:CB)+' YES</td>'+
        '<td class="dd-num dd-c" style="width:30%">'+(moreNo?CK:CB)+' NO <span class="dd-small">(If "YES," identify type evaluation needed.)</span></td>'+
      '</tr></table>'+

      /* Box 15 */
      '<table class="dd"><tr>'+
        '<td class="dd-num"><b>15. NAME(S) OF PERSON(S) IDENTIFIED FOR AUDIOMETRIC MONITORING</b> '+
          '<span style="font-weight:normal">(Use additional sheet if more space is needed and attach to form)</span>'+
          '<div class="dd-fill-multi">'+ddVal(g.audiometric_names).replace(/\n/g,'<br>')+'</div></td>'+
      '</tr></table>'+

      /* Box 16 */
      '<table class="dd"><tr>'+
        '<td class="dd-hdr" colspan="3"><b>16. SUPERVISOR OF NOISE-HAZARDOUS AREA OR OPERATION</b></td>'+
      '</tr><tr>'+
        '<td class="dd-num" style="width:50%"><b>a. NAME</b> <span style="font-weight:normal">(Last, First, Middle Initial)</span>'+
          '<div class="dd-fill">'+ddVal(g.supervisor_name)+'</div></td>'+
        '<td class="dd-num" style="width:25%"><b>b. TELEPHONE</b> <span style="font-weight:normal">(Include area code)</span>'+
          '<div class="dd-fill">'+ddVal(g.supervisor_phone)+'</div></td>'+
        '<td class="dd-num"><b>c. ORGANIZATION</b><div class="dd-fill">'+ddVal(g.supervisor_org)+'</div></td>'+
      '</tr></table>'+

      /* Box 17 & 18 */
      '<table class="dd"><tr>'+
        '<td class="dd-num" style="width:50%"><b>17. SURVEY PERFORMED BY</b> <span style="font-weight:normal">(Last Name, First Name, MI)</span>'+
          '<div class="dd-fill">'+ddVal(g.performed_by)+'</div></td>'+
        '<td class="dd-num"><b>18. HEARING CONSERVATION MONITOR</b> <span style="font-weight:normal">(Last Name, First Name, MI)</span>'+
          '<div class="dd-fill">'+ddVal(g.hcm_name)+'</div></td>'+
      '</tr></table>'+

      '<div class="dd-foot">'+
        '<b>DD FORM 2214, JAN 2000</b>'+
        '<span style="float:right">Page 1 of 2</span>'+
      '</div>'+
    '</div>';

  const root = document.createElement('div');
  root.id = 'soundOfficialPrintRoot';
  root.innerHTML = html;
  document.body.appendChild(root);
}

function printOfficialForm(){
  try {
    console.log('[Sound.printOfficialForm] starting');
    buildOfficialDOM();
    document.body.classList.add('print-sound-official');
    let styleEl = document.getElementById('soundOfficialPageRule');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'soundOfficialPageRule';
      /* DD 2214 is portrait letter with tight margins. */
      styleEl.textContent = '@page { size: letter portrait; margin: 0.35in; }';
      document.head.appendChild(styleEl);
    }
    const cleanup = () => {
      document.body.classList.remove('print-sound-official');
      const s = document.getElementById('soundOfficialPageRule'); if (s) s.remove();
      const d = document.getElementById('soundOfficialPrintRoot'); if (d) d.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    console.log('[Sound.printOfficialForm] calling window.print()');
    window.print();
  } catch(e) {
    console.error('[Sound.printOfficialForm] failed', e);
    alert('Print DD 2214 failed: ' + e.message);
  }
}

function printForm(){
  /* Default Print uses the official DD 2214 layout — that's the
     deliverable the IH attaches to a report. */
  printOfficialForm();
}

/* ── Sheets sync ── */
function sheetsUrl(){ return (window.getSheetsUrl && window.getSheetsUrl()) || ''; }
function pushToSheets(record){
  const url = sheetsUrl();
  if (!url || !navigator.onLine) { queueSync(record); return; }
  const sheetPayload = JSON.parse(JSON.stringify(record));
  if (sheetPayload.measurements) sheetPayload.measurements.forEach(m => { delete m.photo; });
  const payload = Object.assign({ _type: 'sound_level' }, sheetPayload, {
    deviceInfo: navigator.userAgent.substring(0, 80)
  });
  fetch(url, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(() => removePendingSync(record.id)).catch(() => queueSync(record));
}
function deleteFromSheets(id){
  const url = sheetsUrl(); if (!url) return;
  fetch(url, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ _action: 'delete', _type: 'sound_level', id })
  }).catch(() => {});
}
function queueSync(record){
  try {
    let q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    const idx = q.findIndex(s => s.id === record.id);
    if (idx >= 0) q[idx] = record; else q.push(record);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch(e) {}
}
function removePendingSync(id){
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.filter(s => s.id !== id)));
  } catch(e) {}
}
function flushSyncQueue(){
  if (!navigator.onLine) return;
  let q; try { q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch(e) { return; }
  q.forEach(rec => pushToSheets(rec));
}
function mergeRemoteSurveys(remote){
  let newCount = 0, updCount = 0;
  (remote || []).forEach(r => {
    const idx = soundSurveys.findIndex(s => s.id === r.id);
    if (idx < 0) { soundSurveys.unshift(r); newCount++; }
    else {
      const lt = new Date(soundSurveys[idx].updatedAt || soundSurveys[idx].timestamp || 0).getTime();
      const rt = new Date(r.updatedAt || r.timestamp || 0).getTime();
      if (rt > lt) { soundSurveys[idx] = r; updCount++; }
    }
  });
  if (newCount || updCount) { saveToStorage(); renderSurveyList(); }
  return { newCount, updCount };
}

/* ── Collapsible cards ── */
function initCollapsible(){
  document.querySelectorAll('#soundAppHost section.sl-card > h2').forEach(h => {
    if (h.dataset.collapInit) return; h.dataset.collapInit = '1';
    h.insertAdjacentHTML('afterbegin', '<span class="chev" aria-hidden="true">▾</span> ');
    h.addEventListener('click', function(e){
      if (e.target.closest('button,select,input,a,textarea')) return;
      h.parentElement.classList.toggle('collapsed');
    });
  });
}

/* ── Init ── */
let initialized = false;
function initForm(){
  if (!document.getElementById('soundForm')) {
    console.warn('[Sound] init skipped — #soundForm not in DOM yet');
    return;
  }
  try {
    loadFromStorage();
    for (let i = 0; i < 3; i++) addMeasurement();
    renderSurveyList();
    initCollapsible();
    recomputeDrift();
    if (navigator.onLine) setTimeout(flushSyncQueue, 2500);
    initialized = true;
    console.log('[Sound] init complete. Public API:', Object.keys(window.Sound||{}).sort().join(', '));
  } catch(e) {
    console.error('[Sound] init failed', e);
  }
}

window.Sound = Object.assign(window.Sound || {}, {
  addMeasurement, duplicateLastMeasurement, deleteMeasurement, refreshHpd,
  onMeasPhoto, removeMeasPhoto,
  recomputeDrift,
  saveSurvey, loadSurvey, deleteSurvey, newSurvey, resetForm,
  saveSession, onLoadFile, loadExample,
  printForm, printOfficialForm,
  flushSyncQueue, mergeRemoteSurveys,
  init: initForm,
});

/* DOMContentLoaded may have already fired by the time we reach this line
   (if sound-level.js is loaded async / dynamically). Check readyState
   and run inline if needed. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){
    if (!initialized) initForm();
  });
} else {
  /* DOM is already ready — defer one tick so any later body content
     finishes parsing first (defensive). */
  setTimeout(function(){ if (!initialized) initForm(); }, 0);
}
})();
