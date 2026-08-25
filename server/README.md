# 🎈 九九乘法小王国 - 远程版

这是一个带后端服务的远程版：
- 同学使用 **班级 + 姓名** 登录，不需要密码
- 星星、金币、宠物、粮食、答题记录都保存到远程数据库
- 超级管理员可以查看全班数据，并导出 CSV / JSON

## 本地运行

```bash
cd server
npm install
npm start
```

打开浏览器访问：
- 学生端：http://localhost:3000/
- 管理员端：http://localhost:3000/admin.html
- 默认管理员口令：`admin123`（可通过环境变量 `ADMIN_TOKEN` 修改）

## 免费部署方案（推荐）

使用 **Render / Railway 等免费平台 + MongoDB Atlas 免费数据库**。

### 1. 创建免费 MongoDB
1. 打开 https://www.mongodb.com/cloud/atlas 注册
2. 创建免费集群 `M0`
3. 创建数据库用户和密码
4. 获取连接串，例如：
   ```
   mongodb+srv://用户名:密码@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### 2. 部署到 Render
1. 把本项目推到 GitHub
2. 在 Render 创建 **Web Service**
3. 选择仓库，Build 命令填：
   ```
   cd server && npm install
   ```
4. Start 命令填：
   ```
   cd server && npm start
   ```
5. 添加环境变量：
   - `MONGODB_URI` = 你的 MongoDB 连接串
   - `ADMIN_TOKEN` = 你自己设置的管理员口令
6. 部署完成后，访问：
   - 学生端：`https://你的服务名.onrender.com/`
   - 管理员端：`https://你的服务名.onrender.com/admin.html`

### 3. 如果没有配置 MongoDB
- 服务会使用本地 `server/data.json` 保存数据
- 适合本地测试
- 在部分免费平台上文件系统不是永久的，重启后数据可能丢失
- **正式使用请配置 MongoDB Atlas**

## 管理员功能
- 打开 `/admin.html`
- 输入管理员口令
- 查看所有同学：
  - 班级、姓名、星星、金币、宠物数量
  - 答题正确/错误次数
  - 最近登录时间
- 按班级筛选
- 导出 CSV / JSON

## 环境变量
| 变量 | 说明 |
| --- | --- |
| `PORT` | 服务端口，默认 3000 |
| `MONGODB_URI` | MongoDB 连接串，不填则使用本地 JSON |
| `ADMIN_TOKEN` | 管理员口令，默认 `admin123` |
