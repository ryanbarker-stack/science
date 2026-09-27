/* IACA Science Web Assignment Submission Standard, client 1.0.0. No dependencies. */
(function (global) {
  'use strict';
  const VERSION = '1.0.0';
  const CHANNEL = 'iaca-submission-v1';
  const MAX_BYTES = 120000;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const normalizeText = value => String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/g, ' ');
  const bytes = value => new TextEncoder().encode(value).length;
  const uid = () => {
    if (global.crypto.randomUUID) return global.crypto.randomUUID();
    const b = global.crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const s = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20);
  };
  function stableStringify(value) {
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
    return JSON.stringify(value);
  }
  function assertJSON(value, depth) {
    if (depth > 30) throw new Error('The activity data is too deeply nested. Ask your teacher for help.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) { value.forEach(v => assertJSON(v, depth + 1)); return; }
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
      Object.keys(value).forEach(k => { if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('This activity contains an unsupported data field.'); assertJSON(value[k], depth + 1); });
      return;
    }
    throw new Error('This activity contains data that cannot be saved. Ask your teacher for help.');
  }
  function normalizeIdentity(identity) {
    const result = { type: identity.type, namespace: identity.namespace, value: normalizeText(identity.value) };
    if (identity.type !== 'student_name') result.value = result.value.toUpperCase();
    if (identity.period != null && String(identity.period).trim()) result.period = String(identity.period).trim();
    if (identity.nameTag != null && normalizeText(identity.nameTag)) result.nameTag = normalizeText(identity.nameTag).toUpperCase();
    return result;
  }
  function canonicalIdentity(identity) {
    const v = normalizeIdentity(identity);
    return JSON.stringify([v.type, v.namespace, v.type === 'student_name' ? v.value.toLowerCase() : v.value, v.period || '', v.nameTag || '']);
  }
  function isReceiptOrigin(origin) {
    try {
      const u = new URL(origin);
      return u.protocol === 'https:' && !u.port && (u.hostname === 'script.google.com' || u.hostname === 'script.googleusercontent.com' || /^[a-z0-9-]+-script\.googleusercontent\.com$/.test(u.hostname));
    } catch (_) { return false; }
  }
  function sourceInsideFrame(source, frameWindow) {
    if (!source || !frameWindow) return false;
    try {
      let current = source;
      for (let i = 0; i < 12; i++) {
        if (current === frameWindow) return true;
        const parent = current.parent;
        if (!parent || parent === current) return false;
        current = parent;
      }
    } catch (_) { return false; }
    return false;
  }
  function transport(endpoint, payload, requestId, timeoutMs) {
    return new Promise((resolve, reject) => {
      const nonce = uid();
      const frame = document.createElement('iframe');
      frame.name = 'iaca_' + nonce; frame.hidden = true; frame.setAttribute('aria-hidden', 'true'); frame.dataset.iaca = 'transport-frame';
      const form = document.createElement('form');
      form.method = 'POST'; form.action = endpoint; form.target = frame.name; form.hidden = true; form.acceptCharset = 'UTF-8';
      const fields = { payload, parentOrigin: global.location.origin, nonce };
      if (bytes(new URLSearchParams(fields).toString()) > 800000) { reject(new Error('This submission is too large. Ask your teacher for help.')); return; }
      Object.keys(fields).forEach(key => { const input = document.createElement('input'); input.type = 'hidden'; input.name = key; input.value = fields[key]; form.appendChild(input); });
      let timer;
      function cleanup() { clearTimeout(timer); global.removeEventListener('message', receive); form.remove(); frame.remove(); }
      function receive(event) {
        const message = event.data;
        if (!isReceiptOrigin(event.origin) || !sourceInsideFrame(event.source, frame.contentWindow)) return;
        if (!message || message.channel !== CHANNEL || message.nonce !== nonce || message.requestId !== requestId) return;
        const response = message.response;
        if (!response || response.requestId !== requestId || typeof response.ok !== 'boolean') return;
        cleanup(); resolve(response);
      }
      global.addEventListener('message', receive);
      document.body.append(frame, form);
      timer = setTimeout(() => { cleanup(); reject(new Error('We could not confirm receipt. Your teacher may already have your work. Press TRY AGAIN to safely check.')); }, timeoutMs);
      try { HTMLFormElement.prototype.submit.call(form); }
      catch (_) { cleanup(); reject(new Error('The connection did not open. Check your connection and press TRY AGAIN.')); }
      // A frame load, HTTP status, or local save is never a receipt.
    });
  }
  function init(config) {
    if (!config || typeof config.collectResponses !== 'function' || typeof config.restoreResponses !== 'function' || typeof config.resetResponses !== 'function' || typeof config.validate !== 'function') throw new Error('IACA requires collectResponses, restoreResponses, resetResponses and validate hooks.');
    const mount = typeof config.mount === 'string' ? document.querySelector(config.mount) : config.mount;
    const workRoot = typeof config.workRoot === 'string' ? document.querySelector(config.workRoot) : config.workRoot;
    if (!mount || !workRoot || workRoot.contains(mount)) throw new Error('Provide separate mount and workRoot elements.');
    if (!config.assignment || !config.assignment.id || !config.assignment.version || !config.assignment.title) throw new Error('Assignment id, title and version are required.');
    const mode = config.identity || {};
    if (!['student_name', 'anonymous_id', 'classroom_code'].includes(mode.type) || !mode.namespace) throw new Error('Configure an identity type and namespace.');
    const periods = (mode.periods || []).map(String);
    if (mode.requirePeriod && periods.length === 0) throw new Error('List allowed periods when a period is required.');
    const assignment = Object.assign({}, config.assignment);
    const tabId = uid();
    const rememberKey = 'iaca:v1:remember:' + encodeURIComponent(mode.namespace) + ':' + mode.type;
    let identity = null, storageKey = null, record = null, currentWork = null;
    let saving = false, sending = false, dirty = false, conflict = false, destroyed = false;
    let storageError = '', feedback = '', feedbackErrors = [], saveTimer, releaseSession = null;
    let confirming = false, generation = 0, state = 'identity';
    const originalDisabled = new Map();
    const originallyInert = workRoot.inert;
    mount.classList.add('iaca-submission');
    mount.innerHTML = '<div class="iaca-brand">BARKER SCIENCE · TURN IN</div>' +
      '<h2 class="iaca-title" data-iaca="title"></h2>' +
      '<form data-iaca="identity-form" class="iaca-identity-form"><h3>Who is working?</h3>' +
      '<p>Check your information before you begin. This Chromebook may be shared.</p>' +
      '<label data-iaca="value-label"><span data-iaca="value-caption">Full name</span><input data-iaca="identity-value" maxlength="120" autocomplete="off" spellcheck="false" required></label>' +
      '<label data-iaca="period-label">Class period<select data-iaca="period"></select></label>' +
      '<label data-iaca="tag-label" hidden>Teacher-issued name tag<input data-iaca="name-tag" maxlength="24" autocomplete="off"></label>' +
      '<label class="iaca-check"><input type="checkbox" data-iaca="remember">Remember my information on this Chromebook</label>' +
      '<p class="iaca-hint">Leave this unchecked on a shared Chromebook. You will still confirm your identity each time.</p>' +
      '<button type="submit" class="iaca-primary" data-iaca="identity-confirm">THIS IS ME — BEGIN</button></form>' +
      '<div data-iaca="identity-summary" hidden><p class="iaca-small">Submitting as</p><p class="iaca-person" data-iaca="identity-display"></p><button class="iaca-link" type="button" data-iaca="change-student">Not you? Change student</button></div>' +
      '<div class="iaca-status" data-iaca="status" role="status" aria-live="polite" aria-atomic="true"><strong data-iaca="status-title"></strong><p data-iaca="status-detail"></p></div>' +
      '<div class="iaca-warning" data-iaca="warning" role="alert" hidden></div><ul class="iaca-errors" data-iaca="errors" role="alert" hidden></ul>' +
      '<div class="iaca-actions" data-iaca="actions" hidden><button type="button" class="iaca-primary iaca-turn-in" data-iaca="turn-in">TURN IN</button><button type="button" class="iaca-secondary" data-iaca="save">SAVE ON THIS CHROMEBOOK</button></div>' +
      '<p class="iaca-hint" data-iaca="privacy">Only a confirmed receipt means your teacher received your work.</p>';
    const el = key => mount.querySelector('[data-iaca="' + key + '"]');
    el('title').textContent = assignment.title;
    el('value-caption').textContent = mode.type === 'student_name' ? 'Full name' : mode.type === 'anonymous_id' ? 'Class-only student ID' : 'Classroom code';
    el('identity-value').maxLength = mode.type === 'student_name' ? 100 : 80;
    el('identity-value').placeholder = mode.type === 'student_name' ? 'First and last name' : mode.type === 'anonymous_id' ? 'IACA-000074' : 'P3C12';
    el('tag-label').hidden = !mode.nameTagRequired;
    el('name-tag').required = !!mode.nameTagRequired;
    el('period-label').hidden = !mode.requirePeriod && periods.length === 0;
    el('period').required = !!mode.requirePeriod;
    const initialOption = document.createElement('option'); initialOption.value = ''; initialOption.textContent = mode.requirePeriod ? 'Choose your period' : 'Choose a period (optional)'; el('period').appendChild(initialOption);
    periods.forEach(p => { const option = document.createElement('option'); option.value = p; option.textContent = 'Period ' + p; el('period').appendChild(option); });
    function lockWork(locked) {
      workRoot.inert = locked || originallyInert;
      workRoot.setAttribute('aria-disabled', locked ? 'true' : 'false');
      workRoot.querySelectorAll('input, textarea, select, button, fieldset').forEach(node => {
        if (locked) { if (!originalDisabled.has(node)) originalDisabled.set(node, node.disabled); node.disabled = true; }
        else if (originalDisabled.has(node)) { node.disabled = originalDisabled.get(node); originalDisabled.delete(node); }
      });
    }
    function readJSON(key) { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    function writeJSON(key, value) { const raw = JSON.stringify(value); localStorage.setItem(key, raw); if (localStorage.getItem(key) !== raw) throw new Error('Storage verification failed'); }
    function displayIdentity(value) { return value.value + (value.period ? ' · Period ' + value.period : '') + (value.nameTag ? ' · ' + value.nameTag : ''); }
    function collect() {
      const work = { responses: config.collectResponses(), results: config.collectResults ? config.collectResults() : {}, artifacts: config.collectArtifacts ? config.collectArtifacts() : [] };
      assertJSON(work, 0);
      if (!work.responses || Array.isArray(work.responses) || typeof work.responses !== 'object' || !work.results || Array.isArray(work.results) || typeof work.results !== 'object' || !Array.isArray(work.artifacts)) throw new Error('The activity data is not in the expected format. Ask your teacher for help.');
      return JSON.parse(JSON.stringify(work));
    }
    function receivedMatches() { return !!(record && record.receipt && currentWork && record.receivedWork && stableStringify(record.receivedWork) === stableStringify(currentWork)); }
    function render() {
      if (destroyed) return;
      let title, detail;
      if (!identity) { state = 'identity'; title = 'Confirm your identity to begin'; detail = 'Saved work opens only after you confirm who you are.'; }
      else if (conflict) { state = 'conflict'; title = 'This work is open in another tab'; detail = 'Close the other tab, then refresh this page and confirm your identity again. This tab cannot send changes.'; }
      else if (sending) { state = 'sending'; title = 'SENDING…'; detail = 'Keep this tab open while we wait for your teacher’s receipt.'; }
      else if (record && record.pending) { state = 'pending'; title = 'Receipt not confirmed'; detail = feedback || 'Your saved submission is waiting for confirmation. Press TRY AGAIN. Your answers are held safely until this is resolved.'; }
      else if (receivedMatches()) {
        state = 'received'; title = '✓ TURNED IN';
        const date = new Date(record.receipt.receivedAt);
        detail = 'Your teacher received your work. Submitted ' + date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' · Attempt ' + record.receipt.attempt + '. You may close this tab.';
      } else if (feedbackErrors.length) { state = 'error'; title = 'Check your work'; detail = 'Complete the items below, then press TURN IN.'; }
      else if (saving) { state = 'saving'; title = 'Saving on this Chromebook…'; detail = 'This is a local draft. It has not been sent to your teacher.'; }
      else if (dirty) { state = 'working'; title = 'Working'; detail = 'Saving your latest changes…'; }
      else { state = 'ready'; title = record && record.receipt ? 'Changes are not turned in yet' : 'Saved on this Chromebook'; detail = record && record.receipt ? 'Your teacher has your earlier submission. Press TURN IN to send these changes.' : 'Your teacher has not received this work yet. When you are ready, press TURN IN.'; }
      if (storageError && !receivedMatches()) { title = 'Local saving is unavailable'; detail = 'Keep this tab open. Your latest work may not survive a refresh. Turn in is paused until saving works.'; state = 'error'; }
      mount.dataset.iacaState = state;
      el('status-title').textContent = title; el('status-detail').textContent = detail;
      el('identity-form').hidden = !!identity;
      el('identity-summary').hidden = !identity;
      el('identity-display').textContent = identity ? displayIdentity(identity) : '';
      el('actions').hidden = !identity;
      el('turn-in').textContent = sending ? 'SENDING…' : record && record.pending ? 'TRY AGAIN' : receivedMatches() ? '✓ TURNED IN' : 'TURN IN';
      el('turn-in').disabled = !identity || conflict || sending || !!storageError || receivedMatches();
      el('save').disabled = !identity || sending || conflict || (!!(record && record.pending) && !storageError);
      el('save').textContent = storageError ? 'TRY LOCAL SAVE AGAIN' : 'SAVE ON THIS CHROMEBOOK';
      el('change-student').disabled = sending;
      el('identity-confirm').disabled = confirming;
      const warning = storageError || (identity && !navigator.locks ? 'Keep this assignment in one tab. This browser cannot lock drafts across tabs.' : '');
      el('warning').hidden = !warning; el('warning').textContent = warning;
      el('errors').replaceChildren();
      feedbackErrors.forEach(message => { const li = document.createElement('li'); li.textContent = message; el('errors').appendChild(li); });
      el('errors').hidden = feedbackErrors.length === 0;
      lockWork(!identity || sending || conflict || !!(record && record.pending));
    }
    function persist(next) {
      if (!storageKey || conflict) return false;
      try {
        const existing = readJSON(storageKey);
        if (existing && record && existing.revision !== record.revision && existing.writerId !== tabId) { conflict = true; render(); return false; }
        if (!existing && record && record.revision > 0) { conflict = true; render(); return false; }
        next = Object.assign({}, next, { format: 'iaca-draft-1', revision: (record ? record.revision : 0) + 1, writerId: tabId, updatedAt: new Date().toISOString() });
        writeJSON(storageKey, next); record = next; storageError = ''; dirty = false; return true;
      } catch (_) { storageError = 'This Chromebook could not save your work. Keep this tab open and ask your teacher for help. Press TRY LOCAL SAVE AGAIN to retry.'; return false; }
    }
    function save() {
      clearTimeout(saveTimer);
      if (!identity || destroyed || conflict || sending) return false;
      if (record && record.pending) {
        if (!storageError) return false;
        const ok = persist(Object.assign({}, record)); render(); return ok;
      }
      saving = true; render();
      try { currentWork = collect(); dirty = true; const ok = persist(Object.assign({}, record, { identity, work: currentWork })); saving = false; render(); return ok; }
      catch (error) { saving = false; feedbackErrors = [error.message]; render(); return false; }
    }
    function edited() {
      if (!identity || sending || conflict || (record && record.pending)) return;
      feedbackErrors = []; feedback = ''; dirty = true;
      try { currentWork = collect(); } catch (_) { currentWork = null; }
      render(); clearTimeout(saveTimer); saveTimer = setTimeout(save, Number.isFinite(config.autosaveMs) ? Math.max(0, config.autosaveMs) : 350);
    }
    async function claimSession(key) {
      if (!navigator.locks) return true;
      return new Promise(resolve => {
        navigator.locks.request(key + ':writer', { ifAvailable: true }, async lock => {
          if (!lock) { resolve(false); return; }
          await new Promise(release => { releaseSession = release; resolve(true); });
        }).catch(() => resolve(false));
      });
    }
    async function begin(event) {
      if (event) event.preventDefault();
      if (confirming || identity || destroyed) return;
      confirming = true; feedbackErrors = []; storageError = ''; render();
      let chosen = normalizeIdentity({ type: mode.type, namespace: mode.namespace, value: el('identity-value').value, period: el('period').value, nameTag: mode.nameTagRequired ? el('name-tag').value : '' });
      const errors = [];
      if (!chosen.value || chosen.value.length > (mode.type === 'student_name' ? 100 : 80) || /[\u0000-\u001f\u007f]/.test(chosen.value)) errors.push('Enter your ' + (mode.type === 'student_name' ? 'full name.' : 'assigned code.'));
      if (mode.type === 'student_name' && chosen.value.split(' ').length < 2) errors.push('Use your first and last name. If your name has only one part, ask your teacher for help.');
      if (mode.type !== 'student_name') {
        const pattern = mode.idPattern || (mode.type === 'anonymous_id' ? '^IACA-[0-9]{6}$' : '^P[1-9][0-9]*C[0-9]{2}$');
        try { if (!new RegExp(pattern).test(chosen.value)) errors.push('Enter the exact code your teacher gave you.'); } catch (_) { errors.push('The activity’s ID settings need your teacher’s help.'); }
      }
      if ((mode.requirePeriod && !chosen.period) || (chosen.period && !periods.includes(chosen.period))) errors.push('Choose your class period.');
      if (mode.nameTagRequired && (!chosen.nameTag || !/^[A-Z0-9][A-Z0-9_-]{0,23}$/.test(chosen.nameTag))) errors.push('Enter the exact name tag your teacher gave you (up to 24 letters, numbers, hyphens, or underscores).');
      if (global.self !== global.top) errors.push('Open this assignment in its own browser tab, then try again.');
      if (!['https:', 'http:'].includes(location.protocol)) errors.push('Open this assignment from its website link. Local file previews cannot turn in work.');
      if (errors.length) { feedbackErrors = errors; confirming = false; render(); return; }
      const turn = ++generation;
      try {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalIdentity(chosen)));
        if (destroyed || turn !== generation) return;
        const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        const key = 'iaca:v1:draft:' + encodeURIComponent(assignment.id) + ':' + encodeURIComponent(assignment.version) + ':' + hex;
        const acquired = await claimSession(key);
        if (destroyed || turn !== generation) { if (releaseSession) releaseSession(); return; }
        identity = chosen; storageKey = key; conflict = !acquired;
        config.resetResponses();
        if (conflict) { confirming = false; render(); return; }
        const stored = readJSON(key);
        if (stored) {
          if (stored.format !== 'iaca-draft-1' || canonicalIdentity(stored.identity) !== canonicalIdentity(chosen) || !Number.isInteger(stored.revision) || !stored.work) throw new Error('Saved draft format is invalid');
          if (stored.pending) {
            const pendingRequest = JSON.parse(stored.pending.payload);
            if (!UUID.test(stored.pending.requestId) || pendingRequest.requestId !== stored.pending.requestId || pendingRequest.assignment.id !== assignment.id || pendingRequest.assignment.version !== assignment.version || canonicalIdentity(pendingRequest.identity) !== canonicalIdentity(chosen)) throw new Error('Saved request is invalid');
          }
          record = stored; currentWork = stored.work;
          config.restoreResponses(JSON.parse(JSON.stringify(stored.work.responses)));
          // Assignment response hooks must recreate any derived results/artifacts deterministically.
          currentWork = collect();
          if (stored.pending) currentWork = stored.work;
          dirty = false;
        } else { record = { revision: 0, identity, work: collect(), pending: null, receipt: null, receivedWork: null }; currentWork = record.work; save(); }
        if (el('remember').checked) writeJSON(rememberKey, chosen); else localStorage.removeItem(rememberKey);
      } catch (_) {
        storageError = 'Saved work could not be opened safely. Keep this tab open and ask your teacher for help. Do not clear browser data; it may contain an unfinished submission.';
        conflict = true;
      }
      confirming = false; render();
      if (identity && !conflict && !record.pending) { const first = workRoot.querySelector('input:not([disabled]),textarea:not([disabled]),select:not([disabled]),button:not([disabled])'); if (first) first.focus(); }
    }
