#!/usr/bin/env python3
"""Seed DragonCard with the free decks bundled in default_cards/.

Idempotent: decks that already exist (matched by name) are skipped, so
it's safe to run any time. An AI agent (or a human) can run:

    python seed_decks.py            # import all missing free decks
    python seed_decks.py --force    # re-import (replace) every bundled deck

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
SKIP_DIRS = {'_pack_template'}


def _load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def _import_tool_zip(deck_id, zip_path, user_id):
    """Read a tool.zip and bind it to the deck (mirrors bind_tool_to_deck)."""
    from app import _extract_tool_zip, TOOL_MAX_BYTES
    from models import Tool, Deck, db

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
    name = (manifest.get('name') or '').strip() or os.path.splitext(os.path.basename(zip_path))[0][:100]
    ta = manifest.get('trackedActions')
    if isinstance(ta, list) and len(ta) > 5:
        raise ValueError('trackedActions exceeds 5')

    tool = Tool(
        user_id=user_id,
        name=name[:100],
        description=(manifest.get('description') or ''),
        icon=(manifest.get('icon') or ''),
        lang=(manifest.get('lang') or 'zh'),
        dir_path='',
        manifest_json=json.dumps(manifest, ensure_ascii=False),
        tracked_actions=json.dumps(ta, ensure_ascii=False) if ta else None,
    )
    db.session.add(tool)
    db.session.flush()
    if not _extract_tool_zip(tool, blob):
        db.session.rollback()
        raise ValueError('failed to extract zip')
    tool.dir_path = os.path.join('minitools', str(tool.id))
    deck = db.session.get(Deck, deck_id)
    deck.tool_id = tool.id


def _import_items(deck_id, cards):
    """Insert deck items aligned by item_order (mirrors import_deck_items)."""
    from models import DeckItem, db
    existing = {di.item_order: di for di in DeckItem.query.filter_by(deck_id=deck_id).all()}
    max_order = max(existing) if existing else 0
    next_free = max_order + 1
    for item in cards:
        order = item.get('item_order') if isinstance(item, dict) else None
        if order is None or order == 0:
            order = next_free
            next_free += 1
        else:
            order = int(order)
        data = item.get('data', item) if isinstance(item, dict) else item
        if order in existing:
            existing[order].data = data
            existing[order].debug = item.get('debug', False) if isinstance(item, dict) else False
        else:
            db.session.add(DeckItem(
                deck_id=deck_id, item_order=order, data=data,
                debug=item.get('debug', False) if isinstance(item, dict) else False,
            ))


def _deck_exists(name):
    from models import Deck
    return Deck.query.filter_by(name=name).first() is not None


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


def seed(force=False, user_id=1):
    from models import db
    imported = []
    skipped = []

    for folder in sorted(os.listdir(DEFAULT_CARDS)):
        path = os.path.join(DEFAULT_CARDS, folder)
        if not os.path.isdir(path) or folder in SKIP_DIRS:
            continue

        tool_zip = os.path.join(path, 'tool.zip')
        cards_path = os.path.join(path, 'cards.json')
        if not (os.path.exists(tool_zip) and os.path.exists(cards_path)):
            skipped.append((folder, 'missing tool.zip/cards.json'))
            continue

        main_name = _meta_name(path)
        if force or not _deck_exists(main_name):
            cards = _load_json(cards_path)
            deck = _create_deck(main_name, user_id)
            _import_tool_zip(deck.id, tool_zip, user_id)
            _import_items(deck.id, cards)
            imported.append(main_name)
        else:
            skipped.append((folder, 'already exists'))

    db.session.commit()
    return imported, skipped


def main():
    parser = argparse.ArgumentParser(description='Seed free decks from default_cards/')
    parser.add_argument('--force', action='store_true', help='Re-import even if deck exists')
    parser.add_argument('--user-id', type=int, default=1, help='Owner user id (default 1)')
    args = parser.parse_args()

    from app import create_app
    app = create_app()
    with app.app_context():
        imported, skipped = seed(force=args.force, user_id=args.user_id)

    print(f'Imported {len(imported)} deck(s):')
    for name in imported:
        print('  +', name)
    if skipped:
        print(f'\nSkipped {len(skipped)} (already present or incomplete):')
        for name, why in skipped:
            print('  -', name, f'({why})')


if __name__ == '__main__':
    main()