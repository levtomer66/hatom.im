// ============ TRIP JOURNEY ============
(function initJourney() {
  // ----- constants & state -----
  const TRIP_START = '2026-04-15';
  const TRIP_END   = '2026-05-20';

  const ADMIN_TOKEN_KEY = 'hatomim-trip-admin-token';
  // Admin mode is derived from token presence — having a token in
  // localStorage enables the day-modal admin bits (delete photo, save note).
  // Uploads still go through the server token check regardless.
  function isAdmin() { return !!adminToken(); }

  // Cache: dayDate -> { dayDate, photos: [], note: '' } once fetched.
  const dayCache = new Map();
  // journey pins layer group on the main Leaflet map (if present). Resolved
  // lazily inside boot() because Leaflet now loads with `defer`, so the map
  // and `window._tripMap` aren't ready when this IIFE first runs.
  let mainMap = null;
  let journeyLayer = null;

  // exifr + browser-image-compression are admin-only (~46 KB combined). Lazy-
  // injected so non-admin visitors never pay for them.
  let adminLibsPromise = null;
  function injectScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function loadAdminLibs() {
    if (adminLibsPromise) return adminLibsPromise;
    adminLibsPromise = Promise.all([
      injectScript('https://unpkg.com/exifr@7.1.3/dist/full.umd.js'),
      injectScript('https://unpkg.com/browser-image-compression@2.0.2/dist/browser-image-compression.js'),
    ]);
    return adminLibsPromise;
  }

  // ----- tiny helpers -----
  function adminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  }
  async function fetchJourneySummary() {
    const res = await fetch('/api/trip/journey', { cache: 'no-store' });
    if (!res.ok) throw new Error('summary fetch failed');
    return res.json();
  }
  async function fetchDay(dayDate) {
    if (dayCache.has(dayDate)) return dayCache.get(dayDate);
    const res = await fetch(`/api/trip/journey/${dayDate}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('day fetch failed');
    const doc = await res.json();
    dayCache.set(dayDate, doc);
    return doc;
  }
  function formatTime(iso) {
    const m = /T(\d{2}:\d{2})/.exec(iso);
    return m ? m[1] : '';
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ----- photo lightbox -----
  const lbOverlay   = document.getElementById('photo-lightbox');
  const lbImg       = document.getElementById('photo-lightbox-img');
  const lbTime      = document.getElementById('photo-lightbox-time');
  const lbLocation  = document.getElementById('photo-lightbox-location');
  const lbCaption   = document.getElementById('photo-lightbox-caption');
  const lbClose     = document.getElementById('photo-lightbox-close');
  const lbExternal  = document.getElementById('photo-lightbox-external');
  function openLightbox(photo) {
    lbImg.src = photo.blobUrl;
    lbExternal.href = photo.blobUrl;
    lbTime.textContent = formatTime(photo.takenAt);
    lbLocation.textContent = photo.locationLabel
      ? `📍 ${photo.locationLabel}`
      : (typeof photo.latitude === 'number' ? '📍 מיקום נרשם' : '');
    lbCaption.textContent = photo.caption || '';
    lbOverlay.classList.add('open');
  }
  function closeLightbox() {
    lbOverlay.classList.remove('open');
    // Drop the big image source so the browser can free it.
    lbImg.removeAttribute('src');
  }
  lbClose.addEventListener('click', closeLightbox);
  lbOverlay.addEventListener('click', e => { if (e.target === lbOverlay) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lbOverlay.classList.contains('open')) closeLightbox();
  });

  // ----- calendar decoration -----
  async function decorateCalendar(summary) {
    const cells = document.querySelectorAll('.cal-day:not(.empty)');
    const byDate = new Map(summary.days.map(d => [d.dayDate, d]));
    cells.forEach(cell => {
      // Each cell has a day-num child with the day-of-month; the month is
      // inferred from which renderMonth() pass inserted it — we walk the
      // previous siblings to find the cal-month-label.
      const numEl = cell.querySelector('.day-num');
      if (!numEl) return;
      const day = parseInt(numEl.textContent, 10);
      if (!day) return;
      let label = cell.previousElementSibling;
      while (label && !label.classList.contains('cal-month-label')) {
        label = label.previousElementSibling;
      }
      if (!label) return;
      const monthText = label.textContent || '';
      const month = monthText.includes('April') ? 4 : monthText.includes('May') ? 5 : null;
      if (!month) return;
      const dayDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Wire a click handler on every trip-range cell, regardless of photos.
      // Guard against duplicate listeners — decorateCalendar() re-runs after
      // every upload/delete, and we don't want the modal to open N times per
      // click after a few refreshes.
      if (dayDate >= TRIP_START && dayDate <= TRIP_END && !cell.dataset.journeyHandler) {
        cell.dataset.journeyHandler = '1';
        cell.addEventListener('click', () => openDayModal(dayDate));
        cell.style.cursor = 'pointer';
      }

      const hit = byDate.get(dayDate);
      if (!hit) return;
      cell.dataset.hasPhotos = 'true';
      // Avoid double badges on re-decorate after uploads.
      cell.querySelector('.photo-badge')?.remove();
      const badge = document.createElement('span');
      badge.className = 'photo-badge';
      badge.textContent = `📸 ${hit.photoCount}`;
      cell.appendChild(badge);
    });

    // Draw the actual-journey layer on the main Leaflet map:
    //   - one continuous cyan polyline connecting every GPS-tagged photo in
    //     chronological order (the "trip I actually took")
    //   - a circleMarker per photo, each wired to open that day's modal
    //
    // The existing planned-itinerary polylines above (dashed violet outbound,
    // dashed pink return) stay as-is — they represent the plan. The cyan
    // journey layer overlays on top so "planned vs actual" reads at a glance.
    if (journeyLayer) {
      journeyLayer.clearLayers();
      // Pull every day's full doc in parallel so we can sort across days
      // before drawing the polyline.
      const dayDocs = await Promise.all(
        summary.days
          .filter(d => d.photoCount)
          .map(d => fetchDay(d.dayDate).catch(() => null))
      );
      // Flatten to one chronological list of photos-with-GPS across the trip.
      const points = [];
      for (const doc of dayDocs) {
        if (!doc) continue;
        for (const p of doc.photos || []) {
          if (typeof p.latitude === 'number' && typeof p.longitude === 'number') {
            points.push({ ...p, dayDate: doc.dayDate });
          }
        }
      }
      points.sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());

      // Continuous journey polyline (main + glow companion, matching the
      // planned-route recipe above for visual consistency).
      if (points.length >= 2) {
        const path = points.map(p => [p.latitude, p.longitude]);
        L.polyline(path, { color: '#81ecec', weight: 7, opacity: 0.18, smoothFactor: 1 }).addTo(journeyLayer);
        L.polyline(path, { color: '#00cec9', weight: 3, opacity: 0.85, smoothFactor: 1 }).addTo(journeyLayer);
      }

      // Pins. Click → open the day modal (the user is saying "tell me about
      // photos taken here", plural — day modal holds that context).
      for (const p of points) {
        L.circleMarker([p.latitude, p.longitude], {
          radius: 5,
          color: '#ff8fb1',
          weight: 2,
          fillColor: '#fd79a8',
          fillOpacity: 0.9,
        })
          .bindTooltip(`${p.dayDate} · ${formatTime(p.takenAt)}${p.locationLabel ? ' · ' + p.locationLabel : ''}`)
          .on('click', () => openDayModal(p.dayDate))
          .addTo(journeyLayer);
      }
    }
  }

  // ----- day modal -----
  const overlay    = document.getElementById('journey-modal-overlay');
  const modal      = document.getElementById('journey-modal');
  const titleEl    = document.getElementById('journey-modal-title');
  const closeBtn   = document.getElementById('journey-modal-close');
  const gridEl     = document.getElementById('journey-photo-grid');
  const emptyEl    = document.getElementById('journey-empty');
  const noteEl     = document.getElementById('journey-note');
  const noteSave   = document.getElementById('journey-note-save');
  const miniMapEl  = document.getElementById('journey-mini-map');
  let miniMap = null;
  let currentDay = null;

  function closeModal() {
    overlay.classList.remove('open');
    currentDay = null;
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  async function openDayModal(dayDate) {
    currentDay = dayDate;
    titleEl.textContent = `📅 ${dayDate}`;
    gridEl.innerHTML = '<div class="journey-empty">טוען…</div>';
    emptyEl.hidden = true;
    noteEl.value = '';
    overlay.classList.add('open');

    if (isAdmin()) {
      modal.classList.add('admin');
      noteEl.removeAttribute('readonly');
    } else {
      modal.classList.remove('admin');
      noteEl.setAttribute('readonly', 'readonly');
    }

    let doc;
    try {
      doc = await fetchDay(dayDate);
    } catch (err) {
      gridEl.innerHTML = '<div class="journey-empty">שגיאה בטעינה.</div>';
      return;
    }
    noteEl.value = doc.note || '';

    gridEl.innerHTML = '';
    if (!doc.photos || !doc.photos.length) {
      emptyEl.hidden = false;
      miniMapEl.hidden = true;
      return;
    }
    for (const p of doc.photos) {
      const cell = document.createElement('div');
      cell.className = 'journey-photo';
      // Build the overlay bits conditionally so an un-geocoded photo with
      // GPS simply shows no bottom label (rather than an empty pill).
      let bottomOverlay = '';
      if (p.locationLabel) {
        bottomOverlay = `<span class="photo-location" title="${escapeAttr(p.locationLabel)}">📍 ${escapeHtml(p.locationLabel)}</span>`;
      } else if (typeof p.latitude !== 'number') {
        bottomOverlay = '<span class="photo-no-gps">📵 אין מיקום</span>';
      }
      cell.innerHTML = `
        <img src="${p.blobUrl}" loading="lazy" alt="" />
        <span class="photo-time">${formatTime(p.takenAt)}</span>
        ${bottomOverlay}
        <button class="photo-delete" data-blob="${p.blobPath}" title="מחק">✕</button>
      `;
      // Clicking anywhere on the cell (except the delete button) opens
      // the lightbox with the full-res image + its location label.
      cell.style.cursor = 'zoom-in';
      cell.addEventListener('click', () => openLightbox(p));
      cell.querySelector('.photo-delete').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDeletePhoto(p.blobPath);
      });
      gridEl.appendChild(cell);
    }

    // Mini-map for this day's photos with GPS. Sort defensively by `takenAt`
    // so the polyline connects points in true chronological order even if a
    // cached doc or a future server change returns photos in upload order.
    const pts = [...doc.photos]
      .filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number')
      .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime())
      .map(p => [p.latitude, p.longitude]);
    if (pts.length) {
      miniMapEl.hidden = false;
      if (!miniMap) {
        miniMap = L.map(miniMapEl, { attributionControl: false, zoomControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
          subdomains: 'abcd', maxZoom: 20,
        }).addTo(miniMap);
      } else {
        miniMap.invalidateSize();
        // Clear markers AND polylines so swapping day modals doesn't
        // accumulate geometry from the previous day.
        miniMap.eachLayer(l => {
          if (l instanceof L.CircleMarker || l instanceof L.Polyline) miniMap.removeLayer(l);
        });
      }
      // Same cyan palette as the main-map journey line, so the two views
      // read as the same "actual trip" layer at different scales.
      if (pts.length >= 2) {
        L.polyline(pts, { color: '#81ecec', weight: 6, opacity: 0.2, smoothFactor: 1 }).addTo(miniMap);
        L.polyline(pts, { color: '#00cec9', weight: 3, opacity: 0.85, smoothFactor: 1 }).addTo(miniMap);
      }
      pts.forEach(([lat, lng]) => {
        L.circleMarker([lat, lng], { radius: 6, color: '#fd79a8', fillColor: '#fd79a8', fillOpacity: 0.9 }).addTo(miniMap);
      });
      miniMap.fitBounds(pts, { padding: [24, 24], maxZoom: 14 });
    } else {
      miniMapEl.hidden = true;
    }
  }

  noteSave.addEventListener('click', async () => {
    if (!currentDay) return;
    const token = adminToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/trip/journey/${currentDay}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ note: noteEl.value }),
      });
      if (!res.ok) throw new Error(`save note failed ${res.status}`);
      dayCache.delete(currentDay);
      noteSave.textContent = '✓ נשמר';
      setTimeout(() => { noteSave.textContent = 'שמור הערה'; }, 1400);
    } catch (err) {
      console.error(err);
      noteSave.textContent = '✗ שגיאה';
    }
  });

  async function onDeletePhoto(blobPath) {
    if (!currentDay) return;
    if (!confirm('למחוק את התמונה?')) return;
    const token = adminToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/trip/journey/${currentDay}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ blobPath }),
      });
      if (!res.ok) throw new Error(`delete failed ${res.status}`);
      dayCache.delete(currentDay);
      await openDayModal(currentDay);
      const summary = await fetchJourneySummary();
      document.querySelectorAll('.cal-day .photo-badge').forEach(el => el.remove());
      document.querySelectorAll('.cal-day').forEach(el => delete el.dataset.hasPhotos);
      await decorateCalendar(summary);
      if (fullMap) fullMap.refresh();
    } catch (err) {
      console.error(err);
      alert('שגיאה במחיקה');
    }
  }

  // ----- admin upload panel -----
  const adminPanel    = document.getElementById('admin-upload-panel');
  const adminDrop     = document.getElementById('admin-upload-drop');
  const adminInput    = document.getElementById('admin-upload-input');
  const adminSubmit   = document.getElementById('admin-upload-submit');
  const adminPreviews = document.getElementById('admin-upload-previews');
  const unassignedPill = document.getElementById('admin-unassigned-pill');
  let pendingFiles = []; // { file, resized, takenAt, latitude, longitude, dayDate, row }

  function addPreviewRow(label, kind) {
    const row = document.createElement('div');
    row.className = `admin-upload-row-item${kind ? ' ' + kind : ''}`;
    row.textContent = label;
    adminPreviews.appendChild(row);
    return row;
  }

  async function ingestFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    try {
      await loadAdminLibs();
    } catch (err) {
      console.warn('[trip/journey] failed to load admin libs', err);
      addPreviewRow('שגיאה בטעינת הספריות', 'err');
      return;
    }
    for (const file of files) {
      const row = addPreviewRow(`${file.name} — מנתח EXIF…`);
      let exif = null;
      try {
        // Parse against the ORIGINAL file (before resize) so we capture GPS
        // tags that the canvas-based resize would strip.
        // NOTE: we deliberately don't pass `pick` — combining `pick` with
        // `gps: true` can suppress the computed `latitude`/`longitude`
        // outputs in some exifr builds, which is what was making iPhone
        // photos render with "אין מיקום" even though Photos.app showed a
        // location. Reading the whole block is cheap.
        exif = await window.exifr.parse(file, { gps: true });
        console.log('[trip/journey] EXIF for', file.name, {
          DateTimeOriginal: exif?.DateTimeOriginal,
          OffsetTimeOriginal: exif?.OffsetTimeOriginal,
          latitude: exif?.latitude,
          longitude: exif?.longitude,
        });
      } catch (err) {
        console.warn('[trip/journey] EXIF parse failed for', file.name, err);
      }

      let takenAt = null;
      if (exif?.DateTimeOriginal instanceof Date) {
        // Build an ISO string using the offset if present; else assume the
        // trip's local offset (UTC-4 for NYC in April). The offset only
        // affects display; the server slices dayDate directly from this.
        const dt = exif.DateTimeOriginal;
        const offset = exif.OffsetTimeOriginal || '-04:00';
        const pad = n => String(n).padStart(2, '0');
        takenAt = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}${offset}`;
      }
      const latitude  = typeof exif?.latitude  === 'number' ? exif.latitude  : null;
      const longitude = typeof exif?.longitude === 'number' ? exif.longitude : null;

      // Client-side resize — max 2000 px, ~0.8 MB target, JPEG.
      let resized = file;
      try {
        resized = await window.imageCompression(file, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 2000,
          useWebWorker: true,
          fileType: 'image/jpeg',
          initialQuality: 0.82,
        });
      } catch (err) {
        console.warn('resize failed, using original', file.name, err);
      }

      const dayDate = takenAt ? takenAt.slice(0, 10) : null;
      const sizeKB = Math.round(resized.size / 1024);
      const geoLabel = (latitude && longitude) ? '📍' : '📵';

      // Gate: photos without an EXIF date aren't uploaded at all. They show
      // up in the preview list with an explicit error so you can see which
      // files are being skipped, but they never get queued. Any files with
      // a valid date are still uploaded even when they're mixed in with
      // undated ones in the same batch.
      if (!takenAt) {
        row.className = 'admin-upload-row-item err';
        row.textContent = `${file.name} — ❌ אין תאריך EXIF · לא יועלה`;
        continue;
      }

      row.className = 'admin-upload-row-item ok';
      row.textContent = `${file.name} → ${dayDate} · ${geoLabel} · ${sizeKB} KB`;

      pendingFiles.push({
        file, resized, takenAt, latitude, longitude,
        originalMime: file.type || undefined,
        row,
      });
    }
    adminSubmit.disabled = pendingFiles.length === 0;
  }

  async function uploadPending() {
    // Ask for the token lazily, once per device. Cached in localStorage so
    // the prompt only appears the very first time the user hits upload.
    let token = adminToken();
    if (!token) {
      const t = prompt('סיסמת אדמין:');
      if (!t) return;
      localStorage.setItem(ADMIN_TOKEN_KEY, t);
      token = t;
    }
    // Snapshot the batch so we can report totals at the end (queue.shift()
    // empties the array). Each entry picks up a `ok: true|false` flag
    // inside uploadOne() so we can count without re-inspecting DOM.
    const batch = pendingFiles.slice();
    pendingFiles = [];
    adminSubmit.disabled = true;
    let completed = 0;
    const total = batch.length;
    adminSubmit.textContent = `מעלה 0 / ${total}…`;

    // Simple parallel pool of 4 concurrent uploads.
    const queue = batch.slice();
    let inFlight = 0;
    await new Promise(resolve => {
      function kick() {
        while (inFlight < 4 && queue.length) {
          const entry = queue.shift();
          inFlight++;
          uploadOne(entry, token)
            .then(() => {
              completed++;
              adminSubmit.textContent = `מעלה ${completed} / ${total}…`;
            })
            .finally(() => {
              inFlight--;
              if (!queue.length && inFlight === 0) resolve();
              else kick();
            });
        }
      }
      if (!queue.length) resolve();
      else kick();
    });

    const okCount = batch.filter(e => e.ok).length;
    const failCount = total - okCount;

    // Surface a clear end-of-batch summary row at the bottom of the
    // preview list, so the user doesn't have to scan every row to know
    // whether the whole batch succeeded.
    const summaryRow = document.createElement('div');
    summaryRow.className = 'admin-upload-row-item ' + (failCount ? 'err' : 'ok');
    summaryRow.style.marginTop = '8px';
    summaryRow.style.paddingTop = '8px';
    summaryRow.style.borderTop = '1px solid rgba(255,255,255,0.12)';
    summaryRow.style.fontWeight = '700';
    summaryRow.textContent = failCount
      ? `סיכום: ${okCount} הועלו · ${failCount} נכשלו`
      : `✅ ${okCount} תמונות הועלו בהצלחה`;
    adminPreviews.appendChild(summaryRow);
    summaryRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Brief "done" state on the button so the transition away from
    // "מעלה N / M…" is unmistakable, then revert to the normal label.
    adminSubmit.disabled = false;
    adminSubmit.textContent = failCount ? '⚠ בוצע עם שגיאות' : '✓ הועלה!';
    setTimeout(() => { adminSubmit.textContent = 'העלאה'; }, 2500);

    // Refresh calendar badges + map pins from the new state.
    dayCache.clear();
    try {
      const summary = await fetchJourneySummary();
      document.querySelectorAll('.cal-day .photo-badge').forEach(el => el.remove());
      document.querySelectorAll('.cal-day').forEach(el => delete el.dataset.hasPhotos);
      await decorateCalendar(summary);
      updateUnassignedPill(summary.unassignedCount || 0);
      if (fullMap) fullMap.refresh();
    } catch {/* ignore */}
  }

  async function uploadOne(entry, token) {
    entry.ok = false;  // default — flipped to true only on a real 2xx
    const fd = new FormData();
    fd.append('file', entry.resized, entry.file.name.replace(/\.[^.]+$/, '') + '.jpg');
    if (entry.takenAt) fd.append('takenAt', entry.takenAt);
    if (typeof entry.latitude  === 'number') fd.append('latitude',  String(entry.latitude));
    if (typeof entry.longitude === 'number') fd.append('longitude', String(entry.longitude));
    if (entry.originalMime) fd.append('originalMime', entry.originalMime);
    try {
      const res = await fetch('/api/trip/journey/upload', {
        method: 'POST',
        headers: { 'X-Admin-Token': token },
        body: fd,
      });
      // On 401 the cached token is stale — clear it so the next upload
      // attempt re-prompts instead of looping on the wrong value.
      if (res.status === 401) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        entry.row.className = 'admin-upload-row-item err';
        entry.row.textContent += ' ✗ סיסמה שגויה';
        return;
      }
      if (!res.ok) throw new Error(`upload ${res.status}`);
      const data = await res.json();
      entry.row.className = 'admin-upload-row-item ok';
      entry.row.textContent += data.unassigned ? ' ✓ (לא שויך)' : ' ✓';
      entry.ok = true;
    } catch (err) {
      console.error(err);
      entry.row.className = 'admin-upload-row-item err';
      entry.row.textContent += ' ✗ נכשל';
    }
  }

  function updateUnassignedPill(n) {
    if (n > 0) {
      unassignedPill.textContent = `⚠ ${n} ללא תאריך`;
      unassignedPill.classList.add('visible');
    } else {
      unassignedPill.classList.remove('visible');
    }
  }

  // Drag-drop + file picker
  if (adminInput) {
    adminInput.addEventListener('change', e => ingestFiles(e.target.files));
  }
  if (adminDrop) {
    ['dragenter', 'dragover'].forEach(type =>
      adminDrop.addEventListener(type, e => { e.preventDefault(); adminDrop.classList.add('hover'); })
    );
    ['dragleave', 'drop'].forEach(type =>
      adminDrop.addEventListener(type, e => { e.preventDefault(); adminDrop.classList.remove('hover'); })
    );
    adminDrop.addEventListener('drop', e => ingestFiles(e.dataTransfer?.files));
  }
  if (adminSubmit) adminSubmit.addEventListener('click', uploadPending);

  // ===== Full Photo Map =====
  // Single-canvas browse view of every GPS-tagged trip photo. Photos are
  // grouped by GPS proximity (Haversine, 150 m threshold) — NOT by the
  // locationLabel string, since two photos at the same physical place can
  // still drift between Nominatim labels (the regeocode admin button helps
  // narrow that gap, but proximity is the reliable grouping key).
  const fullMap = (() => {
    const container = document.getElementById('fullmap');
    if (!container || !window.L) return null;

    // Slider works in day-index space relative to TRIP_START so swapping
    // the bounds, comparing, and clamping stay integer-cheap.
    const startDate = new Date(TRIP_START + 'T00:00:00Z');
    const endDate   = new Date(TRIP_END   + 'T00:00:00Z');
    const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
    const dayIdxFromIso = iso => Math.round((new Date(iso + 'T00:00:00Z').getTime() - startDate.getTime()) / 86400000);
    const isoFromDayIdx = idx => new Date(startDate.getTime() + idx * 86400000).toISOString().slice(0, 10);

    const map = L.map('fullmap', {
      center: [37, -50],
      zoom: 3,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);
    const markerLayer = L.layerGroup().addTo(map);

    const sliderFrom = document.getElementById('fullmap-slider-from');
    const sliderTo   = document.getElementById('fullmap-slider-to');
    const sliderFill = document.getElementById('fullmap-slider-fill');
    const rangeLabel = document.getElementById('fullmap-range-label');
    const status     = document.getElementById('fullmap-status');
    const panel      = document.getElementById('fullmap-panel');
    const quickBtns  = document.querySelectorAll('[data-fullmap-range]');

    sliderFrom.min = '0';
    sliderFrom.max = String(totalDays);
    sliderFrom.value = '0';
    sliderTo.min = '0';
    sliderTo.max = String(totalDays);
    sliderTo.value = String(totalDays);

    let fromIdx = 0;
    let toIdx = totalDays;
    let allPhotos = [];   // flat list with `dayDate` glued on
    let activeClusterKey = null;

    function fmtRangeLabel(iso) {
      const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
      if (!m) return iso;
      return `${parseInt(m[2], 10)}.${parseInt(m[1], 10)}`;
    }
    function clamp(n) { return Math.max(0, Math.min(totalDays, Math.round(n))); }
    function setActiveQuick(name) {
      quickBtns.forEach(b => b.classList.toggle('active', b.dataset.fullmapRange === name));
    }
    function updateSliderUi() {
      const a = totalDays === 0 ? 0 : (fromIdx / totalDays) * 100;
      const b = totalDays === 0 ? 100 : (toIdx / totalDays) * 100;
      sliderFill.style.left  = a + '%';
      sliderFill.style.right = (100 - b) + '%';
      rangeLabel.textContent = `${fmtRangeLabel(isoFromDayIdx(fromIdx))} → ${fmtRangeLabel(isoFromDayIdx(toIdx))}`;
    }

    function readSlider() {
      let a = clamp(Number(sliderFrom.value));
      let b = clamp(Number(sliderTo.value));
      if (a > b) [a, b] = [b, a];
      fromIdx = a;
      toIdx = b;
      setActiveQuick('custom');
      updateSliderUi();
      render();
    }
    sliderFrom.addEventListener('input', readSlider);
    sliderTo.addEventListener('input', readSlider);

    quickBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const r = btn.dataset.fullmapRange;
        if (r === 'all') {
          fromIdx = 0;
          toIdx = totalDays;
        } else if (r === 'today') {
          const today = new Date().toISOString().slice(0, 10);
          if (today < TRIP_START)      { fromIdx = 0;         toIdx = 0;         }
          else if (today > TRIP_END)   { fromIdx = totalDays; toIdx = totalDays; }
          else { const idx = clamp(dayIdxFromIso(today)); fromIdx = idx; toIdx = idx; }
        }
        sliderFrom.value = String(fromIdx);
        sliderTo.value   = String(toIdx);
        setActiveQuick(r);
        updateSliderUi();
        render();
      });
    });

    // Haversine distance in metres.
    function haversine(a, b) {
      const R = 6371000;
      const toRad = d => d * Math.PI / 180;
      const dLat = toRad(b.latitude - a.latitude);
      const dLng = toRad(b.longitude - a.longitude);
      const lat1 = toRad(a.latitude);
      const lat2 = toRad(b.latitude);
      const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(x));
    }
    const CLUSTER_RADIUS_M = 150;

    function clusterPhotos(photos) {
      const clusters = [];
      for (const p of photos) {
        let placed = false;
        for (const c of clusters) {
          if (haversine(c.centroid, p) <= CLUSTER_RADIUS_M) {
            c.photos.push(p);
            const n = c.photos.length;
            // Running mean centroid keeps the pin on the cluster's midpoint.
            c.centroid = {
              latitude:  c.centroid.latitude  + (p.latitude  - c.centroid.latitude)  / n,
              longitude: c.centroid.longitude + (p.longitude - c.centroid.longitude) / n,
            };
            placed = true;
            break;
          }
        }
        if (!placed) {
          clusters.push({
            centroid: { latitude: p.latitude, longitude: p.longitude },
            photos: [p],
          });
        }
      }
      // Stable id keyed by the seed photo's blobPath so panel state survives
      // re-renders (e.g. moving a slider doesn't lose the open cluster).
      for (const c of clusters) c.id = c.photos[0].blobPath;
      return clusters;
    }

    function clusterLabel(c) {
      const counts = new Map();
      for (const p of c.photos) {
        const lbl = p.locationLabel || '';
        counts.set(lbl, (counts.get(lbl) || 0) + 1);
      }
      let best = '';
      let max = -1;
      for (const [lbl, n] of counts) {
        if (lbl && n > max) { best = lbl; max = n; }
      }
      return best;
    }

    function filteredPhotos() {
      const fromIso = isoFromDayIdx(fromIdx);
      const toIso   = isoFromDayIdx(toIdx);
      return allPhotos.filter(p => p.dayDate >= fromIso && p.dayDate <= toIso);
    }

    function resetPanel() {
      panel.innerHTML = '<div class="fullmap-panel-empty">בחר נקודה במפה כדי לראות תמונות שצולמו שם.</div>';
    }

    function showCluster(c) {
      activeClusterKey = c.id;
      const lbl = clusterLabel(c);
      const sorted = [...c.photos].sort(
        (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()
      );
      const photosHtml = sorted.map(p => `
        <div class="fullmap-photo-row" data-blob="${escapeAttr(p.blobPath)}">
          <img src="${p.blobUrl}" loading="lazy" alt="" />
          <div class="fullmap-photo-meta">
            <div>
              <div class="fullmap-photo-time">${formatTime(p.takenAt)}</div>
              <div class="fullmap-photo-day">${escapeHtml(p.dayDate)}${p.locationLabel ? ' · ' + escapeHtml(p.locationLabel) : ''}</div>
            </div>
            <button class="fullmap-photo-day-link" data-day="${escapeAttr(p.dayDate)}">פתח את היום ↗</button>
          </div>
        </div>
      `).join('');
      panel.innerHTML = `
        <div class="fullmap-panel-header">
          <div class="fullmap-panel-title">${escapeHtml(lbl || 'מיקום')}</div>
          <div class="fullmap-panel-meta">${c.photos.length} תמונות · ${c.centroid.latitude.toFixed(4)}, ${c.centroid.longitude.toFixed(4)}</div>
        </div>
        <div class="fullmap-panel-photos">${photosHtml}</div>
      `;
      panel.querySelectorAll('.fullmap-photo-row').forEach(row => {
        row.addEventListener('click', e => {
          if (e.target.closest('.fullmap-photo-day-link')) return;
          const blob = row.dataset.blob;
          const photo = sorted.find(p => p.blobPath === blob);
          if (photo) openLightbox(photo);
        });
      });
      panel.querySelectorAll('.fullmap-photo-day-link').forEach(link => {
        link.addEventListener('click', e => {
          e.stopPropagation();
          const day = link.dataset.day;
          if (day) openDayModal(day);
        });
      });
    }

    function render() {
      markerLayer.clearLayers();
      const photos = filteredPhotos();
      if (!allPhotos.length) {
        status.textContent = 'אין עדיין תמונות עם מיקום';
        resetPanel();
        return;
      }
      if (!photos.length) {
        status.textContent = 'אין תמונות בטווח התאריכים שבחרת';
        panel.innerHTML = '<div class="fullmap-panel-empty">אין תמונות בטווח התאריכים שבחרת.</div>';
        return;
      }
      const clusters = clusterPhotos(photos);
      status.textContent = `${photos.length} תמונות · ${clusters.length} מיקומים`;

      const bounds = [];
      for (const c of clusters) {
        const lbl = clusterLabel(c);
        const size = 28 + Math.min(20, c.photos.length * 2);
        const icon = L.divIcon({
          className: '',
          html: `<div class="fullmap-cluster-pin" style="width:${size}px;height:${size}px;">${c.photos.length}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker([c.centroid.latitude, c.centroid.longitude], { icon })
          .bindTooltip(lbl || `${c.photos.length} תמונות`)
          .on('click', () => showCluster(c))
          .addTo(markerLayer);
        bounds.push([c.centroid.latitude, c.centroid.longitude]);
      }

      if (bounds.length === 1) {
        map.setView(bounds[0], Math.max(map.getZoom(), 12));
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }

      // Preserve the open cluster across re-renders (slider drag, refresh
      // after upload) — but only if it's still in the filtered output.
      if (activeClusterKey) {
        const still = clusters.find(c => c.id === activeClusterKey);
        if (still) showCluster(still);
        else { activeClusterKey = null; resetPanel(); }
      }
    }

    async function refresh() {
      status.textContent = 'טוען…';
      try {
        const summary = await fetchJourneySummary();
        const docs = await Promise.all(summary.days.map(d => fetchDay(d.dayDate).catch(() => null)));
        const flat = [];
        for (const doc of docs) {
          if (!doc) continue;
          for (const p of doc.photos) {
            if (typeof p.latitude === 'number' && typeof p.longitude === 'number') {
              flat.push({ ...p, dayDate: doc.dayDate });
            }
          }
        }
        flat.sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());
        allPhotos = flat;
        render();
      } catch (err) {
        console.warn('full-map refresh failed', err);
        status.textContent = 'שגיאה בטעינה';
      }
    }

    updateSliderUi();
    resetPanel();
    return { refresh };
  })();

  // ----- bootstrap -----
  async function boot() {
    mainMap = window._tripMap || null;
    journeyLayer = mainMap ? L.layerGroup().addTo(mainMap) : null;
    // Panel is always visible; prompt for the token lazily on the first
    // upload attempt rather than at page load so casual visitors aren't
    // interrupted by a credentials prompt.
    try {
      const summary = await fetchJourneySummary();
      await decorateCalendar(summary);
      updateUnassignedPill(summary.unassignedCount || 0);
    } catch (err) {
      console.warn('journey init failed', err);
    }
    // Full-map data fills in independently — even if calendar fails, it can
    // still try to render whatever it can fetch.
    if (fullMap) fullMap.refresh();
  }

  // boot needs the calendar in the DOM and Leaflet (`L`) available; defer
  // scripts run before DOMContentLoaded so this guarantees both.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }
})();
