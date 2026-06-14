/* IH Field App — Air Sampling module.
   Ported from the standalone airsamplingform.html. All functions live
   under window.Air so the rest of the app doesn't see them. IDs inside
   #airForm follow the air* prefix to avoid colliding with other tabs;
   lookups via fld() are scoped to #airForm. */
(function(){
'use strict';

/* ============================================================
   ARNG shop -> SEG / Process mapping
   ============================================================ */
const SHOP_DATA = {
  "Army Aviation Support Facility (AASF)": {
    segs:["Administrative Operations","Avionics and Electronics Maintenance","Fabrication","Inspection and Test Flight","Maintenance"],
    procs:["Administrative Operations","Warehousing / Storage","Electronics Repair / Soldering","Grinding / Cutting","Blade Repair","Painting / Stenciling","Engine Test","Aircraft Maintenance","ALSE Repair","Flammable / Combustible Storage","Aircraft Refueling"]
  },
  "Combined Support Maintenance Shop (CSMS)": {
    segs:["Administrative Operations","Vehicle Maintenance"],
    procs:["Administrative Operations","Warehousing / Storage","Vehicle Maintenance","Battery / Charging Maintenance","Brake System Repair","Parts Washing","Welding / Grinding / Cutting","Machining","Sanding / Grinding","Painting / Stenciling","Woodworking","Flammable / Combustible Storage","Electronics Repair / Soldering","Weapons Maintenance / Repair","Calibration"]
  },
  "Field Maintenance Shop (FMS)": {
    segs:["Administrative Operations","Vehicle Maintenance"],
    procs:["Administrative Operations","Vehicle Maintenance","Battery Charging","Painting / Stenciling","Brake System Repair","Welding / Grinding / Cutting","Sanding / Grinding","Flammable / Combustible Storage"]
  },
  "Maneuver Area Training Equipment Site (MATES)": {
    segs:["Administrative Operations","Vehicle Maintenance"],
    procs:["Administrative Operations","Vehicle Maintenance","Battery Charging / Storage","Brake System Repair","Abrasive Blasting Booth","Parts Washing","Welding","Sanding / Grinding","Painting / Stenciling","Paint Booth Operations","Woodworking","Flammable / Combustible Storage","Electronics Repair / Soldering","Weapons Maintenance","Warehousing / Storage"]
  },
  "Unit Training Equipment Site (UTES)": {
    segs:["Administrative Operations","Vehicle Maintenance"],
    procs:["Administrative Operations","Vehicle Maintenance","Battery / Charging Maintenance","Painting / Stenciling","Brake System Repair","Sanding / Grinding / Cutting","Flammable / Combustible Storage"]
  },
  "Other / Not Listed": { segs:[], procs:[] }
};

/* ============================================================
   ARNG chemical -> sample type -> analytical method library
   ============================================================ */
const CHEM_DATA = {
  "9-Metal Panel (RRAD)": { cas:"varies", types:{
    "Air – Total":[ {m:"NIOSH 7303 (mod, Elements by ICP)", media:"MCE filter 0.8 µm, 37 mm", fmin:1, fmax:4, vmin:25, vmax:2000, note:"Cd, Cr, Co, Cu, FeOx, Pb, Mn, Ni, ZnOx"} ]}},
  "Welding Fume Metals (multi-metal panel)": { cas:"varies", types:{
    "Air – Total":[
      {m:"NIOSH 7300 (Elements by ICP)", media:"MCE filter 0.8 µm, 37 mm", fmin:1, fmax:4, vmin:200, vmax:2000},
      {m:"OSHA ID-125G (Metals by ICP)", media:"MCE filter 0.8 µm, 37 mm", fmin:2, fmax:2, vmin:8, vmax:960, note:"2 L/min recommended"}
    ]}},
  "Hexavalent Chromium (Cr VI)": { cas:"18540-29-9", types:{
    "Air – Total":[
      {m:"NIOSH 7605 (Ion Chromatography)", media:"PVC filter 5.0 µm, 37 mm", fmin:1, fmax:4, vmin:8, vmax:400},
      {m:"NIOSH 7600 (UV-VIS)", media:"PVC filter 5.0 µm, 37 mm", fmin:1, fmax:4, vmin:8, vmax:400},
      {m:"OSHA ID-215 (IC)", media:"PVC filter 5.0 µm, 37 mm", fmin:2, fmax:2, vmin:8, vmax:960, note:"2 L/min; overnight ship, 6–8 day holding"}
    ],
    "Bulk":[ {m:"NIOSH 7605 / OSHA ID-215 (bulk)", media:"Bulk material container", fmin:null,fmax:null,vmin:null,vmax:null} ]}},
  "Lead (Pb)": { cas:"7439-92-1", types:{
    "Air – Total":[
      {m:"NIOSH 7082 (Flame AAS)", media:"MCE filter 0.8 µm, 37 mm", fmin:1, fmax:4, vmin:200, vmax:1500},
      {m:"NIOSH 7300 (ICP)", media:"MCE filter 0.8 µm, 37 mm", fmin:1, fmax:4, vmin:200, vmax:2000},
      {m:"OSHA ID-121 (Flame AAS)", media:"MCE filter 0.8 µm, 37 mm", fmin:2, fmax:2, vmin:8, vmax:960}
    ],
    "Wipe":[ {m:"ASTM E1792 / OSHA (wipe)", media:"Ghost wipe", fmin:null,fmax:null,vmin:null,vmax:null} ],
    "Bulk":[ {m:"NIOSH 7082 / 7300 (bulk)", media:"Bulk container", fmin:null,fmax:null,vmin:null,vmax:null} ]}},
  "Cadmium (Cd)": { cas:"7440-43-9", types:{
    "Air – Total":[
      {m:"NIOSH 7048 (AAS)", media:"MCE filter 0.8 µm, 37 mm", fmin:1, fmax:3, vmin:25, vmax:1500},
      {m:"NIOSH 7300 (ICP)", media:"MCE filter 0.8 µm, 37 mm", fmin:1, fmax:4, vmin:200, vmax:2000},
      {m:"OSHA ID-189", media:"MCE filter 0.8 µm, 37 mm", fmin:2, fmax:2, vmin:8, vmax:960}
    ]}},
  "Manganese (Mn)": { cas:"7439-96-5", types:{
    "Air – Total":[ {m:"NIOSH 7300 (ICP)", media:"MCE filter 0.8 µm, 37 mm", fmin:1, fmax:4, vmin:200, vmax:2000} ],
    "Air – Respirable":[ {m:"NIOSH 7300 (ICP) + cyclone", media:"MCE filter + respirable cyclone", fmin:1.7, fmax:2.75, vmin:200, vmax:2000, note:"respirable fraction"} ]}},
  "Respirable Crystalline Silica (Quartz / Cristobalite)": { cas:"14808-60-7", types:{
    "Air – Respirable":[
      {m:"NIOSH 7500 (XRD)", media:"PVC 5 µm, 37 mm + cyclone", fmin:1.7, fmax:2.75, vmin:300, vmax:1000, note:"Dorr-Oliver 1.7 / SKC Al 2.5 / GS-3 2.75 L/min"},
      {m:"NIOSH 7602 (IR)", media:"PVC 5 µm, 37 mm + cyclone", fmin:1.7, fmax:2.75, vmin:300, vmax:1000},
      {m:"OSHA ID-142", media:"PVC 5 µm, 37 mm + cyclone", fmin:1.7, fmax:2.75, vmin:300, vmax:1000}
    ],
    "Bulk":[ {m:"NIOSH 7500 / OSHA ID-142 (bulk)", media:"Bulk container", fmin:null,fmax:null,vmin:null,vmax:null} ]}},
  "Particulate Not Otherwise Regulated – Total (PNOR)": { cas:"—", types:{
    "Air – Total":[ {m:"NIOSH 0500 (Gravimetric)", media:"PVC 5 µm, 37 mm (pre-weighed)", fmin:1, fmax:2, vmin:7, vmax:133} ]}},
  "Particulate Not Otherwise Regulated – Respirable (PNOR)": { cas:"—", types:{
    "Air – Respirable":[ {m:"NIOSH 0600 (Gravimetric)", media:"PVC 5 µm, 37 mm + cyclone (pre-weighed)", fmin:1.7, fmax:1.7, vmin:20, vmax:400} ]}},
  "Isocyanates (HDI / CARC paint)": { cas:"822-06-0", types:{
    "Air – Total":[
      {m:"OSHA 42 (HDI/TDI)", media:"1,2-PP–coated glass-fiber filter", fmin:1, fmax:1, vmin:null, vmax:15, note:"1 L/min, 15 L max"},
      {m:"OSHA W4002 (HDI)", media:"1,2-MP–coated glass-fiber filter", fmin:1, fmax:1, vmin:null, vmax:15},
      {m:"NIOSH 5525 (total isocyanates)", media:"1-(2-MP)-coated GFF + glass fiber tube", fmin:1, fmax:1, vmin:15, vmax:15}
    ]}},
  "Solvents / VOCs (toluene, xylene, MEK, MIBK, acetone)": { cas:"varies", types:{
    "Air – Sorbent Tube":[
      {m:"NIOSH 1500/1501 (charcoal tube)", media:"Coconut-shell charcoal tube (SKC 226-01)", fmin:0.01, fmax:0.2, vmin:1, vmax:10, note:"per-analyte max volume varies — see LOQ table"},
      {m:"SGS Galson Universal Solvent GC (lg charcoal)", media:"Large charcoal tube (SKC 226-09)", fmin:0.01, fmax:0.2, vmin:1, vmax:12}
    ],
    "Passive Badge":[
      {m:"SGS Galson Universal Solvent GC (3M OVM)", media:"3M 3500 OVM passive badge", fmin:null, fmax:null, vmin:null, vmax:null, note:"diffusive — record start/stop time only"}
    ],
    "Bulk":[ {m:"GC/MS (bulk)", media:"Bulk container", fmin:null,fmax:null,vmin:null,vmax:null} ]}},
  "Stoddard Solvent / Mineral Spirits": { cas:"8052-41-3", types:{
    "Air – Sorbent Tube":[ {m:"NIOSH 1550 (charcoal tube)", media:"Coconut-shell charcoal tube", fmin:0.01, fmax:0.2, vmin:2, vmax:30} ]}},
  "Oil Mist / Metalworking Fluid": { cas:"—", types:{
    "Air – Total":[
      {m:"NIOSH 5524 (MWF)", media:"PTFE filter 2 µm + XAD-2 backup", fmin:1, fmax:2, vmin:12, vmax:120},
      {m:"NIOSH 0500 (oil mist, gravimetric)", media:"PVC 5 µm, 37 mm", fmin:1, fmax:2, vmin:7, vmax:133}
    ]}},
  "Carbon Monoxide (CO)": { cas:"630-08-0", types:{
    "Direct-Read":[ {m:"Direct-read electrochemical monitor / detector tube", media:"Real-time instrument", fmin:null, fmax:null, vmin:null, vmax:null, note:"no lab media — log instrument readings"} ]}}
};

const ANALYTE_PRESETS = {
  "9-Metal Panel (RRAD)": ["Cadmium","Chromium","Cobalt","Copper","Iron Oxide","Lead","Manganese","Nickel","Zinc Oxide"],
  "Welding Fume Metals (multi-metal panel)": ["Chromium","Manganese","Nickel","Iron Oxide","Copper","Zinc Oxide","Lead","Cobalt","Cadmium"],
  "Solvents / VOCs (toluene, xylene, MEK, MIBK, acetone)": ["Toluene","Xylenes (total)","Ethylbenzene","2-Butanone (MEK)","4-Methyl-2-pentanone (MIBK)","Acetone","n-Heptane","Naphtha"]
};

const OEL_DATA = {
  "Cadmium": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA",val:0.005}, {src:"OSHA",type:"Action Level",val:0.0025}, {src:"ACGIH",type:"TLV TWA",val:0.01}, {src:"NIOSH",type:"REL",val:null,note:"(Ca)"} ]},
  "Chromium": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA",val:1.0}, {src:"ACGIH",type:"TLV TWA",val:0.5}, {src:"NIOSH",type:"REL TWA",val:0.5} ]},
  "Cobalt": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA",val:0.1}, {src:"ACGIH",type:"TLV TWA",val:0.02}, {src:"NIOSH",type:"REL TWA",val:0.05} ]},
  "Copper": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA (dust)",val:1.0}, {src:"OSHA",type:"PEL TWA (fume)",val:0.1}, {src:"ACGIH",type:"TLV TWA (dust)",val:1.0}, {src:"ACGIH",type:"TLV TWA (fume)",val:0.2}, {src:"NIOSH",type:"REL TWA (dust)",val:1.0}, {src:"NIOSH",type:"REL TWA (fume)",val:0.1} ]},
  "Iron Oxide": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA (fume)",val:10.0}, {src:"ACGIH",type:"TLV TWA (resp)",val:5.0}, {src:"NIOSH",type:"REL TWA",val:5.0} ]},
  "Lead": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA",val:0.05}, {src:"OSHA",type:"Action Level",val:0.03}, {src:"ACGIH",type:"TLV TWA",val:0.05}, {src:"NIOSH",type:"REL TWA",val:0.05} ]},
  "Manganese": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL Ceiling",val:5.0}, {src:"ACGIH",type:"TLV TWA (resp)",val:0.02}, {src:"ACGIH",type:"TLV TWA (inhal)",val:0.1}, {src:"NIOSH",type:"REL TWA",val:1.0}, {src:"NIOSH",type:"REL STEL",val:3.0} ]},
  "Nickel": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA",val:1.0}, {src:"ACGIH",type:"TLV TWA (metal,inhal)",val:1.5}, {src:"NIOSH",type:"REL TWA",val:0.015,note:"(Ca)"} ]},
  "Zinc Oxide": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA (fume)",val:5.0}, {src:"OSHA",type:"PEL TWA (total dust)",val:15.0}, {src:"ACGIH",type:"TLV TWA (resp)",val:2.0}, {src:"ACGIH",type:"TLV STEL (resp)",val:10.0}, {src:"NIOSH",type:"REL TWA",val:5.0}, {src:"NIOSH",type:"REL STEL",val:10.0}, {src:"NIOSH",type:"REL Ceiling (dust)",val:15.0} ]},
  "Hexavalent Chromium (Cr VI)": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA",val:0.005}, {src:"OSHA",type:"Action Level",val:0.0025}, {src:"ACGIH",type:"TLV TWA",val:0.0002}, {src:"NIOSH",type:"REL TWA",val:0.0002,note:"(Ca)"} ]},
  "Respirable Crystalline Silica (Quartz / Cristobalite)": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA",val:0.05}, {src:"OSHA",type:"Action Level",val:0.025}, {src:"ACGIH",type:"TLV TWA",val:0.025}, {src:"NIOSH",type:"REL TWA",val:0.05} ]},
  "Particulate Not Otherwise Regulated – Total (PNOR)": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA (total dust)",val:15}, {src:"ACGIH",type:"TLV TWA (inhalable, PNOS)",val:10} ]},
  "Particulate Not Otherwise Regulated – Respirable (PNOR)": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA (respirable)",val:5}, {src:"ACGIH",type:"TLV TWA (respirable, PNOS)",val:3} ]},
  "Carbon Monoxide (CO)": {unit:"ppm", limits:[ {src:"OSHA",type:"PEL TWA",val:50}, {src:"ACGIH",type:"TLV TWA",val:25}, {src:"NIOSH",type:"REL TWA",val:35}, {src:"NIOSH",type:"REL Ceiling",val:200} ]},
  "Toluene": {unit:"ppm", limits:[ {src:"OSHA",type:"PEL TWA",val:200}, {src:"OSHA",type:"PEL Ceiling",val:300}, {src:"ACGIH",type:"TLV TWA",val:20}, {src:"NIOSH",type:"REL TWA",val:100}, {src:"NIOSH",type:"REL STEL",val:150} ]},
  "Xylenes (total)": {unit:"ppm", limits:[ {src:"OSHA",type:"PEL TWA",val:100}, {src:"ACGIH",type:"TLV TWA",val:100}, {src:"ACGIH",type:"TLV STEL",val:150}, {src:"NIOSH",type:"REL TWA",val:100}, {src:"NIOSH",type:"REL STEL",val:150} ]},
  "Ethylbenzene": {unit:"ppm", limits:[ {src:"OSHA",type:"PEL TWA",val:100}, {src:"ACGIH",type:"TLV TWA",val:20}, {src:"NIOSH",type:"REL TWA",val:100}, {src:"NIOSH",type:"REL STEL",val:125} ]},
  "2-Butanone (MEK)": {unit:"ppm", limits:[ {src:"OSHA",type:"PEL TWA",val:200}, {src:"ACGIH",type:"TLV TWA",val:200}, {src:"ACGIH",type:"TLV STEL",val:300}, {src:"NIOSH",type:"REL TWA",val:200}, {src:"NIOSH",type:"REL STEL",val:300} ]},
  "4-Methyl-2-pentanone (MIBK)": {unit:"ppm", limits:[ {src:"OSHA",type:"PEL TWA",val:100}, {src:"ACGIH",type:"TLV TWA",val:20}, {src:"ACGIH",type:"TLV STEL",val:75}, {src:"NIOSH",type:"REL TWA",val:50}, {src:"NIOSH",type:"REL STEL",val:75} ]},
  "Acetone": {unit:"ppm", limits:[ {src:"OSHA",type:"PEL TWA",val:1000}, {src:"ACGIH",type:"TLV TWA",val:250}, {src:"ACGIH",type:"TLV STEL",val:500}, {src:"NIOSH",type:"REL TWA",val:250} ]},
  "n-Heptane": {unit:"ppm", limits:[ {src:"OSHA",type:"PEL TWA",val:500}, {src:"ACGIH",type:"TLV TWA",val:400}, {src:"ACGIH",type:"TLV STEL",val:500}, {src:"NIOSH",type:"REL TWA",val:85}, {src:"NIOSH",type:"REL Ceiling",val:440} ]},
  /* Additional NIOSH 7300 / 7303 panel metals — values from OSHA 29 CFR 1910.1000
     Table Z-1, ACGIH 2024 TLVs, and the NIOSH Pocket Guide. Verify before use. */
  "Aluminum": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA (total dust)",val:15}, {src:"OSHA",type:"PEL TWA (respirable)",val:5}, {src:"ACGIH",type:"TLV TWA (respirable)",val:1}, {src:"NIOSH",type:"REL TWA (total)",val:10}, {src:"NIOSH",type:"REL TWA (respirable)",val:5} ]},
  "Antimony": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA",val:0.5}, {src:"ACGIH",type:"TLV TWA",val:0.5}, {src:"NIOSH",type:"REL TWA",val:0.5} ]},
  "Arsenic": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA",val:0.010}, {src:"OSHA",type:"Action Level",val:0.005}, {src:"ACGIH",type:"TLV TWA",val:0.01,note:"(A1)"}, {src:"NIOSH",type:"REL Ceiling",val:0.002,note:"(Ca, 15-min)"} ]},
  "Beryllium": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA",val:0.0002}, {src:"OSHA",type:"Action Level",val:0.0001}, {src:"ACGIH",type:"TLV TWA (inhalable)",val:0.00005,note:"(A1)"}, {src:"NIOSH",type:"REL Ceiling",val:0.0005,note:"(Ca)"} ]},
  "Magnesium": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA (MgO fume)",val:15}, {src:"ACGIH",type:"TLV TWA (inhalable)",val:10} ]},
  "Molybdenum": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA (insoluble)",val:15}, {src:"OSHA",type:"PEL TWA (soluble)",val:5}, {src:"ACGIH",type:"TLV TWA (inhalable)",val:10}, {src:"ACGIH",type:"TLV TWA (respirable)",val:3}, {src:"ACGIH",type:"TLV TWA (soluble, respirable)",val:0.5} ]},
  "Titanium": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL TWA (TiO2, total)",val:15}, {src:"ACGIH",type:"TLV TWA (TiO2)",val:10,note:"(A4)"}, {src:"NIOSH",type:"REL TWA (TiO2, fine)",val:1.5,note:"(Ca)"}, {src:"NIOSH",type:"REL TWA (TiO2, ultrafine)",val:0.3,note:"(Ca)"} ]},
  "Vanadium": {unit:"mg/m³", limits:[ {src:"OSHA",type:"PEL Ceiling (V2O5 dust)",val:0.5}, {src:"OSHA",type:"PEL Ceiling (V2O5 fume)",val:0.1}, {src:"ACGIH",type:"TLV TWA (respirable)",val:0.05}, {src:"NIOSH",type:"REL Ceiling",val:0.05,note:"(15-min)"} ]}
};

/* COC client address book (editable). */
const COC_CLIENTS = {
  reportTo: [
    { label:"Fitzroy Environmental Consulting — Fitzroy A. Smith, MBA",
      addr:"FITZROY A. SMITH, MBA\nFitzroy Environmental Consulting, Inc.\nEnvironmental Consultant\nPhone: (202) 271-7753\nE-mail: info@fitzroyec.com",
      phone:"2819484143", cell:"", email:"eduardo@tigaconsultants.com" },
    { label:"PIKA International, Inc. — ATTN: Diane Moore",
      addr:"PIKA International, Inc.\nATTN: Diane Moore\n12723 Capricorn Dr. Suite 500\nStafford, TX 77477",
      phone:"281-340-5525, Main", cell:"281-948-4143, Eduardo Artiga", email:"dmoore@pikainc.com", acct:"37121" },
    { label:"PIKA International, Inc. — ATTN: Jason Scott",
      addr:"PIKA International, Inc.\nATTN: Jason Scott\n12723 Capricorn Dr. #500\nStafford, TX 77477",
      phone:"281-340-5525, Main", cell:"937-470-6554, Jason Scott", email:"jscott@pikainc.com", acct:"37121" }
  ],
  invoiceTo: [
    { label:"PIKA International, Inc. (Stafford, TX)",
      addr:"PIKA International, Inc.\n12723 Capricorn Dr. Suite 500\nStafford, TX 77477" },
    { label:"National Guard Bureau (College Park, GA)",
      addr:"National Guard Bureau\n510 Plaza Drive, Suite 1530\nCollege Park, GA 30349" }
  ],
  accounts: ["37121"]
};

/* ---------- shared helpers ---------- */
const num = v => { const x=parseFloat(v); return isNaN(x)?null:x; };
const el  = id => document.getElementById(id);
const fld = name => document.querySelector('#airForm [name="'+name+'"]');
const round = (x,d=2)=>{ const f=Math.pow(10,d); return Math.round(x*f)/f; };
const esc = s => String(s).replace(/"/g,'&quot;');
const opt = (v,label)=>'<option value="'+esc(v)+'">'+(label!==undefined?label:v)+'</option>';
function rangeTxt(a,b,unit){
  if(a==null&&b==null) return 'n/a';
  if(a==null) return '≤ '+b+' '+unit;
  if(b==null) return '≥ '+a+' '+unit;
  return a===b ? (a+' '+unit) : (a+'–'+b+' '+unit);
}

/* ---------- Shop -> SEG / Process dropdowns ---------- */
function populateShopSelect(){
  const sel=el('airShopSelect'); if(!sel) return;
  /* Keep the placeholder first option that's already in the markup. */
  Object.keys(SHOP_DATA).forEach(n=>{
    if(Array.from(sel.options).some(o=>o.value===n)) return;
    sel.appendChild(Object.assign(document.createElement('option'),{value:n,textContent:n}));
  });
}
function currentShop(){ return (el('airShopSelect')||{}).value||''; }
function uniqueAll(key){ const s=new Set(); Object.values(SHOP_DATA).forEach(d=>d[key].forEach(x=>s.add(x))); return Array.from(s); }
function segListForShop(){ const d=SHOP_DATA[currentShop()]; return (d&&d.segs.length)?d.segs:uniqueAll('segs'); }
function procListForShop(){ const d=SHOP_DATA[currentShop()]; return (d&&d.procs.length)?d.procs:uniqueAll('procs'); }
function fillSelect(sel, items){
  if(!sel) return; const cur=sel.value;
  sel.innerHTML = '<option value="">— select —</option>' + items.map(v=>opt(v)).join('') + opt('Other / Not listed');
  if(cur && (items.indexOf(cur)>=0 || cur==='Other / Not listed')) sel.value=cur;
}
function fillSegSelect(){ fillSelect(el('airSegSelect'), segListForShop()); }
function fillProcessSelects(){
  document.querySelectorAll('#airForm .procSel').forEach(s=>fillSelect(s, procListForShop()));
}
function onShopChange(){ fillSegSelect(); fillProcessSelects(); }

/* ============================================================
   SAMPLE / BLANK panels (tabbed)
   ============================================================ */
let sIdx=0, bIdx=0, units=[], activeUid=null;
function chemOptions(){ return opt('','— select chemical —')+Object.keys(CHEM_DATA).map(c=>opt(c)).join(''); }

function samplePanel(i){
  const ck=(grp,opts)=>opts.map(o=>'<label><input type="radio" name="samp'+i+'_'+grp+'" value="'+o+'">'+o+'</label>').join('');
  return ''+
  '<div class="upanel" data-uid="sample'+i+'">'+
    '<fieldset><legend>Identification</legend>'+
      '<div class="grid c4">'+
        '<label><span class="lbl">Field Sample ID</span><input name="samp'+i+'_field_id"></label>'+
        '<label><span class="lbl">IMS (Information Management System) ID</span><input name="samp'+i+'_doehrs_id"></label>'+
        '<label><span class="lbl">Lab Sample ID</span><input name="samp'+i+'_lab_id"></label>'+
        '<label><span class="lbl">Task ID (IMS)</span><input name="samp'+i+'_task_id"></label>'+
      '</div>'+
    '</fieldset>'+

    '<fieldset><legend>Personnel &amp; Work Conditions</legend>'+
      '<div class="grid c4">'+
        '<label class="span2"><span class="lbl">Last Name, First Name</span><input name="samp'+i+'_emp_name"></label>'+
        '<label><span class="lbl">Last 4 / EDIPN</span><input name="samp'+i+'_emp_id"></label>'+
        '<label><span class="lbl">Job Title</span><input name="samp'+i+'_job_title"></label>'+
        '<label><span class="lbl">Length of Work Shift (hrs)</span><input type="number" step="any" name="samp'+i+'_shift_hrs"></label>'+
        '<label><span class="lbl">Exposure Origin</span>'+
          '<select name="samp'+i+'_exp_origin"><option value=""></option><option>Ambient Conditions</option><option>Operator Position</option></select></label>'+
        '<label class="span2"><span class="lbl">Process / Task</span><select name="samp'+i+'_process" class="procSel"><option value="">— select shop first —</option></select></label>'+
        '<label class="span4"><span class="lbl">Job / Task Description During Sampling</span><textarea name="samp'+i+'_task_desc"></textarea></label>'+
        '<label class="span2"><span class="lbl">Associated Materials (solvents, etc.)</span><input name="samp'+i+'_materials"></label>'+
        '<label class="span2"><span class="lbl">Activity Monitored (descriptions, tasks, timelines)</span><input name="samp'+i+'_activity"></label>'+
      '</div>'+
    '</fieldset>'+

    '<fieldset><legend>Controls</legend>'+
      '<div class="grid c3">'+
        '<label><span class="lbl">PPE</span><input name="samp'+i+'_ppe" placeholder="incl. NIOSH TC # e.g. TC-84A-XXXX"></label>'+
        '<label><span class="lbl">Engineering</span><input name="samp'+i+'_engineering"></label>'+
        '<label><span class="lbl">Administrative</span><input name="samp'+i+'_administrative"></label>'+
        '<label><span class="lbl">Respirator Worn</span><input name="samp'+i+'_respirator"></label>'+
        '<label class="span2"><span class="lbl">PPE Worn (other)</span><input name="samp'+i+'_ppe_worn"></label>'+
      '</div>'+
    '</fieldset>'+

    '<fieldset><legend>Equipment <span style="font-weight:400;text-transform:none">— pick from the Equipment library to auto-fill the fields below.</span></legend>'+
      '<div class="grid c2" style="margin-bottom:10px">'+
        '<label><span class="lbl">Pump (from library)</span>'+
          '<select id="airSampPumpPick'+i+'" onchange="Air.onAirPumpPick('+i+')"><option value="">— pick pump —</option></select></label>'+
        '<label><span class="lbl">Calibrator (from library)</span>'+
          '<select id="airSampCalPick'+i+'" onchange="Air.onAirCalPick('+i+')"><option value="">— pick calibrator —</option></select></label>'+
      '</div>'+
      '<div class="grid c4">'+
        '<label><span class="lbl">Pump Mfg</span><input name="samp'+i+'_pump_mfg"></label>'+
        '<label><span class="lbl">Pump Model</span><input name="samp'+i+'_pump_model"></label>'+
        '<label><span class="lbl">Pump Serial #</span><input name="samp'+i+'_pump_serial"></label>'+
        '<label><span class="lbl">Pump Asset / Tag #</span><input name="samp'+i+'_pump_num"></label>'+
        '<label><span class="lbl">Calibrator Mfg / Model</span><input name="samp'+i+'_cal_model"></label>'+
        '<label><span class="lbl">Calibrator Serial #</span><input name="samp'+i+'_cal_serial"></label>'+
        '<label><span class="lbl">Calibrator Mfg Cal Date</span><input type="date" name="samp'+i+'_cal_mfg_date"></label>'+
        '<label><span class="lbl">Calibration Due Date</span><input type="date" name="samp'+i+'_cal_due"></label>'+
      '</div>'+
    '</fieldset>'+

    '<fieldset><legend>Analyte &amp; Method (SGS Galson)</legend>'+
      '<div class="grid c4">'+
        '<label class="span2"><span class="lbl">Chemical / Hazard</span>'+
          '<select name="samp'+i+'_chem" onchange="Air.onChem('+i+')">'+chemOptions()+'</select></label>'+
        '<label><span class="lbl">CAS #</span><input name="samp'+i+'_cas" readonly></label>'+
        '<label><span class="lbl">Sample Type</span>'+
          '<select name="samp'+i+'_type" onchange="Air.onType('+i+')"><option value="">—</option></select></label>'+
        '<label class="span2"><span class="lbl">Analytical Method</span>'+
          '<select name="samp'+i+'_method" onchange="Air.onMethod('+i+')"><option value="">—</option></select></label>'+
        '<label class="span2"><span class="lbl">Sample Media</span><input name="samp'+i+'_media" readonly></label>'+
        '<label class="span2"><span class="lbl">Method Note</span><input name="samp'+i+'_methodNote" readonly></label>'+
        '<label class="span2"><span class="lbl">Analytes for this method <em style="font-weight:400">(select one or more)</em></span><select multiple name="samp'+i+'_analytes" id="airAnalyteSel'+i+'" size="5" onchange="Air.onAnalyteSelect('+i+')"></select></label>'+
        '<label><span class="lbl">Media Lot #</span><input name="samp'+i+'_media_lot"></label>'+
        '<label><span class="lbl">Media Expiration</span><input type="date" name="samp'+i+'_media_exp"></label>'+
      '</div>'+
      '<div class="grid c2" style="margin-top:10px">'+
        '<label><span class="lbl">Inspirability</span><div class="checkrow">'+ck('inspirability',['Total','Respirable','Inhalable','Thoracic','NA'])+'</div></label>'+
        '<label><span class="lbl">Sample Media Position</span><div class="checkrow">'+ck('position',['Right Shoulder','Collar','Left Shoulder','Area','Other'])+'</div></label>'+
      '</div>'+
    '</fieldset>'+

    '<fieldset><legend>Minimum Sample Volume &amp; Time <span style="font-weight:400;text-transform:none">— per analyte: Min Vol (L) = LOD(µg) / (OEL × Fraction)&nbsp;|&nbsp;Req Time = Vol / Flow. OEL &amp; flow pre-fill from the method/OEL library.</span></legend>'+
      '<table class="cons mvtable"><thead><tr>'+
        '<th>Analyte</th>'+
        '<th>LOD (µg)</th>'+
        '<th>OEL</th>'+
        '<th>Desired Fraction</th>'+
        '<th>Rec. Flow (L/min)</th>'+
        '<th>Rec. Vol (L)</th>'+
        '<th>Planned Flow (L/min)</th>'+
        '<th>Min Vol (L)</th>'+
        '<th>Req Time (min)</th>'+
      '</tr></thead><tbody id="airMvBody'+i+'"></tbody></table>'+
      '<div style="margin-top:8px"><button type="button" onclick="Air.addMvRow('+i+')">+ Add analyte</button></div>'+
    '</fieldset>'+

    '<fieldset><legend>Pre- &amp; Post-Calibration <span style="font-weight:400;text-transform:none">— invalid if difference &gt; 5%</span></legend>'+
      '<div class="grid c4">'+
        '<label><span class="lbl">Pre-Cal Date</span><input type="date" name="samp'+i+'_precal_date"></label>'+
        '<label><span class="lbl">Pre-Cal Time</span><input type="time" name="samp'+i+'_precal_time"></label>'+
        '<label><span class="lbl">Pre-Cal Flow Rate (Lpm)</span><input type="number" step="any" name="samp'+i+'_precal_flow" oninput="Air.calcCal('+i+')"></label>'+
        '<label><span class="lbl">Cal Status</span><div style="display:flex;align-items:center;height:34px"><span class="pill idle" id="airSampCalStatus'+i+'">awaiting flows</span></div></label>'+
        '<label><span class="lbl">Post-Cal Date</span><input type="date" name="samp'+i+'_postcal_date"></label>'+
        '<label><span class="lbl">Post-Cal Time</span><input type="time" name="samp'+i+'_postcal_time"></label>'+
        '<label><span class="lbl">Post-Cal Flow Rate (Lpm)</span><input type="number" step="any" name="samp'+i+'_postcal_flow" oninput="Air.calcCal('+i+')"></label>'+
        '<label><span class="lbl">Pre/Post Difference</span><input readonly name="samp'+i+'_cal_diff" id="airSampCalDiff'+i+'"></label>'+
      '</div>'+
    '</fieldset>'+

    '<fieldset><legend>Sample Collection &amp; Single-Sample TWA <span style="font-weight:400;text-transform:none">— 8-hr TWA = Result × Duration / 480</span></legend>'+
      '<div class="grid c4">'+
        '<label><span class="lbl">Start Date</span><input type="date" name="samp'+i+'_start_date"></label>'+
        '<label><span class="lbl">Start Time</span><input type="time" name="samp'+i+'_start_time" oninput="Air.calcSample('+i+')"></label>'+
        '<label><span class="lbl">Stop Date</span><input type="date" name="samp'+i+'_stop_date"></label>'+
        '<label><span class="lbl">Stop Time</span><input type="time" name="samp'+i+'_stop_time" oninput="Air.calcSample('+i+')"></label>'+
        '<label><span class="lbl">Total Downtime (min)</span><input type="number" step="any" name="samp'+i+'_downtime" value="0" oninput="Air.calcSample('+i+')"></label>'+
        '<label><span class="lbl">Total Sampling Time (min)</span><input readonly name="samp'+i+'_duration" id="airSampDuration'+i+'"></label>'+
        '<label><span class="lbl">Flow Rate (Lpm)</span><input type="number" step="any" name="samp'+i+'_flow" oninput="Air.calcSample('+i+')"></label>'+
        '<label><span class="lbl">Total Volume (L)</span><input readonly name="samp'+i+'_volume" id="airSampVolume'+i+'"></label>'+
      '</div>'+
    '</fieldset>'+

    '<fieldset><legend>Gravimetric Analysis <span style="font-weight:400;text-transform:none">— in-house filter analysis only</span></legend>'+
      '<div class="grid c3">'+
        '<label><span class="lbl">Pre-Sampled Weight (g)</span><input type="number" step="any" name="samp'+i+'_grav_pre" oninput="Air.calcGrav('+i+')"></label>'+
        '<label><span class="lbl">Post-Sampled Weight (g)</span><input type="number" step="any" name="samp'+i+'_grav_post" oninput="Air.calcGrav('+i+')"></label>'+
        '<label><span class="lbl">Net Sampled Weight (g)</span><input readonly name="samp'+i+'_grav_net" id="airSampGravNet'+i+'"></label>'+
      '</div>'+
    '</fieldset>'+

    '<fieldset><legend>Measurement Results <span style="font-weight:400;text-transform:none">— one row per analyte. Enter lab MDL/LOD &amp; measured result (use &lt; for non-detect, e.g. &lt;0.002). OEL, 8-hr TWA &amp; % of OEL are computed in the TWA Calculator section below.</span></legend>'+
      '<table class="cons fit"><thead><tr><th>Analyte</th><th>MDL / LOD</th><th>Measured Result</th><th>Units</th><th>Corrected</th></tr></thead><tbody id="airResBody'+i+'"></tbody></table>'+
      '<div style="margin-top:8px"><button type="button" onclick="Air.addAnalyte('+i+')">+ Add analyte</button></div>'+
    '</fieldset>'+

    '<fieldset><legend>Ambient Conditions</legend>'+
      '<div class="grid c4">'+
        '<label><span class="lbl">Baro. Pressure Start (in Hg)</span><input type="number" step="any" name="samp'+i+'_baro_start"></label>'+
        '<label><span class="lbl">Baro. Pressure End (in Hg)</span><input type="number" step="any" name="samp'+i+'_baro_end"></label>'+
        '<label><span class="lbl">Temp Start (°F)</span><input type="number" step="any" name="samp'+i+'_temp_start"></label>'+
        '<label><span class="lbl">Temp End (°F)</span><input type="number" step="any" name="samp'+i+'_temp_end"></label>'+
        '<label><span class="lbl">Relative Humidity (%)</span><input type="number" step="any" name="samp'+i+'_rh"></label>'+
        '<label><span class="lbl">Wind Speed (mph)</span><input type="number" step="any" name="samp'+i+'_wind_speed"></label>'+
        '<label><span class="lbl">Wind Direction</span>'+
          '<select name="samp'+i+'_wind_dir"><option value=""></option><option>N</option><option>NE</option><option>E</option><option>SE</option><option>S</option><option>SW</option><option>W</option><option>NW</option></select></label>'+
      '</div>'+
    '</fieldset>'+
  '</div>';
}

function blankPanel(i){
  return ''+
  '<div class="upanel" data-uid="blank'+i+'">'+
    '<fieldset><legend>Sample Blank</legend>'+
      '<div class="grid c4">'+
        '<label><span class="lbl">Blank Category</span>'+
          '<select name="blank'+i+'_category"><option value=""></option><option>Field Blank</option><option>Lab / Media Blank</option></select></label>'+
        '<label><span class="lbl">Field / Lab Sample ID</span><input name="blank'+i+'_id"></label>'+
        '<label class="span2"><span class="lbl">Chemical / Hazard</span>'+
          '<select name="blank'+i+'_chem" onchange="Air.onBlankChem('+i+')">'+chemOptions()+'</select></label>'+
        '<label class="span2"><span class="lbl">Analytical Method</span>'+
          '<select name="blank'+i+'_method" onchange="Air.onBlankMethod('+i+')"><option value="">—</option></select></label>'+
        '<label class="span2"><span class="lbl">Sample Media</span><input name="blank'+i+'_media" readonly></label>'+
        '<label><span class="lbl">Media Lot #</span><input name="blank'+i+'_media_lot"></label>'+
        '<label><span class="lbl">Media Expiration</span><input type="date" name="blank'+i+'_media_exp"></label>'+
        '<label class="span4"><span class="lbl">Comments</span><input name="blank'+i+'_comments"></label>'+
      '</div>'+
    '</fieldset>'+
  '</div>';
}

/* ---------- tab management ---------- */
function renderTabs(){
  const bar=el('airTabBar'); if(!bar) return;
  bar.innerHTML='';
  let sN=0,bN=0;
  units.forEach(u=>{
    const isS=u.kind==='sample'; if(isS) sN++; else bN++;
    const label=isS?('Sample '+sN):('Blank '+bN);
    const t=document.createElement('button');
    t.type='button';
    t.className='tab'+(isS?'':' blanktab')+(u.uid===activeUid?' active':'');
    t.innerHTML=esc(label)+' <span class="x" title="remove">&times;</span>';
    t.addEventListener('click',function(e){
      if(e.target.classList.contains('x')) removeUnit(u.uid); else showTab(u.uid);
    });
    bar.appendChild(t);
  });
  const aS=document.createElement('button');
  aS.type='button'; aS.className='addtab'; aS.textContent='＋ Add Sample'; aS.addEventListener('click',addSample);
  const aB=document.createElement('button');
  aB.type='button'; aB.className='addtab blank'; aB.textContent='＋ Add Blank'; aB.addEventListener('click',addBlank);
  bar.appendChild(aS); bar.appendChild(aB);
}
function showTab(uid){
  activeUid=uid;
  document.querySelectorAll('#airPanelHost .upanel').forEach(p=>p.classList.toggle('active', p.dataset.uid===uid));
  renderTabs();
}
function addSample(){
  sIdx++; const uid='sample'+sIdx;
  el('airPanelHost').insertAdjacentHTML('beforeend', samplePanel(sIdx));
  units.push({uid:uid, kind:'sample', idx:sIdx});
  fillSelect(document.querySelector('#airForm [name="samp'+sIdx+'_process"]'), procListForShop());
  populateEquipPickersForSample(sIdx);
  aCount[sIdx]=0; addAnalyte(sIdx);
  showTab(uid); refreshTWA();
}

/* ---------- Equipment library pickers ---------- */
function airEquipLib(){
  /* index.html declares `let equipment = []` at script-top-level, which is
     NOT attached to window in modern browsers (let/const skip the global
     object). So we read the same JSON the noise app persists to localStorage
     under EQUIP_KEY — guaranteed fresh because checkInItem / saveEquipment
     both call saveEquipmentToStorage() before refreshEquipPickers runs. */
  try {
    const raw = localStorage.getItem('ih_noise_equipment_v1');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch(e) { return []; }
}
function populateEquipPickersForSample(i){
  const lib = airEquipLib();
  const pumps = lib.filter(e => e.type === 'air_pump');
  const cals  = lib.filter(e => e.type === 'air_calibrator');
  const pumpSel = el('airSampPumpPick'+i);
  const calSel  = el('airSampCalPick'+i);
  if (pumpSel) {
    const cur = pumpSel.value;
    pumpSel.innerHTML = '<option value="">— pick pump —</option>' +
      pumps.map(p => '<option value="'+esc(p.id)+'">'+esc(p.make+' '+p.model+' — S/N '+p.serial)+'</option>').join('');
    if (cur && pumps.some(p => p.id === cur)) pumpSel.value = cur;
  }
  if (calSel) {
    const cur = calSel.value;
    calSel.innerHTML = '<option value="">— pick calibrator —</option>' +
      cals.map(c => '<option value="'+esc(c.id)+'">'+esc(c.make+' '+c.model+' — S/N '+c.serial)+'</option>').join('');
    if (cur && cals.some(c => c.id === cur)) calSel.value = cur;
  }
}
function refreshEquipPickers(){
  /* Called by renderEquipmentLists() in index.html whenever the equipment
     library changes, so freshly-checked-in pumps/calibrators show up in the
     sample-tab dropdowns without a page reload. */
  units.filter(u => u.kind === 'sample').forEach(u => populateEquipPickersForSample(u.idx));
}
function onAirPumpPick(i){
  const id = el('airSampPumpPick'+i).value; if (!id) return;
  const eq = airEquipLib().find(e => e.id === id); if (!eq) return;
  setVal('samp'+i+'_pump_mfg',    eq.make   || '');
  setVal('samp'+i+'_pump_model',  eq.model  || '');
  setVal('samp'+i+'_pump_serial', eq.serial || '');
  setVal('samp'+i+'_pump_num',    eq.asset  || '');
}
function onAirCalPick(i){
  const id = el('airSampCalPick'+i).value; if (!id) return;
  const eq = airEquipLib().find(e => e.id === id); if (!eq) return;
  /* Combine make + model into the single "Calibrator Mfg / Model" field. */
  setVal('samp'+i+'_cal_model',    ((eq.make||'') + ' ' + (eq.model||'')).trim());
  setVal('samp'+i+'_cal_serial',   eq.serial || '');
  setVal('samp'+i+'_cal_mfg_date', eq.factoryCal || '');
  setVal('samp'+i+'_cal_due',      eq.calDue || '');
}
function addBlank(){
  bIdx++; const uid='blank'+bIdx;
  el('airPanelHost').insertAdjacentHTML('beforeend', blankPanel(bIdx));
  units.push({uid:uid, kind:'blank', idx:bIdx});
  showTab(uid);
}
function removeUnit(uid){
  const u=units.find(x=>x.uid===uid); if(!u) return;
  if(units.filter(x=>x.kind===u.kind).length<=1){ alert('At least one '+u.kind+' is required.'); return; }
  const p=document.querySelector('#airPanelHost .upanel[data-uid="'+uid+'"]'); if(p) p.remove();
  units=units.filter(x=>x.uid!==uid);
  if(activeUid===uid) activeUid=units.length?units[0].uid:null;
  showTab(activeUid); refreshTWA();
}

/* ---------- chemical cascade (samples) ---------- */
function onChem(i){
  const chem=fld('samp'+i+'_chem').value, data=CHEM_DATA[chem];
  fld('samp'+i+'_cas').value = data?data.cas:'';
  const tSel=fld('samp'+i+'_type');
  tSel.innerHTML = '<option value="">—</option>' + (data?Object.keys(data.types).map(t=>opt(t)).join(''):'');
  fld('samp'+i+'_method').innerHTML='<option value="">—</option>';
  ['media','methodNote'].forEach(f=>fld('samp'+i+'_'+f).value='');
  if(data && Object.keys(data.types).length===1){ tSel.value=Object.keys(data.types)[0]; onType(i); }
  populateAnalyteSelect(i, chem);
  refreshTWA();
}
function onType(i){
  const chem=fld('samp'+i+'_chem').value, type=fld('samp'+i+'_type').value;
  const list=(CHEM_DATA[chem]&&CHEM_DATA[chem].types[type])||[];
  const mSel=fld('samp'+i+'_method');
  mSel.innerHTML='<option value="">—</option>'+list.map(o=>opt(o.m)).join('');
  ['media','methodNote'].forEach(f=>fld('samp'+i+'_'+f).value='');
  if(list.length===1){ mSel.value=list[0].m; onMethod(i); }
}
function methodObj(chem,type,mname){
  const list=(CHEM_DATA[chem]&&CHEM_DATA[chem].types[type])||[];
  return list.find(o=>o.m===mname)||null;
}
function onMethod(i){
  const o=methodObj(fld('samp'+i+'_chem').value, fld('samp'+i+'_type').value, fld('samp'+i+'_method').value);
  fld('samp'+i+'_media').value      = o?o.media:'';
  fld('samp'+i+'_methodNote').value = (o&&o.note)?o.note:'';
  if(o && o.fmin!=null){
    const colFlow=fld('samp'+i+'_flow');
    if(colFlow) colFlow.placeholder=rangeTxt(o.fmin,o.fmax,'L/min');
    updateMvFlows(i);
  }
  refreshMvRecommended(i);
  calcMvAll(i);
}

/* ---------- chemical cascade (blanks) ---------- */
function blankMethods(chem){
  const t=(CHEM_DATA[chem]&&CHEM_DATA[chem].types)||{};
  const out=[]; Object.values(t).forEach(arr=>arr.forEach(o=>out.push(o))); return out;
}
function onBlankChem(i){
  const list=blankMethods(fld('blank'+i+'_chem').value);
  fld('blank'+i+'_method').innerHTML='<option value="">—</option>'+list.map(o=>opt(o.m)).join('');
  fld('blank'+i+'_media').value='';
  if(list.length===1){ fld('blank'+i+'_method').value=list[0].m; onBlankMethod(i); }
}
function onBlankMethod(i){
  const list=blankMethods(fld('blank'+i+'_chem').value);
  const o=list.find(x=>x.m===fld('blank'+i+'_method').value);
  fld('blank'+i+'_media').value=o?o.media:'';
}

/* ---------- per-sample: minimum volume & time ---------- */
let mvCount={};
function mvRow(i,r,name){
  return '<tr data-row="'+r+'">'+
    '<td><input name="samp'+i+'_m'+r+'_name" value="'+esc(name||'')+'" oninput="Air.onMvNameInput('+i+','+r+')" style="min-width:120px"></td>'+
    '<td><input type="number" step="any" name="samp'+i+'_m'+r+'_lod" oninput="Air.calcMvRow('+i+','+r+')" placeholder="µg"></td>'+
    '<td><input type="number" step="any" name="samp'+i+'_m'+r+'_oel" data-auto="" oninput="Air.onMvOelInput('+i+','+r+')" style="width:56px"><span class="ounit" id="airSampMvOunit'+i+'_'+r+'"></span></td>'+
    '<td><input type="number" step="any" name="samp'+i+'_m'+r+'_frac" value="0.25" oninput="Air.calcMvRow('+i+','+r+')" style="width:62px"></td>'+
    '<td class="reccell" id="airSampMvRecflow'+i+'_'+r+'">—</td>'+
    '<td class="reccell" id="airSampMvRecvol'+i+'_'+r+'">—</td>'+
    '<td><input type="number" step="any" name="samp'+i+'_m'+r+'_flow" oninput="Air.calcMvRow('+i+','+r+')" style="width:72px"></td>'+
    '<td class="calc-cell" id="airSampMvVol'+i+'_'+r+'">—</td>'+
    '<td class="calc-cell" id="airSampMvTime'+i+'_'+r+'">—</td></tr>';
}
function addMvRow(i,name){
  mvCount[i]=(mvCount[i]||0)+1; const r=mvCount[i];
  el('airMvBody'+i).insertAdjacentHTML('beforeend', mvRow(i,r,name));
  autofillMvOel(i,r); prefillMvFlow(i,r); setMvRecommended(i,r); calcMvRow(i,r);
  return r;
}
function mvMethodObj(i){ return methodObj(fld('samp'+i+'_chem').value, fld('samp'+i+'_type').value, fld('samp'+i+'_method').value); }
function setMvRecommended(i,r){
  const o=mvMethodObj(i);
  const fEl=el('airSampMvRecflow'+i+'_'+r), vEl=el('airSampMvRecvol'+i+'_'+r);
  if(fEl) fEl.textContent = o?rangeTxt(o.fmin,o.fmax,'L/min'):'—';
  if(vEl) vEl.textContent = o?rangeTxt(o.vmin,o.vmax,'L'):'—';
}
function refreshMvRecommended(i){ document.querySelectorAll('#airMvBody'+i+' tr').forEach(tr=>setMvRecommended(i,tr.dataset.row)); }
function autofillMvOel(i,r){
  const oelF=fld('samp'+i+'_m'+r+'_oel'); if(!oelF) return;
  if(oelF.value!=='' && oelF.dataset.auto!=='1') return;
  const nm=((fld('samp'+i+'_m'+r+'_name')||{}).value||'').trim();
  const sel=selectedOel(nm); const us=el('airSampMvOunit'+i+'_'+r);
  if(sel.val!=null){ oelF.value=sel.val; oelF.dataset.auto='1'; if(us) us.textContent=(OEL_DATA[nm]||{}).unit||''; }
  else if(oelF.dataset.auto==='1'){ oelF.value=''; if(us) us.textContent=''; }
}
function onMvOelInput(i,r){ const f=fld('samp'+i+'_m'+r+'_oel'); if(f) f.dataset.auto=''; calcMvRow(i,r); }
function onMvNameInput(i,r){ autofillMvOel(i,r); calcMvRow(i,r); }
function prefillMvFlow(i,r){
  const f=fld('samp'+i+'_m'+r+'_flow'); if(!f||f.value!=='') return;
  const o=methodObj(fld('samp'+i+'_chem').value, fld('samp'+i+'_type').value, fld('samp'+i+'_method').value);
  if(o && o.fmin!=null) f.value=o.fmin;
}
function updateMvFlows(i){
  const o=methodObj(fld('samp'+i+'_chem').value, fld('samp'+i+'_type').value, fld('samp'+i+'_method').value);
  if(!o||o.fmin==null) return;
  document.querySelectorAll('#airMvBody'+i+' tr').forEach(tr=>{
    const r=tr.dataset.row; const f=fld('samp'+i+'_m'+r+'_flow');
    if(f && f.value===''){ f.value=o.fmin; calcMvRow(i,r); }
  });
}
function calcMvRow(i,r){
  const lod=num((fld('samp'+i+'_m'+r+'_lod')||{}).value),
        oel=num((fld('samp'+i+'_m'+r+'_oel')||{}).value),
        frac=num((fld('samp'+i+'_m'+r+'_frac')||{}).value),
        flow=num((fld('samp'+i+'_m'+r+'_flow')||{}).value);
  let vol=null; if(lod!=null&&oel!=null&&frac!=null&&oel*frac!==0) vol=lod/(oel*frac);
  const vEl=el('airSampMvVol'+i+'_'+r), tEl=el('airSampMvTime'+i+'_'+r);
  if(vEl) vEl.textContent = vol!=null?round(vol,1):'—';
  const t=(vol!=null&&flow)?vol/flow:null;
  if(tEl) tEl.textContent = t!=null?round(t,1):'—';
  const o=mvMethodObj(i);
  const flowInp=fld('samp'+i+'_m'+r+'_flow');
  if(flowInp){
    flowInp.classList.remove('warn'); flowInp.title='';
    if(o && flow!=null && ((o.fmin!=null && flow<o.fmin) || (o.fmax!=null && flow>o.fmax))){
      flowInp.classList.add('warn'); flowInp.title='Planned flow is outside the method’s recommended range ('+rangeTxt(o.fmin,o.fmax,'L/min')+').';
    }
  }
  if(vEl){
    vEl.classList.remove('warn','good'); vEl.title='';
    if(vol!=null && o && o.vmax!=null && vol>o.vmax){
      vEl.classList.add('warn'); vEl.title='Min volume exceeds the method maximum ('+o.vmax+' L). You can’t detect at this fraction of the OEL — lower the Desired Fraction, raise the flow, or choose a more sensitive method.';
    } else if(vol!=null && o && o.vmin!=null && vol<o.vmin){
      vEl.classList.add('warn'); vEl.title='Min volume is below the method minimum ('+o.vmin+' L). Collect at least the method’s minimum volume.';
    } else if(vol!=null && o && (o.vmin!=null||o.vmax!=null)){
      vEl.classList.add('good');
    }
  }
  if(tEl){
    tEl.classList.remove('warn'); tEl.title='';
    if(t!=null && t>480){ tEl.classList.add('warn'); tEl.title='Required time exceeds one 8-hr shift (>480 min). Raise the flow or split into multiple samples.'; }
  }
}
function calcMvAll(i){ document.querySelectorAll('#airMvBody'+i+' tr').forEach(tr=>calcMvRow(i,tr.dataset.row)); }
function mvRowByName(i,name){ let f=null; document.querySelectorAll('#airMvBody'+i+' tr').forEach(tr=>{ if((fld('samp'+i+'_m'+tr.dataset.row+'_name')||{}).value===name) f=tr.dataset.row; }); return f; }
function populateMvRows(i,names){
  const body=el('airMvBody'+i); if(!body) return;
  const snap={};
  body.querySelectorAll('tr').forEach(tr=>{
    const r=tr.dataset.row, nm=(fld('samp'+i+'_m'+r+'_name')||{}).value;
    if(nm){ const of=fld('samp'+i+'_m'+r+'_oel');
      snap[nm]={lod:(fld('samp'+i+'_m'+r+'_lod')||{}).value,oel:of?of.value:'',oelAuto:of?of.dataset.auto:'',frac:(fld('samp'+i+'_m'+r+'_frac')||{}).value,flow:(fld('samp'+i+'_m'+r+'_flow')||{}).value};
    }
  });
  body.innerHTML=''; mvCount[i]=0;
  names.forEach(nm=>{
    const r=addMvRow(i,nm); const d=snap[nm]; if(d){
      if(d.lod!=='') setVal('samp'+i+'_m'+r+'_lod',d.lod);
      if(d.frac!=='') setVal('samp'+i+'_m'+r+'_frac',d.frac);
      if(d.flow!=='') setVal('samp'+i+'_m'+r+'_flow',d.flow);
      if(d.oel!=='' && d.oelAuto!=='1'){ const f=fld('samp'+i+'_m'+r+'_oel'); f.value=d.oel; f.dataset.auto=''; }
      calcMvRow(i,r);
    }
  });
}

/* ---------- per-sample calculators ---------- */
function minutesBetween(start,stop){
  if(!start||!stop) return null;
  const a=start.split(':').map(Number), b=stop.split(':').map(Number);
  let m=(b[0]*60+b[1])-(a[0]*60+a[1]); if(m<0) m+=1440; return m;
}
function calcSample(i){
  const dur=minutesBetween(fld('samp'+i+'_start_time').value, fld('samp'+i+'_stop_time').value);
  const down=num(fld('samp'+i+'_downtime').value)||0;
  const net=dur!=null?Math.max(dur-down,0):null;
  el('airSampDuration'+i).value = net!=null?round(net,0):'';
  const flow=num(fld('samp'+i+'_flow').value);
  el('airSampVolume'+i).value = (net!=null&&flow!=null)?round(net*flow,1):'';
  calcAnalytes(i);
}
function calcGrav(i){
  const pre=num(fld('samp'+i+'_grav_pre').value), post=num(fld('samp'+i+'_grav_post').value);
  el('airSampGravNet'+i).value=(pre!=null&&post!=null)?round(post-pre,5):'';
}
function calcCal(i){
  const pre=num(fld('samp'+i+'_precal_flow').value), post=num(fld('samp'+i+'_postcal_flow').value);
  const st=el('airSampCalStatus'+i), d=el('airSampCalDiff'+i);
  if(!st||!d) return;
  if(pre==null||post==null||pre===0){ st.className='pill idle'; st.textContent='awaiting flows'; d.value=''; return; }
  const diff=Math.abs(post-pre)/pre*100; d.value=round(diff,2)+' %';
  if(diff>5){ st.className='pill bad'; st.textContent='INVALID — re-sample (>5%)'; }
  else { st.className='pill ok'; st.textContent='Valid (≤5%)'; }
}

/* ---------- analyte results + TWA calculator ---------- */
let aCount={};
function parseND(s){ s=(s||'').trim(); const nd=s.indexOf('<')===0; const v=parseFloat(nd?s.slice(1):s); return {nd:nd, val:isNaN(v)?null:v}; }
function analyteRow(i,r,name){
  return '<tr data-row="'+r+'">'+
    '<td><input name="samp'+i+'_a'+r+'_name" value="'+esc(name||'')+'" oninput="Air.onNameInput('+i+','+r+')" style="min-width:130px"></td>'+
    '<td><input name="samp'+i+'_a'+r+'_mdl"></td>'+
    '<td><input name="samp'+i+'_a'+r+'_result" oninput="Air.calcAnalytes('+i+')" placeholder="e.g. 0.42 or <0.002"></td>'+
    '<td><input name="samp'+i+'_a'+r+'_units" value="mg/m³" oninput="Air.calcAnalytes('+i+')"></td>'+
    '<td><input name="samp'+i+'_a'+r+'_corrected"></td></tr>';
}
function addAnalyte(i,name){
  aCount[i]=(aCount[i]||0)+1; const r=aCount[i];
  el('airResBody'+i).insertAdjacentHTML('beforeend', analyteRow(i,r,name));
  autofillRowOel(i,r); refreshTWA();
  return r;
}
function autofillRowOel(i,r){
  const oelF=fld('samp'+i+'_a'+r+'_oel'); if(!oelF) return;
  if(oelF.value!=='' && oelF.dataset.auto!=='1') return;
  const nm=((fld('samp'+i+'_a'+r+'_name')||{}).value||'').trim();
  const sel=selectedOel(nm);
  if(sel.val!=null){
    oelF.value=sel.val; oelF.dataset.auto='1'; oelF.title='Auto-filled: '+(sel.key||'').replace('|',' ');
    const uF=fld('samp'+i+'_a'+r+'_units'); const u=(OEL_DATA[nm]||{}).unit;
    if(uF && u && (uF.value===''||uF.value==='mg/m³'||uF.dataset.auto==='1')){ uF.value=u; uF.dataset.auto='1'; }
  } else if(oelF.dataset.auto==='1'){ oelF.value=''; oelF.title=''; }
}
function onOelInput(i,r){ const f=fld('samp'+i+'_a'+r+'_oel'); if(f){ f.dataset.auto=''; f.title=''; } calcAnalytes(i); }
function autofillAllOel(){
  units.filter(u=>u.kind==='sample').forEach(u=>{
    document.querySelectorAll('#airResBody'+u.idx+' tr').forEach(tr=>autofillRowOel(u.idx,tr.dataset.row)); calcAnalytes(u.idx);
    document.querySelectorAll('#airMvBody'+u.idx+' tr').forEach(tr=>autofillMvOel(u.idx,tr.dataset.row)); calcMvAll(u.idx);
  });
}
function analyteOptionsFor(chem){ return ANALYTE_PRESETS[chem] || (chem ? [chem] : []); }
function populateAnalyteSelect(i, chem){
  const sel=el('airAnalyteSel'+i); if(!sel) return;
  const opts=analyteOptionsFor(chem);
  sel.innerHTML = opts.map(o=>'<option value="'+esc(o)+'" selected>'+o+'</option>').join('');
  onAnalyteSelect(i);
}
function rowByName(i,name){ let f=null; document.querySelectorAll('#airResBody'+i+' tr').forEach(tr=>{ if((fld('samp'+i+'_a'+tr.dataset.row+'_name')||{}).value===name) f=tr.dataset.row; }); return f; }
function selectAnalytes(i,names){
  const sel=el('airAnalyteSel'+i); if(!sel) return;
  names.forEach(n=>{
    if(!Array.from(sel.options).some(o=>o.value===n)){ const o=document.createElement('option'); o.value=n; o.textContent=n; sel.appendChild(o); }
  });
  Array.from(sel.options).forEach(o=>{ o.selected = names.indexOf(o.value)>=0; });
  onAnalyteSelect(i);
}
function onAnalyteSelect(i){
  const sel=el('airAnalyteSel'+i); if(!sel) return;
  const chosen=Array.from(sel.selectedOptions).map(o=>o.value);
  const snap={};
  document.querySelectorAll('#airResBody'+i+' tr').forEach(tr=>{
    const r=tr.dataset.row, nm=(fld('samp'+i+'_a'+r+'_name')||{}).value;
    if(nm) snap[nm]={mdl:fld('samp'+i+'_a'+r+'_mdl').value,result:fld('samp'+i+'_a'+r+'_result').value,units:fld('samp'+i+'_a'+r+'_units').value,corrected:fld('samp'+i+'_a'+r+'_corrected').value};
  });
  el('airResBody'+i).innerHTML=''; aCount[i]=0;
  chosen.forEach(nm=>{
    const r=addAnalyte(i,nm); const d=snap[nm]; if(d){
      fld('samp'+i+'_a'+r+'_mdl').value=d.mdl; fld('samp'+i+'_a'+r+'_result').value=d.result;
      fld('samp'+i+'_a'+r+'_units').value=d.units; fld('samp'+i+'_a'+r+'_corrected').value=d.corrected;
    }
  });
  populateMvRows(i, chosen);
  calcAnalytes(i);
}
function calcAnalytes(i){ refreshTWA(); }
function allAnalyteNames(){
  const set=new Set();
  units.filter(u=>u.kind==='sample').forEach(u=>{
    document.querySelectorAll('#airResBody'+u.idx+' [name$="_name"]').forEach(inp=>{ const v=inp.value.trim(); if(v) set.add(v); });
  });
  return Array.from(set);
}

let oelChoice={};
function oelLimitsFor(name){ return (OEL_DATA[name]||{}).limits || []; }
function defaultOelKey(name){
  const lim=oelLimitsFor(name); if(!lim.length) return '';
  const b=(el('airOelBasis')||{}).value||'OSHA', lt=(el('airOelLimit')||{}).value||'TWA';
  let m = lim.find(l=>l.src===b && l.type.indexOf(lt)>=0 && l.val!=null);
  if(!m) m = lim.find(l=>l.src===b && l.type.indexOf('TWA')>=0 && l.val!=null);
  if(!m) m = lim.find(l=>l.src===b && l.val!=null);
  if(!m) m = lim.find(l=>l.val!=null);
  return m ? (m.src+'|'+m.type) : '';
}
function selectedOel(name){
  const lim=oelLimitsFor(name);
  const key = (name in oelChoice) ? oelChoice[name] : defaultOelKey(name);
  const m = lim.find(l=>(l.src+'|'+l.type)===key);
  return {key:key, val:(m&&m.val!=null)?m.val:null};
}
function oelCellHTML(name){
  const lim=oelLimitsFor(name); const cur=selectedOel(name).key;
  const u=(OEL_DATA[name]||{}).unit||'';
  let h='<select style="width:100%" onchange="Air.setOel(\''+esc(name).replace(/'/g,"&#39;")+'\', this.value)">';
  h+='<option value="">— none —</option>';
  lim.forEach(l=>{
    const k=l.src+'|'+l.type;
    const lbl=l.src+' '+l.type+(l.val!=null?(' '+l.val+(u?(' '+u):'')):'')+(l.note?(' '+l.note):'');
    h+='<option value="'+esc(k)+'"'+(k===cur?' selected':'')+'>'+esc(lbl)+'</option>';
  });
  h+='</select>';
  return h;
}
function setOel(name,key){ oelChoice[name]=key; refreshTWA(); }
function onOelBasis(){ oelChoice={}; autofillAllOel(); refreshTWA(); }
function onNameInput(i,r){ const f=fld('samp'+i+'_a'+r+'_oel'); if(f&&f.dataset.auto!=='1'&&f.value!==''){ } else { autofillRowOel(i,r); } calcAnalytes(i); }

/* ---- extended work-shift OEL adjustment (Brief & Scala, daily) ---- */
function shiftRF(){
  const model=(el('airTwaAdjModel')||{}).value||'none';
  const h=num((el('airTwaShift')||{}).value);
  if(model==='bs_daily' && h!=null && h>8 && h<24){ return (8/h)*((24-h)/16); }
  return 1;
}
function applyAdjUI(rf){
  const adjusting = rf!==1;
  const tbl=el('airTwaTable'); if(tbl) tbl.classList.toggle('noadj', !adjusting);
  const thPct=el('airThPct'); if(thPct) thPct.textContent = adjusting ? '% of Adj. OEL' : '% of OEL';
  const note=el('airTwaRF'); if(!note) return;
  const h=num((el('airTwaShift')||{}).value);
  if(adjusting){
    note.innerHTML='<b>Extended-shift OEL adjustment applied — Brief &amp; Scala (daily):</b> reduction factor = (8 ÷ '+round(h,1)+') × (24 − '+round(h,1)+') ÷ 16 = <b>×'+round(rf,3)+'</b>. '+
      '<b>Adj. OEL = OEL × '+round(rf,3)+'</b>, and the last column compares the 8-hr TWA to that reduced limit (<b>% of Adj. OEL</b>). '+
      'Use this when the shift is longer than 8 hr/day, since longer exposure with less recovery time warrants a lower limit. The 8-hr TWA itself is unchanged — only the limit it is judged against.';
  } else {
    note.innerHTML='<b>Extended-shift OEL adjustment:</b> none (standard 8-hr OEL). Enter a <b>Work Shift</b> longer than 8 hr/day and pick <b>Brief &amp; Scala (daily)</b> to reduce the OEL for the longer shift — an <b>Adj. OEL</b> column then appears and the comparison changes to <b>% of Adj. OEL</b>.';
  }
}
function computeTwaRows(){
  /* Single source of truth for the TWA Calculator. Returns:
     { adjusting, rf, rows: [{worker, sampleCount, firstOfBlock, name, nSamp,
                              totMin, twa, ndAny, unit, oel, oelKey, oelLabel,
                              adjOel, cmp, pct}] }
     Both refreshTWA() (renders the on-screen table) and ofTwaCalcsTable()
     (renders the printout) consume this so a DOM-scraping difference can't
     drop rows from one and not the other. */
  const rf = shiftRF();
  const adjusting = rf !== 1;
  const names = allAnalyteNames();
  const sampleUnits = units.filter(u => u.kind === 'sample');
  const workerGroups = []; const seen = new Map();
  sampleUnits.forEach(u => {
    const empF = document.querySelector('#airForm [name="samp'+u.idx+'_emp_name"]');
    const empName = (empF ? empF.value.trim() : '') || '(Unassigned)';
    if (!seen.has(empName)) { seen.set(empName, []); workerGroups.push(empName); }
    seen.get(empName).push(u);
  });
  const rows = [];
  workerGroups.forEach((worker, wIdx) => {
    const workerSamples = seen.get(worker);
    let firstAnalyteRow = true;
    names.forEach(name => {
      let totMin = 0, totC = 0, nSamp = 0, ndAny = false, unit = '';
      workerSamples.forEach(u => {
        const i = u.idx, dur = num((el('airSampDuration'+i)||{}).value);
        document.querySelectorAll('#airResBody'+i+' tr').forEach(tr => {
          const nm = ((tr.querySelector('[name$="_name"]')||{}).value||'').trim();
          if (nm !== name) return;
          const p = parseND((tr.querySelector('[name$="_result"]')||{}).value);
          const un = (tr.querySelector('[name$="_units"]')||{}).value||''; if (un && !unit) unit = un;
          if (p.val != null && dur != null) { totC += p.val*dur; totMin += dur; nSamp++; if (p.nd) ndAny = true; }
        });
      });
      if (!nSamp) return;
      const twa = totC/480;
      const o = selectedOel(name); const oel = o.val;
      const adjOel = (oel != null) ? oel*rf : null;
      const cmp = adjusting ? adjOel : oel;
      const pct = (twa != null && cmp) ? twa/cmp*100 : null;
      const unitsTxt = (OEL_DATA[name]||{}).unit || '';
      /* Resolve a printable OEL label like "OSHA PEL TWA 1 mg/m³" */
      const lim = oelLimitsFor(name);
      const m = lim.find(l => (l.src+'|'+l.type) === o.key);
      const oelLabel = m ? (m.src+' '+m.type+(m.val!=null?(' '+m.val+(unitsTxt?(' '+unitsTxt):'')):'')+(m.note?(' '+m.note):'')) : '';
      rows.push({
        worker, sampleCount: workerSamples.length, firstOfBlock: firstAnalyteRow,
        wIdx, name, nSamp, totMin, twa, ndAny, unit,
        oelKey: o.key, oelLabel, adjOel, pct,
      });
      firstAnalyteRow = false;
    });
  });
  return { adjusting, rf, rows };
}

function refreshTWA(){
  updateCOCPreview();
  const body = el('airTwaBody'); if (!body) return;
  const { adjusting, rows } = computeTwaRows();
  applyAdjUI(shiftRF());
  body.innerHTML = '';
  const names = allAnalyteNames();
  if (!names.length) {
    body.innerHTML = '<tr><td colspan="9" style="color:var(--ai-muted)">No analytes yet — add analytes in the sample tabs.</td></tr>';
    return;
  }
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="9" style="color:var(--ai-muted)">No measured results yet — enter Measured Result values in the sample tabs.</td></tr>';
    return;
  }
  rows.forEach(r => {
    const workerCell = r.firstOfBlock
      ? '<td style="font-weight:600;border-top:'+(r.wIdx>0?'2px solid var(--ai-line)':'1px solid var(--ai-line2)')+'">'+esc(r.worker)+' <span style="font-weight:400;color:var(--ai-muted)">('+r.sampleCount+' sample'+(r.sampleCount===1?'':'s')+')</span></td>'
      : '<td style="color:var(--ai-muted)">&nbsp;</td>';
    body.insertAdjacentHTML('beforeend',
      '<tr>'+workerCell+
      '<td>'+esc(r.name)+'</td>'+
      '<td style="text-align:right">'+r.nSamp+'</td>'+
      '<td class="calc-cell">'+(r.totMin?round(r.totMin,0):'—')+'</td>'+
      '<td class="calc-cell">'+(r.ndAny?'<':'')+round(r.twa,4)+'</td>'+
      '<td>'+esc(r.unit)+'</td>'+
      '<td>'+oelCellHTML(r.name)+'</td>'+
      '<td class="adjcol calc-cell" title="OEL reduced for the work shift (Brief & Scala)">'+(r.adjOel!=null?round(r.adjOel,4):'—')+'</td>'+
      '<td class="calc-cell">'+(r.pct!=null?((r.ndAny?'<':'')+round(r.pct,1)+'%'):'—')+'</td>'+
      '</tr>');
  });
}

/* ---------- prefill (filled-out forms) ---------- */
function setVal(name,val){
  const list=document.querySelectorAll('#airForm [name="'+name+'"]'); if(!list.length||val==null) return;
  if(list.length>1 && list[0].type==='radio'){ list.forEach(r=>{ r.checked=(r.value===val); }); return; }
  const f=list[0];
  if(f.type==='radio'){ if(f.value===val) f.checked=true; return; }
  if(f.tagName==='SELECT'){
    if(!Array.from(f.options).some(o=>o.value===val)){ const o=document.createElement('option'); o.value=val; o.textContent=val; f.appendChild(o); }
    f.value=val;
  } else { f.value=val; }
}
function applyPrefill(){
  const P = window.PREFILL; if(!P) return;
  const g=P.general||{};
  if(g.shop_name){ setVal('shop_name', g.shop_name); onShopChange(); }
  el('airPanelHost').innerHTML=''; el('airTabBar').innerHTML='';
  units=[]; sIdx=0; bIdx=0; activeUid=null; aCount={};
  (P.samples||[]).forEach(sp=>{
    addSample(); const i=sIdx; const f=sp.fields||{};
    if(f.chem){ setVal('samp'+i+'_chem', f.chem); onChem(i); }
    if(f.type){ setVal('samp'+i+'_type', f.type); onType(i); }
    if(f.method){ setVal('samp'+i+'_method', f.method); onMethod(i); }
    Object.keys(f).forEach(k=>{ if(['chem','type','method'].indexOf(k)<0) setVal('samp'+i+'_'+k, f[k]); });
    if(sp.analytes){
      const names=sp.analytes.map(a=>a.name); selectAnalytes(i,names);
      sp.analytes.forEach(a=>{
        const r=rowByName(i,a.name); if(r!=null){
          setVal('samp'+i+'_a'+r+'_mdl',a.mdl); setVal('samp'+i+'_a'+r+'_result',a.result);
          setVal('samp'+i+'_a'+r+'_units',a.units); setVal('samp'+i+'_a'+r+'_corrected',a.corrected);
          setVal('samp'+i+'_a'+r+'_oel',a.oel);
        }
        const mr=mvRowByName(i,a.name); if(mr!=null){
          if(a.mv_lod) setVal('samp'+i+'_m'+mr+'_lod',a.mv_lod);
          if(a.mv_frac) setVal('samp'+i+'_m'+mr+'_frac',a.mv_frac);
          if(a.mv_flow) setVal('samp'+i+'_m'+mr+'_flow',a.mv_flow);
          calcMvRow(i,mr);
        }
      });
    }
    calcCal(i); calcSample(i);
  });
  (P.blanks||[]).forEach(bp=>{
    addBlank(); const i=bIdx; const f=bp.fields||{};
    if(f.chem){ setVal('blank'+i+'_chem', f.chem); onBlankChem(i); }
    if(f.method){ setVal('blank'+i+'_method', f.method); onBlankMethod(i); }
    Object.keys(f).forEach(k=>{ if(['chem','method'].indexOf(k)<0) setVal('blank'+i+'_'+k, f[k]); });
  });
  Object.keys(g).forEach(k=>{ if(k!=='shop_name') setVal(k, g[k]); });
  if(units.length){ activeUid=units[0].uid; showTab(activeUid); }
  refreshTWA();
}

/* ============================================================
   Official ARNG Air Sampling Form (Breathing Zone) — print layout.
   Builds a hidden DOM matching the DOCX template (landscape, 3 samples
   per page block), populates from collectForm(), prints, then removes.
   ============================================================ */
const CB = '☐';   /* unchecked checkbox glyph */
const CK = '☒';   /* checked checkbox glyph (heavy box) */
function ofEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function ofVal(v){ return v ? ofEsc(v) : '&nbsp;'; }
function ofMark(checked){ return checked ? CK : CB; }
function ofUsDate(iso){ if(!iso) return ''; const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m?(m[2]+'/'+m[3]+'/'+m[1]):iso; }

function ofSamplePanel(idx){
  /* Pull fields for a sample from the LIVE form DOM, not collectForm(), so
     calculated readonly fields (duration, volume, gravNet, calDiff) are in
     sync. Returns a flat object with all fields the official form needs. */
  const i = idx;
  const get = nm => { const f = document.querySelector('#airForm [name="samp'+i+'_'+nm+'"]'); return f ? f.value : ''; };
  const radio = nm => {
    const f = document.querySelector('#airForm [name="samp'+i+'_'+nm+'"]:checked');
    return f ? f.value : '';
  };
  /* Active sample analytes (one row per analyte) from #airResBody{i} */
  const analytes = [];
  document.querySelectorAll('#airResBody'+i+' tr').forEach(tr => {
    const r = tr.dataset.row;
    const nm = get('a'+r+'_name'); if (!nm) return;
    analytes.push({
      name: nm,
      mdl: get('a'+r+'_mdl'),
      result: get('a'+r+'_result'),
      units: get('a'+r+'_units'),
      corrected: get('a'+r+'_corrected'),
      sae: '',
    });
  });
  return {
    kind: 'sample',
    pump_num: get('pump_num'),
    pump_mfg: get('pump_mfg'),
    pump_model: get('pump_model'),
    pump_serial: get('pump_serial'),
    cal_model: get('cal_model'),
    cal_serial: get('cal_serial'),
    cal_mfg_date: get('cal_mfg_date'),
    cal_due: get('cal_due'),
    chem: get('chem'),
    method: get('method'),
    media: get('media'),
    media_lot: get('media_lot'),
    media_exp: get('media_exp'),
    inspirability: radio('inspirability'),
    position: radio('position'),
    emp_name: get('emp_name'),
    emp_id: get('emp_id'),
    job_title: get('job_title'),
    shift_hrs: get('shift_hrs'),
    exp_origin: get('exp_origin'),
    process: get('process'),
    materials: get('materials'),
    activity: get('activity'),
    task_desc: get('task_desc'),
    ppe: get('ppe'),
    engineering: get('engineering'),
    administrative: get('administrative'),
    respirator: get('respirator'),
    ppe_worn: get('ppe_worn'),
    precal_date: get('precal_date'),
    precal_time: get('precal_time'),
    precal_flow: get('precal_flow'),
    postcal_date: get('postcal_date'),
    postcal_time: get('postcal_time'),
    postcal_flow: get('postcal_flow'),
    cal_diff: get('cal_diff'),
    field_id: get('field_id'),
    doehrs_id: get('doehrs_id'),
    lab_id: get('lab_id'),
    task_id: get('task_id'),
    start_date: get('start_date'),
    start_time: get('start_time'),
    stop_date: get('stop_date'),
    stop_time: get('stop_time'),
    downtime: get('downtime'),
    duration: get('duration'),
    flow: get('flow'),
    volume: get('volume'),
    grav_pre: get('grav_pre'),
    grav_post: get('grav_post'),
    grav_net: get('grav_net'),
    baro_start: get('baro_start'),
    baro_end: get('baro_end'),
    temp_start: get('temp_start'),
    temp_end: get('temp_end'),
    rh: get('rh'),
    wind_speed: get('wind_speed'),
    wind_dir: get('wind_dir'),
    analytes: analytes,
  };
}

function ofBlankPanel(idx){
  /* Returns a panel-shaped object for a blank so it fits the same 3-up
     layout as a real sample. Most per-sample fields (calibration, ambient,
     personnel, etc.) are blank for a media/field blank — the printout
     intentionally leaves those cells empty and uses the Sample/Blank
     Category checkbox row in the Collection Info section to indicate this
     column is a Field Blank or Lab/Media Blank. */
  const i = idx;
  const get = nm => { const f = document.querySelector('#airForm [name="blank'+i+'_'+nm+'"]'); return f ? f.value : ''; };
  const category = get('category') || 'Field Blank';
  return {
    kind: 'blank',
    category,
    field_id: get('id'),
    chem: get('chem'),
    method: get('method'),
    media: get('media'),
    media_lot: get('media_lot'),
    media_exp: get('media_exp'),
    /* Park the comments text in the description so it doesn't disappear. */
    activity: get('comments'),
    /* Empty defaults for the sample-only fields the renderer reads */
    analytes: [],
  };
}

function ofGeneralFields(){
  const get = nm => { const f = document.querySelector('#airForm [name="'+nm+'"]'); return f ? f.value : ''; };
  return {
    survey_date: get('survey_date'),
    shop_name: get('shop_name'),
    shop_priority: get('shop_priority'),
    seg: get('seg'),
    building: get('building'),
    parent_location: get('parent_location'),
    work_location: get('work_location'),
    associated_processes: get('associated_processes'),
    lab_name: get('lab_name'),
    lab_phone: get('lab_phone'),
    lab_turnaround: get('lab_turnaround'),
    lab_date_sent: get('lab_date_sent'),
    lab_date_analyzed: get('lab_date_analyzed'),
    lab_date_reported: get('lab_date_reported'),
    lab_date_returned: get('lab_date_returned'),
    evaluation: get('evaluation'),
    comments: get('comments'),
    notes_calcs: get('notes_calcs'),
    completed_by: get('completed_by'),
    qa_review_by: get('qa_review_by'),
  };
}

function ofGeneralInfoTable(g){
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="6">General Information</td></tr>'+
      '<tr>'+
        '<td class="of-label">Survey Date</td>'+
        '<td class="of-label">Shop Priority / Tier</td>'+
        '<td class="of-label">Shop Name</td>'+
        '<td class="of-label">Building</td>'+
        '<td class="of-label">Parent Location</td>'+
        '<td class="of-label">SEG</td>'+
      '</tr>'+
      '<tr>'+
        '<td class="of-val">'+ofVal(ofUsDate(g.survey_date))+'</td>'+
        '<td class="of-val">'+ofVal(g.shop_priority)+'</td>'+
        '<td class="of-val">'+ofVal(g.shop_name)+'</td>'+
        '<td class="of-val">'+ofVal(g.building)+'</td>'+
        '<td class="of-val">'+ofVal(g.parent_location)+'</td>'+
        '<td class="of-val">'+ofVal(g.seg)+'</td>'+
      '</tr>'+
      '<tr><td class="of-label" colspan="6">Associated Processes</td></tr>'+
      '<tr><td class="of-val" colspan="6">'+ofVal(g.associated_processes)+'</td></tr>'+
    '</table>';
}

/* ── Shared helpers for variable-width tables ── */
function ofPanelCells(panels, key, dateLike){
  return panels.map(s => '<td class="of-val">'+ofVal(dateLike ? ofUsDate(s && s[key]) : (s && s[key]))+'</td>').join('');
}
function ofCustomCells(panels, fn){
  return panels.map(fn).join('');
}
function ofColspan(panels){ return String(1 + panels.length); }

function ofGenSampleTable(panels, sampleNos){
  /* General Sample Information — panels.length sample columns (1, 2, or 3).
     sampleNos is the array of 1-based sample numbers for this page block. */
  const inspirOptions = ['Total','Respirable','Inhalable','Thoracic','NA'];
  const inspirCell = s => '<td class="of-cb">'+
    inspirOptions.map(o => ofMark(s && s.inspirability===o)+' '+o).join('&nbsp;&nbsp;')+'</td>';
  const head = n => '<td class="of-sample-head">'+(n ? 'Sample '+n : '&nbsp;')+'</td>';
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="'+ofColspan(panels)+'">General Sample Information</td></tr>'+
      '<tr>'+
        '<td class="of-label" style="width:18%">Passive Dosimeter # / Pump #</td>'+
        sampleNos.map(head).join('')+
      '</tr>'+
      '<tr><td class="of-label">Passive Dosimeter # / Pump #</td>'+
        ofPanelCells(panels,'pump_num')+'</tr>'+
      '<tr><td class="of-label">Hazard</td>'+
        ofPanelCells(panels,'chem')+'</tr>'+
      '<tr><td class="of-label">Sampling Method</td>'+
        ofPanelCells(panels,'method')+'</tr>'+
      '<tr><td class="of-label">Inspirability</td>'+
        ofCustomCells(panels, inspirCell)+'</tr>'+
      '<tr><td class="of-label">Sample Media</td>'+
        ofPanelCells(panels,'media')+'</tr>'+
      '<tr><td class="of-label">Sample Media Lot #</td>'+
        ofPanelCells(panels,'media_lot')+'</tr>'+
      '<tr><td class="of-label">Sample Media Expiration Date</td>'+
        ofPanelCells(panels,'media_exp',true)+
      '</tr>'+
    '</table>';
}

function ofPersonnelTable(panels){
  const posOptions = ['Right Shoulder','Collar','Left Shoulder','Area','Other'];
  const exposureCell = s => '<td class="of-cb">'+
    ofMark(s && s.exp_origin==='Ambient Conditions')+' Ambient Conditions<br>'+
    ofMark(s && s.exp_origin==='Operator Position')+' Operator Position</td>';
  const positionCell = s => '<td class="of-cb">'+
    posOptions.map(o => ofMark(s && s.position===o)+' '+o).join('&nbsp;&nbsp;')+'</td>';
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="'+ofColspan(panels)+'">Personnel Information</td></tr>'+
      '<tr><td class="of-label" style="width:18%">Last Name, First Name</td>'+
        ofPanelCells(panels,'emp_name')+'</tr>'+
      '<tr><td class="of-label">Last 4 / EDIPN ID</td>'+
        ofPanelCells(panels,'emp_id')+'</tr>'+
      '<tr><td class="of-label">Length of Work Shift (hrs)</td>'+
        ofPanelCells(panels,'shift_hrs')+'</tr>'+
      '<tr><td class="of-label">Exposure Origin</td>'+
        ofCustomCells(panels, exposureCell)+'</tr>'+
      '<tr><td class="of-label">Sample Position</td>'+
        ofCustomCells(panels, positionCell)+'</tr>'+
    '</table>';
}

function ofControlsTable(panels){
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="'+ofColspan(panels)+'">Control Information</td></tr>'+
      '<tr><td class="of-label" style="width:18%">PPE (incl. NIOSH TC # e.g. TC-84A-XXXX)</td>'+
        ofPanelCells(panels,'ppe')+'</tr>'+
      '<tr><td class="of-label">Engineering</td>'+
        ofPanelCells(panels,'engineering')+'</tr>'+
      '<tr><td class="of-label">Administrative</td>'+
        ofPanelCells(panels,'administrative')+'</tr>'+
    '</table>';
}

function ofEquipmentTable(panels){
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="'+ofColspan(panels)+'">Program Office Equipment Information</td></tr>'+
      '<tr><td class="of-label" style="width:18%">Pump Mfg</td>'+
        ofPanelCells(panels,'pump_mfg')+'</tr>'+
      '<tr><td class="of-label">Pump Model</td>'+
        ofPanelCells(panels,'pump_model')+'</tr>'+
      '<tr><td class="of-label">Pump Serial #</td>'+
        ofPanelCells(panels,'pump_serial')+'</tr>'+
      '<tr><td class="of-label">Calibrator Mfg / Model</td>'+
        ofPanelCells(panels,'cal_model')+'</tr>'+
      '<tr><td class="of-label">Calibrator Serial #</td>'+
        ofPanelCells(panels,'cal_serial')+'</tr>'+
      '<tr><td class="of-label">Calibrator Mfg Cal Date</td>'+
        ofPanelCells(panels,'cal_mfg_date',true)+
      '</tr>'+
    '</table>';
}

function ofPrePostCalTable(panels){
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="'+ofColspan(panels)+'">Pre- and Post-Calibration Information <span style="font-weight:normal">(invalid if &gt; 5% diff)</span></td></tr>'+
      '<tr><td class="of-label" style="width:18%">Pre-Cal Date</td>'+
        ofPanelCells(panels,'precal_date',true)+'</tr>'+
      '<tr><td class="of-label">Pre-Cal Time</td>'+
        ofPanelCells(panels,'precal_time')+'</tr>'+
      '<tr><td class="of-label">Pre- Flow Rate (LPM)</td>'+
        ofPanelCells(panels,'precal_flow')+'</tr>'+
      '<tr><td class="of-label">Post-Cal Date</td>'+
        ofPanelCells(panels,'postcal_date',true)+'</tr>'+
      '<tr><td class="of-label">Post-Cal Time</td>'+
        ofPanelCells(panels,'postcal_time')+'</tr>'+
      '<tr><td class="of-label">Post- Flow Rate (LPM)</td>'+
        ofPanelCells(panels,'postcal_flow')+'</tr>'+
      '<tr><td class="of-label">Pre/Post % Difference</td>'+
        ofPanelCells(panels,'cal_diff')+'</tr>'+
    '</table>';
}

function ofCategoryCell(s){
  /* Render the Sample / Field Blank / Lab/Media Blank checkbox row based on
     the panel's kind + category. Empty columns get all three unchecked. */
  if (!s) return '<td class="of-cb">'+CB+' Sample &nbsp; '+CB+' Field Blank &nbsp; '+CB+' Lab/Media Blank</td>';
  const isSample = s.kind === 'sample';
  const isFieldBlank = s.kind === 'blank' && /field/i.test(s.category || '');
  const isLabBlank   = s.kind === 'blank' && /lab|media/i.test(s.category || '');
  /* Default a blank with no category set to Field Blank — matches the form's
     UI default. */
  const fbMark = isFieldBlank || (s.kind === 'blank' && !isLabBlank);
  return '<td class="of-cb">'+
    ofMark(isSample)+' Sample &nbsp; '+
    ofMark(fbMark)+' Field Blank &nbsp; '+
    ofMark(isLabBlank)+' Lab/Media Blank'+
  '</td>';
}

function ofCollectionTable(panels){
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="'+ofColspan(panels)+'">Individual Samples Collection Information</td></tr>'+
      '<tr><td class="of-label" style="width:18%">IMS (Information Management System) Sample ID</td>'+
        ofPanelCells(panels,'doehrs_id')+'</tr>'+
      '<tr><td class="of-label">Field Sample ID</td>'+
        ofPanelCells(panels,'field_id')+'</tr>'+
      '<tr><td class="of-label">Sample / Blank Category</td>'+
        ofCustomCells(panels, ofCategoryCell)+
      '</tr>'+
      '<tr><td class="of-label">Lab Sample ID</td>'+
        ofPanelCells(panels,'lab_id')+'</tr>'+
      '<tr><td class="of-label">Start Date</td>'+
        ofPanelCells(panels,'start_date',true)+'</tr>'+
      '<tr><td class="of-label">Start Time</td>'+
        ofPanelCells(panels,'start_time')+'</tr>'+
      '<tr><td class="of-label">Stop Date</td>'+
        ofPanelCells(panels,'stop_date',true)+'</tr>'+
      '<tr><td class="of-label">Stop Time</td>'+
        ofPanelCells(panels,'stop_time')+'</tr>'+
      '<tr><td class="of-label">Total Downtime (min)</td>'+
        ofPanelCells(panels,'downtime')+'</tr>'+
      '<tr><td class="of-label">Total Sampling Time (min)</td>'+
        ofPanelCells(panels,'duration')+'</tr>'+
      '<tr><td class="of-label">Flow Rate (LPM)</td>'+
        ofPanelCells(panels,'flow')+'</tr>'+
      '<tr><td class="of-label">Total Volume (L)</td>'+
        ofPanelCells(panels,'volume')+'</tr>'+
    '</table>';
}

function ofGravTable(panels){
  /* Show only if any sample has gravimetric data — keeps the printout shorter */
  const any = panels.some(p => p && (p.grav_pre || p.grav_post || p.grav_net));
  if (!any) return '';
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="'+ofColspan(panels)+'">Gravimetric Analysis (in-house filter analysis only)</td></tr>'+
      '<tr><td class="of-label" style="width:18%">Pre-Sampled Weight (g)</td>'+
        ofPanelCells(panels,'grav_pre')+'</tr>'+
      '<tr><td class="of-label">Post-Sampled Weight (g)</td>'+
        ofPanelCells(panels,'grav_post')+'</tr>'+
      '<tr><td class="of-label">Net Sampled Weight (g)</td>'+
        ofPanelCells(panels,'grav_net')+'</tr>'+
    '</table>';
}

function ofLabInfoTable(g){
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="8">Lab Information</td></tr>'+
      '<tr>'+
        '<td class="of-label">Lab Name</td>'+
        '<td class="of-label">Phone Number</td>'+
        '<td class="of-label">Requested TAT (days)</td>'+
        '<td class="of-label">Date Sent</td>'+
        '<td class="of-label">Date Analyzed</td>'+
        '<td class="of-label">Date Reported</td>'+
        '<td class="of-label">Date Returned</td>'+
        '<td class="of-label">Expected Return</td>'+
      '</tr>'+
      '<tr>'+
        '<td class="of-val">'+ofVal(g.lab_name)+'</td>'+
        '<td class="of-val">'+ofVal(g.lab_phone)+'</td>'+
        '<td class="of-val">'+ofVal(g.lab_turnaround)+'</td>'+
        '<td class="of-val">'+ofVal(ofUsDate(g.lab_date_sent))+'</td>'+
        '<td class="of-val">'+ofVal(ofUsDate(g.lab_date_analyzed))+'</td>'+
        '<td class="of-val">'+ofVal(ofUsDate(g.lab_date_reported))+'</td>'+
        '<td class="of-val">'+ofVal(ofUsDate(g.lab_date_returned))+'</td>'+
        '<td class="of-val">&nbsp;</td>'+
      '</tr>'+
    '</table>';
}

function ofMeasurementTable(panels, sampleNos){
  /* Per-sample column showing the analyte rows. Each sample column gets its
     own analyte list rendered as a nested 5-col table. Column count matches
     panels.length so a single-sample page uses the full width. */
  const sampleBlock = s => {
    if (!s || !s.analytes || !s.analytes.length) return '<div class="of-val">&nbsp;</div>';
    let h = '<table class="of" style="margin:0;width:100%"><tr>'+
      '<th class="of-label" style="width:30%">Hazard</th>'+
      '<th class="of-label" style="width:18%">MDL / LOD</th>'+
      '<th class="of-label" style="width:18%">Measured Result</th>'+
      '<th class="of-label" style="width:18%">Corrected Result</th>'+
      '<th class="of-label" style="width:16%">SAE</th>'+
      '</tr>';
    s.analytes.forEach(a => {
      const units = a.units ? ' '+a.units : '';
      h += '<tr>'+
        '<td>'+ofVal(a.name)+'</td>'+
        '<td>'+ofVal(a.mdl)+'</td>'+
        '<td>'+(a.result ? ofEsc(a.result)+ofEsc(units) : '&nbsp;')+'</td>'+
        '<td>'+ofVal(a.corrected)+'</td>'+
        '<td>'+ofVal(a.sae)+'</td>'+
      '</tr>';
    });
    h += '</table>';
    return h;
  };
  const w = Math.floor(100 / Math.max(panels.length, 1));
  const head = (n) => '<td class="of-sample-head" style="width:'+w+'%">'+(n ? 'Sample '+n : '&nbsp;')+'</td>';
  const blockCell = s => '<td style="padding:0">'+sampleBlock(s)+'</td>';
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="'+panels.length+'">Lab Results</td></tr>'+
      '<tr>'+sampleNos.map(head).join('')+'</tr>'+
      '<tr>'+panels.map(blockCell).join('')+'</tr>'+
    '</table>';
}

function ofAmbientTable(panels){
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  const dirCell = s => '<td class="of-cb">'+dirs.map(d => ofMark(s && s.wind_dir===d)+' '+d).join('&nbsp;&nbsp;')+'</td>';
  const pairCell = (s, ka, kb) => '<td class="of-val">'+ofVal(s && s[ka])+' / '+ofVal(s && s[kb])+'</td>';
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head" colspan="'+ofColspan(panels)+'">Ambient Conditions</td></tr>'+
      '<tr><td class="of-label" style="width:18%">Baro. Pressure (in Hg) Start / End</td>'+
        ofCustomCells(panels, s => pairCell(s,'baro_start','baro_end'))+'</tr>'+
      '<tr><td class="of-label">Temperature (°F) Start / End</td>'+
        ofCustomCells(panels, s => pairCell(s,'temp_start','temp_end'))+'</tr>'+
      '<tr><td class="of-label">Relative Humidity (%) / Wind Speed (mph)</td>'+
        ofCustomCells(panels, s => pairCell(s,'rh','wind_speed'))+'</tr>'+
      '<tr><td class="of-label">Wind Direction</td>'+
        ofCustomCells(panels, dirCell)+'</tr>'+
    '</table>';
}

function ofTwaCalcsTable(){
  /* Read directly from computeTwaRows() — same data the screen TWA Calculator
     uses, so worker blocks can't accidentally get filtered out by DOM
     scraping. One row per (worker, analyte) pair that actually has data;
     workers print with their full name on every row (no merging) so it's
     readable in landscape. */
  const { adjusting, rows } = computeTwaRows();
  if (!rows.length) {
    return '<div class="of-val" style="padding:4pt 6pt; font-style:italic; color:#666;">No analyte results entered.</div>';
  }
  let h = '<table class="of" style="margin:0">'+
    '<tr>'+
      '<th class="of-label" style="width:16%">Worker</th>'+
      '<th class="of-label" style="width:18%">Analyte</th>'+
      '<th class="of-label" style="width:8%"># Samples</th>'+
      '<th class="of-label" style="width:10%">Total Time (min)</th>'+
      '<th class="of-label" style="width:12%">8-hr TWA</th>'+
      '<th class="of-label" style="width:7%">Units</th>'+
      '<th class="of-label" style="width:17%">OEL (basis)</th>'+
      (adjusting ? '<th class="of-label" style="width:6%">Adj. OEL</th>' : '')+
      '<th class="of-label" style="width:6%">% of '+(adjusting?'Adj. ':'')+'OEL</th>'+
    '</tr>';
  rows.forEach(r => {
    /* Show the full worker name in EVERY row of a block; the screen merges
       repeats with a blank cell, but for the printout duplicating it is more
       readable when the table breaks across pages. Add a thicker top border
       on the first row of each worker block to visually delimit groups. */
    const borderTop = r.firstOfBlock && r.wIdx > 0 ? 'border-top:1pt solid #000;' : '';
    h += '<tr>'+
      '<td class="of-val" style="font-weight:600;'+borderTop+'">'+ofVal(r.worker)+(r.firstOfBlock?' <span style="font-weight:400;color:#555">('+r.sampleCount+' sample'+(r.sampleCount===1?'':'s')+')</span>':'')+'</td>'+
      '<td class="of-val">'+ofVal(r.name)+'</td>'+
      '<td class="of-val" style="text-align:right">'+r.nSamp+'</td>'+
      '<td class="of-val" style="text-align:right">'+(r.totMin?round(r.totMin,0):'—')+'</td>'+
      '<td class="of-val" style="text-align:right">'+(r.ndAny?'&lt;':'')+round(r.twa,4)+'</td>'+
      '<td class="of-val">'+ofVal(r.unit)+'</td>'+
      '<td class="of-val">'+ofVal(r.oelLabel)+'</td>'+
      (adjusting ? '<td class="of-val" style="text-align:right">'+(r.adjOel!=null?round(r.adjOel,4):'—')+'</td>' : '')+
      '<td class="of-val" style="text-align:right">'+(r.pct!=null?((r.ndAny?'&lt;':'')+round(r.pct,1)+'%'):'—')+'</td>'+
    '</tr>';
  });
  h += '</table>';
  const adjModel = (el('airTwaAdjModel')||{}).value || 'none';
  const shiftHrs = (el('airTwaShift')||{}).value || '';
  if (adjModel === 'bs_daily' && shiftHrs) {
    h = '<div class="of-note" style="font-style:italic; padding:1pt 4pt;">'+
        'Brief &amp; Scala (daily) adjustment applied for '+ofEsc(shiftHrs)+'-hr shift.'+
        '</div>' + h;
  }
  return h;
}

function ofLabAndSignoffTable(g){
  /* Lab Information used to live here; it now renders in every per-sample
     page block (before the Lab Results section) so the IH sees lab context
     alongside the results. */
  return ''+
    '<table class="of">'+
      '<tr><td class="of-section-head">Detailed Evaluation / Follow-Up</td></tr>'+
      '<tr><td class="of-val" style="min-height:30pt">'+ofVal(g.evaluation)+'</td></tr>'+
    '</table>'+
    '<table class="of">'+
      '<tr><td class="of-section-head">Comments / Time Course of Events</td></tr>'+
      '<tr><td class="of-val" style="min-height:24pt">'+ofVal(g.comments)+'</td></tr>'+
    '</table>'+
    '<table class="of">'+
      '<tr><td class="of-section-head">Calculation of 8-Hour TWA (or Adjusted TWA)</td></tr>'+
      '<tr><td style="padding:0">'+ofTwaCalcsTable()+'</td></tr>'+
    '</table>'+
    '<table class="of">'+
      '<tr><td class="of-section-head">Notes</td></tr>'+
      '<tr><td class="of-val" style="min-height:24pt">'+ofVal(g.notes_calcs)+'</td></tr>'+
    '</table>'+
    '<table class="of">'+
      '<tr>'+
        '<td class="of-label" style="width:50%">Template Completed By (Name &amp; Date)</td>'+
        '<td class="of-label" style="width:50%">QA Review By (Name &amp; Date)</td>'+
      '</tr>'+
      '<tr>'+
        '<td class="of-val" style="min-height:16pt">'+ofVal(g.completed_by)+'</td>'+
        '<td class="of-val" style="min-height:16pt">'+ofVal(g.qa_review_by)+'</td>'+
      '</tr>'+
    '</table>';
}

function buildOfficialPageBlock(g, samples, includeHeader, startIdx){
  /* Build one page-block sized to the actual number of samples (1, 2, or 3).
     startIdx is the 1-based number of the first sample in this block so we
     can label the columns Sample N / Sample N+1 / Sample N+2. */
  const panels = samples.slice();
  const sampleNos = panels.map((_, i) => startIdx + i);
  return '<div class="of-pageblock">'+
    (includeHeader ?
      '<h1 class="of-title">Air Sampling Form — Breathing Zone</h1>'+
      ofGeneralInfoTable(g) : '')+
    ofGenSampleTable(panels, sampleNos)+
    ofPersonnelTable(panels)+
    ofControlsTable(panels)+
    ofEquipmentTable(panels)+
    ofPrePostCalTable(panels)+
    ofCollectionTable(panels)+
    ofGravTable(panels)+
    ofLabInfoTable(g)+
    ofMeasurementTable(panels, sampleNos)+
    ofAmbientTable(panels)+
    '</div>';
}

function buildOfficialDOM(){
  const existing = document.getElementById('airOfficialPrintRoot');
  if (existing) existing.remove();
  const g = ofGeneralFields();
  /* Combine samples and blanks into a single ordered list so blanks render
     as additional 3-up columns with the Sample/Blank Category checkbox row
     marking them as Field Blank or Lab/Media Blank. */
  const allPanels = units.map(u => u.kind === 'sample' ? ofSamplePanel(u.idx) : ofBlankPanel(u.idx));
  const root = document.createElement('div');
  root.id = 'airOfficialPrintRoot';
  if (!allPanels.length) {
    root.insertAdjacentHTML('beforeend', buildOfficialPageBlock(g, [], true, 1));
  } else {
    for (let i = 0; i < allPanels.length; i += 3) {
      const group = allPanels.slice(i, i+3);
      /* i is 0,3,6... — convert to 1-based starting "column number" */
      root.insertAdjacentHTML('beforeend', buildOfficialPageBlock(g, group, i === 0, i + 1));
    }
  }
  /* Final page: global Lab / Evaluation / Sign-off — render as its own block
     so it always lands on a fresh page (avoids being orphaned with the last
     sample's small sections). */
  const finalBlock = document.createElement('div');
  finalBlock.className = 'of-pageblock';
  finalBlock.innerHTML = ofLabAndSignoffTable(g);
  root.appendChild(finalBlock);
  document.body.appendChild(root);
}

function printOfficialForm(){
  buildOfficialDOM();
  document.body.classList.add('print-air-official');
  let styleEl = document.getElementById('airOfficialPageRule');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'airOfficialPageRule';
    styleEl.textContent = '@page { size: landscape; margin: 0.4in; }';
    document.head.appendChild(styleEl);
  }
  const cleanup = () => {
    document.body.classList.remove('print-air-official');
    const s = document.getElementById('airOfficialPageRule'); if (s) s.remove();
    const d = document.getElementById('airOfficialPrintRoot'); if (d) d.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

/* ---------- existing comprehensive print ---------- */
function buildAnalyteMirrors(){
  /* For each <select multiple> of analytes, insert a sibling div listing only
     the selected options. The print CSS hides the multi-select and shows the
     mirror so the printout doesn't waste space on unselected options. */
  document.querySelectorAll('#airForm select[multiple]').forEach(sel => {
    const names = Array.from(sel.selectedOptions).map(o => o.textContent.trim()).filter(Boolean);
    let mirror = sel.parentNode.querySelector(':scope > .print-analyte-mirror');
    if (!mirror) {
      mirror = document.createElement('div');
      mirror.className = 'print-analyte-mirror';
      sel.parentNode.appendChild(mirror);
    }
    mirror.textContent = names.length ? names.join(', ') : '(none selected)';
  });
}
function tearDownAnalyteMirrors(){
  document.querySelectorAll('#airForm .print-analyte-mirror').forEach(m => m.remove());
}
function printForm(){
  /* Inject an unnamed @page rule for landscape — more reliable than a named
     @page with the page: property, which Safari and older Chromes ignore.
     Pair it with .print-air on <body> so the 2-column #view-air rules apply.
     Mirror multi-selects so only chosen analytes print. All three side effects
     are torn down in the afterprint handler so screen view returns to normal
     and other tabs print portrait. */
  document.body.classList.add('print-air');
  buildAnalyteMirrors();
  let styleEl = document.getElementById('airLandscapePageRule');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'airLandscapePageRule';
    styleEl.textContent = '@page { size: landscape; margin: 0.3in; }';
    document.head.appendChild(styleEl);
  }
  const cleanup = () => {
    document.body.classList.remove('print-air');
    tearDownAnalyteMirrors();
    const s = document.getElementById('airLandscapePageRule');
    if (s) s.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

/* ---------- reset ---------- */
function resetForm(){
  if(!confirm('Clear all fields and start over?')) return;
  /* Drop any leftover PREFILL so initForm()->applyPrefill() doesn't immediately
     re-fill the form with the last loaded example. */
  window.PREFILL = null;
  document.getElementById('airForm').reset();
  el('airPanelHost').innerHTML=''; el('airTabBar').innerHTML='';
  sIdx=0; bIdx=0; units=[]; activeUid=null; aCount={}; oelChoice={}; mvCount={};
  initForm();
}

/* ============================================================
   Save / Load session (JSON)
   ============================================================ */
const gv = n => { const f=fld(n); return f?f.value:''; };
function fmtUSDate(iso){ if(!iso) return ''; const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m?(m[2]+'/'+m[3]+'/'+m[1]):iso; }
function downloadBlob(blob,filename){
  const a=document.createElement('a'); const url=URL.createObjectURL(blob);
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },400);
}
function downloadText(text,filename,mime){ downloadBlob(new Blob([text],{type:mime||'text/plain'}),filename); }

function collectForm(){
  const P={general:{}, samples:[], blanks:[]};
  document.querySelectorAll('#airForm [name]').forEach(f=>{
    const n=f.name; if(/^samp\d+_/.test(n)||/^blank\d+_/.test(n)) return;
    if(f.type==='radio'){ if(f.checked) P.general[n]=f.value; return; }
    P.general[n]=f.value;
  });
  units.filter(u=>u.kind==='sample').forEach(u=>{
    const i=u.idx, fields={};
    document.querySelectorAll('#airForm [name^="samp'+i+'_"]').forEach(f=>{
      const key=f.name.replace('samp'+i+'_','');
      if(/^a\d+_/.test(key)||/^m\d+_/.test(key)) return;
      if(f.type==='radio'){ if(f.checked) fields[key]=f.value; return; }
      fields[key]=f.value;
    });
    const analytes=[];
    document.querySelectorAll('#airResBody'+i+' tr').forEach(tr=>{
      const r=tr.dataset.row, nm=gv('samp'+i+'_a'+r+'_name');
      if(!nm) return;
      const mr=mvRowByName(i,nm);
      analytes.push({name:nm, mdl:gv('samp'+i+'_a'+r+'_mdl'), result:gv('samp'+i+'_a'+r+'_result'),
        units:gv('samp'+i+'_a'+r+'_units'), corrected:gv('samp'+i+'_a'+r+'_corrected'), oel:gv('samp'+i+'_a'+r+'_oel'),
        mv_lod: mr!=null?gv('samp'+i+'_m'+mr+'_lod'):'',
        mv_frac: mr!=null?gv('samp'+i+'_m'+mr+'_frac'):'',
        mv_flow: mr!=null?gv('samp'+i+'_m'+mr+'_flow'):''});
    });
    P.samples.push({fields:fields, analytes:analytes});
  });
  units.filter(u=>u.kind==='blank').forEach(u=>{
    const i=u.idx, fields={};
    document.querySelectorAll('#airForm [name^="blank'+i+'_"]').forEach(f=>{ fields[f.name.replace('blank'+i+'_','')]=f.value; });
    P.blanks.push({fields:fields});
  });
  return P;
}
function saveSession(){
  const P=collectForm();
  let base=(gv('shop_name')||'air-sampling')+' '+(gv('survey_date')||'');
  base=base.trim().replace(/[^\w.-]+/g,'_')||'air-sampling';
  downloadText(JSON.stringify(P,null,2), base+'.json', 'application/json');
}
function loadExample(key){
  const d = (window.AIR_DEMOS||window.DEMOS||{})[key||'1'] || window.AIR_DEMO_DATA || window.DEMO_DATA;
  if(!d){ alert('Example data not found — example-data.js is not loaded yet (added in a later step).'); return; }
  window.PREFILL = d; applyPrefill(); syncCOCDefaults(false); refreshTWA();
}
function onLoadFile(ev){
  const file=ev.target.files&&ev.target.files[0]; if(!file) return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{ window.PREFILL=JSON.parse(rd.result); applyPrefill(); syncCOCDefaults(false); refreshTWA(); alert('Session loaded: '+file.name); }
    catch(e){ alert('Could not load file — '+e.message); }
  };
  rd.readAsText(file); ev.target.value='';
}

/* ============================================================
   Chain of Custody — defaults, preview, PDF fill
   ============================================================ */
function syncCOCDefaults(overwrite){
  const set=(name,val)=>{ const f=fld(name); if(!f||val==null) return; if(overwrite||!f.value) f.value=val; };
  const shop=gv('shop_name'), proc=gv('associated_processes'), loc=gv('work_location');
  const completed=gv('completed_by');
  const name=completed.replace(/\s*\d{4}-\d{2}-\d{2}\s*$/,'').trim();
  set('coc_sampled_by', name);
  set('coc_relinquished_by', name);
  set('coc_project', [shop,proc].filter(Boolean).join(' — '));
  set('coc_site', loc);
  set('coc_process_desc', proc);
  set('coc_industry', 'Military / Army National Guard Industrial Hygiene');
  set('coc_turnaround', gv('lab_turnaround')?(gv('lab_turnaround')+' day'):'');
  set('coc_relinquished_date', gv('lab_date_sent'));
}
function cocRows(){
  const rows=[];
  units.filter(u=>u.kind==='sample').forEach(u=>{
    const i=u.idx;
    const chem=gv('samp'+i+'_chem'), type=gv('samp'+i+'_type');
    const passive=/passive|badge/i.test(type);
    const vol=gv('samp'+i+'_volume');
    const analytes=[]; document.querySelectorAll('#airResBody'+i+' [name$="_name"]').forEach(n=>{ if(n.value.trim()) analytes.push(n.value.trim()); });
    rows.push({
      id: gv('samp'+i+'_field_id') || gv('samp'+i+'_doehrs_id') || ('Sample '+i),
      date: fmtUSDate(gv('samp'+i+'_start_date')),
      medium: gv('samp'+i+'_media'),
      airVol: passive?'':(vol?(vol+' L'):''),
      passive: passive?((gv('samp'+i+'_start_time')||'')+'–'+(gv('samp'+i+'_stop_time')||'')):'',
      analysis: chem || analytes.join(', '),
      method: gv('samp'+i+'_method'),
      dl: ''
    });
  });
  units.filter(u=>u.kind==='blank').forEach(u=>{
    const i=u.idx;
    rows.push({
      id: gv('blank'+i+'_id') || ('Blank '+i),
      date:'', medium: gv('blank'+i+'_media'), airVol:'', passive:'',
      analysis: (gv('blank'+i+'_category')||'Blank')+(gv('blank'+i+'_chem')?(' — '+gv('blank'+i+'_chem')):''),
      method: gv('blank'+i+'_method'), dl:''
    });
  });
  return rows;
}
function updateCOCPreview(){
  const b=el('airCocPreviewBody'); if(!b) return;
  const rows=cocRows(); b.innerHTML='';
  if(!rows.length){ b.innerHTML='<tr><td colspan="7" style="color:var(--ai-muted)">No samples yet.</td></tr>'; return; }
  rows.forEach((r,idx)=>{
    b.insertAdjacentHTML('beforeend',
      '<tr><td>'+(idx+1)+'</td><td>'+esc(r.id)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.medium)+'</td><td>'+esc(r.airVol||r.passive)+'</td><td>'+esc(r.analysis)+'</td><td>'+esc(r.method)+'</td></tr>');
  });
}
function loadPdfLib(){
  if(window.PDFLib) return Promise.resolve(window.PDFLib);
  return new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
    s.onload=()=>window.PDFLib?res(window.PDFLib):rej(new Error('pdf-lib unavailable'));
    s.onerror=()=>rej(new Error('network blocked'));
    document.head.appendChild(s);
  });
}
function b64ToBytes(b64){ const bin=atob(b64); const a=new Uint8Array(bin.length); for(let k=0;k<bin.length;k++) a[k]=bin.charCodeAt(k); return a; }
async function generateCOC(){
  if(!window.COC_TEMPLATE_B64 || String(window.COC_TEMPLATE_B64).indexOf('__COC')===0){
    alert('COC template not embedded in this build yet — coc-template.js will be added in a later step.');
    return;
  }
  let PDFLib;
  try{ PDFLib=await loadPdfLib(); }
  catch(e){ alert('Could not load the PDF engine — this needs internet access the first time you generate a COC ('+e.message+').'); return; }
  let doc;
  try{ doc=await PDFLib.PDFDocument.load(b64ToBytes(window.COC_TEMPLATE_B64)); }
  catch(e){ alert('Could not open the COC template: '+e.message); return; }
  const form=doc.getForm();
  const set=(n,v)=>{ if(v==null||v==='') return; try{ form.getTextField(n).setText(String(v)); }catch(e){} };
  set('ReportToNameAddress.txt', gv('coc_report_to'));
  set('ReportToPhoneNumber.txt', gv('coc_report_phone'));
  set('ReportToCellNumber.txt', gv('coc_report_cell'));
  set('InvoiceToNameAddress.txt', gv('coc_invoice_to'));
  set('emailAddress.txt', gv('coc_email'));
  set('sendResultsTo.txt', gv('coc_email'));
  set('projectName.txt', gv('coc_project'));
  set('siteName.txt', gv('coc_site'));
  set('state.txt', gv('coc_state'));
  set('purchaseOrderNumber.txt', gv('coc_po'));
  set('clientAcctNumber.txt', gv('coc_acct'));
  set('sampledBy.txt', gv('coc_sampled_by'));
  set('industryDescription.txt', gv('coc_industry'));
  set('metals_processDescription.txt', gv('coc_process_desc'));
  set('specify.txt', gv('coc_turnaround'));
  set('comments.txt', gv('coc_comments'));
  set('pageNum.txt', gv('coc_page')||'1');
  set('ofNum.txt', gv('coc_of')||'1');
  set('relinquishedByName1.txt', gv('coc_relinquished_by'));
  set('relinquishedDate1.txt', fmtUSDate(gv('coc_relinquished_date')));
  set('relinquishedTime1.txt', gv('coc_relinquished_time'));
  const rows=cocRows();
  rows.slice(0,11).forEach((r,idx)=>{
    const s = idx===0 ? '' : String(idx+1);
    set('sampleID'+s+'.txt', r.id);
    set('dateSampled'+s+'.txt', r.date);
    set('collectionMedium'+s+'.txt', r.medium);
    set('airVol'+s+'.txt', r.airVol);
    set('passiveMonitors'+s+'.txt', r.passive);
    set('analysisRequested'+s+'.txt', r.analysis);
    set('methodReference'+s+'.txt', r.method);
    set('specificDL'+s+'.txt', r.dl);
  });
  if(rows.length>11) alert('Note: this COC page holds 11 rows; you have '+rows.length+' samples/blanks. The first 11 were filled — generate a second page for the rest.');
  try{ form.updateFieldAppearances(); }catch(e){}
  const bytes=await doc.save();
  let base=(gv('coc_project')||'SGS Galson COC').replace(/[^\w.-]+/g,'_').slice(0,60);
  downloadBlob(new Blob([bytes],{type:'application/pdf'}), 'COC_'+base+'.pdf');
}

