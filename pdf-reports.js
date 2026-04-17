// ═══════════════════════════════════════════════════════════
//  PDF REPORTS
// ═══════════════════════════════════════════════════════════
//  Centralized home for all survey/inventory/field-report PDFs.
//  Hearing-conservation letter PDFs live separately in hcp-letters.js
//  because they are a distinct product concern with their own templates.
//
//  STRUCTURE
//  ────────────────────────────────────────────────────────
//  1. BRAND CONSTANTS   — colors, fonts, margins, logo. Single source
//                         of truth; change a font size here, every
//                         report updates.
//  2. SHARED HELPERS    — header/footer/logo/section primitives every
//                         report builder can call. Start empty; factor
//                         patterns out as duplication appears.
//  3. REPORT BUILDERS   — one section per report type. Each builder
//                         returns a jsPDF doc; exportXxxPDF() wrappers
//                         handle file naming and user feedback.
//
//  All functions declared at top level remain on `window`, preserving
//  the inline onclick handlers in index.html.
// ═══════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════
//  1. BRAND CONSTANTS
// ═══════════════════════════════════════════════════════════
//
//  Colors are RGB triplets matching the app's CSS :root variables so
//  on-screen and print look consistent. Override individual fields if
//  print needs different values (e.g., darker teal for ink).
//
//  To set the logo: export your logo as PNG/JPG, base64-encode it
//  (`base64 -w 0 logo.png` or any online tool), and paste the full
//  data-URI into `logo` below. Inlined so it works offline in the PWA.
//    Example:  logo: 'data:image/png;base64,iVBORw0KGgoAAAANS...'

var PDF_BRAND = {
  logo: null,                          // data URI; null = no logo

  // RGB arrays (jsPDF's setTextColor / setFillColor want r,g,b args)
  colors: {
    navy:    [15, 34, 53],             // --navy   #0f2235
    teal:    [0, 184, 160],            // --teal   #00b8a0
    text:    [26, 41, 64],             // --text   #1a2940
    muted:   [120, 120, 120],
    border:  [200, 200, 200],
    white:   [255, 255, 255],
  },

  // Font sizes (pt). Change once, everywhere.
  fonts: {
    title:    { size: 18, style: 'bold'   },
    subtitle: { size: 13, style: 'bold'   },
    sectionH: { size: 11, style: 'bold'   },
    body:     { size:  9, style: 'normal' },
    caption:  { size:  8, style: 'normal' },
    mono:     { size:  9, style: 'normal' },
  },

  // Page margins in mm (jsPDF default unit).
  margin: { top: 15, right: 15, bottom: 20, left: 15 },

  // String shown in footer. Free to customize per deployment.
  footerLabel: 'IH Field App',
};


// ═══════════════════════════════════════════════════════════
//  2. SHARED HELPERS
// ═══════════════════════════════════════════════════════════
//  Empty stubs. Wire report builders through these as duplication
//  emerges across reports. Don't force premature abstraction — factor
//  only after seeing the same pattern in 2+ builders.
// ═══════════════════════════════════════════════════════════

// Stamp the logo + title + optional subtitle at the top of page 1.
// Returns the Y-coordinate below the header so the caller knows where
// body content can start.
function pdfDrawHeader(doc, title, subtitle) {
  // TODO: implement once first builder needs it.
  // Suggested contract:
  //   - if PDF_BRAND.logo is set, place it at (margin.left, margin.top)
  //   - render title at PDF_BRAND.fonts.title to the right of the logo
  //   - render subtitle below title if provided
  //   - draw a thin separator line under the header
  //   - return the Y-coordinate where body content should start
}

// Stamp a running footer: page N of M, generation date, brand label.
// Call once per page (typically in a doc.internal.pages loop at end of build).
function pdfDrawFooter(doc, pageNum, totalPages) {
  // TODO: implement once first builder needs it.
  // Suggested contract:
  //   - "Page N of M"             — right-aligned at bottom
  //   - "Generated YYYY-MM-DD"    — left-aligned at bottom
  //   - PDF_BRAND.footerLabel     — centered at bottom
  //   - use fonts.caption + colors.muted
}

// Embed the logo at an arbitrary (x,y) with width/height in mm.
// Silently no-ops if PDF_BRAND.logo is null.
function pdfEmbedLogo(doc, x, y, w, h) {
  // TODO: implement once logo is added.
  //   if (!PDF_BRAND.logo) return;
  //   doc.addImage(PDF_BRAND.logo, 'PNG', x, y, w, h);
}

// Draw a section header (bold, tinted rule underneath).
// Returns new Y below the header.
function pdfSectionHeader(doc, text, y) {
  // TODO: implement once first builder needs it.
}

// Convenience: apply a font preset from PDF_BRAND.fonts to the doc.
//   pdfSetFont(doc, 'title')   // equivalent to setFontSize + setFont
function pdfSetFont(doc, preset) {
  var f = PDF_BRAND.fonts[preset];
  if (!f) return;
  doc.setFontSize(f.size);
  doc.setFont(undefined, f.style);
}

// Convenience: apply a brand color to text.
//   pdfSetTextColor(doc, 'navy')
function pdfSetTextColor(doc, name) {
  var c = PDF_BRAND.colors[name];
  if (!c) return;
  doc.setTextColor(c[0], c[1], c[2]);
}


// ═══════════════════════════════════════════════════════════
//  3. REPORT: NOISE DOSIMETRY SURVEYS
// ═══════════════════════════════════════════════════════════
//  Entry points:
//    buildPDFDoc(surveysArr)  — returns a jsPDF doc (used internally
//                               by the three exportXxxPDF wrappers
//                               below plus exportFilteredPDF() in
//                               index.html's "filtered batch" section)
//    exportSinglePDF(id)      — one survey by id
//    exportBatchPDF()         — all surveys currently loaded
//
//  Uses globals: surveys, projectMeta, window.jspdf (jsPDF lib),
//                showToast (defined in index.html)
//
//  CURRENT STATE
//  ──────────────────────────────────────────────────────────
//  Lifted verbatim from the previous inline implementation. Does NOT
//  yet use the shared helpers above. Refactor candidates:
//    - page header block (look for "Noise Dosimetry Report" title)
//      → pdfDrawHeader(doc, 'Noise Dosimetry Report', subtitle)
//    - page footer block  → pdfDrawFooter(doc, pageNum, totalPages)
//    - repeated font size setting → pdfSetFont(doc, 'body')
//  Leave as-is until you build the inventory report and see which
//  patterns actually want to be shared.
// ═══════════════════════════════════════════════════════════

