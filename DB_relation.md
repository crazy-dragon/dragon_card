# DragonCard 数据库关系说明

## 概述

DragonCard 使用 SQLite + SQLAlchemy，共 **8 张表**。核心设计思路：

> **Deck（卡组）= Template（模板）+ Data（数据）**

用户创建卡组，为卡组上传模板和数据，然后进行学习。系统跟踪学习进度、记录交互事件。

```
User ──┬── Deck ──── DeckTemplate ──── Template   (卡组绑定模板，多对多，1 个当前模板)
       │   │
       │   ├── DeckItem × N           (卡组包含多条数据)
       │   │
       │   ├── Progress × N           (每条数据的学习进度)
       │   │
       │   ├── StudyRound × N         (每轮重排记录)
       │   │
       │   └── LearningEvent × N      (交互事件日志)
       │
       └── Template × N                (用户拥有的模板)
```

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

### t_template — 模板

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| user_id | Integer | FK → t_user.id, nullable | 所属用户（可为公共模板） |
| name | String(100) | NOT NULL | 模板名称 |
| description | Text | nullable | 描述 |
| lang | String(10) | default 'en' | TTS 语音语言（BCP47，如 en/ja/zh） |
| card_html | Text | default '' | 卡片 HTML 骨架（含 `{{占位符}}`） |
| card_css | Text | default '' | 卡片样式 |
| card_js | Text | default '' | 卡片交互逻辑（定义 `window.cardTemplate`）|
| sample_data | Text | nullable | 预览用示例数据（JSON 字符串） |
| tracked_actions | Text | nullable | 观测埋点声明（JSON 数组 `[{action,label}]`，最多 5 个） |
| created_at | DateTime | default now | |
| updated_at | DateTime | onupdate now | |

模板是自包含的（html + css + js 三件套），定义卡片怎么展示、怎么交互。一个模板可被多个卡组复用（通过 t_deck_template 关联）。

---

### t_deck — 卡组

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| user_id | Integer | FK → t_user.id, NOT NULL | 所属用户 |
| name | String(100) | NOT NULL | 卡组名称 |
| kind | String(20) | default 'other' | 类型：language / knowledge / logic / skill / other |
| active_template_id | Integer | FK → t_template.id, nullable | 当前生效模板 |
| created_at | DateTime | default now | |
| updated_at | DateTime | onupdate now | |

`active_template_id` 可空，支持"先创建卡组、后上传模板"的流程。`to_dict()` 计算 `has_template`、`has_data`、`item_count` 等派生字段，并返回当前模板名与描述（`template_name`、`template_description`）。

---

### t_deck_template — 卡组-模板关联（多对多）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| deck_id | Integer | FK → t_deck.id, **PK** | 卡组 |
| template_id | Integer | FK → t_template.id, **PK** | 模板 |
| sort_order | Integer | default 0 | 排序 |

一个卡组最多绑定 **3 个**模板；其中一个是当前模板（t_deck.active_template_id）。

---

### t_deck_item — 卡组条目（单条数据）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| deck_id | Integer | FK → t_deck.id, NOT NULL | 所属卡组 |
| item_order | Integer | NOT NULL | 排序序号 |
| data | JSON | NOT NULL | 条目数据（如 `{word, phonetic_us, paraphrase_en, ...}`）|
| debug | Boolean | default False | 保留字段 |
| created_at | DateTime | default now | |
| updated_at | DateTime | onupdate now | |

`data` 是 JSON 列，结构由模板决定。导入时支持 JSON 数组和 Excel（首行为字段名）。同名 item_order 的数据会覆盖更新，多余条目删除。

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

每次执行 "重新打乱"（Go Again）时创建一条记录，把标为未知的条目排到前面。用于成就称号（按轮次升级）和连续学习天数统计。

---

### t_learning_event — 交互事件日志

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, Auto | 主键 |
| user_id | Integer | FK → t_user.id, NOT NULL | 用户 |
| deck_id | Integer | FK → t_deck.id, NOT NULL | 卡组 |
| deck_item_id | Integer | FK → t_deck_item.id, NOT NULL | 条目 |
| template_id | Integer | FK → t_template.id, nullable | 模板（用于按模板筛选观测数据） |
| action | String(50) | NOT NULL | 动作名称（如 `audio_play`、`word_mark`、`favorite_toggle`）|
| created_at | DateTime | default now, **indexed** | 事件时间（建索引加速查询） |

