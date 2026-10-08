import math
import os
import io
import json
import re
import shutil
import tempfile
import uuid
import zipfile
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_file, Response
from models import db, User, Deck, DeckItem, Progress, StudyRound, LearningEvent, Tool
from config import Config

MAX_ACTIONS = 5
DECK_KINDS = {'language', 'knowledge', 'logic', 'skill', 'other'}
TOOL_MAX_BYTES = 30 * 1024 * 1024  # zip 上限 30MB
TOOL_EXT_WHITELIST = {'.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
                      '.woff', '.woff2',
                      # 音频：音标 / 拼读类小工具要自带音素发音（assets/phonemes/*.mp3）
                      '.mp3', '.m4a', '.ogg', '.oga', '.wav',
                      # 3D：恐龙等小工具自带 GLB 模型（assets/models/*.glb），
                      #     不自带的话 zip 脱离宿主分发就只剩占位图
                      '.glb'}


def create_app():
    app = Flask(__name__, static_folder='static')
    app.config.from_object(Config)
    db.init_app(app)

    with app.app_context():
        db.create_all()
        _ensure_default_user()
        _migrate_schema()

    return app


def _ensure_default_user():
    if not User.query.filter_by(username='default').first():
        db.session.add(User(username='default'))
        db.session.commit()


def _migrate_schema():
    from sqlalchemy import inspect
    inspector = inspect(db.engine)

    tables = inspector.get_table_names()

    if 't_deck' not in tables:
        db.session.execute(db.text('CREATE TABLE t_deck (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES t_user(id), name VARCHAR(100) NOT NULL, kind VARCHAR(20) DEFAULT \'other\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'))
        db.session.commit()

    if 't_deck_item' not in tables:
        db.session.execute(db.text('CREATE TABLE t_deck_item (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, deck_id INTEGER NOT NULL REFERENCES t_deck(id), item_order INTEGER NOT NULL, data JSON NOT NULL, debug BOOLEAN DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'))
        db.session.commit()

    deck_cols = [c['name'] for c in inspector.get_columns('t_deck')]
    if 'kind' not in deck_cols:
        db.session.execute(db.text("ALTER TABLE t_deck ADD COLUMN kind VARCHAR(20) DEFAULT 'other'"))
        db.session.commit()
    if 'description' in deck_cols:
        db.session.execute(db.text('ALTER TABLE t_deck DROP COLUMN description'))
        db.session.commit()
    if 'active_template_id' in deck_cols:
        # SQLite 不支持 DROP 外键列 → 重建 t_deck（无 active_template_id）
        db.session.execute(db.text("PRAGMA foreign_keys=OFF"))
        db.session.execute(db.text('CREATE TABLE t_deck_new (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES t_user(id), name VARCHAR(100) NOT NULL, kind VARCHAR(20) DEFAULT \'other\', tool_id INTEGER REFERENCES t_tool(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'))
        db.session.execute(db.text('INSERT INTO t_deck_new (id, user_id, name, kind, tool_id, created_at, updated_at) SELECT id, user_id, name, kind, tool_id, created_at, updated_at FROM t_deck'))
        db.session.execute(db.text('DROP TABLE t_deck'))
        db.session.execute(db.text('ALTER TABLE t_deck_new RENAME TO t_deck'))
        db.session.execute(db.text("PRAGMA foreign_keys=ON"))
        db.session.commit()

    # 模板时代遗留表清理（备份后）：t_template / t_deck_template 已废弃。
    if 't_template' in tables:
        db.session.execute(db.text("PRAGMA foreign_keys=OFF"))
        db.session.execute(db.text('DROP TABLE IF EXISTS t_deck_template'))
        db.session.execute(db.text('DROP TABLE IF EXISTS t_template'))
        db.session.execute(db.text("PRAGMA foreign_keys=ON"))
        db.session.commit()
    elif 't_deck_template' in tables:
        db.session.execute(db.text('DROP TABLE IF EXISTS t_deck_template'))
        db.session.commit()

    user_cols = [c['name'] for c in inspector.get_columns('t_user')]
    if 'display_name' not in user_cols:
        db.session.execute(db.text('ALTER TABLE t_user ADD COLUMN display_name VARCHAR(100)'))
        db.session.commit()

    ev_cols = [c['name'] for c in inspector.get_columns('t_learning_event')] if 't_learning_event' in tables else []
    if 'template_id' in ev_cols:
        # SQLite 不支持 DROP 外键列 → 重建 t_learning_event（无 template_id）
        db.session.execute(db.text("PRAGMA foreign_keys=OFF"))
        db.session.execute(db.text('CREATE TABLE t_learning_event_new (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES t_user(id), deck_id INTEGER NOT NULL REFERENCES t_deck(id), deck_item_id INTEGER NOT NULL REFERENCES t_deck_item(id), action VARCHAR(50) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'))
        db.session.execute(db.text('INSERT INTO t_learning_event_new (id, user_id, deck_id, deck_item_id, action, created_at) SELECT id, user_id, deck_id, deck_item_id, action, created_at FROM t_learning_event'))
        db.session.execute(db.text('DROP TABLE t_learning_event'))
        db.session.execute(db.text('ALTER TABLE t_learning_event_new RENAME TO t_learning_event'))
        db.session.execute(db.text("PRAGMA foreign_keys=ON"))
        db.session.commit()

    # t_tool：文件系统存储（minitools/<id>/），DB 只存元数据。
    # 旧结构含 zip_blob → 重建为无 blob 的新表（数据少，直接重建；已绑定的 tool_id 置空）。
    tool_cols = [c['name'] for c in inspector.get_columns('t_tool')] if 't_tool' in tables else []
    if 't_tool' not in tables:
        db.session.execute(db.text('CREATE TABLE t_tool (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES t_user(id), name VARCHAR(100) NOT NULL, description TEXT, icon VARCHAR(255), lang VARCHAR(10) DEFAULT \'zh\', dir_path VARCHAR(255) NOT NULL DEFAULT \'\', manifest_json TEXT, tracked_actions TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'))
        db.session.commit()
    elif 'zip_blob' in tool_cols:
        db.session.execute(db.text('DROP TABLE t_tool'))
        db.session.execute(db.text('CREATE TABLE t_tool (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES t_user(id), name VARCHAR(100) NOT NULL, description TEXT, icon VARCHAR(255), lang VARCHAR(10) DEFAULT \'zh\', dir_path VARCHAR(255) NOT NULL DEFAULT \'\', manifest_json TEXT, tracked_actions TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'))
        db.session.execute(db.text('UPDATE t_deck SET tool_id = NULL'))
        db.session.commit()

    deck_cols = [c['name'] for c in inspector.get_columns('t_deck')]
    if 'tool_id' not in deck_cols:
        db.session.execute(db.text('ALTER TABLE t_deck ADD COLUMN tool_id INTEGER REFERENCES t_tool(id)'))
        db.session.commit()

    # Performance indexes (idempotent)
    existing_idx = {r[0] for r in db.session.execute(db.text("SELECT name FROM sqlite_master WHERE type='index'")).fetchall()}
    if 'ix_t_deck_item_deck_id' not in existing_idx:
        db.session.execute(db.text('CREATE INDEX ix_t_deck_item_deck_id ON t_deck_item (deck_id)'))
    if 'ix_t_learning_event_user_deck' not in existing_idx:
        db.session.execute(db.text('CREATE INDEX ix_t_learning_event_user_deck ON t_learning_event (user_id, deck_id)'))
    db.session.commit()