function buildPDFDoc(surveysArr) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const NAVY = [15, 34, 53];
  const TEAL = [0, 184, 160];
  const GRAY = [74, 92, 114];
  const LGRAY = [235, 238, 243];

  surveysArr.forEach((s, si) => {
    if (si > 0) doc.addPage();

    // Header bar
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 52, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('NOISE DOSIMETRY FIELD RECORD', 36, 24);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.setTextColor(...TEAL);
    doc.text('Industrial Hygiene Field Data', 36, 38);
    doc.setTextColor(180,200,220);
    doc.text('Survey ID: ' + s.id, W - 36, 38, { align: 'right' });

    let y = 70;
    const lineH = 16;
    const colW = (W - 72) / 3;

    function sectionHead(title, y2) {
      doc.setFillColor(...NAVY);
      doc.rect(36, y2, W - 72, 18, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(11); doc.setFont('helvetica','bold');
      doc.text(title.toUpperCase(), 40, y2 + 12);
      return y2 + 36;
    }

    function row(label, value, x, y2, w) {
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
      doc.text(label, x, y2);
      doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
      const valStr = String(value || '—');
      const maxW = (w || colW) - 6;
      const wrapped = doc.splitTextToSize(valStr, maxW);
      doc.text(wrapped[0], x, y2 + 12);
      return y2;
    }

    function grid3(fields, y2) {
      fields.forEach((f, i) => {
        const col = i % 3;
        const rowN = Math.floor(i / 3);
        row(f[0], f[1], 36 + col * colW, y2 + rowN * 38, colW - 10);
      });
      return y2 + Math.ceil(fields.length / 3) * 38;
    }

    // Project info
    y = sectionHead('Project Information', y);
    y = grid3([
      ['Project / Client', s.project?.name],
      ['Survey Date', s.project?.date || s.calibration?.surveyStart?.split('T')[0]],
      ['Standard', s.project?.standard],
    ], y) + 10;

    // Employee
    y = sectionHead('Employee & Sample Information', y);

    // Employee Name — rendered prominently above the grid because this is
    // the single most-important field on the form (per stakeholder review).
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
    doc.text('Employee Name', 36, y);
    doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(26,41,64);
    doc.text(String(s.employee?.name || '—'), 36, y + 18);
    y += 32;

    y = grid3([
      ['Employee ID', s.employee?.empId],
      ['Employer / Company', s.employee?.company],
      ['Job Title', s.employee?.title],
      ['Department / Area', s.employee?.dept],
      ['Location / Facility', s.employee?.location],
    ], y);
    if (s.employee?.task) {
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
      doc.text('Task Description', 36, y + 8);
      doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
      const lines = doc.splitTextToSize(s.employee.task, W - 72);
      doc.text(lines, 36, y + 18);
      y += 18 + lines.length * 10;
    }
    y += 12;

    // Instrument
    y = sectionHead('Instrument Information', y);
    y = grid3([
      ['Dosimeter Make', s.dosimeter?.make],
      ['Dosimeter Model', s.dosimeter?.model],
      ['Dosimeter Serial', s.dosimeter?.serial],
      ['Factory Cal. Date', s.dosimeter?.factoryCal],
      ['Exchange Rate', s.dosimeter?.exchange ? s.dosimeter.exchange + ' dB' : ''],
      ['Criterion Level', s.dosimeter?.criterion ? s.dosimeter.criterion + ' dB' : ''],
      ['Frequency Weighting', s.dosimeter?.weighting ? s.dosimeter.weighting + '-weighting' : ''],
      ['Detector Response', s.dosimeter?.response || ''],
      ['Calibrator Make', s.calibrator?.make],
      ['Calibrator Model', s.calibrator?.model],
      ['Calibrator Serial', s.calibrator?.serial],
      ['NIST Cal. Due', s.calibrator?.nistDue],
      ['Calibrator Ref. Level', s.calibrator?.refLevel ? s.calibrator.refLevel + ' dB' : ''],
      ['Placement', s.placement?.location],
    ], y) + 10;

    // Calibration checks
    y = sectionHead('Calibration & QA Record', y);
    const calCols = ['Pre-Cal Date/Time', 'Pre-Cal Reading', 'Survey Start', 'Survey End', 'Post-Cal Date/Time', 'Post-Cal Reading'];
    const calVals = [
      s.calibration?.preTime?.replace('T',' '),
      s.calibration?.preReading ? s.calibration.preReading + ' dB' : '',
      s.calibration?.surveyStart?.replace('T',' '),
      s.calibration?.surveyEnd?.replace('T',' '),
      s.calibration?.postTime?.replace('T',' '),
      s.calibration?.postReading ? s.calibration.postReading + ' dB' : '',
    ];
    y = grid3(calCols.map((c,i) => [c, calVals[i]]), y) + 8;

    // QA results table — re-derive from stored calibration data so surveys
    // without a saved s.qa.checks object still show correct Pass/Fail.
    const qaLabels = [
      'Pre-cal before survey start',
      'Post-cal after survey end',
      'Pre-cal within 1 hr of start',
      'Post-cal within 1 hr of end',
      'Pre/post difference <= 5%',
      'Calculated TWA matches report (+/- 0.5 dB)'
    ];
    (function() {
      var cal = s.calibration || {};
      var preT  = cal.preTime  || '';
      var postT = cal.postTime || '';
      var startT = cal.surveyStart || '';
      var endT   = cal.surveyEnd   || '';
      var preR  = parseFloat(cal.preReading  || '');
      var postR = parseFloat(cal.postReading || '');

      // Prefer stored checks if present, otherwise calculate
      var stored = (s.qa && s.qa.checks) ? s.qa.checks : null;

      function derive(key, fn) {
        if (stored && stored[key] !== undefined) return stored[key];
        try { return fn(); } catch(e) { return undefined; }
      }

      var qaVals2 = [
        derive('preBefore',     function() { return preT  && startT ? new Date(preT)  < new Date(startT) : undefined; }),
        derive('postAfter',     function() { return postT && endT   ? new Date(postT) > new Date(endT)   : undefined; }),
        derive('preWithin1hr',  function() {
          if (!preT || !startT) return undefined;
          var d = (new Date(startT) - new Date(preT)) / 60000;
          return d >= 0 && d <= 60;
        }),
        derive('postWithin1hr', function() {
          if (!postT || !endT) return undefined;
          var d = (new Date(postT) - new Date(endT)) / 60000;
          return d >= 0 && d <= 60;
        }),
        derive('calWithin5pct', function() {
          if (isNaN(preR) || isNaN(postR) || preR <= 0) return undefined;
          return Math.abs(postR - preR) / preR * 100 <= 5;
        }),
        derive('twaMatch', function() {
          var calcTWA   = parseFloat((s.results && s.results.twa)           || '');
          var reportTWA = parseFloat((s.results && s.results.dosReportTWA)  || '');
          if (isNaN(calcTWA) || isNaN(reportTWA)) return undefined;
          return Math.abs(calcTWA - reportTWA) <= 0.5;
        })
      ];

      var rowH = 15;
      qaLabels.forEach(function(lbl, i) {
        var val = qaVals2[i];
        var bg = val === true ? [234,250,241] : val === false ? [253,240,240] : LGRAY;
        doc.setFillColor(...bg);
        doc.rect(36, y + i * rowH, W - 72, rowH - 1, 'F');
        doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...GRAY);
        doc.text(lbl, 40, y + i * rowH + 10);
        var res = val === true ? 'PASS' : val === false ? 'FAIL' : 'N/A';
        var resColor = val === true ? [29,122,69] : val === false ? [184,48,48] : [...GRAY];
        doc.setFont('helvetica','bold'); doc.setTextColor(...resColor);
        doc.text(res, W - 60, y + i * rowH + 10, { align: 'right' });
      });
      y += qaLabels.length * rowH + 14;
    })();


    // Dosimetry results
    if (y > 650) { doc.addPage(); y = 40; }
    y = sectionHead('Dosimetry Results', y);
    y = grid3([
      ['Dose %', s.results?.dose ? s.results.dose + ' %' : ''],
      ['Lavg / LEQ', s.results?.lavg ? s.results.lavg + ' dB' : ''],
      ['LASmax', s.results?.peak ? s.results.peak + ' dBA' + (parseFloat(s.results.peak) > 115 ? ' ⚠ >115 dBA' : '') : ''],
      ['Run Time', s.results?.runTime ? s.results.runTime + ' hr' : ''],
      ['TWA (8-hr)', s.results?.twa ? s.results.twa + ' dBA' : ''],
      ['Exposure Category', s.results?.category],
      ['HPD Required?', s.results?.hpd],
    ], y);

    // LASmax SEG interview notes
    if (s.results?.lasmaxInterviewNotes) {
      if (y > 670) { doc.addPage(); y = 40; }
      doc.setFillColor(255, 248, 230);
      doc.rect(36, y, W - 72, 16, 'F');
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(122, 79, 0);
      doc.text('LASmax > 115 dBA — SEG Impact/Impulse Interview Notes', 40, y + 11);
      y += 20;
      doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
      const iLines = doc.splitTextToSize(s.results.lasmaxInterviewNotes, W - 72);
      doc.text(iLines, 36, y + 4);
      y += 4 + iLines.length * 10 + 8;
    }
    // LASmax > 140 dBA protocol notes
    if (s.results?.peak && parseFloat(s.results.peak) > 140) {
      if (y > 640) { doc.addPage(); y = 40; }
      doc.setFillColor(253, 240, 240);
      doc.rect(36, y, W - 72, 16, 'F');
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(139, 26, 26);
      doc.text('LASmax > 140 dBA — Sound Level Meter Follow-Up Protocol', 40, y + 11);
      y += 20;
      if (s.results?.lasmax140CorrectiveNotes) {
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(139, 26, 26);
        doc.text('(a) Corrective Measures / Action Taken', 36, y + 8);
        doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
        const cLines = doc.splitTextToSize(s.results.lasmax140CorrectiveNotes, W - 72);
        doc.text(cLines, 36, y + 18);
        y += 18 + cLines.length * 10 + 6;
      }
      if (s.results?.lasmax140InvestigationNotes) {
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(74, 92, 114);
        doc.text('(b) Investigation Documentation — No Source Found Above 140 dBA', 36, y + 8);
        doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
        const dLines = doc.splitTextToSize(s.results.lasmax140InvestigationNotes, W - 72);
        doc.text(dLines, 36, y + 18);
        y += 18 + dLines.length * 10 + 6;
      }
      y += 4;
    }
    if (s.results?.notes) {
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
      doc.text('Sampling Notes', 36, y + 8);
      doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
      const lines = doc.splitTextToSize(s.results.notes, W - 72);
      doc.text(lines, 36, y + 18);
      y += 18 + lines.length * 10;
    }
    y += 8;

    // Controls & PPE
    const controlFields = [
      { label: 'Engineering Controls in Place', val: s.results?.engControls },
      { label: 'Administrative Controls in Place', val: s.results?.adminControls },
      { label: 'PPE Used', val: s.results?.ppe },
    ].filter(f => f.val);
    if (controlFields.length) {
      if (y > 630) { doc.addPage(); y = 40; }
      y = sectionHead('Controls & PPE in Place During Sampling', y);
      controlFields.forEach(f => {
        if (y > 680) { doc.addPage(); y = 40; }
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
        doc.text(f.label, 36, y + 8);
        doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
        const lines = doc.splitTextToSize(f.val, W - 72);
        doc.text(lines, 36, y + 18);
        y += 18 + lines.length * 10 + 4;
      });
      y += 8;
    }

    // Hourly notes
    const hourlyNotes = [1,2,3,4,5,6,7,8,9,10]
      .map(n => ({ label: 'Hour ' + n, val: s.results?.['hour' + n] }))
      .filter(h => h.val);
    if (hourlyNotes.length) {
      if (y > 630) { doc.addPage(); y = 40; }
      y = sectionHead('Hourly Field Observations', y);
      hourlyNotes.forEach(h => {
        if (y > 680) { doc.addPage(); y = 40; }
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
        doc.text(h.label, 36, y + 8);
        doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
        const lines = doc.splitTextToSize(h.val, W - 72);
        doc.text(lines, 36, y + 18);
        y += 18 + lines.length * 10 + 4;
      });
    }
    y += 12;

    // Footer
    const footY = doc.internal.pageSize.getHeight() - 32;
    doc.setFillColor(...NAVY);
    doc.rect(0, footY - 6, W, 38, 'F');
    doc.setTextColor(180,200,220); doc.setFontSize(8); doc.setFont('helvetica','normal');
    const ihLine = [s.ih?.name, s.ih?.creds, s.ih?.firm, s.ih?.phone].filter(Boolean).join('  ·  ');
    doc.text(ihLine || 'IH Professional', 36, footY + 8);
    doc.setTextColor(...TEAL);
    doc.text('Generated: ' + new Date().toLocaleString(), W - 36, footY + 8, { align: 'right' });
  });

  return doc;
}

