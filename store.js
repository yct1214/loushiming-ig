// 資料儲存：有 Firebase 設定時用雲端（Realtime Database），否則用本機測試模式（localStorage）。
const ROOT = 'ig';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export async function createStore(firebaseConfig, onError) {
  if (firebaseConfig) return createCloudStore(firebaseConfig, onError);
  return createLocalStore();
}

async function createCloudStore(config, onError) {
  const { initializeApp } = await import(FB + 'firebase-app.js');
  const { getDatabase, ref, onValue, set, update } = await import(FB + 'firebase-database.js');
  const db = getDatabase(initializeApp(config));
  let offset = 0;
  onValue(ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  const fail = err => { onError('無法寫入資料：' + err.message); throw err; };
  return {
    mode: 'cloud',
    now: () => Date.now() + offset,
    subscribe(cb) {
      onValue(ref(db, ROOT), s => cb(s.val() || {}), err => onError('無法讀取資料：' + err.message));
    },
    onConnection(cb) { onValue(ref(db, '.info/connected'), s => cb(!!s.val())); },
    set: (path, val) => set(ref(db, `${ROOT}/${path}`), val ?? null).catch(fail),
    update: obj => update(ref(db, ROOT), obj).catch(fail),
    replace: obj => set(ref(db, ROOT), obj).catch(fail),
  };
}

function createLocalStore() {
  const KEY = 'ig-loushiming-state';
  const listeners = [];
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const emit = () => { const s = read(); listeners.forEach(cb => cb(s)); };
  const write = s => { localStorage.setItem(KEY, JSON.stringify(s)); emit(); };
  const setPath = (obj, path, val) => {
    const parts = path.split('/');
    let o = obj;
    for (const p of parts.slice(0, -1)) {
      if (typeof o[p] !== 'object' || o[p] === null) o[p] = {};
      o = o[p];
    }
    const last = parts[parts.length - 1];
    if (val === null || val === undefined) delete o[last]; else o[last] = val;
  };
  window.addEventListener('storage', e => { if (e.key === KEY) emit(); });
  return {
    mode: 'local',
    now: () => Date.now(),
    subscribe(cb) { listeners.push(cb); cb(read()); },
    onConnection(cb) { cb(true); },
    async set(path, val) { const s = read(); setPath(s, path, val); write(s); },
    async update(obj) { const s = read(); for (const [p, v] of Object.entries(obj)) setPath(s, p, v); write(s); },
    async replace(obj) { write(obj || {}); },
  };
}
