/* IH FieldLink — Ventilation Survey module.
   Models the existing PIKA / Texas ARNG Ventilation Survey spreadsheet:
     * Per-system / per-component velocity measurements (5 readings)
     * Auto-calculated AVG FPM, Duct Area, CFM (Q), and Air Change/Hr
     * Engine reference library for vehicle exhaust design criteria
     * Transposed layout: rows = field labels, columns = systems
     * Saved to localStorage and synced to the SoundLevel/AirSampling-
       style Sheets back-end when the IH has a Sheets URL configured. */
(function(){
'use strict';

const STORAGE_KEY = 'ih_vent_surveys_v1';
const QUEUE_KEY   = 'ih_vent_sync_queue_v1';

let ventSurveys = [];
let currentSurveyId = null;
let systems = [];     // [{sid}, ...] — one entry per active system column
let sysCount = 0;     // monotonic sid generator (don't reuse on delete)
let photos = [];      // [{pid, label, dataUri}] — system diagrams & site pictures
let photoCount = 0;   // monotonic pid generator

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
   vehicles that engine powers. Selecting an engine in a system column
   auto-fills the Design Criteria CFM field. ─────────────────────── */
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
      ' &middot; '+e.lowCfm+' CFM'+(e.highCfm?(' / '+e.highCfm+' CFM hi'):'')+'</option>'
    )).join('') + '<option value="__custom__">Other / Custom</option>';
}
function findEngine(name){ return ENGINE_LIBRARY.find(e => e.engine === name) || null; }

/* ── Field schema — single source of truth for the transposed table.
   Each entry produces one <tr>; addSystem() appends one <td> per
   entry. Type tag drives the cell template:
     'input'   → text-style input (numeric for most)
     'select'  → static <select>
     'select-engine' → engine dropdown (auto-fills Design CFM)
     'calc'    → read-only display fed by recomputeSystem()
     'status'  → PASS/FAIL/INOP coloured pill, also fed by recompute. */
const FIELDS = [
  { key:'system',     label:'System #',           type:'input',  iattr:'type="number" step="1" placeholder="1" style="width:60px"' },
  { key:'component',  label:'Component #',        type:'input',  iattr:'type="number" step="1" placeholder="1" style="width:60px"' },
  { key:'shape',      label:'Duct Shape',         type:'select', options:[{v:'round',t:'Round (Ø)'},{v:'rect',t:'Rectangular (L × W)'}], onchange:'Vent.recomputeSystem' },
  { key:'dia',        label:'Diameter (in)',      type:'input',  iattr:'type="number" step="any" placeholder="—" style="width:80px"', oninput:'Vent.recomputeSystem' },
  { key:'width',      label:'L — Length (in)',    type:'input',  iattr:'type="number" step="any" placeholder="—" style="width:80px"', oninput:'Vent.recomputeSystem' },
  { key:'height',     label:'W — Width (in)',     type:'input',  iattr:'type="number" step="any" placeholder="—" style="width:80px"', oninput:'Vent.recomputeSystem' },
  { key:'m1',         label:'Measurement 1 (FPM)', type:'input', iattr:'type="number" step="any" style="width:80px"', oninput:'Vent.recomputeSystem' },
  { key:'m2',         label:'Measurement 2 (FPM)', type:'input', iattr:'type="number" step="any" style="width:80px"', oninput:'Vent.recomputeSystem' },
  { key:'m3',         label:'Measurement 3 (FPM)', type:'input', iattr:'type="number" step="any" style="width:80px"', oninput:'Vent.recomputeSystem' },
  { key:'m4',         label:'Measurement 4 (FPM)', type:'input', iattr:'type="number" step="any" style="width:80px"', oninput:'Vent.recomputeSystem' },
  { key:'m5',         label:'Measurement 5 (FPM)', type:'input', iattr:'type="number" step="any" style="width:80px"', oninput:'Vent.recomputeSystem' },
  { key:'avg_fpm',    label:'AVG FPM',            type:'calc' },
  { key:'area_ft2',   label:'Duct Area (ft²)',    type:'calc' },
  { key:'cfm',        label:'CFM (Q)',            type:'calc' },
  { key:'engine',     label:'Engine',             type:'select-engine' },
  { key:'vehicle',    label:'Vehicle',            type:'input', iattr:'placeholder="optional" style="width:160px"' },
  { key:'design_cfm', label:'Design CFM',         type:'input', iattr:'type="number" step="any" style="width:90px"', oninput:'Vent.recomputeSystem' },
  { key:'min_fpm',    label:'Min FPM',            type:'calc' },
  { key:'status',     label:'Status',             type:'status' }
];

/* ── Duct / vent / room math ───────────────────────────────────── */
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

/* ── Example surveys — five real Texas ARNG / ANG datasets from the
   PIKA International ventilation worksheets. Loadable via the
   "Load Example…" dropdown so the IH can preview the form populated
   the way the printed deliverable looks, or seed a new survey at a
   familiar facility. Keys map to a friendly label shown in the
   dropdown. ─────────────────────────────────────────────────── */
