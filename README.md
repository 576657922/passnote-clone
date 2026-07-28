# Passnote Clone · 日本 IT 资格考试练习平台

passnote.app 的功能复刻版：IT パスポート / 基本情報技術者 / 情報セキュリティマネジメント / 応用情報技術者 的刷题平台。**无会员系统，注册登录后即可使用全部功能。**

🔗 **在线体验**：<LIVE_URL>（Render 免费档，闲置后首次访问有 ~30 秒冷启动；题库/术语始终在线，用户账号与进度在实例休眠后会重置）

> ⚠️ 题库说明：原站的 8,095 道 IPA 真题和 1,074 条术语是其数据资产，本项目未抓取。内置的 62 道题、58 条术语为**原创示例内容**（IPA 真题风格），用于完整跑通所有功能。扩充方式见下文。

## 功能清单

**免登录**
- 落地页（统计、考试卡片、术语预览、免登录 5 题体验）
- 术语表（分类筛选 / 搜索 / 术语详情 + 出题例）

**注册登录后（全部免费）**
- 按年度场次刷题、随机小练（按考试 / 领域 / 题数筛选）
- 服务端判题 + 中日双语解析 + 关联术语跳转 + 进度云端同步（跨设备）
- ✦ 逐题 AI 解析（日语 / 中文 / 英语，结果缓存进数据库）
- 💬 AI 学习搭子「トモ」（全站浮窗，多轮聊天，可关联当前题目）
- ⏱ 本番形式模拟考试（限时、题号导航、1000 分制、领域别成绩、合格判定、历史成绩）
- 🔁 复习模式（错题重做 + 术语记忆卡，带简化间隔重复）
- 📊 学习统计仪表盘（累计作答、正确率、连续天数、14 天活动图、分领域正确率、题库进度）

## 快速开始

```bash
cd ~/Dev/projects/passnote-clone
npm install          # 安装依赖（无原生编译依赖，用的是 Node 内置 SQLite）
npm run setup        # 生成种子数据 + 构建前端
npm start            # 启动 → http://localhost:5170
```

要求 Node.js ≥ 22（数据库用了内置 `node:sqlite`，启动时的 ExperimentalWarning 可忽略）。

### 启用真实 AI（解析 + トモ）

不配置也能用：AI 解析会回退到内置解析，トモ会提示如何配置。要启用真实 AI：

```bash
export ANTHROPIC_API_KEY=sk-ant-xxxx    # 你的 Anthropic API key
npm start
```

- 默认模型 `claude-opus-4-8`，可用 `ANTHROPIC_MODEL` 环境变量改
- 每题每语言的解析只生成一次，之后从缓存读取（省钱）

### 开发模式（前端热更新）

```bash
npm run dev          # 后端 5170 + Vite 5173，浏览器开 http://localhost:5173
```

## 部署到 Render（免费）

仓库已含 `render.yaml`（Blueprint），一键读取配置：

1. 打开 <https://dashboard.render.com/blueprints> → **New Blueprint Instance**
2. 连接本 GitHub 仓库（`576657922/passnote-clone`，私有仓库需先授权 Render 访问）
3. Render 自动读取 `render.yaml` → 点 **Apply** 开始构建（`npm install && npm run setup`）
4. （可选）在服务的 **Environment** 里填 `ANTHROPIC_API_KEY` 启用真实 AI；不填也能跑
5. 构建完成后拿到 `https://passnote-clone-xxxx.onrender.com`

> 免费档说明：无持久磁盘、闲置 15 分钟休眠。题库/术语在构建时 seed 进镜像，冷启动后始终存在；用户注册的账号与答题进度存于运行时文件，实例休眠/重部署后会重置——适合作为 demo 现场体验。需要长期留存用户数据时，升级 Render 付费档挂载磁盘，或改用带持久卷的平台（Fly.io 等）。

## 体验路径建议

1. 打开首页 → 直接做「免登录 5 题体验」
2. 注册账号（任意邮箱格式即可，本地不发验证邮件）
3. 练习 → 随机小练 → 点「生成 AI 解析」（日/中/英切换）、右下角找トモ聊天
4. 模拟考试 → 交卷看领域别成绩
5. 复习 → 错题重做 + 术语记忆卡
6. 统计 → 查看仪表盘

## 扩充题库

编辑 `server/seed.js`，按 `questions` 数组的字段格式追加：

```js
{ s: 'ip-2024r06',        // 场次代码（可在 sessions 数组里加新场次）
  n: 13,                  // 题号
  d: 'technology',        // strategy / management / technology
  t: '题干（日语）',
  c: ['选项ア', '选项イ', '选项ウ', '选项エ'],
  a: 1,                   // 正解下标 0-3
  e: '日语解析', ez: '中文解析',
  tm: ['dram'],           // 关联术语 slug（可空）
  trial: 1 }              // 可选：标记为免登录体验题
```

然后重新 `npm run seed`（会重建数据库，账号和进度会清空）。

## 技术栈与结构

```
server/
  db.js       # node:sqlite 数据库 + 建表（用户/会话/考试/题目/术语/作答/模拟考/AI缓存/术语卡）
  seed.js     # 种子数据（4 门考试、6 场次、62 题、58 术语）
  index.js    # Express：认证(scrypt+cookie)、判题、模拟考、复习、统计、术语表
  ai.js       # @anthropic-ai/sdk：逐题解析（三语+缓存）、トモ聊天、无 key 回退
web/src/
  App.jsx     # 路由 + 登录态 + トモ浮窗
  components/ # QuestionCard（判题/AI解析/术语chip）、TomoChat
  pages/      # Landing / Exams / SessionPractice / Practice / Mock / Review / Glossary / TermDetail / Dashboard / Auth
```

- 数据库文件：`data/passnote.db`（删掉后重新 seed 即可重置）
- 端口：生产 5170，可用 `PORT` 环境变量改

## 已验证

- API 级 E2E：10 项全通过（未登录 401 → 注册 → 判题 / AI解析 / トモ / 模拟考 / 复习 / 统计全部注册即用）
- 浏览器级 E2E（Playwright）：全通过，确认页面无会员残留、AI 解析无弹窗直接生成

## 后续可做

- Google OAuth 登录（登录页已留按钮位）
- 从 IPA 官网 PDF 批量导入真题（注意版权：转载需按 IPA 规定标注出典）
