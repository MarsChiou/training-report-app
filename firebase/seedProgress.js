const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = require("./serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const userId = "kiki"; // 替換為你要建立的隊員 ID

// 動作 + 分類
const motions = [
  { id: "1/肩胛骨中立術", category: "肩胛骨" },
  { id: "2/肩胛骨穩定術", category: "肩胛骨" },
  { id: "3/肩胛核心大法", category: "肩胛骨" },
  { id: "4/胸椎不卡卡術", category: "胸椎" },
  { id: "5/轉胸不轉頭", category: "胸椎" },
  { id: "6/弓步+胸椎旋轉", category: "胸椎" },
  { id: "7/骨盆中立術", category: "骨盆" },
  { id: "8/骨盆端正術", category: "骨盆" },
  { id: "9/穩定骨盆大法", category: "骨盆" },
  { id: "10/好好呼吸術", category: "呼吸" },
  { id: "11/伸展舒壓術", category: "呼吸" },
  { id: "12/下午提神大法", category: "呼吸" },
  { id: "13/練成直角肩", category: "肩胛骨" },
  { id: "14/肩膀強壯術", category: "肩胛骨" },
  { id: "15/豐胸訓練大法（強化前鋸肌）", category: "肩胛骨" },
  { id: "16/頸椎保養術", category: "胸椎" },
  { id: "17/天鵝頸訓練大法", category: "胸椎" },
  { id: "18/滑手機省力術", category: "胸椎" },
  { id: "19/骨盆穩定術", category: "骨盆" },
  { id: "20/翹臀訓練大法", category: "骨盆" },
  { id: "21/弓步蹲", category: "骨盆" },
  { id: "22/開心開工大法", category: "呼吸" },
  { id: "23/脊椎不卡卡術", category: "呼吸" },
  { id: "24/能屈能伸大法", category: "呼吸" },
];

(async () => {
  for (const motion of motions) {
    await db.collection("progress").add({
      userId: userId,
      category: motion.category,
      motionId: motion.id,
      level: "Lv1"
    });
  }
})();
