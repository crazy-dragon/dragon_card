# DragonCard 数据库关系说明

## 概述

DragonCard 使用 SQLite + SQLAlchemy，共 **9 张表**。核心设计思路：

> **Deck（卡组）= 数据源（cards.json）+ 绑定小工具（tool.zip）**

用户创建卡组，导入数据并上传一个 zip 小工具绑定到卡组（`Deck.tool_id`）。进入卡组 = 打开绑定工具的全屏新标签页；工具通过 `window.cardAPI` 读取分页数据、标记未知/收藏、上报埋点。系统跟踪学习进度、记录交互事件。

```
User ──┬── Deck ────── Tool          (卡组绑定一个 zip 工具，Deck.tool_id)
       │   │
       │   ├── DeckItem × N           (卡组包含多条数据)
       │   │
       │   ├── Progress × N           (每条数据的学习进度)
       │   │
       │   ├── StudyRound × N         (每轮重排记录)
       │   │
       │   └── LearningEvent × N      (交互事件日志)
       │
       └── Tool × N                   (用户上传的 zip 工具，文件系统 minitools/<id>/)
```

迁移期保留（模板渲染已不用，待清理）：`t_template` / `t_deck_template` / `t_deck.active_template_id`。

## 表结构详解

### t_user — 用户

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| username | String(50) | UNIQUE, NOT NULL | 用户名 |
| display_name | String(100) | nullable | 显示名（缺省回退到 username） |
| created_at | DateTime | default now | 创建时间 |
| updated_at | DateTime | onupdate now | 更新时间 |

应用启动时自动创建 `default` 用户（`_ensure_default_user()`）。本地单用户场景下一般只有这一个。

---

### t_tool — 小工具（zip 工具）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| user_id | Integer | FK → t_user.id, nullable | 上传用户 |
| name | String(100) | NOT NULL | 工具名（取自 manifest.name） |
| description | Text | nullable | 工具描述（manifest.description） |
| icon | String(255) | default '' | 工具图标（manifest.icon，相对工具目录的路径） |
| lang | String(10) | default 'zh' | 语言（manifest.lang，BCP47） |
| dir_path | String(255) | NOT NULL | 工具目录（`minitools/<id>/`，文件系统） |
| manifest_json | Text | nullable | 完整 manifest 原文（JSON 字符串） |
| tracked_actions | Text | nullable | 观测埋点声明（JSON 数组 `[{action}]`，最多 5 个） |
| created_at | DateTime | default now | |
| updated_at | DateTime | onupdate now | |

工具是自包含的 H5 包（`index.html` + `manifest.json` + `assets/`），打包成 zip 后管理页上传绑定。文件系统 `minitools/<id>/` 存工具源码，DB 只存元数据（`dir_path`）。

---

### t_deck — 卡组

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| user_id | Integer | FK → t_user.id, NOT NULL | 所属用户 |
| name | String(100) | NOT NULL | 卡组名称 |
| kind | String(20) | default 'other' | 类型：language / knowledge / logic / skill / other |
| tool_id | Integer | FK → t_tool.id, nullable | 绑定的 zip 工具 |
| active_template_id | Integer | FK → t_template.id, nullable | （迁移期）旧模板字段，待清理 |
| created_at | DateTime | default now | |
| updated_at | DateTime | onupdate now | |

`tool_id` 可空，支持"先创建卡组、后上传工具绑定"的流程。`to_dict()` 计算 `has_tool`、`has_data`、`item_count`、`mastered_count`、`round_count` 等派生字段，并返回工具名/描述/图标（`tool_name`、`tool_description`、`tool_icon`）。

---

### t_deck_template — 卡组-模板关联（迁移期）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| deck_id | Integer | FK → t_deck.id, **PK** | 卡组 |
| template_id | Integer | FK → t_template.id, **PK** | 模板 |
| sort_order | Integer | default 0 | 排序 |

旧模板时代的关联表，模板渲染已不用，待清理（备份后 DROP）。

---

