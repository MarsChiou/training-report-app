/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// 這個是原本的 onRequest
// const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });


const functions = require("firebase-functions");
const fetch = require("node-fetch");

// ✅ 抽出 Google Apps Script URL 作為常數（請記得把這裡改成你的實際 Script ID）Apr10
const GAS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzcf0YKfJksPgxBbNT-5ElE11Rz13H5D1hsm5dT1k0W8WptQ62HpbYLlqf54ImkNlefKw/exec";

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
