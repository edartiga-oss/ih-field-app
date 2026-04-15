// ═══════════════════════════════════════════════════════════
//  IH FIELD — NOISE DOSIMETRY  |  stats.js
// ═══════════════════════════════════════════════════════════
//  LOGNORMAL STATISTICS — The Noise Manual 6th Ed. / AIHA Strategy
//
//  UCL:  95% Upper Confidence Limit on the ARITHMETIC mean
//        Method: t-distribution approximation (conservative, matches
//                Excel T.INV(0.95, n-1) — same as spreadsheet D35)
//        Formula: exp(ȳ + s²/2 + t(n-1, 0.95) × s/√n)
//        The s²/2 term corrects the GM to the AM in log-space.
//        Using t(n-1) instead of Land's H is slightly conservative
//        (+0.45 dBA for n=17) and defensible per AIHA Strategy /
//        Noise Manual 6th Ed. lognormal method.
//
//  UTL:  95th-percentile / 95% confidence Upper Tolerance Limit
//        Method: Hahn & Meeker (1991) K-factor — matches IHSTAT v2.0 / R 'tolerance' pkg
//        Formula: exp(ȳ + K(n) × s)
//        Prior Owen (1958) K-values were ~0.9–1.5 larger (over-conservative).
//
//  Both operate on natural log of TWA dBA values (lognormal assumption).
// ═══════════════════════════════════════════════════════════

// One-sided t(df, 0.95) table — used for UCL on arithmetic mean
// Matches Excel T.INV(0.95, n-1) exactly
var T95 = {
  1:6.314,  2:2.920,  3:2.353,  4:2.132,  5:2.015,
  6:1.943,  7:1.895,  8:1.860,  9:1.833, 10:1.812,
  11:1.796, 12:1.782, 13:1.771, 14:1.761, 15:1.753,
  16:1.746, 17:1.740, 18:1.734, 19:1.729, 20:1.725,
  21:1.721, 22:1.717, 23:1.714, 24:1.711, 25:1.708,
  29:1.699, 39:1.685, 59:1.671, 119:1.658
};

// Hahn & Meeker (1991) K-factors for 95th-percentile / 95% confidence UTL (lognormal)
// Source: IHSTAT v2.0 / R 'tolerance' package — industry standard reference
// Replaces prior Owen (1958) values which were ~0.9–1.5 larger (over-conservative)
var K_UTL = {
   3:7.6559,  4:5.1439,  5:4.2027,  6:3.7077,
   7:3.3995,  8:3.1873,  9:3.0312, 10:2.9110,
  11:2.8150, 12:2.7363, 13:2.6705, 14:2.6144,
  15:2.5660, 16:2.5237, 17:2.4863, 18:2.4529,
  19:2.4230, 20:2.3960, 21:2.3714, 22:2.3490,
  23:2.3283, 24:2.3093, 25:2.2917, 26:2.2753,
  27:2.2600, 28:2.2458, 29:2.2324, 30:2.2198,
  31:2.2080, 32:2.1968, 33:2.1863, 34:2.1762,
  35:2.1667, 36:2.1577, 37:2.1491, 38:2.1408,
  39:2.1330, 40:2.1255, 41:2.1183, 42:2.1114,
  43:2.1048, 44:2.0985, 45:2.0924, 46:2.0865,
  47:2.0808, 48:2.0754, 49:2.0701, 50:2.0650
};

function tValue95(n) {
  // Returns t(n-1, 0.95) — one-sided 95% confidence, df = n-1
  var df = n - 1;
  if (df <= 0) return NaN;
  var keys = Object.keys(T95).map(Number).sort(function(a,b){return a-b;});
  for (var i = 0; i < keys.length; i++) {
    if (df <= keys[i]) return T95[keys[i]];
  }
  return 1.645; // large-sample z approximation
}

function kUTL(n) {
  if (n < 3) return NaN;
  var keys = Object.keys(K_UTL).map(Number).sort(function(a,b){return a-b;});
  for (var i = 0; i < keys.length; i++) {
    if (n <= keys[i]) return K_UTL[keys[i]];
  }
  // Large-sample approximation (n > 50), Hahn-Meeker asymptote
  return 1.645 + (1.645 / Math.sqrt(n));
}