function exportSinglePDF(id) {
  try {
    if (!window.jspdf) {
      // jsPDF is inlined in this page — if it's missing the page is stale
      // Force a hard reload to bypass any service worker cache
      if (confirm('PDF library not loaded. This usually means a cached version of the page is being served.\n\nClick OK to reload, or Cancel to dismiss.')) {
        window.location.reload(true);
      }
      return;
    }
    const s = surveys.find(x => x.id === id);
    if (!s) return;
    const doc = buildPDFDoc([s]);
    doc.save('NoiseDosimetry_' + (s.employee?.name || id).replace(/\s+/g,'-') + '.pdf');
    showToast('PDF exported', 'success');
  } catch(e) { showToast('PDF export failed: ' + e.message, 'error'); console.error(e); }
}

function exportBatchPDF() {
  try {
    if (!window.jspdf) {
      // jsPDF is inlined in this page — if it's missing the page is stale
      // Force a hard reload to bypass any service worker cache
      if (confirm('PDF library not loaded. This usually means a cached version of the page is being served.\n\nClick OK to reload, or Cancel to dismiss.')) {
        window.location.reload(true);
      }
      return;
    }
    if (!surveys.length) { showToast('No surveys to export', 'error'); return; }
    const doc = buildPDFDoc(surveys);
    doc.save('NoiseDosimetry_Campaign_' + (projectMeta.name || 'Project').replace(/\s+/g,'-') + '.pdf');
    showToast('Batch PDF exported (' + surveys.length + ' surveys)', 'success');
  } catch(e) { showToast('PDF export failed: ' + e.message, 'error'); console.error(e); }
}


// ═══════════════════════════════════════════════════════════
//  4. REPORT: EQUIPMENT LIBRARY
// ═══════════════════════════════════════════════════════════
//  Entry points:
//    buildEquipmentLibraryPDF()   — returns a jsPDF doc
//    exportEquipmentLibraryPDF()  — save-to-file wrapper
//
//  Uses globals: equipment, window.jspdf, showToast
//
//  Layout: landscape letter, one page header, two tables stacked
//  (Dosimeters, then Calibrators), each sorted alphabetically by
//  make + model. Calibration/NIST-due dates color-coded: green if
//  > 90 days out, amber ≤ 90 days, red if past due.
//
//  NOTE ON SHARED HELPERS
//  ──────────────────────────────────────────────────────────
//  This is the second report builder. The Section 2 helper stubs at
//  the top of this file are still TODO. After this report ships and
//  you've seen which patterns actually repeat between the surveys
//  and inventory builders (likely: header stamp, footer, section
//  bar, cal-date coloring), factor those into the Section 2 stubs
//  in a follow-up pass. For now, this builder duplicates a minimal
//  amount of header/footer code inline — marked with "// SHARED?"
//  comments to flag the candidates.
// ═══════════════════════════════════════════════════════════

// Returns a status object for a calibration / NIST due date:
//   { color: [r,g,b], label: 'past due' | '≤ 90 days' | 'current' | '—' }
// Used to color-code the cal-due column in the inventory table.
function equipCalStatus(dueDateStr) {
  if (!dueDateStr) return { color: [120, 120, 120], label: '—' };
  var due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return { color: [120, 120, 120], label: '—' };
  var now = new Date();
  var msPerDay = 86400000;
  var daysOut = Math.floor((due - now) / msPerDay);
  if (daysOut < 0)  return { color: [184,  48,  48], label: 'past due'  };  // red
  if (daysOut <= 90) return { color: [184, 134,  11], label: '<= 90 days' };  // amber
  return { color: [ 29, 122,  69], label: 'current' };                       // green
}

