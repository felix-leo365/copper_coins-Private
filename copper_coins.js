const { HttpsProxyAgent } = require("https-proxy-agent");
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://dash.coppernodes.xyz";
const REMEMBER_COOKIE_NAME = "remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d";

const PROXY = process.env.GOST_PROXY ? "http://127.0.0.1:8080" : null;
const agent = PROXY ? new HttpsProxyAgent(PROXY) : undefined;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

// ============================================================
// 硬编码 Cookie 存储（由脚本自动维护，勿手动修改格式）
// 格式：{ account, cookie }
// account 与 COPPER_ACCOUNT 中的账号名（第一段）对应
// cookie 失效后自动登录并写回此处，再由 CI 推回私库
// ============================================================
const COOKIE_STORE = [
  { account: "Copper-FR🇫🇷", cookie: "eyJpdiI6IjZQZW9QbTBrb2t6QzRZMDA0R0gvdHc9PSIsInZhbHVlIjoiTzBoWVBOclFKR3RzR1NNV1NEd1kwTXBrUGNuRHJnbHFIK3U0TUtDT1ZFMlhyMWpaOHYxY0UxYTdOWXdVTUdkbTRtd1VMS0hiQldJTkExRm5NdUg1ZVdXeGszQ1pzMndKR2JkdnFPVHpVRUxDdXlOcCtwR01LYzcrWG5CZlZIeCtVN21tY3YxWFZMaTJWSUlHTHlGYmM0d3JmdzRHb0RlREx0azRrL0Y4RGhJZ0NVdUlKb0lVeEwrWngrUWtkWi9jbHBLSHhkM1hTTWU2dnRHTll6UlNMYWV3NVBwc0pSSHZEamRaU2xFQ1Fjcz0iLCJtYWMiOiI1NTFiN2Y0Y2JlZWFkODE0M2RmNDg4OTEzMzM5MmFmZjM3YmJlODU3MjkzMDc2YTEyN2M2YTIwZTg2ZjM1Y2Q1IiwidGFnIjoiIn0%3D" },
  { account: "Copper-DE🇩🇪", cookie: "eyJpdiI6IjVOcm5JcEMrNm5rYUJEOStmemxNZkE9PSIsInZhbHVlIjoieXp2enlCU24rQ0lkQTFyU3A4eEtpZ1kyYyt3aGZ0aC9lNE10NFBReExkMlJkZXNFNGJreUZyTXh0Vzc0V0hsRXhVTVBpeEtRYjhabFpXVjIyRFAyK3NjOXkwVGRkQVNDb0ZoUEpWc0N5UkxDVjFzYjRWTENzQSs1VlQ2NW9oc1hObTZRSDhoTmJMZEtPY0JHa2YxY3RKbUFnbGhDSlRSTG1yeVZ6dTZiQTlmMGRrVjN4MzJ0ZVZaWWhReGZIZkVMQmVUWUxod2Z1YVdvbTVqdHlCQVNUZkt6WWltU1BvYnU1NmNzeDYzYU5xZz0iLCJtYWMiOiJlNzA3YzU4NjRiMzJjM2Y1MGNmZTllZjBkMzIwZjBjODhlYjY1NmRhNThjMTNlMDVjN2I1YzE2ZGE5NTMzMmRhIiwidGFnIjoiIn0%3D" },
];
// END_COOKIE_STORE

// ============================================================
// 从环境变量加载账号
//
// COPPER_ACCOUNT 格式（多账号直接换行）：
//   Copper-FR🇫🇷,account1@example.com,YourPassword1
//   Copper-DE🇩🇪,account2@example.com,YourPassword2
//
// cookie 从脚本 COOKIE_STORE 按账号名匹配读取
// ============================================================
function loadAccounts() {
  const raw = process.env.COPPER_ACCOUNT;
  if (!raw) {
    throw new Error("❌ 未检测到 COPPER_ACCOUNT 环境变量，请设置后重试");
  }

  const accounts = [];
  const lines = raw.split("\n").map(s => s.trim()).filter(Boolean);

  for (const line of lines) {
    const parts = line.split(",").map(s => s.trim());
    if (parts.length < 3) {
      log(`⚠️ 格式错误（应为 账号名,email,password）：${line}，跳过`);
      continue;
    }
    const [account, email, password] = parts;
    const storeIdx = COOKIE_STORE.findIndex(s => s.account === account);
    const cookie = storeIdx >= 0 ? COOKIE_STORE[storeIdx].cookie : "";
    accounts.push({ account, email, password, cookie, storeIndex: storeIdx });
  }

  if (accounts.length === 0) {
    throw new Error("❌ 解析账号失败，请检查 COPPER_ACCOUNT 格式（每行：账号名,email,password）");
  }
  return accounts;
}

