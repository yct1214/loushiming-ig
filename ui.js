// 共用常數、工具及元件

// 全域狀態：store 為資料儲存，state 為最新資料
export const ctx = { store: null, state: {} };

export const STAGES = [
  { id: 'intro', step: '步驟 1', label: '準備' },
  { id: 'post', step: '步驟 2', label: '撰寫帖子' },
  { id: 'reply', step: '步驟 3', label: '回覆留言' },
  { id: 'like', step: '步驟 4', label: '分享及點讚' },
  { id: 'poll', step: '步驟 5', label: '兩難投票' },
  { id: 'end', step: '完成', label: '總結' },
];

export const HANDLE = '劉夢得_和州';

// 訪客（例如評課人員）：以組號 99 儲存，帖子標示「訪客」；
// 訪客的讚存於 guestLikes、兩難投票存於 guestPoll，不計入任何讚數或投票結果。
export const GUEST = 99;
export const isGuest = n => Number(n) === GUEST;
export const groupLabel = n => (isGuest(n) ? '訪客' : `第 ${n} 組`);
export const guestJoined = s => !!((s.groups || {})['g' + GUEST] || {}).joined;
// 所有參與者：各組，再加上已加入的訪客
export const participants = s => [...range(groupCount(s)), ...(guestJoined(s) ? [GUEST] : [])];

export const COMMENTS = {
  1: { handle: '長安路人', text: '這麼破舊的屋也好意思上載？' },
  2: { handle: '官場八卦站', text: '被貶官了還裝作很開心，誰會相信？' },
  3: { handle: '豪宅鑑賞家', text: '人家住官邸，你住草屋，太失敗了吧。' },
};

export const TAG_BANK = [
  { title: '寫景', tags: ['苔痕上階綠', '草色入簾青'] },
  { title: '寫人', tags: ['談笑有鴻儒', '往來無白丁'] },
  { title: '寫事', tags: ['調素琴', '閱金經', '無絲竹之亂耳', '無案牘之勞形'] },
  { title: '寫心情或主旨', tags: ['惟吾德馨', '何陋之有', '斯是陋室', '山不在高'] },
];

export const QUOTES = [
  '山不在高，有仙則名', '水不在深，有龍則靈', '斯是陋室，惟吾德馨',
  '苔痕上階綠，草色入簾青', '談笑有鴻儒，往來無白丁', '可以調素琴，閱金經',
  '無絲竹之亂耳，無案牘之勞形', '南陽諸葛廬，西蜀子雲亭', '何陋之有',
];

export const FRAMES_POST = ['今天在陋室＿＿＿，覺得＿＿＿。', '這間屋雖然＿＿＿，但是＿＿＿。'];

export const DILEMMA = '你在 IG 上載了一幅自己很滿意的畫，只得三個讚，同學的新球鞋相片有八十個讚。你會刪掉自己的帖子嗎？';

export const POLL = {
  del: { label: '刪' },
  keep: { label: '不刪' },
  depends: { label: '看情況' },
};
export const POLL_ORDER = ['del', 'keep', 'depends'];

export const LIMIT_CAPTION = 50;
export const LIMIT_REPLY = 40;
export const MAX_TAGS = 3;
export const LIKES_PER_MEMBER = 2;

// ---------- 工具 ----------
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const count = s => [...String(s || '').replace(/\s/g, '')].length;
export const toArr = v => (Array.isArray(v) ? v : v ? Object.values(v) : []).filter(x => x != null);
export const stageInfo = id => STAGES.find(s => s.id === id) || STAGES[0];
export const groupCount = s => Number(s.groupCount) || 6;
export const gd = (s, g) => (s.groups || {})['g' + g] || {};
export const likeCount = (s, g) => Object.keys((s.likes || {})['g' + g] || {}).length;
export const range = n => Array.from({ length: n }, (_, i) => i + 1);
export const shownGroups = s => participants(s).filter(n => gd(s, n).shown && gd(s, n).postAt);
export const rid = () => Math.random().toString(36).slice(2, 10);

export function pollCounts(s) {
  const c = { del: 0, keep: 0, depends: 0 };
  Object.values(s.poll || {}).forEach(v => { if (v in c) c[v]++; });
  return c;
}