### t_template — 模板（迁移期）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| user_id | Integer | FK → t_user.id, nullable | 所属用户 |
| name | String(100) | NOT NULL | 模板名称 |
| description | Text | nullable | 描述 |
| lang | String(10) | default 'en' | TTS 语音语言（BCP47） |
| card_html / card_css / card_js | Text | default '' | 卡片三件套（定义 `window.cardTemplate`） |
| sample_data | Text | nullable | 预览用示例数据 |
| tracked_actions | Text | nullable | 观测埋点声明 |
| created_at / updated_at | DateTime | | |

旧模板时代的卡片渲染定义。已被 zip 工具替代，数据保留（迁移期），待清理。

---

### t_deck_item — 卡组条目（单条数据）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| deck_id | Integer | FK → t_deck.id, NOT NULL | 所属卡组 |
| item_order | Integer | NOT NULL | 排序序号 |
| data | JSON | NOT NULL | 条目数据（如 `{word, phonetic_us, paraphrase_en, ...}`） |
| debug | Boolean | default False | 保留字段 |
| created_at | DateTime | default now | |
| updated_at | DateTime | onupdate now | |

`data` 是 JSON 列，结构由绑定工具定义。导入时支持 JSON 数组（每条可含 `item_order` 与 `data`）。按 `item_order` 对齐：同名序号覆盖更新，新数据未包含的旧序号删除（保留学习进度记录）。

---

### t_progress — 学习进度

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| user_id | Integer | FK → t_user.id, NOT NULL | 用户 |
| deck_id | Integer | FK → t_deck.id, NOT NULL | 卡组 |
| deck_item_id | Integer | FK → t_deck_item.id, NOT NULL | 条目 |
| is_unknown | Integer | default 0 | 是否标记为未知（0/1） |
| is_favorite | Integer | default 0 | 是否收藏（0/1） |
| current_order | Integer | NOT NULL | 当前排序（重排后变化） |
| created_at | DateTime | default now | |
| updated_at | DateTime | onupdate now | |

唯一约束：`(user_id, deck_id, deck_item_id)` — 每个用户对每个卡组内的每条数据只有一条进度记录。

首次访问 `/v1/learn/info` 或 `/v1/learn/page` 时自动初始化：为该用户+卡组下的所有 DeckItem 创建 Progress 记录。

---

### t_study_round — 学习轮次

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| user_id | Integer | FK → t_user.id, NOT NULL | 用户 |
| deck_id | Integer | FK → t_deck.id, NOT NULL | 卡组 |
| round_number | Integer | NOT NULL | 轮次编号（递增） |
| end_time | DateTime | NOT NULL | 结束时间 |
| marked_count | Integer | NOT NULL, default 0 | 该轮标记为未知的数量 |

唯一约束：`(user_id, deck_id, round_number)`

每次执行"轮回"（Samsara / Go Again）时创建一条记录，把标为未知的条目排到前面。用于成就称号（按轮次升级）和连续学习天数统计。

---

### t_learning_event — 交互事件日志

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| user_id | Integer | FK → t_user.id, NOT NULL | 用户 |
| deck_id | Integer | FK → t_deck.id, NOT NULL | 卡组 |
| deck_item_id | Integer | FK → t_deck_item.id, NOT NULL | 条目 |
| template_id | Integer | FK → t_template.id, nullable | （迁移期）旧模板字段 |
| action | String(50) | NOT NULL | 动作名称（如 `audio_play`、`word_mark`、`favorite_toggle`）|
| created_at | DateTime | default now, **indexed** | 事件时间（建索引加速查询） |

工具通过 `cardAPI.track(action, itemId)` 上报（`deck_item_id` 必须带上），有 800ms 防抖 + 批量提交。统计页按 `deck_id`（或迁移期的 `template_id`）筛选数据。

## 关系图

