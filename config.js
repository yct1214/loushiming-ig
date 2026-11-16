// 《陋室銘》劉禹錫開 IG：設定檔
//
// 1. 未填 Firebase 設定時（firebaseConfig = null），網站以「本機測試模式」運行：
//    只能在同一部電腦、同一個瀏覽器的不同分頁之間同步，適合課前自己試用。
// 2. 課堂使用前，請按《使用說明.md》第二部分建立 Firebase 專案，
//    再把 Firebase 提供的設定貼在下面，取代 null。例如：
//
// export const firebaseConfig = {
//   apiKey: "……",
//   authDomain: "loushiming-ig.firebaseapp.com",
//   databaseURL: "https://loushiming-ig-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "loushiming-ig",
//   storageBucket: "loushiming-ig.appspot.com",
//   messagingSenderId: "……",
//   appId: "……"
// };

export const firebaseConfig = {
  apiKey: "AIzaSyDxvsrgmas1sqGFVvSPjcS5XX4GnFq4xck",
  authDomain: "loushiming-ig.firebaseapp.com",
  databaseURL: "https://loushiming-ig-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "loushiming-ig",
  storageBucket: "loushiming-ig.firebasestorage.app",
  messagingSenderId: "382358373940",
  appId: "1:382358373940:web:eb5d8a6f7637bbdbab2c61"
};

// 教師控制台密碼。只用來防止學生隨意打開控制台，並非真正的保安措施。
export const TEACHER_PIN = "teachingdemo";
