/* Morrigan's voices live only on the phone, never in the repo.
   They are loaded once from voices.html (a page with no link to it) and kept in IndexedDB.
   The Menu reads them from here; without them it simply stays silent. */
(function () {
  'use strict';
  var DB = 'morrigan', STORE = 'voices';
  // file name (without extension) -> voice
  var NAMES = ['response', 'rarewakeup', 'revolverse_1', 'revolverse_2', 'revolverse_3', 'sleep'];

  function open() {
    return new Promise(function (ok, ko) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { ko(r.error); };
    });
  }

  function all() {
    return open().then(function (db) {
      return new Promise(function (ok, ko) {
        var out = {}, tx = db.transaction(STORE, 'readonly'), st = tx.objectStore(STORE);
        var c = st.openCursor();
        c.onsuccess = function () { var cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
        tx.oncomplete = function () { ok(out); };
        tx.onerror = function () { ko(tx.error); };
      });
    });
  }

  // Saves the files whose name is a known voice. Resolves with the names saved.
  function save(files) {
    var picked = {};
    Array.prototype.forEach.call(files, function (f) {
      var n = f.name.replace(/\.[^.]+$/, '').trim().toLowerCase();
      if (NAMES.indexOf(n) >= 0) picked[n] = f;
    });
    var names = Object.keys(picked);
    if (!names.length) return Promise.resolve([]);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    return open().then(function (db) {
      return new Promise(function (ok, ko) {
        var tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE);
        names.forEach(function (n) { st.put(picked[n], n); });
        tx.oncomplete = function () { ok(names); };
        tx.onerror = function () { ko(tx.error); };
      });
    });
  }

  // Ready-to-play urls, loaded once per page: window.__morriganVoiceURLs = { name: blob url }.
  var loading = null;
  function load() {
    if (!loading) {
      loading = all().then(function (blobs) {
        var urls = {};
        Object.keys(blobs).forEach(function (n) { urls[n] = URL.createObjectURL(blobs[n]); });
        window.__morriganVoiceURLs = urls;
        return urls;
      }).catch(function () { window.__morriganVoiceURLs = {}; return {}; });
    }
    return loading;
  }

  window.MorriganVoices = { NAMES: NAMES, save: save, load: load };
})();