function populateCOCClients(){
  const rs=el('airReportToSel'), is=el('airInvoiceToSel'), ad=el('airAcctList');
  if(rs){ rs.innerHTML='<option value="">— select —</option>'+COC_CLIENTS.reportTo.map((c,i)=>opt(String(i),c.label)).join('')+opt('other','Other / custom…'); }
  if(is){ is.innerHTML='<option value="">— select —</option>'+COC_CLIENTS.invoiceTo.map((c,i)=>opt(String(i),c.label)).join('')+opt('other','Other / custom…'); }
  if(ad){ ad.innerHTML=COC_CLIENTS.accounts.map(a=>opt(a)).join(''); }
}
function onReportToPick(){
  const v=el('airReportToSel').value; if(v===''||v==='other') return;
  const c=COC_CLIENTS.reportTo[+v]; if(!c) return;
  setVal('coc_report_to', c.addr);
  if(c.phone) setVal('coc_report_phone', c.phone);
  if(c.cell)  setVal('coc_report_cell', c.cell);
  if(c.email){ setVal('coc_email', c.email); }
  if(c.acct && !gv('coc_acct')) setVal('coc_acct', c.acct);
}
function onInvoiceToPick(){
  const v=el('airInvoiceToSel').value; if(v===''||v==='other') return;
  const c=COC_CLIENTS.invoiceTo[+v]; if(!c) return;
  setVal('coc_invoice_to', c.addr);
}