export function timerText(s) {
  if (!s.timer || !s.timer.end) return '';
  const ms = s.timer.end - ctx.store.now();
  if (ms <= 0) return '時間到';
  const t = Math.ceil(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function tickTimers() {
  const t = timerText(ctx.state);
  $$('[data-timer]').forEach(el => {
    el.textContent = t;
    el.hidden = !t;
    el.classList.toggle('timeup', t === '時間到');
  });
}

let toastTimer;
export function flash(msg, type = 'warn') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

export function insertAtCursor(ta, text) {
  ta.focus();
  ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
  ta.dispatchEvent(new Event('input'));
}

export const waiting = msg => `<div class="center-page"><h1 class="brand">劉禹錫開 IG</h1><p>${esc(msg)}</p></div>`;

// ---------- 帖子圖片 ----------
// 示範帖子固定用諸葛廬。各組帖子都包含 GROUP_IMAGES 的全部圖片，可左右滑動切換；
// 第一張（封面）按組號而不同：第 1 組由第一張開始，第 2 組由第二張開始，如此類推。
// 組數多於圖片數量時（第 7、8 組），封面由第一張起重複使用。
// 如要增減圖片，把圖片放進 image 資料夾，再在 GROUP_IMAGES 增刪一行即可。
export const EXAMPLE_IMAGE = { src: 'image/zhugelu_01.jpeg', alt: '南陽諸葛廬' };
export const GROUP_IMAGES = [
  { src: 'image/loushi_02_doorway.jpeg', alt: '陋室：門口望入屋內' },
  { src: 'image/loushi_03_window-curtain.jpeg', alt: '陋室：窗邊竹簾' },
  { src: 'image/loushi_04_stone-steps.jpeg', alt: '陋室：門外石階' },
  { src: 'image/loushi_05_desk-flatlay.jpeg', alt: '陋室：書案上的古琴和經卷' },
  { src: 'image/loushi_06_guqin-closeup.jpeg', alt: '陋室：古琴特寫' },
  { src: 'image/loushi_07_night-lamp.jpeg', alt: '陋室：夜晚的油燈' },
];
// 劉禹錫帳號（HANDLE）的頭像；其他帳號仍顯示名稱首字。
export const LIU_AVATAR = { src: 'image/ui_avatar_liuyuxi.jpeg', alt: '劉禹錫頭像' };
export const ZHUGE_AVATAR = { src: 'image/ui_avatar_zhugeliang.jpeg', alt: '諸葛亮頭像' };
const coverIndex = n => (Math.max(1, Number(n) || 1) - 1) % GROUP_IMAGES.length;
export const groupImage = n => GROUP_IMAGES[coverIndex(n)];
// 第 n 組帖子的全部圖片，由該組的封面開始
export function groupImages(n) {
  const k = coverIndex(n);
  return [...GROUP_IMAGES.slice(k), ...GROUP_IMAGES.slice(0, k)];
}

// ---------- 圖片輪播 ----------
// 帖子有多於一張圖片時顯示為輪播：平板可左右滑動，電腦可按左右箭咀；右上角顯示「目前 / 總數」，下方有圓點。
function mediaHTML(imgs, key) {
  if (!imgs.length) return '<div class="post-img"></div>';
  const multi = imgs.length > 1;
  const slides = imgs.map((im, i) => `<figure class="slide"><img src="${esc(im.src)}" alt="${esc(im.alt)}" decoding="async" ${i ? 'loading="lazy"' : ''} draggable="false"></figure>`).join('');
  if (!multi) return `<div class="post-img"><div class="slides">${slides}</div></div>`;
  return `<div class="post-img" data-carousel="${esc(key || rid())}">
    <div class="slides">${slides}</div>
    <button type="button" class="slide-nav prev" data-slide="-1" aria-label="上一張圖片" hidden>‹</button>
    <button type="button" class="slide-nav next" data-slide="1" aria-label="下一張圖片">›</button>
    <span class="img-counter">1/${imgs.length}</span>
    ${dotsHTML(imgs.length)}
  </div>`;
}

const dotsHTML = n => (n > 1
  ? `<div class="dots" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`
  : '');

export function syncCarousel(slides) {
  const box = slides && slides.closest('[data-carousel]');
  if (!box) return;
  const n = slides.children.length;
  const i = Math.min(n - 1, Math.max(0, Math.round(slides.scrollLeft / (slides.clientWidth || 1))));
  const counter = box.querySelector('.img-counter');
  if (counter) counter.textContent = `${i + 1}/${n}`;
  const prev = box.querySelector('.prev');
  const next = box.querySelector('.next');
  if (prev) prev.hidden = i === 0;
  if (next) next.hidden = i === n - 1;
  box.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k === i));
}