// ============================================================
// 将更新后的 cookie 写回脚本 COOKIE_STORE（供 CI 推回私库）
// ============================================================
function writeCookieBack(storeIndex, account, newCookie) {
  if (storeIndex < 0) {
    log(`⚠️ [${account}] 不在 COOKIE_STORE 中，跳过写回`);
    return false;
  }
  const scriptPath = path.resolve(__filename);
  let src = fs.readFileSync(scriptPath, "utf-8");

  const accountEscaped = account.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(\\{\\s*account:\\s*"${accountEscaped}",[\\s\\S]*?cookie:\\s*")[^"]*(")`
  );

  const replaced = src.replace(pattern, `$1${newCookie}$2`);
  if (replaced !== src) {
    fs.writeFileSync(scriptPath, replaced, "utf-8");
    log(`💾 [${account}] Cookie 已写回脚本`);
    return true;
  } else {
    log(`⚠️ [${account}] Cookie 写回失败，请手动更新`);
    return false;
  }
}

// ============================================================
// 工具
// ============================================================
function maskEmail(email) {
  return email.replace(/^([^@]{1,3})[^@]*/, "$1***");
}

function log(msg) {
  console.log(msg);
}

function logA(account, msg) {
  console.log(`[${account}] ${msg}`);
}

function nowStr() {
  return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function readCoins(html) {
  let m = html.match(/fa-coins[^<]*<\/i><\/small>\s*([\d,\.]+)\s*<\/span>/i);
  if (m) return m[1].trim();
  m = html.match(/<small><i[^>]+fa-coins[^>]*><\/i><\/small>\s*([\d,\.]+)/i);
  if (m) return m[1].trim();
  return "";
}

function readCsrfToken(html) {
  const m = html.match(/<meta name="csrf-token" content="([^"]+)"/);
  return m ? m[1] : "";
}

function extractVerifyUrl(html) {
  const m = html.match(/href="(https:\/\/link-to\.net\/[^"]+)"/);
  if (!m) return "";
  try {
    const u = new URL(m[1]);
    const r = u.searchParams.get("r");
    if (!r) return "";
    return Buffer.from(r, "base64").toString("utf-8");
  } catch (e) {
    return "";
  }
}

function buildCookie(cookieJar) {
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");
}

function parseSetCookie(header) {
  const result = {};
  if (!header) return result;
  for (const part of header.split(",")) {
    const cookie = part.split(";")[0].trim();
    const eqIdx = cookie.indexOf("=");
    if (eqIdx > 0) {
      const name = cookie.substring(0, eqIdx).trim();
      const value = cookie.substring(eqIdx + 1).trim();
      if (name === "XSRF-TOKEN" || name === "coppernodes_session" || name === REMEMBER_COOKIE_NAME) {
        result[name] = value;
      }
    }
  }
  return result;
}

function proxyFetch(url, options = {}) {
  return fetch(url, { ...options, ...(agent ? { agent } : {}) });
}

// ============================================================
// TG 推送
// ============================================================
async function sendTg(label, coinsBefore = "", coinsAfter = "") {
  const tgBot = process.env.TG_BOT;
  if (!tgBot || !tgBot.includes(",")) return;
  const [chatId, token] = tgBot.split(",").map(s => s.trim());
  const msg = [
    "🎮 Copper 金币领取通知",
    `👤 运行账号：${label}`,
    `🕐 运行时间：${nowStr()}`,
    `💰 初始金币：${coinsBefore || "未知"}`,
    `🏆 最终金币：${coinsAfter || "未知"}`,
  ].join("\n");
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg }),
      ...(agent ? { agent } : {}),
    });
    log(resp.ok ? "📨 TG推送成功" : `⚠️ TG推送失败：${resp.status}`);
  } catch (e) {
    log(`⚠️ TG推送异常：${e.message}`);
  }
}

// ============================================================
// 账号密码登录
// ============================================================
async function loginWithCredentials(email, password) {
  // Step 1: 获取登录页 CSRF Token
  const loginPageResp = await proxyFetch(`${BASE_URL}/login`, {
    headers: { ...HEADERS },
    redirect: "follow",
  });
  const loginPageHtml = await loginPageResp.text();
  const csrfToken = readCsrfToken(loginPageHtml);
  if (!csrfToken) throw new Error("无法获取登录页 CSRF Token");

  const initCookies = parseSetCookie(loginPageResp.headers.get("set-cookie") || "");
  const cookieJar = { ...initCookies };

  // Step 2: 提交登录表单
  const body = new URLSearchParams({
    _token: csrfToken,
    email,
    password,
    remember: "on",
  }).toString();

  const loginResp = await proxyFetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: {
      ...HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": `${BASE_URL}/login`,
      "Origin": BASE_URL,
      Cookie: buildCookie(cookieJar),
    },
    body,
    redirect: "manual",
  });

  const location = loginResp.headers.get("location") || "";
  if (loginResp.status === 302 && location.includes("/login")) throw new Error("账号密码错误，登录失败");
  if (loginResp.status === 401) throw new Error("账号密码错误（401）");
  if (loginResp.status === 429) throw new Error("登录频率限制（429），请稍后重试");

  const newCookies = parseSetCookie(loginResp.headers.get("set-cookie") || "");
  const rememberCookie = newCookies[REMEMBER_COOKIE_NAME] || "";
  return { rememberCookie, newCookies };
}

