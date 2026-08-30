// Cloudflare Pages Function - 九九乘法小王国 API
// 数据保存在 Cloudflare KV（免费）

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;
  const kv = env.MULTIPLICATION_KV;
  const adminToken = env.ADMIN_TOKEN || "admin123";

  if (!kv) {
    return json({ error: "KV 未绑定：请在 Cloudflare Pages 后台 Bindings 添加 MULTIPLICATION_KV" }, 500);
  }
  if (typeof kv.list !== "function") {
    return json({ error: "绑定类型错误：MULTIPLICATION_KV 必须是 KV namespace，请在 Bindings 检查" }, 500);
  }

  try {
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (path === "/api/health") {
      return json({ ok: true });
    }

    if (path === "/api/login" && method === "POST") {
      return await handleLogin(request, kv);
    }

    if (path.startsWith("/api/users/") && method === "PUT") {
      return await handleUpdate(request, path, kv);
    }

    if (path.startsWith("/api/users/") && method === "DELETE") {
      return await handleDeleteUser(request, path, kv, adminToken);
    }

    if (path === "/api/admin/students" && method === "GET") {
      return await handleAdminStudents(request, kv, adminToken);
    }

    if (path === "/api/admin/export.csv" && method === "GET") {
      return await handleExportCsv(request, kv, adminToken);
    }

    if (path === "/api/admin/export.json" && method === "GET") {
      return await handleExportJson(request, kv, adminToken);
    }

    return json({ error: "Not Found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "服务器错误：" + (e && e.message ? e.message : String(e)) }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-admin-token"
  };
}

function defaultUser(className, name) {
  const now = new Date().toISOString();
  return {
    id: "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    className: String(className || "").trim(),
    name: String(name || "").trim(),
    stars: 0,
    coins: 0,
    bestCombo: 0,
    pets: [],
    food: {},
    scores: {
      correct: 0,
      wrong: 0,
      challengeWins: 0,
      practiceCount: 0
    },
    mistakes: [],
    completedChallenges: [],
    ownedSkins: [],
    equippedSkins: {},
    unlockedTitles: [],
    equippedTitle: null,
    createdAt: now,
    updatedAt: now
  };
}

async function listAllUsers(kv) {
  const list = await kv.list({ prefix: "user:" });
  const users = [];
  for (const key of list.keys) {
    const raw = await kv.get(key.name);
    if (raw) users.push(JSON.parse(raw));
  }
  return users;
}

async function handleLogin(request, kv) {
  const body = await request.json();
  const className = String(body.className || "").trim();
  const name = String(body.name || "").trim();
  if (!className || !name) {
    return json({ error: "请填写班级和姓名" }, 400);
  }

  const users = await listAllUsers(kv);
  let user = users.find(u => u.className === className && u.name === name);
  if (!user) {
    user = defaultUser(className, name);
    await kv.put("user:" + user.id, JSON.stringify(user));
  }
  // 老用户登录不再写入 KV，减少免费额度消耗
  return json({ ok: true, user });
}

async function handleUpdate(request, path, kv) {
  const parts = path.split("/");
  const id = parts[3];
  const body = await request.json();
  const raw = await kv.get("user:" + id);
  if (!raw) return json({ error: "用户不存在" }, 404);

  const user = JSON.parse(raw);
  const allowed = ["stars", "coins", "bestCombo", "pets", "food", "scores", "mistakes", "completedChallenges", "ownedSkins", "equippedSkins", "unlockedTitles", "equippedTitle"];
  for (const key of allowed) {
    if (body[key] !== undefined) user[key] = body[key];
  }
  user.updatedAt = new Date().toISOString();
  await kv.put("user:" + id, JSON.stringify(user));
  return json({ ok: true, user });
}

function checkAdmin(request, adminToken) {
  return request.headers.get("x-admin-token") === adminToken;
}

async function handleDeleteUser(request, path, kv, adminToken) {
  if (!checkAdmin(request, adminToken)) {
    return json({ error: "管理员验证失败" }, 401);
  }
  const parts = path.split("/");
  const id = parts[3];
  await kv.delete("user:" + id);
  return json({ ok: true });
}

async function handleAdminStudents(request, kv, adminToken) {
  if (!checkAdmin(request, adminToken)) {
    return json({ error: "管理员验证失败" }, 401);
  }
  const url = new URL(request.url);
  const className = String(url.searchParams.get("class") || "").trim();
  let users = await listAllUsers(kv);
  if (className) users = users.filter(u => u.className === className);
  users.sort((a, b) => (b.coins || 0) - (a.coins || 0) || (b.stars || 0) - (a.stars || 0));
  return json({ ok: true, users });
}

async function handleExportCsv(request, kv, adminToken) {
  if (!checkAdmin(request, adminToken)) {
    return json({ error: "管理员验证失败" }, 401);
  }
  const url = new URL(request.url);
  const className = String(url.searchParams.get("class") || "").trim();
  let users = await listAllUsers(kv);
  if (className) users = users.filter(u => u.className === className);

  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["班级", "姓名", "星星", "金币", "最高连击", "宠物数量", "答题正确", "答题错误", "创建时间", "更新时间"].map(esc).join(",")
  ];
  for (const u of users) {
    lines.push([
      u.className,
      u.name,
      u.stars,
      u.coins,
      u.bestCombo,
      Array.isArray(u.pets) ? u.pets.length : 0,
      u.scores?.correct || 0,
      u.scores?.wrong || 0,
      u.createdAt,
      u.updatedAt
    ].map(esc).join(","));
  }

  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=students.csv",
      ...corsHeaders()
    }
  });
}

async function handleExportJson(request, kv, adminToken) {
  if (!checkAdmin(request, adminToken)) {
    return json({ error: "管理员验证失败" }, 401);
  }
  const users = await listAllUsers(kv);
  return json({ ok: true, users });
}