// 重新繪畫畫面（例如有新的讚）時，保留每個輪播目前看到的圖片
export function keepCarousels(root, render) {
  const pos = {};
  root.querySelectorAll('[data-carousel]').forEach(c => {
    const s = c.querySelector('.slides');
    if (s && s.clientWidth) pos[c.dataset.carousel] = Math.round(s.scrollLeft / s.clientWidth);
  });
  render();
  root.querySelectorAll('[data-carousel]').forEach(c => {
    const s = c.querySelector('.slides');
    const i = pos[c.dataset.carousel] || 0;
    if (i) s.scrollLeft = i * s.clientWidth;
    syncCarousel(s);
  });
}

// 在 app.js 啟動時呼叫一次
export function initCarousels() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-slide]');
    if (!b) return;
    e.stopPropagation();
    const s = b.closest('[data-carousel]').querySelector('.slides');
    s.scrollBy({ left: Number(b.dataset.slide) * s.clientWidth, behavior: 'smooth' });
  }, true);
  document.addEventListener('scroll', e => {
    const t = e.target;
    if (t instanceof Element && t.classList.contains('slides')) syncCarousel(t);
  }, true);
}

// ---------- 元件 ----------
// images：圖片陣列（多於一張時顯示為輪播）；image：單張圖片（舊寫法，仍可使用）。
// key：輪播的識別名稱，用於重新繪畫時保留目前看到的圖片。
export function postCard({ title = HANDLE, sub = '', caption = '', tags = [], likes = null, comment = null, reply = '', image = null, images = null, key = '', avatar, likeBtn = null, extraClass = '', guest = false } = {}) {
  const tagList = toArr(tags);
  const imgs = (images || (image ? [image] : [])).filter(x => x && x.src);
  const av = avatar !== undefined ? avatar : (title === HANDLE ? LIU_AVATAR : null);
  return `<article class="post ${guest ? 'guest' : ''} ${extraClass}">
    <header class="post-head"><div class="avatar">${av ? `<img src="${esc(av.src)}" alt="${esc(av.alt)}" decoding="async">` : esc(title[0])}</div><div><div class="handle">${esc(title)}${guest ? ' <span class="guest-badge">訪客</span>' : ''}</div>${sub && !guest ? `<div class="sub">${esc(sub)}</div>` : ''}</div></header>
    ${mediaHTML(imgs, key)}
    <div class="post-actions">${likeBtn ?? '<span class="heart" aria-hidden="true">♡</span>'}${likes !== null ? `<span class="likes">${likes} 個讚</span>` : ''}</div>
    <div class="caption">${caption ? `<b>${esc(title)}</b> ${esc(caption)}` : '<span class="muted">（未有帖子說明）</span>'}</div>
    ${tagList.length ? `<div class="tags">${tagList.map(t => `<span>#${esc(t)}</span>`).join(' ')}</div>` : ''}
    ${comment ? `<div class="comments"><div class="cmt"><b>${esc(comment.handle)}</b> ${esc(comment.text)}</div>${reply ? `<div class="cmt reply"><b>${esc(title)}</b> ${esc(reply)}</div>` : ''}</div>` : ''}
  </article>`;
}

export function groupPostCard(s, n, extra = {}) {
  const d = gd(s, n);
  return postCard({ sub: groupLabel(n), guest: isGuest(n), caption: d.caption, tags: d.tags, comment: COMMENTS[d.commentId] || null, reply: d.reply, images: groupImages(n), key: `g${n}`, ...extra });
}

export const exampleCard = () => postCard({
  title: '諸葛孔明_隆中',
  sub: '示範帖子',
  caption: '在草廬種田讀書，日子簡單，心裏踏實。等一位真正懂我的人。',
  tags: ['躬耕南陽', '草廬一日', '等待時機'],
  image: EXAMPLE_IMAGE,
  avatar: ZHUGE_AVATAR,
});

// canPick(n) 為真時，該組的格子可點選，用於在投影畫面展示帖子
export function tiles(s, done, canPick = () => false) {
  return `<div class="tiles">${participants(s).map(n => {
    const ok = done(n);
    const status = `<span>${ok ? '✓ 已完成' : '進行中……'}</span>`;
    const label = groupLabel(n);
    const cls = `tile ${ok ? 'ok' : ''} ${isGuest(n) ? 'guest-tile' : ''}`;
    return canPick(n)
      ? `<button type="button" class="${cls} pickable" data-pick="${n}" aria-label="展示${label}的帖子"><b>${label}</b>${status}<span class="tile-show">▶ 展示</span></button>`
      : `<div class="${cls}"><b>${label}</b>${status}</div>`;
  }).join('')}</div>`;
}
