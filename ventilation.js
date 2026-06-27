/* IH FieldLink — Ventilation Survey module.
   Models the existing PIKA / Texas ARNG Ventilation Survey spreadsheet:
     * Per-system / per-component velocity measurements (5 readings)
     * Auto-calculated AVG FPM, Duct Area, CFM (Q), and Air Change/Hr
     * Engine reference library for vehicle exhaust design criteria
     * Round duct vs rectangular vent vs ACH-based room exhaust modes
     * Saved to localStorage and synced to the SoundLevel/AirSampling-
       style Sheets back-end when the IH has a Sheets URL configured. */
(function(){
'use strict';

const STORAGE_KEY = 'ih_vent_surveys_v1';
const QUEUE_KEY   = 'ih_vent_sync_queue_v1';

let ventSurveys = [];
let currentSurveyId = null;
let systems = [];   // {sid, system, component, ...measurements / calcs}
let sysCount = 0;

/* ── helpers ── */
const num = v => { const x = parseFloat(v); return isNaN(x) ? null : x; };
const el  = id => document.getElementById(id);
const fld = name => document.querySelector('#ventForm [name="'+name+'"]');
const round = (x,d=2) => { const f = Math.pow(10,d); return Math.round(x*f)/f; };
const esc = s => String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
  .replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escJsAttr = s => String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");

function generateVentId(){ return 'VENT-' + Date.now().toString(36).toUpperCase(); }

/* ── Engine reference library — pulled from the Texas ARNG vehicle
   exhaust design-criteria sheet. Each row gives an engine, its
   displacement, low-idle and (optional) high-idle CFM, and the
   vehicles that engine powers. Selecting an engine in a system row
   auto-fills the Design Criteria CFM field. ──────────────────── */
const ENGINE_LIBRARY = [
  { engine:'Continental AVDS-1790-8CR', size:'29.3L', lowCfm:968, highCfm:null, vehicles:'M88A2 Hercules' },
  { engine:'Caterpillar C18',           size:'18.1L', lowCfm:597, highCfm:null, vehicles:'M1070A1 HET' },
  { engine:'Caterpillar C15',           size:'15.2L', lowCfm:501, highCfm:940,  vehicles:'M1075A1 PLS, HEMTT A4 Variants' },
  { engine:'Detroit Diesel S60',        size:'14.0L', lowCfm:462, highCfm:null, vehicles:'M915A3, M915A5' },
  { engine:'Cummins NTC 400',           size:'14.0L', lowCfm:482, highCfm:null, vehicles:'M916A3' },
  { engine:'Caterpillar C13',           size:'12.5L', lowCfm:412, highCfm:null, vehicles:'M1272 Buffalo' },
  { engine:'Caterpillar C12',           size:'11.9L', lowCfm:393, highCfm:null, vehicles:'' },
  { engine:'Caterpillar 3176',          size:'10.3L', lowCfm:340, highCfm:null, vehicles:'DR7-II Dozer' },
  { engine:'Cummins 6CTA8.3',           size:'8.3L',  lowCfm:274, highCfm:null, vehicles:'M1117 ASV' },
  { engine:'Caterpillar C7',            size:'7.2L',  lowCfm:238, highCfm:null, vehicles:'LMTV, MTV, M-ATV' },
  { engine:'Gale Banks Engineering 866T', size:'6.6L', lowCfm:218, highCfm:null, vehicles:'JLTV' },
  { engine:'General Engine Products V8', size:'6.5L', lowCfm:214, highCfm:null, vehicles:'HMMWV' },
  { engine:'General Motors 6V53T',      size:'5.2L',  lowCfm:172, highCfm:null, vehicles:'M113A3' }
];

function engineOptions(){
  return '<option value="">— select engine —</option>' +
    ENGINE_LIBRARY.map(e => (
      '<option value="'+esc(e.engine)+'">'+esc(e.engine)+' &middot; '+esc(e.size)+
      ' &middot; '+e.lowCfm+' CFM'+(e.highCfm?(' / '+e.highCfm+' CFM hi-idle'):'')+
      (e.vehicles?(' &middot; '+esc(e.vehicles)):'')+'</option>'
    )).join('') + '<option value="__custom__">Other / Custom (enter manually)</option>';
}
function findEngine(name){ return ENGINE_LIBRARY.find(e => e.engine === name) || null; }

/* ── Duct / vent / room math ─────────────────────────────────── */
function ductAreaFt2(shape, dia, w, h){
  if (shape === 'round') {
    const d = num(dia); if (d == null || d <= 0) return null;
    const r = (d/12)/2;
    return Math.PI * r * r;
  }
  if (shape === 'rect') {
    const ww = num(w), hh = num(h);
    if (ww == null || hh == null || ww <= 0 || hh <= 0) return null;
    return (ww/12) * (hh/12);
  }
  return null;
}
function avgFpm(measurements){
  const vs = measurements.map(num).filter(v => v != null);
  if (!vs.length) return null;
  return vs.reduce((a,b) => a+b, 0) / vs.length;
}

/* ── Storage ─────────────────────────────────────────────────── */
function loadFromStorage(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) ventSurveys = JSON.parse(raw) || [];
  } catch(e) { ventSurveys = []; }
  ventSurveys.forEach(s => { if (!s.id) s.id = generateVentId(); });
}
function saveToStorage(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ventSurveys)); }
  catch(e) { if (window.showToast) showToast('Storage error saving ventilation survey', 'error'); }
}