// ============================================================
// 登录阶段（优先 cookie，失效则账号密码登录并写回）
// ============================================================
async function phaseLogin(account) {
  const { account: accountName, email, password, storeIndex } = account;
  logA(accountName, "🔧 初始化会话...");

  let cookieJar = {};
  let rememberCookie = account.cookie;
  let cookieUpdated = false;

  if (rememberCookie) {
    cookieJar[REMEMBER_COOKIE_NAME] = rememberCookie;
    logA(accountName, "🔑 尝试已有 Cookie...");

    const resp = await proxyFetch(`${BASE_URL}/home`, {
      headers: { ...HEADERS, Cookie: buildCookie(cookieJar) },
      redirect: "manual",
    });
    const location = resp.headers.get("location") || "";
    const expired = (resp.status === 301 || resp.status === 302) && location.includes("/login");

    if (!expired) {
      const tokens = parseSetCookie(resp.headers.get("set-cookie") || "");
      if (tokens["XSRF-TOKEN"]) cookieJar["XSRF-TOKEN"] = tokens["XSRF-TOKEN"];
      if (tokens["coppernodes_session"]) cookieJar["coppernodes_session"] = tokens["coppernodes_session"];
      logA(accountName, "✅ Cookie 有效");
    } else {
      logA(accountName, "⚠️ Cookie 已失效，切换账号密码登录...");
      rememberCookie = "";
    }
  }

  if (!rememberCookie) {
    if (!email || !password) throw new Error("Cookie 失效且未配置密码，无法登录");
    logA(accountName, "🔑 账号密码登录...");
    const { rememberCookie: newCookie, newCookies } = await loginWithCredentials(email, password);
    logA(accountName, newCookie ? "✅ 登录成功，获取到新 Cookie" : "⚠️ 登录成功但未获取到 remember cookie");

    account.cookie = newCookie;
    cookieJar = { ...newCookies, [REMEMBER_COOKIE_NAME]: newCookie };
    cookieUpdated = true;
    writeCookieBack(storeIndex, accountName, newCookie);
  }

  // 最终验证
  const homeResp = await proxyFetch(`${BASE_URL}/home`, {
    headers: { ...HEADERS, Cookie: buildCookie(cookieJar) },
    redirect: "follow",
  });
  const homeHtml = await homeResp.text();
  if (homeResp.url.includes("/login")) throw new Error("最终验证失败，请检查账号或 Cookie");

  logA(accountName, "✅ 登录成功");
  const coinsBefore = readCoins(homeHtml);
  logA(accountName, coinsBefore ? `💰 初始金币：${coinsBefore}` : "⚠️ 未能读取初始金币，继续...");

  return { cookieJar, coinsBefore, cookieUpdated };
}

// ============================================================
// 每日签到
// ============================================================
async function phaseDaily(cookieJar, accountName) {
  logA(accountName, "🎁 每日签到...");

  const pageResp = await proxyFetch(`${BASE_URL}/daily-rewards`, {
    headers: { ...HEADERS, Cookie: buildCookie(cookieJar) },
    redirect: "follow",
  });
  const csrfToken = readCsrfToken(await pageResp.text());
  if (!csrfToken) { logA(accountName, "⚠️ 未能读取 CSRF Token，跳过签到"); return; }

  const claimResp = await proxyFetch(`${BASE_URL}/daily-rewards/claim`, {
    method: "POST",
    headers: {
      ...HEADERS,
      Cookie: buildCookie(cookieJar),
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-CSRF-TOKEN": csrfToken,
    },
  });

  let json;
  try { json = await claimResp.json(); } catch (e) { logA(accountName, "⌛️ 签到：今日已领取"); return; }

  if (json.success) {
    logA(accountName, `✅ 签到成功 +${json.reward / 1000 % 1 === 0 ? json.reward / 1000 + ",00" : json.reward / 1000}`);
  } else if (json.error) {
    logA(accountName, "⌛️ 期限未至 +0,00");
  } else {
    logA(accountName, "⌛️ 签到：今日已领取");
  }
}

