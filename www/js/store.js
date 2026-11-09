// Everything the app keeps lives on the phone, in IndexedDB: keys, settings, lessons, chat, the list of videos.
// The video files themselves are on the phone's storage (native.js); in a desktop browser they are kept here as Blobs.
const DB = 'cpmaster-studio', VER = 1;
let dbp;

function db() {
  return (dbp ||= new Promise((ok, bad) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('videos')) d.createObjectStore('videos', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  }));
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((ok, bad) => {
    const t = d.transaction(store, mode), s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => bad(t.error);
    t.onabort = () => bad(t.error || new Error('Хранилище переполнено'));
  });
}

export const kv = {
  get: (k, dflt) => tx('kv', 'readonly', (s) => s.get(k)).then((v) => (v === undefined ? dflt : v)),
  set: (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k)),
  del: (k) => tx('kv', 'readwrite', (s) => s.delete(k)),
};

export const videos = {
  all: () => tx('videos', 'readonly', (s) => s.getAll()).then((v) => v.sort((a, b) => b.created - a.created)),
  put: (v) => tx('videos', 'readwrite', (s) => s.put(v)),
  del: (id) => tx('videos', 'readwrite', (s) => s.delete(id)),
};

export const blobs = {
  get: (k) => tx('blobs', 'readonly', (s) => s.get(k)),
  put: (k, b) => tx('blobs', 'readwrite', (s) => s.put(b, k)),
  del: (k) => tx('blobs', 'readwrite', (s) => s.delete(k)),
  clear: () => tx('blobs', 'readwrite', (s) => s.clear()),
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