const VENT_EXAMPLES = {

  aasf4_soldering: {
    _label: 'TX AASF 4 — Portable Soldering Ventilation (rectangular)',
    general: {
      organization: 'Texas ANG',
      location: 'Houston, TX',
      shop: 'AASF 4 — Aircraft Soldering',
      date: '2025-12-03',
      room_length: '', room_width: '', room_height: '', room_design_ach: '',
      notes: 'SodrTek FX50 Fume Exhauster at the soldering workstation. 115V bench-top unit with activated carbon-impregnated foam filter capturing solder and flux fumes.',
      design_criteria_text: '35 CFM — manufacturer rating for SodrTek FX50.',
      recommendations: 'Turn the SodrTek FX50 on before each soldering job starts. Replace filters per manufacturer schedule to keep capture efficiency in spec.',
      meter_make: 'TSI', meter_model: 'VelociCalc AVM430-A', meter_serial: '9535A2138010', meter_cal_date: '2025-01-23',
      surveyed_by: 'John Alvarado — Industrial Hygienist, PIKA International',
      surveyed_date: '2025-12-03',
      reviewed_by: 'Eduardo Artiga, CIH — PIKA International Inc.',
      reviewed_date: '2025-12-11'
    },
    systems: [
      { system:'1', component:'1', shape:'rect', dia:'', width:'5.1', height:'5.1',
        m1:'130', m2:'144', m3:'112', m4:'108', m5:'155',
        engine:'', vehicle:'', design_cfm:'35' }
    ]
  },

  fms30_overhead_baffles_open: {
    _label: 'FMS 30 — Overhead Exhaust (all baffles open, 6 systems)',
    general: {
      organization: 'Texas ARNG',
      location: 'Temple, TX',
      shop: 'FMS 30',
      date: '2026-02-12',
      room_length: '', room_width: '', room_height: '', room_design_ach: '',
      notes: 'Maintenance bay overhead exhaust ventilation system with adjustable baffles. Survey performed with all baffles open to verify worst-case capture velocity.',
      design_criteria_text: '501 CFM, 1435 Minimum FPM — Caterpillar C15 15.2L engine, 8" duct diameter.',
      recommendations: 'All six systems met minimum design criteria with baffles open. Re-survey if downstream filters are changed or fan VFD setpoint moves.',
      meter_make: 'TSI', meter_model: 'VelociCalc AVM430-A', meter_serial: 'AVM431234005', meter_cal_date: '2025-03-03',
      surveyed_by: 'Diane Moore — Industrial Hygiene Tech, PIKA International',
      surveyed_date: '2026-02-12',
      reviewed_by: 'Eduardo Artiga, CIH — PIKA International Inc.',
      reviewed_date: '2026-03-19'
    },
    systems: [
      { system:'1', component:'1', shape:'round', dia:'8', width:'', height:'',
        m1:'1559', m2:'1523', m3:'1502', m4:'1572', m5:'1522',
        engine:'Caterpillar C15', vehicle:'M1075A1 PLS, HEMTT A4 Variants', design_cfm:'501' },
      { system:'1', component:'2', shape:'round', dia:'8', width:'', height:'',
        m1:'1786', m2:'1569', m3:'1699', m4:'1586', m5:'1712',
        engine:'Caterpillar C15', vehicle:'M1075A1 PLS, HEMTT A4 Variants', design_cfm:'501' },
      { system:'1', component:'3', shape:'round', dia:'8', width:'', height:'',
        m1:'1422', m2:'1462', m3:'1559', m4:'1486', m5:'1474',
        engine:'Caterpillar C15', vehicle:'M1075A1 PLS, HEMTT A4 Variants', design_cfm:'501' },
      { system:'1', component:'4', shape:'round', dia:'8', width:'', height:'',
        m1:'1422', m2:'1426', m3:'1489', m4:'1490', m5:'1487',
        engine:'Caterpillar C15', vehicle:'M1075A1 PLS, HEMTT A4 Variants', design_cfm:'501' },
      { system:'1', component:'5', shape:'round', dia:'8', width:'', height:'',
        m1:'1419', m2:'1519', m3:'1413', m4:'1483', m5:'1476',
        engine:'Caterpillar C15', vehicle:'M1075A1 PLS, HEMTT A4 Variants', design_cfm:'501' },
      { system:'1', component:'6', shape:'round', dia:'8', width:'', height:'',
        m1:'1435', m2:'1407', m3:'1505', m4:'1445', m5:'1504',
        engine:'Caterpillar C15', vehicle:'M1075A1 PLS, HEMTT A4 Variants', design_cfm:'501' }
    ]
  },

  utes3_battery_room: {
    _label: 'TX UTES 3 — Battery Exhaust (ACH-based, rectangular)',
    general: {
      organization: 'Texas ANG',
      location: 'Bastrop, TX',
      shop: 'UTES 3 — Battery Room',
      date: '2025-10-29',
      room_length: '26.1', room_width: '10.2', room_height: '11.0', room_design_ach: '6',
      notes: 'Battery room accessed via exterior door. Wall-mounted exhaust fan with 8" × 8" intake grille on the opposite wall.',
      design_criteria_text: '6 ACH minimum for hydrogen control in indoor battery charging spaces.',
      recommendations: 'Run the exhaust fan continuously while charging is in progress and for at least 15 minutes after disconnect. Verify the fan starts when room door opens.',
      meter_make: 'TSI', meter_model: 'VelociCalc AVM430-A', meter_serial: '9535A2138010', meter_cal_date: '2025-01-23',
      surveyed_by: 'Melissa Simpson — Industrial Hygienist, PIKA International',
      surveyed_date: '2025-10-29',
      reviewed_by: 'Eduardo Artiga, CIH — PIKA International Inc.',
      reviewed_date: '2025-11-14'
    },
    systems: [
      { system:'1', component:'1', shape:'rect', dia:'', width:'8', height:'8',
        m1:'733', m2:'794', m3:'647', m4:'690', m5:'712',
        engine:'', vehicle:'', design_cfm:'' }
    ]
  },

  fms36_all_inop: {
    _label: 'FMS 36 — Overhead Exhaust (ALL 7 INOPERABLE)',
    general: {
      organization: 'Texas ARNG',
      location: 'Houston, TX',
      shop: 'FMS 36',
      date: '2026-03-05',
      room_length: '', room_width: '', room_height: '', room_design_ach: '',
      notes: 'All seven vehicle exhaust vents were inoperable at the time of this assessment. Work orders had been submitted but not closed.',
      design_criteria_text: '501 CFM is based on the Caterpillar C15 15.2L engine.',
      recommendations: 'Repair work orders open with the shop supervisor for all 7 components. Re-survey after repairs are complete before returning the bay to indoor running operations.',
      meter_make: 'TSI', meter_model: 'AVM430', meter_serial: 'AVM431234008', meter_cal_date: '2025-12-11',
      surveyed_by: 'Jason Scott — Industrial Hygienist, PIKA International',
      surveyed_date: '2026-03-05',
      reviewed_by: 'Cory Treloar — Certified Industrial Hygienist',
      reviewed_date: '2026-04-10'
    },
    systems: [1,2,3,4,5,6,7].map(c => ({
      system:'1', component:String(c), shape:'round', dia:'',
      width:'', height:'',
      m1:'0', m2:'0', m3:'0', m4:'0', m5:'0',
      engine:'Caterpillar C15', vehicle:'M1075A1 PLS, HEMTT A4 Variants', design_cfm:'501'
    }))
  },

  fms11_overhead: {
    _label: 'FMS 11 — Overhead Exhaust (2 systems, 6" duct)',
    general: {
      organization: 'TXANG',
      location: 'Bryan, TX',
      shop: 'FMS 11',
      date: '2026-02-24',
      room_length: '', room_width: '', room_height: '', room_design_ach: '',
      notes: 'Maintenance bay overhead exhaust system with adjustable baffle to control airflow. Each drop-down accommodates a Caterpillar C15 six-cylinder diesel.',
      design_criteria_text: '501 CFM, 2552 Minimum FPM — Caterpillar C15 15.2L engine, 6" duct diameter.',
      recommendations: 'Both systems with one component each did not meet the minimum design criteria. Either re-balance to raise capture velocity or restrict to smaller-engine vehicles whose CFM requirement matches the measured capacity.',
      meter_make: 'TSI', meter_model: 'VelociCalc AVM430-A', meter_serial: '9565X2417011', meter_cal_date: '2025-05-22',
      surveyed_by: 'Diane Moore — Industrial Hygiene Tech, PIKA International',
      surveyed_date: '2026-02-24',
      reviewed_by: 'Eduardo Artiga, CIH — PIKA International Inc.',
      reviewed_date: '2026-03-23'
    },
    systems: [
      { system:'1', component:'1', shape:'round', dia:'6', width:'', height:'',
        m1:'2177', m2:'2245', m3:'2235', m4:'2057', m5:'2029',
        engine:'Caterpillar C15', vehicle:'M1075A1 PLS, HEMTT A4 Variants', design_cfm:'501' },
      { system:'2', component:'1', shape:'round', dia:'6', width:'', height:'',
        m1:'2209', m2:'2249', m3:'2108', m4:'2265', m5:'2114',
        engine:'Caterpillar C15', vehicle:'M1075A1 PLS, HEMTT A4 Variants', design_cfm:'501' }
    ]
  }
};

