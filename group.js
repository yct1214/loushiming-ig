// 小組平板
import {
  ctx, $, $$, esc, count, toArr, stageInfo, groupCount, gd, range, shownGroups, flash, insertAtCursor,
  waiting, postCard, groupPostCard, exampleCard, groupImages, keepCarousels, tickTimers,
  GUEST, isGuest, groupLabel,
  COMMENTS, TAG_BANK, QUOTES, FRAMES_POST, DILEMMA, POLL, POLL_ORDER,
  LIMIT_CAPTION, LIMIT_REPLY, MAX_TAGS, LIKES_PER_MEMBER,
} from './ui.js';

const ROLES = [
  ['小編', '撰寫帖子說明'],
  ['標籤師', '從課文選出三個標籤'],
  ['回覆員', '撰寫回覆留言'],
  ['朗讀員', '向全班讀出帖子及回覆'],
  ['核對員', '核對引用的原文有沒有錯字，控制字數'],
];

// guest 為 true 時是訪客頻道（?role=guest）：固定以 GUEST 身份參與，不用選組別。
export function initGroup({ guest = false } = {}) {
  document.body.classList.add('group-view');
  if (guest) document.body.classList.add('guest-view');
  const app = $('#app');
  const params = new URLSearchParams(location.search);
  let g = guest ? GUEST : (Number(params.get('g')) || Number(localStorage.getItem('ig-group')) || 0);
  let joinedSession = null;
  let lastKey = null;
  let refresh = () => {};

  const store = () => ctx.store;
  const S = () => ctx.state;
  const mine = () => gd(S(), g);

  // 草稿及輪流次序存在平板本機，老師重設活動後自動失效
  const lsGet = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
  const draftKey = () => `ig-draft-${S().session}-g${g}`;
  const loadDraft = () => lsGet(draftKey(), {});
  const saveDraft = d => localStorage.setItem(draftKey(), JSON.stringify(d));
  const turnKey = kind => `ig-turn-${S().session}-${kind}-g${g}`;
  const loadTurn = kind => lsGet(turnKey(kind), { i: 1, done: false });
  const saveTurn = (kind, t) => localStorage.setItem(turnKey(kind), JSON.stringify(t));

  function choose(n) {
    g = n;
    localStorage.setItem('ig-group', String(n));
    history.replaceState(null, '', `?role=group&g=${n}`);
    lastKey = null;
    update();
  }

  function update() {
    const s = S();
    if (!s.session) { lastKey = null; app.innerHTML = waiting('等待老師開啟活動……'); return; }
    if (guest) {
      // 告訴教師控制台和投影畫面「訪客已加入」，每節活動只寫一次
      if (!mine().joined && joinedSession !== s.session) {
        joinedSession = s.session;
        store().set(`groups/g${GUEST}/joined`, true);
      }
    } else if (!g || g > groupCount(s)) { lastKey = null; renderPicker(); return; }
    const stage = s.stage || 'intro';
    const key = [s.session, stage, g, stage === 'reply' ? (mine().commentId || 0) : ''].join('|');
    if (key !== lastKey) { lastKey = key; renderStage(stage); }
    refresh();
  }

  function renderPicker() {
    app.innerHTML = `<div class="center-page"><h1 class="brand">劉禹錫開 IG</h1><p>請選擇你的組別</p>
      <div class="picker">${range(groupCount(S())).map(n => `<button type="button" class="btn pick" data-g="${n}">第 ${n} 組</button>`).join('')}</div></div>`;
    $$('[data-g]', app).forEach(b => { b.onclick = () => choose(Number(b.dataset.g)); });
  }

  function renderStage(stage) {
    const st = stageInfo(stage);
    app.innerHTML = `<header class="topbar"><span class="badge ${guest ? 'guest-badge-top' : ''}">${groupLabel(g)}</span><span class="stage-name">${st.step}｜${st.label}</span>
      <span class="spacer"></span><span class="timer" data-timer hidden></span>
      ${guest ? '' : '<button type="button" class="linkbtn" id="switchGroup">更換組別</button>'}</header>
      ${guest ? '<div class="guest-note">你正以<b>訪客</b>身份參與：帖子會標示「訪客」，你的讚和投票不會計入結果。</div>' : ''}
      <main id="body" class="body"></main>`;
    if (!guest) $('#switchGroup').onclick = () => {
      if (!confirm('確定要更換組別嗎？')) return;
      localStorage.removeItem('ig-group');
      g = 0;
      history.replaceState(null, '', '?role=group');
      lastKey = null;
      update();
    };
    refresh = () => {};
    const views = guest
      ? { intro, post, reply, like: guestLike, poll: guestPoll, end }
      : { intro, post, reply, like, poll, end };
    (views[stage] || intro)($('#body'));
    tickTimers();
  }

  // ---------- 步驟 1：準備 ----------
  function intro(body) {
    body.innerHTML = `<div class="two-col"><section class="panel">
      <h2>準備開始</h2>
      <p>劉禹錫剛被貶到和州，開了一個 IG 帳號，第一個帖子就是他陋室的相片。你們是他的小編，要幫他寫帖子，還要幫他回覆網友的留言。</p>
      ${guest
        ? `<h3>訪客參與方式</h3><ul class="checklist">
            <li>可以和同學一樣撰寫帖子、回覆留言、點讚和投票。</li>
            <li>帖子會標示「訪客」，同學不能為訪客帖子點讚。</li>
            <li>你的讚和兩難投票都不會計入結果。</li></ul>`
        : `<h3>組內分工</h3>
          <table class="roles"><tbody>${ROLES.map(([r, d]) => `<tr><th>${r}</th><td>${d}</td></tr>`).join('')}</tbody></table>`}
      <p class="muted">請等待老師開始。</p></section>
      <section class="preview"><h3>示範帖子</h3>${exampleCard()}</section></div>`;
  }

  // ---------- 步驟 2：撰寫帖子 ----------
  function post(body) {
    const d = loadDraft();
    if (typeof d.caption !== 'string') d.caption = mine().caption || '';
    if (!Array.isArray(d.tags)) d.tags = toArr(mine().tags);

    body.innerHTML = `<div class="two-col"><section class="panel">
      <h2>撰寫帖子</h2>
      <p class="role-hint">小編寫說明，標籤師選標籤，核對員檢查字數和錯字。</p>
      <label class="field-label" for="caption">帖子說明（白話書面語，${LIMIT_CAPTION} 字內）</label>
      <textarea id="caption" rows="4" placeholder="例如：搬進新居，屋子不大，門前卻……">${esc(d.caption)}</textarea>
      <div class="counter" id="capCount"></div>
      <ul class="checklist"><li>最少提到陋室的景、人、事其中一項</li><li>用白話書面語，不用網絡用語或粵語口語</li></ul>
      <details class="hint"><summary>需要提示？</summary><p>按一下句子框架，加入說明欄，再把「＿＿＿」改成你們的內容：</p>
        <div class="chips">${FRAMES_POST.map(f => `<button type="button" class="chip" data-frame="${esc(f)}">${esc(f)}</button>`).join('')}</div></details>
      <h3>標籤 <span class="muted small" id="tagCount"></span></h3>
      <p class="small">選三個標籤，其中一個要表達作者的心情。再按一下已選的標籤可以刪去。</p>
      <div class="chips selected" id="selTags"></div>
      ${TAG_BANK.map(b => `<div class="bank"><span class="bank-title">${b.title}</span><div class="chips">${b.tags.map(t => `<button type="button" class="chip" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div></div>`).join('')}
      <div class="custom-tag"><input id="customTag" maxlength="12" placeholder="自訂標籤（須扣緊課文主旨）"><button type="button" class="btn" id="addTag">加入</button></div>
      <button type="button" id="submitPost" class="btn primary big">發佈帖子</button>
      <div id="postStatus" class="status"></div>
      </section>
      <section class="preview"><h3>預覽</h3><div id="preview"></div></section></div>`;

    const cap = $('#caption');
    const paint = () => {
      const n = count(d.caption);
      const cc = $('#capCount');
      cc.textContent = `${n} / ${LIMIT_CAPTION} 字`;
      cc.classList.toggle('over', n > LIMIT_CAPTION);
      $('#tagCount').textContent = `（已選 ${d.tags.length} / ${MAX_TAGS}）`;
      $('#selTags').innerHTML = d.tags.length
        ? d.tags.map((t, i) => `<button type="button" class="chip on" data-rm="${i}">#${esc(t)} ✕</button>`).join('')
        : '<span class="muted">未選標籤</span>';
      $$('[data-rm]', body).forEach(b => { b.onclick = () => { d.tags.splice(Number(b.dataset.rm), 1); saveDraft(d); paint(); }; });
      $$('[data-tag]', body).forEach(b => b.classList.toggle('on', d.tags.includes(b.dataset.tag)));
      const pv = $('#preview');
      keepCarousels(pv, () => { pv.innerHTML = postCard({ sub: groupLabel(g), guest, caption: d.caption, tags: d.tags, images: groupImages(g), key: 'preview' }); });
    };
    const addTag = t => {
      const i = d.tags.indexOf(t);
      if (i >= 0) d.tags.splice(i, 1);
      else if (d.tags.length >= MAX_TAGS) { flash('最多選三個標籤，請先刪去一個。'); return; }
      else d.tags.push(t);
      saveDraft(d);
      paint();
    };

    cap.addEventListener('input', () => { d.caption = cap.value; saveDraft(d); paint(); });
    $$('[data-frame]', body).forEach(b => { b.onclick = () => insertAtCursor(cap, b.dataset.frame); });
    $$('[data-tag]', body).forEach(b => { b.onclick = () => addTag(b.dataset.tag); });
    $('#addTag').onclick = () => {
      const v = $('#customTag').value.replace(/[#＃\s]/g, '');
      if (!v) return;
      if (!d.tags.includes(v)) addTag(v);
      $('#customTag').value = '';
    };
    $('#submitPost').onclick = async () => {
      const n = count(d.caption);
      if (!n) return flash('請先寫帖子說明。');
      if (n > LIMIT_CAPTION) return flash(`帖子說明超過 ${LIMIT_CAPTION} 字，請刪減。`);
      if (d.caption.includes('＿')) return flash('句子框架的「＿＿＿」還未填寫。');
      if (!d.tags.length) return flash('請最少選一個標籤。');
      if (d.tags.length < MAX_TAGS && !confirm(`只選了 ${d.tags.length} 個標籤，確定發佈嗎？`)) return;
      await store().update({
        [`groups/g${g}/caption`]: d.caption.trim(),
        [`groups/g${g}/tags`]: d.tags.slice(),
        [`groups/g${g}/postAt`]: store().now(),
      });
      flash('帖子已發佈！', 'ok');
    };

    refresh = () => {
      const done = !!mine().postAt;
      $('#postStatus').innerHTML = done ? '✓ 已發佈。如要修改，改好後再按「更新帖子」。' : '未發佈';
      $('#postStatus').classList.toggle('ok', done);
      $('#submitPost').textContent = done ? '更新帖子' : '發佈帖子';
    };
    paint();
  }

  // ---------- 步驟 3：回覆留言 ----------
  function reply(body) {
    const cid = mine().commentId;
    const c = COMMENTS[cid];
    const chooseComment = () => {
      $$('[data-pickc]', body).forEach(b => {
        b.onclick = () => store().set(`groups/g${g}/commentId`, Number(b.dataset.pickc));
      });
    };
    if (!c) {
      // 訪客不參與抽籤，自行選擇一則留言回覆
      body.innerHTML = guest
        ? `<section class="panel wide"><h2>回覆留言</h2><p>請選擇一則留言回覆：</p>
            ${[1, 2, 3].map(k => `<button type="button" class="comment-pick" data-pickc="${k}"><b>@${esc(COMMENTS[k].handle)}</b>：${esc(COMMENTS[k].text)}</button>`).join('')}</section>`
        : '<div class="center-page"><h2>回覆留言</h2><p>等待老師抽籤分配留言……</p></div>';
      chooseComment();
      return;
    }
    const d = loadDraft();
    if (typeof d.reply !== 'string') d.reply = mine().reply || '';

    body.innerHTML = `<div class="two-col"><section class="panel">
      <h2>回覆留言</h2>
      <p>${guest ? `你選擇了第 ${cid} 則留言（<button type="button" class="linkbtn" id="changeComment">更換</button>）` : `你們抽到第 ${cid} 則留言`}：</p>
      <blockquote class="comment-box"><b>@${esc(c.handle)}</b>：${esc(c.text)}</blockquote>
      <label class="field-label" for="reply">以劉禹錫的身份回覆（${LIMIT_REPLY} 字內）</label>
      <textarea id="reply" rows="3" placeholder="回覆時保持風度，運用課文的意思">${esc(d.reply)}</textarea>
      <div class="counter" id="repCount"></div>
      <ul class="checklist"><li>不可以動氣，也不可以反罵對方</li><li>引用或化用最少一句課文</li><li>用白話書面語</li></ul>
      <details class="hint"><summary>需要提示？按一下課文句子，加入回覆欄</summary>
        <div class="chips">${QUOTES.map(q => `<button type="button" class="chip" data-q="${esc(q)}">「${esc(q)}」</button>`).join('')}</div></details>
      ${mine().postAt ? '' : '<p class="warn-text">提示：本組還未發佈帖子，請告訴老師。</p>'}
      <button type="button" id="submitReply" class="btn primary big">發佈回覆</button>
      <div id="replyStatus" class="status"></div>
      </section>
      <section class="preview"><h3>預覽</h3><div id="preview"></div></section></div>`;

    if (guest) $('#changeComment').onclick = () => store().set(`groups/g${g}/commentId`, null);
    const ta = $('#reply');
    const paint = () => {
      const n = count(d.reply);
      const rc = $('#repCount');
      rc.textContent = `${n} / ${LIMIT_REPLY} 字`;
      rc.classList.toggle('over', n > LIMIT_REPLY);
      const pv = $('#preview');
      keepCarousels(pv, () => { pv.innerHTML = postCard({ sub: groupLabel(g), guest, caption: mine().caption, tags: mine().tags, comment: c, reply: d.reply, images: groupImages(g), key: 'preview' }); });
    };
    ta.addEventListener('input', () => { d.reply = ta.value; saveDraft(d); paint(); });
    $$('[data-q]', body).forEach(b => { b.onclick = () => insertAtCursor(ta, `「${b.dataset.q}」`); });
    $('#submitReply').onclick = async () => {
      const n = count(d.reply);
      if (!n) return flash('請先寫回覆。');
      if (n > LIMIT_REPLY) return flash(`回覆超過 ${LIMIT_REPLY} 字，請刪減。`);
      await store().update({ [`groups/g${g}/reply`]: d.reply.trim(), [`groups/g${g}/replyAt`]: store().now() });
      flash('回覆已發佈！', 'ok');
    };

    refresh = () => {
      const done = !!mine().replyAt;
      $('#replyStatus').innerHTML = done ? '✓ 已回覆。如要修改，改好後再按「更新回覆」。' : '未回覆';
      $('#replyStatus').classList.toggle('ok', done);
      $('#submitReply').textContent = done ? '更新回覆' : '發佈回覆';
      paint();
    };
  }

  // ---------- 步驟 4：分享及點讚（組員輪流使用平板） ----------
  function like(body) {
    const t = loadTurn('like');
    const sel = new Set();
    body.innerHTML = `<section class="panel wide">
      <div id="turnBanner" class="turn"></div>
      <p class="criteria">投票準則：有風度・有課文根據・有創意。每人最多 ${LIKES_PER_MEMBER} 個讚，不可以投給自己的組。</p>
      <div id="feed" class="feed"></div>
      <div class="actions" id="likeActions">
        <button type="button" id="confirmLike" class="btn primary big">確認，交給下一位組員</button>
        <button type="button" id="doneLike" class="btn">本組全部組員已完成</button>
      </div></section>`;

    const paintBanner = () => {
      const banner = $('#turnBanner');
      $('#likeActions').hidden = t.done;
      if (t.done) {
        banner.innerHTML = `<h2>本組已完成點讚 ✓</h2><p>共 ${t.i - 1} 位組員點讚。請留意投影畫面。</p>
          <button type="button" class="btn" id="reopen">還有組員未投？繼續</button>`;
        $('#reopen').onclick = () => { t.done = false; saveTurn('like', t); paintBanner(); paintFeed(); };
        return;
      }
      banner.innerHTML = `<h2>第 ${t.i} 位組員</h2><p>請選出最多兩個你欣賞的帖子（已選 ${sel.size} / ${LIKES_PER_MEMBER}）。</p>`;
    };
    const paintFeed = () => {
      const feed = $('#feed');
      if (t.done) { feed.innerHTML = ''; return; }
      const ns = shownGroups(S());
      if (!ns.length) { feed.innerHTML = '<p class="muted">等待老師把帖子投影……</p>'; return; }
      keepCarousels(feed, () => {
        feed.innerHTML = ns.map(n => {
          const own = n === g;
          const on = sel.has(n);
          const btn = own
            ? '<span class="own-tag">本組帖子</span>'
            : isGuest(n)
              ? '<span class="own-tag">訪客帖子（不設點讚）</span>'
              : `<button type="button" class="heart-btn ${on ? 'on' : ''}" data-like="${n}" aria-pressed="${on}">${on ? '♥ 已讚' : '♡ 點讚'}</button>`;
          return groupPostCard(S(), n, { likeBtn: btn, extraClass: own ? 'own' : '' });
        }).join('');
      });
      $$('[data-like]', feed).forEach(b => {
        b.onclick = () => {
          const n = Number(b.dataset.like);
          if (sel.has(n)) sel.delete(n);
          else if (sel.size >= LIKES_PER_MEMBER) { flash(`每人最多 ${LIKES_PER_MEMBER} 個讚。`); return; }
          else sel.add(n);
          paintBanner();
          paintFeed();
        };
      });
    };

    $('#confirmLike').onclick = async () => {
      if (!sel.size && !confirm('你還未點讚，確定交給下一位組員嗎？')) return;
      const upd = {};
      sel.forEach(n => { upd[`likes/g${n}/g${g}m${t.i}`] = true; });
      if (Object.keys(upd).length) await store().update(upd);
      sel.clear();
      t.i += 1;
      saveTurn('like', t);
      flash('已記錄！請把平板交給下一位組員。', 'ok');
      paintBanner();
      paintFeed();
      window.scrollTo(0, 0);
    };
    $('#doneLike').onclick = () => {
      if (sel.size) { flash('請先按「確認」，記錄這位組員的讚。'); return; }
      t.done = true;
      saveTurn('like', t);
      paintBanner();
      paintFeed();
    };

    refresh = paintFeed;
    paintBanner();
  }

  // ---------- 步驟 5：兩難投票（組員輪流，匿名） ----------
  function poll(body) {
    const t = loadTurn('poll');
    let recorded = false;
    body.innerHTML = `<section class="panel wide center"><blockquote class="dilemma">${esc(DILEMMA)}</blockquote><div id="pollArea"></div></section>`;

    const paint = () => {
      const a = $('#pollArea');
      if (t.done) {
        a.innerHTML = `<h2>本組已完成投票 ✓</h2><p>共 ${t.i - 1} 位組員投票。請留意投影畫面。</p>
          <button type="button" class="btn" id="reopen">還有組員未投？繼續</button>`;
        $('#reopen').onclick = () => { t.done = false; saveTurn('poll', t); paint(); };
        return;
      }
      if (recorded) {
        a.innerHTML = `<h2>已記錄 ✓</h2><p>你的選擇不會顯示在這部平板上。請把平板交給下一位組員。</p>
          <div class="actions"><button type="button" class="btn primary big" id="next">下一位組員</button>
          <button type="button" class="btn" id="done">本組全部組員已完成</button></div>`;
        $('#next').onclick = () => { recorded = false; paint(); };
        $('#done').onclick = () => { recorded = false; t.done = true; saveTurn('poll', t); paint(); };
        return;
      }
      a.innerHTML = `<h2>第 ${t.i} 位組員</h2><p>請誠實選擇，答案沒有對錯。</p>
        <div class="poll-btns">${POLL_ORDER.map(k => `<button type="button" class="btn poll ${k}" data-v="${k}">${POLL[k].label}</button>`).join('')}</div>`;
      $$('[data-v]', a).forEach(b => {
        b.onclick = async () => {
          await store().set(`poll/g${g}m${t.i}`, b.dataset.v);
          t.i += 1;
          saveTurn('poll', t);
          recorded = true;
          paint();
        };
      });
    };
    paint();
  }

  // ---------- 訪客：步驟 4 點讚（存於 guestLikes，不計入讚數） ----------
  function guestLike(body) {
    const t = loadTurn('like');
    const sel = new Set(Object.keys(S().guestLikes || {}).map(k => Number(k.slice(1))).filter(Boolean));
    body.innerHTML = `<section class="panel wide">
      <div id="turnBanner" class="turn"></div>
      <p class="criteria">投票準則：有風度・有課文根據・有創意。最多 ${LIKES_PER_MEMBER} 個讚。訪客的讚不會計入讚數。</p>
      <div id="feed" class="feed"></div>
      <div class="actions" id="likeActions"><button type="button" id="confirmLike" class="btn primary big">確認</button></div></section>`;

    const paintBanner = () => {
      $('#likeActions').hidden = t.done;
      const banner = $('#turnBanner');
      if (t.done) {
        banner.innerHTML = `<h2>已記錄 ✓</h2><p>你讚了 ${sel.size} 個帖子（不計入讚數）。請留意投影畫面。</p>
          <button type="button" class="btn" id="reopen">修改</button>`;
        $('#reopen').onclick = () => { t.done = false; saveTurn('like', t); paintBanner(); paintFeed(); };
        return;
      }
      banner.innerHTML = `<h2>訪客點讚</h2><p>請選出最多兩個你欣賞的帖子（已選 ${sel.size} / ${LIKES_PER_MEMBER}）。</p>`;
    };
    const paintFeed = () => {
      const feed = $('#feed');
      if (t.done) { feed.innerHTML = ''; return; }
      const ns = shownGroups(S());
      if (!ns.length) { feed.innerHTML = '<p class="muted">等待老師把帖子投影……</p>'; return; }
      keepCarousels(feed, () => {
        feed.innerHTML = ns.map(n => {
          const own = n === g;
          const on = sel.has(n);
          const btn = own
            ? '<span class="own-tag">你的帖子</span>'
            : `<button type="button" class="heart-btn ${on ? 'on' : ''}" data-like="${n}" aria-pressed="${on}">${on ? '♥ 已讚' : '♡ 點讚'}</button>`;
          return groupPostCard(S(), n, { likeBtn: btn, extraClass: own ? 'own' : '' });
        }).join('');
      });
      $$('[data-like]', feed).forEach(b => {
        b.onclick = () => {
          const n = Number(b.dataset.like);
          if (sel.has(n)) sel.delete(n);
          else if (sel.size >= LIKES_PER_MEMBER) { flash(`最多 ${LIKES_PER_MEMBER} 個讚。`); return; }
          else sel.add(n);
          paintBanner();
          paintFeed();
        };
      });
    };

    $('#confirmLike').onclick = async () => {
      const obj = {};
      sel.forEach(n => { obj[`g${n}`] = true; });
      await store().set('guestLikes', Object.keys(obj).length ? obj : null);
      t.done = true;
      saveTurn('like', t);
      flash('已記錄！', 'ok');
      paintBanner();
      paintFeed();
      window.scrollTo(0, 0);
    };

    refresh = paintFeed;
    paintBanner();
  }

  // ---------- 訪客：步驟 5 兩難投票（存於 guestPoll，不計入結果） ----------
  function guestPoll(body) {
    let redo = false;
    body.innerHTML = `<section class="panel wide center"><blockquote class="dilemma">${esc(DILEMMA)}</blockquote><div id="pollArea"></div></section>`;
    const paint = () => {
      const a = $('#pollArea');
      const v = S().guestPoll;
      if (v && POLL[v] && !redo) {
        a.innerHTML = `<h2>已記錄 ✓</h2><p>你選擇了「${POLL[v].label}」。訪客投票不會計入結果。</p>
          <button type="button" class="btn" id="redo">重新選擇</button>`;
        $('#redo').onclick = () => { redo = true; paint(); };
        return;
      }
      a.innerHTML = `<h2>訪客投票</h2><p>答案沒有對錯。你的投票不會計入結果。</p>
        <div class="poll-btns">${POLL_ORDER.map(k => `<button type="button" class="btn poll ${k}" data-v="${k}">${POLL[k].label}</button>`).join('')}</div>`;
      $$('[data-v]', a).forEach(b => {
        b.onclick = async () => { await store().set('guestPoll', b.dataset.v); redo = false; paint(); };
      });
    };
    refresh = paint;
    paint();
  }

  // ---------- 完成 ----------
  function end(body) {
    body.innerHTML = `<div class="center-page"><h2>活動完成，謝謝各位小編！</h2>
      <p class="big-quote">斯是陋室，惟吾德馨。</p><p class="muted">請把平板交還老師。</p></div>`;
  }

  return { update };
}
