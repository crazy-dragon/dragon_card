# 🐉 DragonCard

**DragonCard 不是 Anki。**

它没有复杂的间隔重复算法，只有一种很简单的分类学习方法——把知识快速呈现在你面前：标记未掌握的内容，掌握靠前，难点靠前，仅此而已。

记忆的本质从来不是技巧，而是**重复**。艾宾浩斯用一生证明：记忆的关键就是重复。所以我们相信的是你——你的坚持本身。持之以恒，必有收获。

大脑是一个极其擅长偷懒的器官。当你长期坚持做同一件事，它不会一直停留在最初吃力的状态，而会逐渐演变成一件越来越省力的事。DragonCard 利用的，正是这个机制——它提供的不是魔法，而是一个简单的容器：**你把知识放进去，然后把"重复"这件最朴素的事，交给每天都来的自己。**

> 更多理念详见应用内「使用文档」开篇。

---

## ✨ 功能特性

- **三层模板系统**：数据 / 样式 / 交互完全解耦，一个 JSON 模板文件定义卡片的一切
- **语言感知 TTS**：模板声明 `lang`，发音自动选择对应语言的语音，语音按语言分组记忆
- **中英双语界面**：一键切换中/EN，全界面（含内置文档）实时刷新
- **分类卡组**：语言 / 知识 / 逻辑 / 技能 / 其它 五种类型，各有专属图标与配色
- **简单的学习引擎**：标记未掌握 → 重排 → 多轮学习，进度自动持久化
- **统计与成就**：活动热力图、掌握分布、轮次金字塔、称号与成就系统
- **数据导入导出**：JSON / Excel 导入，JSON 导出，模板删除自动备份
- **模板预览**：管理面板内实时预览卡片渲染效果，支持字段隐藏勾选
- **本地优先**：SQLite 存储，开箱即用，无需外部服务

## 🚀 快速开始

### 环境要求

- Python 3.9+
- 现代浏览器（Chrome / Edge / Safari，需支持 Web Speech API）

### 安装与启动

```bash
cd dragoncard
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

浏览器访问 <http://localhost:5001>（端口可在 `app.py` 末尾修改）。

首次启动会自动创建数据库表、默认用户 `default`，并准备一套默认模板。

### 首次使用

1. 点击「新建卡组」，填写名称并选择类型
2. 进入卡组 → 「管理卡组」→ 在模板区上传模板文件（JSON）
3. 在数据区上传数据文件（JSON 或 Excel）
4. 返回目录，点击页码开始学习

## 🎪 在线 Demo

`demo/` 目录是一个**独立可交互的静态演示**，可在 GitHub Pages 等纯静态环境部署（无需后端）。

```bash
# 本地预览（需 HTTP 服务，file:// 打开会因 fetch JSON 失败）
cd demo
python3 -m http.server 8888
# 访问 http://localhost:8888
```

Demo 包含：
- `index.html`：理念介绍（简单·不强迫·慢慢来）+ 3 个示例卡组交互演示 + 商店入口
- `store.html`：独立模板商店页，展示付费模板/数据包，点击跳转 Gumroad 购买
- 卡片交互：发音（浏览器 TTS）、标记、收藏、左右切换
- 中/EN 语言切换
- 前端库使用 CDN 加载（公网场景；本地应用则用 `static/vendor/` 离线加载）

部署到 GitHub Pages 时，将 `demo/` 目录内容作为站点根目录即可。

## 📦 模板发布

付费模板/数据包通过 **Gumroad** 分发，展示页为 demo 站的 `store.html`。

- 模板包轻量格式见 [`TEMPLATE_PACK.md`](./TEMPLATE_PACK.md)
- 商品数据配置在 `demo/data/store-data.json`（名称/描述/价格/Gumroad 链接/预览图）
- 购买后分别导入：管理卡组 → 上传模版（template.json）→ 上传数据（cards.json）

> 详细操作见应用内「使用文档」（侧边栏进入，支持中英切换）。

## 🎴 自定义模板

DragonCard 的核心是模板。模板是一个自包含的 JSON 文件：

```json
{
  "name": "My Card",
  "lang": "en",
  "description": "...",
  "cardHtml": "<div class=\"word-card\" data-card-id=\"{{id}}\">...</div>",
  "cardCss": ".word-card { ... }",
  "cardJs": "(function(){ 'use strict'; window.cardTemplate = {...}; })();",
  "sampleData": [ { "word": "hello" } ],
  "trackedActions": [
    { "action": "audio_play", "label": "发音" },
    { "action": "word_mark", "label": "标记" }
  ]
}
```

- **HTML / CSS / JS**：定义卡片结构、样式（支持 Tailwind 工具类 + Font Awesome 图标 + 项目 CSS 变量）、交互（`window.cardTemplate` 的 `render` / `init` / `update`）
- **lang**：发音语言（`en` / `ja` / `zh` …）
- **trackedActions**：观测埋点声明（最多 5 个）
- **sampleData**：预览示例数据

> 模板的详细格式、`window.cardTemplate` 契约与 api 方法，可在应用内主页顶栏的「模板 API 参考」弹窗中查看。

## 🏗️ 技术架构

```
用户提供 ──→  template.json (HTML + CSS + JS + lang + trackedActions)
                    │