function loadExample(key){
  const ex = VENT_EXAMPLES[key]; if (!ex) return;
  if (!confirm('Load the "' + ex._label + '" example? Any unsaved changes on the current form will be replaced.')) return;
  currentSurveyId = generateVentId();
  applyPrefill(ex);
  if (window.showToast) showToast('Loaded example: ' + ex._label, 'success');
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

/* ── Table skeleton (transposed) ──────────────────────────────────
   The first column is sticky on the left and carries the field
   labels; each system is a new column on the right. */
function buildSkeleton(){
  const head = el('ventSysHead');
  if (head) head.innerHTML = '<tr><th class="v-rowlabel">Field</th></tr>';
  const body = el('ventSysBody');
  if (body) body.innerHTML = FIELDS.map(f => {
    let extraCls = '';
    if (f.type === 'calc' || f.type === 'status') extraCls = ' v-calcrow';
    return '<tr data-field="'+esc(f.key)+'"'+(extraCls?' class="'+extraCls.trim()+'"':'')+'>'+
      '<th class="v-rowlabel">'+esc(f.label)+'</th>'+
    '</tr>';
  }).join('');
}

function bodyCellHTML(sid, f){
  if (f.type === 'input') {
    const extra = (f.oninput ? ' oninput="'+f.oninput+'('+sid+')"' : '');
    return '<td data-sid="'+sid+'"><input name="sys'+sid+'_'+f.key+'" '+(f.iattr||'')+extra+'></td>';
  }
  if (f.type === 'select') {
    const opts = f.options.map(o => '<option value="'+esc(o.v)+'">'+esc(o.t)+'</option>').join('');
    const ch = f.onchange ? ' onchange="'+f.onchange+'('+sid+')"' : '';
    return '<td data-sid="'+sid+'"><select name="sys'+sid+'_'+f.key+'" style="width:100%"'+ch+'>'+opts+'</select></td>';
  }
  if (f.type === 'select-engine') {
    return '<td data-sid="'+sid+'"><select name="sys'+sid+'_engine" onchange="Vent.onEngineChange('+sid+')" style="width:100%">'+engineOptions()+'</select></td>';
  }
  if (f.type === 'calc') {
    return '<td data-sid="'+sid+'" class="v-calc" id="sys'+sid+'_'+f.key+'">—</td>';
  }
  if (f.type === 'status') {
    return '<td data-sid="'+sid+'" class="v-status" id="sys'+sid+'_status">—</td>';
  }
  return '<td data-sid="'+sid+'"></td>';
}

/* ── System column management ────────────────────────────────── */
function addSystem(seed){
  sysCount++;
  const sid = sysCount;
  systems.push({ sid });
  // Header cell (column heading)
  const headRow = el('ventSysHead').querySelector('tr');
  headRow.insertAdjacentHTML('beforeend',
    '<th class="v-syshead" data-sid="'+sid+'">'+
      '<div class="v-syshead-row">'+
        '<span>System '+sid+'</span>'+
        '<button type="button" class="v-rm" title="Delete this system column" onclick="Vent.deleteSystem('+sid+')">×</button>'+
      '</div>'+
    '</th>');
  // Body cells (one per field row)
  FIELDS.forEach(f => {
    const tr = document.querySelector('#ventSysBody tr[data-field="'+f.key+'"]');
    if (tr) tr.insertAdjacentHTML('beforeend', bodyCellHTML(sid, f));
  });
  // Seed values (from a saved survey row or a duplicate-last call)
  if (seed) {
    Object.keys(seed).forEach(k => {
      const f = fld('sys'+sid+'_'+k);
      if (f) f.value = (seed[k] == null ? '' : seed[k]);
    });
  }
  recomputeSystem(sid);
  return sid;
}
function deleteSystem(sid){
  if (systems.length <= 1) {
    if (window.showToast) showToast('Keep at least one system column', 'warn');
    return;
  }
  systems = systems.filter(s => s.sid !== sid);
  document.querySelectorAll('#ventSysHead [data-sid="'+sid+'"], #ventSysBody [data-sid="'+sid+'"]')
    .forEach(node => node.remove());
  recomputeRoom();
}
function duplicateLastSystem(){
  if (!systems.length) return addSystem();
  const last = systems[systems.length - 1];
  const seed = {};
  FIELDS.forEach(f => {
    if (f.type === 'calc' || f.type === 'status') return;
    const fEl = fld('sys'+last.sid+'_'+f.key);
    if (fEl) seed[f.key] = fEl.value;
  });
  return addSystem(seed);
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
  set('sys'+sid+'_avg_fpm',  avg     != null ? round(avg, 1)     : '—');
  set('sys'+sid+'_area_ft2', area    != null ? round(area, 4)    : '—');
  set('sys'+sid+'_cfm',      cfm     != null ? round(cfm, 1)     : '—');
  set('sys'+sid+'_min_fpm',  minFpm  != null ? round(minFpm, 1)  : '—');

  // PASS / FAIL / INOP
  const stEl = el('sys'+sid+'_status');
  if (!stEl) return;
  if (avg != null && avg === 0) {
    stEl.textContent = 'INOP'; stEl.className = 'v-status v-fail';
  } else if (cfm != null && designCfm != null) {
    const pass = cfm >= designCfm;
    stEl.textContent = pass ? 'PASS' : 'FAIL';
    stEl.className = 'v-status ' + (pass ? 'v-pass' : 'v-fail');
  } else {
    stEl.textContent = '—'; stEl.className = 'v-status';
  }
  // ACH might change when a CFM changes
  recomputeRoom();
}
function recomputeAll(){ systems.forEach(s => recomputeSystem(s.sid)); recomputeRoom(); }

/* ── Room / ACH (battery-room style) ─────────────────────────── */
function recomputeRoom(){
  const L = num((fld('room_length')||{}).value);
  const W = num((fld('room_width')||{}).value);
  const H = num((fld('room_height')||{}).value);
  const vol = (L && W && H) ? L * W * H : null;
  if (el('room_volume')) el('room_volume').textContent = vol != null ? round(vol,1) : '—';
  let totalCfm = 0, haveCfm = false;
  systems.forEach(s => {
    const v = el('sys'+s.sid+'_cfm');
    const n = v ? parseFloat(v.textContent) : NaN;
    if (!isNaN(n)) { totalCfm += n; haveCfm = true; }
  });
  const ach = (haveCfm && vol) ? (totalCfm * 60 / vol) : null;
  if (el('room_total_cfm')) el('room_total_cfm').textContent = haveCfm ? round(totalCfm,1) : '—';
  if (el('room_ach'))       el('room_ach').textContent       = ach != null ? round(ach,2) : '—';
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

/* ── System Diagrams & Photos ─────────────────────────────────
   Pictures of the ventilation system, room layout, exhaust hood,
   etc. Each photo is downscaled to a max 1024-px edge and stored
   as a JPEG data URI inside the survey record so it round-trips
   through save / Sheets sync without depending on Drive uploads. */
function addPhotos(fileList){
  const files = Array.from(fileList || []);
  console.log('[Vent.addPhotos] received', files.length, 'file(s)');
  if (!files.length) {
    if (window.showToast) showToast('No file received from picker — try again', 'warn');
    return;
  }
  let queued = 0;
  files.forEach((f, idx) => {
    console.log('[Vent.addPhotos] file ' + idx, { name: f.name, type: f.type, size: f.size });
    if (!f.type || f.type.indexOf('image/') !== 0) {
      console.warn('[Vent.addPhotos] skipping non-image file', f.type);
      if (window.showToast) showToast('Skipped "' + (f.name || 'file') + '" — not an image', 'warn');
      return;
    }
    const rd = new FileReader();
    rd.onerror = (e) => {
      console.error('[Vent.addPhotos] FileReader error', e);
      if (window.showToast) showToast('Could not read photo file', 'error');
    };
    rd.onload = () => {
      const img = new Image();
      img.onerror = (e) => {
        console.error('[Vent.addPhotos] image decode error', e);
        if (window.showToast) showToast('Could not decode photo — file may be corrupt', 'error');
      };
      img.onload = () => {
        try {
          const MAX = 1024;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else       { w = Math.round(w * MAX / h); h = MAX; }
          }
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          photoCount++;
          photos.push({
            pid: photoCount,
            label: '',
            dataUri: c.toDataURL('image/jpeg', 0.78)
          });
          console.log('[Vent.addPhotos] photo ' + photoCount + ' added (' + w + 'x' + h + ')');
          renderPhotos();
          if (window.showToast) showToast('Photo added', 'success');
        } catch(err) {
          console.error('[Vent.addPhotos] canvas error', err);
          if (window.showToast) showToast('Could not process photo: ' + err.message, 'error');
        }
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
    queued++;
  });
}
function deletePhoto(pid){
  photos = photos.filter(p => p.pid !== pid);
  renderPhotos();
}
function onPhotoLabelInput(pid, value){
  const p = photos.find(x => x.pid === pid);
  if (p) p.label = value;
}
function onPhotoInput(input){
  addPhotos(input.files);
  input.value = ''; // allow re-picking the same file later
}
function renderPhotos(){
  const host = el('ventPhotoGrid'); if (!host) return;
  el('ventPhotoCount').textContent = photos.length + ' photo' + (photos.length !== 1 ? 's' : '');
  if (!photos.length) {
    host.innerHTML = '<div style="padding:20px;text-align:center;color:var(--v-muted);font-size:12px;">No photos yet — tap the button above to add system diagrams, exhaust hood close-ups, room overviews, etc.</div>';
    return;
  }
  host.innerHTML = photos.map(p =>
    '<div class="v-photo" data-pid="'+p.pid+'">'+
      '<img src="'+esc(p.dataUri)+'" alt="ventilation photo">'+
      '<input type="text" placeholder="Caption (e.g. \'System 1 overhead, baffles open\')" value="'+esc(p.label||'')+'" oninput="Vent.onPhotoLabelInput('+p.pid+', this.value)">'+
      '<button type="button" class="v-photo-rm" onclick="Vent.deletePhoto('+p.pid+')" title="Remove">×</button>'+
    '</div>'
  ).join('');
}

/* ── Form collection & persistence ───────────────────────────── */
function collectForm(){
  const g = {};
  document.querySelectorAll('#ventForm [name]').forEach(input => {
    if (input.closest('[data-sid]')) return; // skip per-system inputs
    g[input.name] = input.value;
  });
  const sys = systems.map(s => {
    const row = {};
    FIELDS.forEach(f => {
      if (f.type === 'calc' || f.type === 'status') return;
      const fEl = fld('sys'+s.sid+'_'+f.key);
      row[f.key] = fEl ? fEl.value : '';
    });
    row.avg_fpm  = (el('sys'+s.sid+'_avg_fpm')||{}).textContent || '';
    row.area_ft2 = (el('sys'+s.sid+'_area_ft2')||{}).textContent || '';
    row.cfm      = (el('sys'+s.sid+'_cfm')||{}).textContent || '';
    row.min_fpm  = (el('sys'+s.sid+'_min_fpm')||{}).textContent || '';
    row.status   = (el('sys'+s.sid+'_status')||{}).textContent || '';
    return row;
  });
  return { id: currentSurveyId, general: g, systems: sys, photos: photos.slice() };
}
function applyPrefill(data){
  if (!data) return;
  const g = data.general || {};
  Object.keys(g).forEach(k => { const f = fld(k); if (f) f.value = g[k] || ''; });
  buildSkeleton(); systems = []; sysCount = 0;
  (data.systems || []).forEach(row => addSystem(row));
  if (!systems.length) { addSystem(); addSystem(); }
  // Restore photos (the dataUri is large but round-trips fine in JSON).
  // photoUrl is preserved so re-syncs don't re-upload to Drive.
  photos = (data.photos || []).map((p, i) => ({
    pid: (p && p.pid) || (i + 1),
    label: (p && p.label) || '',
    dataUri: (p && p.dataUri) || '',
    photoUrl: (p && p.photoUrl) || ''
  })).filter(p => p.dataUri || p.photoUrl);
  photoCount = photos.reduce((m, p) => Math.max(m, p.pid), 0);
  renderPhotos();
  recomputeAll();
}
function resetForm(){
  if (!confirm('Clear the form? Unsaved changes will be lost.')) return;
  document.getElementById('ventForm').reset();
  buildSkeleton(); systems = []; sysCount = 0;
  addSystem(); addSystem();
  photos = []; photoCount = 0; renderPhotos();
  currentSurveyId = null;
  recomputeAll();
}
function newSurvey(){
  currentSurveyId = generateVentId();
  document.getElementById('ventForm').reset();
  buildSkeleton(); systems = []; sysCount = 0;
  addSystem(); addSystem();
  photos = []; photoCount = 0; renderPhotos();
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

/* Compute Drive routing from the general info fields: Organization is
   the parent folder, Shop is normalized to a facility folder (e.g.
   "FMS 8" → "FMS8", "AASF 4" → "AASF#4"). */
function computeVentRouting(record){
  const g = (record && record.general) || {};
  const parent = window.IHRouting ? window.IHRouting.normalizeParent(g.organization || '') : (g.organization || '');
  const facility = window.IHRouting ? window.IHRouting.parseFreeFacility(g.shop || '') : (g.shop || '');
  return { parent: parent, facility: facility };
}

/* Upload one diagram/site photo to Drive under
   <IH Projects>/<organization>/<shop>/02_Vents/.

   If Organization is blank but Shop is set, the parent level is skipped
   and the photo lands at <IH Projects>/<shop>/02_Vents/ (the Apps
   Script treats empty parent as "use IH Projects directly"). Only when
   BOTH are blank does the upload bail.

   text/plain Content-Type avoids the CORS preflight Apps Script
   handles poorly. */
function uploadVentPhoto(surveyId, slot, dataUri, routing, caption){
  const url = sheetsUrl();
  if (!url) return Promise.reject(new Error('No Sheets URL configured (Sheets ⚙)'));
  if (!routing || (!routing.parent && !routing.facility)) {
    return Promise.reject(new Error('Organization and Shop both missing — cannot route photo'));
  }
  const fileName = (window.IHRouting && window.IHRouting.photoName)
    ? window.IHRouting.photoName(surveyId, 'photo' + slot, 'jpg', caption)
    : surveyId + '_photo' + slot + '.jpg';
  const body = {
    _type: 'vent_photo',
    surveyId: surveyId,
    fileName: fileName,
    parent: routing.parent || '',
    facility: routing.facility || '',
    subfolder: '02_Vents',
    dataUri: dataUri
  };
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  }).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' from Apps Script');
    return r.text().then(txt => {
      let j; try { j = JSON.parse(txt); }
      catch (e) {
        throw new Error('Apps Script did not return JSON. Got: ' +
          String(txt).slice(0, 120).replace(/\s+/g,' '));
      }
      if (!j || !j.success) throw new Error((j && j.error) || 'Photo upload failed');
      try { console.log('[Vent] photo uploaded:', j); } catch(e){}
      /* Return the full response so callers can surface folder info. */
      return j;
    });
  });
}

