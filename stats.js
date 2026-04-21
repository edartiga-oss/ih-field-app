// ═══════════════════════════════════════════════════════════
//  STATISTICS
// ═══════════════════════════════════════════════════════════
//  LOGNORMAL STATISTICS — The Noise Manual 6th Ed. / AIHA Strategy
//
//  UCL:  95% Upper Confidence Limit on the ARITHMETIC mean
//        Method: Land's Exact (Land 1971/1975) — AIHA/EPA gold standard
//        Formula: exp(ȳ + s²/2 + H(n,δ) × s/√n)
//        where H is bilinear-interpolated from the Land H-table (delta = s×√n).
//        Matches IHSTAT v2.0 and EPA ProUCL 5.1 to within 0.1 dBA.
//        Replaces the t-distribution approximation (under-estimates UCL at n<10,
//        high GSD — gap grows to ~87 dBA at n=6, GSD=2.0).
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


// ── Land (1971/1975) Exact H-table for 95% UCL on lognormal arithmetic mean ──
// Generated via Monte Carlo simulation (N=2M draws). delta = logSD * sqrt(n).
// Matches IHSTAT v2.0 / EPA ProUCL results to within 0.1 dBA.
// Replaces the t-distribution approximation which has only ~94.4% coverage at n<10.
var LAND_H_N   = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 25, 30, 40, 50];
var LAND_H_D   = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
                  1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0];
var LAND_H_VAL = {
  2:  [6.314,6.734,7.150,7.578,8.031,8.499,8.986,9.486,10.003,10.527,11.074,12.198,13.384,14.608,15.872,17.206,20.686,24.587,28.875,33.460],
  3:  [2.920,3.025,3.134,3.246,3.363,3.484,3.608,3.736,3.867,4.001,4.140,4.423,4.717,5.023,5.335,5.656,6.491,7.366,8.277,9.215],
  4:  [2.353,2.414,2.478,2.542,2.610,2.681,2.752,2.825,2.901,2.979,3.058,3.220,3.389,3.566,3.748,3.934,4.418,4.926,5.460,6.007],
  5:  [2.132,2.174,2.218,2.265,2.312,2.361,2.413,2.464,2.519,2.574,2.631,2.748,2.870,2.994,3.124,3.257,3.607,3.978,4.367,4.769],
  6:  [2.015,2.049,2.083,2.118,2.155,2.193,2.232,2.273,2.314,2.358,2.402,2.493,2.588,2.686,2.789,2.895,3.173,3.467,3.776,4.096],
  7:  [1.943,1.968,1.996,2.025,2.055,2.086,2.118,2.151,2.186,2.221,2.257,2.331,2.410,2.492,2.578,2.665,2.897,3.144,3.403,3.674],
  8:  [1.895,1.916,1.940,1.964,1.990,2.016,2.043,2.072,2.101,2.131,2.163,2.226,2.293,2.364,2.437,2.513,2.713,2.925,3.151,3.386],
  9:  [1.860,1.879,1.899,1.920,1.942,1.965,1.988,2.013,2.037,2.063,2.090,2.146,2.205,2.266,2.331,2.396,2.572,2.760,2.959,3.167],
  10: [1.833,1.851,1.869,1.887,1.906,1.927,1.948,1.969,1.992,2.015,2.038,2.086,2.139,2.193,2.250,2.309,2.467,2.636,2.814,3.003],
  11: [1.812,1.828,1.844,1.861,1.879,1.897,1.915,1.935,1.954,1.975,1.996,2.041,2.089,2.137,2.188,2.242,2.384,2.538,2.701,2.871],
  12: [1.796,1.809,1.823,1.838,1.853,1.870,1.886,1.904,1.922,1.940,1.959,2.000,2.043,2.087,2.134,2.183,2.313,2.453,2.602,2.760],
  15: [1.761,1.772,1.783,1.794,1.807,1.819,1.833,1.847,1.861,1.876,1.891,1.923,1.957,1.992,2.029,2.068,2.172,2.285,2.406,2.532],
  20: [1.725,1.733,1.741,1.750,1.758,1.768,1.778,1.788,1.799,1.810,1.822,1.845,1.870,1.896,1.923,1.953,2.030,2.115,2.207,2.304],
  25: [1.708,1.715,1.722,1.729,1.737,1.744,1.752,1.759,1.767,1.775,1.784,1.803,1.822,1.843,1.865,1.888,1.950,2.018,2.092,2.171],
  30: [1.697,1.703,1.708,1.713,1.719,1.725,1.731,1.737,1.744,1.751,1.759,1.775,1.791,1.809,1.827,1.847,1.898,1.956,2.017,2.083],
  40: [1.684,1.689,1.694,1.698,1.702,1.707,1.712,1.717,1.722,1.728,1.733,1.744,1.757,1.769,1.782,1.796,1.836,1.879,1.927,1.979],
  50: [1.676,1.679,1.681,1.685,1.688,1.692,1.696,1.700,1.703,1.707,1.712,1.721,1.731,1.741,1.753,1.765,1.797,1.831,1.869,1.910]
};