/* ============================================================
   Collapsible main sections
   ============================================================ */
function initCollapsible(){
  /* Top-level cards — once-per-card click handler. */
  document.querySelectorAll('#airAppHost section.air-card > h2').forEach(h=>{
    if(h.dataset.collapInit) return; h.dataset.collapInit='1';
    h.insertAdjacentHTML('afterbegin','<span class="chev" aria-hidden="true">▾</span> ');
    h.addEventListener('click', function(e){
      if(e.target.closest('button,select,input,a,textarea')) return;
      h.parentElement.classList.toggle('collapsed');
    });
  });
  /* Per-sample fieldsets — event delegation on the appHost so fieldsets
     inside newly-added sample panels work automatically without us having
     to re-bind handlers. */
  const root = document.getElementById('airAppHost');
  if (root && !root.dataset.fsCollapInit) {
    root.dataset.fsCollapInit = '1';
    root.addEventListener('click', function(e){
      const legend = e.target.closest('fieldset > legend');
      if (!legend) return;
      /* Don't toggle if the click came from an interactive element inside
         the legend (e.g. an inline button or note span we add later). */
      if (e.target.closest('button,select,input,a,textarea')) return;
      const fs = legend.parentElement;
      if (fs && fs.tagName === 'FIELDSET') fs.classList.toggle('collapsed');
    });
  }
}
function setAllCollapsed(c){
  document.querySelectorAll('#airAppHost section.air-card').forEach(s=>s.classList.toggle('collapsed', c));
  document.querySelectorAll('#airAppHost fieldset').forEach(fs=>fs.classList.toggle('collapsed', c));
}

