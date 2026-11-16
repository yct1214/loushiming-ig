// 投影畫面
import {
  ctx, $, esc, stageInfo, gd, likeCount, shownGroups, pollCounts, tiles, waiting, tickTimers,
  isGuest, groupLabel, participants,
  groupPostCard, exampleCard, groupCount, range, keepCarousels,
  COMMENTS, DILEMMA, POLL, POLL_ORDER, LIMIT_CAPTION, LIMIT_REPLY,
} from './ui.js';

const QR_URL = 'https://esm.sh/qrcode@1.5.3';
let qrCache = null;

export function initScreen() {
  document.body.classList.add('screen-view');
  const app = $('#app');

  // 老師可直接在投影畫面點選已投影的帖子放大展示；聚焦狀態與教師控制台同步。
  const S = () => ctx.state;
  const pickable = () => showable(S());
  const focused = () => { const f = Number(S().focus) || 0; return pickable().includes(f) ? f : 0; };
  const setFocus = n => { Promise.resolve(ctx.store.set('focus', n || null)).catch(() => {}); };
  const step = d => {
    const ns = pickable();
    const i = ns.indexOf(focused());
    if (i >= 0 && ns.length > 1) setFocus(ns[(i + d + ns.length) % ns.length]);
  };

  app.addEventListener('click', e => {
    const t = e.target;
    const nav = t.closest('[data-nav]');
    if (nav) { step(Number(nav.dataset.nav)); return; }
    if (t.closest('[data-close]') || t.classList.contains('overlay')) { setFocus(null); return; }
    const card = t.closest('[data-pick]');
    if (card) setFocus(Number(card.dataset.pick));
  });
  document.addEventListener('keydown', e => {
    if (!pickable().length) return;
    const card = e.target.closest && e.target.closest('[data-pick]');
    if (focused()) {
      if (e.key === 'Escape') setFocus(null);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    } else if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setFocus(Number(card.dataset.pick));
    }
  });

  function update() {
    const s = ctx.state;
    if (!s.session) { app.innerHTML = waiting('等待老師開啟活動……'); return; }
    const stage = s.stage || 'intro';
    const st = stageInfo(stage);
    keepCarousels(app, () => {
      app.innerHTML = `<header class="topbar"><span class="brand">劉禹錫開 IG</span><span class="stage-name">${st.step}｜${st.label}</span>
        <span class="spacer"></span><span class="timer" data-timer hidden></span></header><main id="body" class="body"></main>`;
      const views = { intro, post, reply, like, poll, end };
      (views[stage] || intro)($('#body'), s);
      $('#body').insertAdjacentHTML('beforeend', overlay(s));
    });
    tickTimers();
  }

  return { update };
}

// 訪客帖子不設點讚，不顯示讚數
const shownLikes = (s, n) => (isGuest(n) ? null : likeCount(s, n));

// 可在投影畫面展示的組別：步驟 2 至 4 中，已發佈並已按「投影」的帖子
const SHOW_STAGES = ['post', 'reply', 'like'];
function showable(s) {
  return SHOW_STAGES.includes(s.stage || 'intro') ? shownGroups(s) : [];
}

function overlay(s) {
  const ns = showable(s);
  const focus = Number(s.focus) || 0;
  const fi = focus ? ns.indexOf(focus) : -1;
  if (fi < 0) return '';
  const navBtn = (d, label) => (ns.length > 1 ? `<button type="button" class="btn" data-nav="${d}">${label}</button>` : '');
  return `<div class="overlay"><div class="overlay-wrap">
    <div class="overlay-bar">${navBtn(-1, '‹ 上一組')}<span class="overlay-title">${groupLabel(focus)}（${fi + 1} / ${ns.length}）</span>${navBtn(1, '下一組 ›')}
      <span class="spacer"></span><button type="button" class="btn" data-close>✕ 關閉</button></div>
    <div class="overlay-card">${groupPostCard(s, focus, { key: `focus-g${focus}`, ...(s.stage === 'like' ? { likes: shownLikes(s, focus) } : {}) })}</div></div></div>`;
}

function joinURL() {
  return `${location.origin}${location.pathname}?role=group`;
}

async function paintQR() {
  const img = $('#qr');
  if (!img) return;
  try {
    if (!qrCache) {
      const mod = await import(QR_URL);
      const toDataURL = mod.toDataURL || mod.default?.toDataURL;
      qrCache = await toDataURL(joinURL(), { width: 320, margin: 1 });
    }
    const el = $('#qr');
    if (el) { el.src = qrCache; el.hidden = false; }
  } catch {
    // 載入失敗時只顯示網址
  }
}

