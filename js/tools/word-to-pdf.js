/* ============================================================
   iLikePDF — Word to PDF logic
   Uses mammoth (.docx → HTML) + html2canvas + jsPDF
   ============================================================ */
(function () {
  'use strict';

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
  var previewEl   = document.getElementById('docxPreview');

  var pageSizeSel = document.getElementById('pageSize');
  var marginSel   = document.getElementById('margin');

  var convertBtn  = document.getElementById('convertBtn');
  var resetBtn    = document.getElementById('resetBtn');
  var resetFromRes = document.getElementById('resetFromResult');

  var pagesUsed   = document.getElementById('pagesUsed');
  var wordsCount  = document.getElementById('wordsCount');
  var pdfSize     = document.getElementById('pdfSize');
  var downloadBtn = document.getElementById('downloadBtn');

  /* ---------- State ---------- */
  var currentFile = null;
  var currentHtml = '';
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
    currentHtml = '';
    fileInput.value = '';
    previewEl.innerHTML = '';
    workspace.hidden = true;
    resultEl.hidden = true;
    loadingEl.hidden = true;
    dropzone.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function countWords(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var text = (tmp.textContent || '').trim();
    return text.split(/\s+/).filter(Boolean).length;
  }

  /* ---------- Load .docx file ---------- */
  async function loadFile(file) {
    if (!file) return;

    var isDocx = /\.docx$/i.test(file.name);
    if (!isDocx) {
      alert('Please select a .docx file (older .doc format is not supported).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('File is larger than 50 MB. Please choose a smaller Word file.');
      return;
    }

    currentFile = file;

    loadingEl.hidden = false;
    loadingText.textContent = 'Reading your Word file…';
    dropzone.hidden = true;

    try {
      var arrayBuffer = await file.arrayBuffer();

      var options = {
        convertImage: mammoth.images.imgElement(function (image) {
          return image.read('base64').then(function (b64) {
            return {
              src: 'data:' + image.contentType + ';base64,' + b64
            };
          });
        }),
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Subtitle'] => h2:fresh"
        ]
      };

      var result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer }, options);

      currentHtml = result.value || '';

      fileNameEl.textContent = file.name;
      fileMetaEl.textContent = formatBytes(file.size) + ' · ~' + countWords(currentHtml).toLocaleString() + ' words';

      previewEl.innerHTML = currentHtml || '<p><em>This document appears to be empty.</em></p>';

      loadingEl.hidden = true;
      resultEl.hidden = true;
      workspace.hidden = false;

    } catch (err) {
      console.error(err);
      alert('Could not read Word file: ' + (err.message || 'Unknown error'));
      loadingEl.hidden = true;
      dropzone.hidden = false;
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
     Render HTML to PDF via html2canvas + jsPDF
     ============================================================ */
  async function htmlToPdf(html, opts) {
    var jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFCtor) throw new Error('jsPDF not loaded');

    // ---- Build a styled container in an off-screen area ----
    var PAGE = {
      a4:     { w: 595.28, h: 841.89 },
      letter: { w: 612,    h: 792 }
    }[opts.pageSize] || { w: 595.28, h: 841.89 };

    var marginPt = opts.margin; // pt
    var contentWpt = PAGE.w - marginPt * 2;

    // Pixel-per-point scale for crisp rendering
    var PX_PER_PT = 2;
    var containerWpx = contentWpt * PX_PER_PT;

    var container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.width = containerWpx + 'px';
    container.style.padding = '0';
    container.style.margin = '0';
    container.style.background = '#FFFFFF';
    container.style.color = '#111111';
    container.style.fontFamily = "Georgia, 'Times New Roman', serif";
    container.style.fontSize = (11 * PX_PER_PT) + 'px';
    container.style.lineHeight = '1.55';
    container.style.boxSizing = 'border-box';
    container.innerHTML = html;
    document.body.appendChild(container);

    // Basic styles for headings, lists, images, tables inside container
    var styleTag = document.createElement('style');
    styleTag.textContent =
      '.__pdf-h h1{font-family:"Helvetica","Arial",sans-serif;font-size:' + (22 * PX_PER_PT) + 'px;font-weight:800;margin:0 0 ' + (10 * PX_PER_PT) + 'px;color:#111;}' +
      '.__pdf-h h2{font-family:"Helvetica","Arial",sans-serif;font-size:' + (17 * PX_PER_PT) + 'px;font-weight:700;margin:' + (14 * PX_PER_PT) + 'px 0 ' + (6 * PX_PER_PT) + 'px;color:#111;}' +
      '.__pdf-h h3{font-family:"Helvetica","Arial",sans-serif;font-size:' + (14 * PX_PER_PT) + 'px;font-weight:700;margin:' + (12 * PX_PER_PT) + 'px 0 ' + (4 * PX_PER_PT) + 'px;color:#111;}' +
      '.__pdf-h p{margin:0 0 ' + (8 * PX_PER_PT) + 'px;}' +
      '.__pdf-h ul,.__pdf-h ol{margin:' + (4 * PX_PER_PT) + 'px 0 ' + (8 * PX_PER_PT) + 'px;padding-left:' + (22 * PX_PER_PT) + 'px;}' +
      '.__pdf-h li{margin:' + (2 * PX_PER_PT) + 'px 0;}' +
      '.__pdf-h img{max-width:100%;height:auto;display:block;margin:' + (6 * PX_PER_PT) + 'px 0;}' +
      '.__pdf-h table{width:100%;border-collapse:collapse;margin:' + (8 * PX_PER_PT) + 'px 0;font-size:' + (10 * PX_PER_PT) + 'px;}' +
      '.__pdf-h table td,.__pdf-h table th{border:1px solid #cccccc;padding:' + (4 * PX_PER_PT) + 'px ' + (6 * PX_PER_PT) + 'px;text-align:left;}' +
      '.__pdf-h table th{background:#f2f2f2;font-weight:700;}' +
      '.__pdf-h strong,.__pdf-h b{font-weight:700;}' +
      '.__pdf-h em,.__pdf-h i{font-style:italic;}';

    container.classList.add('__pdf-h');
    document.head.appendChild(styleTag);

    try {
      // Wait for images (if any)
      var imgs = container.querySelectorAll('img');
      await Promise.all(Array.prototype.slice.call(imgs).map(function (img) {
        return new Promise(function (res) {
          if (img.complete && img.naturalWidth > 0) return res();
          img.addEventListener('load', function () { res(); }, { once: true });
          img.addEventListener('error', function () { res(); }, { once: true });
        });
      }));

      // Capture full container as one tall canvas
      loadingText.textContent = 'Rendering document…';
      var canvas = await html2canvas(container, {
        backgroundColor: '#FFFFFF',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: containerWpx,
        width: containerWpx
      });

      // Setup PDF
      var pdf = new jsPDFCtor({
        unit: 'pt',
        format: [PAGE.w, PAGE.h],
        orientation: 'portrait',
        compress: true
      });

      var pageIndex = 0;
      var contentHpt = PAGE.h - marginPt * 2;
      var pxPerPtY = canvas.height / (container.scrollHeight || canvas.height);
      // Convert: 1 pt in the PDF = PX_PER_PT pixels horizontally in the canvas
      var pageHeightPx = contentHpt * PX_PER_PT;

      var totalHpx = canvas.height;
      var offsetY = 0;

      while (offsetY < totalHpx) {
        var sliceHpx = Math.min(pageHeightPx, totalHpx - offsetY);

        // Slice canvas
        var sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHpx;
        var ctx = sliceCanvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);

        var sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);

        if (pageIndex > 0) pdf.addPage([PAGE.w, PAGE.h], 'portrait');

        var sliceHpt = sliceHpx / PX_PER_PT;
        pdf.addImage(
          sliceData,
          'JPEG',
          marginPt,
          marginPt,
          contentWpt,
          sliceHpt,
          undefined,
          'FAST'
        );

        offsetY += sliceHpx;
        pageIndex++;
      }

      var blob = pdf.output('blob');
      return { blob: blob, pages: pageIndex };

    } finally {
      container.remove();
      styleTag.remove();
    }
  }

  /* ============================================================
     Convert button
     ============================================================ */
  if (convertBtn) {
    convertBtn.addEventListener('click', async function () {
      if (!currentFile || !currentHtml) return;

      if (!window.html2canvas) {
        alert('html2canvas library not loaded. Please refresh.');
        return;
      }
      var jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!jsPDFCtor) {
        alert('jsPDF library not loaded. Please refresh.');
        return;
      }

      var opts = {
        pageSize: pageSizeSel.value,
        margin: Number(marginSel.value)
      };

      workspace.hidden = true;
      resultEl.hidden = true;
      loadingEl.hidden = false;
      loadingText.textContent = 'Preparing document…';

      try {
        var result = await htmlToPdf(currentHtml, opts);

        var words = countWords(currentHtml);
        pagesUsed.textContent = result.pages + ' page' + (result.pages === 1 ? '' : 's');
        wordsCount.textContent = words.toLocaleString() + ' words';
        pdfSize.textContent = formatBytes(result.blob.size);

        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(result.blob);

        var baseName = currentFile.name.replace(/\.docx$/i, '');
        downloadBtn.href = downloadUrl;
        downloadBtn.setAttribute('download', baseName + '.pdf');

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
