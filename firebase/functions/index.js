const functions = require("firebase-functions");
const fetch = require("node-fetch");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const CACHE_TTL = {
  movementLib: 12 * 60 * 60 * 1000, // 12 hours
  trainingProgress: 12 * 60 * 60 * 1000, // 12 hours
};

const GAS_BASE_URL ="https://script.google.com/macros/s/AKfycbzcf0YKfJksPgxBbNT-5ElE11Rz13H5D1hsm5dT1k0W8WptQ62HpbYLlqf54ImkNlefKw/exec";
const GAS_MOVEMENT_LIB_URL = `${GAS_BASE_URL}?action=movementLib`;
const GAS_PROGRESS_URL = `${GAS_BASE_URL}?action=progress`;
if (!GAS_BASE_URL) {
  throw new Error("❌ GAS_BASE_URL 未定義");
}

// 建立一個 HTTPS Cloud Function 作為代理
exports.proxyToGAS = functions
    .https.onRequest(async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }

      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      try {
        const response = await fetch(GAS_BASE_URL, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(req.body),
        });

        const result = await response.text();
        return res.status(200).send(result);
      } catch (err) {
        console.error("轉送失敗", err);
        return res.status(500).send("發生錯誤：" + err.message);
      }
    });

// 動作圖庫功能
exports.proxyMovementLibWithCache = functions
    .https.onRequest(async (req, res) => {
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
        const ttl = CACHE_TTL.movementLib;

        if (cacheDoc.exists) {
          const {lastUpdate, data} = cacheDoc.data();
          if (now - new Date(lastUpdate).getTime() < ttl) {
            res.status(200).json(data);
            return;
          }
        }

        const response = await fetch(GAS_MOVEMENT_LIB_URL);
        const contentType = response.headers.get("Content-Type");

        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("❌ GAS 回傳非 JSON：", text.slice(0, 200));
          return res.status(502).send("GAS 回傳錯誤，請重新檢查部署與授權設定");
        }

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

exports.proxyTrainingProgressWithCache = functions
    .https.onRequest(async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      try {
        const cacheDocRef = db.collection("cache").doc("trainingProgress");
        const cacheDoc = await cacheDocRef.get();
        const now = Date.now();
        const ttl = CACHE_TTL.trainingProgress;

        if (cacheDoc.exists) {
          const {lastUpdate, data} = cacheDoc.data();
          if (now - new Date(lastUpdate).getTime() < ttl) {
            res.status(200).json(data);
            return;
          }
        }

        const response = await fetch(GAS_PROGRESS_URL);
        const contentType = response.headers.get("Content-Type");

        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("❌ GAS 回傳非 JSON：", text.slice(0, 200));
          return res.status(502).send("GAS 回傳錯誤，請重新檢查部署與授權設定");
        }

        const freshData = await response.json();

        await cacheDocRef.set({
          lastUpdate: new Date().toISOString(),
          data: freshData,
        });

        res.status(200).json(freshData);
      } catch (error) {
        console.error("Error in proxyTrainingProgressWithCache:", error);
        res.status(500).send("Server error");
      }
    });