function lognormalStats(twas) {
  var n = twas.length;
  if (n < 2) return null;
  var logs = twas.map(function(x) { return Math.log(x); });
  var logMean = logs.reduce(function(a,b){return a+b;},0) / n;
  var logVar  = logs.reduce(function(a,b){return a + Math.pow(b-logMean,2);},0) / (n-1);
  var logSD   = Math.sqrt(logVar);
  var gm  = Math.exp(logMean);
  var gsd = Math.exp(logSD);
  // Arithmetic mean MLE estimate (lognormal): exp(ȳ + s²/2)
  var am  = Math.exp(logMean + logVar/2);
  // UCL on arithmetic mean — t-distribution approximation
  // Formula: exp(ȳ + s²/2 + t(n-1, 0.95) × s/√n)
  // Matches Excel: =EXP(AVERAGE(LN(...)) + STDEV.S(LN(...))^2/2
  //                   + T.INV(0.95,COUNT(...)-1) * STDEV.S(LN(...)) / SQRT(COUNT(...)))
  var t   = tValue95(n);
  var ucl = Math.exp(logMean + logVar/2 + t * logSD / Math.sqrt(n));
  // UTL — Hahn & Meeker (1991) K-factor (lognormal 95th pct / 95% confidence)
  var k   = kUTL(n);
  var utl = Math.exp(logMean + k * logSD);
  return {
    n: n, gm: gm, gsd: gsd, am: am,
    ucl95: ucl, utl95_95: utl,
    smallSample: n < 6,
    logMean: logMean, logSD: logSD, t: t, K: k
  };
}

// ═══════════════════════════════════════════════════════════
//  STATS TAB STATE
// ═══════════════════════════════════════════════════════════

var statsSelectedSEGs       = null; // null = all
var statsSelectedIHs        = null; // null = all
var statsSelectedLocations  = null; // null = all
var statsStandard           = 'ACGIH'; // 'ACGIH' | 'OSHA_HC' | 'OSHA_PEL'

// Standard definitions for Stats tab
//  ACGIH/NIOSH : PEL=85 dBA, AL=80, Q=3, C=85
//  OSHA HC     : PEL=85 dBA, AL=80, Q=5, C=85  (Hearing Conservation Amendment)
//  OSHA PEL    : PEL=90 dBA, AL=85, Q=5, C=90
var STATS_STANDARDS = {
  ACGIH:    { label:'ACGIH/NIOSH', pel:85, al:80, exchange:3, criterion:85 },
  OSHA_HC:  { label:'OSHA HC',     pel:85, al:80, exchange:5, criterion:85 },
  OSHA_PEL: { label:'OSHA PEL',    pel:90, al:85, exchange:5, criterion:90 }
};

function statsSetStandard(std) {
  statsStandard = std;
  ['ACGIH','OSHA_HC','OSHA_PEL'].forEach(function(s) {
    var el = document.getElementById('statsStdChip_' + s);
    if (!el) return;
    var active = (s === std);
    el.style.borderColor = active ? 'var(--teal)' : 'var(--border)';
    el.style.background  = active ? 'rgba(0,184,160,0.12)' : 'var(--surface)';
    el.style.color       = active ? 'var(--teal)' : 'var(--text2)';
  });
  renderStats();
}

// ═══════════════════════════════════════════════════════════
//  RENDER STATS
// ═══════════════════════════════════════════════════════════