function buildEquipmentLibraryPDF() {
  const { jsPDF } = window.jspdf;
  // Landscape letter: 792 x 612 pt (wider than tall). Matches the data
  // density of a multi-column inventory table.
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();    // 792
  const H = doc.internal.pageSize.getHeight();   // 612

  // Brand constants, loaded locally for convenience and to match the
  // surveys builder's spread pattern.
  const NAVY = PDF_BRAND.colors.navy;
  const TEAL = PDF_BRAND.colors.teal;
  const GRAY = PDF_BRAND.colors.muted;

  // SHARED? — header bar + title stamp (also used by the surveys builder).
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 52, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('EQUIPMENT LIBRARY', 36, 24);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEAL);
  doc.text('Dosimeters & Calibrators — Current Library Summary', 36, 38);
  doc.setTextColor(180, 200, 220);
  const totalCount = equipment.length +
    ' item' + (equipment.length !== 1 ? 's' : '') +
    '   ·   Generated ' + new Date().toLocaleString();
  doc.text(totalCount, W - 36, 38, { align: 'right' });

  let y = 72;

  // SHARED? — navy section-bar heading. Compare to sectionHead() in
  // buildPDFDoc — same visual but different return contract (this one
  // returns the Y below the bar directly; sectionHead adds 36pt
  // breathing room tuned for 10pt labels below it).
  function sectionBar(title, y2) {
    doc.setFillColor(...NAVY);
    doc.rect(36, y2, W - 72, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), 40, y2 + 12);
    return y2 + 26;
  }

  // Draws a table with given column headers and row data.
  //   cols: [{ label, width, key }]    — key may be a string field name
  //                                       or a function(row) => value
  //   rows: array of data objects
  //   statusKey: optional field name whose equipCalStatus() color
  //              should tint the cell text (e.g., 'calDue', 'nistDue')
  function drawTable(y2, cols, rows, statusKey) {
    const rowH = 18;
    const startX = 36;

    // Header row
    doc.setFillColor(235, 238, 242);
    doc.rect(startX, y2, W - 72, rowH, 'F');
    doc.setTextColor(...NAVY);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    let x = startX + 6;
    cols.forEach(c => {
      doc.text(c.label, x, y2 + 12);
      x += c.width;
    });
    y2 += rowH;

    // Data rows
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    rows.forEach((r, i) => {
      // Page-break: leave room for at least one more row + footer
      if (y2 > H - 50) {
        drawFooter();
        doc.addPage();
        y2 = 40;
        // Re-draw header row on new page
        doc.setFillColor(235, 238, 242);
        doc.rect(startX, y2, W - 72, rowH, 'F');
        doc.setTextColor(...NAVY);
        doc.setFont('helvetica', 'bold');
        let hx = startX + 6;
        cols.forEach(c => { doc.text(c.label, hx, y2 + 12); hx += c.width; });
        y2 += rowH;
        doc.setFont('helvetica', 'normal');
      }
      // Zebra striping
      if (i % 2 === 1) {
        doc.setFillColor(248, 249, 251);
        doc.rect(startX, y2, W - 72, rowH, 'F');
      }
      // Status color (if column applies)
      let rowColor = [26, 41, 64];
      if (statusKey && r[statusKey]) {
        const st = equipCalStatus(r[statusKey]);
        rowColor = st.color;
      }
      x = startX + 6;
      cols.forEach(c => {
        let val = typeof c.key === 'function' ? c.key(r) : r[c.key];
        val = String(val == null || val === '' ? '—' : val);
        // Truncate to fit the column. splitTextToSize wraps but we want
        // single-line rows for scannability.
        const maxChars = Math.floor(c.width / 4.5); // rough heuristic at 9pt
        if (val.length > maxChars) val = val.substring(0, maxChars - 1) + '…';
        // Color the status column differently from other cells
        if (c.key === statusKey) {
          doc.setTextColor(...rowColor);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(26, 41, 64);
          doc.setFont('helvetica', 'normal');
        }
        doc.text(val, x, y2 + 12);
        x += c.width;
      });
      y2 += rowH;
    });

    return y2;
  }

  // SHARED? — navy footer bar with IH/timestamp (same visual style
  // as buildPDFDoc's footer). Parameterless version; takes generation
  // stamp from new Date() and doesn't know about IH like the surveys
  // report does.
  function drawFooter() {
    const footY = H - 32;
    doc.setFillColor(...NAVY);
    doc.rect(0, footY - 6, W, 38, 'F');
    doc.setTextColor(180, 200, 220);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(PDF_BRAND.footerLabel + ' — Equipment Library', 36, footY + 8);
    doc.setTextColor(...TEAL);
    doc.text('Generated: ' + new Date().toLocaleString(), W - 36, footY + 8, { align: 'right' });
  }

  // Split equipment by type
  const dosimeters  = equipment.filter(e => e.type === 'dosimeter')
    .sort((a, b) => (a.make + a.model).localeCompare(b.make + b.model));
  const calibrators = equipment.filter(e => e.type === 'calibrator')
    .sort((a, b) => (a.make + a.model).localeCompare(b.make + b.model));

  // ───── Dosimeters table ─────
  y = sectionBar('Dosimeters (' + dosimeters.length + ')', y);
  if (dosimeters.length === 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'italic'); doc.setTextColor(...GRAY);
    doc.text('No dosimeters in library.', 40, y + 8);
    y += 24;
  } else {
    y = drawTable(y, [
      { label: 'Make / Model',   width: 150, key: r => (r.make || '') + ' ' + (r.model || '') },
      { label: 'Serial',          width: 100, key: 'serial' },
      { label: 'Asset Tag',       width:  80, key: 'asset' },
      { label: 'Factory Cal',     width:  75, key: 'factoryCal' },
      { label: 'Cal Due',         width:  75, key: 'calDue' },
      { label: 'Exchange',        width:  60, key: r => r.exchange ? r.exchange + ' dB' : '' },
      { label: 'Criterion',       width:  65, key: r => r.criterion ? r.criterion + ' dB' : '' },
      { label: 'Condition',       width:  65, key: 'condition' },
      { label: 'Notes',           width:  50, key: 'notes' },
    ], dosimeters, 'calDue');
    y += 14;
  }

  // ───── Calibrators table ─────
  // Force page break if we don't have room for at least a header + 2 rows
  if (y > H - 120) { drawFooter(); doc.addPage(); y = 40; }

  y = sectionBar('Calibrators (' + calibrators.length + ')', y);
  if (calibrators.length === 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'italic'); doc.setTextColor(...GRAY);
    doc.text('No calibrators in library.', 40, y + 8);
    y += 24;
  } else {
    y = drawTable(y, [
      { label: 'Make / Model',    width: 150, key: r => (r.make || '') + ' ' + (r.model || '') },
      { label: 'Serial',          width: 100, key: 'serial' },
      { label: 'Asset Tag',       width:  80, key: 'asset' },
      { label: 'Last NIST Cal',   width:  85, key: 'lastNistCal' },
      { label: 'NIST Due',        width:  85, key: 'nistDue' },
      { label: 'Ref Level',       width:  70, key: r => r.refLevel ? r.refLevel + ' dB' : '' },
      { label: 'Condition',       width:  75, key: 'condition' },
      { label: 'Notes',           width:  75, key: 'notes' },
    ], calibrators, 'nistDue');
    y += 14;
  }

  // Legend for color coding. Use filled rectangles as color swatches
  // (rather than a bullet glyph) because jsPDF's default Helvetica font
  // doesn't include U+25CF or U+2022 in its WinAnsi glyph set —
  // printing them produces garbage bytes. "<=" is used instead of the
  // unicode less-than-or-equal sign for the same reason.
  if (y > H - 60) { drawFooter(); doc.addPage(); y = 40; }
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GRAY);
  doc.text('CAL DUE LEGEND:', 40, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(26, 41, 64);

  // Entry 1: current
  doc.setFillColor(29, 122, 69);
  doc.rect(130, y + 4, 8, 8, 'F');
  doc.text('current (>90 days)', 142, y + 10);

  // Entry 2: <= 90 days
  doc.setFillColor(184, 134, 11);
  doc.rect(260, y + 4, 8, 8, 'F');
  doc.text('<= 90 days out', 272, y + 10);

  // Entry 3: past due
  doc.setFillColor(184, 48, 48);
  doc.rect(370, y + 4, 8, 8, 'F');
  doc.text('past due', 382, y + 10);

  // Entry 4: no date
  doc.setFillColor(120, 120, 120);
  doc.rect(445, y + 4, 8, 8, 'F');
  doc.text('no date on file', 457, y + 10);

  drawFooter();
  return doc;
}

function exportEquipmentLibraryPDF() {
  try {
    if (!window.jspdf) {
      if (confirm('PDF library not loaded. This usually means a cached version of the page is being served.\n\nClick OK to reload, or Cancel to dismiss.')) {
        window.location.reload(true);
      }
      return;
    }
    if (!equipment.length) { showToast('No equipment in library — add items first', 'error'); return; }
    const doc = buildEquipmentLibraryPDF();
    doc.save('EquipmentLibrary_' + new Date().toISOString().split('T')[0] + '.pdf');
    showToast('Equipment library PDF exported (' + equipment.length + ' items)', 'success');
  } catch(e) { showToast('PDF export failed: ' + e.message, 'error'); console.error(e); }
}


// ═══════════════════════════════════════════════════════════
//  5. NOISE RAC — TAB RENDERING + PDF REPORT
// ═══════════════════════════════════════════════════════════
//  This section owns both the Noise RAC tab's UI rendering
//  (renderRAC and its filter-toggle helpers) and the RAC PDF
//  export (printRAC). Kept together here because the tab and the
//  PDF share state (racSelected* filters, racPersonnelOverrides)
//  and calculation (calcRAC, racBadge). If the tab rendering ever
//  needs to move back to index.html for separation-of-concerns
//  reasons, the PDF-specific pieces (printRAC and any helpers only
//  it uses) can be split out at that time.
//
//  Entry points:
//    renderRAC()                  — render the Noise RAC tab
//    printRAC()                   — export the RAC PDF report
//    calcRAC(utl, personnel)      — core math
//    rac* filter/toggle helpers   — called from onclick handlers
//
//  Uses globals: surveys, projectMeta, deviceNickname, esc,
//                showToast, fmtDb, lognormalStats (from stats.js),
//                window.jspdf
// ═══════════════════════════════════════════════════════════


var racSelectedIHs        = null;
var racSelectedLocations  = null;
var racSelectedSEGs       = null;
var racPersonnelOverrides = {};

(function() {
  try {
    var saved = localStorage.getItem('racPersonnelOverrides');
    if (saved) racPersonnelOverrides = JSON.parse(saved);
  } catch(e) {}
})();

function racSaveOverrides() {
  try { localStorage.setItem('racPersonnelOverrides', JSON.stringify(racPersonnelOverrides)); } catch(e) {}
}
function racSetPersonnel(seg, val) {
  var n = parseInt(val, 10);
  if (!isNaN(n) && n > 0) racPersonnelOverrides[seg] = n;
  else delete racPersonnelOverrides[seg];
  racSaveOverrides(); renderRAC();
}
function racToggleIH(ih) {
  if (!racSelectedIHs) racSelectedIHs = new Set();
  if (racSelectedIHs.has(ih)) racSelectedIHs.delete(ih); else racSelectedIHs.add(ih);
  renderRAC();
}
function racSelectAllIH() { racSelectedIHs = null; renderRAC(); }
function racToggleLocation(loc) {
  if (!racSelectedLocations) racSelectedLocations = new Set();
  if (racSelectedLocations.has(loc)) racSelectedLocations.delete(loc); else racSelectedLocations.add(loc);
  renderRAC();
}
function racSelectAllLocations() { racSelectedLocations = null; renderRAC(); }
function racToggleSEG(seg) {
  if (!racSelectedSEGs) racSelectedSEGs = new Set();
  if (racSelectedSEGs.has(seg)) racSelectedSEGs.delete(seg); else racSelectedSEGs.add(seg);
  renderRAC();
}
function racSelectAllSEGs() { racSelectedSEGs = null; renderRAC(); }
function racSelectNoSEGs()  { racSelectedSEGs = new Set(); renderRAC(); }

