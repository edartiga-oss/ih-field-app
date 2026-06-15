/* IH Field App — Sound Level survey module.
   Parallels air-sampling.js: localStorage-backed list of surveys, Sheets
   sync via _type: 'sound_level', per-survey measurement rows with photo
   upload (downscaled JPEG data URIs). Official print layout still TBD —
   for now Print/PDF uses window.print() against the live form. */
(function(){
'use strict';

const STORAGE_KEY = 'ih_sound_surveys_v1';
const QUEUE_KEY   = 'ih_sound_sync_queue_v1';

let soundSurveys = [];
let currentSurveyId = null;
let measurements = [];       /* array of {location, description, time, leq, max, min, peak, conditions, notes, photo} */
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

/* ── Drift calc ── */
function recomputeDrift(){
  const pre = num((fld('precal_reading')||{}).value);
  const post = num((fld('postcal_reading')||{}).value);
  const driftEl = el('soundDrift'), statusEl = el('soundDriftStatus');
  if (pre == null || post == null) {
    if (driftEl) driftEl.value = '';
    if (statusEl) statusEl.value = 'awaiting readings';
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

/* ── Measurement rows ── */
function measRowHTML(idx, data){
  const d = data || {};
  const photo = measPhotos[idx] || measPhotoUrls[idx] || '';
  return '<tr data-row="'+idx+'">'+
    '<td style="text-align:center;color:#666">'+idx+'</td>'+
    '<td><input data-key="location" value="'+esc(d.location)+'"></td>'+
    '<td><input data-key="description" value="'+esc(d.description)+'"></td>'+
    '<td><input type="time" data-key="time" value="'+esc(d.time)+'"></td>'+
    '<td><input type="number" step="0.1" data-key="leq" value="'+esc(d.leq)+'" style="text-align:right"></td>'+
    '<td><input type="number" step="0.1" data-key="max" value="'+esc(d.max)+'" style="text-align:right"></td>'+
    '<td><input type="number" step="0.1" data-key="min" value="'+esc(d.min)+'" style="text-align:right"></td>'+
    '<td><input type="number" step="0.1" data-key="peak" value="'+esc(d.peak)+'" style="text-align:right"></td>'+
    '<td><textarea data-key="notes" rows="1">'+esc(d.notes)+'</textarea></td>'+
    '<td>'+
      (photo
        ? '<img class="sl-photo-thumb" src="'+esc(photo)+'" referrerpolicy="no-referrer">'+
          '<button type="button" class="rm" onclick="Sound.removeMeasPhoto('+idx+')" title="Remove photo">&times;</button>'
        : '<label class="sl-photo-btn">+ Photo<input type="file" accept="image/*" capture="environment" style="display:none" onchange="Sound.onMeasPhoto('+idx+', this)"></label>')+
    '</td>'+
    '<td><button type="button" class="rm" onclick="Sound.deleteMeasurement('+idx+')" title="Delete row">&times;</button></td>'+
  '</tr>';
}

function snapshotMeasurements(){
  /* Read current row values into the `measurements` array (keyed by data-row).
     Called before any rebuild so user-typed values aren't lost. */
  const body = el('soundMeasBody'); if (!body) return;
  const next = [];
  body.querySelectorAll('tr').forEach(tr => {
    const idx = +tr.dataset.row;
    const row = { _idx: idx };
    tr.querySelectorAll('input[data-key], textarea[data-key]').forEach(inp => {
      row[inp.dataset.key] = inp.value;
    });
    next.push(row);
  });
  measurements = next;
}

function renderMeasurements(){
  const body = el('soundMeasBody'); if (!body) return;
  if (!measurements.length) {
    body.innerHTML = '<tr><td colspan="11" style="color:#999;font-style:italic;padding:10px">No measurements yet — click "+ Add Measurement" to start.</td></tr>';
    return;
  }
  body.innerHTML = measurements.map(r => measRowHTML(r._idx, r)).join('');
}

function addMeasurement(data){
  snapshotMeasurements();
  measRowCount++;
  measurements.push(Object.assign({ _idx: measRowCount }, data || {}));
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
    location: last.location || '',
    description: last.description || '',
    /* clear per-measurement specifics: time + dB values + notes */
    time: '', leq: '', max: '', min: '', peak: '', notes: ''
  });
  renderMeasurements();
  if (window.showToast) showToast('Duplicated last measurement — cleared time, dB values, and notes', 'success');
}

function deleteMeasurement(idx){
  snapshotMeasurements();
  measurements = measurements.filter(r => r._idx !== idx);
  delete measPhotos[idx];
  delete measPhotoUrls[idx];
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
  delete measPhotos[idx];
  delete measPhotoUrls[idx];
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
    const out = { location: r.location||'', description: r.description||'', time: r.time||'',
                  leq: r.leq||'', max: r.max||'', min: r.min||'', peak: r.peak||'',
                  notes: r.notes||'' };
    if (measPhotos[r._idx])    out.photo    = measPhotos[r._idx];
    if (measPhotoUrls[r._idx]) out.photoUrl = measPhotoUrls[r._idx];
    return out;
  });
  return P;
}

