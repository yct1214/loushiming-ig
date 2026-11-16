// 匯出活動成果（教師控制台使用）
//   成果報告（.html）：可直接閱讀、列印或另存為 PDF
//   Excel 表格（.csv）：可用 Excel 開啟，方便整理及評分
//   完整備份（.json）：保存全部原始資料
import {
  esc, toArr, gd, likeCount, pollCounts, participants, groupLabel, isGuest, guestJoined,
  COMMENTS, POLL, POLL_ORDER, STAGES,
} from './ui.js';

const pad = n => String(n).padStart(2, '0');
const fmtTime = ts => {
  if (!ts) return '';
  const d = new Date(Number(ts));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};

// 整理每組（及訪客）的成果
function collect(s) {
  const pc = pollCounts(s);
  const total = POLL_ORDER.reduce((a, k) => a + pc[k], 0);
  const rows = participants(s).map(n => {
    const d = gd(s, n);
    const c = COMMENTS[d.commentId];
    return {
      label: groupLabel(n),
      guest: isGuest(n),
      caption: d.caption || '',
      tags: toArr(d.tags),
      comment: c ? `第 ${d.commentId} 則（@${c.handle}）：${c.text}` : '',
      reply: d.reply || '',
      likes: isGuest(n) ? null : likeCount(s, n),
      postAt: fmtTime(d.postAt),
      replyAt: fmtTime(d.replyAt),
    };
  });
  const guest = guestJoined(s) ? {
    poll: s.guestPoll && POLL[s.guestPoll] ? POLL[s.guestPoll].label : '未投票',
    likes: Object.keys(s.guestLikes || {}).map(k => groupLabel(k.slice(1))),
  } : null;
  return { rows, pc, total, guest, exportedAt: fmtTime(Date.now()) };
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Excel 表格 ----------
// 學生輸入的文字以 = + - @ 開頭時加上單引號，避免 Excel 當作公式執行
const cell = v => {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
};
const line = arr => arr.map(cell).join(',');

export function exportCSV(s) {
  const r = collect(s);
  const out = [
    line(['《陋室銘》劉禹錫開 IG 活動成果', `匯出時間：${r.exportedAt}`]),
    '',
    line(['組別', '帖子說明', '標籤', '回覆的留言', '回覆', '讚數', '帖子發佈時間', '回覆發佈時間']),
    ...r.rows.map(x => line([
      x.label, x.caption, x.tags.map(t => `#${t}`).join(' '), x.comment, x.reply,
      x.guest ? '不計算' : x.likes, x.postAt, x.replyAt,
    ])),
    '',
    line(['兩難投票', '人數', '百分比']),
    ...POLL_ORDER.map(k => line([POLL[k].label, r.pc[k], r.total ? `${Math.round((r.pc[k] / r.total) * 100)}%` : '0%'])),
    line(['合計', r.total, '']),
  ];
  if (r.guest) {
    out.push('', line(['訪客（不計算）', '兩難投票', '點讚對象']), line(['訪客', r.guest.poll, r.guest.likes.join('、') || '未點讚']));
  }
  // 開頭加上 BOM，Excel 才能正確顯示中文
  download(`劉禹錫開IG_成果_${stamp()}.csv`, '\uFEFF' + out.join('\r\n'), 'text/csv;charset=utf-8');
}

// ---------- 完整備份 ----------
export function exportJSON(s) {
  const data = { activity: '《陋室銘》劉禹錫開 IG', exportedAt: new Date().toISOString(), data: s };
  download(`劉禹錫開IG_備份_${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}

// ---------- 成果報告 ----------
export function exportReport(s) {
  const r = collect(s);
  const stage = (STAGES.find(x => x.id === s.stage) || STAGES[0]);
  const posts = r.rows.map(x => `
    <section class="card ${x.guest ? 'guest' : ''}">
      <h2>${esc(x.label)}${x.guest ? ' <span class="tag-guest">讚和投票不計算</span>' : ''}${x.likes !== null ? `<span class="likes">♥ ${x.likes} 個讚</span>` : ''}</h2>
      <p><b>帖子說明：</b>${x.caption ? esc(x.caption) : '<span class="muted">未發佈</span>'}</p>
      <p><b>標籤：</b>${x.tags.length ? x.tags.map(t => `<span class="hash">#${esc(t)}</span>`).join(' ') : '<span class="muted">—</span>'}</p>
      <p><b>回覆的留言：</b>${x.comment ? esc(x.comment) : '<span class="muted">—</span>'}</p>
      <p><b>回覆：</b>${x.reply ? esc(x.reply) : '<span class="muted">未回覆</span>'}</p>
      <p class="time">${x.postAt ? `帖子發佈：${esc(x.postAt)}` : ''}${x.replyAt ? `　回覆發佈：${esc(x.replyAt)}` : ''}</p>
    </section>`).join('');
  const bars = POLL_ORDER.map(k => {
    const pct = r.total ? Math.round((r.pc[k] / r.total) * 100) : 0;
    return `<tr><th>${POLL[k].label}</th><td><div class="bar ${k}" style="width:${pct}%"></div></td><td>${r.pc[k]} 人（${pct}%）</td></tr>`;
  }).join('');

  const html = `<!doctype html>
<html lang="zh-Hant-HK"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>劉禹錫開 IG 活動成果 ${esc(r.exportedAt)}</title>
<style>
  body { font-family: "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif; color: #262626; max-width: 900px; margin: 24px auto; padding: 0 16px; line-height: 1.7; }
  h1 { margin-bottom: 0; } .meta { color: #777; margin-top: 4px; }
  .card { border: 1px solid #ddd; border-radius: 10px; padding: 8px 18px; margin: 14px 0; break-inside: avoid; }
  .card.guest { border-style: dashed; border-color: #b9a6ea; background: #faf8fe; }
  .card h2 { font-size: 1.15em; display: flex; gap: 10px; align-items: center; }
  .card p { margin: 4px 0; }
  .likes { margin-left: auto; color: #ed4956; font-size: .9em; }
  .tag-guest { font-size: .7em; font-weight: 700; background: #6b4fbb; color: #fff; border-radius: 999px; padding: 0 8px; }
  .hash { color: #00376b; } .muted { color: #999; } .time { color: #888; font-size: .85em; }
  table.poll { width: 100%; border-collapse: collapse; } table.poll th { width: 5em; text-align: right; padding: 6px 10px; }
  table.poll td { padding: 6px 4px; } table.poll td:nth-child(2) { width: 60%; background: #f2f2f2; border-radius: 999px; }
  .bar { height: 22px; border-radius: 999px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bar.del { background: #ed4956; } .bar.keep { background: #2e9e5b; } .bar.depends { background: #e0a100; }
  .print { position: fixed; top: 16px; right: 16px; padding: 8px 16px; font: inherit; border-radius: 8px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
  @media print { .print { display: none; } body { margin: 0; } }
</style></head><body>
<button class="print" onclick="window.print()">列印／另存為 PDF</button>
<h1>《陋室銘》劉禹錫開 IG 活動成果</h1>
<p class="meta">匯出時間：${esc(r.exportedAt)}｜組數：${esc(String(r.rows.filter(x => !x.guest).length))}｜匯出時的階段：${esc(stage.step)} ${esc(stage.label)}</p>
<h2>各組帖子及回覆</h2>
${posts}
<h2>兩難投票</h2>
<p>你在 IG 上載了一幅自己很滿意的畫，只得三個讚，同學的新球鞋相片有八十個讚。你會刪掉自己的帖子嗎？</p>
<table class="poll"><tbody>${bars}</tbody></table>
<p>合計：${r.total} 人</p>
${r.guest ? `<h2>訪客（不計算）</h2><p>兩難投票：${esc(r.guest.poll)}｜點讚對象：${esc(r.guest.likes.join('、') || '未點讚')}</p>` : ''}
</body></html>`;
  download(`劉禹錫開IG_成果報告_${stamp()}.html`, html, 'text/html;charset=utf-8');
}