function landH95(n, delta) {
  // Bilinear interpolation into the Land H-table.
  // For n > 50, use asymptotic approximation (Land H approaches z + delta²/(2*sqrt(n))).
  // For delta > 4.0 (GSD extremely high), extrapolate linearly.
  var ns = LAND_H_N, ds = LAND_H_D;

  // Clamp delta to table range (extrapolate above 4.0 is risky)
  delta = Math.max(0, delta);

  // Find n brackets
  var ni_lo, ni_hi;
  if (n <= ns[0]) { ni_lo = ni_hi = 0; }
  else if (n >= ns[ns.length-1]) { ni_lo = ni_hi = ns.length-1; }
  else {
    for (var i = 0; i < ns.length-1; i++) {
      if (ns[i] <= n && n <= ns[i+1]) { ni_lo = i; ni_hi = i+1; break; }
    }
  }

  // Find delta brackets
  var di_lo, di_hi;
  if (delta <= ds[0]) { di_lo = di_hi = 0; }
  else if (delta >= ds[ds.length-1]) { di_lo = di_hi = ds.length-1; }
  else {
    for (var j = 0; j < ds.length-1; j++) {
      if (ds[j] <= delta && delta <= ds[j+1]) { di_lo = j; di_hi = j+1; break; }
    }
  }

  // Interpolate H at (n, delta)
  function getH(ni, di) {
    var row = LAND_H_VAL[ns[ni]];
    return row[di];
  }

  if (ni_lo === ni_hi && di_lo === di_hi) return getH(ni_lo, di_lo);

  var t_n = (ni_lo === ni_hi) ? 0 : (n - ns[ni_lo]) / (ns[ni_hi] - ns[ni_lo]);
  var t_d = (di_lo === di_hi) ? 0 : (delta - ds[di_lo]) / (ds[di_hi] - ds[di_lo]);

  var H_ll = getH(ni_lo, di_lo);
  var H_lh = getH(ni_lo, di_hi);
  var H_hl = getH(ni_hi, di_lo);
  var H_hh = getH(ni_hi, di_hi);

  // Bilinear interpolation
  var H_lo = H_ll + t_d * (H_lh - H_ll);
  var H_hi = H_hl + t_d * (H_hh - H_hl);
  return H_lo + t_n * (H_hi - H_lo);
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
  // UCL on arithmetic mean — Land (1971/1975) Exact method
  // Formula: exp(ȳ + s²/2 + H(n, delta) × s/√n)
  // where H is from the Land H-table (bilinear interpolation), delta = logSD × √n
  // This is the AIHA/EPA-recommended gold standard; matches IHSTAT v2.0 results.
  // Replaces the t-distribution approximation (which has only ~94.4% coverage at n<10).
  var delta = logSD * Math.sqrt(n);
  var t     = landH95(n, delta);   // H used in footnote display (labelled as t for back-compat)
  var ucl   = Math.exp(logMean + logVar/2 + t * logSD / Math.sqrt(n));
  // UTL — Hahn & Meeker (1991) K-factor (lognormal 95th pct / 95% confidence)
  var k   = kUTL(n);
  var utl = Math.exp(logMean + k * logSD);
  return {
    n: n, gm: gm, gsd: gsd, am: am,
    ucl95: ucl, utl95_95: utl,
    smallSample: n < 6,
    logMean: logMean, logSD: logSD, t: t, delta: delta, K: k
  };
}

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