DragonCard ──→  加载模板 → 渲染卡片 → 注入 api 对象
               学习引擎 (标记/重排/分页) 保持不变
```

DragonCard 不决定卡片长什么样、怎么交互——这些全由模板定义。框架只提供"货架"（学习流程 + 后端接口）。

### 技术栈

- **后端**：Flask + SQLAlchemy + SQLite
- **前端**：原生 JS 单页应用 + Tailwind CSS（本地 Play CDN）+ Font Awesome
- **数据导入**：openpyxl（Excel）、JSON

### 项目结构

```
dragoncard/
├── app.py                     # Flask 入口 + 所有 API 路由（启动自动建表 + 默认用户）
├── models.py                  # SQLAlchemy 模型 (8 张表)
├── config.py                  # 配置
├── requirements.txt
├── DB_relation.md             # 数据库关系说明
├── README.md
├── TEMPLATE_PACK.md           # 模板包发布规范（Gumroad 分发）
├── ui_design.md               # UI 界面设计文档
│
├── default_templates/         # 内置模板源（通过页面「上传模板」导入到数据库）
│   ├── english_coca20000/
│   ├── chinese_idiom/
│   ├── history_chenyu/
│   ├── japanese_gojuon/
│   ├── prelude_yijing/
│   ├── yijing/
│   ├── english_word_simple/
│   ├── dino_alphabet/
│   └── dinosaur_3d/
│
├── demo/                      # 独立可交互静态演示（GitHub Pages 可部署）
│   ├── index.html
│   ├── assets/
│   └── data/
│
├── templates/
│   └── index.html             # SPA 主页面
│
└── static/
    ├── media/                 # 本地多媒体资源（3D 模型等）
    ├── app.js                 # 框架 JS (模板加载/学习引擎/国际化)
    ├── i18n.js                # 中英文案字典
    ├── docs.js                # 内置使用文档（中英双语）
    ├── styles.css             # 框架 UI 样式
    └── vendor/                # 本地依赖 (Tailwind / Font Awesome)
```

## 🔌 API 概览

| 模块 | 路径 | 说明 |
|------|------|------|
| 用户 | `GET /v1/users`、`POST /v1/users/login` | 用户列表 / 登录创建 |
| 模板 | `GET/POST /v1/templates`、`GET/PUT/DEL /v1/templates/:id` | 模板 CRUD |
| 模板 | `POST /v1/templates/import`、`GET /v1/templates/:id/export` | 模板导入 / 导出 |
| 模板 | `GET /v1/templates/:id/preview` | 模板预览数据 |
| 卡组 | `GET/POST /v1/decks`、`GET/PUT/DEL /v1/decks/:id` | 卡组 CRUD |
| 卡组 | `POST /v1/decks/:id/templates`、`PUT /v1/decks/:id/active-template` | 绑定模板 / 设当前模板 |
| 卡组 | `GET /v1/decks/:id/preview`、`GET /v1/decks/:id/mastery` | 卡组预览 / 掌握统计 |
| 数据 | `GET /v1/decks/:id/items`、`POST /v1/decks/:id/import` | 数据列表 / 导入 |
| 数据 | `POST /v1/decks/:id/import-excel`、`GET /v1/decks/:id/export` | Excel 导入 / 导出 |
| 学习 | `GET /v1/learn/info`、`GET /v1/learn/page` | 学习统计 / 分页卡片 |
| 学习 | `POST /v1/learn/mark`、`POST /v1/learn/favorite` | 标记 / 收藏 |
| 学习 | `POST /v1/reorder`、`GET /v1/rounds` | 重新打乱 / 轮次 |
| 观测 | `POST /v1/observability/event`、`POST /v1/observability/events` | 事件上报（单条 / 批量） |
| 观测 | `GET /v1/observability/actions`、`GET /v1/observability/data` | 动作类型 / 统计数据 |
| 成就 | `GET /v1/achievements` | 成就数据 |

## 📚 文档索引

| 文档 | 用途 |
|------|------|
| [`DB_relation.md`](./DB_relation.md) | 数据库表结构与关系 |
| [`ui_design.md`](./ui_design.md) | UI 界面设计文档 |
| 应用内「模板 API 参考」 | 模板格式与 `window.cardTemplate` 契约（主页顶栏 `</>` 按钮） |
| 应用内「使用文档」 | 面向最终用户的操作指南（中英双语） |

## 📝 License

Built with ❤️
