# 🐉 DragonCard

> **DragonCard is not Anki.** — [中文文档](README_zh.md) | [Interactive Demo & Store](https://github.com/crazy-dragon/dragon-memory-market)

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

- **Three-layer template system**: data / style / interaction fully decoupled — one JSON template file defines everything about a card
- **Language-aware TTS**: the template declares `lang`; pronunciation auto-selects the matching voice, remembered per language
- **Bilingual UI**: one-click switch between 中/EN, instantly refreshing the whole interface (including built-in docs)
- **Categorized decks**: five kinds (Language / Knowledge / Logic / Skill / Other), each with its own icon and color
- **Simple study engine**: mark unknown → reshuffle → study in rounds; progress persists automatically
- **Stats & achievements**: activity heatmap, mastery distribution, round pyramid, titles and achievements
- **Data import/export**: JSON import (aligned & overwritten by `item_order`), JSON export, template deletion auto-backs-up
- **Template preview**: real-time card rendering preview in the management panel, with field-hiding toggles
- **Local-first**: SQLite storage, works out of the box, no external services

## 🚀 Quick Start

### Requirements

- Python 3.9+
- A modern browser (Chrome / Edge / Safari; requires Web Speech API)

### Install & Run

```bash
cd dragoncard
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open <http://localhost:5001> (port can be changed at the end of `app.py`).

On first launch, the app automatically creates the database tables, a default user `default`, and a set of starter templates.

### First Use

1. Click "New Deck", enter a name and pick a type
2. Open the deck → "Manage deck" → upload a template file (JSON) in the Templates area
3. Upload a data file (JSON) in the Data area
4. Return to the catalogue and click a page number to start studying

## 🎪 Online Demo & Store

The interactive demo and card store live in a **separate static site** (deployed on **Cloudflare Pages**, no commercial-use restriction):

> Repository: [`dragon-memory-market`](https://github.com/crazy-dragon/dragon-memory-market) — interactive demo `index.html` + card store `store.html`

```bash
# Local preview (needs an HTTP server; file:// fails because of fetch JSON)
git clone https://github.com/crazy-dragon/dragon-memory-market.git
cd dragon-memory-market
python3 -m http.server 8888
# Visit http://localhost:8888
```

The demo includes:
- `index.html`: philosophy intro + 3 sample decks with interactive study + store entry
- `store.html`: template store showing paid templates/data packs, linking to purchase
- Card interactions: pronunciation (browser TTS), mark, favorite, prev/next
- 中/EN language switching
- Front-end libraries loaded via CDN (for the public site; the local app uses `static/vendor/` offline)

To deploy on Cloudflare Pages, serve the repository contents as the site root (pure static, no build step).

## 📦 Publishing Templates

Paid templates/data packs are distributed through **Gumroad**; the showcase page is `store.html` in the separate site.

- Lightweight pack format: see [`TEMPLATE_PACK.md`](./TEMPLATE_PACK.md)
- Product data lives in `dragon-memory-market/data/store-data.json` (name / description / price / Gumroad link / preview image)
- After purchase: Manage deck → upload template (`template.json`) → upload data (`cards.json`)

> Detailed operations are in the in-app "Docs" (sidebar, 中/EN switchable).

## 🎴 Custom Templates

Templates are DragonCard's core. A template is a self-contained JSON file:

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

- **HTML / CSS / JS**: define card structure, styles (Tailwind utility classes + Font Awesome icons + project CSS variables), and interaction (`window.cardTemplate`'s `render` / `init` / `update`)
- **lang**: pronunciation language (`en` / `ja` / `zh` …)
- **trackedActions**: observability event declarations (max 5)
- **sampleData**: preview sample data

> The full template format, the `window.cardTemplate` contract, and API methods are in the in-app "Template API Reference" modal (top bar `</>` button on the home page).

## 🏗️ Architecture

```
User provides ──→  template.json (HTML + CSS + JS + lang + trackedActions)
                    │
DragonCard ──→   loads template → renders card → injects api object
                study engine (mark/reshuffle/pagination) stays fixed
```

DragonCard doesn't decide what cards look like or how they behave — templates do. The framework only provides the "shelf": the study flow and backend APIs.

### Tech Stack

- **Backend**: Flask + SQLAlchemy + SQLite
- **Frontend**: vanilla JS SPA + Tailwind CSS (local Play CDN) + Font Awesome
- **Data import**: JSON (aligned & overwritten by `item_order`)

### Project Structure

```
dragoncard/
├── app.py                     # Flask entry + all API routes (auto-creates tables + default user)
├── models.py                  # SQLAlchemy models (8 tables)
├── config.py                  # Configuration
├── requirements.txt
├── DB_relation.md             # Database relationship docs
├── README.md
├── README_zh.md               # Chinese README
├── TEMPLATE_PACK.md           # Template pack publishing spec (Gumroad)
├── ui_design.md               # UI design doc
│
├── default_cards/             # Bundled deck assets (templates + data, imported via upload)
│   ├── english_coca20000/      # English Word Card + template_simple (minimal)
│   ├── chinese_idiom/
│   ├── history_chenyu/
│   ├── japanese_gojuon/
│   ├── prelude_yijing/
│   ├── yijing/
│   ├── checkin_date/           # Check-in date (date/sunset/peach themes)
│   ├── dino_alphabet/
│   └── dinosaur_3d/
│
├── templates/
│   └── index.html             # SPA main page
│
└── static/
    ├── media/                 # Local media (3D models, etc.)
    ├── app.js                 # Framework JS (template loading / study engine / i18n)
    ├── i18n.js                # 中/EN message dictionaries
    ├── docs.js                # Built-in user docs (bilingual)
    ├── styles.css             # Framework UI styles
    └── vendor/                # Local dependencies (Tailwind / Font Awesome)
```

## 🔌 API Overview

| Module | Endpoint | Description |
|--------|----------|-------------|
| User | `GET /v1/users`、`POST /v1/users/login` | List users / login-create |
| Template | `GET/POST /v1/templates`、`GET/PUT/DEL /v1/templates/:id` | Template CRUD |
| Template | `POST /v1/templates/import`、`GET /v1/templates/:id/export` | Template import / export |
| Template | `GET /v1/templates/:id/preview` | Template preview data |
| Deck | `GET/POST /v1/decks`、`GET/PUT/DEL /v1/decks/:id` | Deck CRUD |
| Deck | `POST /v1/decks/:id/templates`、`PUT /v1/decks/:id/active-template` | Bind template / set active |
| Deck | `GET /v1/decks/:id/preview`、`GET /v1/decks/:id/mastery` | Deck preview / mastery stats |
| Data | `GET /v1/decks/:id/items`、`POST /v1/decks/:id/import`、`GET /v1/decks/:id/export` | List / import / export data |
| Study | `GET /v1/learn/info`、`GET /v1/learn/page` | Study stats / paged cards |
| Study | `POST /v1/learn/mark`、`POST /v1/learn/favorite` | Mark / favorite |
| Study | `POST /v1/reorder`、`GET /v1/rounds` | Reshuffle / rounds |
| Observability | `POST /v1/observability/event`、`POST /v1/observability/events` | Event reporting (single / batch) |
| Observability | `GET /v1/observability/actions`、`GET /v1/observability/data` | Action types / stats data |
| Achievements | `GET /v1/achievements` | Achievement data |

## 📚 Docs Index

| Doc | Purpose |
|-----|---------|
| [`DB_relation.md`](./DB_relation.md) | Database tables & relationships |
| [`ui_design.md`](./ui_design.md) | UI design document |
| In-app "Template API Reference" | Template format & `window.cardTemplate` contract (top-bar `</>` button) |
| In-app "Docs" | End-user operations guide (bilingual) |

## 📝 License

MIT. Built with ❤️
