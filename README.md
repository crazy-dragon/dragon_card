# 🐉 DragonCard

> **DragonCard is not Anki.** — [中文文档](README_zh.md) | [Interactive Demo & Store](https://dragoncard.top/)

DragonCard has no complex spaced-repetition algorithm. It uses one simple, categorized approach: show knowledge to you quickly — mark what you don't know, and mastered words fall behind while difficult ones stay ahead. That's all.

Memory was never about tricks; it's about **repetition**. Ebbinghaus proved it with a lifetime of research: the key to memory is repetition. So we believe in you — in your consistency. Persistence pays off.

The brain is remarkably good at being lazy. When you do the same thing consistently over time, it stops feeling hard and gradually becomes easier. DragonCard taps into exactly this mechanism — it offers no magic, just a simple container: **put knowledge in, and leave the most basic act of "repetition" to the self that shows up every day.**

### DragonCard vs Anki

| Dimension | Anki | DragonCard |
|-----------|------|------------|
| Scheduling unit | Each card independently computes next review time | A complete ordered list as the unit; priority via sorting |
| Time constraint | Strictly date-driven | Elastic — when to continue and how long to wait is up to you |
| Known words | Lower review frequency after mastery, or leave the pool | Kept at the tail of the list, refreshed with a light pass |
| Strength | Higher theoretical ceiling for memory efficiency | Simple, stable flow; easy to resume after a break; keeps word context order |
| Weakness | Uncontrollable workload, high maintenance after breaks | No precise review at the forgetting threshold; slightly lower theoretical single-item ceiling |

> More philosophy lives in the in-app "Docs" guide.

---

## ✨ Features

- **Zip tool system**: each deck binds one self-contained H5 tool (`index.html` + `manifest.json` + `assets/`); data / display / interaction fully decoupled — the tool decides everything about the card, the framework only provides the "shelf"
- **cardAPI bridge**: the tool reads data, marks unknown / favorites and reports events through `window.cardAPI` (getPage / mark / favorite / track / playAudio)
- **Language-aware TTS**: the tool declares `lang`; pronunciation auto-selects the matching voice, remembered per language
- **Bilingual UI**: one-click switch between 中/EN, instantly refreshing the whole interface (including built-in docs)
- **Categorized decks**: five kinds (Language / Knowledge / Logic / Skill / Other), each with its own icon and color
- **Simple study engine**: mark unknown → reshuffle → study in rounds; progress persists automatically
- **Stats & achievements**: activity heatmap, mastery distribution, round pyramid, titles and achievements
- **Data import/export**: JSON import (aligned & overwritten by `item_order`), JSON export
- **Local-first**: SQLite storage, works out of the box, no external services

## 🚀 Quick Start

### Requirements

- Python 3.9+
- A modern browser (Chrome / Edge / Safari; requires Web Speech API)

### Install & Run

**One command (recommended):**

```bash
cd dragoncard
./start.sh        # macOS / Linux
start.bat         # Windows
```

Or manually:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open <http://localhost:5001> (port can be changed at the end of `app.py`).

On first launch, the app automatically creates the database tables and a default user `default`.

### First Use

1. (Optional) Import the bundled free decks: `python seed_decks.py` (each deck already carries its `tool.zip`)
2. Click "New Deck", enter a name and pick a type
3. Open the deck → "Manage deck" → upload the deck's tool zip (bind) in the tool card, upload data (JSON) in the data card
4. Return to the catalogue and click the deck — the bound tool opens full-screen and you start studying

> An AI coding agent (e.g. Claude Code, Cursor, opencode) can run and extend this
> project; read `AGENTS.md` for the agent guide. Bundled free decks are imported
> via `python seed_decks.py` (idempotent).

## 🎪 Online Store

Try the live demo and browse premium decks at **[dragoncard.top](https://dragoncard.top/)** (backup: [dragon-memory-market.pages.dev](https://dragon-memory-market.pages.dev/)).

- **Interactive demo**: sample cards with pronunciation, marking, and 3D preview — right in your browser
- **Premium decks**: ready-made, AI-assisted packs available for **one-time purchase** (no subscription)

## 📦 Premium Decks

Premium tool/data packs are one-time purchases. See the store for available decks; after purchase you get the `tool.zip` + `cards.json` files and import them through the app: **Manage deck → upload zip (bind tool) → upload data**.

> Full details are in the in-app "Docs" (sidebar, 中/EN switchable).

## 🧩 Custom Tools

A **tool** is a self-contained offline H5 zip that runs full-screen when you open a deck:

```
my-tool/
├── index.html     # entry (required)
├── manifest.json  # metadata
└── assets/        # self-contained resources (css / js / images, no network)
```

**manifest.json** declares `name`, `lang`, `description`, `fields`, `trackedActions` (≤5) and an optional `icon`.

The tool gets data and reports progress through **`window.cardAPI`** (injected into its `<head>`):

| Method | Description |
|--------|-------------|
| `getPage(page, size)` | paged cards (with `is_unknown` / `is_favorite` / `current_order`) |
| `mark(itemId, isUnknown)` | mark unknown (true/false) |
| `favorite(itemId, fav)` | favorite / unfavorite |
| `track(action, itemId)` | report an event (must carry `itemId`) |
| `playAudio(text)` | TTS |
| `finish()` | finish |

> Build tools with the **dragoncard-tool-builder** skill
> (`dragoncard_tools/.skill/dragoncard-tool-builder/`); the full spec is in
> `dragoncard_tools/TOOL_PACK.md`. Bundle with `dragoncard_tools/build.py` → `dist/*.zip`.

## 🏗️ Architecture

```
User provides ──→  tool.zip (index.html + manifest.json + assets/)
                    │
DragonCard ──→   hosts the tool full-screen (/v1/tools/<id>/run), injects window.cardAPI
                data pagination / progress / study rounds stay fixed
```

DragonCard doesn't decide what cards look like or how they behave — the bound tool does. The framework only provides the "shelf": the study engine and backend APIs (data, progress, events).

### Tech Stack

- **Backend**: Flask + SQLAlchemy + SQLite
- **Frontend**: vanilla JS SPA + Tailwind CSS (local Play CDN) + Font Awesome
- **Data import**: JSON (aligned & overwritten by `item_order`)

### Project Structure

```
dragoncard/
├── app.py                     # Flask entry + all API routes (auto-creates tables + default user)
├── models.py                  # SQLAlchemy models (9 tables)
├── config.py                  # Configuration
├── seed_decks.py              # Import bundled free decks (tool.zip + cards.json)
├── requirements.txt
├── DB_relation.md             # Database relationship docs
├── FOLLOWUP.md                # Tool-migration backlog
├── README.md / README_zh.md
│
├── default_cards/             # Bundled deck packs (tool.zip + cards.json + meta.json)
│   ├── english_coca20000/      # COCA20000 词卡 (coca-cards tool)
│   ├── english_phonetics/      # 音标拼读 (english-phonetics tool)
│   ├── japanese_gojuon/        # 日语五十音图
│   ├── yijing/ + prelude_yijing/  # 周易（一 zip 双卡组）
│   ├── checkin_log/            # 星际航行日志（Voyage Log）
│   ├── chinese_hsk/ chinese_idiom/ chinese_measure_words/ chinese_radicals/
│   ├── chemistry_periodic/ stratagems_36/ western_allusions/ history_chenyu/
│   ├── dino_alphabet/ dinosaur_3d/ english_sentence_patterns/
│   ├── english_irregular_verbs/ reading_card/ ...
│
├── templates/
│   └── index.html             # SPA main page
│
└── static/
    ├── media/                 # Local media (3D models, etc.)
    ├── app.js                 # Framework JS (tool loading / study engine / i18n)
    ├── i18n.js                # 中/EN message dictionaries
    ├── docs.js                # Built-in user docs (bilingual)
    ├── styles.css             # Framework UI styles
    └── vendor/                # Local dependencies (Tailwind / Font Awesome)
```

Tool sources live in the separate **`dragoncard_tools/`** project (build.py → `dist/*.zip`, `TOOL_PACK.md`, `.skill/dragoncard-tool-builder/`).

## 🔌 API Overview

| Module | Endpoint | Description |
|--------|----------|-------------|
| User | `GET /v1/users`、`POST /v1/users/login` | List users / login-create |
| Tool bind | `POST /v1/decks/:id/tool`、`DELETE /v1/decks/:id/tool` | Bind / unbind a tool zip |
| Tool | `POST /v1/tools/:id/replace`、`GET /v1/tools/:id/export` | Re-upload / download tool |
| Tool | `GET /v1/tools/:id/run`、`GET /v1/tools/:id/assets/<path>` | Run tool full-screen / static assets |
| Deck | `GET/POST /v1/decks`、`GET/PUT/DEL /v1/decks/:id` | Deck CRUD |
| Data | `GET /v1/decks/:id/items`、`POST /v1/decks/:id/import`、`GET /v1/decks/:id/export` | List / import / export data |
| Study | `GET /v1/learn/info`、`GET /v1/learn/page` | Study stats / paged cards (cardAPI) |
| Study | `POST /v1/learn/mark`、`POST /v1/learn/favorite` | Mark / favorite |
| Study | `POST /v1/reorder`、`GET /v1/rounds` | Reshuffle (Samsara) / rounds |
| Observability | `POST /v1/observability/events` | Event reporting (batched, cardAPI.track) |
| Observability | `GET /v1/observability/actions`、`GET /v1/observability/data` | Action types / stats data |
| Achievements | `GET /v1/achievements` | Achievement data |

Tool access is verified against the deck binding: `/v1/learn/page`, `/v1/learn/mark`, `/v1/learn/favorite` and `/v1/observability/events` return 403 / drop events when the `tool_id` doesn't match the deck.

## 📚 Docs Index

| Doc | Purpose |
|-----|---------|
| [`DB_relation.md`](./DB_relation.md) | Database tables & relationships |
| [`AGENTS.md`](./AGENTS.md) | Guide for AI coding agents |
| In-app "小工具 API 参考" | Tool format & cardAPI contract (top-bar `</>` button) |
| In-app "Docs" | End-user operations guide (bilingual) |
| `dragoncard_tools/TOOL_PACK.md` | Tool pack publishing spec |
| `.skill/dragoncard-tool-builder/` | Tool-building skill (for AI agents) |

## 📝 License

MIT. Built with ❤️