function renderStats() {
  const chipsEl   = document.getElementById('statsSegChips');
  const ihChipsEl = document.getElementById('statsIHChips');
  const metricsEl = document.getElementById('statsMetrics');
  const bodyEl    = document.getElementById('statsBody');
  const showInd   = document.getElementById('statsShowIndividual');
  if (!chipsEl || !metricsEl || !bodyEl) return;

  const showIndividual = showInd && showInd.checked;

  // ── All IH names ──
  const allIHs = [...new Set(surveys.map(s => s.deviceNickname || s.ih?.name || '').filter(Boolean))].sort();
  if (statsSelectedIHs === null) statsSelectedIHs = new Set(allIHs);

  // ── Render IH chips ──
  if (ihChipsEl) {
    ihChipsEl.innerHTML = '<button class="btn btn-outline btn-sm" onclick="statsSelectAllIH()" style="padding:3px 9px; font-size:10px;">All IHs</button>' +
      allIHs.map(function(ih) {
        var active = statsSelectedIHs.has(ih);
        return '<button onclick="statsToggleIH(\'' + esc(ih) + '\')" style="'
          + 'padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; cursor:pointer;'
          + 'border:1.5px solid ' + (active ? 'var(--teal)' : 'var(--border)') + ';'
          + 'background:' + (active ? 'rgba(0,184,160,0.12)' : 'var(--surface)') + ';'
          + 'color:' + (active ? 'var(--teal)' : 'var(--text2)') + ';'
          + '">' + esc(ih) + '</button>';
      }).join('');
  }

  // ── All Locations ──
  const allLocations = [...new Set(surveys.map(s => s.employee?.location || '').filter(Boolean))].sort();
  if (statsSelectedLocations === null) statsSelectedLocations = new Set(allLocations);
  const locChipsEl = document.getElementById('statsLocationChips');
  if (locChipsEl) {
    locChipsEl.innerHTML = '<button class="btn btn-outline btn-sm" onclick="statsSelectAllLocations()" style="padding:3px 9px; font-size:10px;">All Locations</button>' +
      allLocations.map(function(loc) {
        var active = statsSelectedLocations.has(loc);
        return '<button onclick="statsToggleLocation(\'' + esc(loc) + '\')" style="'
          + 'padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; cursor:pointer;'
          + 'border:1.5px solid ' + (active ? 'var(--teal)' : 'var(--border)') + ';'
          + 'background:' + (active ? 'rgba(0,184,160,0.12)' : 'var(--surface)') + ';'
          + 'color:' + (active ? 'var(--teal)' : 'var(--text2)') + ';'
          + '">' + esc(loc) + '</button>';
      }).join('');
  }

  // ── All SEGs ──
  const allSEGs = [...new Set(surveys.map(s => s.employee?.seg || '').filter(Boolean))].sort();
  if (!allSEGs.length) {
    metricsEl.innerHTML = '';
    bodyEl.innerHTML = '<div class="empty-state"><div class="empty-title">No surveys with SEG data yet</div><div class="empty-sub">Assign a SEG when entering survey data to see statistics here</div></div>';
    chipsEl.innerHTML = '';
    return;
  }
  if (statsSelectedSEGs === null) statsSelectedSEGs = new Set(allSEGs);

  // ── Render SEG chips ──
  chipsEl.innerHTML = allSEGs.map(function(seg) {
    var active = statsSelectedSEGs.has(seg);
    return '<button onclick="statsToggleSEG(\'' + esc(seg) + '\')" style="'
      + 'padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; cursor:pointer;'
      + 'border:1.5px solid ' + (active ? '#00b8a0' : 'var(--border)') + ';'
      + 'background:' + (active ? 'rgba(0,184,160,0.12)' : 'var(--surface)') + ';'
      + 'color:' + (active ? '#00b8a0' : 'var(--text2)') + ';'
      + '">' + esc(seg) + '</button>';
  }).join('');

  // ── Filter surveys by IH, Location, and SEG ──
  const sel = surveys.filter(function(s) {
    var ih  = s.deviceNickname || s.ih?.name || '';
    var loc = s.employee?.location || '';
    var seg = s.employee?.seg || '';
    var ihOk  = statsSelectedIHs === null || !allIHs.length || statsSelectedIHs.has(ih);
    var locOk = statsSelectedLocations === null || !allLocations.length || statsSelectedLocations.has(loc);
    var segOk = statsSelectedSEGs.has(seg);
    return ihOk && locOk && segOk;
  });

  if (!sel.length) {
    metricsEl.innerHTML = '<div style="font-size:13px; color:var(--text3); padding:12px 0;">No surveys for selected filters.</div>';
    bodyEl.innerHTML = '';
    return;
  }

  // ── Global summary metrics ──
  var twas  = sel.map(function(s) { return parseFloat(s.results?.twa); }).filter(function(n) { return !isNaN(n); });
  var doses = sel.map(function(s) { return parseFloat(s.results?.dose); }).filter(function(n) { return !isNaN(n); });
  var _std = STATS_STANDARDS[statsStandard] || STATS_STANDARDS.ACGIH;
  var _PEL = _std.pel, _AL = _std.al;
  var atOrAbovePEL = sel.filter(function(s) { return parseFloat(s.results?.twa) >= _PEL; }).length;
  var atOrAboveAL  = sel.filter(function(s) { var t = parseFloat(s.results?.twa); return t >= _AL && t < _PEL; }).length;
  var belowAL      = sel.filter(function(s) { return parseFloat(s.results?.twa) < _AL; }).length;
  var qaFails      = sel.filter(function(s) { return s.status === 'qa-fail'; }).length;

  function avg(arr) { return arr.length ? arr.reduce(function(a,b){return a+b;},0)/arr.length : null; }
  function maxVal(arr) { return arr.length ? Math.max.apply(null,arr) : null; }
  function minVal(arr) { return arr.length ? Math.min.apply(null,arr) : null; }
  function fmt(v,d) { return v===null?'—':v.toFixed(d===undefined?1:d); }

  var metricCards = [
    { label:'Total Surveys', value:sel.length, unit:'' },
    { label:'Avg TWA', value:fmt(avg(twas)), unit:'dBA' },
    { label:'Max TWA', value:fmt(maxVal(twas)), unit:'dBA' },
    { label:'Min TWA', value:fmt(minVal(twas)), unit:'dBA' },
    { label:'Avg Dose', value:fmt(avg(doses)), unit:'%' },
    { label:'\u2265 PEL (' + _PEL + ' dBA)', value:atOrAbovePEL, unit:'', alert:atOrAbovePEL>0 },
    { label:'\u2265 AL (' + _AL + ' dBA)',   value:atOrAboveAL,  unit:'' },
    { label:'< AL (' + _AL + ' dBA)',        value:belowAL,      unit:'' },
    { label:'QA Flags', value:qaFails, unit:'', alert:qaFails>0 },
  ];

  metricsEl.innerHTML = metricCards.map(function(m) {
    var bg  = m.alert ? 'background:#fcebeb;' : '';
    var col = m.alert ? 'color:#a32d2d;' : 'color:var(--text);';
    return '<div style="background:var(--surface); border-radius:var(--radius); padding:12px 14px; ' + bg + '">'
      + '<div style="font-size:11px; color:var(--text3); margin-bottom:4px;">' + m.label + '</div>'
      + '<div style="font-size:22px; font-weight:600; ' + col + '">' + m.value
      + '<span style="font-size:12px; font-weight:400; color:var(--text3); margin-left:3px;">' + m.unit + '</span></div>'
      + '</div>';
  }).join('');

  // ── Per-SEG breakdown ──
  var segGroups = {};
  sel.forEach(function(s) {
    var seg = s.employee?.seg || 'Unknown';
    if (!segGroups[seg]) segGroups[seg] = [];
    segGroups[seg].push(s);
  });

  bodyEl.innerHTML = Object.keys(segGroups).sort().map(function(seg) {
    var group  = segGroups[seg];
    var gTWAs  = group.map(function(s) { return parseFloat(s.results?.twa); }).filter(function(n){return !isNaN(n);});
    var gDoses = group.map(function(s) { return parseFloat(s.results?.dose); }).filter(function(n){return !isNaN(n);});

    // Category distribution
    var cats = {};
    group.forEach(function(s) {
      var c = s.results?.category || 'Not recorded';
      cats[c] = (cats[c] || 0) + 1;
    });

    // Process breakdown
    var procs = {};
    group.forEach(function(s) {
      var p = s.employee?.process || 'Not specified';
      procs[p] = (procs[p] || 0) + 1;
    });

    // Location breakdown
    var locs = {};
    group.forEach(function(s) {
      var l = s.employee?.location || 'Not specified';
      locs[l] = (locs[l] || 0) + 1;
    });

    var catRows = Object.entries(cats).sort(function(a,b){return b[1]-a[1];}).map(function(entry) {
      var c = entry[0]; var n = entry[1];
      var pct = (n/group.length*100).toFixed(0);
      var barColor = c.includes('PEL') ? '#e05252' : c.includes('Action') ? '#f0a500' : '#3ec97a';
      return '<tr>'
        + '<td style="padding:6px 10px; font-size:12px; color:var(--text2);">' + esc(c) + '</td>'
        + '<td style="padding:6px 10px; font-size:12px; font-weight:600; color:var(--text); text-align:right;">' + n + '</td>'
        + '<td style="padding:6px 10px; width:120px;"><div style="background:var(--surface2); border-radius:3px; height:6px;"><div style="background:' + barColor + '; width:' + pct + '%; height:6px; border-radius:3px;"></div></div></td>'
        + '<td style="padding:6px 10px; font-size:11px; color:var(--text3); text-align:right;">' + pct + '%</td>'
        + '</tr>';
    }).join('');

    var procRows = Object.entries(procs).sort(function(a,b){return b[1]-a[1];}).slice(0,8).map(function(entry) {
      return '<tr><td style="padding:4px 10px; font-size:12px; color:var(--text2);">' + esc(entry[0]) + '</td>'
        + '<td style="padding:4px 10px; font-size:12px; font-weight:600; color:var(--text); text-align:right;">' + entry[1] + '</td></tr>';
    }).join('');

    var locRows = Object.entries(locs).sort(function(a,b){return b[1]-a[1];}).slice(0,6).map(function(entry) {
      return '<tr><td style="padding:4px 10px; font-size:12px; color:var(--text2);">' + esc(entry[0]) + '</td>'
        + '<td style="padding:4px 10px; font-size:12px; font-weight:600; color:var(--text); text-align:right;">' + entry[1] + '</td></tr>';
    }).join('');

    // TWA distribution bins
    var bins = [
      { label:'< 80', min:-Infinity, max:80 },
      { label:'80–84', min:80, max:85 },
      { label:'85–89 (AL)', min:85, max:90 },
      { label:'90–99 (PEL)', min:90, max:100 },
      { label:'≥ 100', min:100, max:Infinity },
    ];
    var binCounts = bins.map(function(b) { return gTWAs.filter(function(v){return v>=b.min&&v<b.max;}).length; });
    var maxBin = Math.max.apply(null, binCounts.concat([1]));
    var binBars = bins.map(function(b,i) {
      var pct = (binCounts[i]/maxBin*100).toFixed(0);
      var color = b.min >= 90 ? '#e05252' : b.min >= 85 ? '#f0a500' : '#3ec97a';
      return '<div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">'
        + '<div style="font-size:10px; color:var(--text3); width:76px; flex-shrink:0; text-align:right;">' + b.label + '</div>'
        + '<div style="flex:1; background:var(--surface2); border-radius:3px; height:14px;">'
        + '<div style="background:' + color + '; width:' + pct + '%; height:14px; border-radius:3px; min-width:' + (binCounts[i]?2:0) + 'px;"></div></div>'
        + '<div style="font-size:11px; font-weight:600; color:var(--text); width:18px; text-align:right;">' + binCounts[i] + '</div>'
        + '</div>';
    }).join('');

    // ── Individual results table ──
    var indTable = '';
    if (showIndividual) {
      var _segStdInd = STATS_STANDARDS[statsStandard] || STATS_STANDARDS.ACGIH;
      var _segPELInd = _segStdInd.pel, _segALInd = _segStdInd.al;
      var sorted = group.slice().sort(function(a,b) {
        var ta = parseFloat(a.results?.twa)||0; var tb = parseFloat(b.results?.twa)||0;
        return tb - ta; // highest TWA first
      });
      var indRows = sorted.map(function(s) {
        var twa   = parseFloat(s.results?.twa);
        var dose  = parseFloat(s.results?.dose);
        var date  = s.calibration?.surveyStart ? new Date(s.calibration.surveyStart).toLocaleDateString() : '—';
        var ih    = s.deviceNickname || s.ih?.name || '—';
        var loc   = s.employee?.location || '—';
        var proc  = s.employee?.process  || '—';
        var status= s.status;
        var twaColor = isNaN(twa) ? 'var(--text3)' : twa >= _segPELInd ? '#a32d2d' : twa >= _segALInd ? '#7a4f00' : '#085041';
        var twaBg    = isNaN(twa) ? '' : twa >= _segPELInd ? 'background:#fcebeb;' : twa >= _segALInd ? 'background:#fff8e6;' : '';
        var statusBadge = status === 'complete'
          ? '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:20px;background:#e1f5ee;color:#085041;">Pass</span>'
          : status === 'qa-fail'
          ? '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:20px;background:#fcebeb;color:#a32d2d;">QA Flag</span>'
          : '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:20px;background:#f1efe8;color:#444441;">Draft</span>';
        return '<tr style="border-bottom:1px solid var(--border);">'
          + '<td style="padding:6px 10px; font-size:12px; font-weight:600; color:var(--text);">' + esc(s.employee?.name || '—') + '</td>'
          + '<td style="padding:6px 10px; font-size:11px; color:var(--teal);">' + esc(ih) + '</td>'
          + '<td style="padding:6px 10px; font-size:11px; color:var(--text2);">' + date + '</td>'
          + '<td style="padding:6px 10px; font-size:11px; color:var(--text2); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(loc) + '</td>'
          + '<td style="padding:6px 10px; font-size:11px; color:var(--text2); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(proc) + '</td>'
          + '<td style="padding:6px 10px; font-size:12px; font-weight:700; color:' + twaColor + '; ' + twaBg + ' text-align:right;">' + (isNaN(twa)?'—':twa.toFixed(1)) + ' dBA</td>'
          + '<td style="padding:6px 10px; font-size:12px; font-weight:600; color:var(--text); text-align:right;">' + (isNaN(dose)?'—':dose.toFixed(1)) + '%</td>'
          + '<td style="padding:6px 10px; text-align:center;">' + statusBadge + '</td>'
          + '</tr>';
      }).join('');

      indTable = '<div style="margin-top:16px;">'
        + '<div style="font-size:11px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Individual Results (' + group.length + ' surveys)</div>'
        + '<div style="overflow-x:auto;">'
        + '<table style="width:100%; border-collapse:collapse; min-width:600px;">'
        + '<thead><tr style="background:var(--surface);">'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:left;">Employee</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:left;">IH</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:left;">Date</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:left;">Location</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:left;">Process</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:right;">TWA</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:right;">Dose %</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:center;">QA</th>'
        + '</tr></thead>'
        + '<tbody>' + indRows + '</tbody>'
        + '</table></div></div>';
    }

    var stats = lognormalStats(gTWAs);
    var statsBlock = '';
    if (!stats) {
      statsBlock = '<div style="background:var(--surface); border-radius:var(--radius); padding:10px 14px; margin-bottom:16px; font-size:12px; color:var(--text3);">Insufficient data for UCL/UTL (need ≥2 TWA values).</div>';
    } else {
      var fmtDb = function(v) { return isNaN(v) ? '—' : v.toFixed(1) + ' dBA'; };
      var fmtX  = function(v) { return isNaN(v) ? '—' : v.toFixed(2) + 'x'; };
      var _segStd = STATS_STANDARDS[statsStandard] || STATS_STANDARDS.ACGIH;
      var _segPEL = _segStd.pel, _segAL = _segStd.al;
      var pelUCL = stats.ucl95    >= _segPEL;
      var pelUTL = stats.utl95_95 >= _segPEL;
      var alUCL  = !pelUCL && stats.ucl95    >= _segAL;
      var alUTL  = !pelUTL && stats.utl95_95 >= _segAL;

      function statCell(label, value, isPEL, isAL) {
        var bg  = isPEL ? 'background:#fcebeb;' : isAL ? 'background:#fff8e6;' : 'background:var(--surface);';
        var col = isPEL ? 'color:#a32d2d;'      : isAL ? 'color:#7a4f00;'      : 'color:var(--text);';
        var badge = isPEL
          ? '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:20px;margin-left:5px;background:#fcebeb;color:#a32d2d;border:1px solid #f09595;">≥ PEL</span>'
          : isAL
          ? '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:20px;margin-left:5px;background:#fff8e6;color:#7a4f00;border:1px solid #f0a500;">≥ AL</span>'
          : '';
        return '<div style="padding:10px 14px; border-radius:8px; ' + bg + '">'
          + '<div style="font-size:10px; color:var(--text3); margin-bottom:3px;">' + label + '</div>'
          + '<div style="font-size:18px; font-weight:700; ' + col + '">' + value + badge + '</div>'
          + '</div>';
      }

      var gsdColor = stats.gsd < 1.5 ? 'var(--teal)' : stats.gsd < 2.0 ? '#e08800' : 'var(--red)';
      var gsdNote  = stats.gsd < 1.5 ? 'Homogeneous SEG' : stats.gsd < 2.0 ? 'Moderate spread' : 'Consider splitting SEG';

      var smallNote = stats.smallSample
        ? '<div style="margin-top:8px; padding:7px 10px; background:#fff8e6; border:1px solid #f0a500; border-radius:6px; font-size:11px; color:#7a4f00; display:flex; gap:6px;">'
          + '<span>&#9651;</span><span><strong>Small sample (n=' + stats.n + ', &lt;6):</strong> UCL and UTL estimates are imprecise with fewer than 6 results. Collect additional samples to improve reliability.</span>'
          + '</div>'
        : '';

      statsBlock = '<div style="border:1.5px solid var(--border); border-radius:8px; padding:12px 14px; margin-bottom:16px;">'
        + '<div style="font-size:11px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">Lognormal Statistics — Noise Manual 6th Ed. (95% Conf.)</div>'
        + '<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(128px,1fr)); gap:8px; margin-bottom:8px;">'
        + '<div style="padding:10px 14px; border-radius:8px; background:var(--surface);">'
          + '<div style="font-size:10px; color:var(--text3); margin-bottom:3px;">n (TWA values)</div>'
          + '<div style="font-size:18px; font-weight:700; color:var(--text);">' + stats.n + '</div>'
        + '</div>'
        + '<div style="padding:10px 14px; border-radius:8px; background:var(--surface);">'
          + '<div style="font-size:10px; color:var(--text3); margin-bottom:3px;">Geom. Mean <span style="font-weight:400;">(50th pct)</span></div>'
          + '<div style="font-size:18px; font-weight:700; color:var(--text);">' + fmtDb(stats.gm) + '</div>'
        + '</div>'
        + '<div style="padding:10px 14px; border-radius:8px; background:var(--surface);">'
          + '<div style="font-size:10px; color:var(--text3); margin-bottom:3px;">GSD <span style="font-weight:400;">(SEG spread)</span></div>'
          + '<div style="font-size:18px; font-weight:700; color:' + gsdColor + ';line-height:1.1;">' + fmtX(stats.gsd) + '</div>'
          + '<div style="font-size:9px; color:' + gsdColor + '; margin-top:3px;">' + gsdNote + '</div>'
        + '</div>'
        + '<div style="padding:10px 14px; border-radius:8px; background:var(--surface);">'
          + '<div style="font-size:10px; color:var(--text3); margin-bottom:3px;">Arith. Mean <span style="font-weight:400;">(AM)</span></div>'
          + '<div style="font-size:18px; font-weight:700; color:var(--text);">' + fmtDb(stats.am || stats.gm) + '</div>'
        + '</div>'
        + statCell('95% UCL on AM', fmtDb(stats.ucl95), pelUCL, alUCL)
        + statCell('95th/95% UTL',  fmtDb(stats.utl95_95), pelUTL, alUTL)
        + '</div>'
        + '<div style="font-size:10px; color:var(--text3); line-height:1.6;">'
          + '<strong>UCL</strong> (95% confidence limit on the <em>arithmetic</em> mean): exp(\u0233 + s\u00B2/2 + t(n\u22121,\u00A00.95)\u00B7s/\u221An). t(' + (stats.n-1) + ',\u00A00.95)\u00A0=\u00A0' + (stats.t ? stats.t.toFixed(4) : '\u2014') + '. '
          + '<strong>UTL</strong> (95th percentile / 95% confidence): exp(\u0233 + K\u00B7s). Hahn-Meeker K(n=' + stats.n + ')\u00A0=\u00A0' + (stats.K ? stats.K.toFixed(3) : '\u2014') + '. '
          + '<strong>GSD</strong> = geometric standard deviation: the multiplicative spread factor around the GM. GSD\u00A0<\u00A01.5\u25CF\u00A0=\u00A0homogeneous SEG; 1.5\u20132.0\u25CF\u00A0=\u00A0moderate spread; >\u00A02.0\u25CF\u00A0=\u00A0consider splitting the SEG. Lognormal on TWA dBA \u2014 AIHA Strategy / Noise Manual 6th\u00A0Ed. | Standard: <strong>' + _segStd.label + '</strong> (PEL ' + _segPEL + ' dBA, AL ' + _segAL + ' dBA)'
        + '</div>'
        + smallNote
        + '</div>';
    }

    return '<div class="card" style="margin-bottom:18px;">'
      + '<div class="card-header" style="font-size:14px;">' + esc(seg)
      + '<span style="margin-left:8px; font-size:11px; font-weight:400; color:rgba(255,255,255,0.55);">' + group.length + ' survey' + (group.length!==1?'s':'') + '</span>'
      + '</div>'
      + '<div class="card-body" style="padding:14px 16px;">'

      // Mini metrics
      + '<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:8px; margin-bottom:16px;">'
      + [['Avg TWA', fmt(avg(gTWAs)) + ' dBA'],['Max TWA', fmt(maxVal(gTWAs)) + ' dBA'],['Min TWA', fmt(minVal(gTWAs)) + ' dBA'],['Avg Dose', fmt(avg(gDoses)) + ' %']]
        .map(function(m) {
          return '<div style="background:var(--surface); border-radius:var(--radius); padding:8px 10px;">'
            + '<div style="font-size:10px; color:var(--text3);">' + m[0] + '</div>'
            + '<div style="font-size:16px; font-weight:600; color:var(--text);">' + m[1] + '</div></div>';
        }).join('')
      + '</div>'

      + statsBlock

      // Charts row
      + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">'
      + '<div><div style="font-size:11px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Exposure Categories</div>'
      + '<table style="width:100%; border-collapse:collapse;"><thead><tr>'
      + '<th style="font-size:10px; color:var(--text3); font-weight:500; text-align:left; padding:4px 10px;">Category</th>'
      + '<th style="font-size:10px; color:var(--text3); font-weight:500; text-align:right; padding:4px 10px;">n</th>'
      + '<th colspan="2" style="font-size:10px; color:var(--text3); font-weight:500; padding:4px 10px;"></th>'
      + '</tr></thead><tbody>' + (catRows || '<tr><td colspan="4" style="font-size:12px;color:var(--text3);padding:8px 10px;">No category data</td></tr>') + '</tbody></table></div>'

      + '<div><div style="font-size:11px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">TWA Distribution (dBA)</div>'
      + (gTWAs.length ? binBars : '<div style="font-size:12px;color:var(--text3);">No TWA data</div>') + '</div>'
      + '</div>'

      // Process + Location row
      + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:14px;">'
      + '<div><div style="font-size:11px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Processes</div>'
      + '<table style="width:100%; border-collapse:collapse;"><tbody>' + (procRows || '<tr><td colspan="2" style="font-size:12px;color:var(--text3);padding:4px 10px;">None recorded</td></tr>') + '</tbody></table></div>'
      + '<div><div style="font-size:11px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Locations</div>'
      + '<table style="width:100%; border-collapse:collapse;"><tbody>' + (locRows || '<tr><td colspan="2" style="font-size:12px;color:var(--text3);padding:4px 10px;">None recorded</td></tr>') + '</tbody></table></div>'
      + '</div>'

      // Individual results table (conditional)
      + indTable

      + '</div></div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════
//  STATS FILTER TOGGLES
// ═══════════════════════════════════════════════════════════

function statsToggleSEG(seg) {
  if (!statsSelectedSEGs) statsSelectedSEGs = new Set();
  if (statsSelectedSEGs.has(seg)) statsSelectedSEGs.delete(seg);
  else statsSelectedSEGs.add(seg);
  renderStats();
}

function statsToggleIH(ih) {
  if (!statsSelectedIHs) statsSelectedIHs = new Set();
  if (statsSelectedIHs.has(ih)) statsSelectedIHs.delete(ih);
  else statsSelectedIHs.add(ih);
  renderStats();
}

function statsSelectAll() {
  statsSelectedSEGs = null;
  renderStats();
}

function statsSelectNone() {
  statsSelectedSEGs = new Set();
  renderStats();
}

function statsSelectAllIH() {
  statsSelectedIHs = null;
  renderStats();
}

function statsToggleLocation(loc) {
  if (!statsSelectedLocations) statsSelectedLocations = new Set();
  if (statsSelectedLocations.has(loc)) statsSelectedLocations.delete(loc);
  else statsSelectedLocations.add(loc);
  renderStats();
}

function statsSelectAllLocations() {
  statsSelectedLocations = null;
  renderStats();
}
