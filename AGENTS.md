# DragonCard — Guide for AI Agents

Local-first flashcard app: **Flask + SQLite + vanilla JS SPA**. It is not
Anki — no spaced-repetition algorithm; it uses a simple ordered-list study
engine (mark unknown → reshuffle → rounds).

This file tells you (an AI coding agent) how to run, understand and extend
DragonCard. For humans, see `README.md`.

## Quick Start

```bash
./start.sh          # macOS / Linux: creates venv, installs deps, starts on :5001
start.bat           # Windows equivalent
```

Or manually:

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py
# open http://localhost:5001
```

First launch automatically creates the SQLite DB (`instance/dragon_card.db`),
tables, and a default user `default`. The app is empty until decks are added
(see below).

## Seeding bundled free decks

The repo ships free decks under `default_cards/` (each folder = one deck:
`template.json` + `cards.json`, optional `_en` variants, `meta.json`).
They are **not** auto-imported. To import them (idempotent — existing decks
are skipped by name):

```bash
python seed_decks.py            # import all missing bundled free decks
python seed_decks.py --force    # re-import (replace) them
```

A user can also import any deck manually in the UI: Manage deck → upload
template (`template.json`) → upload data (`cards.json`).

## Dependencies

- `requirements.txt`: `flask`, `flask-sqlalchemy` (SQLite by default; the
  app also configures `DATABASE_URL`/`SECRET_KEY` env vars, and `pymysql`
  is present only for optional MySQL).
- Frontend is static (`static/`), no build step. Vendored libs under
  `static/vendor/` (Tailwind, Font Awesome, ECharts, Three.js).

## Architecture

```
app.py            Flask routes + schema bootstrap/migration
models.py         SQLAlchemy models (User, Deck, Template, DeckItem, ...)
config.py         Config (env overridable)
seed_decks.py     CLI to import default_cards/ free decks
default_cards/    bundled deck packs (template.json + cards.json + meta)
static/           SPA: app.js (engine/i18n), styles.css, vendor/, media/
templates/index.html  single-page shell
instance/         SQLite DB (created at runtime, not committed)
```

Key concepts:

- **Deck** = a study list. **Template** = how a card renders (self-contained
  JSON with cardHtml/cardCss/cardJs + fields + trackedActions). **DeckItem**
  = one card's data (JSON), ordered by `item_order`.
- `Deck.to_dict()` returns per-deck stats used by the home grid
  (item_count / unknown / mastered / round_count / year_study_days /
  last_studied_at). `_study_activity_map` computes study activity in one query.
- The UI is a vanilla-JS SPA; all state lives in `static/app.js`
  (including `_deckKindFilter`, skin system, i18n, single-card study mode).

## API overview (all JSON)

| Module | Endpoint |
|--------|----------|
| User | `POST /v1/users/login`, `GET /v1/users` |
| Decks | `GET/POST /v1/decks`, `GET/PUT/DEL /v1/decks/:id` |
| Deck templates | `POST /v1/decks/:id/templates` (upload/replace) |
| Deck data | `POST /v1/decks/:id/import`, `GET /v1/decks/:id/items`, export |
| Learning | `GET /v1/learn/info`, `GET /v1/learn/page`, `POST /v1/learn/mark`, `/v1/learn/favorite`, `POST /v1/reorder` |
| Observability | `POST /v1/observability/events` (batched), `GET /v1/observability/actions`, `/data` |
| Templates | `POST /v1/templates/import`, `GET /v1/templates/:id`, preview, export |
| Achievements | `GET /v1/achievements` |

## Common tasks

- **Add a bundled free deck**: create `default_cards/<name>/` with
  `template.json` + `cards.json` (+ optional `_en`), then `python seed_decks.py`.
  Follow the spec in `TEMPLATE_PACK.md` and use `_pack_template/` as a scaffold.
- **Change how cards look**: edit `template.json` `cardCss`/`cardHtml`/`cardJs`
  (the template is fully self-contained; `window.cardTemplate` contract is
  documented in the in-app "Template API Reference").
- **Add a tracked action**: call `api.track('action')` in `cardJs`; it is
  auto-declared on import. Keep ≤5 actions.

## Gotchas

- **Never commit `instance/*.db`** (ignored).
- `item_order` in `cards.json` **must be 1-based** — it is the import
  overwrite key; missing/inconsistent orders cause append-only imports.
- The app listens on `0.0.0.0:5001`; port is at the end of `app.py`
  (`app.run(host='0.0.0.0', port=5001)`).
- TTS uses the browser's Web Speech API (no server dependency).
- Skins are front-end only (CSS variable overrides + a `pointer-events:none`
  decoration layer). Skin CSS must **not** change layout widths or
  card-content variables.
- The built-in themed skins live in `static/app.js` `SKINS`; card
  content variables are intentionally untouched so template cards keep their
  user-defined look.