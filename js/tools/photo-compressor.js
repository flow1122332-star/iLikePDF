/* ============================================================
   iLikePDF — Photo Compressor logic
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

  var fileNameEl  = document.getElementById('fileName');
  var fileMetaEl  = document.getElementById('fileMeta');
  var previewImg  = document.getElementById('previewImg');

  var qualitySlider = document.getElementById('qualitySlider');
  var qualityValue  = document.getElementById('qualityValue');
  var maxDimSelect  = document.getElementById('maxDim');

  var compressBtn  = document.getElementById('compressBtn');
  var resetBtn     = document.getElementById('resetBtn');
  var resetFromRes = document.getElementById('resetFromResult');

  var origSizeEl   = document.getElementById('origSize');
  var newSizeEl    = document.getElementById('newSize');
  var savedPctEl   = document.getElementById('savedPercent');
  var downloadBtn  = document.getElementById('downloadBtn');

  /* ---------- State ---------- */
  var currentFile = null;
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
    fileInput.value = '';
    workspace.hidden = true;
    resultEl.hidden = true;
    loadingEl.hidden = true;
    dropzone.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('File is larger than 20 MB. Please choose a smaller image.');
      return;
    }

    currentFile = file;

    var reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;

      var img = new Image();
      img.onload = function () {
        fileNameEl.textContent = file.name;
        fileMetaEl.textContent = formatBytes(file.size) + ' · ' +
                                 img.naturalWidth + ' × ' + img.naturalHeight;

        dropzone.hidden = true;
        resultEl.hidden = true;
        loadingEl.hidden = true;
        workspace.hidden = false;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------- Choose file button ---------- */
  if (chooseBtn && fileInput) {
    chooseBtn.addEventListener('click', function () {
      fileInput.click();
    });
    fileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) {
        loadFile(e.target.files[0]);
      }
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

  /* ---------- Slider live value ---------- */
  if (qualitySlider && qualityValue) {
    qualitySlider.addEventListener('input', function () {
      qualityValue.textContent = qualitySlider.value + '%';
    });
  }

  /* ---------- Reset buttons ---------- */
  if (resetBtn) resetBtn.addEventListener('click', resetUI);
  if (resetFromRes) resetFromRes.addEventListener('click', resetUI);

  /* ---------- Compress ---------- */
  if (compressBtn) {
    compressBtn.addEventListener('click', async function () {
      if (!currentFile) return;

      if (typeof imageCompression !== 'function') {
        alert('Image library not loaded. Please check your internet connection and refresh.');
        return;
      }

      var quality = Number(qualitySlider.value) / 100;
      var maxDim  = Number(maxDimSelect.value);

      var options = {
        maxSizeMB: 5,
        initialQuality: quality,
        useWebWorker: true,
        alwaysKeepResolution: maxDim === 0
      };
      if (maxDim > 0) options.maxWidthOrHeight = maxDim;

      // Show loading
      workspace.hidden = true;
      resultEl.hidden = true;
      loadingEl.hidden = false;

      try {
        var compressed = await imageCompression(currentFile, options);

        var origSize = currentFile.size;
        var newSize  = compressed.size;
        var saved    = Math.max(0, Math.round((1 - newSize / origSize) * 100));

        origSizeEl.textContent = formatBytes(origSize);
        newSizeEl.textContent  = formatBytes(newSize);
        savedPctEl.textContent = saved + '%';

        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(compressed);

        var baseName = currentFile.name.replace(/\.[^.]+$/, '');
        var ext = (currentFile.name.split('.').pop() || 'jpg').toLowerCase();
        if (ext === 'png') ext = 'jpg';
        downloadBtn.href = downloadUrl;
        downloadBtn.setAttribute('download', baseName + '-compressed.' + ext);

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

  /* ---------- Footer year (fallback if main.js fails) ---------- */
  var y = document.getElementById('year');
  if (y && !y.textContent.trim()) {
    y.textContent = new Date().getFullYear();
  }

})();
