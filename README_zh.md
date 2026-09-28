# 🐉 DragonCard

> **DragonCard 不是 Anki。** — [English README](README.md)

它没有复杂的间隔重复算法，只有一种很简单的分类学习方法——把知识快速呈现在你面前：标记未掌握的内容，掌握靠前，难点靠前，仅此而已。

记忆的本质从来不是技巧，而是**重复**。艾宾浩斯用一生证明：记忆的关键就是重复。所以我们相信的是你——你的坚持本身。持之以恒，必有收获。

大脑是一个极其擅长偷懒的器官。当你长期坚持做同一件事，它不会一直停留在最初吃力的状态，而会逐渐演变成一件越来越省力的事。DragonCard 利用的，正是这个机制——它提供的不是魔法，而是一个简单的容器：**你把知识放进去，然后把"重复"这件最朴素的事，交给每天都来的自己。**

### DragonCard vs Anki

| 维度 | Anki | DragonCard |
|------|------|------------|
| 调度单元 | 单张卡片独立计算下次复习时间 | 完整有序列表为单元，靠排序实现优先级 |
| 时间约束 | 严格日期驱动 | 弹性，什么时候继续、间隔多久由使用者决定 |
| 熟词处理 | 达标后降低复习频率，甚至退出复习池 | 全程保留在列表尾部，轻量刷一遍维持记忆 |
| 优势 | 理论记忆效率上限更高 | 流程简单稳定、断卡后更容易续上、保留词条上下文顺序 |
| 短板 | 任务量不可控，断卡后维护成本高 | 不会精准在遗忘临界点触发复习，单条记忆效率理论上限略低 |

> 更多理念详见应用内「使用文档」开篇。

---

## ✨ 功能特性

- **Zip 小工具系统**：每个卡组绑定一个自包含的 H5 小工具（`index.html` + `manifest.json` + `assets/`），数据 / 展示 / 交互完全解耦——卡片长什么样、怎么交互，全由小工具决定，框架只提供"货架"
- **cardAPI 桥接**：小工具通过 `window.cardAPI`（getPage / mark / favorite / track / playAudio）读取数据、标记未知 / 收藏、上报埋点
- **语言感知 TTS**：小工具声明 `lang`，发音自动选择对应语言的语音，语音按语言分组记忆
- **中英双语界面**：一键切换中/EN，全界面（含内置文档）实时刷新
- **分类卡组**：语言 / 知识 / 逻辑 / 技能 / 其它 五种类型，各有专属图标与配色
- **简单的学习引擎**：标记未掌握 → 重排 → 多轮学习，进度自动持久化
- **统计与成就**：活动热力图、掌握分布、轮次金字塔、称号与成就系统
- **数据导入导出**：JSON 导入（按 item_order 对齐覆盖），JSON 导出
- **本地优先**：SQLite 存储，开箱即用，无需外部服务

## 🚀 快速开始

### 环境要求

- Python 3.9+
- 现代浏览器（Chrome / Edge / Safari，需支持 Web Speech API）

### 安装与启动

**一键启动（推荐）：**

```bash
cd dragoncard
./start.sh        # macOS / Linux
start.bat         # Windows
```

或手动：

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

浏览器访问 <http://localhost:5001>（端口可在 `app.py` 末尾修改）。

首次启动会自动创建数据库表、默认用户 `default`。

### 首次使用

1. （可选）导入内置免费卡组：`python seed_decks.py`（每个卡组已自带 `tool.zip`）
2. 点击「新建卡组」，填写名称并选择类型
3. 进入卡组 → 「管理卡组」→ 在工具卡上传该卡组的小工具 zip（绑定），在数据卡上传数据（JSON）
4. 返回目录点击卡组 → 打开绑定的小工具（全屏新标签页）开始学习

> 本地 AI 助手（如 Claude Code / Cursor / opencode）可运行与扩展本项目；
> 面向 AI 的指引见 `AGENTS.md`。内置免费卡组通过 `python seed_decks.py` 导入（幂等）。

## 🎪 在线商店