function intro(body) {
  body.innerHTML = `<div class="two-col">
    <section class="panel">
      <h2>情境</h2>
      <p class="lead">劉禹錫剛被貶到和州，開了一個 IG 帳號，第一個帖子就是他陋室的相片。</p>
      <p class="lead">你們是他的小編，要幫他寫帖子，還要幫他回覆網友的留言。</p>
      <div class="join"><h3>小組平板請進入</h3><img id="qr" alt="小組平板網址二維碼" hidden><p class="url">${esc(joinURL())}</p></div>
    </section>
    <section class="preview"><h3>示範帖子</h3>${exampleCard()}</section></div>`;
  paintQR();
}

function post(body, s) {
  body.innerHTML = `<div class="two-col">
    <section class="panel"><h2>撰寫帖子的要求</h2><ol class="req">
      <li>帖子說明用白話書面語，不超過 ${LIMIT_CAPTION} 字。</li>
      <li>最少提到陋室的景、人、事其中一項。</li>
      <li>三個標籤取自課文字句，或緊扣主旨；其中一個要表達作者的心情。</li></ol></section>
    <section class="panel"><h2>發佈進度</h2>${tiles(s, n => !!gd(s, n).postAt, n => showable(s).includes(n))}${pickHint(s)}</section></div>`;
}

function reply(body, s) {
  const assigned = cid => participants(s).filter(n => Number(gd(s, n).commentId) === cid);
  body.innerHTML = `<div class="two-col">
    <section class="panel"><h2>網友留言</h2>
      ${[1, 2, 3].map(cid => {
        const gs = assigned(cid);
        return `<div class="comment-row"><blockquote class="comment-box"><b>@${esc(COMMENTS[cid].handle)}</b>：${esc(COMMENTS[cid].text)}</blockquote>
          <span class="assigned">${gs.length ? gs.map(groupLabel).join('、') : '未分配'}</span></div>`;
      }).join('')}
      <ol class="req"><li>以劉禹錫的身份回覆，不超過 ${LIMIT_REPLY} 字。</li><li>不可以動氣，也不可以反罵對方。</li><li>引用或化用最少一句課文。</li></ol>
    </section>
    <section class="panel"><h2>回覆進度</h2>${tiles(s, n => !!gd(s, n).replyAt, n => showable(s).includes(n))}${pickHint(s)}</section></div>`;
}

const pickHint = s => (showable(s).length ? '<p class="pick-hint">點選有「▶ 展示」的組別，可放大展示該組帖子。</p>' : '');

function like(body, s) {
  const ns = shownGroups(s);
  body.innerHTML = `<p class="criteria center">投票準則：有風度・有課文根據・有創意</p>
    ${ns.length
      ? `<p class="pick-hint center">點選帖子可放大展示</p>
        <div class="feed screen-feed">${ns.map(n => `<div class="pick-card" data-pick="${n}" role="button" tabindex="0" aria-label="放大展示${groupLabel(n)}的帖子">${groupPostCard(s, n, { likes: shownLikes(s, n) })}</div>`).join('')}</div>`
      : '<p class="muted center">老師審閱帖子後，會在這裏顯示。</p>'}`;
}

function poll(body, s) {
  const c = pollCounts(s);
  const total = POLL_ORDER.reduce((a, k) => a + c[k], 0);
  const bars = POLL_ORDER.map(k => {
    const pct = total ? Math.round((c[k] / total) * 100) : 0;
    return `<div class="bar-row"><span class="bar-label">${POLL[k].label}</span>
      <div class="bar-track"><div class="bar ${k}" style="width:${pct}%"></div></div><span class="bar-num">${c[k]} 人（${pct}%）</span></div>`;
  }).join('');
  body.innerHTML = `<section class="panel wide center">
    <blockquote class="dilemma">${esc(DILEMMA)}</blockquote>
    <p class="lead">已投票：<b>${total}</b> 人</p>
    ${s.showPoll ? `<div class="bars">${bars}</div>` : '<p class="muted">投票結果稍後公布</p>'}
    </section>`;
}

function end(body) {
  body.innerHTML = `<div class="center-page">
    <p class="big-quote">斯是陋室，惟吾德馨。</p>
    <p class="big-quote small-quote">孔子云：「何陋之有？」</p></div>`;
}
