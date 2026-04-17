// ═══════════════════════════════════════════════════════════
//  hcp-letters.js — Hearing Conservation Program
//  Batch Notification Letter PDF Generator
//
//  Depends on: window.jspdf (jsPDF 2.5.1), lognormalStats(),
//              calcRAC(), racPersonnelOverrides, surveys, esc()
// ═══════════════════════════════════════════════════════════

/**
 * racLettersBtnHtml(location, seg)
 * Returns HTML for the teal "Notification Letters" button
 * injected into each RAC detail-card header.
 */
function racLettersBtnHtml(location, seg) {
  var lk  = (location || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var sk  = (seg      || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return '<button onclick="generateHearingLettersPDF(\'' + lk + '\',\'' + sk + '\')" '
    + 'title="Generate Hearing Notification Letters for this SEG" '
    + 'style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;font-size:11px;font-weight:600;'
    + 'background:rgba(0,184,160,0.15);color:var(--teal);border:1.5px solid var(--teal);'
    + 'border-radius:6px;cursor:pointer;flex-shrink:0;white-space:nowrap;">'
    + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" '
    + 'stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>'
    + '<polyline points="14 2 14 8 20 8"/>'
    + '<line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'
    + '</svg>Hearing Notification Letter</button>';
}

/**
 * generateHearingLettersPDF(locationFilter, segFilter)
 *
 * Builds a multi-page jsPDF letter batch — one page per employee —
 * for all SEGs where a UTL was successfully calculated.
 *
 * @param {string|null} locationFilter  exact location string, or null = all
 * @param {string|null} segFilter       exact SEG string, or null = all
 */
function generateHearingLettersPDF(locationFilter, segFilter) {
  if (!window.jspdf) {
    if (confirm('PDF library not loaded. Click OK to reload the page.')) window.location.reload(true);
    return;
  }

  // ── 1. Filter surveys ──────────────────────────────────────────────
  var sel = surveys.filter(function(s) {
    var loc = s.employee?.location || '';
    var seg = s.employee?.seg      || '';
    return (!locationFilter || loc === locationFilter)
        && (!segFilter      || seg === segFilter);
  });

  if (!sel.length) {
    alert('No surveys found' + (locationFilter ? ' for location: ' + locationFilter : '') + '.'); return;
  }

  // ── 2. Group by location → SEG ────────────────────────────────────
  var locGroups = {};
  sel.forEach(function(s) {
    var loc = s.employee?.location || 'Unknown Location';
    var seg = s.employee?.seg      || 'Unknown SEG';
    if (!locGroups[loc])       locGroups[loc] = {};
    if (!locGroups[loc][seg])  locGroups[loc][seg] = [];
    locGroups[loc][seg].push(s);
  });

  // ── 3. Build letter list (only SEGs with calculable UTL) ──────────
  var letters = [];
  Object.keys(locGroups).sort().forEach(function(loc) {
    Object.keys(locGroups[loc]).sort().forEach(function(seg) {
      var group = locGroups[loc][seg];
      var twas  = group.map(function(s){ return parseFloat(s.results?.twa); }).filter(function(n){ return !isNaN(n); });
      if (!twas.length) return;
      var stats = (typeof lognormalStats === 'function') ? lognormalStats(twas) : null;
      var utl   = stats ? stats.utl95_95 : (twas.length === 1 ? twas[0] : null);
      if (utl === null) return;
      var personnel = (typeof racPersonnelOverrides !== 'undefined' && racPersonnelOverrides[seg])
                      ? racPersonnelOverrides[seg] : group.length;
      group.forEach(function(s) {
        var twa = parseFloat(s.results?.twa);
        if (isNaN(twa)) return;
        letters.push({ location: loc, seg: seg, utl: utl, personnel: personnel,
                        sampleCount: twas.length, survey: s });
      });
    });
  });

  if (!letters.length) {
    alert('No SEGs with a calculated UTL were found' + (locationFilter ? ' for this location' : '') + '.\n\nUTL requires at least one valid TWA result per SEG.');
    return;
  }

  // ── 4. jsPDF setup ────────────────────────────────────────────────
  var doc  = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
  var W    = 612;
  var H    = 792;
  var ML   = 54;   // left margin
  var MR   = 54;   // right margin
  var CW   = W - ML - MR;  // content width = 504 pt

  // Colour palette (matches IH Field app)
  var NAVY  = [15,  34,  53];
  var TEAL  = [0,  184, 160];
  var DARK  = [30,  50,  70];
  var GRAY  = [100, 115, 130];
  var LGRAY = [220, 228, 235];
  var BLACK = [22,  22,  22];

  function fillRect(x, y, w, h, rgb) {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.rect(x, y, w, h, 'F');
  }
  function setC(rgb) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }
  function hRule(y, rgb) {
    doc.setDrawColor((rgb||LGRAY)[0], (rgb||LGRAY)[1], (rgb||LGRAY)[2]);
    doc.setLineWidth(0.5);
    doc.line(ML, y, ML + CW, y);
  }

  // pdfSafe: replace Unicode chars not in Helvetica WinAnsi encoding
  // to prevent jsPDF silently switching to Courier mid-paragraph
  function pdfSafe(s) {
    return String(s)
      .replace(/\u202f/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/\u2019|\u2018/g, "'")
      .replace(/\u201c|\u201d/g, '"')
      .replace(/\u2013/g, '-')
      .replace(/\u2014/g, '--')
      .replace(/\u2014/g, '--');
  }


  // ── 5. Render each letter ─────────────────────────────────────────
  // Prime the font state once before the loop so jsPDF never falls back to Courier
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);

  letters.forEach(function(letter, idx) {
    if (idx > 0) doc.addPage();

    // Reset to known-good font state at the top of every page
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);

    var s         = letter.survey;
    var empName   = pdfSafe((s.employee?.name    || 'Employee').trim());
    var empTitle  = pdfSafe((s.employee?.title   || s.employee?.jobTitle || '').trim());
    var empComp   = pdfSafe((s.employee?.company || s.employee?.employer || '').trim());
    var twa       = parseFloat(s.results?.twa);
    var utl       = letter.utl;
    var n         = letter.sampleCount;
    var personnel = letter.personnel;
    var seg       = pdfSafe(letter.seg);
    var loc       = pdfSafe(letter.location);
    var twaStr    = twa.toFixed(1) + ' dBA';
    var utlStr    = utl.toFixed(1) + ' dBA';
    var twaColor  = twa >= 90 ? [163,45,45] : twa >= 85 ? [122,79,0] : [8,80,65];

    // Survey date
    var surveyDate = '--';
    var rawDate = s.calibration?.surveyStart || s.calibration?.date || '';
    if (rawDate) {
      try { surveyDate = new Date(rawDate).toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'}); }
      catch(e) { surveyDate = rawDate.slice(0,10); }
    }

    // Dynamic text logic
    var smallSample = n < 6;
    var aboveBelow  = twa >= 85 ? 'above' : 'below';
    var needHCP     = smallSample ? (twa >= 85) : (utl >= 85);
    var doDoNot     = needHCP ? 'do need' : 'do not need';
    var rac         = (typeof calcRAC === 'function') ? calcRAC(utl, personnel) : null;
    var racStr      = rac === 2 ? 'RAC 2 -- High' : rac === 3 ? 'RAC 3 -- Medium' : rac === 4 ? 'RAC 4 -- Low' : '--';
    var racColor    = rac === 2 ? [163,45,45] : rac === 3 ? [122,79,0] : [8,80,65];

    var y = 0;

    // ── HEADER BAND ────────────────────────────────────────────────
    fillRect(0, 0, W, 58, NAVY);

    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setC(TEAL);
    doc.text('NATIONAL GUARD BUREAU', ML, 18);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setC([165, 195, 215]);
    doc.text('REGIONAL INDUSTRIAL HYGIENE -- SOUTHEAST OFFICE', ML, 29);
    doc.text('510 PLAZA DRIVE, SUITE 1530, COLLEGE PARK, GA  30349', ML, 40);

    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setC(TEAL);
    doc.text('IH FIELD', W - MR, 18, { align: 'right' });
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setC([165, 195, 215]);
    doc.text('Noise Dosimetry', W - MR, 29, { align: 'right' });
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);

    y = 70;

    // ── TEAL ACCENT RULE ───────────────────────────────────────────
    fillRect(ML, y, CW, 2.5, TEAL);
    y += 13;

    // ── TITLE ──────────────────────────────────────────────────────
    doc.setFont('helvetica','bold'); doc.setFontSize(13); setC(NAVY);
    doc.text('Hearing Notification Letter', ML, y);
    y += 16;

    doc.setFont('helvetica','bold'); doc.setFontSize(9.5); setC(DARK);
    doc.text('Subject: Employee Notification of Noise Survey Sampling Results', ML, y);
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);
    y += 14;

    hRule(y);
    y += 13;

    // ── META INFO BOX ──────────────────────────────────────────────
    var metaH = 68;
    fillRect(ML, y, CW, metaH, [240, 246, 251]);
    doc.setDrawColor(200, 215, 228); doc.setLineWidth(0.5);
    doc.rect(ML, y, CW, metaH, 'S');

    var c1 = ML + 10, c2 = ML + 10 + CW * 0.5;

    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setC(GRAY);
    doc.text('EMPLOYEE NAME',        c1, y + 13);
    doc.text('JOB TITLE / COMPANY',  c2, y + 13);

    doc.setFont('helvetica','normal'); doc.setFontSize(10); setC(BLACK);
    doc.text(empName, c1, y + 27, { maxWidth: CW * 0.46 });
    var titleComp = (empTitle && empComp) ? empTitle + ' -- ' + empComp
                  : (empTitle || empComp || '--');
    doc.text(titleComp, c2, y + 27, { maxWidth: CW * 0.46 });

    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setC(GRAY);
    doc.text('SIMILAR EXPOSURE GROUP (SEG)', c1, y + 45);
    doc.text('SURVEY LOCATION',  c2, y + 45);

    doc.setFont('helvetica','bold'); doc.setFontSize(10); setC(BLACK);
    doc.text(seg, c1, y + 60, { maxWidth: CW * 0.46 });
    doc.setFont('helvetica','normal'); doc.setFontSize(10); setC(BLACK);
    doc.text(loc, c2, y + 60, { maxWidth: CW * 0.46 });
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);

    y += metaH + 14;

    // ── PARAGRAPH 1 ────────────────────────────────────────────────
    var LH = 13.5; // consistent line height for 10.5pt body text

    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);
    var p1a = '1.  Department of the Army (DA) regulations require employees to be notified of their exposure '
            + 'results from Industrial Hygiene surveys. The following results are from the noise survey '
            + 'performed on:';
    var p1aLines = doc.splitTextToSize(p1a, CW);
    doc.text(p1aLines, ML, y);
    y += p1aLines.length * LH + 4;

    doc.setFont('helvetica','bolditalic'); doc.setFontSize(10.5); setC([0, 95, 160]);
    var dateLines = doc.splitTextToSize(surveyDate, CW - 20);
    doc.text(dateLines, ML + 16, y);
    y += dateLines.length * LH + 8;

    // ── TWA RESULT BOX ─────────────────────────────────────────────
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);
    var twaBoxH = 40;
    fillRect(ML, y, CW, twaBoxH, [230, 248, 242]);
    doc.setDrawColor(0, 184, 160); doc.setLineWidth(1);
    doc.rect(ML, y, CW, twaBoxH, 'S');

    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setC(GRAY);
    doc.text('EMPLOYEE PERSONAL NOISE EXPOSURE -- 8-HOUR TIME WEIGHTED AVERAGE (TWA)', ML + 10, y + 13);

    doc.setFont('helvetica','bold'); doc.setFontSize(13.5); setC(twaColor);
    doc.text(empName + '     ' + twaStr, ML + 10, y + 31);

    y += twaBoxH + 14;

    // ── PARAGRAPH 2 ────────────────────────────────────────────────
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);
    var p2;
    if (smallSample) {
      // n < 6: UTL cannot be calculated, base HCP decision on individual TWA
      var empCount = n === 1
        ? "1 employee's individual result"
        : n + " employees' individual results";
      p2 = '2.  This employee was designated to the ' + seg + ' SEG and there '
         + (n === 1 ? 'was ' : 'were ') + empCount + '. A Upper Tolerance Limit (UTL) '
         + 'could not be calculated because fewer than 6 samples were available for this SEG. '
         + "The employee's individual 8-hr TWA result of " + twaStr + ' indicates levels '
         + aboveBelow + ' the Department of the Army, Department of Defense Instruction '
         + '(DoDI) 6055.12 noise standard of 85 dBA. Based on this individual result, you '
         + doDoNot + ' to be included in the Hearing Conservation Program.';
    } else {
      // n >= 6: UTL calculated, base HCP decision on UTL
      var however = twa >= 85 ? '' : 'However, ';
      var capB    = however ? 'b' : 'B';
      p2 = '2.  This employee was designated to the ' + seg + ' SEG and there were '
         + "more than 6 employees' individual results. Therefore, a statistical calculation "
         + 'called the Upper Tolerance Limit (UTL) was able to be calculated at the 95% '
         + 'confidence level to a result of ' + utlStr + ". The employee's exposure "
         + 'indicates levels ' + aboveBelow + ' the Department of the Army, Department of '
         + 'Defense Instruction (DoDI) 6055.12 noise standard of 85 dBA. '
         + (however ? 'However, based on the SEG UTL calculation result of ' : 'Based on this result and the SEG UTL calculation result of ')
         + utlStr + ', you ' + doDoNot + ' to be included in the Hearing Conservation Program.';
    }
    var p2Lines = doc.splitTextToSize(p2, CW);
    doc.text(p2Lines, ML, y);
    y += p2Lines.length * LH + 8;

    // ── PARAGRAPH 3 ────────────────────────────────────────────────
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);
    doc.text('3.  As a precaution you should continue to:', ML, y);
    y += LH + 2;

    var BIND  = ML + 10;  // bullet first-line x
    var BHANG = ML + 30;  // hanging indent x for wrapped lines (aligns with text after "b.  ")

    // Bullets a, c, d — simple wrap at BIND
    var simpleBullets = [
      'a.  Wear either earplugs or muffs whenever noise levels are greater than or equal to 85 dBA.',
      'c.  Have a copy of this notification letter placed in your employee file.',
      'd.  If you have any questions regarding this matter, contact the State Occupational Health Office.'
    ];

    // Bullet b — hanging indent so wrapped line aligns under "Obey"
    var bulletB     = 'b.  Obey warning signs throughout the installation in noise hazardous areas and on equipment which require personnel to wear hearing protection.';
    var bulletBFirst = doc.splitTextToSize(bulletB, CW - 10)[0];
    var bulletBRest  = doc.splitTextToSize(bulletB, CW - 10).slice(1);

    // Render a, then b, then c, d in order
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);
    var aLines = doc.splitTextToSize(simpleBullets[0], CW - 10);
    doc.text(aLines, BIND, y);
    y += aLines.length * LH + 3;

    // Bullet b with hanging indent
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);
    var bAllLines = doc.splitTextToSize(bulletB, CW - 10);
    doc.text(bAllLines[0], BIND, y);
    if (bAllLines.length > 1) {
      doc.text(bAllLines.slice(1), BHANG, y + LH);
    }
    y += bAllLines.length * LH + 3;

    // Bullets c and d
    [simpleBullets[1], simpleBullets[2]].forEach(function(bullet) {
      doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);
      var bLines = doc.splitTextToSize(bullet, CW - 10);
      doc.text(bLines, BIND, y);
      y += bLines.length * LH + 3;
    });

    // ── UTL STATS CALLOUT BOX (only if space remains) ──────────────
    y += 8;
    if (y < H - 110) {
      var statsBoxH = 52;
      fillRect(ML, y, CW, statsBoxH, [247, 250, 253]);
      doc.setDrawColor(190, 205, 220); doc.setLineWidth(0.5);
      doc.rect(ML, y, CW, statsBoxH, 'S');

      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setC(GRAY);
      doc.text('UTL CALCULATION SUMMARY', ML + 10, y + 13);

      var cols = [ML + 10, ML + 10 + CW * 0.25, ML + 10 + CW * 0.5, ML + 10 + CW * 0.75];
      var labels = ['Samples (n)', 'UTL 95/95', 'SEG Personnel', 'RAC'];
      labels.forEach(function(h, i) { doc.text(h, cols[i], y + 26); });

      doc.setFont('helvetica','bold'); doc.setFontSize(11.5);
      var utlColor = utl >= 85 ? [163,45,45] : [8,80,65];
      setC(BLACK);    doc.text(String(n),         cols[0], y + 42);
      setC(utlColor); doc.text(utlStr,             cols[1], y + 42);
      setC(BLACK);    doc.text(String(personnel),  cols[2], y + 42);
      setC(racColor); doc.text(racStr,              cols[3], y + 42);
      doc.setFont('helvetica','normal'); doc.setFontSize(10.5); setC(BLACK);

      y += statsBoxH + 10;
    }

    // ── FOOTER ─────────────────────────────────────────────────────
    fillRect(0, H - 34, W, 34, NAVY);
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setC([145, 178, 200]);
    doc.text('IH Field -- Noise Dosimetry  |  Hearing Notification Letter', ML, H - 18);
    doc.text(
      'Generated: ' + new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}),
      ML, H - 8
    );
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setC([145, 178, 200]);
    doc.text('CONTROLLED DISTRIBUTION -- FOR EMPLOYEE FILE USE ONLY', W - MR, H - 13, { align: 'right' });
  });

  // ── 6. Save ───────────────────────────────────────────────────────
  var locPart = segFilter
    ? (locationFilter || 'All') + '_' + segFilter
    : (locationFilter || 'All_Locations');
  var filename = 'Hearing_Notification_Letter_' + locPart.replace(/[^a-zA-Z0-9_\-]/g,'_').substring(0,50)
               + '_' + new Date().toISOString().slice(0,10) + '.pdf';
  doc.save(filename);

  if (typeof showToast === 'function') {
    showToast('Generated ' + letters.length + ' Hearing Notification Letter' + (letters.length !== 1 ? 's' : ''), 'success');
  }
}