在线演示与精品卡组商店：[**dragoncard.top**](https://dragoncard.top/)（备用：[dragon-memory-market.pages.dev](https://dragon-memory-market.pages.dev/)）

- **交互演示**：样卡发音、标记、3D 预览，浏览器直接体验
- **精品卡组**：预制 AI 辅助精校卡组，**一次性购买**（无订阅）

## 📦 精品卡组

精品小工具/数据包为一次性付费内容，详见商店。购买后获得 `tool.zip` + `cards.json`，在应用内导入即可：**管理卡组 → 上传 zip（绑定小工具）→ 上传数据**。

> 详细操作见应用内「使用文档」（侧边栏进入，支持中英切换）。

## 🧩 自定义小工具

**小工具（Tool）** 是绑定到卡组、打开即全屏运行的自包含离线 H5 包：

```
my-tool/
├── index.html     # 入口（必需）
├── manifest.json  # 元信息
└── assets/        # 自包含资源（css / js / 图片，不联网）
```

**manifest.json** 声明 `name`、`lang`、`description`、`fields`、`trackedActions`（≤5）与可选 `icon`。

小工具通过 **`window.cardAPI`**（注入在工具 `<head>`）读取数据与上报进度：

| 方法 | 说明 |
|------|------|
| `getPage(page, size)` | 分页取卡（含 `is_unknown` / `is_favorite` / `current_order`） |
| `mark(itemId, isUnknown)` | 标记未知（true / false） |
| `favorite(itemId, fav)` | 收藏 / 取消 |
| `track(action, itemId)` | 上报埋点（**必须带 itemId**，用已声明动作） |
| `playAudio(text)` | TTS 朗读 |
| `finish()` | 结束 |

> 开发小工具请使用 **dragoncard-tool-builder** skill
> （`dragoncard_tools/.skill/dragoncard-tool-builder/`）；完整规范见
> `dragoncard_tools/TOOL_PACK.md`。用 `dragoncard_tools/build.py` 打包 → `dist/*.zip`。

## 🏗️ 技术架构

```
用户提供 ──→  tool.zip (index.html + manifest.json + assets/)
                    │
DragonCard ──→  全屏托管小工具 (/v1/tools/<id>/run)，注入 window.cardAPI
               数据分页 / 进度 / 学习轮次保持不变
```

DragonCard 不决定卡片长什么样、怎么交互——这些全由绑定的小工具定义。框架只提供"货架"（学习引擎 + 后端接口：数据、进度、事件）。

### 技术栈

- **后端**：Flask + SQLAlchemy + SQLite
- **前端**：原生 JS 单页应用 + Tailwind CSS（本地 Play CDN）+ Font Awesome
- **数据导入**：JSON（按 item_order 对齐覆盖更新）

### 项目结构

```
dragoncard/
├── app.py                     # Flask 入口 + 所有 API 路由（启动自动建表 + 默认用户）
├── models.py                  # SQLAlchemy 模型 (7 张表)
├── config.py                  # 配置
├── seed_decks.py              # 导入内置免费卡组（tool.zip + cards.json）
├── requirements.txt
├── DB_relation.md             # 数据库关系说明
├── FOLLOWUP.md                # 模板→工具迁移待办清单
├── README.md / README_zh.md
│
├── default_cards/             # 内置卡组包（tool.zip + cards.json + meta.json）
│   ├── english_coca20000/      # COCA20000 词卡（coca-cards 小工具）
│   ├── english_phonetics/      # 音标拼读（english-phonetics 小工具）
│   ├── japanese_gojuon/        # 日语五十音图
│   ├── yijing/ + prelude_yijing/  # 周易（一 zip 双卡组）
│   ├── checkin_log/            # 星际航行日志（Voyage Log，按天多任务打卡）
│   ├── chinese_hsk/ chinese_idiom/ chinese_measure_words/ chinese_radicals/
│   ├── chemistry_periodic/ stratagems_36/ western_allusions/ history_chenyu/
│   ├── dino_alphabet/ dinosaur_3d/ english_sentence_patterns/
│   ├── english_irregular_verbs/ reading_card/ ...
│
├── templates/
│   └── index.html             # SPA 主页面
│
└── static/
    ├── media/                 # 本地多媒体资源（3D 模型等）
    ├── app.js                 # 框架 JS (小工具加载/学习引擎/国际化)
    ├── i18n.js                # 中英文案字典
    ├── docs.js                # 内置使用文档（中英双语）
    ├── styles.css             # 框架 UI 样式
    └── vendor/                # 本地依赖 (Tailwind / Font Awesome)
```

小工具源码在独立的 **`dragoncard_tools/`** 工程（build.py → `dist/*.zip`，`TOOL_PACK.md`，`.skill/dragoncard-tool-builder/`）。

## 🔌 API 概览

| 模块 | 路径 | 说明 |
|------|------|------|
| 用户 | `GET /v1/users`、`POST /v1/users/login` | 用户列表 / 登录创建 |
| 工具绑定 | `POST /v1/decks/:id/tool`、`DELETE /v1/decks/:id/tool` | 绑定 / 解绑小工具 zip |
| 工具 | `POST /v1/tools/:id/replace`、`GET /v1/tools/:id/export` | 重新上传 / 下载小工具 |
| 工具 | `GET /v1/tools/:id/run`、`GET /v1/tools/:id/assets/<path>` | 全屏运行小工具 / 静态资源 |
| 卡组 | `GET/POST /v1/decks`、`GET/PUT/DEL /v1/decks/:id` | 卡组 CRUD |
| 数据 | `GET /v1/decks/:id/items`、`POST /v1/decks/:id/import`、`GET /v1/decks/:id/export` | 数据列表 / 导入 / 导出 |
| 学习 | `GET /v1/learn/info`、`GET /v1/learn/page` | 学习统计 / 分页卡片（cardAPI） |
| 学习 | `POST /v1/learn/mark`、`POST /v1/learn/favorite` | 标记 / 收藏 |
| 学习 | `POST /v1/reorder`、`GET /v1/rounds` | 轮回 / 轮次 |
| 观测 | `POST /v1/observability/events` | 事件上报（批量，cardAPI.track） |
| 观测 | `GET /v1/observability/actions`、`GET /v1/observability/data` | 动作类型 / 统计数据 |
| 成就 | `GET /v1/achievements` | 成就数据 |

工具访问须通过绑定校验：`/v1/learn/page`、`/v1/learn/mark`、`/v1/learn/favorite`、`/v1/observability/events` 在 `tool_id` 与卡组不匹配时返回 403 / 丢弃事件。

## 📚 文档索引

| 文档 | 用途 |
|------|------|
| [`DB_relation.md`](./DB_relation.md) | 数据库表结构与关系 |
| [`AGENTS.md`](./AGENTS.md) | 面向 AI 编码代理的指引 |
| 应用内「小工具 API 参考」 | 小工具格式与 cardAPI 契约（主页顶栏 `</>` 按钮） |
| 应用内「使用文档」 | 面向最终用户的操作指南（中英双语） |
| `dragoncard_tools/TOOL_PACK.md` | 小工具包发布规范 |
| `.skill/dragoncard-tool-builder/` | 小工具构建 skill（供 AI 代理使用） |

## 📝 License

Built with ❤️