function calcRAC(utl, personnel) {
  if (utl === null || isNaN(utl) || personnel < 1) return null;
  var lt82 = utl < 82, lt10 = personnel < 10;
  if (lt82 &&  lt10) return 4;
  if (lt82 && !lt10) return 3;
  if (!lt82 &&  lt10) return 3;
  return 2;
}

function racBadge(rac) {
  if (rac === null) return '<span style="color:var(--text3); font-size:12px;">—</span>';
  var bg  = rac === 2 ? '#fcebeb' : rac === 3 ? '#fff8e6' : '#e1f5ee';
  var col = rac === 2 ? '#a32d2d' : rac === 3 ? '#7a4f00' : '#085041';
  var label = rac === 2 ? 'RAC 2 — High' : rac === 3 ? 'RAC 3 — Medium' : 'RAC 4 — Low';
  return '<span style="display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; background:' + bg + '; color:' + col + ';">' + label + '</span>';
}

function renderRAC() {
  var ihChipsEl  = document.getElementById('racIHChips');
  var locChipsEl = document.getElementById('racLocationChips');
  var segChipsEl = document.getElementById('racSegChips');
  var resultsEl  = document.getElementById('racResults');
  if (!resultsEl) return;

  var allIHs  = [...new Set(surveys.map(function(s){ return s.ih?.name || s.deviceNickname || ''; }).filter(Boolean))].sort();
  var allLocs = [...new Set(surveys.map(function(s){ return s.employee?.location || ''; }).filter(Boolean))].sort();
  var allSEGs = [...new Set(surveys.map(function(s){ return s.employee?.seg || ''; }).filter(Boolean))].sort();

  if (racSelectedIHs       === null) racSelectedIHs       = new Set(allIHs);
  if (racSelectedLocations === null) racSelectedLocations = new Set(allLocs);
  if (racSelectedSEGs      === null) racSelectedSEGs      = new Set(allSEGs);

  function chipHtml(label, active, onclick) {
    return '<button onclick="' + onclick + '" style="padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; cursor:pointer;'
      + 'border:1.5px solid ' + (active ? 'var(--teal)' : 'var(--border)') + ';'
      + 'background:' + (active ? 'rgba(0,184,160,0.12)' : 'var(--surface)') + ';'
      + 'color:' + (active ? 'var(--teal)' : 'var(--text2)') + ';">' + esc(label) + '</button>';
  }

  if (ihChipsEl)  ihChipsEl.innerHTML  = '<button class="btn btn-outline btn-sm" onclick="racSelectAllIH()" style="padding:3px 9px; font-size:10px;">All IHs</button>' + allIHs.map(function(ih) { return chipHtml(ih, racSelectedIHs.has(ih), "racToggleIH('" + esc(ih) + "')"); }).join('');
  if (locChipsEl) locChipsEl.innerHTML = '<button class="btn btn-outline btn-sm" onclick="racSelectAllLocations()" style="padding:3px 9px; font-size:10px;">All Locations</button>' + allLocs.map(function(loc) { return chipHtml(loc, racSelectedLocations.has(loc), "racToggleLocation('" + esc(loc) + "')"); }).join('');
  if (segChipsEl) segChipsEl.innerHTML = allSEGs.map(function(seg) { return chipHtml(seg, racSelectedSEGs.has(seg), "racToggleSEG('" + esc(seg) + "')"); }).join('');

  var sel = surveys.filter(function(s) {
    var ih  = s.ih?.name || s.deviceNickname || '';
    var loc = s.employee?.location || '';
    var seg = s.employee?.seg || '';
    return (!allIHs.length || racSelectedIHs.has(ih))
        && (!allLocs.length || racSelectedLocations.has(loc))
        && (racSelectedSEGs === null || racSelectedSEGs.has(seg));
  });

  if (!sel.length || !allSEGs.length) {
    resultsEl.innerHTML = '<div class="empty-state"><div class="empty-title">No surveys match the selected filters</div><div class="empty-sub">Adjust filters or add survey data with SEG assignments</div></div>';
    return;
  }

  var segGroups = {};
  sel.forEach(function(s) {
    var seg = s.employee?.seg || 'Unknown';
    if (!segGroups[seg]) segGroups[seg] = [];
    segGroups[seg].push(s);
  });
  var segs = Object.keys(segGroups).sort();

  var summaryRows = segs.map(function(seg) {
    var group = segGroups[seg];
    var twas  = group.map(function(s){ return parseFloat(s.results?.twa); }).filter(function(n){ return !isNaN(n); });
    var stats = lognormalStats(twas);
    var utl   = stats ? stats.utl95_95 : (twas.length === 1 ? twas[0] : null);
    var utlNA = !twas.length;
    var surveyCt  = group.length;
    var personnel = racPersonnelOverrides[seg] || surveyCt;
    var rac = utlNA ? null : calcRAC(utl, personnel);
    var utlDisplay = utlNA
      ? '<span style="background:#fff3c4;color:#7a5800;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Not Applicable — No samples taken</span>'
      : (utl !== null ? utl.toFixed(2) + ' dBA' : '—');
    var utlBg = (!utlNA && utl !== null) ? (utl >= 90 ? 'background:#fcebeb;' : utl >= 82 ? 'background:#fff8e6;' : '') : 'background:#fff3c4;';
    var overrideSet = racPersonnelOverrides.hasOwnProperty(seg);
    var segKey = seg.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var inputStyle = 'width:60px;padding:4px 6px;font-size:13px;font-weight:600;text-align:center;'
      + 'border:1.5px solid ' + (overrideSet ? 'var(--teal)' : 'var(--border)') + ';'
      + 'border-radius:6px;background:' + (overrideSet ? 'rgba(0,184,160,0.08)' : 'var(--surface)') + ';color:var(--text);';
    var personnelCell = '<input type="number" min="1" style="' + inputStyle + '" value="' + personnel + '"'
      + ' onchange="racSetPersonnel(\'' + segKey + '\',this.value)" onblur="racSetPersonnel(\'' + segKey + '\',this.value)">'
      + (overrideSet ? '<div style="font-size:10px;color:var(--teal);margin-top:2px;">IH entered (' + surveyCt + ' sampled)</div>'
                     : '<div style="font-size:10px;color:var(--text3);margin-top:2px;">' + surveyCt + ' sampled — edit to override</div>');
    return '<tr style="border-bottom:1px solid var(--border);">'
      + '<td style="padding:10px 14px;font-size:13px;font-weight:600;color:var(--text);">' + esc(seg) + '</td>'
      + '<td style="padding:10px 14px;font-size:13px;text-align:center;' + utlBg + '">' + utlDisplay + '</td>'
      + '<td style="padding:10px 14px;text-align:center;">' + personnelCell + '</td>'
      + '<td style="padding:10px 14px;text-align:center;">' + racBadge(rac) + '</td>'
      + '</tr>';
  }).join('');

  var detailCards = segs.map(function(seg) {
    var group = segGroups[seg];
    var twas  = group.map(function(s){ return parseFloat(s.results?.twa); }).filter(function(n){ return !isNaN(n); });
    var stats = lognormalStats(twas);
    var utl   = stats ? stats.utl95_95 : (twas.length === 1 ? twas[0] : null);
    var utlNA = !twas.length;
    var surveyCt  = group.length;
    var personnel = racPersonnelOverrides[seg] || surveyCt;
    var rac = utlNA ? null : calcRAC(utl, personnel);
    var fmtDb = function(v) { return (v === null || isNaN(v)) ? '—' : v.toFixed(1) + ' dBA'; };
    var utlBg2  = utlNA ? 'background:#fff3c4;' : (utl !== null && utl >= 90 ? 'background:#fcebeb;' : utl !== null && utl >= 82 ? 'background:#fff8e6;' : 'background:var(--surface);');
    var utlCol2 = utlNA ? 'color:#7a5800;'       : (utl !== null && utl >= 90 ? 'color:#a32d2d;'      : utl !== null && utl >= 82 ? 'color:#7a4f00;'      : 'color:var(--text);');
    var uclBg   = (!stats || isNaN(stats.ucl95)) ? 'background:var(--surface);' : stats.ucl95 >= 90 ? 'background:#fcebeb;' : stats.ucl95 >= 82 ? 'background:#fff8e6;' : 'background:var(--surface);';
    var uclCol  = (!stats || isNaN(stats.ucl95)) ? 'color:var(--text);'         : stats.ucl95 >= 90 ? 'color:#a32d2d;'      : stats.ucl95 >= 82 ? 'color:#7a4f00;'      : 'color:var(--text);';
    var overrideSet = racPersonnelOverrides.hasOwnProperty(seg);
    var statsNote = stats && stats.smallSample
      ? '<div style="margin-top:8px;padding:7px 10px;background:#fff8e6;border:1px solid #f0a500;border-radius:6px;font-size:11px;color:#7a4f00;">&#9651; <strong>Small sample (n=' + stats.n + ', &lt;6):</strong> UTL estimate is imprecise.</div>'
      : twas.length === 1
      ? '<div style="margin-top:8px;padding:7px 10px;background:#fff8e6;border:1px solid #f0a500;border-radius:6px;font-size:11px;color:#7a4f00;">&#9651; <strong>Single sample (n=1):</strong> TWA used directly as UTL.</div>'
      : '';
    var surveyRows = group.slice().sort(function(a,b){ return (parseFloat(b.results?.twa)||0)-(parseFloat(a.results?.twa)||0); }).map(function(s) {
      var twa  = parseFloat(s.results?.twa);
      var dose = parseFloat(s.results?.dose);
      var date = s.calibration?.surveyStart ? new Date(s.calibration.surveyStart).toLocaleDateString() : '—';
      var twaC = isNaN(twa) ? 'var(--text3)' : twa >= 90 ? '#a32d2d' : twa >= 85 ? '#7a4f00' : '#085041';
      var twaBg= isNaN(twa) ? '' : twa >= 90 ? 'background:#fcebeb;' : twa >= 85 ? 'background:#fff8e6;' : '';
      return '<tr style="border-bottom:1px solid var(--border);">'
        + '<td style="padding:6px 10px;font-size:12px;color:var(--text);">' + esc(s.employee?.name||'—') + '</td>'
        + '<td style="padding:6px 10px;font-size:11px;color:var(--teal);">' + esc(s.ih?.name||s.deviceNickname||'—') + '</td>'
        + '<td style="padding:6px 10px;font-size:11px;color:var(--text2);">' + date + '</td>'
        + '<td style="padding:6px 10px;font-size:11px;color:var(--text2);">' + esc(s.employee?.location||'—') + '</td>'
        + '<td style="padding:6px 10px;font-size:12px;font-weight:700;text-align:right;color:'+twaC+';'+twaBg+'">' + (isNaN(twa)?'—':twa.toFixed(1)+' dBA') + '</td>'
        + '<td style="padding:6px 10px;font-size:12px;text-align:right;color:var(--text);">' + (isNaN(dose)?'—':dose.toFixed(1)+'%') + '</td>'
        + '</tr>';
    }).join('');
    var metricCards = [
      ['Surveys (n)', twas.length||surveyCt, 'background:var(--surface);', 'color:var(--text);'],
      ['SEG Personnel', personnel + (overrideSet ? '<div style="font-size:10px;color:var(--teal);margin-top:1px;">IH entered ('+surveyCt+' sampled)</div>' : '<div style="font-size:10px;color:var(--text3);margin-top:1px;">= surveys sampled</div>'), 'background:var(--surface);', 'color:var(--text);'],
      ['GM',        stats ? fmtDb(stats.gm) : '—',    'background:var(--surface);', 'color:var(--text);'],
      ['UCL 95%',   (!stats||isNaN(stats.ucl95)) ? '—' : fmtDb(stats.ucl95), uclBg, uclCol],
      ['UTL 95/95', utlNA ? 'N/A' : fmtDb(utl),       utlBg2, utlCol2],
    ];
    return '<div class="card" style="margin-bottom:16px;">'
      + '<div class="card-header" style="font-size:14px;display:flex;justify-content:space-between;align-items:center;">'
      + '<span>' + esc(seg) + '<span style="margin-left:8px;font-size:11px;font-weight:400;color:rgba(255,255,255,0.55);">' + personnel + ' personnel</span></span>'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + (utl !== null && !utlNA ? racLettersBtnHtml(group[0]?.employee?.location || '', seg) : '')
      + racBadge(rac) + '</div></div>'
      + '<div class="card-body" style="padding:14px 16px;">'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:12px;">'
      + metricCards.map(function(c){ return '<div style="border-radius:var(--radius);padding:8px 10px;'+c[2]+'"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">'+c[0]+'</div><div style="font-size:16px;font-weight:600;'+c[3]+'">'+c[1]+'</div></div>'; }).join('')
      + '</div>' + statsNote
      + '<div style="margin-top:12px;"><div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Survey Results</div>'
      + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:500px;">'
      + '<thead><tr style="background:var(--surface);">'
      + ['Employee','IH','Date','Location','TWA','Dose %'].map(function(h,i){ return '<th style="padding:6px 10px;font-size:10px;font-weight:600;color:var(--text3);text-align:'+(i>=4?'right':'left')+';">'+h+'</th>'; }).join('')
      + '</tr></thead><tbody>' + surveyRows + '</tbody></table></div></div></div></div>';
  }).join('');

  resultsEl.innerHTML =
    '<div class="card" style="margin-bottom:20px;">'
    + '<div class="card-header" style="font-size:13px;font-weight:700;">Noise RAC Calculations Summary</div>'
    + '<div style="padding:8px 14px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border);">&#9432; Enter the total number of personnel in each SEG in the <strong>SEG Personnel</strong> column. The default is the number of surveys sampled.</div>'
    + '<div class="card-body" style="padding:0;"><div style="overflow-x:auto;">'
    + '<table style="width:100%;border-collapse:collapse;min-width:400px;">'
    + '<thead><tr style="background:var(--surface);border-bottom:2px solid var(--border);">'
    + '<th style="padding:10px 14px;font-size:11px;font-weight:600;color:var(--text3);text-align:left;">SEG Name</th>'
    + '<th style="padding:10px 14px;font-size:11px;font-weight:600;color:var(--text3);text-align:center;">UTL (dBA)</th>'
    + '<th style="padding:10px 14px;font-size:11px;font-weight:600;color:var(--text3);text-align:center;">SEG Personnel <span style="font-weight:400;color:var(--teal);">(editable)</span></th>'
    + '<th style="padding:10px 14px;font-size:11px;font-weight:600;color:var(--text3);text-align:center;">RAC</th>'
    + '</tr></thead><tbody>' + summaryRows + '</tbody>'
    + '</table></div></div></div>'
    + detailCards;
}