/* ── System row management ────────────────────────────────────── */
function addSystem(seed){
  sysCount++;
  const sid = sysCount;
  systems.push({ sid });
  el('ventSysBody').insertAdjacentHTML('beforeend', systemRowHTML(sid));
  if (seed) {
    Object.keys(seed).forEach(k => { const f = fld('sys'+sid+'_'+k); if (f) f.value = seed[k] || ''; });
  }
  recomputeSystem(sid);
  return sid;
}
function deleteSystem(sid){
  systems = systems.filter(s => s.sid !== sid);
  const row = document.querySelector('#ventSysBody tr[data-sid="'+sid+'"]');
  if (row) row.remove();
  const next = document.querySelector('#ventSysBody tr[data-sid="'+sid+'"] + tr');
  // Touch nothing else — IDs stay stable per-row.
}
function duplicateLastSystem(){
  if (!systems.length) return addSystem();
  const last = systems[systems.length - 1];
  const sid = last.sid;
  // Gather current values, then seed a new row.
  const fieldNames = [
    'system','component','shape','dia','width','height',
    'engine','vehicle','design_cfm',
    'm1','m2','m3','m4','m5'
  ];
  const seed = {};
  fieldNames.forEach(n => {
    const f = fld('sys'+sid+'_'+n);
    if (f) seed[n] = f.value;
  });
  return addSystem(seed);
}

