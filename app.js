// 《陋室銘》劉禹錫開 IG：程式入口
//   ?role=teacher  教師控制台
//   ?role=screen   投影畫面
//   ?role=group    小組平板（預設）
//   ?role=guest    訪客平板（帖子標示「訪客」，讚和投票不計算）
import { firebaseConfig, TEACHER_PIN } from './config.js';
import { createStore } from './store.js';
import { ctx, $, tickTimers, initCarousels } from './ui.js';
import { initGroup } from './group.js';
import { initScreen } from './screen.js';
import { initTeacher } from './teacher.js';

function fatal(msg) {
  $('#app').innerHTML = `<div class="center-page"><h1>無法開啟</h1><p></p></div>`;
  $('#app p').textContent = msg;
}

async function main() {
  try {
    ctx.store = await createStore(firebaseConfig, fatal);
  } catch (err) {
    fatal('無法連接資料庫，請檢查網絡或 config.js 的 Firebase 設定。（' + err.message + '）');
    return;
  }

  initCarousels();
  const role = new URLSearchParams(location.search).get('role') || 'group';
  const view = role === 'teacher' ? initTeacher(TEACHER_PIN)
    : role === 'screen' ? initScreen()
    : role === 'guest' ? initGroup({ guest: true })
    : initGroup();

  // 連線中斷超過兩秒才顯示提示，避免開頁時閃動
  let connTimer;
  ctx.store.onConnection(ok => {
    clearTimeout(connTimer);
    if (ok) $('#conn').hidden = true;
    else connTimer = setTimeout(() => { $('#conn').hidden = false; }, 2000);
  });

  ctx.store.subscribe(s => {
    ctx.state = s || {};
    view.update();
  });

  setInterval(tickTimers, 250);
}

main();