/* For every photo entry that has a dataUri but no photoUrl yet, upload
   to Drive and stash the URL onto the record (mutating in place). The
   live module-level `photos` array is also updated when the record
   being saved is the one currently loaded in the form. */
function uploadPendingVentPhotos(record){
  if (!record || !Array.isArray(record.photos)) return Promise.resolve({uploaded:0,failed:0});
  const pending = record.photos
    .map((p, i) => ({ idx: i, p: p }))
    .filter(x => x.p && x.p.dataUri && !x.p.photoUrl);
  if (!pending.length) return Promise.resolve({uploaded:0,failed:0});

  const routing = computeVentRouting(record);
  if (!routing.parent && !routing.facility) {
    /* No Organization AND no Shop — can't route at all. Surface a
       visible warning so the IH knows the photo stayed local instead
       of silently uploading nowhere. */
    if (window.showToast) {
      showToast(pending.length + ' photo' + (pending.length===1?'':'s') +
        ' not uploaded — fill in Organization or Shop and re-save.', 'warn');
    }
    return Promise.resolve({uploaded:0,failed:0,skipped:pending.length});
  }

  let uploaded = 0, failed = 0; const firstErr = [];
  const firstFolder = []; // capture the destination folder for the toast
  const tasks = pending.map(x => {
    /* Caption = the IH-typed label under the photo (onPhotoLabelInput).
       Empty string drops back to the legacy
       <surveyId>_photo<pid>_<stamp>.jpg nomenclature. */
    const caption = (x.p.label || '').toString();
    return uploadVentPhoto(record.id, x.p.pid, x.p.dataUri, routing, caption).then(resp => {
      const url = (resp && resp.url) || resp;          // back-compat with old return shape
      x.p.photoUrl = url; uploaded++;
      if (resp && resp.folder && !firstFolder.length) firstFolder.push(resp);
      /* Mirror onto the live `photos` array if this record is loaded. */
      if (currentSurveyId === record.id) {
        const live = photos.find(q => q.pid === x.p.pid);
        if (live) live.photoUrl = url;
      }
    }).catch(err => {
      failed++;
      const msg = (err && err.message) ? err.message : String(err);
      if (!firstErr.length) firstErr.push(msg);
      try { console.warn('[Vent] photo upload failed for pid ' + x.p.pid, msg); } catch(e){}
    });
  });
  return Promise.all(tasks).then(() => {
    if (uploaded && window.showToast) {
      /* Include the destination folder name so the IH can verify the
         photo actually landed where they expected. If the Apps Script
         response also gave us a folderId, log a Drive URL to console
         for click-through diagnostic. */
      const dest = firstFolder[0];
      const where = (dest && dest.folder) ? ' → "' + dest.folder + '"' : '';
      showToast(uploaded + ' vent photo' + (uploaded===1?'':'s') + ' uploaded to Drive' + where, 'success');
      if (dest && dest.folderId) {
        try { console.log('[Vent] photos landed in folder:', 'https://drive.google.com/drive/folders/' + dest.folderId); } catch(e){}
      }
    }
    if (failed && window.showToast) {
      showToast(failed + ' vent photo upload' + (failed===1?'':'s') + ' failed — ' + (firstErr[0] || 'unknown error') +
        '. Check that the Apps Script was DEPLOYED as a new version (not just saved).', 'error');
    }
    return { uploaded, failed };
  });
}

