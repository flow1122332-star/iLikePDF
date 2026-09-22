/* ============================================================
   iLikePDF — JPG to PDF logic
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

  var imageList   = document.getElementById('imageList');
  var filesCount  = document.getElementById('filesCount');
  var filesMeta   = document.getElementById('filesMeta');

  var addMoreBtn  = document.getElementById('addMoreBtn');
  var convertBtn  = document.getElementById('convertBtn');
  var resetBtn    = document.getElementById('resetBtn');
  var resetFromRes = document.getElementById('resetFromResult');

  var pageSizeSel = document.getElementById('pageSize');
  var orientationSel = document.getElementById('orientation');
  var marginSel   = document.getElementById('margin');

  var imagesUsed  = document.getElementById('imagesUsed');
  var pagesCount  = document.getElementById('pagesCount');
  var pdfSize     = document.getElementById('pdfSize');
  var downloadBtn = document.getElementById('downloadBtn');

  /* ---------- State ---------- */
  var items = []; // { id, file, dataUrl, width, height, rotation }
  var downloadUrl = null;
  var nextId = 1;

  /* ---------- Helpers ---------- */
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function resetUI() {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      downloadUrl = null;
    }
    items = [];
    nextId = 1;
    fileInput.value = '';
    imageList.innerHTML = '';
    workspace.hidden = true;
    resultEl.hidden = true;
    loadingEl.hidden = true;
    dropzone.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateHeader() {
    var totalSize = items.reduce(function (s, it) { return s + it.file.size; }, 0);
    filesCount.textContent = items.length + ' image' + (items.length === 1 ? '' : 's') + ' selected';
    filesMeta.textContent = 'Total ' + formatBytes(totalSize);
  }

  /* ---------- Render item ---------- */
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
      '<span class="merge-item-thumb"><img src="' + item.dataUrl + '" alt=""></span>' +
      '<div class="merge-item-body">' +
        '<div class="merge-item-name" title="' + esc(item.file.name) + '">' + esc(item.file.name) + '</div>' +
        '<div class="merge-item-meta">' + formatBytes(item.file.size) + ' · ' + item.width + ' × ' + item.height + '</div>' +
      '</div>' +
      '<div class="merge-item-actions">' +
        '<button type="button" class="merge-item-action" data-act="rotate" aria-label="Rotate">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 12a9 9 0 1 1-3-6.7"/>' +
            '<path d="M21 3v6h-6"/>' +
          '</svg>' +
        '</button>' +
        '<button type="button" class="merge-item-action" data-act="remove" aria-label="Remove">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M6 6l12 12M6 18L18 6"/>' +
          '</svg>' +
        '</button>' +
      '</div>';

    // Rotate
    li.querySelector('[data-act="rotate"]').addEventListener('click', function (e) {
      e.stopPropagation();
      var id = Number(li.dataset.id);
      var it = items.find(function (x) { return x.id === id; });
      if (!it) return;
      it.rotation = ((it.rotation || 0) + 90) % 360;

      var img = li.querySelector('.merge-item-thumb img');
      img.style.transform = 'rotate(' + it.rotation + 'deg)';
      img.style.transition = 'transform .3s';
    });

    // Remove
    li.querySelector('[data-act="remove"]').addEventListener('click', function (e) {
      e.stopPropagation();
      var id = Number(li.dataset.id);
      items = items.filter(function (x) { return x.id !== id; });
      li.remove();
      if (items.length === 0) {
        resetUI();
      } else {
        updateHeader();
      }
    });

    // Drag & drop reorder
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
    items.sort(function (a, b) {
      return order.indexOf(a.id) - order.indexOf(b.id);
    });
  }

  /* ---------- Load image dimensions + preview ---------- */
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var dataUrl = e.target.result;
        var img = new Image();
        img.onload = function () {
          resolve({
            dataUrl: dataUrl,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        };
        img.onerror = function () { reject(new Error('Invalid image')); };
        img.src = dataUrl;
      };
      reader.onerror = function () { reject(new Error('File read error')); };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Add files ---------- */
  async function addFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList);
    var valid = arr.filter(function (f) {
      if (!f.type.startsWith('image/')) return false;
      if (f.size > 20 * 1024 * 1024) {
        alert(f.name + ' is larger than 20 MB and will be skipped.');
        return false;
      }
      return true;
    });

    if (valid.length === 0) {
      alert('Please select valid image files (JPG, PNG, WEBP).');
      return;
    }

    loadingEl.hidden = false;
    loadingText.textContent = 'Loading images…';
    dropzone.hidden = true;

    for (var i = 0; i < valid.length; i++) {
      try {
        var info = await loadImage(valid[i]);
        var item = {
          id: nextId++,
          file: valid[i],
          dataUrl: info.dataUrl,
          width: info.width,
          height: info.height,
          rotation: 0
        };
        items.push(item);
        imageList.appendChild(renderItem(item));
      } catch (err) {
        console.error('Could not load', valid[i].name, err);
        alert('Could not load ' + valid[i].name);
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
        fileInput.value = '';
      }
    });
  }

  if (addMoreBtn && fileInput) {
    addMoreBtn.addEventListener('click', function () { fileInput.click(); });
  }

  /* ---------- Drag & drop zone ---------- */
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

  /* ---------- Data URL → Uint8Array ---------- */
  function dataUrlToUint8(dataUrl) {
    var base64 = dataUrl.split(',')[1];
    var binary = atob(base64);
    var len = binary.length;
    var out = new Uint8Array(len);
    for (var i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  /* ---------- Rotate image to canvas at given rotation ---------- */
  function rotateToJpegBytes(dataUrl, rotation) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        if (!rotation) {
          // No rotation, just re-encode as jpg via canvas
          var c0 = document.createElement('canvas');
          c0.width = img.naturalWidth;
          c0.height = img.naturalHeight;
          var ctx0 = c0.getContext('2d');
          ctx0.fillStyle = '#FFFFFF';
          ctx0.fillRect(0, 0, c0.width, c0.height);
          ctx0.drawImage(img, 0, 0);
          resolve({
            bytes: dataUrlToUint8(c0.toDataURL('image/jpeg', 0.92)),
            width: c0.width,
            height: c0.height
          });
          return;
        }

        var rad = rotation * Math.PI / 180;
        var cos = Math.abs(Math.cos(rad));
        var sin = Math.abs(Math.sin(rad));
        var w = img.naturalWidth;
        var h = img.naturalHeight;

        var newW = Math.round(w * cos + h * sin);
        var newH = Math.round(w * sin + h * cos);

        var c = document.createElement('canvas');
        c.width = newW;
        c.height = newH;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, newW, newH);
        ctx.translate(newW / 2, newH / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -w / 2, -h / 2);

        resolve({
          bytes: dataUrlToUint8(c.toDataURL('image/jpeg', 0.92)),
          width: newW,
          height: newH
        });
      };
      img.onerror = function () { reject(new Error('Invalid image')); };
      img.src = dataUrl;
    });
  }

  /* ---------- Convert button ---------- */
  if (convertBtn) {
    convertBtn.addEventListener('click', async function () {
      if (items.length === 0) return;

      workspace.hidden = true;
      resultEl.hidden = true;
      loadingEl.hidden = false;

      try {
        var pdfDoc = await PDFLib.PDFDocument.create();

        var pageSize    = pageSizeSel.value;
        var orientation = orientationSel.value;
        var margin      = Number(marginSel.value);

        // Page dimensions in PDF points (1 pt = 1/72 inch)
        var sizes = {
          a4:     { w: 595.28, h: 841.89 },
          letter: { w: 612,    h: 792 }
        };

        for (var i = 0; i < items.length; i++) {
          loadingText.textContent = 'Processing image ' + (i + 1) + ' of ' + items.length + '…';

          var item = items[i];
          var rotated = await rotateToJpegBytes(item.dataUrl, item.rotation);
          var img = await pdfDoc.embedJpg(rotated.bytes);

          var pageW, pageH;

          if (pageSize === 'fit') {
            // Page = image + margins
            pageW = rotated.width + margin * 2;
            pageH = rotated.height + margin * 2;
          } else {
            var s = sizes[pageSize];
            var useLandscape = orientation === 'landscape' ||
              (orientation === 'auto' && rotated.width > rotated.height);
            pageW = useLandscape ? s.h : s.w;
            pageH = useLandscape ? s.w : s.h;
          }

          var page = pdfDoc.addPage([pageW, pageH]);

          // Available area for image (inside margins)
          var availW = pageW - margin * 2;
          var availH = pageH - margin * 2;

          // Scale image to fit while preserving aspect
          var scale = Math.min(availW / rotated.width, availH / rotated.height);

          // For "fit" pages, fill completely
          if (pageSize === 'fit') {
            scale = 1;
          }

          var drawW = rotated.width * scale;
          var drawH = rotated.height * scale;
          var drawX = (pageW - drawW) / 2;
          // PDF origin is bottom-left; images are drawn with top-left in mind
          var drawY = (pageH - drawH) / 2;

          page.drawImage(img, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH
          });
        }

        loadingText.textContent = 'Saving PDF…';
        var outBytes = await pdfDoc.save({ useObjectStreams: true });

        imagesUsed.textContent = items.length + ' images';
        pagesCount.textContent = items.length + ' pages';
        pdfSize.textContent = formatBytes(outBytes.length);

        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(new Blob([outBytes], { type: 'application/pdf' }));

        var firstName = items[0].file.name.replace(/\.[^.]+$/, '');
        downloadBtn.href = downloadUrl;
        downloadBtn.setAttribute('download', firstName + '.pdf');

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
