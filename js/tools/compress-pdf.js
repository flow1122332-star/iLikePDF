/* ============================================================
   iLikePDF — PDF Compressor logic
   Uses pdf-lib (rebuild) + pdf.js (render pages)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- PDF.js worker setup ---------- */
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

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

  var targetWrap  = document.getElementById('targetWrap');
  var targetSizeInput = document.getElementById('targetSize');

  var compressBtn = document.getElementById('compressBtn');
  var resetBtn    = document.getElementById('resetBtn');
  var resetFromRes = document.getElementById('resetFromResult');

  var origSizeEl  = document.getElementById('origSize');
  var newSizeEl   = document.getElementById('newSize');
  var savedPctEl  = document.getElementById('savedPercent');
  var downloadBtn = document.getElementById('downloadBtn');

  /* ---------- State ---------- */
  var currentFile = null;
  var currentPdfBytes = null;
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
    currentPdfBytes = null;
    fileInput.value = '';
    workspace.hidden = true;
    resultEl.hidden = true;
    loadingEl.hidden = true;
    dropzone.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Toggle target size input ---------- */
  var radios = document.querySelectorAll('input[name="level"]');
  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      var isTarget = document.querySelector('input[name="level"]:checked').value === 'target';
      targetWrap.hidden = !isTarget;
    });
  });

  /* ---------- Load PDF ---------- */
  async function loadFile(file) {
    if (!file) return;

    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      alert('Please select a PDF file.');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      alert('File is larger than 100 MB. Please choose a smaller PDF.');
      return;
    }

    currentFile = file;

    // Load and count pages
    try {
      var buf = await file.arrayBuffer();
      currentPdfBytes = new Uint8Array(buf);

      var pdf = await pdfjsLib.getDocument({ data: currentPdfBytes.slice() }).promise;

      fileNameEl.textContent = file.name;
      fileMetaEl.textContent = formatBytes(file.size) + ' · ' + pdf.numPages + ' page' + (pdf.numPages === 1 ? '' : 's');

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

  /* ---------- Drag and drop ---------- */
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

  /* ---------- Compression presets ---------- */
  var PRESETS = {
    light:    { scale: 1.2, quality: 0.82, label: 'Light compression' },
    balanced: { scale: 1.0, quality: 0.62, label: 'Balanced compression' },
    strong:   { scale: 0.85, quality: 0.42, label: 'Strong compression' }
  };

  /* ---------- Core: render pages → JPEG → new PDF ---------- */
  async function compressAt(bytes, scale, quality, onProgress) {
    var loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
    var pdf = await loadingTask.promise;

    var newPdf = await PDFLib.PDFDocument.create();

    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var viewport = page.getViewport({ scale: scale });

      var canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      var ctx = canvas.getContext('2d');

      // White background (avoid transparent black)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      var jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
      var jpegBytes = dataUrlToUint8(jpegDataUrl);

      var img = await newPdf.embedJpg(jpegBytes);

      // Original page size in PDF points
      var origViewport = page.getViewport({ scale: 1 });
      var p = newPdf.addPage([origViewport.width, origViewport.height]);
      p.drawImage(img, {
        x: 0,
        y: 0,
        width: origViewport.width,
        height: origViewport.height
      });

      if (onProgress) onProgress(i, pdf.numPages);
    }

    return await newPdf.save({ useObjectStreams: true });
  }

  function dataUrlToUint8(dataUrl) {
    var base64 = dataUrl.split(',')[1];
    var binary = atob(base64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /* ---------- Compress button ---------- */
  if (compressBtn) {
    compressBtn.addEventListener('click', async function () {
      if (!currentFile || !currentPdfBytes) return;

      var level = document.querySelector('input[name="level"]:checked').value;

      workspace.hidden = true;
      resultEl.hidden = true;
      loadingEl.hidden = false;

      try {
        var finalBytes = null;

        if (level === 'target') {
          finalBytes = await compressToTarget(currentPdfBytes);
        } else {
          var preset = PRESETS[level] || PRESETS.balanced;
          loadingText.textContent = preset.label + '…';
          finalBytes = await compressAt(
            currentPdfBytes,
            preset.scale,
            preset.quality,
            function (i, total) {
              loadingText.textContent = 'Rendering page ' + i + ' of ' + total + '…';
            }
          );
        }

        // Stats
        var origSize = currentFile.size;
        var newSize  = finalBytes.length;
        var saved    = Math.max(0, Math.round((1 - newSize / origSize) * 100));

        origSizeEl.textContent = formatBytes(origSize);
        newSizeEl.textContent  = formatBytes(newSize);
        savedPctEl.textContent = saved + '%';

        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(new Blob([finalBytes], { type: 'application/pdf' }));

        var baseName = currentFile.name.replace(/\.pdf$/i, '');
        downloadBtn.href = downloadUrl;
        downloadBtn.setAttribute('download', baseName + '-compressed.pdf');

        loadingEl.hidden = true;
        resultEl.hidden = false;
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      } catch (err) {
        console.error(err);
        alert('Compression failed: ' + (err.message || 'Unknown error'));
        loadingEl.hidden = true;
        workspace.hidden = false;
      }
    });
  }

  /* ---------- Target size logic ---------- */
  async function compressToTarget(bytes) {
    var targetKB = Number(targetSizeInput.value);
    if (!targetKB || targetKB < 20) {
      alert('Please enter a target size of at least 20 KB.');
      throw new Error('Invalid target');
    }
    var targetBytes = targetKB * 1024;

    // Try progressive quality/scale steps
    var attempts = [
      { scale: 1.0,  quality: 0.70 },
      { scale: 0.9,  quality: 0.60 },
      { scale: 0.8,  quality: 0.50 },
      { scale: 0.7,  quality: 0.42 },
      { scale: 0.6,  quality: 0.35 },
      { scale: 0.5,  quality: 0.30 },
      { scale: 0.45, quality: 0.25 },
      { scale: 0.4,  quality: 0.20 }
    ];

    var best = null;

    for (var a = 0; a < attempts.length; a++) {
      var step = attempts[a];
      loadingText.textContent =
        'Trying ' + Math.round(step.quality * 100) + '% quality… (attempt ' + (a + 1) + '/' + attempts.length + ')';

      var result = await compressAt(
        bytes,
        step.scale,
        step.quality,
        function (i, total) {
          loadingText.textContent =
            'Trying ' + Math.round(step.quality * 100) + '% · page ' + i + '/' + total;
        }
      );

      if (result.length <= targetBytes) {
        best = result;
        break;
      }
      best = result; // keep last
    }

    if (!best) throw new Error('Could not compress');

    return best;
  }

  /* ---------- Footer year fallback ---------- */
  var y = document.getElementById('year');
  if (y && !y.textContent.trim()) {
    y.textContent = new Date().getFullYear();
  }

})();