function printRAC() {
  try {
    if (!window.jspdf) {
      if (confirm('PDF library not loaded. This usually means a cached version of the page is being served.\n\nClick OK to reload, or Cancel to dismiss.')) {
        window.location.reload(true);
      }
      return;
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'pt', format: 'letter' });
    var W = doc.internal.pageSize.getWidth();
    var H = doc.internal.pageSize.getHeight();
    var NAVY  = [15,  34,  53];
    var TEAL  = [0,  184, 160];
    var GRAY  = [74,  92, 114];
    var LGRAY = [235, 238, 243];
    var WHITE = [255, 255, 255];
    var RED   = [163,  45,  45];
    var AMBER = [122,  79,   0];
    var GREEN = [  8,  80,  65];
    var L  = 36;
    var R  = W - 36;
    var CW = R - L;

    function addPageFooter() {
      doc.setDrawColor(...LGRAY); doc.setLineWidth(0.5);
      doc.line(L, H - 28, R, H - 28);
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.setTextColor(...GRAY);
      doc.text('IH Field \u2014 Noise RAC Report', L, H - 16);
      doc.text('Page ' + doc.internal.getNumberOfPages(), R, H - 16, { align: 'right' });
    }

    function checkY(y, needed) {
      if (y + needed > H - 48) {
        addPageFooter();
        doc.addPage();
        y = 36;
      }
      return y;
    }

    function sectionLabel(y, label) {
      doc.setFillColor(...LGRAY); doc.rect(L, y, CW, 18, 'F');
      doc.setFontSize(8); doc.setFont('helvetica','bold');
      doc.setTextColor(...GRAY);
      doc.text(label.toUpperCase(), L + 8, y + 12);
      return y + 18;
    }

    function racColors(rac) {
      if (rac === 2) return { bg: [252,235,235], txt: RED   };
      if (rac === 3) return { bg: [255,248,230], txt: AMBER };
      if (rac === 4) return { bg: [225,245,238], txt: GREEN };
      return { bg: LGRAY, txt: GRAY };
    }

    function racLabel(rac) {
      if (rac === 2) return 'RAC 2 \u2014 High';
      if (rac === 3) return 'RAC 3 \u2014 Medium';
      if (rac === 4) return 'RAC 4 \u2014 Low';
      return '\u2014';
    }

    var fmtDb = function(v) { return (v === null || v === undefined || isNaN(v)) ? '\u2014' : v.toFixed(1) + ' dBA'; };

    // TWA warning threshold per the project's standard (per stakeholder
    // review: TWA coloring follows the standard's criterion, independent
    // of the group's RAC). Pulls from STATS_STANDARDS in stats.js so that
    // adding a new standard there automatically updates this report.
    function getWarningThreshold() {
      var ss = (typeof STATS_STANDARDS !== 'undefined') ? STATS_STANDARDS : null;
      if (!ss) return 85;
      var std = projectMeta && projectMeta.standard;
      if (std && ss[std]) return ss[std].pel;
      return ss.ACGIH.pel;  // 85 dBA — default / most conservative
    }
    var twaWarnAt = getWarningThreshold();

    // ── Collect filtered data ──────────────────────────────
    var allIHs  = [...new Set(surveys.map(function(s){ return (s.ih && s.ih.name) || s.deviceNickname || ''; }).filter(Boolean))].sort();
    var allLocs = [...new Set(surveys.map(function(s){ return (s.employee && s.employee.location) || ''; }).filter(Boolean))].sort();
    var allSEGs = [...new Set(surveys.map(function(s){ return (s.employee && s.employee.seg) || ''; }).filter(Boolean))].sort();

    var effIHs  = racSelectedIHs        !== null ? racSelectedIHs        : new Set(allIHs);
    var effLocs = racSelectedLocations  !== null ? racSelectedLocations  : new Set(allLocs);

    var sel = surveys.filter(function(s) {
      var ih  = (s.ih && s.ih.name) || s.deviceNickname || '';
      var loc = (s.employee && s.employee.location) || '';
      var seg = (s.employee && s.employee.seg) || '';
      return (!allIHs.length  || effIHs.has(ih))
          && (!allLocs.length || effLocs.has(loc))
          && (racSelectedSEGs === null || racSelectedSEGs.has(seg));
    });

    var segGroups = {};
    sel.forEach(function(s) {
      var seg = (s.employee && s.employee.seg) || 'Unknown';
      if (!segGroups[seg]) segGroups[seg] = [];
      segGroups[seg].push(s);
    });
    var segs = Object.keys(segGroups).sort();

    // ── Page 1 header ─────────────────────────────────────
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 56, 'F');
    doc.setFillColor(...TEAL); doc.rect(0, 56, W, 4,  'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(17); doc.setFont('helvetica','bold');
    doc.text('NOISE RISK ASSESSMENT CODE (RAC) REPORT', L, 26);
    doc.setFontSize(9);  doc.setFont('helvetica','normal');
    var proj = (projectMeta && projectMeta.name)     ? projectMeta.name     : '';
    var std  = (projectMeta && projectMeta.standard) ? projectMeta.standard : '';
    doc.text((proj ? proj + '  |  ' : '') + (std ? std + '  |  ' : '') + 'Printed: ' + new Date().toLocaleString(), L, 44);
    addPageFooter();

    var y = 76;

    // ── Filters ───────────────────────────────────────────
    var ihLabels  = racSelectedIHs       === null ? ['All IHs']      : [...racSelectedIHs].sort();
    var locLabels = racSelectedLocations === null ? ['All Locations'] : [...racSelectedLocations].sort();
    var segLabels = racSelectedSEGs      === null ? ['All SEGs']      : [...racSelectedSEGs].sort();

    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
    doc.text('FILTERS APPLIED', L, y + 10); y += 18;
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(30,30,30);
    doc.text('IH: '       + ihLabels.join(', '),  L, y); y += 13;
    // Site / Company — bolded for prominence (per stakeholder review).
    // Only rendered when set; falls back silently otherwise.
    if (projectMeta && projectMeta.name) {
      doc.setFont('helvetica','bold');
      doc.text('Site / Company: ' + projectMeta.name, L, y);
      doc.setFont('helvetica','normal');
      y += 13;
    }
    doc.text('Location: ' + locLabels.join(', '), L, y); y += 13;
    // SEG line: may be long — wrap with splitTextToSize so no truncation.
    var segText = 'SEG: ' + segLabels.join(', ');
    var segLines = doc.splitTextToSize(segText, CW);
    segLines.forEach(function(line) { doc.text(line, L, y); y += 13; });
    y += 7;

    // ── RAC Reference table ───────────────────────────────
    y = checkY(y, 120);
    y = sectionLabel(y, 'Noise RAC Reference Table'); y += 8;

    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
    doc.text('(1) Determine number of personnel in SEG / OEG.', L, y); y += 12;
    doc.text('(2) Calculate UTL (95th %ile / 95% confidence). For <6 samples, small-sample correction applied.', L, y); y += 12;
    doc.text('(3) Compare UTL to table below.', L, y); y += 14;

    var col0 = L, col1 = L + CW * 0.55, col2 = L + CW * 0.775;
    var rh = 20;
    doc.setFillColor(...NAVY); doc.rect(col0, y, CW, rh, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('UTL Result',    col0 + 6, y + 13);
    doc.text('< 10 people',   col1 + 6, y + 13);
    doc.text('10 or more',    col2 + 6, y + 13);
    y += rh;

    var refRows = [
      ['< 82 dBA TWA',        'RAC 4 \u2014 Low',    GREEN, 'RAC 3 \u2014 Medium', AMBER],
      ['82 dBA and over TWA', 'RAC 3 \u2014 Medium', AMBER, 'RAC 2 \u2014 High',   RED  ],
    ];
    refRows.forEach(function(r, i) {
      var rowBg = i % 2 === 0 ? [250,250,252] : WHITE;
      doc.setFillColor(...rowBg); doc.rect(col0, y, CW, rh, 'F');
      doc.setDrawColor(...LGRAY); doc.setLineWidth(0.4); doc.rect(col0, y, CW, rh, 'S');
      doc.setTextColor(40,40,40); doc.setFont('helvetica','normal'); doc.setFontSize(9);
      doc.text(r[0], col0 + 6, y + 13);
      doc.setFillColor(...r[2]); doc.roundedRect(col1 + 4, y + 4, 90, 12, 3, 3, 'F');
      doc.setTextColor(...WHITE); doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.text(r[1], col1 + 49, y + 12, { align: 'center' });
      doc.setFillColor(...r[4]); doc.roundedRect(col2 + 4, y + 4, 90, 12, 3, 3, 'F');
      doc.text(r[3], col2 + 49, y + 12, { align: 'center' });
      y += rh;
    });
    y += 20;

    // ── Summary table ─────────────────────────────────────
    y = checkY(y, 60);
    y = sectionLabel(y, 'SEG Summary'); y += 8;

    var sc = [L, L + CW*0.32, L + CW*0.55, L + CW*0.72];
    var sh = 18;
    doc.setFillColor(...NAVY); doc.rect(L, y, CW, sh, 'F');
    doc.setTextColor(...WHITE); doc.setFont('helvetica','bold'); doc.setFontSize(8);
    ['SEG Name','UTL 95/95','Personnel','RAC'].forEach(function(h, i) {
      doc.text(h, sc[i] + 6, y + 12);
    });
    y += sh;

    segs.forEach(function(seg, si) {
      y = checkY(y, 22);
      var group     = segGroups[seg];
      var twas      = group.map(function(s){ return parseFloat(s.results && s.results.twa); }).filter(function(n){ return !isNaN(n); });
      var stats     = lognormalStats(twas);
      var utl       = stats ? stats.utl95_95 : (twas.length === 1 ? twas[0] : null);
      var utlNA     = !twas.length;
      var surveyCt  = group.length;
      var personnel = racPersonnelOverrides[seg] || surveyCt;
      var rac       = utlNA ? null : calcRAC(utl, personnel);
      var rc        = racColors(rac);

      doc.setFillColor(...(si % 2 === 0 ? [248,249,251] : WHITE));
      doc.rect(L, y, CW, 22, 'F');
      doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3); doc.rect(L, y, CW, 22, 'S');
      doc.setTextColor(20,20,20); doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text(seg, sc[0] + 6, y + 14);
      doc.setFont('helvetica','normal');
      doc.text(utlNA ? 'N/A' : fmtDb(utl), sc[1] + 6, y + 14);
      doc.text(String(personnel),            sc[2] + 6, y + 14);
      if (rac !== null) {
        doc.setFillColor(...rc.bg); doc.roundedRect(sc[3] + 4, y + 4, 90, 14, 3, 3, 'F');
        doc.setTextColor(...rc.txt); doc.setFont('helvetica','bold'); doc.setFontSize(8);
        doc.text(racLabel(rac), sc[3] + 49, y + 13, { align: 'center' });
      } else {
        doc.setTextColor(...GRAY); doc.setFont('helvetica','normal'); doc.setFontSize(9);
        doc.text('\u2014', sc[3] + 6, y + 14);
      }
      y += 22;
    });
    y += 18;

    // ── Per-SEG detail sections ───────────────────────────
    segs.forEach(function(seg) {
      var group     = segGroups[seg];
      var twas      = group.map(function(s){ return parseFloat(s.results && s.results.twa); }).filter(function(n){ return !isNaN(n); });
      var stats     = lognormalStats(twas);
      var utl       = stats ? stats.utl95_95 : (twas.length === 1 ? twas[0] : null);
      var utlNA     = !twas.length;
      var surveyCt  = group.length;
      var personnel = racPersonnelOverrides[seg] || surveyCt;
      var rac       = utlNA ? null : calcRAC(utl, personnel);
      var rc        = racColors(rac);

      y = checkY(y, 80);

      // SEG header band
      doc.setFillColor(...NAVY); doc.rect(L, y, CW, 24, 'F');
      doc.setTextColor(...WHITE); doc.setFont('helvetica','bold'); doc.setFontSize(11);
      doc.text(seg, L + 8, y + 16);
      if (rac !== null) {
        doc.setFillColor(...rc.bg); doc.roundedRect(R - 100, y + 5, 92, 14, 3, 3, 'F');
        doc.setTextColor(...rc.txt); doc.setFont('helvetica','bold'); doc.setFontSize(8);
        doc.text(racLabel(rac), R - 54, y + 14, { align: 'center' });
      }
      y += 24;

      // Metrics row. Each cell is [label, value, valueColor?] — when the
      // third element is present, it overrides the default dark-grey text
      // color for the value. Used to tint UTL 95/95 red when it meets or
      // exceeds the standard's threshold (consistent with TWA coloring).
      var utlOverThreshold = !utlNA && !isNaN(utl) && utl >= twaWarnAt;
      var metrics = [
        ['n (surveys)', String(surveyCt)],
        ['Personnel',   String(personnel)],
        ['GM',          stats ? fmtDb(stats.gm) : '\u2014'],
        ['UCL 95%',     (stats && !isNaN(stats.ucl95)) ? fmtDb(stats.ucl95) : '\u2014'],
        ['UTL 95/95',   utlNA ? 'N/A' : fmtDb(utl), utlOverThreshold ? RED : null],
      ];
      var mw = CW / metrics.length;
      metrics.forEach(function(m, mi) {
        var mx = L + mi * mw;
        doc.setFillColor(245,246,248); doc.rect(mx, y, mw - 2, 34, 'F');
        doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3); doc.rect(mx, y, mw - 2, 34, 'S');
        doc.setTextColor(...GRAY); doc.setFont('helvetica','normal'); doc.setFontSize(7);
        doc.text(m[0], mx + 6, y + 10);
        var valColor = m[2] || [20,20,20];
        doc.setTextColor(...valColor); doc.setFont('helvetica','bold'); doc.setFontSize(10);
        doc.text(m[1], mx + 6, y + 26);
      });
      y += 38;

      // Method provenance line — shows how GM / UCL / UTL were derived,
      // with the relevant constants pulled from the stats object so
      // reviewers can audit the math. Rendered at caption size below the
      // metrics strip. For single-sample SEGs, stats is null — show a
      // reduced note; for zero-sample SEGs, skip entirely.
      if (twas.length >= 2 && stats) {
        y = checkY(y, 14);
        var methodLine =
          'n=' + stats.n + ' TWAs'
          + '   \u00b7   GM: exp(mean ln TWA) = ' + stats.gm.toFixed(1) + ' dBA'
          + '   \u00b7   UCL: Land\'s Exact, H(delta=' + stats.delta.toFixed(2) + ')=' + stats.t.toFixed(3)
          + '   \u00b7   UTL: Hahn-Meeker, K=' + stats.K.toFixed(3);
        doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor(...GRAY);
        // Wrap if it exceeds content width (narrow pages or long values).
        var methodLines = doc.splitTextToSize(methodLine, CW);
        methodLines.forEach(function(line) { doc.text(line, L, y + 8); y += 10; });
        doc.setFont('helvetica','normal');
        y += 2;
      } else if (twas.length === 1) {
        y = checkY(y, 12);
        doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor(...GRAY);
        doc.text('n=1 \u2014 single sample; no UCL/UTL computed (TWA used directly as UTL).', L, y + 8);
        doc.setFont('helvetica','normal');
        y += 12;
      }

      // Small-sample warning
      if (stats && stats.smallSample) {
        y = checkY(y, 18);
        doc.setFillColor(255,248,230); doc.rect(L, y, CW, 16, 'F');
        doc.setTextColor(...AMBER); doc.setFont('helvetica','normal'); doc.setFontSize(8);
        doc.text('Small sample (n=' + stats.n + ', <6): UTL estimate is imprecise.', L + 6, y + 11);
        y += 18;
      } else if (twas.length === 1) {
        y = checkY(y, 18);
        doc.setFillColor(255,248,230); doc.rect(L, y, CW, 16, 'F');
        doc.setTextColor(...AMBER); doc.setFont('helvetica','normal'); doc.setFontSize(8);
        doc.text('Single sample (n=1): TWA used directly as UTL.', L + 6, y + 11);
        y += 18;
      }

      // Survey results table header
      y = checkY(y, 22);
      var dc = [L, L+CW*0.22, L+CW*0.40, L+CW*0.56, L+CW*0.72, L+CW*0.86];
      // Draws the Employee/IH/Date/Location/TWA/Dose% column header.
      // Factored out so it can be re-drawn on continuation pages when a
      // SEG's employee rows span a page break.
      function drawColumnHeader(y2) {
        doc.setFillColor(235,238,243); doc.rect(L, y2, CW, 16, 'F');
        doc.setTextColor(...GRAY); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
        ['Employee','IH','Date','Location','TWA','Dose %'].forEach(function(h, i) {
          doc.text(h, dc[i] + 4, y2 + 11);
        });
        return y2 + 16;
      }
      // Draws a lightweight "continuation" banner at the top of a new
      // page when the employee rows wrap: the SEG name with a
      // "(continued)" suffix + RAC badge, followed by the column header.
      // Deliberately lighter than the full SEG block above — no metrics
      // strip, no method line — because the reader can flip back one
      // page for those. Just enough context to identify the rows.
      function drawSEGContinuation(y2) {
        doc.setFillColor(...NAVY); doc.rect(L, y2, CW, 20, 'F');
        doc.setTextColor(...WHITE); doc.setFont('helvetica','bold'); doc.setFontSize(10);
        doc.text(seg + ' (continued)', L + 8, y2 + 14);
        if (rac !== null) {
          doc.setFillColor(...rc.bg); doc.roundedRect(R - 100, y2 + 4, 92, 12, 3, 3, 'F');
          doc.setTextColor(...rc.txt); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
          doc.text(racLabel(rac), R - 54, y2 + 12, { align: 'center' });
        }
        y2 += 20;
        return drawColumnHeader(y2);
      }
      y = drawColumnHeader(y);

      // Survey rows
      group.slice().sort(function(a,b){
        return (parseFloat(b.results && b.results.twa)||0) - (parseFloat(a.results && a.results.twa)||0);
      }).forEach(function(s, ri) {
        // Detect whether checkY triggered a page break; if so, redraw
        // the SEG continuation header so orphaned rows stay identified.
        var yBefore = y;
        y = checkY(y, 16);
        if (y < yBefore) y = drawSEGContinuation(y);
        var twa  = parseFloat(s.results && s.results.twa);
        var dose = parseFloat(s.results && s.results.dose);
        var date = (s.calibration && s.calibration.surveyStart)
          ? new Date(s.calibration.surveyStart).toLocaleDateString() : '\u2014';
        // Binary TWA coloring per stakeholder review: warning (red) at
        // or above the standard's threshold, neutral below. Independent
        // of the SEG's RAC tint.
        var twaColor = isNaN(twa) ? GRAY : twa >= twaWarnAt ? RED : [20,20,20];

        doc.setFillColor(...(ri % 2 === 0 ? [251,252,254] : WHITE));
        doc.rect(L, y, CW, 16, 'F');
        doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2); doc.rect(L, y, CW, 16, 'S');
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
        doc.setTextColor(20,20,20);
        doc.text((s.employee && s.employee.name) || '\u2014', dc[0]+4, y+11);
        doc.setTextColor(...TEAL);
        doc.text((s.ih && s.ih.name) || s.deviceNickname || '\u2014', dc[1]+4, y+11);
        doc.setTextColor(20,20,20);
        doc.text(date, dc[2]+4, y+11);
        doc.text((s.employee && s.employee.location) || '\u2014', dc[3]+4, y+11);
        doc.setTextColor(...twaColor); doc.setFont('helvetica','bold');
        doc.text(isNaN(twa) ? '\u2014' : twa.toFixed(1)+' dBA', dc[4]+4, y+11);
        doc.setTextColor(20,20,20); doc.setFont('helvetica','normal');
        doc.text(isNaN(dose) ? '\u2014' : dose.toFixed(1)+'%', dc[5]+4, y+11);
        y += 16;
      });
      y += 20;
    });

    addPageFooter();

    // ── Save ──────────────────────────────────────────────
    var projName = (projectMeta && projectMeta.name) ? projectMeta.name.replace(/\s+/g,'-') : 'Project';
    doc.save('NoiseRAC_' + projName + '_' + new Date().toISOString().slice(0,10) + '.pdf');
    showToast('RAC PDF exported', 'success');

  } catch(e) {
    showToast('RAC PDF export failed: ' + e.message, 'error');
    console.error(e);
  }
}