function pushToSheets(record){
  const url = sheetsUrl();
  if (!url || !navigator.onLine) { queueSync(record); return; }
  /* Upload any new photos first so the Drive URLs land on the record,
     then strip the heavy dataUris from the Sheets payload to keep the
     POST under the Apps Script ~50 KB practical limit. */
  uploadPendingVentPhotos(record).then(() => {
    saveToStorage();   /* persist new photoUrls */
    const slim = JSON.parse(JSON.stringify(record));
    if (Array.isArray(slim.photos)) slim.photos.forEach(p => { delete p.dataUri; });
    const payload = Object.assign({ _type: 'ventilation' }, slim, {
      deviceInfo: navigator.userAgent.substring(0, 80)
    });
    return fetch(url, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
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

/* ── Collapsible sections — same pattern Air Sampling uses on h2
   headers. We use document-level event delegation so the click
   binding works even if initForm() never runs (or runs before the
   form is in the DOM). The chevron is rendered with a CSS ::before
   pseudo-element so no HTML injection is needed. */
function setAllCollapsed(c){
  document.querySelectorAll('#ventAppHost section.v-card').forEach(s => s.classList.toggle('collapsed', !!c));
}
function initCollapsible(){ /* delegation handles it now — kept for API back-compat. */ }
(function bindCollapseDelegation(){
  if (typeof document === 'undefined' || document._ventCollapBound) return;
  document._ventCollapBound = true;
  document.addEventListener('click', function(e){
    const h3 = e.target.closest && e.target.closest('#ventAppHost section.v-card > h3');
    if (!h3) return;
    if (e.target.closest('button,select,input,a,textarea')) return;
    h3.parentElement.classList.toggle('collapsed');
  }, false);
})();

/* ── Print: build the official Ventilation Survey deliverable in
   a hidden DOM root, then toggle a body class that swaps print CSS
   to show only that root and triggers window.print(). Mirrors the
   PIKA / Texas ARNG worksheet:
     - Header: Org / Location / Shop / Date
     - Transposed Systems table (rows = field labels, cols = systems)
     - Room volume + ACH if present
     - Diagrams grid (every photo with its caption)
     - Notes / Design Criteria narrative / Recommendations
     - Velocity meter + Calculations descriptions
     - Surveyed By / Reviewed By signature line */
function buildPrintDOM(){
  const existing = document.getElementById('ventPrintRoot');
  if (existing) existing.remove();

  function v(name){ const f = fld(name); return f && f.value ? esc(f.value) : '&nbsp;'; }

  // --- header
  let html = '<div class="vp-doc">';
  html += '<h1 class="vp-title">VENTILATION SURVEY</h1>';
  html += '<table class="vp"><tr>'+
    '<td class="vp-lbl">Organization</td><td class="vp-val">'+v('organization')+'</td>'+
    '<td class="vp-lbl">Location</td><td class="vp-val">'+v('location')+'</td>'+
    '<td class="vp-lbl">Shop</td><td class="vp-val">'+v('shop')+'</td>'+
    '<td class="vp-lbl">Date Surveyed</td><td class="vp-val">'+v('date')+'</td>'+
  '</tr></table>';

  // --- systems table (transposed, like the source spreadsheet)
  const PRINT_ROWS = [
    { key:'system',     label:'System #' },
    { key:'component',  label:'Component #' },
    { key:'shape',      label:'Duct Shape',     fmt:s => s==='rect'?'Rectangular':'Round' },
    { key:'dia',        label:'Diameter (in)' },
    { key:'width',      label:'L — Length (in)' },
    { key:'height',     label:'W — Width (in)' },
    { key:'m1',         label:'Measurement 1 (FPM)' },
    { key:'m2',         label:'Measurement 2 (FPM)' },
    { key:'m3',         label:'Measurement 3 (FPM)' },
    { key:'m4',         label:'Measurement 4 (FPM)' },
    { key:'m5',         label:'Measurement 5 (FPM)' },
    { key:'avg_fpm',    label:'AVG FPM',         calc:true },
    { key:'area_ft2',   label:'Duct Area (ft²)', calc:true },
    { key:'cfm',        label:'CFM (Q)',         calc:true },
    { key:'engine',     label:'Engine' },
    { key:'vehicle',    label:'Vehicle' },
    { key:'design_cfm', label:'Design CFM' },
    { key:'min_fpm',    label:'Min FPM',         calc:true },
    { key:'status',     label:'Status',          calc:true, status:true }
  ];
  html += '<div class="vp-section">SURVEY DATA</div>';
  html += '<table class="vp-sys"><thead><tr><th class="vp-rowlabel">Field</th>';
  systems.forEach(s => { html += '<th class="vp-syshead">System '+s.sid+'</th>'; });
  html += '</tr></thead><tbody>';
  PRINT_ROWS.forEach(row => {
    html += '<tr>';
    html += '<th class="vp-rowlabel">'+esc(row.label)+'</th>';
    systems.forEach(s => {
      let value;
      if (row.calc) {
        value = (el('sys'+s.sid+'_'+row.key) || {}).textContent || '—';
      } else {
        value = (fld('sys'+s.sid+'_'+row.key) || {}).value || '';
      }
      if (row.fmt) value = row.fmt(value);
      let cls = '';
      if (row.calc) cls = 'vp-calc';
      if (row.status) {
        cls += ' vp-status';
        if (value === 'PASS')      cls += ' vp-pass';
        else if (value === 'FAIL') cls += ' vp-fail';
        else if (value === 'INOP') cls += ' vp-fail';
      }
      html += '<td class="'+cls.trim()+'">'+esc(value || '—')+'</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  // --- room / ACH (if any input filled)
  const rL = (fld('room_length')||{}).value;
  const rW = (fld('room_width')||{}).value;
  const rH = (fld('room_height')||{}).value;
  const rD = (fld('room_design_ach')||{}).value;
  if (rL || rW || rH || rD) {
    html += '<div class="vp-section">ROOM VOLUME &amp; AIR CHANGES / HOUR</div>';
    html += '<table class="vp"><tr>'+
      '<td class="vp-lbl">Room L × W × H (ft)</td>'+
      '<td class="vp-val">'+esc(rL||'—')+' × '+esc(rW||'—')+' × '+esc(rH||'—')+'</td>'+
      '<td class="vp-lbl">Room Volume (ft³)</td>'+
      '<td class="vp-val vp-calc">'+esc((el('room_volume')||{}).textContent || '—')+'</td>'+
      '<td class="vp-lbl">Σ CFM</td>'+
      '<td class="vp-val vp-calc">'+esc((el('room_total_cfm')||{}).textContent || '—')+'</td>'+
      '<td class="vp-lbl">Actual ACH</td>'+
      '<td class="vp-val vp-calc">'+esc((el('room_ach')||{}).textContent || '—')+'</td>'+
      '<td class="vp-lbl">Design ACH</td>'+
      '<td class="vp-val">'+esc(rD||'—')+'</td>'+
    '</tr></table>';
  }

  // --- diagrams
  if (photos.length) {
    html += '<div class="vp-section">DIAGRAMS &amp; PHOTOS</div>';
    html += '<div class="vp-photos">';
    photos.forEach(p => {
      html += '<div class="vp-photo">'+
        '<img src="'+esc(p.dataUri)+'" alt="vent photo">'+
        (p.label ? '<div class="vp-photo-cap">'+esc(p.label)+'</div>' : '')+
      '</div>';
    });
    html += '</div>';
  }

  // --- notes / design criteria / recommendations
  html += '<div class="vp-section">NOTES</div>';
  html += '<div class="vp-text">'+esc((fld('notes')||{}).value || '—').replace(/\n/g,'<br>')+'</div>';
  html += '<div class="vp-section">DESIGN CRITERIA</div>';
  html += '<div class="vp-text">'+esc((fld('design_criteria_text')||{}).value || '—').replace(/\n/g,'<br>')+'</div>';
  html += '<div class="vp-section">RECOMMENDATIONS</div>';
  html += '<div class="vp-text">'+esc((fld('recommendations')||{}).value || '—').replace(/\n/g,'<br>')+'</div>';

  // --- equipment + calc descriptions
  html += '<div class="vp-section">VELOCITY METER</div>';
  html += '<table class="vp"><tr>'+
    '<td class="vp-lbl">Make</td><td class="vp-val">'+v('meter_make')+'</td>'+
    '<td class="vp-lbl">Model</td><td class="vp-val">'+v('meter_model')+'</td>'+
    '<td class="vp-lbl">Serial #</td><td class="vp-val">'+v('meter_serial')+'</td>'+
    '<td class="vp-lbl">Cal Date</td><td class="vp-val">'+v('meter_cal_date')+'</td>'+
  '</tr></table>';

  html += '<div class="vp-section">CALCULATIONS</div>';
  html += '<table class="vp vp-calc-desc">'+
    '<tr><td class="vp-lbl">AVG FPM</td><td class="vp-val">Sum of Measured Duct Velocities / Number of Measured Locations</td></tr>'+
    '<tr><td class="vp-lbl">Duct Area (round)</td><td class="vp-val">A = π · r² (with r and area converted to ft)</td></tr>'+
    '<tr><td class="vp-lbl">Duct Area (rect)</td><td class="vp-val">A = L × W (converted to ft²)</td></tr>'+
    '<tr><td class="vp-lbl">CFM (Q)</td><td class="vp-val">AVG FPM × Duct Area (ft²)</td></tr>'+
    '<tr><td class="vp-lbl">Min FPM</td><td class="vp-val">Design CFM / Duct Area (ft²)</td></tr>'+
    '<tr><td class="vp-lbl">Status</td><td class="vp-val">PASS when CFM ≥ Design CFM · INOP when measurements all zero · FAIL otherwise</td></tr>'+
  '</table>';

  // --- sign-off
  html += '<table class="vp vp-signoff">'+
    '<tr>'+
      '<td class="vp-lbl" style="width:50%">Surveyed by</td>'+
      '<td class="vp-lbl">Reviewed by</td>'+
    '</tr>'+
    '<tr>'+
      '<td class="vp-val">'+v('surveyed_by')+'<div class="vp-date">Date: '+v('surveyed_date')+'</div></td>'+
      '<td class="vp-val">'+v('reviewed_by')+'<div class="vp-date">Date: '+v('reviewed_date')+'</div></td>'+
    '</tr>'+
  '</table>';

  html += '</div>';

  const root = document.createElement('div');
  root.id = 'ventPrintRoot';
  root.innerHTML = html;
  document.body.appendChild(root);
}

function printSurvey(){
  console.log('[Vent.printSurvey] called');
  try {
    if (window.showToast) showToast('Building print preview…', 'success');
    buildPrintDOM();
    console.log('[Vent.printSurvey] DOM built, photos:', photos.length, 'systems:', systems.length);
    document.body.classList.add('print-vent-official');
    let styleEl = document.getElementById('ventPageRule');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'ventPageRule';
      styleEl.textContent = '@page { size: letter landscape; margin: 0.35in; }';
      document.head.appendChild(styleEl);
    }
    const cleanup = () => {
      document.body.classList.remove('print-vent-official');
      const s = document.getElementById('ventPageRule'); if (s) s.remove();
      const d = document.getElementById('ventPrintRoot'); if (d) d.remove();
      window.removeEventListener('afterprint', cleanup);
      console.log('[Vent.printSurvey] cleanup done');
    };
    window.addEventListener('afterprint', cleanup);
    // Give the browser one paint cycle to render the print DOM before
    // window.print() captures it; iOS Safari sometimes prints a blank
    // page without this. Also gives photo <img>s a tick to decode.
    setTimeout(() => {
      console.log('[Vent.printSurvey] calling window.print()');
      try {
        window.print();
        console.log('[Vent.printSurvey] window.print() returned');
      } catch(printErr) {
        console.error('[Vent.printSurvey] window.print() threw', printErr);
        alert('Could not open the print dialog: ' + printErr.message + '\n\nOn iOS PWA mode, try opening the app in Safari instead and use Share → Print.');
        cleanup();
      }
    }, 150);
  } catch(e) {
    console.error('[Vent.printSurvey] failed', e);
    alert('Print failed: ' + e.message);
  }
}

/* ── Init ─────────────────────────────────────────────────────── */
let initialized = false;
function initForm(){
  if (!document.getElementById('ventForm')) return;
  try {
    loadFromStorage();
    if (!systems.length) {
      buildSkeleton();
      addSystem(); addSystem();
    }
    renderSurveyList();
    renderPhotos();
    initCollapsible();
    recomputeAll();
    if (navigator.onLine) setTimeout(flushSyncQueue, 2500);
    initialized = true;
  } catch(e) { console.error('[Vent] init failed', e); }
}

/* ── Velocity meter picker — pull from the shared Equipment Library
   maintained by the noise-side equipment tab. Same pattern Sound Level
   uses to populate make/model/serial/cal date in box 3. ──────────── */
function loadMeterFromLibrary(id){
  if (!id) return;
  const list = (typeof window.getEquipmentList === 'function')
    ? window.getEquipmentList()
    : (window.equipment || []);
  const eq = Array.isArray(list) ? list.find(e => e && e.id === id) : null;
  if (!eq) return;
  const set = (name, value) => { const f = fld(name); if (f) f.value = value == null ? '' : value; };
  set('meter_make',     eq.make);
  set('meter_model',    eq.model);
  set('meter_serial',   eq.serial);
  set('meter_cal_date', eq.lastCal || eq.calDue);
  if (window.showToast) showToast('Velocity meter loaded: ' + (eq.make || '') + ' ' + (eq.model || ''), 'success');
}

/* Merge ventSurveys[] pulled from the Apps Script doGet endpoint into
   the local ventSurveys array. New ids are inserted at the top; existing
   ids are replaced only when the remote updatedAt is newer than what's
   on the device. Mirrors Sound.mergeRemoteSurveys. */
function mergeRemoteSurveys(remote){
  let newCount = 0, updCount = 0;
  (remote || []).forEach(r => {
    const idx = ventSurveys.findIndex(s => s.id === r.id);
    if (idx < 0) { ventSurveys.unshift(r); newCount++; }
    else {
      const lt = new Date(ventSurveys[idx].updatedAt || 0).getTime();
      const rt = new Date(r.updatedAt || 0).getTime();
      if (rt > lt) { ventSurveys[idx] = r; updCount++; }
    }
  });
  if (newCount || updCount) { saveToStorage(); renderSurveyList(); }
  return { newCount, updCount };
}

window.Vent = Object.assign(window.Vent || {}, {
  addSystem, duplicateLastSystem, deleteSystem,
  onEngineChange, recomputeSystem, recomputeRoom, recomputeAll,
  loadMeterFromLibrary, loadExample,
  saveSurvey, loadSurvey, deleteSurvey, newSurvey, resetForm,
  setAllCollapsed,
  onPhotoInput, addPhotos, deletePhoto, onPhotoLabelInput,
  printSurvey,
  flushSyncQueue, mergeRemoteSurveys,
  init: initForm
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ if (!initialized) initForm(); });
} else {
  setTimeout(function(){ if (!initialized) initForm(); }, 0);
}
})();
