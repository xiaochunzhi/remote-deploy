import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin123";
const MONGODB_URI = process.env.MONGODB_URI || "";

const app = express();
app.use(express.json({ limit: "2mb" }));

// 简单 CORS，方便本地调试
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,x-admin-token");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

// ===== 存储：支持 MongoDB 或本地 JSON 文件 =====
let mongoClient = null;
let usersCollection = null;

async function connectMongo() {
  if (!MONGODB_URI) return;
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  usersCollection = mongoClient.db("multiplication_kingdom").collection("users");
}

function readFileDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (e) {
    return { users: [] };
  }
}

function writeFileDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
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
    createdAt: now,
    updatedAt: now
  };
}

function cleanUser(user) {
  if (!user) return user;
  const { _id, ...rest } = user;
  return rest;
}

// ===== 同学登录（班级 + 姓名，无密码）=====
app.post("/api/login", async (req, res) => {
  const className = String(req.body.className || "").trim();
  const name = String(req.body.name || "").trim();
  if (!className || !name) {
    return res.status(400).json({ error: "请填写班级和姓名" });
  }

  try {
    let user;
    if (usersCollection) {
      user = await usersCollection.findOne({ className, name });
      if (!user) {
        user = defaultUser(className, name);
        await usersCollection.insertOne(user);
      } else {
        user.updatedAt = new Date().toISOString();
        await usersCollection.updateOne({ id: user.id }, { $set: { updatedAt: user.updatedAt } });
      }
    } else {
      const db = readFileDB();
      user = db.users.find(u => u.className === className && u.name === name);
      if (!user) {
        user = defaultUser(className, name);
        db.users.push(user);
        writeFileDB(db);
      } else {
        user.updatedAt = new Date().toISOString();
        writeFileDB(db);
      }
    }
    res.json({ ok: true, user: cleanUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ===== 保存同学数据 =====
app.put("/api/users/:id", async (req, res) => {
  const allowed = ["stars", "coins", "bestCombo", "pets", "food", "scores", "mistakes", "completedChallenges"];
  const updateData = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updateData[key] = req.body[key];
  }
  updateData.updatedAt = new Date().toISOString();

  try {
    let user;
    if (usersCollection) {
      const result = await usersCollection.updateOne({ id: req.params.id }, { $set: updateData });
      if (result.matchedCount === 0) return res.status(404).json({ error: "用户不存在" });
      user = await usersCollection.findOne({ id: req.params.id });
    } else {
      const db = readFileDB();
      user = db.users.find(u => u.id === req.params.id);
      if (!user) return res.status(404).json({ error: "用户不存在" });
      Object.assign(user, updateData);
      writeFileDB(db);
    }
    res.json({ ok: true, user: cleanUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ===== 管理员：删除同学 =====
app.delete("/api/users/:id", async (req, res) => {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "管理员验证失败" });
  }
  try {
    if (usersCollection) {
      await usersCollection.deleteOne({ id: req.params.id });
    } else {
      const db = readFileDB();
      db.users = db.users.filter(u => u.id !== req.params.id);
      writeFileDB(db);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ===== 管理员：查看所有同学 =====
app.get("/api/admin/students", async (req, res) => {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "管理员验证失败" });
  }
  try {
    const className = String(req.query.class || "").trim();
    const query = className ? { className } : {};
    let users;
    if (usersCollection) {
      users = await usersCollection.find(query).sort({ coins: -1, stars: -1 }).toArray();
    } else {
      const db = readFileDB();
      users = db.users.filter(u => !className || u.className === className);
      users.sort((a, b) => b.coins - a.coins || b.stars - a.stars);
    }
    res.json({ ok: true, users: users.map(cleanUser) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ===== 管理员：导出 CSV =====
app.get("/api/admin/export.csv", async (req, res) => {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "管理员验证失败" });
  }
  try {
    const className = String(req.query.class || "").trim();
    const query = className ? { className } : {};
    let users;
    if (usersCollection) {
      users = await usersCollection.find(query).toArray();
    } else {
      const db = readFileDB();
      users = db.users.filter(u => !className || u.className === className);
    }

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
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", "attachment; filename=students.csv");
    res.send("\uFEFF" + lines.join("\r\n"));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ===== 管理员：导出 JSON =====
app.get("/api/admin/export.json", async (req, res) => {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "管理员验证失败" });
  }
  try {
    let users;
    if (usersCollection) {
      users = await usersCollection.find({}).toArray();
    } else {
      users = readFileDB().users;
    }
    res.json({ ok: true, users: users.map(cleanUser) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "服务器错误" });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

// 启动
await connectMongo();
if (usersCollection) {
  console.log("已连接 MongoDB 数据库");
} else {
  console.log("未配置 MongoDB，使用本地 data.json 保存数据");
}
app.listen(PORT, () => {
  console.log(`九九乘法小王国服务已启动: http://localhost:${PORT}`);
});
