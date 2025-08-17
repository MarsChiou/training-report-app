const functions = require("firebase-functions");
const fetch = require("node-fetch");
const admin = require("firebase-admin");
const axios = require("axios");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const LINE_CHANNEL_ACCESS_TOKEN = defineSecret("LINE_CHANNEL_ACCESS_TOKEN");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const CACHE_TTL = {
  movementLib: 12 * 60 * 60 * 1000, // 12 hours
  trainingProgress: 12 * 60 * 60 * 1000, // 12 hours
};

const GAS_BASE_URL ="https://script.google.com/macros/s/AKfycbzcf0YKfJksPgxBbNT-5ElE11Rz13H5D1hsm5dT1k0W8WptQ62HpbYLlqf54ImkNlefKw/exec";
const GAS_META_URL = `${GAS_BASE_URL}?action=meta`;
const GAS_NAMES_URL = `${GAS_BASE_URL}?action=names&format=object`;
const GAS_MOVEMENT_LIB_URL = `${GAS_BASE_URL}?action=movementLib`;
const GAS_PROGRESS_URL = `${GAS_BASE_URL}?action=progress`;
// Diary with cache (GET /proxyDiaryWithCache?userId=...&fresh=1 可繞過快取)
const CACHE_TTL_DIARY = 24 * 60 * 60 * 1000;
const GAS_DIARY_URL = `${GAS_BASE_URL}?action=diary`;

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

      // Log 用資料
      const requestData = req.body;
      const timestampUTC = new Date();
      const timestampTaiwan = new Date(timestampUTC.
          getTime() + 8 * 60 * 60 * 1000);

      const dateString = timestampTaiwan.
          toISOString().split("T")[0]; // e.g., "2025-05-05"
      const timeString = timestampTaiwan.
          toTimeString().split(" ")[0]; // e.g., "14:25:36"
      const logId = `${timeString}_${requestData.userId || "unknow"}`; // doc ID

      let gasResponseText = "";
      let errorMessage = "";

      //
      try {
        const gasResponse = await fetch(GAS_BASE_URL, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(requestData),
        });

        gasResponseText = await gasResponse.text();
        res.status(200).send(gasResponseText);
        // === 若回報成功且含日記 → 失效日記快取 ===
        const ok = gasResponse.ok && gasResponseText &&
          !gasResponseText.startsWith("❌") &&
          !gasResponseText.includes("錯誤");
        const diaryText = String(requestData.diaryText || "").trim();
        const diaryDone = !!requestData.diaryDone;

        if (ok && (diaryText.length > 0 || diaryDone)) {
          try {
            const cacheSnap = await db.collection("cache").get();
            const batch = db.batch();
            let cnt = 0;
            cacheSnap.forEach((doc) => {
              if (doc.id.startsWith("diary_")) {
                batch.delete(doc.ref);
                cnt++;
              }
            });
            if (cnt > 0) await batch.commit();
            console.log(`🧹 Diary cache invalidated, count=${cnt}`);
          } catch (invErr) {
            console.error("invalidate diary cache failed", invErr);
            // 不影響主流程
          }
        }
      } catch (err) {
        errorMessage = err.message;
        console.error("轉送失敗", err);
        res.status(500).send("發生錯誤：" + errorMessage);
      } finally {
        try {
          await db
              .collection("postLogs")
              .doc(dateString) // 每天一份文件
              .collection("entries") // subcollection 裡每筆 log
              .doc(logId) // 可避免重複（理論上不太會撞）
              .set({
                requestData,
                gasResponse: gasResponseText,
                errorMessage,
                timestampUTC: timestampUTC.toISOString(),
                timestampTaiwan: timestampTaiwan.toLocaleString("zh-TW"),
              });
        } catch (logErr) {
          console.error("寫入 Firestore log 時失敗", logErr);
        }
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

exports.proxyDiaryWithCache = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "GET") {
    return res.status(405).json({ok: false, error: "Method Not Allowed"});
  }

  try {
    const userId = String(req.query.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ok: false, error: "Missing userId"});
    }

    const start = req.query.start ? String(req.query.start) : "";
    const end = req.query.end ? String(req.query.end) : "";
    const fresh = String(req.query.fresh || "") === "1";

    const cacheId = `diary_${userId}${start || end ?
      `_${start}_${end}` : ""}`;
    const cacheRef = db.collection("cache").doc(cacheId);

    // fresh=1 → 直接打 GAS 並回填快取
    if (fresh) {
      const out = await fetchDiaryFromGASAndCache(GAS_DIARY_URL,
          {userId, start, end}, cacheRef);
      return res.status(out.status).json(out.body);
    }

    // 先看快取
    const snap = await cacheRef.get();
    const now = Date.now();

    if (snap.exists) {
      const {lastUpdate, data} = snap.data();
      if (data && (now - new Date(lastUpdate).getTime()) < CACHE_TTL_DIARY) {
        return res.status(200).json(data);
      }
    }

    // 沒快取或過期 → 取 GAS + 回填
    const out = await fetchDiaryFromGASAndCache(GAS_DIARY_URL,
        {userId, start, end}, cacheRef);
    return res.status(out.status).json(out.body);
  } catch (err) {
    console.error("proxyDiaryWithCache error", err);
    return res.status(500).json({ok: false,
      error: String(err?.message || err)});
  }
});