function applyPrefill(data){
  if (!data) return;
  /* Reset state */
  measRowCount = 0; measurements = []; measPhotos = {}; measPhotoUrls = {};
  /* Restore general fields */
  Object.keys(data.general || {}).forEach(k => {
    const f = fld(k); if (f) f.value = data.general[k];
  });
  /* Restore measurements */
  (data.measurements || []).forEach(m => {
    measRowCount++;
    measurements.push({
      _idx: measRowCount,
      location: m.location || '', description: m.description || '', time: m.time || '',
      leq: m.leq || '', max: m.max || '', min: m.min || '', peak: m.peak || '', notes: m.notes || ''
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
  /* Start fresh with 3 empty measurement rows so the table isn't empty. */
  for (let i = 0; i < 3; i++) addMeasurement();
  renderSurveyList();
  recomputeDrift();
}

function newSurvey(){
  resetForm();
}

/* ── Persistence ── */
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
  if (idx >= 0) soundSurveys[idx] = record;
  else soundSurveys.unshift(record);
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
    try {
      const data = JSON.parse(rd.result);
      applyPrefill(data);
      if (window.showToast) showToast('Session loaded: ' + file.name, 'success');
    } catch(e){
      if (window.showToast) showToast('Could not load file — ' + e.message, 'error');
    }
  };
  rd.readAsText(file); ev.target.value = '';
}

/* ── Print (placeholder — official layout TBD) ── */
function printForm(){
  /* For now just trigger the browser print on the live form. When the
     user supplies the official Sound Level form, we'll build a dedicated
     print layout the same way as Air Sampling's "Print Official Form". */
  window.print();
}

/* ── Sheets sync (mirrors air-sampling.js pattern) ── */
function sheetsUrl(){ return (window.getSheetsUrl && window.getSheetsUrl()) || ''; }

function pushToSheets(record){
  const url = sheetsUrl();
  if (!url || !navigator.onLine) { queueSync(record); return; }
  /* Strip data-URI photos from the sheet payload (size limit); they
     should be uploaded to Drive via the same _type:'air_photo' branch
     once the Apps Script supports sound surveys. For now we just keep
     photos local. */
  const sheetPayload = JSON.parse(JSON.stringify(record));
  if (sheetPayload.measurements) {
    sheetPayload.measurements.forEach(m => { delete m.photo; });
  }
  const payload = Object.assign({ _type: 'sound_level' }, sheetPayload, {
    deviceInfo: navigator.userAgent.substring(0, 80)
  });
  fetch(url, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(() => removePendingSync(record.id))
    .catch(() => queueSync(record));
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

/* ── Top-level card collapsible (matches air-sampling pattern) ── */
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
  if (!document.getElementById('soundForm')) return;
  loadFromStorage();
  /* Start with 3 empty measurement rows for convenience */
  for (let i = 0; i < 3; i++) addMeasurement();
  renderSurveyList();
  initCollapsible();
  recomputeDrift();
  if (navigator.onLine) setTimeout(flushSyncQueue, 2500);
  initialized = true;
}

window.Sound = Object.assign(window.Sound || {}, {
  // measurement rows
  addMeasurement, duplicateLastMeasurement, deleteMeasurement,
  onMeasPhoto, removeMeasPhoto,
  // calibration
  recomputeDrift,
  // surveys
  saveSurvey, loadSurvey, deleteSurvey, newSurvey, resetForm,
  // session save/load
  saveSession, onLoadFile,
  // print
  printForm,
  // sync hooks (called from index.html)
  flushSyncQueue, mergeRemoteSurveys,
  // init hook
  init: initForm,
});

document.addEventListener('DOMContentLoaded', function(){
  if (!initialized) initForm();
});
})();
