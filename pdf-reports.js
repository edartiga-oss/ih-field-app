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
    doc.text('Industrial Hygiene Field Data — Confidential', 36, 38);
    doc.setTextColor(180,200,220);
    doc.text('Survey ID: ' + s.id, W - 36, 38, { align: 'right' });

    let y = 70;
    const lineH = 16;
    const colW = (W - 72) / 3;

    function sectionHead(title, y2) {
      doc.setFillColor(...NAVY);
      doc.rect(36, y2, W - 72, 18, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(8); doc.setFont('helvetica','bold');
      doc.text(title.toUpperCase(), 40, y2 + 12);
      return y2 + 24;
    }

    function row(label, value, x, y2, w) {
      doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
      doc.text(label, x, y2);
      doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
      const valStr = String(value || '—');
      const maxW = (w || colW) - 6;
      const wrapped = doc.splitTextToSize(valStr, maxW);
      doc.text(wrapped[0], x, y2 + 10);
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
    y = grid3([
      ['Employee Name', s.employee?.name],
      ['Employee ID', s.employee?.empId],
      ['Employer / Company', s.employee?.company],
      ['Job Title', s.employee?.title],
      ['Department / Area', s.employee?.dept],
      ['Location / Facility', s.employee?.location],
    ], y);
    if (s.employee?.task) {
      doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
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
        doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(139, 26, 26);
        doc.text('(a) Corrective Measures / Action Taken', 36, y + 8);
        doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
        const cLines = doc.splitTextToSize(s.results.lasmax140CorrectiveNotes, W - 72);
        doc.text(cLines, 36, y + 18);
        y += 18 + cLines.length * 10 + 6;
      }
      if (s.results?.lasmax140InvestigationNotes) {
        doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(74, 92, 114);
        doc.text('(b) Investigation Documentation — No Source Found Above 140 dBA', 36, y + 8);
        doc.setFont('helvetica','normal'); doc.setTextColor(26,41,64);
        const dLines = doc.splitTextToSize(s.results.lasmax140InvestigationNotes, W - 72);
        doc.text(dLines, 36, y + 18);
        y += 18 + dLines.length * 10 + 6;
      }
      y += 4;
    }
    if (s.results?.notes) {
      doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
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
        doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
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
        doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...GRAY);
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