function systemRowHTML(sid){
  return ''+
    '<tr data-sid="'+sid+'">'+
      '<td class="v-sid">#'+sid+'</td>'+
      '<td><input name="sys'+sid+'_system" placeholder="1" style="width:50px"></td>'+
      '<td><input name="sys'+sid+'_component" placeholder="1" style="width:50px"></td>'+
      '<td>'+
        '<select name="sys'+sid+'_shape" onchange="Vent.recomputeSystem('+sid+')">'+
          '<option value="round" selected>Round (Ø)</option>'+
          '<option value="rect">Rectangular (L × W)</option>'+
        '</select>'+
      '</td>'+
      '<td><input type="number" step="any" name="sys'+sid+'_dia" placeholder="in" style="width:64px" oninput="Vent.recomputeSystem('+sid+')"></td>'+
      '<td><input type="number" step="any" name="sys'+sid+'_width" placeholder="L (in)" style="width:64px" oninput="Vent.recomputeSystem('+sid+')"></td>'+
      '<td><input type="number" step="any" name="sys'+sid+'_height" placeholder="W (in)" style="width:64px" oninput="Vent.recomputeSystem('+sid+')"></td>'+
      '<td><input type="number" step="any" name="sys'+sid+'_m1" placeholder="FPM" style="width:64px" oninput="Vent.recomputeSystem('+sid+')"></td>'+
      '<td><input type="number" step="any" name="sys'+sid+'_m2" placeholder="FPM" style="width:64px" oninput="Vent.recomputeSystem('+sid+')"></td>'+
      '<td><input type="number" step="any" name="sys'+sid+'_m3" placeholder="FPM" style="width:64px" oninput="Vent.recomputeSystem('+sid+')"></td>'+
      '<td><input type="number" step="any" name="sys'+sid+'_m4" placeholder="FPM" style="width:64px" oninput="Vent.recomputeSystem('+sid+')"></td>'+
      '<td><input type="number" step="any" name="sys'+sid+'_m5" placeholder="FPM" style="width:64px" oninput="Vent.recomputeSystem('+sid+')"></td>'+
      '<td class="v-calc" id="sys'+sid+'_avg_fpm">—</td>'+
      '<td class="v-calc" id="sys'+sid+'_area_ft2">—</td>'+
      '<td class="v-calc" id="sys'+sid+'_cfm">—</td>'+
      '<td>'+
        '<select name="sys'+sid+'_engine" onchange="Vent.onEngineChange('+sid+')">'+engineOptions()+'</select>'+
        '<input name="sys'+sid+'_vehicle" placeholder="Vehicle (optional)" style="margin-top:3px;width:100%">'+
      '</td>'+
      '<td><input type="number" step="any" name="sys'+sid+'_design_cfm" placeholder="CFM" style="width:72px" oninput="Vent.recomputeSystem('+sid+')"></td>'+
      '<td class="v-calc" id="sys'+sid+'_min_fpm">—</td>'+
      '<td class="v-status" id="sys'+sid+'_status">—</td>'+
      '<td><button type="button" class="v-rm" title="Delete row" onclick="Vent.deleteSystem('+sid+')">×</button></td>'+
    '</tr>';
}

function onEngineChange(sid){
  const f = fld('sys'+sid+'_engine'); if (!f) return;
  const e = findEngine(f.value);
  if (e) {
    const dcf = fld('sys'+sid+'_design_cfm');
    if (dcf) dcf.value = e.lowCfm;
    const veh = fld('sys'+sid+'_vehicle');
    if (veh && !veh.value) veh.value = e.vehicles || '';
  }
  recomputeSystem(sid);
}

function recomputeSystem(sid){
  const shape = (fld('sys'+sid+'_shape')||{}).value || 'round';
  const dia   = (fld('sys'+sid+'_dia')||{}).value;
  const w     = (fld('sys'+sid+'_width')||{}).value;
  const h     = (fld('sys'+sid+'_height')||{}).value;
  const area  = ductAreaFt2(shape, dia, w, h);
  const measurements = ['m1','m2','m3','m4','m5'].map(n => (fld('sys'+sid+'_'+n)||{}).value);
  const avg = avgFpm(measurements);
  const cfm = (avg != null && area != null) ? avg * area : null;
  const designCfm = num((fld('sys'+sid+'_design_cfm')||{}).value);
  const minFpm = (designCfm != null && area != null && area > 0) ? designCfm / area : null;

  const set = (id, txt) => { const e = el(id); if (e) e.textContent = txt; };
  set('sys'+sid+'_avg_fpm', avg != null ? round(avg,1) : '—');
  set('sys'+sid+'_area_ft2', area != null ? round(area,4) : '—');
  set('sys'+sid+'_cfm', cfm != null ? round(cfm,1) : '—');
  set('sys'+sid+'_min_fpm', minFpm != null ? round(minFpm,1) : '—');

  // Pass / Fail
  const stEl = el('sys'+sid+'_status');
  if (!stEl) return;
  if (cfm != null && designCfm != null) {
    const pass = cfm >= designCfm;
    stEl.textContent = pass ? 'PASS' : 'FAIL';
    stEl.className = 'v-status ' + (pass ? 'v-pass' : 'v-fail');
  } else if (avg === 0 || (avg != null && avg === 0)) {
    stEl.textContent = 'INOP';
    stEl.className = 'v-status v-fail';
  } else {
    stEl.textContent = '—';
    stEl.className = 'v-status';
  }
}
function recomputeAll(){ systems.forEach(s => recomputeSystem(s.sid)); recomputeRoom(); }