/* ---------- initial state ---------- */
let initialized=false;
function initForm(){
  if(!document.getElementById('airForm')) return;
  populateShopSelect();
  addSample(); addBlank();
  showTab('sample1');
  fillSegSelect(); fillProcessSelects();
  populateCOCClients();
  refreshTWA();
  applyPrefill();
  syncCOCDefaults(false);
  updateCOCPreview();
  initCollapsible();
  /* Re-populate equipment pickers — the addSample() call above ran before the
     noise app may have hydrated window.equipment from localStorage. */
  refreshEquipPickers();
  initialized=true;
}

/* Public API exposed on window.Air */
window.Air = Object.assign(window.Air||{}, {
  // tab + view
  onShopChange, addSample, addBlank, setAllCollapsed,
  // equipment-library pickers (called from index.html and per-sample handlers)
  refreshEquipPickers, onAirPumpPick, onAirCalPick,
  // sample panel callbacks
  onChem, onType, onMethod, onAnalyteSelect,
  addMvRow, calcMvRow, onMvNameInput, onMvOelInput,
  calcCal, calcSample, calcGrav,
  addAnalyte, onNameInput, onOelInput, calcAnalytes,
  // blank panel callbacks
  onBlankChem, onBlankMethod,
  // TWA + OEL
  refreshTWA, setOel, onOelBasis,
  // save/load/example/reset/print
  saveSession, loadExample, onLoadFile, resetForm, printForm, printOfficialForm,
  // COC
  syncCOCDefaults, generateCOC, onReportToPick, onInvoiceToPick,
  // init hook (called by showView)
  init: initForm
});

document.addEventListener('DOMContentLoaded', function(){
  if(!initialized) initForm();
});
})();
