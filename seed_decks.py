#!/usr/bin/env python3
"""Seed DragonCard with the free decks bundled in default_cards/.

Idempotent: decks that already exist (matched by name) are skipped, so it's
safe to run any time. An AI agent (or a human) can run:

    python seed_decks.py                     # import all missing free decks
    python seed_decks.py laozi chinese_hsk   # only the named folders (or deck names)
    python seed_decks.py --force             # replace every existing deck in place
    python seed_decks.py --force laozi       # replace one deck in place

--force replaces a deck **in place** (no duplicate rows): the deck row is
reused, its bound tool is re-imported keeping the tool id (mirrors
POST /v1/tools/<id>/replace), and items are upserted by item_order —
cards absent from cards.json are removed, study progress is kept.

Convention per deck folder:
    tool.zip  + cards.json          -> one deck bound to the zip tool

Requires an initialized database (running `python app.py` once creates it),
or the tables will be created automatically on import.
"""
import argparse
import io
import json
import os
import sys
import zipfile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CARDS = os.path.join(BASE_DIR, 'default_cards')


def _load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def _read_tool_zip(zip_path):
    """Validate tool.zip, returning (blob, manifest, trackedActions)."""
    from app import TOOL_MAX_BYTES

    blob = open(zip_path, 'rb').read()
    if not blob or len(blob) > TOOL_MAX_BYTES:
        raise ValueError('tool.zip too large')
    try:
        zf = zipfile.ZipFile(io.BytesIO(blob))
    except zipfile.BadZipFile:
        raise ValueError('invalid zip')
    if 'index.html' not in zf.namelist():
        raise ValueError('index.html must be at the zip root')
    manifest = {}
    if 'manifest.json' in zf.namelist():
        try:
            manifest = json.loads(zf.read('manifest.json').decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ValueError('manifest.json is not valid JSON')
    ta = manifest.get('trackedActions')
    if isinstance(ta, list) and len(ta) > 5:
        raise ValueError('trackedActions exceeds 5')
    return blob, manifest, ta


def _import_tool_zip(deck, zip_path, user_id):
    """Read tool.zip and bind/refresh the deck's tool.

    Deck already bound -> replace the tool in place (keeps tool id + binding,
    mirrors POST /v1/tools/<id>/replace); otherwise create + bind a new tool
    (mirrors POST /v1/decks/<id>/tool)."""
    from app import _extract_tool_zip
    from models import Tool, db

    blob, manifest, ta = _read_tool_zip(zip_path)

    tool = db.session.get(Tool, deck.tool_id) if deck.tool_id else None
    created = tool is None
    if created:
        tool = Tool(user_id=user_id, name='', description='', icon='',
                    lang='zh', dir_path='', manifest_json='{}')
        db.session.add(tool)
        db.session.flush()

    if not _extract_tool_zip(tool, blob):
        db.session.rollback()
        raise ValueError('failed to extract zip')

    if created:
        tool.name = (manifest.get('name') or '').strip() \
            or os.path.splitext(os.path.basename(zip_path))[0][:100]
        tool.description = manifest.get('description') or ''
        tool.icon = manifest.get('icon') or ''
        tool.lang = manifest.get('lang') or 'zh'
        tool.tracked_actions = json.dumps(ta, ensure_ascii=False) if ta else None
        tool.dir_path = os.path.join('minitools', str(tool.id))
        deck.tool_id = tool.id
    else:
        tool.name = (manifest.get('name') or '').strip() or tool.name
        tool.description = manifest.get('description') or tool.description
        tool.icon = manifest.get('icon') or tool.icon
        tool.lang = manifest.get('lang') or tool.lang
        tool.tracked_actions = json.dumps(ta, ensure_ascii=False) if isinstance(ta, list) else tool.tracked_actions
    tool.manifest_json = json.dumps(manifest, ensure_ascii=False)


def _import_items(deck_id, cards):
    """Upsert deck items aligned by item_order (mirrors import_deck_items):
    update matching orders, add missing, remove cards absent from the
    incoming set — study progress (Progress/LearningEvent) is kept."""
    from models import DeckItem, db

    existing = {di.item_order: di for di in DeckItem.query.filter_by(deck_id=deck_id).all()}
    max_order = max(existing) if existing else 0
    next_free = max_order + 1
    removed = set(existing.keys())

    for item in cards:
        order = item.get('item_order') if isinstance(item, dict) else None
        if order is None or order == 0:
            order = next_free
            next_free += 1
        else:
            order = int(order)
        removed.discard(order)
        data = item.get('data', item) if isinstance(item, dict) else item
        debug = item.get('debug', False) if isinstance(item, dict) else False
        if order in existing:
            existing[order].data = data
            existing[order].debug = debug
        else:
            db.session.add(DeckItem(deck_id=deck_id, item_order=order, data=data, debug=debug))

    for order in removed:
        db.session.delete(existing[order])


def _create_deck(name, user_id, kind='other'):
    from models import Deck, db
    d = Deck(user_id=user_id, name=name, kind=kind)
    db.session.add(d)
    db.session.flush()
    return d


def _meta_name(folder):
    meta_path = os.path.join(folder, 'meta.json')
    try:
        return _load_json(meta_path).get('name') or os.path.basename(folder)
    except (OSError, ValueError):
        return os.path.basename(folder)


def seed(force=False, user_id=1, only=None):
    from models import Deck, db

    folders = sorted(
        f for f in os.listdir(DEFAULT_CARDS)
        if os.path.isdir(os.path.join(DEFAULT_CARDS, f))
    )
    errors = []

    if only:
        by_meta = {f: _meta_name(os.path.join(DEFAULT_CARDS, f)) for f in folders}
        picks = []
        for want in only:
            hit = next((f for f in folders if f == want or by_meta[f] == want), None)
            if hit is None:
                errors.append((want, 'no such folder/deck in default_cards/'))
            elif hit not in picks:
                picks.append(hit)
        folders = picks

    created, replaced, skipped = [], [], []

    for folder in folders:
        path = os.path.join(DEFAULT_CARDS, folder)
        tool_zip = os.path.join(path, 'tool.zip')
        cards_path = os.path.join(path, 'cards.json')
        if not (os.path.exists(tool_zip) and os.path.exists(cards_path)):
            skipped.append((folder, 'missing tool.zip/cards.json'))
            continue

        main_name = _meta_name(path)
        deck = Deck.query.filter_by(name=main_name).first()
        if deck is None:
            deck = _create_deck(main_name, user_id)
            mode = 'created'
        elif force:
            mode = 'replaced'
        else:
            skipped.append((folder, 'already exists (use --force to replace)'))
            continue

        _import_tool_zip(deck, tool_zip, user_id)
        _import_items(deck.id, _load_json(cards_path))
        (created if mode == 'created' else replaced).append(main_name)

    db.session.commit()
    return created, replaced, skipped, errors


def main():
    parser = argparse.ArgumentParser(description='Seed free decks from default_cards/')
    parser.add_argument('decks', nargs='*', metavar='folder',
                        help='Only these folders (or deck names) under default_cards/; default: all')
    parser.add_argument('--force', action='store_true', help='Replace existing decks in place (no duplicates)')
    parser.add_argument('--user-id', type=int, default=1, help='Owner user id (default 1)')
    args = parser.parse_args()

    from app import create_app
    app = create_app()
    with app.app_context():
        created, replaced, skipped, errors = seed(
            force=args.force, user_id=args.user_id, only=args.decks or None)

    if created:
        print(f'Imported {len(created)} deck(s):')
        for name in created:
            print('  +', name)
    if replaced:
        print(f'Replaced {len(replaced)} deck(s) in place:')
        for name in replaced:
            print('  ↻', name)
    if skipped:
        print(f'Skipped {len(skipped)} (already present or incomplete):')
        for name, why in skipped:
            print('  -', name, f'({why})')
    if errors:
        print(f'Error: unknown deck(s):')
        for name, why in errors:
            print('  !', name, f'({why})')
        sys.exit(1)


if __name__ == '__main__':
    main()
