#!/usr/bin/env python3
"""Seed DragonCard with the free decks bundled in default_cards/.

Idempotent: decks that already exist (matched by name) are skipped, so
it's safe to run any time. An AI agent (or a human) can run:

    python seed_decks.py            # import all missing free decks
    python seed_decks.py --force    # re-import (replace) every bundled deck

Convention per deck folder:
    template.json  + cards.json           -> one deck (main template)
    template_en.json + cards_en.json      -> an extra English deck (if present)

Requires an initialized database (running `python app.py` once creates it),
or the tables will be created automatically on import.
"""
import argparse
import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CARDS = os.path.join(BASE_DIR, 'default_cards')
SKIP_DIRS = {'_pack_template'}


def _load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def _import_template_text(deck_id, text, user_id):
    """Create a Template linked to a deck (mirrors upload_deck_template)."""
    from app import _parse_template, _count_template_actions, MAX_ACTIONS
    parsed = _parse_template(text)
    if not parsed['name']:
        raise ValueError('template has no name')
    action_count = _count_template_actions(parsed['cardHtml'] + parsed['cardJs'])
    if action_count > MAX_ACTIONS:
        raise ValueError(f'template has {action_count} actions > {MAX_ACTIONS}')

    from models import Template, DeckTemplate, db
    existing = DeckTemplate.query.filter_by(deck_id=deck_id).count()
    if existing >= 3:
        raise ValueError('deck already has 3 templates')
    t = Template(
        user_id=user_id,
        name=parsed['name'],
        description=parsed['description'],
        lang=parsed.get('lang', 'en') or 'en',
        card_html=parsed['cardHtml'],
        card_css=parsed['cardCss'],
        card_js=parsed['cardJs'],
        sample_data=parsed['sampleData'] or None,
        tracked_actions=parsed['trackedActions'] or '',
    )
    db.session.add(t)
    db.session.flush()
    db.session.add(DeckTemplate(deck_id=deck_id, template_id=t.id, sort_order=existing))
    return t


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

        tpl_path = os.path.join(path, 'template.json')
        cards_path = os.path.join(path, 'cards.json')
        if not (os.path.exists(tpl_path) and os.path.exists(cards_path)):
            skipped.append((folder, 'missing template.json/cards.json'))
            continue

        main_name = _meta_name(path)
        if force or not _deck_exists(main_name):
            tpl_text = open(tpl_path, encoding='utf-8').read()
            cards = _load_json(cards_path)
            deck = _create_deck(main_name, user_id)
            t = _import_template_text(deck.id, tpl_text, user_id)
            _import_items(deck.id, cards)
            deck.active_template_id = t.id
            imported.append(main_name)
        else:
            skipped.append((folder, 'already exists'))

        # English variant (template_en.json + cards_en.json)
        en_tpl = os.path.join(path, 'template_en.json')
        en_cards = os.path.join(path, 'cards_en.json')
        if os.path.exists(en_tpl) and os.path.exists(en_cards):
            en_name = (_meta_name(path) or folder) + ' (EN)'
            if force or not _deck_exists(en_name):
                tpl_text = open(en_tpl, encoding='utf-8').read()
                cards = _load_json(en_cards)
                deck = _create_deck(en_name, user_id)
                t = _import_template_text(deck.id, tpl_text, user_id)
                _import_items(deck.id, cards)
                deck.active_template_id = t.id
                imported.append(en_name)
            else:
                skipped.append((folder, 'EN already exists'))

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