# 🎮 CopperNodes 金币自动领取

每日签到 + Linkvertise 领取，多账号，Cookie 失效自动重登并写回。

---

## 📦 仓库结构

| 🏷️ | 仓库 | 内容 |
|---|---|---|
| 🌐 公库 | 本仓库 | Workflow |
| 🔒 私库 | `ActionNode-Start-Private` | 脚本 + Cookie |

---

## 🔐 Secrets

| 变量 | 必填 | 格式 / 说明 |
|---|---|---|
| `COPPER_ACCOUNT` | ✅ | 见下方 |
| `PRIVATE_REPO_TOKEN` | ✅ | GitHub PAT，权限勾选 `repo` |
| `TG_BOT` | 💬 可选 | `chatId,token` |
| `GOST_PROXY` | 🛡️ 可选 | `socks5://user:pass@host:port` |

### `COPPER_ACCOUNT` 格式
多账号直接换行，每行：`账号名,email,password`
```
Copper-FR🇫🇷,account1@example.com,Password1
Copper-DE🇩🇪,account2@example.com,Password2
```

---

## 📝 私库 `COOKIE_STORE`

账号名须与 `COPPER_ACCOUNT` 第一段**完全一致**（含 emoji），`cookie` 留空自动维护：

```js
const COOKIE_STORE = [
  { account: "Copper-FR🇫🇷", cookie: "" },
  { account: "Copper-DE🇩🇪", cookie: "" },
];
```

---

## 🔄 Cookie 维护流程

```
拉取私库 → 执行任务
    ↓ Cookie 失效
    账号密码重登 → 新 Cookie 写回脚本 → 推回私库
```

---

## 📨 TG 推送样例

```
🎮 Copper 金币领取通知
👤 运行账号：Copper-FR🇫🇷
🕐 运行时间：2025-01-01 12:00:00
💰 初始金币：100,00
🏆 最终金币：150,00
```
