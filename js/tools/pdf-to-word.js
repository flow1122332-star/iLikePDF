/* ============================================================
   iLikePDF — PDF to Word logic
   Uses pdf.js (extract text) + docx (build .docx)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- PDF.js worker ---------- */
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  /* ---------- docx UMD export name ---------- */
  var DocxLib = window.docx || {};
  var Document = DocxLib.Document;
  var Packer = DocxLib.Packer;
  var Paragraph = DocxLib.Paragraph;
  var TextRun = DocxLib.TextRun;
  var HeadingLevel = DocxLib.HeadingLevel;
  var PageBreak = DocxLib.PageBreak;
  var AlignmentType = DocxLib.AlignmentType;

  /* ---------- Elements ---------- */
  var dropzone    = document.getElementById('dropzone');
  var fileInput   = document.getElementById('fileInput');
  var chooseBtn   = document.getElementById('chooseFilesBtn');
  var workspace   = document.getElementById('workspace');
  var resultEl    = document.getElementById('result');
  var loadingEl   = document.getElementById('loading');
  var loadingText = document.getElementById('loadingText');

  var fileNameEl  = document.getElementById('fileName');
  var fileMetaEl  = document.getElementById('fileMeta');

  var preserveBreaksChk = document.getElementById('preserveBreaks');
  var detectHeadingsChk = document.getElementById('detectHeadings');

  var convertBtn  = document.getElementById('convertBtn');
  var resetBtn    = document.getElementById('resetBtn');
  var resetFromRes = document.getElementById('resetFromResult');

  var pagesUsed   = document.getElementById('pagesUsed');
  var wordsCount  = document.getElementById('wordsCount');
  var docxSize    = document.getElementById('docxSize');
  var downloadBtn = document.getElementById('downloadBtn');

  /* ---------- State ---------- */
  var currentFile = null;
  var currentPdf = null;
  var downloadUrl = null;

  /* ---------- Helpers ---------- */
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function resetUI() {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      downloadUrl = null;
    }
    currentFile = null;
    currentPdf = null;
    fileInput.value = '';
    workspace.hidden = true;
    resultEl.hidden = true;
    loadingEl.hidden = true;
    dropzone.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Load PDF ---------- */
  async function loadFile(file) {
    if (!file) return;

    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      alert('Please select a PDF file.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('File is larger than 50 MB. Please choose a smaller PDF.');
      return;
    }

    currentFile = file;

    try {
      var buf = await file.arrayBuffer();
      currentPdf = await pdfjsLib.getDocument({ data: buf }).promise;

      fileNameEl.textContent = file.name;
      fileMetaEl.textContent = formatBytes(file.size) + ' · ' + currentPdf.numPages + ' page' + (currentPdf.numPages === 1 ? '' : 's');

      dropzone.hidden = true;
      resultEl.hidden = true;
      loadingEl.hidden = true;
      workspace.hidden = false;
    } catch (err) {
      console.error(err);
      alert('Could not read PDF: ' + (err.message || 'Unknown error'));
    }
  }

  /* ---------- Choose file ---------- */
  if (chooseBtn && fileInput) {
    chooseBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
    });
  }

  /* ---------- Drag & drop ---------- */
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadFile(e.dataTransfer.files[0]);
      }
    });
  }

  /* ---------- Reset ---------- */
  if (resetBtn) resetBtn.addEventListener('click', resetUI);
  if (resetFromRes) resetFromRes.addEventListener('click', resetUI);

  /* ============================================================
     Text extraction from PDF page
     ============================================================ */
  async function extractPageLines(page) {
    var content = await page.getTextContent({ includeMarkedContent: false });

    var items = content.items.map(function (it) {
      return {
        text: it.str || '',
        x: it.transform ? it.transform[4] : 0,
        y: it.transform ? it.transform[5] : 0,
        w: it.width || 0,
        h: it.height || 0,
        font: it.fontName || ''
      };
    });

    // Group by line (same y, approx)
    items.sort(function (a, b) {
      // Higher y first (PDF origin bottom-left)
      if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
      return a.x - b.x;
    });

    var lines = [];
    var currentLine = [];
    var lastY = null;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (lastY === null || Math.abs(item.y - lastY) < 4) {
        currentLine.push(item);
      } else {
        if (currentLine.length) lines.push(buildLine(currentLine));
        currentLine = [item];
      }
      lastY = item.y;
    }
    if (currentLine.length) lines.push(buildLine(currentLine));

    return lines.filter(function (l) { return l.text.trim().length > 0; });
  }

  function buildLine(items) {
    items.sort(function (a, b) { return a.x - b.x; });

    var text = '';
    var prevEndX = null;
    var maxH = 0;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (prevEndX !== null) {
        var gap = it.x - prevEndX;
        // Add a space if there's a horizontal gap
        if (gap > 4 && text.charAt(text.length - 1) !== ' ') {
          text += ' ';
        }
      }
      text += it.text;
      prevEndX = it.x + it.w;
      if (it.h > maxH) maxH = it.h;
    }

    return {
      text: text.replace(/\s+/g, ' ').trim(),
      size: maxH
    };
  }

  /* ============================================================
     Build docx document
     ============================================================ */
  async function buildDocx(pdf, opts) {
    var children = [];
    var allText = '';
    var totalWords = 0;

    for (var p = 1; p <= pdf.numPages; p++) {
      loadingText.textContent = 'Extracting text from page ' + p + ' of ' + pdf.numPages + '…';

      var page = await pdf.getPage(p);
      var lines = await extractPageLines(page);

      if (p > 1 && opts.preserveBreaks) {
        children.push(new Paragraph({
          children: [new PageBreak()]
        }));
      }

      if (lines.length === 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: '[Empty page]', italics: true, color: '999999' })]
        }));
        continue;
      }

      // Average size for this page (to detect headings)
      var sizes = lines.map(function (l) { return l.size; });
      var avgSize = sizes.reduce(function (a, b) { return a + b; }, 0) / sizes.length;
      var headingThreshold = avgSize * 1.4;

      for (var l = 0; l < lines.length; l++) {
        var line = lines[l];
        var isHeading = opts.detectHeadings &&
                        line.size > headingThreshold &&
                        line.text.length < 100 &&
                        line.text.length > 2;

        allText += line.text + '\n';
        totalWords += line.text.split(/\s+/).filter(Boolean).length;

        if (isHeading) {
          children.push(new Paragraph({
            children: [new TextRun({
              text: line.text,
              bold: true,
              size: 28
            })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.text, size: 22 })],
            spacing: { after: 60 }
          }));
        }
      }
    }

    var doc = new Document({
      creator: 'iLikePDF',
      title: 'Converted Document',
      description: 'Converted from PDF via iLikePDF',
      sections: [{
        properties: {},
        children: children
      }]
    });

    var blob = await Packer.toBlob(doc);

    return {
      blob: blob,
      words: totalWords,
      pages: pdf.numPages
    };
  }

  /* ============================================================
     Convert button
     ============================================================ */
  if (convertBtn) {
    convertBtn.addEventListener('click', async function () {
      if (!currentFile || !currentPdf) return;

      if (!Document || !Packer) {
        alert('Word library not loaded. Please check your internet connection and refresh.');
        return;
      }

      var opts = {
        preserveBreaks: preserveBreaksChk ? preserveBreaksChk.checked : true,
        detectHeadings: detectHeadingsChk ? detectHeadingsChk.checked : true
      };

      workspace.hidden = true;
      resultEl.hidden = true;
      loadingEl.hidden = false;
      loadingText.textContent = 'Reading your PDF…';

      try {
        var result = await buildDocx(currentPdf, opts);

        pagesUsed.textContent = result.pages + ' pages';
        wordsCount.textContent = result.words.toLocaleString() + ' words';
        docxSize.textContent = formatBytes(result.blob.size);

        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(result.blob);

        var baseName = currentFile.name.replace(/\.pdf$/i, '');
        downloadBtn.href = downloadUrl;
        downloadBtn.setAttribute('download', baseName + '.docx');

        loadingEl.hidden = true;
        resultEl.hidden = false;
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      } catch (err) {
        console.error(err);
        alert('Conversion failed: ' + (err.message || 'Unknown error'));
        loadingEl.hidden = true;
        workspace.hidden = false;
      }
    });
  }

  /* ---------- Footer year fallback ---------- */
  var y = document.getElementById('year');
  if (y && !y.textContent.trim()) {
    y.textContent = new Date().getFullYear();
  }

})();