/* ── Room / ACH (battery room style) ─────────────────────────── */
function recomputeRoom(){
  const L = num((fld('room_length')||{}).value);
  const W = num((fld('room_width')||{}).value);
  const H = num((fld('room_height')||{}).value);
  const vol = (L && W && H) ? L * W * H : null;
  if (el('room_volume')) el('room_volume').textContent = vol != null ? round(vol,1) : '—';
  // ACH = total CFM × 60 / room volume
  let totalCfm = 0; let haveCfm = false;
  systems.forEach(s => {
    const v = el('sys'+s.sid+'_cfm');
    const n = v ? parseFloat(v.textContent) : NaN;
    if (!isNaN(n)) { totalCfm += n; haveCfm = true; }
  });
  const ach = (haveCfm && vol) ? (totalCfm * 60 / vol) : null;
  if (el('room_total_cfm')) el('room_total_cfm').textContent = haveCfm ? round(totalCfm,1) : '—';
  if (el('room_ach'))       el('room_ach').textContent       = ach != null ? round(ach,2) : '—';
  // Pass/fail against design ACH
  const designAch = num((fld('room_design_ach')||{}).value);
  const stEl = el('room_ach_status');
  if (stEl) {
    if (ach != null && designAch != null) {
      const pass = ach >= designAch;
      stEl.textContent = pass ? 'PASS' : 'FAIL';
      stEl.className = 'v-status ' + (pass ? 'v-pass' : 'v-fail');
    } else { stEl.textContent = '—'; stEl.className = 'v-status'; }
  }
}

/* ── Form collection & persistence ───────────────────────────── */
function collectForm(){
  const g = {};
  document.querySelectorAll('#ventForm [name]:not([data-skip])').forEach(input => {
    if (input.closest('tr[data-sid]')) return;
    g[input.name] = input.value;
  });
  const sys = systems.map(s => {
    const row = {};
    ['system','component','shape','dia','width','height',
     'm1','m2','m3','m4','m5','engine','vehicle','design_cfm'].forEach(n => {
      const f = fld('sys'+s.sid+'_'+n); row[n] = f ? f.value : '';
    });
    // Calcs (read from display cells)
    row.avg_fpm  = (el('sys'+s.sid+'_avg_fpm')||{}).textContent || '';
    row.area_ft2 = (el('sys'+s.sid+'_area_ft2')||{}).textContent || '';
    row.cfm      = (el('sys'+s.sid+'_cfm')||{}).textContent || '';
    row.min_fpm  = (el('sys'+s.sid+'_min_fpm')||{}).textContent || '';
    row.status   = (el('sys'+s.sid+'_status')||{}).textContent || '';
    return row;
  });
  return { id: currentSurveyId, general: g, systems: sys };
}
function applyPrefill(data){
  if (!data) return;
  const g = data.general || {};
  Object.keys(g).forEach(k => { const f = fld(k); if (f) f.value = g[k] || ''; });
  el('ventSysBody').innerHTML = ''; systems = []; sysCount = 0;
  (data.systems || []).forEach(row => addSystem(row));
  if (!systems.length) addSystem();
  recomputeAll();
}
function resetForm(){
  if (!confirm('Clear the form? Unsaved changes will be lost.')) return;
  document.getElementById('ventForm').reset();
  el('ventSysBody').innerHTML = ''; systems = []; sysCount = 0;
  addSystem(); addSystem();
  currentSurveyId = null;
  recomputeAll();
}
function newSurvey(){
  currentSurveyId = generateVentId();
  document.getElementById('ventForm').reset();
  el('ventSysBody').innerHTML = ''; systems = []; sysCount = 0;
  addSystem(); addSystem();
  recomputeAll();
  if (window.showToast) showToast('New ventilation survey started', 'success');
}
function saveSurvey(){
  if (!currentSurveyId) currentSurveyId = generateVentId();
  const data = collectForm();
  data.updatedAt = new Date().toISOString();
  data.deviceNickname = (window.deviceNickname) || '';
  const idx = ventSurveys.findIndex(s => s.id === currentSurveyId);
  if (idx >= 0) ventSurveys[idx] = data;
  else ventSurveys.unshift(data);
  saveToStorage();
  pushToSheets(data);
  renderSurveyList();
  if (window.showToast) showToast('Ventilation survey saved', 'success');
}
function loadSurvey(id){
  const s = ventSurveys.find(x => x.id === id); if (!s) return;
  currentSurveyId = id;
  applyPrefill(s);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.showToast) showToast('Loaded: '+(s.general?.shop||id), 'success');
}
function deleteSurvey(id){
  const s = ventSurveys.find(x => x.id === id);
  if (!s) return;
  if (!confirm('Delete this ventilation survey?\n\n'+(s.general?.shop||'')+' '+(s.general?.date||''))) return;
  ventSurveys = ventSurveys.filter(x => x.id !== id);
  saveToStorage();
  deleteFromSheets(id);
  renderSurveyList();
  if (currentSurveyId === id) { currentSurveyId = null; }
  if (window.showToast) showToast('Deleted', 'success');
}