function endpointReady() {
  try {
    const u = new URL(config.endpoint);

    const validPath =
      /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname) ||
      /^\/a\/macros\/[^/]+\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname);

    return (
      u.protocol === 'https:' &&
      u.hostname === 'script.google.com' &&
      validPath &&
      !u.search &&
      !u.hash
    );
  } catch (_) {
    return false;
  }
}
    function validateReceipt(response, pending) {
      const receipt = response.receipt;
      return response.ok === true && response.requestId === pending.requestId && receipt && UUID.test(receipt.submissionId) && receipt.requestId === pending.requestId && receipt.assignmentId === assignment.id && receipt.assignmentVersion === assignment.version && Number.isInteger(receipt.attempt) && receipt.attempt > 0 && typeof receipt.receivedAt === 'string' && Number.isFinite(Date.parse(receipt.receivedAt)) && typeof receipt.duplicate === 'boolean';
    }
    async function turnIn() {
      if (!identity || sending || conflict || storageError || destroyed || receivedMatches()) return false;
      clearTimeout(saveTimer); feedback = ''; feedbackErrors = [];
      if (!endpointReady()) { feedbackErrors = ['This activity is not connected yet. Your teacher needs to finish setup before you can turn it in. Your local draft is still available.']; render(); return false; }
      if (!record.pending) {
        if (!save()) return false;
        let check;
        try { check = config.validate(JSON.parse(JSON.stringify(currentWork.responses))); } catch (_) { check = { ok: false, errors: ['The activity could not check your work. Ask your teacher for help.'] }; }
        if (!check || check.ok !== true) { feedbackErrors = check && Array.isArray(check.errors) && check.errors.length ? check.errors.map(String) : ['Complete the required work before you turn it in.']; render(); el('status').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return false; }
        const requestId = uid();
        const envelope = { schemaVersion: '1.0', requestId, assignment: { id: assignment.id, version: assignment.version }, identity, client: { createdAt: new Date().toISOString(), moduleVersion: VERSION }, responses: currentWork.responses, results: currentWork.results, artifacts: currentWork.artifacts };
        const payload = JSON.stringify(envelope);
        if (bytes(payload) > MAX_BYTES) { feedbackErrors = ['This activity has too much data to turn in. Ask your teacher for help. Your draft remains on this Chromebook.']; render(); return false; }
        if (!persist(Object.assign({}, record, { pending: { requestId, payload }, work: currentWork }))) { render(); return false; }
      } else {
        // Verify the frozen request remains durable before any network retry.
        try { const stored = readJSON(storageKey); if (!stored || !stored.pending || stored.pending.payload !== record.pending.payload) { conflict = true; render(); return false; } }
        catch (_) { storageError = 'The saved submission cannot be read. Keep this tab open and ask your teacher for help.'; render(); return false; }
      }
      const pending = record.pending;
      const turn = generation;
      sending = true; render();
      try {
        const response = await transport(config.endpoint, pending.payload, pending.requestId, config.timeoutMs || 35000);
        if (destroyed || turn !== generation) return false;
        if (response.ok) {
          if (!validateReceipt(response, pending)) { feedback = 'The confirmation could not be verified. Press TRY AGAIN to safely request a receipt.'; return false; }
          const committed = Object.assign({}, record, { pending: null, receipt: response.receipt, receivedWork: record.work });
          if (!persist(committed)) {
            // The receipt is real even if its local cache cannot be written. The old pending request stays on disk and is safe to retry on reopening.
            if (!conflict) record = committed;
          }
          feedback = ''; return true;
        }
        const error = response.error || {};
        // A definitive validation rejection did not commit. Unlock the draft to repair it.
        if (['INVALID_REQUEST', 'INVALID_IDENTITY', 'UNKNOWN_ASSIGNMENT', 'ASSIGNMENT_CLOSED', 'VALIDATION_FAILED', 'TOO_LARGE'].includes(error.code) && error.retryable === false) {
          if (persist(Object.assign({}, record, { pending: null }))) feedbackErrors = [typeof error.message === 'string' ? error.message.slice(0, 500) : 'Your work was not accepted. Ask your teacher for help.'];
        } else {
          feedback = error.code === 'CONFLICT' ? 'This request has a conflict. Keep this tab open and ask your teacher for help; do not start a new submission.' : 'Receipt not confirmed. Your submission is saved on this Chromebook. Check your connection and press TRY AGAIN.';
        }
        return false;
      } catch (error) { feedback = error.message || 'Receipt not confirmed. Check your connection and press TRY AGAIN.'; return false; }
      finally { sending = false; render(); }
    }
    function changeStudent() {
      if (sending || destroyed) return false;
      if (identity && !conflict && !(record && record.pending)) save();
      if (dirty && storageError) { feedbackErrors = ['Your current changes are not saved. Keep this tab open and ask your teacher for help before changing students.']; render(); return false; }
      clearTimeout(saveTimer); generation++;
      if (releaseSession) { releaseSession(); releaseSession = null; }
      config.resetResponses();
      identity = null; storageKey = null; record = null; currentWork = null; conflict = false; dirty = false; feedback = ''; feedbackErrors = []; storageError = '';
      el('identity-value').value = ''; el('period').value = ''; el('name-tag').value = ''; el('remember').checked = false;
      render(); el('identity-value').focus(); return true;
    }
    function onStorage(event) { if (identity && event.key === storageKey && !destroyed) { conflict = true; render(); } }
    function onPageHide() { if (releaseSession) { releaseSession(); releaseSession = null; } }
    function onPageShow(event) { if (event.persisted && identity) { conflict = true; render(); } }
    function beforeUnload(event) { if (dirty || sending) { event.preventDefault(); event.returnValue = ''; } }
    function onVisibility() { if (document.visibilityState === 'hidden' && dirty && !sending) save(); }
    function destroy() {
      if (destroyed) return;
      if (identity && dirty && !sending) save();
      destroyed = true; generation++; clearTimeout(saveTimer);
      if (releaseSession) releaseSession();
      workRoot.removeEventListener('input', edited); workRoot.removeEventListener('change', edited);
      global.removeEventListener('storage', onStorage); global.removeEventListener('beforeunload', beforeUnload); global.removeEventListener('pagehide', onPageHide); global.removeEventListener('pageshow', onPageShow); document.removeEventListener('visibilitychange', onVisibility);
      el('identity-form').removeEventListener('submit', begin); el('turn-in').removeEventListener('click', turnIn); el('save').removeEventListener('click', save); el('change-student').removeEventListener('click', changeStudent);
      lockWork(true);
    }
    config.resetResponses();
    try { const remembered = readJSON(rememberKey); if (remembered && remembered.type === mode.type && remembered.namespace === mode.namespace) { el('identity-value').value = remembered.value || ''; el('period').value = remembered.period || ''; el('name-tag').value = remembered.nameTag || ''; el('remember').checked = true; } }
    catch (_) { storageError = 'This browser could not open local storage. You can enter your information, but work must save successfully before it can be sent.'; }
    el('identity-form').addEventListener('submit', begin); el('turn-in').addEventListener('click', turnIn); el('save').addEventListener('click', save); el('change-student').addEventListener('click', changeStudent);
    workRoot.addEventListener('input', edited); workRoot.addEventListener('change', edited);
    global.addEventListener('storage', onStorage); global.addEventListener('beforeunload', beforeUnload); global.addEventListener('pagehide', onPageHide); global.addEventListener('pageshow', onPageShow); document.addEventListener('visibilitychange', onVisibility);
    render();
    return Object.freeze({ save, turnIn, changeStudent, destroy });
  }
  global.IACASubmission = Object.freeze({ version: VERSION, init, _internals: Object.freeze({ normalizeIdentity, canonicalIdentity, isReceiptOrigin, sourceInsideFrame, stableStringify }) });
})(window);