// ============================================================
// 单次 Linkvertise 领取
// ============================================================
async function phaseEarnOnce(cookieJar, currentCoins) {
  const genResp = await proxyFetch(`${BASE_URL}/linkvertise/generate`, {
    headers: { ...HEADERS, Cookie: buildCookie(cookieJar), Referer: `${BASE_URL}/linkvertise` },
    redirect: "follow",
  });
  const verifyUrl = extractVerifyUrl(await genResp.text());
  if (!verifyUrl) return null;

  await proxyFetch(verifyUrl, {
    headers: { ...HEADERS, Cookie: buildCookie(cookieJar), Referer: `${BASE_URL}/linkvertise/generate` },
    redirect: "follow",
  });

  const homeResp = await proxyFetch(`${BASE_URL}/home`, {
    headers: { ...HEADERS, Cookie: buildCookie(cookieJar) },
    redirect: "follow",
  });
  return readCoins(await homeResp.text()) || currentCoins;
}

// ============================================================
// 单账号主流程
// ============================================================
async function runAccount(account, idx, totalUpdated) {
  const { account: accountName } = account;
  let coinsBefore = "", currentCoins = "", successCount = 0;
  const MAX_ROUNDS = 10;

  log(`\n${"=".repeat(50)}`);
  log(`[账号 ${idx + 1}/${totalUpdated.total}] ▶️  ${accountName}`);
  log(`${"=".repeat(50)}`);

  try {
    const { cookieJar, coinsBefore: cb, cookieUpdated } = await phaseLogin(account);
    coinsBefore = cb;
    currentCoins = coinsBefore;
    if (cookieUpdated) totalUpdated.count++;

    await phaseDaily(cookieJar, accountName);

    logA(accountName, `🔄 Linkvertise 领取（共 ${MAX_ROUNDS} 次）...`);

    for (let i = 0; i < MAX_ROUNDS; i++) {
      const prevCoins = currentCoins;
      const result = await phaseEarnOnce(cookieJar, currentCoins);

      if (result === null) { logA(accountName, `⚠️ 第 ${i + 1} 次失败，停止`); break; }

      currentCoins = result;
      successCount++;

      const prevVal = parseFloat((prevCoins || "0").replace(",", ".")) || 0;
      const nowVal  = parseFloat((currentCoins || "0").replace(",", ".")) || 0;
      const gained  = nowVal - prevVal;
      logA(accountName, `✅ 第 ${i + 1} 次 ${gained > 0 ? "+" : ""}${gained.toFixed(2).replace(".", ",")}`);

      if (i < MAX_ROUNDS - 1) await new Promise(r => setTimeout(r, 3000));
    }
  } catch (e) {
    logA(accountName, `❌ 执行异常：${e.message}`);
    await sendTg(accountName, coinsBefore, currentCoins);
    return;
  }

  const beforeVal = parseFloat((coinsBefore || "0").replace(",", ".")) || 0;
  const afterVal  = parseFloat((currentCoins || "0").replace(",", ".")) || 0;
  const diff = afterVal - beforeVal;

  logA(accountName, `📊 共成功 ${successCount} 次 | ${coinsBefore} → ${currentCoins}`);

  if (diff > 0) {
    logA(accountName, `🎉 合计 +${diff.toFixed(2).replace(".", ",")} 枚金币`);
  } else if (successCount === 0) {
    logA(accountName, "⚠️ 未成功领取任何金币");
  } else {
    logA(accountName, "⚠️ 金币未增加");
  }
  await sendTg(accountName, coinsBefore, currentCoins);
}

// ============================================================
// 主入口
// ============================================================
async function main() {
  log(`🚀 CopperNodes 多账号任务开始 - ${nowStr()}`);
  log(PROXY ? "🛡️ 代理模式" : "🌐 直连模式");

  let accounts;
  try {
    accounts = loadAccounts();
  } catch (e) {
    log(e.message);
    process.exit(1);
  }

  log(`👥 共 ${accounts.length} 个账号`);

  const totalUpdated = { count: 0, total: accounts.length };

  for (let i = 0; i < accounts.length; i++) {
    await runAccount(accounts[i], i, totalUpdated);
    if (i < accounts.length - 1) {
      log("\n⏳ 等待 5 秒后执行下一个账号...");
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  log(`\n✅ 所有账号执行完毕 - ${nowStr()}`);
  if (totalUpdated.count > 0) {
    log(`💾 共更新了 ${totalUpdated.count} 个账号的 Cookie，脚本已写回`);
    log("📤 CI 应将更新后的脚本推回私库");
  }
}

main();
