// 教師控制台
import {
  ctx, $, $$, esc, toArr, groupCount, gd, likeCount, range, pollCounts, rid, flash, tickTimers,
  STAGES, POLL, POLL_ORDER, isGuest, groupLabel, participants, guestJoined,
} from './ui.js';
import { exportReport, exportCSV, exportJSON } from './export.js';

const PROMPTS = [
  ['提問一【探討型｜4.3 伸展】（留言 2 的兩組分享後）', '留言說劉禹錫在「扮開心」。你同意嗎？試從課文找證據。'],
  ['提問二【激疑型｜5.1 評鑑】（點讚後）', '剛才我們用讚數選出最佳帖子。讚數最少的帖子，是不是就寫得不好？（不點名讚數最少的組）'],
  ['提問三【假設型｜6.2 創意】（兩難投票）', '如果劉禹錫的陋室帖子只得三個讚，他會刪嗎？為甚麼？'],
];

export function initTeacher(pin) {
  document.body.classList.add('teacher-view');
  const app = $('#app');
  const store = () => ctx.store;
  const S = () => ctx.state;
  const unlocked = () => sessionStorage.getItem('ig-pin-ok') === '1';
  let pending = false;

  const editing = () => {
    const a = document.activeElement;
    return !!a && app.contains(a) && (a.tagName === 'SELECT' || a.tagName === 'INPUT');
  };
  app.addEventListener('focusout', () => setTimeout(() => {
    if (pending && !editing()) { pending = false; render(); }
  }, 0));

  function update() {
    if (!unlocked()) { renderPin(); return; }
    if (editing()) { pending = true; return; }
    render();
  }

  function renderPin() {
    if ($('#pinForm')) return;
    app.innerHTML = `<div class="center-page"><h1>教師控制台</h1>
      <form id="pinForm" class="row"><input id="pin" type="password" inputmode="numeric" placeholder="請輸入密碼" autocomplete="off">
      <button class="btn primary">進入</button></form></div>`;
    $('#pinForm').onsubmit = e => {
      e.preventDefault();
      if ($('#pin').value === pin) { sessionStorage.setItem('ig-pin-ok', '1'); app.innerHTML = ''; render(); }
      else flash('密碼不正確。');
    };
  }

  const modeText = () => (store().mode === 'cloud'
    ? '雲端模式（Firebase）'
    : '本機測試模式：只能在同一部電腦、同一個瀏覽器的分頁之間同步');
  const fresh = n => ({ session: rid(), stage: 'intro', groupCount: n, showPoll: false });

  function render() {
    const s = S();
    if (!s.session) {
      app.innerHTML = `<div class="center-page"><h1>教師控制台</h1><p>${modeText()}</p>
        <button type="button" class="btn primary big" id="init">開啟新一節活動</button></div>`;
      $('#init').onclick = () => store().replace(fresh(6));
      return;
    }
    const N = groupCount(s);
    const stage = s.stage || 'intro';
    const focus = Number(s.focus) || 0;
    const showStage = ['post', 'reply', 'like'].includes(stage);
    const base = `${location.origin}${location.pathname}`;
    const pc = pollCounts(s);
    const pTotal = POLL_ORDER.reduce((a, k) => a + pc[k], 0);

    const rows = participants(s).map(n => {
      const d = gd(s, n);
      return `<tr class="${focus === n ? 'focus' : ''} ${isGuest(n) ? 'guest-row' : ''}">
        <td><b>${isGuest(n) ? '<span class="guest-badge">訪客</span>' : n}</b></td>
        <td>${d.postAt ? `<div>${esc(d.caption)}</div><div class="tags">${toArr(d.tags).map(t => `<span>#${esc(t)}</span>`).join(' ')}</div>` : '<span class="muted">未發佈</span>'}</td>
        <td><select data-cid="${n}" aria-label="${groupLabel(n)}的留言"><option value="0">—</option>${[1, 2, 3].map(c => `<option value="${c}" ${Number(d.commentId) === c ? 'selected' : ''}>第 ${c} 則</option>`).join('')}</select></td>
        <td>${d.replyAt ? esc(d.reply) : '<span class="muted">未回覆</span>'}</td>
        <td class="num">${isGuest(n) ? '<span class="muted" title="訪客帖子不設點讚">—</span>' : likeCount(s, n)}</td>
        <td><button type="button" class="btn small ${d.shown ? 'primary' : ''}" data-show="${n}" ${d.postAt ? '' : 'disabled'}>${d.shown ? '已投影' : '投影'}</button></td>
        <td><button type="button" class="btn small ${focus === n ? 'primary' : ''}" data-focus="${n}" ${d.postAt && d.shown && showStage ? '' : 'disabled'} title="${showStage ? (d.shown ? '在投影畫面放大展示這組帖子' : '請先按「投影」') : '步驟 2 至 4 才可展示'}">${focus === n ? '展示中' : '展示'}</button></td>
      </tr>`;
    }).join('');

    app.innerHTML = `<header class="topbar"><span class="brand">教師控制台</span><span class="mode">${modeText()}</span>
      <span class="spacer"></span><span class="timer" data-timer hidden></span></header>
      <main class="body teacher">
        <section class="panel"><h2>活動階段</h2>
          <div class="stage-btns">${STAGES.map(st => `<button type="button" class="btn ${st.id === stage ? 'primary' : ''}" data-stage="${st.id}">${st.step}<br>${st.label}</button>`).join('')}</div>
          <p class="small muted">切換階段時，計時器和展示會自動清除。</p></section>

        <section class="panel"><h2>計時器</h2><div class="row">
          ${[1, 3, 4].map(m => `<button type="button" class="btn" data-min="${m}">${m} 分鐘</button>`).join('')}
          <button type="button" class="btn" id="plus30">+30 秒</button><button type="button" class="btn" id="stopTimer">停止</button></div></section>

        <section class="panel"><h2>各組情況</h2>
          <div class="row"><button type="button" class="btn" id="draw">抽籤分配留言</button>
            <button type="button" class="btn" id="showAll">全部已發佈帖子投影</button>
            <button type="button" class="btn" id="unfocus" ${focus ? '' : 'disabled'}>取消展示</button>
            <label>組數 <select id="gc">${[3, 4, 5, 6, 7, 8].map(k => `<option ${k === N ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
          <div class="table-wrap"><table class="gtable"><thead><tr><th>組</th><th>帖子</th><th>留言</th><th>回覆</th><th>讚</th><th>投影</th><th>展示</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
          <p class="small muted">帖子要按「投影」才會在投影畫面和各組平板出現。按「投影」後，可按「展示」把該組帖子在投影畫面放大，方便朗讀員讀出；也可以直接在投影畫面點選組別名稱或帖子。步驟 2 至 4 都可以展示。</p></section>

        <section class="panel"><h2>兩難投票</h2>
          <p>已投票 ${pTotal} 人：${POLL_ORDER.map(k => `${POLL[k].label} ${pc[k]}`).join('｜')}</p>
          ${guestJoined(s) ? `<p class="small muted">訪客投票（不計算）：${s.guestPoll && POLL[s.guestPoll] ? POLL[s.guestPoll].label : '未投票'}｜訪客點讚（不計算）：${Object.keys(s.guestLikes || {}).map(k => groupLabel(k.slice(1))).join('、') || '未點讚'}</p>` : ''}
          <button type="button" class="btn ${s.showPoll ? 'primary' : ''}" id="togglePoll">${s.showPoll ? '隱藏投影結果' : '在投影畫面顯示結果'}</button></section>

        <details class="panel"><summary><b>提問提示</b></summary>
          ${PROMPTS.map(([h, q]) => `<p><b>${h}</b><br>${q}</p>`).join('')}
          <p><b>教師總結（盡量引用學生剛才說過的話）</b><br>劉禹錫被貶到和州，很多人會覺得他失敗了。他沒有跟別人比官邸，而是在小屋裏做自己喜歡的事，還自比諸葛亮，等待機會。這就是「淡泊」：不讓別人的比較決定自己的價值，但也沒有放棄自己。</p></details>

        <section class="panel"><h2>連結</h2>
          <p>投影畫面：<a href="${base}?role=screen" target="_blank" rel="noopener">${esc(base)}?role=screen</a></p>
          <p>小組平板：<code>${esc(base)}</code>（投影畫面的「準備」階段會顯示二維碼）</p>
          <p>訪客平板：<code>${esc(base)}?role=guest</code>（${guestJoined(s) ? '<b>訪客已加入</b>' : '訪客未加入'}。帖子標示「訪客」，同學不能為訪客帖子點讚；訪客的讚和投票不計算。訪客不參與抽籤，自行選擇回覆哪則留言。）</p></section>

        <section class="panel"><h2>匯出活動成果</h2>
          <p class="small muted">已發佈帖子 ${participants(s).filter(n => gd(s, n).postAt).length} 個、回覆 ${participants(s).filter(n => gd(s, n).replyAt).length} 個、投票 ${pTotal} 人。檔案會下載到這部裝置。</p>
          <div class="row">
            <button type="button" class="btn primary" id="exportReport">成果報告（可列印／另存 PDF）</button>
            <button type="button" class="btn" id="exportCSV">Excel 表格（.csv）</button>
            <button type="button" class="btn" id="exportJSON">完整備份（.json）</button></div>
          <p class="small muted">成果報告列出各組帖子、標籤、回覆、讚數及投票結果，方便教學反思或交評課人員參考。Excel 表格方便整理及評分。完整備份保存全部原始資料。訪客的讚和投票會另列，並註明不計算。</p></section>

        <section class="panel danger-zone"><h2>清除及重設</h2><div class="row">
          <button type="button" class="btn" id="clearLikes">清除所有讚</button>
          <button type="button" class="btn" id="clearPoll">清除投票</button>
          <button type="button" class="btn danger" id="reset">重設全部資料</button></div>
          <p class="small muted">重設後，所有帖子、回覆、讚和投票都會刪除，各組平板會回到「等待開始」。<b>如要保留成果，請先在上方匯出。</b></p></section>
      </main>`;

    bind(s, N);
    tickTimers();
  }

  function bind(s, N) {
    $$('[data-stage]', app).forEach(b => {
      b.onclick = () => store().update({ stage: b.dataset.stage, timer: null, focus: null });
    });
    $$('[data-min]', app).forEach(b => {
      b.onclick = () => store().set('timer', { end: store().now() + Number(b.dataset.min) * 60000 });
    });
    $('#plus30').onclick = () => {
      const end = Math.max(store().now(), (S().timer && S().timer.end) || 0) + 30000;
      store().set('timer', { end });
    };
    $('#stopTimer').onclick = () => store().set('timer', null);

    $('#draw').onclick = () => {
      if (range(N).some(n => gd(S(), n).commentId) && !confirm('已有組別分配了留言，確定重新抽籤嗎？')) return;
      const pool = [];
      while (pool.length < N) pool.push(1, 2, 3);
      pool.length = N;
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const upd = {};
      range(N).forEach((n, i) => { upd[`groups/g${n}/commentId`] = pool[i]; });
      store().update(upd);
    };
    $$('[data-cid]', app).forEach(sel => {
      sel.onchange = () => { const v = Number(sel.value); store().set(`groups/g${sel.dataset.cid}/commentId`, v || null); sel.blur(); };
    });
    $('#gc').onchange = e => { store().set('groupCount', Number(e.target.value)); e.target.blur(); };

    $$('[data-show]', app).forEach(b => {
      b.onclick = () => {
        const n = b.dataset.show;
        const shown = !gd(S(), n).shown;
        const upd = { [`groups/g${n}/shown`]: shown };
        if (!shown && Number(S().focus) === Number(n)) upd.focus = null;
        store().update(upd);
      };
    });
    $('#showAll').onclick = () => {
      const upd = {};
      participants(S()).forEach(n => { if (gd(S(), n).postAt) upd[`groups/g${n}/shown`] = true; });
      if (Object.keys(upd).length) store().update(upd); else flash('還沒有組別發佈帖子。');
    };
    $$('[data-focus]', app).forEach(b => {
      b.onclick = () => {
        const n = Number(b.dataset.focus);
        if (Number(S().focus) === n) store().set('focus', null);
        else if (gd(S(), n).shown) store().set('focus', n);
      };
    });
    $('#unfocus').onclick = () => store().set('focus', null);
    $('#togglePoll').onclick = () => store().set('showPoll', !S().showPoll);

    $('#clearLikes').onclick = () => { if (confirm('確定清除所有讚嗎？')) store().update({ likes: null, guestLikes: null }); };
    $('#clearPoll').onclick = () => { if (confirm('確定清除所有投票嗎？')) store().update({ poll: null, guestPoll: null }); };
    $('#exportReport').onclick = () => { exportReport(S()); flash('已下載成果報告。', 'ok'); };
    $('#exportCSV').onclick = () => { exportCSV(S()); flash('已下載 Excel 表格。', 'ok'); };
    $('#exportJSON').onclick = () => { exportJSON(S()); flash('已下載完整備份。', 'ok'); };

    $('#reset').onclick = () => {
      const hasWork = participants(S()).some(n => gd(S(), n).postAt) || Object.keys(S().poll || {}).length;
      const msg = hasWork
        ? '確定重設全部資料嗎？所有帖子、回覆、讚和投票都會刪除。\n\n如要保留成果，請按「取消」，先在「匯出活動成果」下載。'
        : '確定重設全部資料嗎？';
      if (confirm(msg)) store().replace(fresh(N));
    };
  }

  return { update };
}
