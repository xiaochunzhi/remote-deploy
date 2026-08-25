# 九九乘法小王国 - Cloudflare 免费部署

国内手机不需要 VPN 也可以访问（Cloudflare 的 pages.dev 国内一般可直连）。

## 文件说明
- `public/` 学生端 + 管理后台页面
- `functions/api/[[path]].js` 后端 API（Cloudflare Pages Functions）
- `wrangler.toml` 本地开发配置

## 部署步骤

### 1. 注册 Cloudflare
打开 https://dash.cloudflare.com 注册账号。

### 2. 创建 KV 命名空间（保存数据）
1. 进入 Cloudflare 控制台
2. 左侧菜单：Workers & Pages → KV
3. 点 **Create a namespace**
4. 名称填：`MULTIPLICATION_KV`
5. 创建后复制 **Namespace ID**

### 3. 部署 Pages 项目
方式一：用 Wrangler 命令行
```bash
cd cloudflare
npm install -g wrangler
wrangler login
wrangler pages deploy public --project-name=multiplication-kingdom
```

方式二：直接在网页上传
1. 打开 Workers & Pages → Create → Pages → Upload assets
2. 上传 `public` 文件夹内容
3. 然后在项目 Settings → Functions → KV namespace bindings
   - Variable name：`MULTIPLICATION_KV`
   - KV namespace：选择刚创建的 `MULTIPLICATION_KV`
4. 再在 Settings → Environment variables 添加：
   - `ADMIN_TOKEN` = 你自己设置的管理员密码

### 4. 部署 Functions
如果用网页上传静态文件，Functions 需要单独上传：
- 把 `functions` 文件夹一起放在项目根目录，然后使用 `wrangler pages deploy .` 部署整个项目
- 推荐直接用 Wrangler 命令部署整个 `cloudflare` 文件夹

### 5. 访问
部署完成后会得到：
```
https://<project-name>.pages.dev
```

- 学生端：`https://<project-name>.pages.dev/`
- 管理后台：`https://<project-name>.pages.dev/admin.html`
- 管理员口令：你在 `ADMIN_TOKEN` 里设置的值，默认 `admin123`

## 本地测试
```bash
cd cloudflare
npx wrangler pages dev public --kv MULTIPLICATION_KV
```