```
┌──────────┐
│  t_user  │
│──────────│
│ id (PK)  │◄───────────────────────────────────────────┐
│ username │                                             │
└────┬─────┘                                             │
     │ 1:N                                               │
     │                                                   │
     ├─── t_tool ───────────────────────────────┐        │
     │   │ id (PK)                                │        │
     │   │ user_id (FK) ────────────────────────►│────┘
     │   │ name, dir_path, manifest_json         │
     │   └───────────────────────────────────────┘
     │               ▲
     │               │ 1:1（Deck.tool_id）
     ├─── t_deck ─────┘
     │   │ id (PK)
     │   │ user_id (FK) ────────────────────────►│────┘
     │   │ tool_id (FK, nullable)
     │   │ name, kind
     │   └──┬───────────────────────────────────┘
     │      │ 1:N
     │      ├── t_deck_item ───────────────────────┐
     │      │   │ id (PK)                           │
     │      │   │ deck_id (FK) ───────────────────►│
     │      │   │ item_order, data (JSON)           │
     │      │   └───────────────────────────────────┘
     │      │            ▲
     │      ├── t_progress ──────────────────────────────┐
     │      │   │ id (PK)                                  │
     │      │   │ user_id (FK) ─────────────────────────►│ (t_user)
     │      │   │ deck_id (FK) ─────────────────────────►│ (t_deck)
     │      │   │ deck_item_id (FK) ────────────────────►│ (t_deck_item)
     │      │   │ is_unknown, is_favorite, current_order  │
     │      │   │ UQ: (user_id, deck_id, deck_item_id)    │
     │      │   └─────────────────────────────────────────┘
     │      ├── t_study_round ───────────────────────────┐
     │      │   │ id (PK)                                  │
     │      │   │ user_id (FK) ─────────────────────────►│ (t_user)
     │      │   │ deck_id (FK) ─────────────────────────►│ (t_deck)
     │      │   │ round_number, end_time, marked_count    │
     │      │   │ UQ: (user_id, deck_id, round_number)    │
     │      │   └─────────────────────────────────────────┘
     │      └── t_learning_event ─────────────────────────┐
     │          │ id (PK)                                  │
     │          │ user_id (FK) ─────────────────────────►│ (t_user)
     │          │ deck_id (FK) ─────────────────────────►│ (t_deck)
     │          │ deck_item_id (FK) ────────────────────►│ (t_deck_item)
     │          │ action, created_at (indexed)            │
     │          └─────────────────────────────────────────┘
```

## 数据流转

### 创建 → 绑定工具 → 学习 → 记录

```
1. 创建卡组    POST /v1/decks            → t_deck (tool_id = null)
2. 绑定工具    POST /v1/decks/<id>/tool  → t_tool + minitools/<id>/ 解压 + 更新 tool_id
              （重新上传：POST /v1/tools/<id>/replace，保留 id 与绑定）
              （解绑：DELETE /v1/decks/<id>/tool）
3. 上传数据    POST /v1/decks/<id>/import → t_deck_item × N（JSON）
4. 进入卡组    GET /v1/tools/<id>/run?deck_id=&user_id= → 打开工具（cardAPI 注入）
5. 分页取卡    cardAPI.getPage()         → GET /v1/learn/page → 自动创建 t_progress × N
6. 标记/收藏   cardAPI.mark()            → POST /v1/learn/mark → 更新 t_progress.is_unknown
               cardAPI.favorite()        → POST /v1/learn/favorite → 更新 t_progress.is_favorite
7. 交互事件    cardAPI.track(action, itemId) → t_learning_event (防抖 800ms + 批量)
8. 轮回        POST /v1/reorder          → 更新 t_progress.current_order + 创建 t_study_round
```

工具访问须通过绑定校验：`/v1/learn/page`、`/v1/learn/mark`、`/v1/learn/favorite`、`/v1/observability/events` 都会校验 `deck.tool_id == tool_id`，不匹配返回 403 / 丢弃事件。

## 删除级联

删除卡组时（`DELETE /v1/decks/<id>`）级联清理：
- `t_deck_item` — 该卡组的所有条目
- `t_progress` — 该卡组的所有进度
- `t_study_round` — 该卡组的所有轮次
- `t_learning_event` — 该卡组的所有事件

解绑工具（`DELETE /v1/decks/<id>/tool`）：仅清空 `Deck.tool_id`，`t_tool` 记录与 `minitools/<id>/` 文件保留（可重新绑定）。