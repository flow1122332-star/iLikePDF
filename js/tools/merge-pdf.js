/* ============================================================
   iLikePDF — Merge PDF logic
   ============================================================ */
(function () {
  'use strict';

  /* ---------- PDF.js worker ---------- */
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

  var mergeList   = document.getElementById('mergeList');
  var filesCount  = document.getElementById('filesCount');
  var filesMeta   = document.getElementById('filesMeta');

  var addMoreBtn  = document.getElementById('addMoreBtn');
  var mergeBtn    = document.getElementById('mergeBtn');
  var resetBtn    = document.getElementById('resetBtn');
  var resetFromRes = document.getElementById('resetFromResult');

  var filesMerged = document.getElementById('filesMerged');
  var pagesMerged = document.getElementById('pagesMerged');
  var mergedSize  = document.getElementById('mergedSize');
  var downloadBtn = document.getElementById('downloadBtn');

  /* ---------- State ---------- */
  var files = []; // { id, file, bytes, pages }
  var downloadUrl = null;
  var nextId = 1;

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
    files = [];
    nextId = 1;
    fileInput.value = '';
    mergeList.innerHTML = '';
    workspace.hidden = true;
    resultEl.hidden = true;
    loadingEl.hidden = true;
    dropzone.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateHeader() {
    var totalSize = files.reduce(function (s, f) { return s + f.file.size; }, 0);
    var totalPages = files.reduce(function (s, f) { return s + f.pages; }, 0);

    filesCount.textContent = files.length + ' file' + (files.length === 1 ? '' : 's') + ' selected';
    filesMeta.textContent = 'Total ' + formatBytes(totalSize) + ' · ' + totalPages + ' page' + (totalPages === 1 ? '' : 's');
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Render list item ---------- */
  function renderItem(item) {
    var li = document.createElement('li');
    li.className = 'merge-item';
    li.draggable = true;
    li.dataset.id = item.id;

    li.innerHTML =
      '<span class="merge-item-handle" aria-hidden="true">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">' +
          '<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>' +
          '<circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>' +
          '<circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>' +
        '</svg>' +
      '</span>' +
      '<span class="merge-item-icon" aria-hidden="true">PDF</span>' +
      '<div class="merge-item-body">' +
        '<div class="merge-item-name" title="' + esc(item.file.name) + '">' + esc(item.file.name) + '</div>' +
        '<div class="merge-item-meta">' + formatBytes(item.file.size) + ' · ' + item.pages + ' page' + (item.pages === 1 ? '' : 's') + '</div>' +
      '</div>' +
      '<button type="button" class="merge-item-remove" aria-label="Remove file">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M6 6l12 12M6 18L18 6"/>' +
        '</svg>' +
      '</button>';

    // Remove
    li.querySelector('.merge-item-remove').addEventListener('click', function (e) {
      e.stopPropagation();
      var id = Number(li.dataset.id);
      files = files.filter(function (f) { return f.id !== id; });
      li.remove();
      if (files.length === 0) {
        resetUI();
      } else {
        updateHeader();
      }
    });

    // Drag and drop reorder
    li.addEventListener('dragstart', function (e) {
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', li.dataset.id);
    });
    li.addEventListener('dragend', function () {
      li.classList.remove('dragging');
      document.querySelectorAll('.merge-item').forEach(function (x) {
        x.classList.remove('drag-over');
      });
      syncOrderFromDOM();
    });
    li.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', function () {
      li.classList.remove('drag-over');
    });
    li.addEventListener('drop', function (e) {
      e.preventDefault();
      li.classList.remove('drag-over');

      var dragId = e.dataTransfer.getData('text/plain');
      var dragEl = document.querySelector('.merge-item[data-id="' + dragId + '"]');
      if (!dragEl || dragEl === li) return;

      var rect = li.getBoundingClientRect();
      var after = (e.clientY - rect.top) > (rect.height / 2);

      if (after) {
        li.parentNode.insertBefore(dragEl, li.nextSibling);
      } else {
        li.parentNode.insertBefore(dragEl, li);
      }
      syncOrderFromDOM();
    });

    return li;
  }

  function syncOrderFromDOM() {
    var order = Array.prototype.slice.call(document.querySelectorAll('.merge-item'))
      .map(function (el) { return Number(el.dataset.id); });
    files.sort(function (a, b) {
      return order.indexOf(a.id) - order.indexOf(b.id);
    });
  }

  /* ---------- Add files ---------- */
  async function addFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList);
    var validFiles = [];

    for (var i = 0; i < arr.length; i++) {
      var f = arr[i];
      var isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (!isPdf) continue;
      if (f.size > 100 * 1024 * 1024) {
        alert(f.name + ' is larger than 100 MB and will be skipped.');
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) {
      alert('Please select valid PDF files.');
      return;
    }

    // Show loading while parsing
    loadingEl.hidden = false;
    loadingText.textContent = 'Reading PDF files…';
    dropzone.hidden = true;

    for (var j = 0; j < validFiles.length; j++) {
      var file = validFiles[j];
      try {
        var buf = await file.arrayBuffer();
        var bytes = new Uint8Array(buf);

        var pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;

        var item = {
          id: nextId++,
          file: file,
          bytes: bytes,
          pages: pdf.numPages
        };
        files.push(item);

        var li = renderItem(item);
        mergeList.appendChild(li);

      } catch (err) {
        console.error('Could not read', file.name, err);
        alert('Could not read ' + file.name + ': ' + (err.message || 'Unknown error'));
      }
    }

    loadingEl.hidden = true;
    workspace.hidden = false;
    resultEl.hidden = true;
    updateHeader();
  }

  /* ---------- Choose files ---------- */
  if (chooseBtn && fileInput) {
    chooseBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) {
        addFiles(e.target.files);
        fileInput.value = ''; // allow selecting same file again
      }
    });
  }

  if (addMoreBtn && fileInput) {
    addMoreBtn.addEventListener('click', function () { fileInput.click(); });
  }

  /* ---------- Drag and drop zone ---------- */
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
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    });
  }

  /* ---------- Reset ---------- */
  if (resetBtn) resetBtn.addEventListener('click', resetUI);
  if (resetFromRes) resetFromRes.addEventListener('click', resetUI);

  /* ---------- Merge ---------- */
  if (mergeBtn) {
    mergeBtn.addEventListener('click', async function () {
      if (files.length < 2) {
        alert('Please add at least 2 PDF files to merge.');
        return;
      }

      workspace.hidden = true;
      resultEl.hidden = true;
      loadingEl.hidden = false;
      loadingText.textContent = 'Merging ' + files.length + ' PDF files…';

      try {
        var merged = await PDFLib.PDFDocument.create();
        var totalPages = 0;

        for (var i = 0; i < files.length; i++) {
          loadingText.textContent = 'Merging file ' + (i + 1) + ' of ' + files.length + '…';

          var src = await PDFLib.PDFDocument.load(files[i].bytes);
          var pageIndices = src.getPageIndices();
          var copied = await merged.copyPages(src, pageIndices);
          copied.forEach(function (p) { merged.addPage(p); });
          totalPages += copied.length;
        }

        loadingText.textContent = 'Saving merged PDF…';
        var outBytes = await merged.save({ useObjectStreams: true });

        filesMerged.textContent = files.length + ' files';
        pagesMerged.textContent = totalPages + ' pages';
        mergedSize.textContent  = formatBytes(outBytes.length);

        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(new Blob([outBytes], { type: 'application/pdf' }));

        var first = files[0].file.name.replace(/\.pdf$/i, '');
        downloadBtn.href = downloadUrl;
        downloadBtn.setAttribute('download', first + '-merged.pdf');

        loadingEl.hidden = true;
        resultEl.hidden = false;
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      } catch (err) {
        console.error(err);
        alert('Merge failed: ' + (err.message || 'Unknown error'));
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