app = create_app()


# ==================== User ====================

@app.route('/v1/users/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    if not username:
        return jsonify({'error': 'username required'}), 400
    user = User.query.filter_by(username=username).first()
    if not user:
        user = User(username=username)
        db.session.add(user)
        db.session.commit()
    return jsonify({'success': True, 'user': user.to_dict()})


@app.route('/v1/users')
def list_users():
    users = User.query.all()
    return jsonify({'success': True, 'users': [u.to_dict() for u in users]})


@app.route('/v1/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    u = db.session.get(User, user_id)
    if not u:
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json()
    if 'display_name' in data:
        u.display_name = data['display_name']
    if 'username' in data:
        existing = User.query.filter(User.username == data['username'], User.id != user_id).first()
        if existing:
            return jsonify({'error': 'Username already taken'}), 400
        u.username = data['username']
    db.session.commit()
    return jsonify({'success': True, 'user': u.to_dict()})


# ==================== Template ====================

# ==================== Tool (zip 小工具) ====================

def _tool_dir(tool):
    """工具文件系统目录（绝对路径）。"""
    return os.path.join(Config.TOOLS_DIR, str(tool.id))


def _safe_zip_name(name):
    """Reject path traversal / absolute paths; return a normalized member path."""
    if not name:
        return None
    n = name.replace('\\', '/')
    if n.startswith('/') or n.startswith('../') or '/../' in n or '..' in n.split('/')[0]:
        return None
    return n


def _extract_tool_zip(tool, blob):
    """解压 zip 到工具目录（文件系统）。返回成功与否。

    先整包解到同级的**临时目录**，成功后再原子换过去（旧目录让位 → 新目录就位 → 删旧）。
    这样中途失败（断流 / 磁盘满 / 进程被杀）不会把已部署的工具留成半成品 ——
    旧版原样可用，重传一次即可。旧实现是"先清空再解压"，一旦中断
    目录里就只剩一半文件（index.html 没了 ⇒ 工具直接 500）。
    """
    try:
        zf = zipfile.ZipFile(io.BytesIO(blob))
    except zipfile.BadZipFile:
        return False
    target = _tool_dir(tool)
    parent = os.path.dirname(target) or '.'
    os.makedirs(parent, exist_ok=True)
    staging = tempfile.mkdtemp(prefix='.staging-', dir=parent)
    try:
        base = os.path.realpath(staging)
        for name in zf.namelist():
            safe = _safe_zip_name(name)
            if safe is None:
                continue
            dest = os.path.realpath(os.path.join(staging, *safe.split('/')))
            if os.path.commonpath([dest, base]) != base:
                continue  # 防穿越
            if name.endswith('/'):
                os.makedirs(dest, exist_ok=True)
            else:
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with open(dest, 'wb') as f:
                    f.write(zf.read(name))
        retired = None
        if os.path.exists(target):
            retired = '%s.retired-%s' % (target, uuid.uuid4().hex[:8])
            os.rename(target, retired)
        try:
            os.rename(staging, target)
        except OSError:
            if retired:  # 换不过去就把旧的放回来
                os.rename(retired, target)
            return False
        staging = None
        if retired:
            shutil.rmtree(retired, ignore_errors=True)
        return True
    finally:
        if staging and os.path.isdir(staging):
            shutil.rmtree(staging, ignore_errors=True)


def _tool_file_path(tool, path):
    """安全解析工具目录内的文件路径；越界返回 None。"""
    safe = _safe_zip_name(path)
    if not safe:
        return None
    base = os.path.realpath(_tool_dir(tool))
    candidate = os.path.realpath(os.path.join(base, *safe.split('/')))
    if candidate != base and os.path.commonpath([candidate, base]) != base:
        return None
    return candidate


def _pack_tool_dir(tool):
    """把工具目录打包成 zip（BytesIO）。"""
    buf = io.BytesIO()
    base = _tool_dir(tool)
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(base):
            for fn in files:
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, base).replace(os.sep, '/')
                zf.write(full, rel)
    buf.seek(0)
    return buf


def _tool_cardapi_script(tool_id, deck_id, user_id):
    """JSBridge injected into the tool page so it can call the host engine.
    tool_id comes from the server (the tool being run), not the URL — so a
    tampered ?deck_id= can't write to an unrelated deck (server verifies the
    tool is bound to that deck)."""
    tid = ('%s' % tool_id) if tool_id else 'null'
    did = ('%s' % deck_id) if deck_id else 'null'
    uid = ('%s' % user_id) if user_id else 'null'
    return '''
<script>
(function () {
  var toolId = %s;
  var deckId = %s;
  var userId = %s;
  function post(path, body) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); });
  }
  window.cardAPI = {
    toolId: toolId,
    deckId: deckId,
    userId: userId,
    getToolId: function () { return toolId; },
    getDeckId: function () { return deckId; },
    getUserId: function () { return userId; },
    getPage: function (page, pageSize) {
      var u = '/v1/learn/page?user_id=' + userId + '&deck_id=' + deckId
            + '&tool_id=' + toolId + '&page=' + (page || 1) + '&page_size=' + (pageSize || 100);
      return fetch(u).then(function (r) { return r.json(); });
    },
    mark: function (itemId, isUnknown) {
      return post('/v1/learn/mark', { deck_item_id: itemId, user_id: userId, deck_id: deckId, is_unknown: isUnknown ? 1 : 0, tool_id: toolId });
    },
    favorite: function (itemId, fav) {
      return post('/v1/learn/favorite', { deck_item_id: itemId, user_id: userId, deck_id: deckId, is_favorite: fav ? 1 : 0, tool_id: toolId });
    },
    track: function (action, itemId) {
      if (!action || !userId || !deckId) return Promise.resolve();
      var ev = { user_id: userId, deck_id: deckId, action: action, tool_id: toolId };
      if (itemId != null) ev.deck_item_id = itemId;
      return post('/v1/observability/events', { events: [ev] });
    },
    playAudio: function (text) {
      try {
        var u = new SpeechSynthesisUtterance(String(text));
        u.lang = 'en-US';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch (e) {}
    },
    finish: function () {
      return post('/v1/observability/events', { events: [{ user_id: userId, deck_id: deckId, action: 'tool_finish', tool_id: toolId }] });
    }
  };
})();
</script>
''' % (tid, did, uid)


def _check_tool_deck_binding(deck_id, tool_id):
    """工具调用数据接口时校验：该工具是否绑定了这个卡组。
    无 tool_id（本体 study / 兼容调用）→ 放行；有 tool_id → 必须 deck.tool_id == tool_id。"""
    if not tool_id:
        return True
    d = db.session.get(Deck, deck_id) if deck_id else None
    if not d or d.tool_id != tool_id:
        return False
    return True


@app.route('/v1/tools/<int:tool_id>/run')
def run_tool(tool_id):
    """Proxy the tool's index.html, injecting the cardAPI bridge."""
    t = db.session.get(Tool, tool_id)
    if not t:
        return 'Tool not found', 404
    index_path = os.path.join(_tool_dir(t), 'index.html')
    if not os.path.isfile(index_path):
        return 'Tool not installed', 500
    with open(index_path, encoding='utf-8', errors='replace') as f:
        html = f.read()
    deck_id = request.args.get('deck_id')
    user_id = request.args.get('user_id')
    script = _tool_cardapi_script(tool_id, deck_id, user_id)
    low = html.lower()
    # Inject into <head> so cardAPI is ready before any tool script runs.
    if '</head>' in low:
        i = low.rindex('</head>')
        html = html[:i] + script + html[i:]
    elif '<body' in low:
        i = low.index('<body')
        html = html[:i] + '<head>' + script + '</head>' + html[i:]
    else:
        html = script + html
    return Response(html, mimetype='text/html')


@app.route('/v1/tools/<int:tool_id>/assets/<path:path>')
def tool_asset(tool_id, path):
    t = db.session.get(Tool, tool_id)
    if not t:
        return 'Tool not found', 404
    if not os.path.splitext(path)[1].lower() in TOOL_EXT_WHITELIST:
        return 'Forbidden', 403
    real = _tool_file_path(t, path)
    if real is None or not os.path.isfile(real):
        # 兼容工具内 assets/ 前缀布局
        real2 = _tool_file_path(t, 'assets/' + path)
        if real2 is None or not os.path.isfile(real2):
            return 'Not found', 404
        real = real2
    with open(real, 'rb') as f:
        data = f.read()
    mime = {
        '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
        '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
        '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
        '.oga': 'audio/ogg', '.wav': 'audio/wav',
    }.get(os.path.splitext(real)[1].lower(), 'application/octet-stream')
    return Response(data, mimetype=mime)


@app.route('/v1/tools/<int:tool_id>/validate', methods=['POST'])
def validate_tool_deck(tool_id):
    """Check the tool's manifest fields against a deck's data sample."""
    t = db.session.get(Tool, tool_id)
    if not t:
        return jsonify({'error': 'Tool not found'}), 404
    body = request.get_json() or {}
    deck_id = body.get('deck_id')
    deck = db.session.get(Deck, deck_id) if deck_id else None
    if not deck:
        return jsonify({'error': 'Deck not found'}), 404

    fields = t.get_fields()
    sample = DeckItem.query.filter_by(deck_id=deck_id).order_by(DeckItem.item_order).limit(3).all()
    sample_keys = set()
    for it in sample:
        sample_keys.update(it.data.keys())
    missing = [f for f in fields if f not in sample_keys]
    return jsonify({
        'success': True,
        'tool_fields': fields,
        'deck_keys': sorted(sample_keys),
        'missing': missing,
        'sample_count': len(sample),
    })


@app.route('/v1/tools/<int:tool_id>/replace', methods=['POST'])
def replace_tool(tool_id):
    """重新上传工具 zip：替换 minitools/<id>/ 内容，更新元数据（保留工具 id 与卡组绑定）。"""
    t = db.session.get(Tool, tool_id)
    if not t:
        return jsonify({'error': 'Tool not found'}), 404
    f = request.files.get('zip')
    if not f or not f.filename:
        return jsonify({'error': 'No zip file'}), 400
    blob = f.read()
    if not blob or len(blob) > TOOL_MAX_BYTES:
        return jsonify({'error': 'Zip too large'}), 400
    try:
        zf = zipfile.ZipFile(io.BytesIO(blob))
    except zipfile.BadZipFile:
        return jsonify({'error': 'Invalid zip file'}), 400
    if 'index.html' not in zf.namelist():
        return jsonify({'error': 'index.html must be at the zip root'}), 400
    manifest = {}
    if 'manifest.json' in zf.namelist():
        try:
            manifest = json.loads(zf.read('manifest.json').decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return jsonify({'error': 'manifest.json is not valid JSON'}), 400
    if not _extract_tool_zip(t, blob):
        return jsonify({'error': 'Failed to extract zip'}), 500
    t.name = (manifest.get('name') or '').strip() or t.name
    t.description = manifest.get('description') or t.description
    t.icon = manifest.get('icon') or t.icon
    t.lang = manifest.get('lang') or t.lang
    t.manifest_json = json.dumps(manifest, ensure_ascii=False)
    ta = manifest.get('trackedActions')
    t.tracked_actions = json.dumps(ta, ensure_ascii=False) if isinstance(ta, list) else t.tracked_actions
    db.session.commit()
    d = Deck.query.filter_by(tool_id=tool_id).first()
    return jsonify({'success': True, 'tool': t.to_dict(), 'deck': d.to_dict() if d else None})


@app.route('/v1/tools/<int:tool_id>/export')
def export_tool(tool_id):
    """把工具目录打包成 zip 下载。"""
    t = db.session.get(Tool, tool_id)
    if not t:
        return jsonify({'error': 'Tool not found'}), 404
    buf = _pack_tool_dir(t)
    safe = ''.join(c for c in (t.name or 'tool') if c.isalnum() or c in '-_') or 'tool'
    return send_file(buf, as_attachment=True, download_name=safe + '.zip', mimetype='application/zip')


# ==================== Deck (卡组) ====================

@app.route('/v1/decks', methods=['GET'])
def list_decks():
    user_id = request.args.get('user_id', type=int)
    q = Deck.query
    if user_id:
        q = q.filter_by(user_id=user_id)
    decks = q.order_by(Deck.created_at.desc()).all()

    # 各卡组今年有学习事件的天数 + 最近一次学习时间（单次聚合查询）
    year_days_map = {}
    last_study_map = {}
    if user_id:
        year_days_map, last_study_map = _study_activity_map(user_id)

    result = []
    for d in decks:
        dd = d.to_dict()
        dd['year_study_days'] = year_days_map.get(d.id, 0)
        dd['last_studied_at'] = last_study_map.get(d.id)
        result.append(dd)
    return jsonify({'success': True, 'decks': result})


def _study_activity_map(user_id):
    """各卡组今年有学习事件的天数 + 最近一次学习时间，单次聚合查询。

    Returns (year_days_map, last_study_map)."""
    from datetime import date
    rows = db.session.query(
        LearningEvent.deck_id,
        db.func.count(db.func.distinct(db.func.date(LearningEvent.created_at))),
        db.func.max(LearningEvent.created_at),
    ).filter(
        LearningEvent.user_id == user_id,
        db.func.date(LearningEvent.created_at) >= date(date.today().year, 1, 1),
    ).group_by(LearningEvent.deck_id).all()
    year_days = {}
    last = {}
    for deck_id, days, ts in rows:
        year_days[deck_id] = days
        last[deck_id] = ts.isoformat() if ts else None
    return year_days, last


@app.route('/v1/decks', methods=['POST'])
def create_deck():
    data = request.get_json()
    kind = data.get('kind', 'other')
    if kind not in DECK_KINDS:
        kind = 'other'
    d = Deck(
        user_id=data['user_id'],
        name=data['name'],
        kind=kind,
    )
    db.session.add(d)
    db.session.commit()
    return jsonify({'success': True, 'deck': d.to_dict()}), 201


@app.route('/v1/decks/<int:deck_id>', methods=['GET'])
def get_deck(deck_id):
    d = db.session.get(Deck, deck_id)
    if not d:
        return jsonify({'error': 'Deck not found'}), 404
    return jsonify({'success': True, 'deck': d.to_dict()})


@app.route('/v1/decks/<int:deck_id>', methods=['PUT'])
def update_deck(deck_id):
    d = db.session.get(Deck, deck_id)
    if not d:
        return jsonify({'error': 'Deck not found'}), 404
    data = request.get_json()
    if 'name' in data:
        d.name = data['name']
    if 'kind' in data:
        kind = data['kind']
        if kind not in DECK_KINDS:
            return jsonify({'error': f'Invalid kind: {kind}'}), 400
        d.kind = kind
    db.session.commit()
    return jsonify({'success': True, 'deck': d.to_dict()})


@app.route('/v1/decks/<int:deck_id>/tool', methods=['POST'])
def bind_tool_to_deck(deck_id):
    """Upload a zip tool and bind it to the deck (manage page)."""
    d = db.session.get(Deck, deck_id)
    if not d:
        return jsonify({'error': 'Deck not found'}), 404
    user_id = request.form.get('user_id', type=int)
    f = request.files.get('zip')
    if not f or not f.filename:
        return jsonify({'error': 'No zip file'}), 400
    blob = f.read()
    if not blob or len(blob) > TOOL_MAX_BYTES:
        return jsonify({'error': 'Zip too large'}), 400
    try:
        zf = zipfile.ZipFile(io.BytesIO(blob))
    except zipfile.BadZipFile:
        return jsonify({'error': 'Invalid zip file'}), 400
    if 'index.html' not in zf.namelist():
        return jsonify({'error': 'index.html must be at the zip root'}), 400
    manifest = {}
    if 'manifest.json' in zf.namelist():
        try:
            manifest = json.loads(zf.read('manifest.json').decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return jsonify({'error': 'manifest.json is not valid JSON'}), 400
    name = (manifest.get('name') or '').strip() or os.path.splitext(f.filename)[0][:100]
    fields = manifest.get('fields')
    if not isinstance(fields, list):
        fields = []
    ta = manifest.get('trackedActions')
    if isinstance(ta, list) and len(ta) > MAX_ACTIONS:
        return jsonify({'error': 'trackedActions exceeds %d' % MAX_ACTIONS}), 400
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
        return jsonify({'error': 'Failed to extract zip'}), 500
    tool.dir_path = os.path.join('minitools', str(tool.id))
    d.tool_id = tool.id
    db.session.commit()
    return jsonify({'success': True, 'tool': tool.to_dict(), 'deck': d.to_dict()})


@app.route('/v1/decks/<int:deck_id>/tool', methods=['DELETE'])
def unbind_tool_from_deck(deck_id):
    d = db.session.get(Deck, deck_id)
    if not d:
        return jsonify({'error': 'Deck not found'}), 404
    d.tool_id = None
    db.session.commit()
    return jsonify({'success': True, 'deck': d.to_dict()})


@app.route('/v1/decks/<int:deck_id>', methods=['DELETE'])
def delete_deck(deck_id):
    d = db.session.get(Deck, deck_id)
    if not d:
        return jsonify({'error': 'Deck not found'}), 404
    DeckItem.query.filter_by(deck_id=deck_id).delete()
    Progress.query.filter_by(deck_id=deck_id).delete()
    StudyRound.query.filter_by(deck_id=deck_id).delete()
    LearningEvent.query.filter_by(deck_id=deck_id).delete()
    db.session.delete(d)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/v1/decks/<int:deck_id>/export')
def export_deck_data(deck_id):
    d = db.session.get(Deck, deck_id)
    if not d:
        return jsonify({'error': 'Deck not found'}), 404
    items = DeckItem.query.filter_by(deck_id=deck_id).order_by(DeckItem.item_order).all()
    data = [{
        'item_order': di.item_order,
        'data': di.data,
        'debug': di.debug,
    } for di in items]
    return jsonify({
        'success': True,
        'deck_name': d.name,
        'count': len(data),
        'data': data,
    })


# ==================== DeckItem (data entries) ====================

@app.route('/v1/decks/<int:deck_id>/items', methods=['GET'])
def list_deck_items(deck_id):
    items = DeckItem.query.filter_by(deck_id=deck_id).order_by(DeckItem.item_order).all()
    return jsonify({'success': True, 'items': [di.to_dict() for di in items]})


@app.route('/v1/decks/<int:deck_id>/import', methods=['POST'])
def import_deck_items(deck_id):
    d = db.session.get(Deck, deck_id)
    if not d:
        return jsonify({'error': 'Deck not found'}), 404

    body = request.get_json()
    items = body if isinstance(body, list) else body.get('items', [])

    existing = {di.item_order: di for di in DeckItem.query.filter_by(deck_id=deck_id).all()}
    max_order = max(existing) if existing else 0
    incoming_orders = set()
    next_free = max_order + 1

    # Cards present before this import that are NOT in the incoming set.
    # They will be removed as items, but their study progress is kept
    # (Progress/LearningEvent rows stay so statistics are not lost).
    before_count = len(existing)
    removed_orders = set(existing.keys())

    for i, item in enumerate(items):
        order = item.get('item_order')
        if order is None or order == 0:
            order = next_free
            next_free += 1
        else:
            order = int(order)
        incoming_orders.add(order)
        removed_orders.discard(order)

        if order in existing:
            di = existing[order]
            di.data = item.get('data', item)
            di.debug = item.get('debug', False)
        else:
            di = DeckItem(
                deck_id=deck_id,
                item_order=order,
                data=item.get('data', item),
                debug=item.get('debug', False),
            )
            db.session.add(di)

    for order in removed_orders:
        di = existing[order]
        # Remove the card itself, but keep Progress/LearningEvent history.
        db.session.delete(di)

    db.session.commit()
    return jsonify({
        'success': True,
        'count': len(items),
        'removed': len(removed_orders),
        'had_existing': before_count > 0,
    })


# ==================== Learning ====================

def _init_progress(user_id, deck_id):
    """Ensure every deck item has a Progress record for this user (idempotent)."""
    items = DeckItem.query.filter_by(deck_id=deck_id).order_by(DeckItem.item_order).all()
    existing_ids = {
        p.deck_item_id
        for p in Progress.query.filter_by(user_id=user_id, deck_id=deck_id).all()
    }
    added = 0
    for item in items:
        if item.id in existing_ids:
            continue
        db.session.add(Progress(
            user_id=user_id, deck_id=deck_id, deck_item_id=item.id,
            is_unknown=0, current_order=item.item_order,
        ))
        added += 1
    if added:
        db.session.commit()


@app.route('/v1/learn/info')
def learn_info():
    user_id = request.args.get('user_id', type=int)
    deck_id = request.args.get('deck_id', type=int)

    total = DeckItem.query.filter_by(deck_id=deck_id).count()
    if user_id and deck_id:
        _init_progress(user_id, deck_id)
        unknown = Progress.query.filter_by(user_id=user_id, deck_id=deck_id, is_unknown=1)\
            .join(DeckItem, Progress.deck_item_id == DeckItem.id).count()
        known = total - unknown
    else:
        unknown = 0
        known = 0

    return jsonify({
        'total_words': total,
        'unknown_count': unknown,
        'known_count': known,
    })


@app.route('/v1/learn/page')
def learn_page():
    user_id = request.args.get('user_id', type=int)
    deck_id = request.args.get('deck_id', type=int)
    tool_id = request.args.get('tool_id', type=int)
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', Config.PAGE_SIZE, type=int)

    if not _check_tool_deck_binding(deck_id, tool_id):
        return jsonify({'error': 'Tool not bound to this deck'}), 403
    if not user_id or not deck_id:
        return jsonify({'error': 'user_id and deck_id required'}), 400

    _init_progress(user_id, deck_id)

    offset = (page - 1) * page_size
    # Join against existing deck items so orphaned Progress records
    # (from removed cards) are excluded from pagination.
    progress_query = Progress.query.filter_by(user_id=user_id, deck_id=deck_id)\
        .join(DeckItem, Progress.deck_item_id == DeckItem.id)\
        .order_by(Progress.current_order)
    total = progress_query.count()
    progress_list = progress_query.offset(offset).limit(page_size).all()

    cards_data = []
    for p in progress_list:
        item = db.session.get(DeckItem, p.deck_item_id)
        if item:
            d = item.to_dict()
            d['is_unknown'] = p.is_unknown
            d['is_favorite'] = p.is_favorite
            d['current_order'] = p.current_order
            cards_data.append(d)

    total_pages = math.ceil(total / page_size) if total else 0

    return jsonify({
        'cards': cards_data,
        'page': page,
        'page_size': page_size,
        'total': total,
        'total_pages': total_pages,
        'has_next': page < total_pages,
        'has_prev': page > 1,
    })


@app.route('/v1/learn/page_status')
def learn_page_status():
    user_id = request.args.get('user_id', type=int)
    deck_id = request.args.get('deck_id', type=int)
    page_size = Config.PAGE_SIZE

    unknown_count = Progress.query.filter_by(
        user_id=user_id, deck_id=deck_id, is_unknown=1
    ).join(DeckItem, Progress.deck_item_id == DeckItem.id).count()
    marked_pages = math.ceil(unknown_count / page_size) if unknown_count > 0 else 0

    return jsonify({
        'success': True,
        'marked_pages_count': marked_pages,
    })


@app.route('/v1/learn/mark', methods=['POST'])
def mark_item():
    data = request.get_json()
    deck_item_id = data.get('deck_item_id')
    user_id = data.get('user_id')
    deck_id = data.get('deck_id')
    tool_id = data.get('tool_id')
    is_unknown = data.get('is_unknown')

    if not _check_tool_deck_binding(deck_id, tool_id):
        return jsonify({'error': 'Tool not bound to this deck'}), 403
    if not all([deck_item_id, user_id, deck_id]):
        return jsonify({'error': 'deck_item_id, user_id, deck_id required'}), 400

    progress = Progress.query.filter_by(
        user_id=user_id, deck_id=deck_id, deck_item_id=deck_item_id
    ).first()
    if not progress:
        return jsonify({'error': 'Progress not found'}), 404

    if is_unknown is None:
        progress.is_unknown = 1 if progress.is_unknown == 0 else 0
    else:
        progress.is_unknown = 1 if is_unknown else 0

    db.session.commit()
    return jsonify({
        'success': True,
        'deck_item_id': deck_item_id,
        'is_unknown': progress.is_unknown,
    })


@app.route('/v1/reorder', methods=['POST'])
def reorder_cards():
    data = request.get_json() or {}
    user_id = data.get('user_id')
    deck_id = data.get('deck_id')

    if not user_id or not deck_id:
        return jsonify({'error': 'user_id and deck_id required'}), 400

    records = db.session.query(
        Progress.id, Progress.is_unknown, DeckItem.item_order
    ).join(DeckItem, Progress.deck_item_id == DeckItem.id).filter(
        Progress.user_id == user_id,
        Progress.deck_id == deck_id,
    ).order_by(
        Progress.is_unknown.desc(),
        DeckItem.item_order.asc(),
    ).all()

    for new_order, record in enumerate(records, start=1):
        p = db.session.get(Progress, record.id)
        p.current_order = new_order

    unknown_count = Progress.query.filter_by(
        user_id=user_id, deck_id=deck_id, is_unknown=1
    ).join(DeckItem, Progress.deck_item_id == DeckItem.id).count()

    max_round = db.session.query(db.func.max(StudyRound.round_number)).filter(
        StudyRound.user_id == user_id,
        StudyRound.deck_id == deck_id,
    ).scalar() or 0

    db.session.add(StudyRound(
        user_id=user_id, deck_id=deck_id,
        round_number=max_round + 1,
        end_time=datetime.utcnow(),
        marked_count=unknown_count,
    ))
    db.session.commit()

    return jsonify({
        'success': True,
        'total_cards': len(records),
    })


@app.route('/v1/rounds')
def get_rounds():
    user_id = request.args.get('user_id', type=int)
    deck_id = request.args.get('deck_id', type=int)
    q = StudyRound.query
    if user_id:
        q = q.filter_by(user_id=user_id)
    if deck_id:
        q = q.filter_by(deck_id=deck_id)
    rounds = q.order_by(StudyRound.round_number).all()
    return jsonify({'success': True, 'data': [r.to_dict() for r in rounds]})


@app.route('/v1/stats')
def get_stats():
    user_id = request.args.get('user_id', type=int)
    deck_id = request.args.get('deck_id', type=int)

    results = db.session.query(
        DeckItem.item_order, Progress.is_unknown
    ).join(Progress, DeckItem.id == Progress.deck_item_id).filter(
        Progress.user_id == user_id,
        Progress.deck_id == deck_id,
    ).all()

    data = [{'item_order': r.item_order, 'is_unknown': r.is_unknown} for r in results]
    return jsonify({'success': True, 'data': data})


@app.route('/v1/decks/<int:deck_id>/mastery')
def get_deck_mastery(deck_id):
    """Per-deck mastery: per-card state (0=mastered incl unstudied, 1=unknown) + study rounds."""
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    deck = db.session.get(Deck, deck_id)
    if not deck:
        return jsonify({'error': 'deck not found'}), 404

    items = db.session.query(DeckItem.item_order, DeckItem.id).filter(
        DeckItem.deck_id == deck_id
    ).order_by(DeckItem.item_order).all()

    progress_map = dict(db.session.query(
        Progress.deck_item_id, Progress.is_unknown
    ).filter(
        Progress.user_id == user_id,
        Progress.deck_id == deck_id,
    ).all())

    states = [progress_map.get(iid, 0) for _, iid in items]

    rounds = [
        {'round_number': r.round_number, 'end_time': r.end_time.isoformat() if r.end_time else None,
         'marked_count': r.marked_count}
        for r in db.session.query(StudyRound).filter(
            StudyRound.user_id == user_id,
            StudyRound.deck_id == deck_id,
        ).order_by(StudyRound.round_number).all()
    ]

    return jsonify({
        'success': True,
        'data': {
            'deck_name': deck.name,
            'item_count': len(items),
            'states': states,
            'rounds': rounds,
        }
    })


# ==================== Achievements ====================


@app.route('/v1/achievements')
def get_achievements():
    from datetime import date, timedelta
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400

    deck_counts = db.session.query(
        StudyRound.deck_id, db.func.count(StudyRound.id)
    ).filter(StudyRound.user_id == user_id).group_by(StudyRound.deck_id).all()
    deck_names = {
        d.id: d.name for d in db.session.query(Deck).filter(Deck.user_id == user_id).all()
    }
    decks = [
        {'deck_id': did, 'name': deck_names.get(did, '卡组'), 'rounds': n}
        for did, n in deck_counts
    ]
    decks.sort(key=lambda d: d['rounds'], reverse=True)

    # 连续学习天数：按每天有学习事件（LearningEvent）判定
    study_dates = {r[0] for r in db.session.query(
        db.func.date(LearningEvent.created_at)
    ).filter(LearningEvent.user_id == user_id).distinct().all()}
    streak = 0
    anchor = date.today()
    if anchor.isoformat() not in study_dates:
        anchor = anchor - timedelta(days=1)
    while anchor.isoformat() in study_dates:
        streak += 1
        anchor = anchor - timedelta(days=1)

    deck_count = db.session.query(db.func.count(Deck.id)).filter(
        Deck.user_id == user_id
    ).scalar() or 0

    mastered_cards = db.session.query(db.func.count(Progress.id)).filter(
        Progress.user_id == user_id,
        Progress.is_unknown == 0,
    ).join(DeckItem, Progress.deck_item_id == DeckItem.id).scalar() or 0

    audio_play = db.session.query(db.func.count(LearningEvent.id)).filter(
        LearningEvent.user_id == user_id,
        LearningEvent.action == 'audio_play',
    ).scalar() or 0

    word_mark = db.session.query(db.func.count(LearningEvent.id)).filter(
        LearningEvent.user_id == user_id,
        LearningEvent.action == 'word_mark',
    ).scalar() or 0

    return jsonify({
        'success': True,
        'data': {
            'decks': decks,
            'streak_days': streak,
            'deck_count': deck_count,
            'mastered_cards': mastered_cards,
            'audio_play': audio_play,
            'word_mark': word_mark,
        }
    })


# ==================== Observability ====================


@app.route('/v1/observability/event', methods=['POST'])
def record_event():
    data = request.get_json()
    user_id = data.get('user_id')
    deck_id = data.get('deck_id')
    deck_item_id = data.get('deck_item_id')
    action = data.get('action')

    if not all([user_id, deck_id, deck_item_id, action]):
        return jsonify({'error': 'user_id, deck_id, deck_item_id, action required'}), 400
    if not isinstance(action, str) or not action.strip():
        return jsonify({'error': 'action must be a non-empty string'}), 400

    event = LearningEvent(
        user_id=user_id, deck_id=deck_id, deck_item_id=deck_item_id,
        action=action.strip(),
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({'success': True, 'event_id': event.id})


@app.route('/v1/observability/events', methods=['POST'])
def record_events_batch():
    data = request.get_json()
    events = data.get('events') or []
    count = 0
    for e in events:
        user_id = e.get('user_id')
        deck_id = e.get('deck_id')
        deck_item_id = e.get('deck_item_id')
        action = e.get('action')
        tool_id = e.get('tool_id')
        if not _check_tool_deck_binding(deck_id, tool_id):
            continue  # 工具未绑定该卡组：丢弃该事件
        if all([user_id, deck_id, deck_item_id, action]) and isinstance(action, str) and action.strip():
            db.session.add(LearningEvent(
                user_id=user_id, deck_id=deck_id, deck_item_id=deck_item_id,
                action=action.strip(),
            ))
            count += 1
    db.session.commit()
    return jsonify({'success': True, 'count': count})


@app.route('/v1/observability/actions')
def get_observability_actions():
    """Return action types from the bound tool's trackedActions, falling back to distinct DB events."""
    deck_id = request.args.get('deck_id', type=int)

    if deck_id:
        d = db.session.get(Deck, deck_id)
        if d and d.tool and d.tool.tracked_actions:
            try:
                actions = json.loads(d.tool.tracked_actions)
                return jsonify({'success': True, 'actions': actions})
            except json.JSONDecodeError:
                pass

    q = db.session.query(LearningEvent.action).distinct()
    if deck_id:
        q = q.filter(LearningEvent.deck_id == deck_id)
    actions = [r[0] for r in q.order_by(LearningEvent.action).all()]
    return jsonify({'success': True, 'actions': actions})


@app.route('/v1/observability/data')
def get_observability_data():
    from datetime import datetime, timedelta
    user_id = request.args.get('user_id', type=int)
    deck_id = request.args.get('deck_id', type=int)
    view = request.args.get('view', 'daily')
    date_str = request.args.get('date')

    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format'}), 400
    else:
        target_date = datetime.now().date()

    if view == 'daily':
        start_dt = datetime.combine(target_date, datetime.min.time())
        end_dt = start_dt + timedelta(days=1)
    elif view == 'weekly':
        start_of_week = target_date - timedelta(days=target_date.weekday())
        start_dt = datetime.combine(start_of_week, datetime.min.time())
        end_dt = start_dt + timedelta(weeks=1)
    elif view == 'monthly':
        start_of_month = target_date.replace(day=1)
        start_dt = datetime.combine(start_of_month, datetime.min.time())
        if target_date.month == 12:
            end_dt = datetime(target_date.year + 1, 1, 1)
        else:
            end_dt = datetime(target_date.year, target_date.month + 1, 1)
    elif view == 'heatmap':
        start_dt = datetime.combine(target_date - timedelta(days=364), datetime.min.time())
        end_dt = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
    else:
        return jsonify({'error': 'Invalid view'}), 400

    q = LearningEvent.query.filter(
        LearningEvent.created_at >= start_dt,
        LearningEvent.created_at < end_dt,
    )
    if user_id:
        q = q.filter(LearningEvent.user_id == user_id)
    if deck_id:
        q = q.filter(LearningEvent.deck_id == deck_id)
    events = q.order_by(LearningEvent.created_at).all()

    from collections import defaultdict

    if view == 'heatmap':
        heatmap = defaultdict(lambda: defaultdict(int))
        for ev in events:
            date_key = ev.created_at.date().isoformat()
            heatmap[date_key][ev.action] += 1
        result = [{'date': d, 'actions': dict(a)}
                   for d, a in sorted(heatmap.items())]
    elif view == 'daily':
        bucket_stats = defaultdict(lambda: defaultdict(int))
        for ev in events:
            minute = ev.created_at.minute
            bucket_minute = (minute // 15) * 15
            key = f"{ev.created_at.hour:02d}:{bucket_minute:02d}"
            bucket_stats[key][ev.action] += 1
        result = [{'time': k, 'actions': dict(v)}
                   for k, v in sorted(bucket_stats.items())]
    else:
        daily = defaultdict(lambda: defaultdict(int))
        for ev in events:
            date_key = ev.created_at.date().isoformat()
            daily[date_key][ev.action] += 1
        result = [{'date': d, 'actions': dict(a)}
                   for d, a in sorted(daily.items())]

    return jsonify({
        'success': True,
        'view': view,
        'date_range': {
            'start': start_dt.date().isoformat(),
            'end': (end_dt - timedelta(days=1)).date().isoformat(),
        },
        'data': result,
    })


# ==================== Favorite ====================

@app.route('/v1/learn/favorite', methods=['POST'])
def toggle_favorite():
    data = request.get_json()
    deck_item_id = data.get('deck_item_id')
    user_id = data.get('user_id')
    deck_id = data.get('deck_id')
    tool_id = data.get('tool_id')

    if not _check_tool_deck_binding(deck_id, tool_id):
        return jsonify({'error': 'Tool not bound to this deck'}), 403

    if not all([deck_item_id, user_id, deck_id]):
        return jsonify({'error': 'deck_item_id, user_id, deck_id required'}), 400

    progress = Progress.query.filter_by(
        user_id=user_id, deck_id=deck_id, deck_item_id=deck_item_id
    ).first()
    if not progress:
        return jsonify({'error': 'Progress not found'}), 404

    progress.is_favorite = 0 if progress.is_favorite else 1
    db.session.commit()
    return jsonify({
        'success': True,
        'deck_item_id': deck_item_id,
        'is_favorite': progress.is_favorite,
    })


# ==================== Page Routes ====================

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/playground')
def playground():
    return send_file(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'playground.html'))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