前端通过 `api.track('action_name')` 上报，有 800ms 防抖 + 批量提交。后端不限制 action 字符串，模板定义什么就记什么。统计页按 `template_id` 或 `deck_id` 筛选数据。

## 关系图

```
┌──────────┐
│  t_user  │
│──────────│
│ id (PK)  │◄──────────────────────────────────────────┐
│ username │                                            │
└────┬─────┘                                            │
     │ 1:N                                              │
     │                                                  │
     ├─── t_template ──────────────────────────────┐    │
     │   │ id (PK)                                  │    │
     │   │ user_id (FK) ──────────────────────────►│────┘
     │   │ name, lang, card_html, card_css, card_js│
     │   └──────────────────────────────────────────┘    │
     │            ▲ ▲                                    │
     │            │ │ 多对多 (t_deck_template)           │
     │            │ └──────────────┐                     │
     ├─── t_deck ──────────────────┼──────────┐          │
     │   │ id (PK)                 │          │          │
     │   │ user_id (FK) ──────────►│──────────│──────────┘
     │   │ active_template_id ─────►┘          │
     │   │ name, kind                          │
     │   └──┬──────────────────────────────────┘
     │      │ 1:N
     │      │
     │      ├── t_deck_item ──────────────────────┐
     │      │   │ id (PK)                          │
     │      │   │ deck_id (FK) ──────────────────►│
     │      │   │ item_order, data (JSON)          │
     │      │   └──────────────────────────────────┘
     │      │            ▲
     │      │            │
     │      ├── t_progress ───────────────────────────────────┐
     │      │   │ id (PK)                                       │
     │      │   │ user_id (FK) ──────────────────────────────►│ (t_user)
     │      │   │ deck_id (FK) ──────────────────────────────►│ (t_deck)
     │      │   │ deck_item_id (FK) ─────────────────────────►│ (t_deck_item)
     │      │   │ is_unknown, is_favorite, current_order       │
     │      │   │ UQ: (user_id, deck_id, deck_item_id)         │
     │      │   └──────────────────────────────────────────────┘
     │      │
     │      ├── t_study_round ────────────────────────────────┐
     │      │   │ id (PK)                                      │
     │      │   │ user_id (FK) ─────────────────────────────►│ (t_user)
     │      │   │ deck_id (FK) ─────────────────────────────►│ (t_deck)
     │      │   │ round_number, end_time, marked_count        │
     │      │   │ UQ: (user_id, deck_id, round_number)        │
     │      │   └─────────────────────────────────────────────┘
     │      │
     │      └── t_learning_event ─────────────────────────────┐
     │          │ id (PK)                                      │
     │          │ user_id (FK) ─────────────────────────────►│ (t_user)
     │          │ deck_id (FK) ─────────────────────────────►│ (t_deck)
     │          │ deck_item_id (FK) ────────────────────────►│ (t_deck_item)
     │          │ template_id (FK, nullable) ───────────────►│ (t_template)
     │          │ action, created_at (indexed)                │
     │          └─────────────────────────────────────────────┘
```

## 数据流转

### 创建 → 学习 → 记录

```
1. 创建卡组    POST /v1/decks            → t_deck (active_template_id = null)
2. 上传模板    POST /v1/decks/<id>/templates → t_template + t_deck_template + 更新 active_template_id
3. 上传数据    POST /v1/decks/<id>/import   → t_deck_item × N（支持 JSON / Excel）
4. 开始学习    GET  /v1/learn/info      → 自动创建 t_progress × N
5. 标记/收藏   POST /v1/learn/mark      → 更新 t_progress.is_unknown
               POST /v1/learn/favorite  → 更新 t_progress.is_favorite
6. 交互事件    api.track('action')      → t_learning_event (防抖 800ms + 批量)
7. 重新打乱    POST /v1/reorder         → 更新 t_progress.current_order + 创建 t_study_round
```

### 删除级联

删除卡组时（`DELETE /v1/decks/<id>`）级联清理：
- `t_deck_item` — 该卡组的所有条目
- `t_progress` — 该卡组的所有进度
- `t_study_round` — 该卡组的所有轮次
- `t_learning_event` — 该卡组的所有事件

删除模板时（`DELETE /v1/templates/<id>`）：
- 自动备份模板完整内容到 `backups/templates/` 目录
- 解除卡组对该模板的引用（`active_template_id` 置空，`t_deck_template` 关联删除）