function renderSurveyList(){
  const host = el('ventSurveysList'); if (!host) return;
  el('ventSurveysCount').textContent = ventSurveys.length + ' survey' + (ventSurveys.length !== 1 ? 's' : '');
  if (!ventSurveys.length) {
    host.innerHTML = '<div style="padding:14px;color:var(--v-muted);font-size:13px;">No ventilation surveys saved yet.</div>';
    return;
  }
  host.innerHTML = ventSurveys.map(s => {
    const g = s.general || {};
    const shop = g.shop || '(no shop)';
    const loc  = g.location || '';
    const date = g.date || '';
    const cnt  = (s.systems || []).length;
    return ''+
      '<div class="v-surv-row">'+
        '<div>'+
          '<div class="v-surv-title">'+esc(shop)+(loc ? ' &middot; '+esc(loc) : '')+'</div>'+
          '<div class="v-surv-sub">'+esc(date)+' &middot; '+cnt+' system'+(cnt!==1?'s':'')+' &middot; <span style="font-family:var(--mono)">'+esc(s.id)+'</span></div>'+
        '</div>'+
        '<div style="display:flex;gap:6px;">'+
          '<button type="button" onclick="Vent.loadSurvey(\''+escJsAttr(s.id)+'\')">Edit</button>'+
          '<button type="button" class="v-del" onclick="Vent.deleteSurvey(\''+escJsAttr(s.id)+'\')">Del</button>'+
        '</div>'+
      '</div>';
  }).join('');
}

/* ── Sheets sync (Apps Script POST) ───────────────────────────── */
function sheetsUrl(){ return (window.getSheetsUrl && window.getSheetsUrl()) || ''; }
function pushToSheets(record){
  const url = sheetsUrl();
  if (!url || !navigator.onLine) { queueSync(record); return; }
  const payload = Object.assign({ _type: 'ventilation' }, record, {
    deviceInfo: navigator.userAgent.substring(0, 80)
  });
  fetch(url, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => { queueSync(record); });
}
function deleteFromSheets(id){
  const url = sheetsUrl();
  if (!url) return;
  const payload = { _type: 'ventilation', _action: 'delete', id };
  fetch(url, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).catch(()=>{});
}
function queueSync(record){
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    q.push(record); localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch(e){}
}
function flushSyncQueue(){
  const url = sheetsUrl(); if (!url || !navigator.onLine) return;
  let q = [];
  try { q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch(e){}
  if (!q.length) return;
  const next = q.shift();
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  pushToSheets(next);
  if (q.length) setTimeout(flushSyncQueue, 600);
}

/* ── Init ─────────────────────────────────────────────────────── */
let initialized = false;
function initForm(){
  if (!document.getElementById('ventForm')) return;
  try {
    loadFromStorage();
    if (!systems.length) { addSystem(); addSystem(); }
    renderSurveyList();
    recomputeAll();
    if (navigator.onLine) setTimeout(flushSyncQueue, 2500);
    initialized = true;
  } catch(e) { console.error('[Vent] init failed', e); }
}

window.Vent = Object.assign(window.Vent || {}, {
  addSystem, duplicateLastSystem, deleteSystem,
  onEngineChange, recomputeSystem, recomputeRoom, recomputeAll,
  saveSurvey, loadSurvey, deleteSurvey, newSurvey, resetForm,
  flushSyncQueue,
  init: initForm
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ if (!initialized) initForm(); });
} else {
  setTimeout(function(){ if (!initialized) initForm(); }, 0);
}
})();