exports.proxyRosterWithCache = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "GET") {
    return res.status(405).json({ok: false, error: "Method Not Allowed"});
  }

  const fresh = String(req.query.fresh || "") === "1";

  try {
    // 1) 先拿 meta（取得 campId + rosterVersion）
    const meta = await fetchJSONorThrow(GAS_META_URL);
    if (!meta?.ok || !meta?.campId) {
      return res.status(502).json({ok: false, error: "meta 失敗"});
    }
    const campId = String(meta.campId);
    const version = String(meta.rosterVersion || "");

    const docId = `roster_${campId}`;
    const ref = db.collection("cache").doc(docId);

    // 2) 非 fresh → 嘗試命中快取（只看版本，不看 TTL）
    if (!fresh) {
      const snap = await ref.get();
      if (snap.exists) {
        const c = snap.data();
        if (c && c.version === version && Array.isArray(c.data)) {
          return res.status(200).json({
            ok: true, campId, version, roster: c.data, source: "cache",
            lastUpdate: c.lastUpdate || null,
          });
        }
      }
    }

    // 3) 取新的名單
    const list = await fetchJSONorThrow(GAS_NAMES_URL);
    if (!Array.isArray(list)) {
      return res.status(502).json({ok: false, error: "names 格式錯誤（非陣列）"});
    }

    // 4) 覆寫快取（版本跟著 meta）
    await ref.set({
      version,
      data: list,
      lastUpdate: new Date().toISOString(),
    }, {merge: true});

    return res.status(200).json({
      ok: true, campId, version, roster: list, source: "fresh",
    });
  } catch (e) {
    console.error("proxyRosterWithCache error", e);
    return res.status(500).json({ok: false, error: String(e.message || e)});
  }
});

/**
*@param {string} url - TheURL
*/
async function fetchJSONorThrow(url) {
  const r = await fetch(url);
  const ctype = r.headers.get("Content-Type") || "";
  if (!ctype.includes("application/json")) {
    const peek = await r.text();
    throw new Error(`GAS returned non-JSON: ${peek.slice(0, 200)}`);
  }
  return r.json();
}

/**
 * Fetch diary data from GAS and update cache
 * @param {string} baseUrl - The base URL for GAS
 * @param {Object} params - Parameters object
 * @param {string} params.userId - User ID
 * @param {string} params.start - Start date
 * @param {string} params.end - End date
 * @param {Object} cacheRef - Firestore cache reference
 * @return {Promise<Object>} Response object with status and body
 */
async function fetchDiaryFromGASAndCache(baseUrl, {userId, start, end},
    cacheRef) {
  const qs = new URLSearchParams({userId});
  if (start) qs.set("start", start);
  if (end) qs.set("end", end);

  const url = `${baseUrl}&${qs.toString()}`;
  const r = await fetch(url);
  const ctype = r.headers.get("Content-Type") || "";
  if (!ctype.includes("application/json")) {
    const text = await r.text();
    return {status: 502, body: {ok: false, error: "GAS returned non-JSON",
      peek: text.slice(0, 200)}};
  }

  const json = await r.json();
  if (json && json.ok) {
    await cacheRef.set({lastUpdate: new Date().toISOString(),
      data: json}, {merge: true});
  }
  return {status: 200, body: json};
}

// 強制更新訓練進度
exports.forceUpdateTrainingProgressCache = functions
    .https.onRequest(async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      try {
        const response = await fetch(GAS_PROGRESS_URL);
        const contentType = response.headers.get("Content-Type");

        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("❌ GAS 回傳非 JSON：", text.slice(0, 200));
          return res.status(502).send("GAS 回傳錯誤，請重新檢查部署與授權設定");
        }

        const freshData = await response.json();

        const cacheDocRef = db.collection("cache").doc("trainingProgress");
        await cacheDocRef.set({
          lastUpdate: new Date().toISOString(),
          data: freshData,
        });

        // ✅ 清除 movementLib 快取
        await db.collection("cache").doc("movementLib").delete();
        console.log("🧹 已清除 movementLib 快取");

        console.log("✅ 訓練進度快取已強制更新");
        res.status(200).send("✅ 訓練進度快取已強制更新");
      } catch (error) {
        console.error("🔥 強制更新錯誤：", error);
        res.status(500).send("❌ 強制更新失敗");
      }
    });

// Line Web Hook Server
exports.lineWebhook = onRequest(
    {secrets: [LINE_CHANNEL_ACCESS_TOKEN]}, async (req, res) => {
      const event = req.body.events?.[0];
      if (!event || event.type !== "message" || event.message.type !== "text") {
        return res.status(200).send("Not a valid text message");
      }

      const message = event.message.text;
      const replyToken = event.replyToken;
      const trainingProgressUrl = "https://us-central1-joi-team.cloudfunctions" +
        ".net/forceUpdateTrainingProgressCache";

      if (message === "/更新動作進度") {
        try {
          const response = await fetch(trainingProgressUrl, {method: "POST"});
          const resultText = await response.text();

          await reply(replyToken, resultText);
          return res.status(200).send("更新進度成功");
        } catch (err) {
          console.error("🔥 呼叫 Firebase Function 失敗", err);
          await reply(replyToken, "❌ 更新進度失敗");
          return res.status(500).send("更新失敗");
        }
      } else {
        await reply(replyToken, "這個指令我不認識喔~");
        return res.status(200).send("已處理訊息");
      }
    });

/**
 * 回覆訊息給使用者
 * @param {string} replyToken - LINE 回覆 token
 * @param {string} text - 要回覆的文字
 * @return {Promise} - axios POST 回應 promise
 */
async function reply(replyToken, text) {
  const token = LINE_CHANNEL_ACCESS_TOKEN.value();
  console.log("✅ 取得的 token 長度:", token?.length);
  return axios.post(
      "https://api.line.me/v2/bot/message/reply",
      {
        replyToken,
        messages: [{type: "text", text}],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN.value()}`,
        },
      },
  );
}
