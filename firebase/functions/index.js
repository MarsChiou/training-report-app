
const functions = require("firebase-functions");
const fetch = require("node-fetch");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}


// ✅ 抽出 Google Apps Script URL 作為常數（請記得把這裡改成你的實際 Script ID）Apr10
const GAS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzcf0YKfJksPgxBbNT-5ElE11Rz13H5D1hsm5dT1k0W8WptQ62HpbYLlqf54ImkNlefKw/exec";

const db = admin.firestore();
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const GAS_MOVEMENT_LIB_URL = `${GAS_SCRIPT_URL}?action=movementLib`;


// 建立一個 HTTPS Cloud Function 作為代理
exports.proxyToGAS = functions.https.onRequest(async (req, res) => {
  // === Step 1: 加上 CORS Headers ===
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  // === Step 2: 處理預檢請求（OPTIONS）===
  if (req.method === "OPTIONS") {
    return res.status(204).send(""); // 預檢請求成功
  }
  // 僅允許 POST 請求，其他一律拒絕
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    // 轉送請求到 GAS
    const response = await fetch(GAS_SCRIPT_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(req.body),
    });

    // 讀取 GAS 回傳的內容
    const result = await response.text();

    // 成功轉送後回傳原封不動的訊息
    return res.status(200).send(result);
  } catch (err) {
    // 如果中途失敗，記錄錯誤並回傳錯誤訊息
    console.error("轉送失敗", err);
    return res.status(500).send("發生錯誤：" + err.message);
  }
});

// 動作圖庫功能
exports.proxyMovementLibWithCache = functions
    .https
    .onRequest(async (req, res) =>{
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      try {
        const cacheDocRef = db.collection("cache").doc("movementLib");
        const cacheDoc = await cacheDocRef.get();
        const now = Date.now();

        if (cacheDoc.exists) {
          const {lastUpdate, data} = cacheDoc.data();
          if (now - new Date(lastUpdate).getTime() < CACHE_TTL) {
            res.status(200).json(data);
            return;
          }
        }

        const response = await fetch(GAS_MOVEMENT_LIB_URL);
        const freshData = await response.json();

        await cacheDocRef.set({
          lastUpdate: new Date().toISOString(),
          data: freshData,
        });

        res.status(200).json(freshData);
      } catch (error) {
        console.error("Error in proxyMovementLibWithCache:", error);
        res.status(500).send("Server error");
      }
    });