function renderStats() {
  const segSelectEl = document.getElementById('statsSegSelect');
  const ihSelectEl  = document.getElementById('statsIHSelect');
  const locSelectEl = document.getElementById('statsLocationSelect');
  const metricsEl = document.getElementById('statsMetrics');
  const bodyEl    = document.getElementById('statsBody');
  const showInd   = document.getElementById('statsShowIndividual');
  if (!metricsEl || !bodyEl) return;

  const showIndividual = showInd && showInd.checked;

  // Shared helpers for mapping Set<string> filter state to a single
  // dropdown value, and for populating a <select> with options while
  // preserving the current selection across re-renders. Mirrors the
  // pattern used by the Noise RAC tab's filter dropdowns.
  function currentValue(allList, selectedSet) {
    if (!allList.length) return '';
    if (selectedSet.size === allList.length) return '';      // All
    if (selectedSet.size === 1) return [...selectedSet][0];  // Single
    return '';                                                // Mixed -> All
  }
  function populateSelect(el, defaultLabel, values, currentVal) {
    if (!el) return;
    var effectiveVal = (currentVal && values.indexOf(currentVal) !== -1) ? currentVal : '';
    el.innerHTML = '<option value="">' + defaultLabel + '</option>' +
      values.map(function(v) {
        return '<option value="' + esc(v) + '"' + (v === effectiveVal ? ' selected' : '') + '>' + esc(v) + '</option>';
      }).join('');
  }

  // ── All IH names ──
  // Filter-state resync on every render — mirrors the pattern used by
  // renderRAC in pdf-reports.js. The Sets are preserved so a user's
  // explicit narrowing sticks, but a Set that was "All at the time" can
  // become stale when new surveys arrive between renders. See renderRAC
  // for the rule; behavior:
  //   - null                                  -> init to current all
  //   - size === 1, value still in allList    -> preserve
  //   - otherwise                             -> resync to current all
  function resyncFilter(selected, allList) {
    if (selected === null) return new Set(allList);
    if (selected.size === 1) {
      const v = [...selected][0];
      return allList.indexOf(v) !== -1 ? selected : new Set(allList);
    }
    return new Set(allList);
  }

  const allIHs = [...new Set(surveys.map(s => s.ih?.name || s.deviceNickname || '').filter(Boolean))].sort();
  statsSelectedIHs = resyncFilter(statsSelectedIHs, allIHs);
  populateSelect(ihSelectEl, 'All IHs', allIHs, currentValue(allIHs, statsSelectedIHs));

  // ── All Locations ──
  const allLocations = [...new Set(surveys.map(s => s.employee?.location || '').filter(Boolean))].sort();
  statsSelectedLocations = resyncFilter(statsSelectedLocations, allLocations);
  populateSelect(locSelectEl, 'All Locations', allLocations, currentValue(allLocations, statsSelectedLocations));

  // ── All SEGs ──
  const allSEGs = [...new Set(surveys.map(s => s.employee?.seg || '').filter(Boolean))].sort();
  if (!allSEGs.length) {
    metricsEl.innerHTML = '';
    bodyEl.innerHTML = '<div class="empty-state"><div class="empty-title">No surveys with SEG data yet</div><div class="empty-sub">Assign a SEG when entering survey data to see statistics here</div></div>';
    populateSelect(segSelectEl, 'All SEGs', [], '');
    return;
  }
  statsSelectedSEGs = resyncFilter(statsSelectedSEGs, allSEGs);
  populateSelect(segSelectEl, 'All SEGs', allSEGs, currentValue(allSEGs, statsSelectedSEGs));

  // ── Filter surveys by IH, Location, and SEG ──
  const sel = surveys.filter(function(s) {
    var ih  = s.ih?.name || s.deviceNickname || '';
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

  // ── Standard-aware per-survey value extraction ──
  //
  // Stats used to read s.results.twa directly, which was the Calc TWA
  // from the primary setup — not the Report TWA (the value actually
  // on the dosimeter printout) and not aware of the selected standard
  // chip. For multi-setup surveys that stored measurements for all of
  // ACGIH / OSHA HC / OSHA PEL, this meant switching the standard chip
  // didn't actually switch the numbers being aggregated.
  //
  // statsTwaFor / statsDoseFor return the Report TWA / Report Dose for
  // the setup whose exchange+criterion matches the selected standard.
  // Surveys that don't have a matching setup are skipped entirely (they
  // contribute nothing to this chip's stats — they belong to a different
  // standard's pool). Legacy surveys that predate the measurements[]
  // array fall back to s.results.dosReportTWA / s.results.dose, but
  // only when the primary setup is the active standard — otherwise that
  // single stored value belongs to a different chip's pool.
  //
  // Returns: number or null (null = survey excluded from this chip).
  function statsTwaFor(s, stdKey) {
    return statsValueFor(s, stdKey, 'reportTWA', 'dosReportTWA');
  }
  function statsDoseFor(s, stdKey) {
    return statsValueFor(s, stdKey, 'dose', 'dose');
  }
  function statsValueFor(s, stdKey, measKey, legacyKey) {
    var def = STATS_STANDARDS[stdKey];
    if (!def || !s || !s.results) return null;
    var meas = Array.isArray(s.results.measurements) ? s.results.measurements : null;
    var setups = (s.dosimeter && Array.isArray(s.dosimeter.setups)) ? s.dosimeter.setups : null;

    // New schema: find the setup matching the selected standard's
    // (exchange, criterion) pair and return that setup's measurement.
    if (meas && setups) {
      for (var i = 0; i < meas.length && i < setups.length; i++) {
        var ex = parseFloat(setups[i] && setups[i].exchange);
        var cr = parseFloat(setups[i] && setups[i].criterion);
        if (ex === def.exchange && cr === def.criterion) {
          var v = parseFloat(meas[i] && meas[i][measKey]);
          return isNaN(v) ? null : v;
        }
      }
      return null;
    }

    // Legacy schema: only use the flat value if the primary setup is
    // the active standard. Primary setup is the one whose exchange/
    // criterion drove the Calc TWA, so if those match the selected
    // chip, this survey does belong to this standard's pool.
    var legacyEx = parseFloat(s.dosimeter && s.dosimeter.exchange);
    var legacyCr = parseFloat(s.dosimeter && s.dosimeter.criterion);
    if (legacyEx === def.exchange && legacyCr === def.criterion) {
      var v2 = parseFloat(s.results[legacyKey]);
      return isNaN(v2) ? null : v2;
    }
    return null;
  }

  // Returns an array of { setupIndex, label, std, reportTWA } for every
  // setup in a survey that has a Report TWA populated. Used by the
  // individual results table to show all per-setup TWAs side-by-side.
  function statsAllTwasForSurvey(s) {
    var out = [];
    if (!s || !s.results) return out;
    var meas = Array.isArray(s.results.measurements) ? s.results.measurements : null;
    var setups = (s.dosimeter && Array.isArray(s.dosimeter.setups)) ? s.dosimeter.setups : null;
    if (meas && setups) {
      var primary = (typeof s.dosimeter.primarySetupIndex === 'number') ? s.dosimeter.primarySetupIndex : 0;
      for (var i = 0; i < meas.length && i < setups.length; i++) {
        var v = parseFloat(meas[i] && meas[i].reportTWA);
        if (isNaN(v)) continue;
        var ex = parseFloat(setups[i].exchange);
        var cr = parseFloat(setups[i].criterion);
        var stdName = '';
        if (ex === 3 && cr === 85) stdName = 'ACGIH';
        else if (ex === 5 && cr === 85) stdName = 'OSHA HC';
        else if (ex === 5 && cr === 90) stdName = 'OSHA PEL';
        else stdName = 'C' + cr + ' Q' + ex;
        out.push({
          setupIndex: i,
          label: 'Setup ' + (i + 1) + (i === primary ? '\u2605' : ''),
          std: stdName,
          reportTWA: v
        });
      }
    } else if (s.dosimeter) {
      // Legacy: surface the one stored Report TWA as a single setup
      // entry, so legacy surveys still render a TWA in the breakdown.
      var v3 = parseFloat(s.results.dosReportTWA);
      if (!isNaN(v3)) {
        var ex2 = parseFloat(s.dosimeter.exchange);
        var cr2 = parseFloat(s.dosimeter.criterion);
        var stdName2 = '';
        if (ex2 === 3 && cr2 === 85) stdName2 = 'ACGIH';
        else if (ex2 === 5 && cr2 === 85) stdName2 = 'OSHA HC';
        else if (ex2 === 5 && cr2 === 90) stdName2 = 'OSHA PEL';
        else stdName2 = 'C' + cr2 + ' Q' + ex2;
        out.push({ setupIndex: 0, label: 'Setup 1\u2605', std: stdName2, reportTWA: v3 });
      }
    }
    return out;
  }

  // ── Global summary metrics ──
  var twas  = sel.map(function(s) { return statsTwaFor(s, statsStandard); }).filter(function(n) { return n !== null; });
  var doses = sel.map(function(s) { return statsDoseFor(s, statsStandard); }).filter(function(n) { return n !== null; });
  var _std = STATS_STANDARDS[statsStandard] || STATS_STANDARDS.ACGIH;
  var _PEL = _std.pel, _AL = _std.al;
  var atOrAbovePEL = sel.filter(function(s) { var t = statsTwaFor(s, statsStandard); return t !== null && t >= _PEL; }).length;
  var atOrAboveAL  = sel.filter(function(s) { var t = statsTwaFor(s, statsStandard); return t !== null && t >= _AL && t < _PEL; }).length;
  var belowAL      = sel.filter(function(s) { var t = statsTwaFor(s, statsStandard); return t !== null && t < _AL; }).length;
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
    var gTWAs  = group.map(function(s) { return statsTwaFor(s, statsStandard); }).filter(function(n){return n !== null;});
    var gDoses = group.map(function(s) { return statsDoseFor(s, statsStandard); }).filter(function(n){return n !== null;});

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

    // ── Per-SEG standard thresholds (needed by indTable and lognormal blocks) ──
    var _segStdOuter = STATS_STANDARDS[statsStandard] || STATS_STANDARDS.ACGIH;
    var _segPEL = _segStdOuter.pel;
    var _segAL  = _segStdOuter.al;

    // ── Individual results table ──
    var indTable = '';
    if (showIndividual) {
      // Classify a setup by its (exchange, criterion, threshold). The
      // standard chips match on ER+C alone, but for the per-setup column
      // header we want the full triple so "C85 Q5 T80" (OSHA HC) is
      // distinguishable from a hypothetical "C85 Q5 T90" (custom). Any
      // combination that doesn't fit one of the three canonical
      // standards is labeled "Custom TWA" so the user can tell at a
      // glance that the setup isn't a recognized pairing.
      function classifySetup(ex, cr, th) {
        if (ex === 3 && cr === 85 && th === 80) return { key: 'ACGIH',    label: 'ACGIH TWA' };
        if (ex === 5 && cr === 85 && th === 80) return { key: 'OSHA_HC',  label: 'OSHA HC TWA' };
        if (ex === 5 && cr === 90 && th === 90) return { key: 'OSHA_PEL', label: 'OSHA PEL TWA' };
        return { key: 'CUSTOM', label: 'Custom TWA' };
      }

      // Determine how many setup columns to show and what header label
      // each gets, driven by the actual setup configs in the SEG group
      // (not by the three named standards). The max setup count across
      // the group sets the column count — usually 1, 2, or 3.
      //
      // Each column's header comes from the first survey in the group
      // that has data at that position. If later surveys have a
      // different config at the same slot (rare in practice since
      // project-level setup definitions tend to be consistent), the row
      // still renders its own TWA in that column — only the header
      // label reflects the "typical" config for the slot.
      var maxSetups = 0;
      group.forEach(function(s) {
        var setups = s.dosimeter && Array.isArray(s.dosimeter.setups) ? s.dosimeter.setups : null;
        if (setups && setups.length > maxSetups) maxSetups = setups.length;
      });
      // Column headers: label + the chip-match flag for the \u2605 marker.
      var columnHeaders = [];
      for (var ci = 0; ci < maxSetups; ci++) {
        var headerSrc = null;
        for (var gi = 0; gi < group.length; gi++) {
          var sg = group[gi];
          var setupsG = sg.dosimeter && Array.isArray(sg.dosimeter.setups) ? sg.dosimeter.setups : null;
          if (setupsG && setupsG[ci]) {
            headerSrc = setupsG[ci];
            break;
          }
        }
        var hEx = headerSrc ? parseFloat(headerSrc.exchange)  : NaN;
        var hCr = headerSrc ? parseFloat(headerSrc.criterion) : NaN;
        var hTh = headerSrc ? parseFloat(headerSrc.threshold) : NaN;
        columnHeaders.push({
          index: ci,
          cls: classifySetup(hEx, hCr, hTh),
          sample: headerSrc ? { exchange: hEx, criterion: hCr, threshold: hTh } : null
        });
      }

      // Sort by the active-standard TWA so the "worst case for this
      // chip" surfaces to the top. Surveys missing that standard
      // (null) sort to the bottom.
      var sorted = group.slice().sort(function(a,b) {
        var ta = statsTwaFor(a, statsStandard);
        var tb = statsTwaFor(b, statsStandard);
        // Nulls last.
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return tb - ta; // highest TWA first
      });
      var indRows = sorted.map(function(s) {
        var twa   = statsTwaFor(s, statsStandard);
        var dose  = statsDoseFor(s, statsStandard);
        var date  = s.calibration?.surveyStart ? new Date(s.calibration.surveyStart).toLocaleDateString() : '\u2014';
        var ih    = s.ih?.name || s.deviceNickname || '\u2014';
        var loc   = s.employee?.location || '\u2014';
        var proc  = s.employee?.process  || '\u2014';
        var qaOk  = s.qa?.allPass;
        var status= s.status;
        // Color/background driven by the active-standard TWA — that's
        // what the user is focused on when they pick a chip.
        var twaColor = (twa === null) ? 'var(--text3)' : twa >= _segPEL ? '#a32d2d' : twa >= _segAL ? '#7a4f00' : '#085041';
        var twaBg    = (twa === null) ? '' : twa >= _segPEL ? 'background:#fcebeb;' : twa >= _segAL ? 'background:#fff8e6;' : '';
        var statusBadge = status === 'complete'
          ? '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:20px;background:#e1f5ee;color:#085041;">Pass</span>'
          : status === 'qa-fail'
          ? '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:20px;background:#fcebeb;color:#a32d2d;">QA Flag</span>'
          : '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:20px;background:#f1efe8;color:#444441;">Draft</span>';

        // Per-setup TWA cells. Read reportTWA directly from each
        // survey's measurements[] by position index. Bold + darker
        // when the column's header matches the active chip (so the
        // "driving" column stands out from the reference columns).
        var sMeas = (s.results && Array.isArray(s.results.measurements)) ? s.results.measurements : [];
        var perSetupCells = columnHeaders.map(function(h) {
          var m = sMeas[h.index];
          var v = m ? parseFloat(m.reportTWA) : NaN;
          var txt = isNaN(v) ? '\u2014' : v.toFixed(1) + ' dBA';
          var activeCol = (h.cls.key === statsStandard);
          var weight = activeCol ? '700' : '500';
          var color = activeCol ? 'var(--text)' : 'var(--text2)';
          return '<td style="padding:6px 10px; font-size:11px; font-weight:' + weight + '; color:' + color + '; text-align:right;">' + txt + '</td>';
        }).join('');

        return '<tr style="border-bottom:1px solid var(--border);">'
          + '<td style="padding:6px 10px; font-size:12px; font-weight:600; color:var(--text);">' + esc(s.employee?.name || '\u2014') + '</td>'
          + '<td style="padding:6px 10px; font-size:11px; color:var(--teal);">' + esc(ih) + '</td>'
          + '<td style="padding:6px 10px; font-size:11px; color:var(--text2);">' + date + '</td>'
          + '<td style="padding:6px 10px; font-size:11px; color:var(--text2); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(loc) + '</td>'
          + '<td style="padding:6px 10px; font-size:11px; color:var(--text2); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(proc) + '</td>'
          + '<td style="padding:6px 10px; font-size:12px; font-weight:700; color:' + twaColor + '; ' + twaBg + ' text-align:right;">' + (twa === null ? '\u2014' : twa.toFixed(1) + ' dBA') + '</td>'
          + perSetupCells
          + '<td style="padding:6px 10px; font-size:12px; font-weight:600; color:var(--text); text-align:right;">' + (dose === null ? '\u2014' : dose.toFixed(1) + '%') + '</td>'
          + '<td style="padding:6px 10px; text-align:center;">' + statusBadge + '</td>'
          + '</tr>';
      }).join('');

      // Header cells for the per-setup columns. Star marker on any
      // column whose classified standard matches the active chip.
      var perSetupHeaders = columnHeaders.map(function(h) {
        var marker = (h.cls.key === statsStandard) ? ' \u2605' : '';
        return '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:right;">' + h.cls.label + marker + '</th>';
      }).join('');

      indTable = '<div style="margin-top:16px;">'
        + '<div style="font-size:11px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Individual Results (' + group.length + ' surveys)</div>'
        + '<div style="overflow-x:auto;">'
        + '<table style="width:100%; border-collapse:collapse; min-width:' + (600 + columnHeaders.length * 90) + 'px;">'
        + '<thead><tr style="background:var(--surface);">'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:left;">Employee</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:left;">IH</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:left;">Date</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:left;">Location</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:left;">Process</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:right;">TWA</th>'
        + perSetupHeaders
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:right;">Dose %</th>'
        + '<th style="padding:6px 10px; font-size:10px; font-weight:600; color:var(--text3); text-align:center;">QA</th>'
        + '</tr></thead>'
        + '<tbody>' + indRows + '</tbody>'
        + '</table></div></div>';
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

      + (function() {
          var stats = lognormalStats(gTWAs);
          if (!stats) {
            return '<div style="background:var(--surface); border-radius:var(--radius); padding:10px 14px; margin-bottom:16px; font-size:12px; color:var(--text3);">Insufficient data for UCL/UTL (need ≥2 TWA values).</div>';
          }
          var fmtDb = function(v) { return isNaN(v) ? '—' : v.toFixed(1) + ' dBA'; };
          var fmtX  = function(v) { return isNaN(v) ? '—' : v.toFixed(2) + 'x'; };
          // _segPEL and _segAL are defined in the outer per-SEG scope
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
          var smallNote = stats.smallSample
            ? '<div style="margin-top:8px; padding:7px 10px; background:#fff8e6; border:1px solid #f0a500; border-radius:6px; font-size:11px; color:#7a4f00; display:flex; gap:6px;">'
              + '<span>&#9651;</span><span><strong>Small sample (n=' + stats.n + ', &lt;6):</strong> UCL and UTL estimates are imprecise with fewer than 6 results. Collect additional samples to improve reliability.</span>'
              + '</div>'
            : '';
          return '<div style="border:1.5px solid var(--border); border-radius:8px; padding:12px 14px; margin-bottom:16px;">'
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
            + (function(){
              var gsd = stats.gsd || 1;
              var gsdColor = gsd < 1.5 ? 'var(--teal)' : gsd < 2.0 ? '#e08800' : 'var(--red)';
              var gsdNote = gsd < 1.5 ? 'Homogeneous SEG' : gsd < 2.0 ? 'Moderate spread' : 'Consider splitting SEG';
              return '<div style="padding:10px 14px; border-radius:8px; background:var(--surface);">'
                + '<div style="font-size:10px; color:var(--text3); margin-bottom:3px;">GSD <span style="font-weight:400;">(SEG spread)</span></div>'
                + '<div style="font-size:18px; font-weight:700; color:' + gsdColor + ';line-height:1.1;">' + fmtX(gsd) + '</div>'
                + '<div style="font-size:9px; color:' + gsdColor + '; margin-top:3px;">' + gsdNote + '</div>'
              + '</div>';
            })()
            + '<div style="padding:10px 14px; border-radius:8px; background:var(--surface);">'
              + '<div style="font-size:10px; color:var(--text3); margin-bottom:3px;">Arith. Mean <span style="font-weight:400;">(AM)</span></div>'
              + '<div style="font-size:18px; font-weight:700; color:var(--text);">' + fmtDb(stats.am || stats.gm) + '</div>'
            + '</div>'
            + statCell('95% UCL on AM', fmtDb(stats.ucl95), pelUCL, alUCL)
            + statCell('95th/95% UTL',  fmtDb(stats.utl95_95), pelUTL, alUTL)
            + '</div>'
            + '<div style="font-size:10px; color:var(--text3); line-height:1.6;">'
              + '<strong>UCL</strong> (95% confidence limit on the <em>arithmetic</em> mean): exp(ų + s²/2 + H(n,δ)·s/√n). Land\'s Exact — Land (1971/1975). H(n=' + stats.n + ', δ=' + (stats.delta ? stats.delta.toFixed(3) : '—') + ')=' + (stats.t ? stats.t.toFixed(4) : '—') + '. '
              + '<strong>UTL</strong> (95th percentile / 95% confidence): exp(ų + K·s). Hahn-Meeker K(n=' + stats.n + ') = ' + (stats.K ? stats.K.toFixed(3) : '—') + '. '
              + '<strong>GSD</strong> = geometric standard deviation: the multiplicative spread factor around the GM. GSD < 1.5● = homogeneous SEG; 1.5–2.0● = moderate spread; > 2.0● = consider splitting the SEG. Lognormal on TWA dBA — AIHA Strategy / Noise Manual 6th Ed. | Standard: <strong>' + _segStdOuter.label + '</strong> (PEL ' + _segPEL + ' dBA, AL ' + _segAL + ' dBA)'
            + '</div>'
            + smallNote
            + '</div>';
        })()

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

// Handler for the dropdown-based filter UI (IH / Location / SEG).
// Empty string means "All" — sets the filter to include every known
// value so the downstream filter block treats it as no filter.
// A specific value creates a single-item Set; the filter block
// matches only surveys with that exact value. Mirrors the pattern
// used by racSetFilter() in pdf-reports.js.
function statsSetFilter(kind, value) {
  var all;
  if (kind === 'ih') {
    all = [...new Set(surveys.map(function(s){ return s.ih?.name || s.deviceNickname || ''; }).filter(Boolean))];
    statsSelectedIHs = value ? new Set([value]) : new Set(all);
  } else if (kind === 'location') {
    all = [...new Set(surveys.map(function(s){ return s.employee?.location || ''; }).filter(Boolean))];
    statsSelectedLocations = value ? new Set([value]) : new Set(all);
  } else if (kind === 'seg') {
    all = [...new Set(surveys.map(function(s){ return s.employee?.seg || ''; }).filter(Boolean))];
    statsSelectedSEGs = value ? new Set([value]) : new Set(all);
  }
  renderStats();
}

