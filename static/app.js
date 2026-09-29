var state = {
    userId: null,
    mode: 'decks',
    currentDeck: null,
    deckId: null,

    activeTab: 'catalogue',
    tabs: [],
    cards: {},
    info: { total_words: 0, unknown_count: 0 },
    totalPages: 0,
    markedPages: 0,
    fontSize: parseFloat(localStorage.getItem('dc-card-font-scale')) || 1,
    voices: [],
    selectedVoice: null,
    darkTheme: localStorage.getItem('dc-dark-theme') === '1',
    skinId: localStorage.getItem('dc-skin-id') || (localStorage.getItem('dc-dark-theme') === '1' ? 'dark' : 'default'),
    soundEnabled: localStorage.getItem('dc-sound') !== '0',
    enteredPages: new Set(),
    singleCardMode: false,
    singleCardIndex: 0,
    _singleCard3D: false,
};

/* Callback held while the import-confirm modal is open */
var _pendingImport = null;

/* Detect small-screen devices (mobile/touch-friendly study flow) */
function isMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
}

/* ===== DOM helpers ===== */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ===== Voice manager (language-aware) ===== */
var voiceMgr = {
    voices: [],
    _currentLang: null,

    init: function () {
        var self = this;
        function loadVoices() {
            self.voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
            renderVoiceDropdown();
        }
        if (window.speechSynthesis) {
            loadVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    },

    setLang: function (lang) {
        this._currentLang = lang || null;
        renderVoiceDropdown();
    },

    /* Normalize a BCP47-ish lang tag to its primary subtag: "en-US" -> "en" */
    _primary: function (tag) { return String(tag || '').split('-')[0].toLowerCase(); },

    /* Pick the best voice for a lang:
       1) exact match on full lang (en-US)
       2) primary subtag match (en)
       3) user's saved voice for that lang
       4) null (fall back to engine default) */
    pickVoice: function (lang) {
        if (!lang) return null;
        var primary = this._primary(lang);
        var saved = null;
        try { saved = localStorage.getItem('dc-voice-' + primary); } catch (e) {}
        var fallback = null;
        for (var i = 0; i < this.voices.length; i++) {
            var v = this.voices[i];
            var vp = this._primary(v.lang);
            if (saved && v.voiceURI === saved) return v;
            if (!fallback && vp === primary) fallback = v;
            if (v.lang && v.lang.toLowerCase() === String(lang).toLowerCase()) return v;
        }
        return fallback;
    },

    saveVoice: function (lang, voice) {
        var primary = this._primary(lang);
        try { localStorage.setItem('dc-voice-' + primary, voice ? voice.voiceURI : ''); } catch (e) {}
    },

    /* Sample phrase used when testing a voice, localized by language */
    sampleText: function (lang) {
        var samples = {
            en: 'Hello world',
            zh: '你好世界',
            ja: 'こんにちは世界',
            ko: '안녕하세요',
            fr: 'Bonjour le monde',
            de: 'Hallo Welt',
            es: 'Hola mundo',
            ru: 'Привет мир'
        };
        var p = this._primary(lang);
        return samples[p] || (p || 'en');
    },

    /* Pull the display word of the first card in the current deck.
       Falls back through common field names; null when unavailable. */
    _extractCardWord: function (card) {
        if (!card || !card.data) return null;
        var data = card.data;
        var keys = ['word', 'term', 'hiragana', 'kanji', 'romaji', 'name', 'title', 'question', 'phrase', 'reading'];
        for (var i = 0; i < keys.length; i++) {
            if (data[keys[i]]) return String(data[keys[i]]);
        }
        return null;
    },

    /* Async: get the first card's word of the current deck, then call cb(word|null). */
    firstCardWord: function (cb) {
        var self = this;
        if (!state.deckId || !state.userId) { cb(null); return; }
        var cached = state.cards[1] && state.cards[1][0];
        var txt = this._extractCardWord(cached);
        if (txt) { cb(txt); return; }
        fetch('/v1/learn/page?user_id=' + state.userId + '&deck_id=' + state.deckId + '&page=1&page_size=1')
            .then(function (r) { return r.json(); })
            .then(function (d) {
                cb(d.cards && d.cards[0] ? self._extractCardWord(d.cards[0]) : null);
            })
            .catch(function () { cb(null); });
    },

    speak: function (text, lang) {
        if (!('speechSynthesis' in window)) return;
        var u = new SpeechSynthesisUtterance(text || '');
        var voice = this.pickVoice(lang);
        if (voice) {
            u.voice = voice;
        } else if (lang) {
            u.lang = lang; /* let the engine pick by language tag */
        }
        try {
            /* Chrome/Safari bug: calling cancel() then speak() synchronously
               drops the utterance (it stays "pending" -> silence). Cancel first,
               then defer speak() to the next tick and resume the engine. */
            window.speechSynthesis.cancel();
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
            setTimeout(function () { window.speechSynthesis.speak(u); }, 80);
        } catch (e) {}
    }
};

/* ===== Audio feedback (subtle success chime) ===== */
var audioFeedback = (function () {
    var ctx = null;
    function ac() {
        if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
        return ctx;
    }
    return {
        playSuccess: function () {
            if (state.soundEnabled === false) return;
            var c = ac(); if (!c) return;
            try {
                var o = c.createOscillator(), g = c.createGain();
                o.type = 'sine'; o.frequency.value = 660;
                g.gain.setValueAtTime(0.0001, c.currentTime);
                g.gain.exponentialRampToValueAtTime(0.15, c.currentTime + 0.01);
                g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
                o.connect(g); g.connect(c.destination);
                o.start(); o.stop(c.currentTime + 0.2);
            } catch (e) {}
        }
    };
})();


/* Deck kind meta: stored value (EN) -> i18n key + Font Awesome icon */
var DECK_KIND_META = {
    'language':  { i18n: 'kind.language', icon: '<i class="fa-solid fa-language"></i>',   color: '#3b82f6', bg: '#eff6ff' },
    'knowledge': { i18n: 'kind.knowledge', icon: '<i class="fa-solid fa-book-open"></i>',  color: '#22c55e', bg: '#f0fdf4' },
    'logic':     { i18n: 'kind.logic', icon: '<i class="fa-solid fa-brain"></i>',      color: '#8b5cf6', bg: '#f5f3ff' },
    'skill':     { i18n: 'kind.skill', icon: '<i class="fa-solid fa-hammer"></i>',     color: '#f59e0b', bg: '#fffbeb' },
    'other':     { i18n: 'kind.other', icon: '<i class="fa-solid fa-ellipsis"></i>',   color: '#64748b', bg: '#f8fafc' },
};
function getKindMeta(kind) { return DECK_KIND_META[kind] || DECK_KIND_META['other']; }
function kindLabel(kind) { return t(getKindMeta(kind).i18n); }
function kindOptionsHtml(selected) {
    var html = '';
    Object.keys(DECK_KIND_META).forEach(function (k) {
        var meta = DECK_KIND_META[k];
        html += '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + t(meta.i18n) + '</option>';
    });
    return html;
}

var TOOL_API_MD = `# 小工具（Tool）开发参考

小工具 = 绑定到卡组的全屏 H5 zip 包（index.html + manifest.json + assets/）。
进入卡组 = 打开工具；数据 / 进度 / 埋点通过 \`window.cardAPI\` 桥接。

> **开发工具请使用 skill：dragoncard-tool-builder**
> \`dragoncard_tools/.skill/dragoncard-tool-builder/\`（SKILL.md + cardapi / manifest /
> example 参考）；完整规范见 \`dragoncard_tools/TOOL_PACK.md\`。

## 工具结构

\`\`\`
my-tool/
├── index.html     # 入口（必需）
├── manifest.json  # 元信息
└── assets/        # 自包含资源（css / js / 图片，不联网）
\`\`\`

## manifest.json

| 字段 | 必填 | 说明 |
|------|------|------|
| name | 是 | 工具显示名 |
| lang | 否 | TTS 语言（BCP47，默认 zh） |
| description | 否 | 简介 |
| fields | 否 | 卡片数据字段名列表 |
| trackedActions | 否 | 埋点动作（≤5） |
| icon | 否 | 工具图标（相对 assets 的路径） |

## cardAPI（注入在工具 <head>）

| 方法 | 说明 |
|------|------|
| getPage(page, size) | 分页取卡（含 is_unknown / is_favorite / current_order） |
| mark(itemId, isUnknown) | 标记未知（true / false） |
| favorite(itemId, fav) | 收藏 / 取消 |
| track(action, itemId) | 埋点（**必须带 itemId**，用已声明动作） |
| playAudio(text) | TTS 朗读 |
| finish() | 结束 |

## 数据（cards.json）

- 对象数组，每条 \`{ item_order, data }\`；\`item_order\` 从 **1** 递增（导入覆盖键）
- \`data\` 字段结构由工具定义（manifest.fields 约定）

## 绑定

管理卡组 → 上传 zip 绑定 / 重新上传 / 下载 / 解绑；进入卡组即打开工具。`;

/* ===== Skin System =====
   default = light (no decor), dark = dark mode (no decor).
   Custom skins can add side-gutter decor + optional CSS overrides.
   Skins are independent; switching to a skin fully replaces the previous one. */
var SKINS = {
    default: { id: 'default', name: 'Default', icon: 'fa-sun', dark: false, css: '', html: '', js: '' },
    dark:    { id: 'dark', name: 'Dark', icon: 'fa-moon', dark: true, css: '', html: '', js: '' },
    ocean: { id: 'ocean', name: 'Ocean', icon: 'fa-water', dark: false, css: 'body[data-skin="ocean"]{--hp-primary:#1f7fbf;--hp-primary-soft:rgba(31,127,191,.10);--hp-primary-dark:#1a6fa3;--hp-success:#1f9d6b;--hp-warning:#d9a441;--hp-danger:#d24d57;--hp-bg:#dcf0f6;--hp-card:#f4fbfd;--hp-sidebar:#e3f2f6;--hp-header:#f4fbfd;--hp-border:#b7d8e2;--hp-text:#123d50;--hp-text-sub:#3d667a;--hp-text-light:#7ea3b3;--hp-shadow:0 4px 24px rgba(0,0,0,.05);--hp-shadow-hover:0 8px 30px rgba(31,127,191,.15);--study-bg:#d9eef4;--study-bg-end:#c8e6ef;--study-sidebar:#f0fafd;--study-card-bg:#ffffff;--study-content-bg:#d9edf3;--study-shadow:0 4px 20px rgba(0,0,0,.06);--study-shadow-hover:0 8px 30px rgba(31,127,191,.15)}body[data-skin="ocean"] .app-main{background:linear-gradient(180deg,#e8f6fa,#cfe9f2)}', html: '', js: '' },
    starry: { id: 'starry', name: 'Starry', icon: 'fa-star', dark: true, css: 'body[data-skin="starry"]{--hp-bg:#0e1430;--hp-card:#1a2140;--hp-sidebar:#111735;--hp-header:#161e3a;--hp-border:#2b3560;--hp-text:#e8ecff;--hp-text-sub:#a6b0d8;--hp-text-light:#7e89b5;--hp-primary:#8ba0f0;--hp-primary-soft:rgba(139,160,240,.16);--hp-primary-dark:#6f86e0;--hp-success:#5ad6a0;--hp-warning:#e0b352;--hp-danger:#f0697a;--hp-shadow:0 4px 24px rgba(0,0,0,.45);--hp-shadow-hover:0 8px 30px rgba(139,160,240,.25);--study-bg:#0c1128;--study-bg-end:#0c1128;--study-sidebar:#141b38;--study-card-bg:#1c2344;--study-content-bg:#121a34;--study-shadow:0 4px 20px rgba(0,0,0,.35);--study-shadow-hover:0 8px 30px rgba(0,0,0,.45)}body[data-skin="starry"] .app-main{background:radial-gradient(circle at 50% 0%,#2a3566,#0e1430 70%)}', html: '', js: '' },
    scifi: { id: 'scifi', name: 'Sci-Fi', icon: 'fa-microchip', dark: true, css: 'body[data-skin="scifi"]{--hp-bg:#0a0f1a;--hp-card:#10161f;--hp-sidebar:#0c1119;--hp-header:#0f1620;--hp-border:#1f3341;--hp-text:#d6f5f5;--hp-text-sub:#8fb6bd;--hp-text-light:#5f838c;--hp-primary:#22d3ee;--hp-primary-soft:rgba(34,211,238,.15);--hp-primary-dark:#0ea5c4;--hp-success:#34d399;--hp-warning:#f0b857;--hp-danger:#f87171;--hp-shadow:0 4px 24px rgba(0,0,0,.5);--hp-shadow-hover:0 8px 30px rgba(34,211,238,.28);--study-bg:#08101a;--study-bg-end:#08101a;--study-sidebar:#0f1a26;--study-card-bg:#122233;--study-content-bg:#0d1a26;--study-shadow:0 4px 20px rgba(0,0,0,.4);--study-shadow-hover:0 8px 30px rgba(0,0,0,.5)}body[data-skin="scifi"] .app-main{background:linear-gradient(180deg,#0b141f,#08101a)}', html: '', js: '' },
};

var _skinStyleEl = null;
var _skinDecoEl = null;
var _skinJsFn = null;

function applySkin() {
    var id = state.skinId;
    var skin = SKINS[id] || SKINS['default'];
    state.skinId = skin.id;
    state.darkTheme = !!skin.dark;

    /* body class + attribute for CSS scoping */
    document.body.classList.toggle('dark-mode', state.darkTheme);
    document.body.dataset.skin = skin.id;

    /* inject skin CSS */
    if (skin.css) {
        if (!_skinStyleEl) {
            _skinStyleEl = document.createElement('style');
            _skinStyleEl.id = 'skin-css';
            document.head.appendChild(_skinStyleEl);
        }
        _skinStyleEl.textContent = skin.css;
    } else if (_skinStyleEl) {
        _skinStyleEl.textContent = '';
    }

    /* inject decoration layer */
    if (skin.html) {
        if (!_skinDecoEl) {
            _skinDecoEl = document.createElement('div');
            _skinDecoEl.id = 'skin-deco';
            _skinDecoEl.className = 'skin-deco';
            document.body.appendChild(_skinDecoEl);
        }
        _skinDecoEl.innerHTML = skin.html;
    } else if (_skinDecoEl) {
        _skinDecoEl.innerHTML = '';
    }

    /* run optional skin JS */
    if (_skinJsFn) { try { _skinJsFn(); } catch (e) {} }
    _skinJsFn = null;
    if (skin.js) {
        try { _skinJsFn = new Function(skin.js)(); } catch (e) {}
    }

    localStorage.setItem('dc-skin-id', skin.id);
    localStorage.setItem('dc-dark-theme', state.darkTheme ? '1' : '0');
    renderSkinList();
}

function renderSkinList() {
    var list = $('#skin-list');
    if (!list) return;
    var html = '';
    Object.keys(SKINS).forEach(function (id) {
        var s = SKINS[id];
        var active = state.skinId === id ? ' active' : '';
        html += '<div class="skin-option' + active + '" data-skin-option="' + id + '"><i class="fa-solid ' + s.icon + '"></i><span>' + (t('skin.' + id) || s.name) + '</span></div>';
    });
    list.innerHTML = html;
}

function toggleSkinDropdown(force) {
    var dd = $('#skin-dropdown');
    if (!dd) return;
    var show = force !== undefined ? force : dd.style.display === 'none';
    dd.style.display = show ? 'block' : 'none';
    if (show) renderSkinList();
}

/* ===== i18n ===== */
function t(key, vars) { return window.i18n ? window.i18n.t(key, vars) : key; }

/* Apply translations to static DOM elements marked with data-i18n / data-i18n-tooltip / data-i18n-placeholder */
function applyStaticI18n() {
    if (!window.i18n) return;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
        el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
    document.querySelectorAll('[data-i18n-tooltip]').forEach(function (el) {
        el.setAttribute('data-tooltip', t(el.dataset.i18nTooltip));
        el.setAttribute('title', t(el.dataset.i18nTooltip));
    });
}

/* Toggle language and refresh the whole app view */
function toggleLang() {
    if (!window.i18n) return;
    window.i18n.toggle();
    applyStaticI18n();
    renderSkinList();
    updateLangBtn();
    renderSagesPop();
    /* Re-render current view so dynamic text updates */
    renderDeckList();
    /* Refresh achievements page if visible (reloads data, avoids undefined) */
    var achPage = document.getElementById('ph-achievements');
    if (achPage && achPage.classList.contains('visible')) {
        loadAchievements();
    }
    /* Refresh manage modal if open so template list / preview stay intact */
    var manageModal = $('#manage-modal');
    if (manageModal && manageModal.style.display === 'flex' && _manageDeckId) {
        openManageModal(_manageDeckId);
    }
    /* Refresh stats page if visible */
    var statsPage = document.getElementById('ph-stats');
    if (statsPage && statsPage.classList.contains('visible') && _stats.actionsLoaded) {
        loadStatsData();
    }
    /* Refresh docs page if visible */
    var docsPage = document.getElementById('ph-docs');
    if (docsPage && docsPage.classList.contains('visible') && window.renderDocs) {
        renderDocs();
    }
}

function updateLangBtn() {
    var btn = $('#lang-toggle-btn');
    if (btn) btn.querySelector('.lang-label').textContent = (window.i18n && window.i18n.lang === 'en') ? '中' : 'EN';
}

/* ===== View Switching ===== */
function showDeckView() {
    state.mode = 'decks';
    $('#home-panel').style.display = 'flex';
    renderDeckList();
}

/* ===== Deck List (blue theme home page) ===== */
function progressColor(pct) {
    if (pct > 70) return 'var(--hp-success)';
    if (pct > 40) return 'var(--hp-warning)';
    return 'var(--hp-primary)';
}

/* Deck kind filter state: null = all, 'recent' = last 3 studied, otherwise a kind key */
var _deckKindFilter = 'recent';
/* Cache of /v1/decks response (decks array). Refreshed on data changes. */
var _decksCache = null;

/* Render the type filter bar: [最近] [全部] [语言] [知识] [逻辑] [技能] [其它] */
function renderDeckKindFilter() {
    var container = $('#deck-kind-filter');
    if (!container) return;
    var html = '';
    html += '<button class="deck-kind-tab' + (_deckKindFilter === 'recent' ? ' active' : '') + '" data-kind="recent" style="--kcolor:#f97316;' + (_deckKindFilter === 'recent' ? 'border-color:#f97316;color:#f97316;' : '') + '"><i class="fa-solid fa-fire"></i> ' + t('home.filterRecent') + '</button>';
    html += '<button class="deck-kind-tab' + (_deckKindFilter === '' || _deckKindFilter === null ? ' active' : '') + '" data-kind="" data-dbl="1">' + t('home.filterAll') + '</button>';
    Object.keys(DECK_KIND_META).forEach(function (k) {
        var meta = DECK_KIND_META[k];
        var active = _deckKindFilter === k;
        html += '<button class="deck-kind-tab' + (active ? ' active' : '') + '" data-kind="' + k + '" style="--kcolor:' + meta.color + ';' + (active ? 'border-color:' + meta.color + ';color:' + meta.color + ';' : '') + '">' + meta.icon + ' ' + t(meta.i18n) + '</button>';
    });
    container.innerHTML = html;
}

function setDeckKindFilter(kind) {
    _deckKindFilter = kind || '';
    renderDeckKindFilter();
    renderDeckList();
}

function renderDeckList(forceRefresh) {
    var grid = $('#deck-grid');
    if (!grid) return;
    renderDeckKindFilter();
    if (!state.userId) return;

    var doRender = function (decks) {
        /* Sort by most recent study time, freshly-used decks on top. */
        decks.sort(function (a, b) {
            var at = a.last_studied_at || '';
            var bt = b.last_studied_at || '';
            if (at === bt) return 0;
            return at > bt ? -1 : 1;
        });
        /* 'recent' shows only the 3 most recently studied decks. */
        if (_deckKindFilter === 'recent') {
            decks = decks.filter(function (dk) { return dk.last_studied_at; }).slice(0, 3);
        } else if (_deckKindFilter) {
            decks = decks.filter(function (dk) { return (dk.kind || 'other') === _deckKindFilter; });
        }
        if (!decks.length) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--hp-text-sub);">' +
                '<i class="fa-solid fa-layer-group" style="font-size:48px;margin-bottom:16px;display:block;color:var(--hp-text-light);"></i>' +
                '<div style="font-size:18px;font-weight:700;margin-bottom:8px;color:var(--hp-text);">' + t('home.empty.title') + '</div>' +
                '<div style="font-size:13px;">' + t('home.empty.desc') + '</div></div>';
            updateHomeStats([]);
            return;
        }
        var html = '';
        decks.forEach(function (deck) {
            var kindMeta = getKindMeta(deck.kind);
            var pct = deck.item_count > 0 ? Math.round((deck.mastered_count || 0) / deck.item_count * 100) : 0;
            var isActive = deck.is_active;

            html += '<div class="deck-card" data-deck-id="' + deck.id + '" data-study-deck="' + deck.id + '">';

            /* Manage button (hover only, top-right) */
            html += '<button class="deck-manage-btn deck-stats-btn" data-deck-stats="' + deck.id + '" title="' + t('common.stats') + '"><i class="fa-solid fa-chart-simple"></i></button>';
            html += '<button class="deck-manage-btn" data-manage-deck="' + deck.id + '" title="' + t('common.manage') + '"><i class="fa-solid fa-gear"></i></button>';

            /* Active badge top-right */
            if (isActive) {
                html += '<span class="active-pill">' + t('home.active') + '</span>';
            }

            /* Header: kind icon + kind label + deck name */
            html += '<div class="deck-header">';
            html += '<div class="deck-icon" style="background:' + kindMeta.bg + ';color:' + kindMeta.color + '">' + kindMeta.icon + '</div>';
            html += '<div class="deck-header-text">';
            html += '<div class="deck-title">' + escapeHtml(deck.name) + '</div>';
            html += '<div class="deck-kind-label" style="color:' + kindMeta.color + '"><i class="fa-solid fa-tag"></i> ' + kindLabel(deck.kind) + '</div>';
            html += '</div>';
            html += '</div>';

            /* Description: tool description (falls back to template description). */
            html += '<div class="deck-desc" title="' + (deck.tool_description ? escapeHtml(deck.tool_description) : '') + '">' + (deck.tool_description ? escapeHtml(deck.tool_description) : t('home.notBound')) + '</div>';

            /* Stats (mastered count left, study rounds right) */
            html += '<div class="deck-stats">';
            html += '<span>' + t('home.mastered') + ' <b>' + (deck.mastered_count || 0).toLocaleString() + '</b> / ' + (deck.item_count || 0).toLocaleString() + '</span>';
            if (deck.round_count > 0) {
                html += '<span class="deck-rounds"><i class="fa-solid fa-rotate"></i> ' + (deck.round_count || 0) + ' ' + t('home.rounds') + '</span>';
            } else {
                html += '<span class="deck-rounds not-started"><i class="fa-solid fa-rotate"></i> ' + t('home.notStarted') + '</span>';
            }
            html += '</div>';

            /* Progress bar */
            html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%;background:' + progressColor(pct) + '"></div></div>';

            /* Tool binding footer: tool name left, study days right */
            html += '<div class="deck-tpl-row">';
            if (deck.tool_name) {
                html += '<span class="deck-tpl-badge">' + escapeHtml(deck.tool_name) + '</span>';
            } else {
                html += '<span class="deck-tpl-badge unbind">' + t('home.notBound') + '</span>';
            }
            html += '<span class="deck-year-days"><i class="fa-solid fa-hand-fist"></i> <b>' + (deck.year_study_days || 0) + '</b> ' + t('home.yearDays') + '</span>';
            html += '</div>';

            html += '</div>';
        });
        grid.innerHTML = html;
        updateHomeStats(decks);
    };

    /* Use cache unless a data-changing action forced a refresh. */
    if (!forceRefresh && _decksCache) {
        doRender(_decksCache.slice());
        return;
    }
    fetch('/v1/decks?user_id=' + state.userId).then(function (r) { return r.json(); }).then(function (d) {
        var decks = d.decks || [];
        _decksCache = decks.slice();
        doRender(decks);
    }).catch(function () {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--hp-danger);">Failed to load decks</div>';
    });
}

function updateHomeStats(decks) {
    decks = decks || [];
    var totalDecks = decks.length;
    var totalCards = decks.reduce(function (s, d) { return s + (d.item_count || 0); }, 0);

    var elDecks = document.getElementById('stat-decks');
    var elCards = document.getElementById('stat-cards');
    if (elDecks) elDecks.textContent = totalDecks;
    if (elCards) elCards.textContent = totalCards.toLocaleString();

    /* Real streak from achievements API (computed from study rounds) */
    if (state.userId) {
        fetch('/v1/achievements?user_id=' + state.userId).then(function (r) { return r.json(); }).then(function (d) {
            var elStreak = document.getElementById('stat-streak');
            if (elStreak && d.success && d.data) {
                elStreak.textContent = d.data.streak_days || 0;
            }
        }).catch(function () {});
    }
}

/* ===== Study Mode ===== */
function enterDeck(deckId) {
    state.deckId = deckId;
    state.cards = {};
    state.tabs = [];
    state.activeTab = 'catalogue';
    state.enteredPages = new Set();

    fetch('/v1/decks/' + deckId).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) { showToast('Deck not found', true); return; }
        state.currentDeck = d.deck;

        /* 表现与数据分离：卡组绑定工具 → 打开工具（全屏新 tab）；未绑定 → 提示 */
        if (d.deck.tool_id) {
            var url = '/v1/tools/' + d.deck.tool_id + '/run?deck_id=' + deckId + '&user_id=' + (state.userId || 1);
            window.open(url, '_blank');
            return;
        }
        showToast(t('study.bindTool') || '该卡组还没有绑定小工具，请先在管理页绑定');
        openManageModal(deckId);
    });
}

/* ===== Loading & API calls ===== */
function loadInfo() {
    if (!state.userId || !state.deckId) return Promise.resolve();
    return fetch('/v1/learn/info?user_id=' + state.userId + '&deck_id=' + state.deckId)
        .then(function (r) { return r.json(); })
        .then(function (d) { state.info = d; state.totalPages = Math.ceil(d.total_words / 100) || 0; })
        .then(function () {
            return fetch('/v1/learn/page_status?user_id=' + state.userId + '&deck_id=' + state.deckId)
                .then(function (r) { return r.json(); })
                .then(function (d) { state.markedPages = d.marked_pages_count || 0; });
        })
        .then(function () { updateStatsText(); });
}

/* ===== Init ===== */
function initApp() {
    fetch('/v1/users').then(function (r) { return r.json(); }).then(function (d) {
        var defaultUser = d.users.find(function (u) { return u.username === 'default'; });
        state.userId = defaultUser ? defaultUser.id : (d.users[0] ? d.users[0].id : null);
        if (state.userId) showDeckView();
    });
    applySkin();
    applyStaticI18n();
    renderSkinList();
    updateLangBtn();
    localStorage.removeItem('dc-card-font-weight');
    applyCardFont();
    initSages();

    /* Templates are uploaded later inside the deck management modal */
}

/* ===== Stats ===== */
function updateStatsText() {
    var el = $('#refresh-stats span');
    if (el) el.textContent = state.info.unknown_count + ' / ' + state.info.total_words;
}

/* ===== Card Font (size only) — scales card CONTENT text only, not the card box ===== */
function applyCardFont() {
    document.documentElement.style.setProperty('--card-font-scale', String(state.fontSize));
    localStorage.setItem('dc-card-font-scale', String(state.fontSize));
    var sv = $('#font-size-value');
    if (sv) sv.textContent = Math.round(state.fontSize * 100) + '%';
}

function renderVoiceDropdown() {
    var list = $('.voice-list');
    if (!list) return;
    list.innerHTML = '';

    var currentLang = voiceMgr._currentLang;
    var currentPrimary = currentLang ? voiceMgr._primary(currentLang) : null;

    /* Filter voices to the current template's language when in study mode */
    var voices = voiceMgr.voices;
    if (currentPrimary) {
        voices = voices.filter(function (v) { return voiceMgr._primary(v.lang) === currentPrimary; });
    }

    var activeUri = null;
    if (currentLang) {
        var pick = voiceMgr.pickVoice(currentLang);
        if (pick) activeUri = pick.voiceURI;
    }

    if (!voices.length) {
        var empty = document.createElement('div');
        empty.className = 'voice-option muted';
        empty.textContent = currentPrimary ? ('No voices for ' + currentPrimary + '. Click to test system default.') : 'No voices available';
        empty.dataset.lang = currentPrimary || 'en';
        empty.style.cursor = 'pointer';
        empty.addEventListener('click', function () {
            voiceMgr.saveVoice(currentPrimary || 'en', null);
            voiceMgr.firstCardWord(function (word) {
                var u = new SpeechSynthesisUtterance(word || voiceMgr.sampleText(currentPrimary || 'en'));
                u.lang = currentPrimary || 'en';
                speechSynthesis.speak(u);
            });
            renderVoiceDropdown();
        });
        list.appendChild(empty);
        return;
    }

    var langNames = { en: 'English', ja: '日本語', zh: '中文', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', ru: 'Русский' };
    var showHeader = !currentPrimary;
    if (showHeader) {
        var groups = {};
        voices.forEach(function (v) {
            var g = voiceMgr._primary(v.lang) || 'other';
            if (!groups[g]) groups[g] = [];
            groups[g].push(v);
        });
        Object.keys(groups).sort().forEach(function (g) {
            var header = document.createElement('div');
            header.className = 'voice-group-header';
            header.textContent = langNames[g] || g;
            list.appendChild(header);
            groups[g].forEach(function (v) {
                var opt = document.createElement('div');
                opt.className = 'voice-option' + (v.voiceURI === activeUri ? ' active' : '');
                opt.dataset.voiceUri = v.voiceURI;
                opt.dataset.lang = g;
                opt.textContent = v.name;
                list.appendChild(opt);
            });
        });
    } else {
        voices.forEach(function (v) {
            var opt = document.createElement('div');
            opt.className = 'voice-option' + (v.voiceURI === activeUri ? ' active' : '');
            opt.dataset.voiceUri = v.voiceURI;
            opt.dataset.lang = currentPrimary;
            opt.textContent = v.name;
            list.appendChild(opt);
        });
    }
}

/* ===== Achievements Page ===== */
var _ach = { loaded: false };
var _ROUND_TITLES = [
    { min: 1,  name: 'ach.title.round1' },
    { min: 4,  name: 'ach.title.round2' },
    { min: 7,  name: 'ach.title.round3' },
    { min: 10, name: 'ach.title.round4' },
    { min: 13, name: 'ach.title.round5' },
    { min: 16, name: 'ach.title.round6' },
    { min: 19, name: 'ach.title.round7' }
];
var _STREAK_TIERS = [
    { days: 7,  icon: '<i class="fa-solid fa-seedling" style="color:#22c55e"></i>', name: 'ach.streak7', desc: 'ach.streak7desc' },
    { days: 30, icon: '<i class="fa-solid fa-tree" style="color:#16a34a"></i>', name: 'ach.streak30', desc: 'ach.streak30desc' },
    { days: 60, icon: '<i class="fa-solid fa-mountain" style="color:#059669"></i>', name: 'ach.streak60', desc: 'ach.streak60desc' }
];
var _DECK_ACHIEVEMENTS = [
    { icon: '<i class="fa-solid fa-mountain" style="color:#3b82f6"></i>', name: 'ach.deck1', desc: 'ach.deck1desc', key: 'deck_count', target: 1 },
    { icon: '<i class="fa-solid fa-book-open" style="color:#8b5cf6"></i>', name: 'ach.deck5', desc: 'ach.deck5desc', key: 'deck_count', target: 5 },
    { icon: '<i class="fa-solid fa-landmark" style="color:#f59e0b"></i>', name: 'ach.deck10000', desc: 'ach.deck10000desc', key: 'mastered_cards', target: 10000 }
];
var _INTERACTION_ACHIEVEMENTS = [
    { icon: '<i class="fa-solid fa-volume-high" style="color:#ec4899"></i>', name: 'ach.inter1', desc: 'ach.inter1desc', key: 'audio_play', tiers: [1000, 5000, 10000, 100000] },
    { icon: '<i class="fa-solid fa-pen" style="color:#06b6d4"></i>', name: 'ach.inter2', desc: 'ach.inter2desc', key: 'word_mark', tiers: [100, 500, 1000, 2000, 5000, 10000] }
];

function initAchievementsPage() {
    _ach.loaded = true;
    loadAchievements();
}

function destroyAchievementsPage() {
    _ach.loaded = false;
}

function loadAchievements() {
    var container = $('#ach-container');
    if (!container) return;
    container.innerHTML = '<div class="ach-empty">' + t('ach.loading') + '</div>';
    if (!state.userId) return;
    fetch('/v1/achievements?user_id=' + state.userId).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success || !d.data) {
            container.innerHTML = '<div class="ach-empty">' + t('ach.loadFailed') + '</div>';
            return;
        }
        renderAchievements(d.data);
    }).catch(function () {
        container.innerHTML = '<div class="ach-empty">' + t('ach.loadFailed') + '</div>';
    });
}

function roundTitle(rounds) {
    var name = null, idx = -1;
    _ROUND_TITLES.forEach(function (t, i) {
        if (rounds >= t.min) { name = t.name; idx = i; }
    });
    if (name === null) return { name: t('ach.notStarted'), idx: -1 };
    return { name: name, idx: idx };
}

function achCard(icon, name, desc, value, target, unlocked) {
    var pct = target > 0 ? Math.min(100, Math.round(value / target * 100)) : 0;
    return '<div class="ach-card' + (unlocked ? ' unlocked' : '') + '">' +
        '<div class="ach-card-head"><span class="ach-icon">' + icon + '</span><span class="ach-name">' + t(name) + '</span></div>' +
        '<div class="ach-desc">' + t(desc) + '</div>' +
        '<div class="ach-progress-bar"><div style="width:' + pct + '%"></div></div>' +
        '<div class="ach-progress-text">' + value.toLocaleString() + ' / ' + target.toLocaleString() + (unlocked ? ' · ' + t('ach.unlocked') : '') + '</div>' +
        '</div>';
}

function renderAchievements(data) {
    var container = $('#ach-container');
    if (!container) return;
    var html = '';

    /* 称号 · 按卡组轮次 */
    var decksHtml = '';
    if (!data.decks.length) {
        decksHtml = '<div class="ach-empty">' + t('ach.roundEmpty') + '</div>';
    } else {
        data.decks.forEach(function (deck) {
            var r = roundTitle(deck.rounds);
            var next = _ROUND_TITLES[r.idx + 1];
            var val = deck.rounds, target, extra;
            if (r.idx === -1) { target = 1; extra = t('ach.roundGet'); }
            else if (next) {
                target = next.min;
                extra = t('ach.nextTitle', { name: t(next.name), n: Math.max(0, next.min - deck.rounds) });
            } else {
                target = deck.rounds; extra = t('ach.maxTitle');
            }
            decksHtml += '<div class="ach-card unlocked">' +
                '<div class="ach-card-head"><span class="ach-icon">👑</span><span class="ach-name">' + t(r.name) + '</span></div>' +
                '<div class="ach-desc">' + escapeHtml(deck.name) + '</div>' +
                '<div class="ach-progress-bar"><div style="width:' + (target > 0 ? Math.min(100, Math.round(val / target * 100)) : 100) + '%"></div></div>' +
                '<div class="ach-progress-text">' + t('ach.rounds', { n: val }) + ' · ' + extra + '</div>' +
                '</div>';
        });
    }
    html += '<div class="ach-section-title">' + t('ach.sectionRound') + '</div><div class="ach-grid">' + decksHtml + '</div>';

    /* 累计学习 · 连续天数 */
    var streakHtml = '';
    _STREAK_TIERS.forEach(function (a) {
        var unlocked = data.streak_days >= a.days;
        streakHtml += achCard(a.icon, a.name, a.desc, data.streak_days, a.days, unlocked);
    });
    html += '<div class="ach-section-title">' + t('ach.sectionStreak') + '</div><div class="ach-grid">' + streakHtml + '</div>';

    /* 卡组 */
    var deckAchHtml = '';
    _DECK_ACHIEVEMENTS.forEach(function (a) {
        var unlocked = data[a.key] >= a.target;
        deckAchHtml += achCard(a.icon, a.name, a.desc, data[a.key] || 0, a.target, unlocked);
    });
    html += '<div class="ach-section-title">' + t('ach.sectionDecks') + '</div><div class="ach-grid">' + deckAchHtml + '</div>';

    /* 互动 */
    var interHtml = '';
    _INTERACTION_ACHIEVEMENTS.forEach(function (a) {
        var value = data[a.key] || 0;
        var reached = 0;
        a.tiers.forEach(function (tier) { if (value >= tier) reached++; });
        var target = reached < a.tiers.length ? a.tiers[reached] : a.tiers[a.tiers.length - 1];
        var unlocked = reached === a.tiers.length;
        var name = t(a.name) + (reached > 0 ? t('ach.levels', { n: reached }) : '');
        var desc = t(a.desc) + '：' + a.tiers.map(function (tier) { return tier.toLocaleString(); }).join(' / ');
        interHtml += achCard(a.icon, name, desc, value, target, unlocked);
    });
    html += '<div class="ach-section-title">' + t('ach.sectionInteraction') + '</div><div class="ach-grid">' + interHtml + '</div>';

    container.innerHTML = html;
}

/* ===== Mastery Statistics Modal ===== */
function openMasteryModal(deckId) {
    var modal = $('#mastery-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    var mt = $('#mastery-title-text');
    if (mt) mt.textContent = t('mastery.title');
    switchMasteryTab('heatmap');
    $('#mastery-heatmap').innerHTML = '<div class="mastery-empty">' + t('mastery.loading') + '</div>';
    $('#mastery-categorized').innerHTML = '';
    $('#mastery-rounds').innerHTML = '';
    if (!state.userId) return;
    fetch('/v1/decks/' + deckId + '/mastery?user_id=' + state.userId)
        .then(function (r) { return r.json(); })
        .then(function (d) {
            if (!d.success || !d.data) {
                $('#mastery-heatmap').innerHTML = '<div class="mastery-empty">' + t('mastery.loadFailed') + '</div>';
                return;
            }
            $('#mastery-title-text').textContent = t('mastery.title') + ' · ' + d.data.deck_name;
            renderMasteryHeatmap(d.data);
            renderMasteryCategorized(d.data);
            renderMasteryRounds(d.data);
        })
        .catch(function () {
            $('#mastery-heatmap').innerHTML = '<div class="mastery-empty">' + t('mastery.loadFailed') + '</div>';
        });
}

function closeMasteryModal() {
    var modal = $('#mastery-modal');
    if (modal) modal.style.display = 'none';
}

function switchMasteryTab(tab) {
    $$('.mastery-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.mtab === tab); });
    $$('.mastery-pane').forEach(function (p) { p.style.display = p.id === 'mastery-' + tab ? '' : 'none'; });
}

function renderMasteryHeatmap(data) {
    var el = $('#mastery-heatmap');
    if (!el) return;
    var states = data.states || [];
    if (!states.length) { el.innerHTML = '<div class="mastery-empty">' + t('mastery.noCards') + '</div>'; return; }
    var note = t('mastery.noteHeatmap');
    el.innerHTML = mhLegend() + '<div class="mastery-note">' + note + '</div>' + mhGrid(states);
}

function renderMasteryCategorized(data) {
    var el = $('#mastery-categorized');
    if (!el) return;
    var states = (data.states || []).slice().sort(function (a, b) { return a - b; });
    if (!states.length) { el.innerHTML = '<div class="mastery-empty">' + t('mastery.noCards') + '</div>'; return; }
    var note = t('mastery.noteCategorized');
    el.innerHTML = mhLegend() + '<div class="mastery-note">' + note + '</div>' + mhGrid(states);
}

function mhLegend() {
    return '<div class="mh-legend">' +
        '<span><i class="d-mastered"></i>' + t('mastery.legendMastered') + '</span>' +
        '<span><i class="d-unknown"></i>' + t('mastery.legendUnknown') + '</span></div>';
}

function mhGrid(states) {
    var html = '<div class="mh-grid">';
    states.forEach(function (s) {
        html += '<div class="mh-cell ' + (s ? 'unknown' : 'mastered') + '"></div>';
    });
    html += '</div>';
    return html;
}

function renderMasteryRounds(data) {
    var el = $('#mastery-rounds');
    if (!el) return;
    var rounds = data.rounds || [];
    if (!rounds.length) { el.innerHTML = '<div class="mastery-empty">' + t('mastery.noRounds') + '</div>'; return; }
    var maxMarked = 1;
    rounds.forEach(function (r) { if (r.marked_count > maxMarked) maxMarked = r.marked_count; });
    var html = '<div class="mastery-note">' + t('mastery.noteRounds') + '</div>';
    html += '<div class="rp-wrap">';
    rounds.slice().reverse().forEach(function (r) {
        var pct = Math.max(r.marked_count / maxMarked * 100, 1);
        var d = r.end_time ? r.end_time.slice(0, 10) : '—';
        html += '<div class="rp-row">';
        html += '<div class="rp-label"><b>' + t('mastery.round', { n: r.round_number }) + '</b>' + d + '</div>';
        html += '<div class="rp-track"><div class="rp-bar" style="width:' + pct + '%;"></div></div>';
        html += '<div class="rp-count">' + r.marked_count + '</div>';
        html += '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
}

/* ===== Stats Page ===== */
var _stats = {
    view: 'heatmap',
    currentDate: new Date(),
    deckId: null,
    actionConfig: {},
    rawData: [],
    actionsLoaded: false
};
var _PALETTE = ['#4F46E5', '#8B5CF6', '#EC4899', '#22D3EE', '#F97316', '#22c55e', '#EAB308', '#06B6D4', '#A855F7', '#EF4444'];

function _pad2(n) { return String(n).padStart(2, '0'); }
function _fmtDate(d) { return d.getFullYear() + '-' + _pad2(d.getMonth() + 1) + '-' + _pad2(d.getDate()); }

function initStatsPage() {
    /* Sync view buttons to the current _stats.view (defaults to heatmap) */
    $$('.stats-view-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.view === _stats.view); });
    loadStatsDecks();
    loadStatsActions();
    updateStatsDateDisplay();
    loadStatsData();
}

function destroyStatsPage() {
    /* Keep view + deckId so returning to the page preserves the user's selection */
    if (_statsChart) {
        _statsChart.dispose();
        _statsChart = null;
        _statsChartInited = false;
    }
    _stats.actionConfig = {};
    _stats.rawData = [];
    _stats.actionsLoaded = false;
}

function loadStatsDecks() {
    if (!state.userId) return;
    fetch('/v1/decks?user_id=' + state.userId)
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var sel = $('#stats-deck-select');
            if (!sel) return;
            sel.innerHTML = '<option value="">' + t('stats.allDecks') + '</option>';
            (d.decks || []).forEach(function(deck) {
                var opt = document.createElement('option');
                opt.value = deck.id;
                opt.textContent = deck.name || 'Deck ' + deck.id;
                sel.appendChild(opt);
            });
            if (_stats.deckId) sel.value = String(_stats.deckId);
        });
}

function loadStatsActions() {
    var params = new URLSearchParams();
    if (state.userId) params.set('user_id', state.userId);
    if (_stats.deckId) params.set('deck_id', _stats.deckId);
    fetch('/v1/observability/actions?' + params.toString())
        .then(function(r) { return r.json(); })
        .then(function(d) {
            _stats.actionConfig = {};
            (d.actions || []).forEach(function(item, i) {
                var actionName = typeof item === 'string' ? item : item.action;
                var actionLabel = typeof item === 'string'
                    ? item.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); })
                    : (item.label || actionName);
                _stats.actionConfig[actionName] = {
                    label: actionLabel,
                    color: _PALETTE[i % _PALETTE.length]
                };
            });
            _stats.actionsLoaded = true;
            renderStatsCards();
        });
}

function loadStatsData() {
    var params = new URLSearchParams({
        view: _stats.view,
        date: _fmtDate(_stats.currentDate)
    });
    if (state.userId) params.set('user_id', state.userId);
    if (_stats.deckId) params.set('deck_id', _stats.deckId);

    fetch('/v1/observability/data?' + params.toString())
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                _stats.rawData = data.data || [];
                renderStatsCards();
                renderStatsChart();
                /* If a day/week/month view came back empty, jump to the latest date with activity */
                if (_stats.view !== 'heatmap' && !_stats.rawData.length) {
                    _loadStatsLatestDate();
                }
            }
        });
}

/* Find the latest date that has activity (via year heatmap) and re-load the current view around it */
function _loadStatsLatestDate() {
    var params = new URLSearchParams({ view: 'heatmap', date: _fmtDate(new Date()) });
    if (state.userId) params.set('user_id', state.userId);
    if (_stats.deckId) params.set('deck_id', _stats.deckId);
    fetch('/v1/observability/data?' + params.toString())
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (!d.success || !d.data || !d.data.length) return;
            /* data is sorted ascending by date; take the last non-empty one */
            var latest = null;
            d.data.forEach(function(item) {
                var total = 0;
                Object.values(item.actions || {}).forEach(function(v) { total += v; });
                if (total > 0) latest = item.date;
            });
            if (latest) {
                var parts = String(latest).split('-');
                _stats.currentDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                updateStatsDateDisplay();
                loadStatsData();
            }
        });
}

function renderStatsCards() {
    var el = $('#stats-cards');
    if (!el) return;
    var actions = Object.keys(_stats.actionConfig);
    if (!actions.length) {
        el.innerHTML = '<div class="stats-empty" style="text-align:center;padding:60px 20px;color:var(--hp-text-sub);font-size:14px;"><i class="fa-solid fa-chart-line text-4xl mb-4 block" style="color:var(--hp-text-light);"></i>' + t('stats.noRecords') + '<br><span class="text-sm">' + t('stats.noRecordsSub') + '</span></div>';
        return;
    }
    // Count totals from raw data
    var totals = {};
    actions.forEach(function(a) { totals[a] = 0; });
    _stats.rawData.forEach(function(item) {
        Object.entries(item.actions).forEach(function(entry) {
            var action = entry[0], count = entry[1];
            if (totals[action] !== undefined) totals[action] += count;
        });
    });
    var html = '';
    actions.forEach(function(a) {
        var cfg = _stats.actionConfig[a];
        html += '<div class="stats-card">'
            + '<div class="stats-card-val" style="color:' + cfg.color + '">' + totals[a].toLocaleString() + '</div>'
            + '<div class="stats-card-lbl">' + cfg.label + '</div></div>';
    });
    el.innerHTML = html;
}

function renderStatsChart() {
    var el = $('#stats-chart');
    if (!el) return;
    var actions = Object.keys(_stats.actionConfig);
    if (!actions.length || !_stats.rawData.length) {
        /* Use ECharts to show empty state (do NOT wipe the container, keeps instance alive) */
        if (typeof echarts !== 'undefined') {
            var chart = ensureStatsChart(el);
            if (chart) {
                chart.clear();
                chart.setOption({
                    title: {
                        text: t('stats.noData'),
                        left: 'center', top: 'middle',
                        textStyle: { fontSize: 14, color: '#94a3b8', fontWeight: 'normal' }
                    }
                });
                return;
            }
        }
        el.innerHTML = '<div class="stats-chart-empty">' + t('stats.noData') + '</div>';
        return;
    }
    if (_stats.view === 'heatmap') renderHeatmap(el);
    else renderBarChart(el);
}

/* ===== ECharts-based stats charts ===== */
var _statsChart = null;
var _statsChartInited = false;

function ensureStatsChart(el) {
    if (typeof echarts === 'undefined') return null;
    if (!_statsChartInited) {
        el.style.height = '100%';
        _statsChart = echarts.init(el);
        _statsChartInited = true;
        var ro = new ResizeObserver(function () { if (_statsChart) _statsChart.resize(); });
        ro.observe(el);
    }
    return _statsChart;
}

function renderHeatmap(el) {
    var chart = ensureStatsChart(el);
    if (!chart) { el.innerHTML = '<div class="stats-chart-empty">' + t('stats.noData') + '</div>'; return; }
    var year = _stats.currentDate.getFullYear();
    var isDark = state.darkTheme;
    var textColor = isDark ? '#94a3b8' : '#64748b';
    var borderColor = isDark ? '#1e293b' : '#ffffff';

    /* Prepare date -> total count + per-action breakdown */
    var countMap = {};
    var breakdownMap = {};
    _stats.rawData.forEach(function (item) {
        var total = 0;
        var bd = {};
        Object.keys(item.actions).forEach(function (a) {
            var v = item.actions[a];
            if (v > 0) { total += v; bd[a] = v; }
        });
        countMap[item.date] = total;
        breakdownMap[item.date] = bd;
    });

    /* Fill all days of the year */
    var calendarData = [];
    var startDate = new Date(year, 0, 1);
    var endDate = new Date(year, 11, 31);
    for (var dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
        var ds = _fmtDate(dt);
        calendarData.push([ds, countMap[ds] || 0]);
    }

    var chartEl = el;
    chartEl.style.height = '100%';

    var actionColors = _stats.actionConfig;
    var option = {
        backgroundColor: 'transparent',
        tooltip: {
            confine: true,
            extraCssText: 'max-height:60%;overflow-y:auto;',
            formatter: function (params) {
                var date = params.value[0], count = params.value[1];
                var bd = breakdownMap[date] || {};
                var html = '<div style="font-weight:600;margin-bottom:6px;">' + date + '</div>';
                html += '<div style="font-weight:600;margin-bottom:4px;">' + t('stats.legend') + ': ' + count + '</div>';
                Object.keys(bd).forEach(function (a) {
                    var cfg = actionColors[a];
                    var color = cfg ? cfg.color : '#94a3b8';
                    html += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;">' +
                        '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + color + '"></span>' +
                        '<span>' + (cfg ? cfg.label : a) + ': ' + bd[a] + '</span></div>';
                });
                return html;
            },
            backgroundColor: 'rgba(30,41,59,0.95)',
            borderColor: '#475569',
            textStyle: { color: '#f1f5f9' },
            appendToBody: true
        },
        visualMap: {
            type: 'piecewise',
            orient: 'horizontal',
            left: 'center',
            top: 0,
            itemWidth: 15,
            itemHeight: 15,
            textStyle: { color: textColor, fontSize: 12 },
            pieces: [
                { min: 0, max: 0, label: '0', color: isDark ? '#334155' : '#eceff1' },
                { min: 1, max: 500, label: '1-500', color: '#4fc3f7' },
                { min: 501, max: 1000, label: '501-1000', color: '#66bb6a' },
                { min: 1001, max: 1500, label: '1001-1500', color: '#ffeb3b' },
                { min: 1501, max: 2000, label: '1501-2000', color: '#ff9800' },
                { min: 2001, label: '2000+', color: '#f44336' }
            ]
        },
        calendar: {
            top: 60,
            left: 30,
            right: 30,
            bottom: 20,
            cellSize: ['auto', 16],
            range: year,
            itemStyle: { borderWidth: 2, borderColor: borderColor, borderRadius: 2 },
            yearLabel: { show: false },
            monthLabel: { color: textColor, fontSize: 12 },
            dayLabel: { firstDay: 1, color: textColor, fontSize: 11 },
            splitLine: { show: true, lineStyle: { color: borderColor, width: 2 } }
        },
        series: [{
            type: 'heatmap',
            coordinateSystem: 'calendar',
            data: calendarData,
            itemStyle: { borderRadius: 2 },
            emphasis: { itemStyle: { borderColor: 'transparent', shadowBlur: 0 } },
            select: { disabled: true },
            hoverAnimation: false
        }],
        animationDuration: 500
    };

    chart.setOption(option, true);
    chart.off('click');
    chart.on('click', function (params) {
        if (params.value && params.value[0]) {
            var parts = String(params.value[0]).split('-');
            _stats.currentDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            statsSetView('daily');
        }
    });
}

function renderBarChart(el) {
    var chart = ensureStatsChart(el);
    if (!chart) { el.innerHTML = '<div class="stats-chart-empty">' + t('stats.noData') + '</div>'; return; }

    var data = _stats.rawData;
    if (!data.length) {
        /* Show empty state via ECharts (keeps instance alive) */
        chart.clear();
        chart.setOption({
            title: {
                text: t('stats.noData'),
                left: 'center', top: 'middle',
                textStyle: { fontSize: 14, color: '#94a3b8', fontWeight: 'normal' }
            }
        });
        return;
    }

    var isDark = state.darkTheme;
    var textColor = isDark ? '#94a3b8' : '#64748b';
    var actions = Object.keys(_stats.actionConfig);

    var chartEl = el;
    chartEl.style.height = '100%';

    var categories = data.map(function (item) {
        var label = item.time || item.date || '';
        if (label.length > 5 && label.indexOf('-') >= 0) label = label.slice(5);
        return label;
    });

    var series = actions.map(function (a) {
        var cfg = _stats.actionConfig[a];
        return {
            name: cfg.label,
            type: 'bar',
            stack: 'total',
            data: data.map(function (item) { return item.actions[a] || 0; }),
            itemStyle: { color: cfg.color }
        };
    });

    var option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            confine: true,
            appendToBody: true,
            extraCssText: 'max-height:60%;overflow-y:auto;'
        },
        legend: { data: actions.map(function (a) { return _stats.actionConfig[a].label; }), textStyle: { color: textColor }, top: 0 },
        grid: { left: 50, right: 20, top: 40, bottom: 30 },
        xAxis: { type: 'category', data: categories, axisLabel: { color: textColor } },
        yAxis: { type: 'value', axisLabel: { color: textColor } },
        series: series,
        animationDuration: 400
    };

    chart.setOption(option, true);
}

function updateStatsDateDisplay() {
    var el = $('#stats-date-display');
    if (!el) return;
    var d = _stats.currentDate;
    var y = d.getFullYear(), m = _pad2(d.getMonth() + 1), day = _pad2(d.getDate());
    if (_stats.view === 'daily') el.textContent = y + '-' + m + '-' + day;
    else if (_stats.view === 'weekly') {
        var start = new Date(d);
        start.setDate(d.getDate() - d.getDay() + 1);
        var end = new Date(start);
        end.setDate(start.getDate() + 6);
        el.textContent = _fmtDate(start) + ' ~ ' + _fmtDate(end);
    } else if (_stats.view === 'monthly') el.textContent = y + '-' + m;
    else el.textContent = t('stats.lastYear');
}

function statsNavigate(dir) {
    var d = new Date(_stats.currentDate);
    if (_stats.view === 'daily') d.setDate(d.getDate() + dir);
    else if (_stats.view === 'weekly') d.setDate(d.getDate() + dir * 7);
    else if (_stats.view === 'monthly') d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    _stats.currentDate = d;
    updateStatsDateDisplay();
    loadStatsData();
}

function statsSetView(view) {
    if (_stats.view === view) return;
    _stats.view = view;
    $$('.stats-view-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.view === view); });
    updateStatsDateDisplay();
    loadStatsData();
}

/* ===== Management Modal ===== */
var _manageDeckId = null;

function openManageModal(deckId) {
    _manageDeckId = deckId;
    fetch('/v1/decks/' + deckId).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) { showToast('Deck not found', true); return; }
        var deck = d.deck;
        var kindMeta = getKindMeta(deck.kind);

        document.getElementById('mm-icon').innerHTML = kindMeta.icon;
        document.getElementById('mm-icon').style.background = kindMeta.bg;
        document.getElementById('mm-icon').style.color = kindMeta.color;
        document.getElementById('mm-name').textContent = deck.name;
        document.getElementById('mm-intro').textContent = deck.tool_description || '';
        renderMmData(deck);

        var kindSel = document.getElementById('mm-kind-select');
        if (kindSel) {
            kindSel.innerHTML = kindOptionsHtml(deck.kind || 'other');
            kindSel.dataset.deckId = deck.id;
            kindSel.onchange = function () {
                var val = this.value;
                if (!_manageDeckId) return;
                fetch('/v1/decks/' + _manageDeckId, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind: val })
                }).then(function (r) { return r.json(); }).then(function (d) {
                    if (d.success) {
                        showToast(t('kind.updated'));
                        renderDeckList(true);
                        var km = getKindMeta(val);
                        var iconEl = document.getElementById('mm-icon');
                        if (iconEl) {
                            iconEl.innerHTML = km.icon;
                            iconEl.style.background = km.bg;
                            iconEl.style.color = km.color;
                        }
                    } else {
                        showToast(d.error || t('kind.updateFailed'), true);
                        this.value = d.deck && d.deck.kind || 'other';
                    }
                }.bind(this)).catch(function () { showToast(t('kind.updateFailed'), true); });
            };
        }

        renderMmTool(deck);

        $('#manage-modal').style.display = 'flex';
    }).catch(function () { showToast('Failed to load deck info', true); });
}

function closeManageModal() {
    $('#manage-modal').style.display = 'none';
    _manageDeckId = null;
}

function renderMmTool(deck) {
    var card = document.getElementById('mm-tool-card');
    if (!card) return;
    card.innerHTML = '';
    if (deck.tool_id) {
        var iconHtml = '<i class="fa-solid fa-dragon"></i>';
        card.innerHTML =
            '<div class="mm-app-head">' +
                '<div class="mm-app-title">' + escapeHtml(deck.tool_name || '小工具') + '</div>' +
            '</div>' +
            '<div class="mm-app-icon">' + iconHtml + '</div>' +
            '<div class="mm-app-actions">' +
                '<button class="mm-action-btn" data-mm-action="replace-tool" title="' + t('tools.replace') + '"><i class="fa-solid fa-upload"></i> ' + t('tools.replaceShort') + '</button>' +
                '<button class="mm-action-btn" data-mm-action="export-tool" title="' + t('tools.export') + '"><i class="fa-solid fa-download"></i> ' + t('tools.exportShort') + '</button>' +
                '<button class="mm-action-btn danger" data-mm-action="unbind-tool" title="' + t('tools.unbind') + '"><i class="fa-solid fa-unlink"></i> ' + t('tools.unbindShort') + '</button>' +
            '</div>';
        var ub = card.querySelector('[data-mm-action="unbind-tool"]');
        if (ub) ub.addEventListener('click', function (ev) {
            ev.stopPropagation();
            unbindToolFromDeck(deck.id);
        });
        var rp = card.querySelector('[data-mm-action="replace-tool"]');
        if (rp) rp.addEventListener('click', function (ev) {
            ev.stopPropagation();
            replaceTool(deck.tool_id, deck.id);
        });
        var ex = card.querySelector('[data-mm-action="export-tool"]');
        if (ex) ex.addEventListener('click', function (ev) {
            ev.stopPropagation();
            window.location.href = '/v1/tools/' + deck.tool_id + '/export';
        });
    } else {
        card.innerHTML =
            '<div class="mm-app-empty">' +
                '<div class="mm-app-empty-text">' + t('home.notBound') + '</div>' +
                '<button class="mm-action-btn" id="mm-tool-upload-empty" title="' + t('manage.uploadTool') + '"><i class="fa-solid fa-upload"></i> ' + t('manage.uploadTool') + '</button>' +
            '</div>';
        var up = card.querySelector('#mm-tool-upload-empty');
        if (up) up.addEventListener('click', function () {
            if (_manageDeckId) bindToolToDeck(_manageDeckId);
        });
    }
}

function renderMmData(deck) {
    var card = document.getElementById('mm-data-card');
    if (!card) return;
    var count = deck.item_count || 0;
    card.innerHTML = '';
    if (count > 0) {
        card.innerHTML =
            '<div class="mm-app-head">' +
                '<div class="mm-app-title">' + escapeHtml(deck.name || '') + ' ' + t('manage.deckData') + '</div>' +
                '<div class="mm-app-sub">' + count.toLocaleString() + ' ' + t('manage.items') + '</div>' +
            '</div>' +
            '<div class="mm-app-icon"><i class="fa-solid fa-database"></i></div>' +
            '<div class="mm-app-actions">' +
                '<button class="mm-action-btn" id="mma-data" title="' + t('manage.uploadData') + '"><i class="fa-solid fa-upload"></i> ' + t('manage.uploadDataShort') + '</button>' +
                '<button class="mm-action-btn" id="ma-export" title="' + t('manage.exportData') + '"><i class="fa-solid fa-download"></i> ' + t('manage.exportDataShort') + '</button>' +
                '<button class="mm-action-btn" id="ma-goagain" title="' + t('manage.goagain') + '"><span class="swa">卍</span> ' + t('manage.goagainShort') + '</button>' +
            '</div>';
    } else {
        card.innerHTML =
            '<div class="mm-app-head">' +
                '<div class="mm-app-title">' + escapeHtml(deck.name || '') + ' ' + t('manage.deckData') + '</div>' +
            '</div>' +
            '<div class="mm-app-empty">' +
                '<div class="mm-app-empty-text">' + t('manage.noData') + '</div>' +
                '<button class="mm-action-btn" id="mm-data-import-empty" title="' + t('manage.uploadData') + '"><i class="fa-solid fa-upload"></i> ' + t('manage.uploadDataShort') + '</button>' +
            '</div>';
        var up = card.querySelector('#mm-data-import-empty');
        if (up) up.addEventListener('click', function () {
            if (_manageDeckId) doUploadDeckData(_manageDeckId);
        });
    }
}

function replaceTool(toolId, deckId) {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.zip';
    input.style.display = 'none';
    input.onchange = function () {
        var f = input.files && input.files[0];
        input.remove();
        if (!f) return;
        var fd = new FormData();
        fd.append('zip', f);
        fetch('/v1/tools/' + toolId + '/replace', { method: 'POST', body: fd }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d.success) { alert(d.error || t('tools.installFailed')); return; }
            showToast(t('tools.installed'));
            renderDeckList(true);
            refreshManageTool(d.deck);
        }).catch(function () { showToast(t('tools.installFailed'), true); });
    };
    document.body.appendChild(input);
    input.click();
}

function bindToolToDeck(deckId) {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.zip';
    input.style.display = 'none';
    input.onchange = function () {
        var f = input.files && input.files[0];
        input.remove();
        if (!f) return;
        var fd = new FormData();
        fd.append('user_id', state.userId || 1);
        fd.append('zip', f);
        fetch('/v1/decks/' + deckId + '/tool', { method: 'POST', body: fd }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d.success) { alert(d.error || t('tools.installFailed')); return; }
            showToast(t('tools.installed'));
            renderDeckList(true);
            refreshManageTool(d.deck);
        }).catch(function () { showToast(t('tools.installFailed'), true); });
    };
    document.body.appendChild(input);
    input.click();
}


function refreshManageTool(deck) {
    if (!deck) return;
    renderMmTool(deck);
    renderMmData(deck);
    var intro = document.getElementById('mm-intro');
    if (intro) intro.textContent = deck.tool_description || '';
}

function unbindToolFromDeck(deckId) {
    if (!confirm(t('tools.unbindConfirm'))) return;
    fetch('/v1/decks/' + deckId + '/tool', { method: 'DELETE' }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) { showToast(t('common.loadFailed'), true); return; }
        showToast(t('tools.unbound'));
        renderDeckList(true);
        refreshManageTool(d.deck);
    }).catch(function () { showToast(t('common.loadFailed'), true); });
}

/* ===== Create Deck (with kind picker + template select) ===== */
var _newDeckKind = 'other';

function renderKindPicker(containerId, selected) {
    var el = document.getElementById(containerId);
    if (!el) return;
    selected = selected || 'other';
    el.innerHTML = '';
    Object.keys(DECK_KIND_META).forEach(function (k) {
        var meta = DECK_KIND_META[k];
        var opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'kind-option' + (k === selected ? ' selected' : '');
        opt.dataset.kind = k;
        opt.style.setProperty('--kind-color', meta.color);
        opt.style.setProperty('--kind-bg', meta.bg);
        opt.innerHTML = '<span class="kind-option-icon">' + meta.icon + '</span><span class="kind-option-label">' + t(meta.i18n) + '</span>';
        opt.addEventListener('click', function () {
            _newDeckKind = k;
            $$('.kind-option', el).forEach(function (o) { o.classList.toggle('selected', o.dataset.kind === k); });
        });
        el.appendChild(opt);
    });
}

function doCreateDeck() {
    $('#new-deck-name-input').value = '';
    _newDeckKind = 'other';
    renderKindPicker('new-deck-kind-picker', 'other');
    showModal('new-deck');
    $('#new-deck-name-input').focus();
}

function doUploadDeckData(deckId, anchorEl) {
    var input = $('#deck-data-input');
    input.onchange = function () {
        if (!input.files || !input.files[0]) return;
        var file = input.files[0];
        var doImport = function () {
            var reader = new FileReader();
            reader.onload = function (e) {
                var jsonData;
                try { jsonData = JSON.parse(e.target.result); } catch (err) { showToast(t('toast.invalidJson'), true); return; }
                fetch('/v1/decks/' + deckId + '/import', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(jsonData)
                }).then(function (r) { return r.json(); }).then(function (d) {
                    if (d.success) {
                        showToast(t('manage.imported', { n: d.count }));
                        openManageModal(deckId);
                        if (state.deckId == deckId) { state.cards = {}; loadInfo(); }
                    } else { showToast(d.error || t('toast.importFailed'), true); }
                }).catch(function () { showToast(t('toast.importFailed'), true); });
            };
            reader.readAsText(file);
        };

        /* If the deck already has data, warn the user before overwriting. */
        fetch('/v1/decks/' + deckId)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var existingCount = d.success && d.deck && d.deck.item_count ? d.deck.item_count : 0;
                if (existingCount > 0) {
                    /* Show the centered confirm modal (matches project UI style). */
                    var msg = $('#import-confirm-msg');
                    if (msg) msg.textContent = t('manage.importWarn', { n: existingCount });
                    showModal('import-confirm');
                    _pendingImport = doImport;
                } else {
                    doImport();
                }
            })
            .catch(function () { doImport(); });
        input.value = '';
    };
    input.click();
}

function doExportDeckData(deckId) {
    fetch('/v1/decks/' + deckId + '/export').then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) { showToast(t('toast.exportFailed'), true); return; }
        var blob = new Blob([JSON.stringify(d.data, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = $('#download-helper');
        a.href = url; a.download = (d.deck_name || 'deck') + '_export.json'; a.click();
        URL.revokeObjectURL(url);
        showToast(t('manage.exported', { n: d.count }));
    }).catch(function () { showToast(t('toast.exportFailed'), true); });
}

/* ===== Reorder ===== */
function doReorder(deckId) {
    state._reorderDeckId = deckId;
    closeManageModal();
    showModal('goagain');
    var input = $('#goagain-input');
    var confirmBtn = $('#modal-goagain-confirm');
    input.value = '';
    confirmBtn.disabled = true;
    
    // Re-bind input validation
    input.oninput = function () {
        confirmBtn.disabled = this.value.trim() !== '广修万劫证吾道心';
    };
}

/* ===== Popover Confirm (small near-button confirmation) ===== */
function showPopoverConfirm(anchorEl, message, onConfirm) {
    var existing = document.getElementById('popover-confirm');
    if (existing) existing.remove();

    var pop = document.createElement('div');
    pop.id = 'popover-confirm';
    pop.className = 'popover-confirm';
    pop.innerHTML =
        '<div class="pc-msg"></div>' +
        '<div class="pc-actions">' +
        '<button type="button" class="pc-btn pc-cancel" data-pc="cancel">' + t('common.cancel') + '</button>' +
        '<button type="button" class="pc-btn pc-ok" data-pc="ok">' + t('common.confirm') + '</button>' +
        '</div>';
    pop.querySelector('.pc-msg').textContent = message;
    document.body.appendChild(pop);

    function close() {
        pop.remove();
        document.removeEventListener('mousedown', onDocDown);
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', close);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function onDocDown(e) {
        if (!pop.contains(e.target)) close();
    }

    pop.querySelector('[data-pc="cancel"]').addEventListener('click', function (e) { e.stopPropagation(); close(); });
    pop.querySelector('[data-pc="ok"]').addEventListener('click', function (e) { e.stopPropagation(); close(); onConfirm(); });

    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);

    var r = anchorEl.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.min(r.left + r.width / 2 - pw / 2, window.innerWidth - pw - 8);
    var y = r.bottom + 8;
    if (y + ph > window.innerHeight - 8) y = r.top - ph - 8;
    x = Math.max(8, x);
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
}

/* ===== Sages Easter Egg (header button + popover) ===== */
/* label 为按钮上的提问（可翻译），text 为古文内容（保持原样，不翻译） */
var SAGES = [
    { label: 'sages.q1', text: '欲穷千里目，更上一层楼' },
    { label: 'sages.q2', text: '吾尝终日而思矣，不如须臾之所学也' },
    { label: 'sages.q3', text: '广修万劫，证吾道心' },
    { label: 'sages.q4', text: '初极狭，才通人。复行数十步，豁然开朗' },
    { label: 'sages.q5', text: '而世之奇伟瑰怪，非常之观，常在于险远，而人之所罕至焉，故非有志者不能至也' }
];
var _sageTimer = null;

function initSages() {
    var btn = $('#sages-btn');
    if (!btn) return;

    var pop = document.createElement('div');
    pop.id = 'sages-pop';
    pop.className = 'sages-pop';
    document.body.appendChild(pop);
    renderSagesPop();

    pop.addEventListener('click', function (e) {
        var item = e.target.closest('.sages-pop-item');
        if (!item) return;
        showSageQuote(SAGES[parseInt(item.dataset.sage, 10)].text);
        closeSagesPop();
    });

    pop.addEventListener('click', function (e) {
        var item = e.target.closest('.sages-pop-item');
        if (!item) return;
        showSageQuote(SAGES[parseInt(item.dataset.sage, 10)].text);
        closeSagesPop();
    });

    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (pop.classList.contains('show')) { closeSagesPop(); return; }
        showSagesPop();
    });

    document.addEventListener('click', function (e) {
        if (e.target.closest('#sages-btn') || e.target.closest('#sages-pop')) return;
        closeSagesPop();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSagesPop();
    });
}

function showSagesPop() {
    var pop = $('#sages-pop');
    var btn = $('#sages-btn');
    if (!pop || !btn) return;
    var r = btn.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.min(r.left, window.innerWidth - pw - 8);
    var y = r.bottom + 8;
    if (y + ph > window.innerHeight - 8) y = r.top - ph - 8;
    x = Math.max(8, x);
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    pop.classList.add('show');
}

function closeSagesPop() {
    var pop = $('#sages-pop');
    if (pop) pop.classList.remove('show');
}

function renderSagesPop() {
    var pop = $('#sages-pop');
    if (!pop) return;
    var html = '<div class="sages-pop-title">' + t('nav.sages') + '</div>';
    SAGES.forEach(function (s, i) {
        html += '<button type="button" class="sages-pop-item" data-sage="' + i + '">' + t(s.label) + '</button>';
    });
    pop.innerHTML = html;
}

function showSageQuote(text) {
    var el = document.getElementById('sage-quote');
    if (!el) {
        el = document.createElement('div');
        el.id = 'sage-quote';
        document.body.appendChild(el);
    }
    clearTimeout(_sageTimer);
    el.innerHTML = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    _sageTimer = setTimeout(function () {
        el.classList.remove('show');
    }, 3000);
}

/* ===== Global Sidebar Nav ===== */
function switchGlobalPage(page) {
    closeSagesPop();
    /* Hide all pages, show target */
    $$('.ph-page').forEach(function (el) { el.classList.remove('visible'); });
    $$('.gs-nav-item').forEach(function (el) { el.classList.remove('active'); });

    var navEl = document.querySelector('.gs-nav-item[data-gs-page="' + page + '"]');
    if (navEl) navEl.classList.add('active');

    if (page === 'home') {
        document.getElementById('home-title').textContent = t('home.title');
        document.getElementById('home-content').style.display = '';
        if (_stats.actionsLoaded) destroyStatsPage();
        if (_ach.loaded) destroyAchievementsPage();
    } else {
        var titles = { achievements: 'page.achievements', stats: 'page.stats', docs: 'page.docs', tools: 'page.tools' };
        document.getElementById('home-title').textContent = t(titles[page] || page);
        document.getElementById('home-content').style.display = 'none';

        var phEl = document.getElementById('ph-' + page);
        if (phEl) phEl.classList.add('visible');
        if (page === 'stats') initStatsPage();
        if (page === 'achievements') initAchievementsPage();
        if (page === 'docs' && window.renderDocs) renderDocs();
    }
}

/* ===== Event Listeners ===== */
function setupEventListeners() {
    document.addEventListener('click', function (e) {
        var target = e.target;


        /* Close skin dropdown when clicking outside it */
        if (!target.closest('#skin-toggle-wrap')) {
            var skinDd = $('#skin-dropdown');
            if (skinDd && skinDd.style.display === 'block') toggleSkinDropdown(false);
        }

        /* Global sidebar navigation */
        var gsItem = target.closest('.gs-nav-item');
        if (gsItem) {
            switchGlobalPage(gsItem.dataset.gsPage);
            return;
        }


        /* New Deck (home page) */
        if (target.closest('#new-deck-btn')) { doCreateDeck(); return; }

        /* Deck kind filter bar (single click selects a type, double click also selects) */
        if (target.closest('.deck-kind-tab')) {
            var kindTab = target.closest('.deck-kind-tab');
            var kind = kindTab.dataset.kind || '';
            setDeckKindFilter(kind);
            return;
        }

        /* Deck mastery stats (blue modal) — must be checked BEFORE data-study-deck */
        if (target.closest('[data-deck-stats]')) {
            openMasteryModal(parseInt(target.closest('[data-deck-stats]').dataset.deckStats));
            return;
        }

        /* Manage deck (blue modal) — must be checked BEFORE data-study-deck
           because the manage button is nested inside the deck card. */
        if (target.closest('[data-manage-deck]')) {
            openManageModal(parseInt(target.closest('[data-manage-deck]').dataset.manageDeck));
            return;
        }

        /* Study deck (click deck card body, not the manage button) */
        if (target.closest('[data-study-deck]')) {
            enterDeck(parseInt(target.closest('[data-study-deck]').dataset.studyDeck));
            return;
        }

        /* Mastery modal close */
        if (target.closest('#mastery-modal-close') ||
            (target.closest('#mastery-modal') && !target.closest('.mastery-modal'))) {
            closeMasteryModal(); return;
        }

        /* Mastery tabs */
        if (target.closest('.mastery-tab')) {
            switchMasteryTab(target.closest('.mastery-tab').dataset.mtab);
            return;
        }

        /* Management modal close */
        if (target.closest('#manage-modal-close') ||
            (target.closest('#manage-modal') && !target.closest('.manage-modal-box'))) {
            closeManageModal(); return;
        }

        /* Management modal actions */
        if (target.closest('#mma-data')) {
            if (_manageDeckId) doUploadDeckData(_manageDeckId);
            return;
        }
        if (target.closest('#ma-export')) {
            if (_manageDeckId) doExportDeckData(_manageDeckId);
            return;
        }
        if (target.closest('#ma-goagain')) {
            if (_manageDeckId) {
                state._reorderDeckId = _manageDeckId;
                hideModal('manage');
                showModal('goagain');
                var input = $('#goagain-input');
                var confirmBtn = $('#modal-goagain-confirm');
                input.value = '';
                confirmBtn.disabled = true;
                input.oninput = function () {
                    confirmBtn.disabled = this.value.trim() !== '广修万劫证吾道心';
                };
            }
            return;
        }

        /* Rename deck */
        if (target.closest('#mm-rename-btn')) {
            var btn = target.closest('#mm-rename-btn');
            if (btn.classList.contains('editing')) return;
            var nameEl = $('#mm-name');
            var current = nameEl.textContent;
            nameEl.innerHTML = '<input type="text" class="mm-rename-input" id="mm-rename-input" value="' + current.replace(/"/g, '&quot;') + '">';
            btn.classList.add('editing');
            var input = $('#mm-rename-input');
            input.focus();
            input.select();
            function finishRename() {
                if (!btn.classList.contains('editing')) return;
                var val = input.value.trim();
                if (val && val !== current && _manageDeckId) {
                    fetch('/v1/decks/' + _manageDeckId, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({name: val})
                    }).then(function(r) { return r.json(); }).then(function(d) {
                        if (d.success) { nameEl.textContent = d.deck.name; showToast(t('manage.renamed')); renderDeckList(true); }
                        else { showToast(t('manage.renameFailed'), true); nameEl.textContent = current; }
                    }).catch(function() { showToast(t('manage.renameFailed'), true); nameEl.textContent = current; });
                } else {
                    nameEl.textContent = current;
                }
                btn.classList.remove('editing');
            }
            function onBlur() { setTimeout(finishRename, 150); }
            function onKey(e) {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                else if (e.key === 'Escape') { e.preventDefault(); nameEl.textContent = current; btn.classList.remove('editing'); }
            }
            input.addEventListener('blur', onBlur);
            input.addEventListener('keydown', onKey);
            return;
        }

        /* New Deck modal */
        if (target.closest('#new-deck-modal-close') || (target.closest('#new-deck-modal') && !target.closest('.modal'))) {
            hideModal('new-deck'); return;
        }
        if (target.closest('#new-deck-do-cancel')) { hideModal('new-deck'); return; }
        if (target.closest('#new-deck-do-create')) {
            var name = $('#new-deck-name-input').value.trim();
            var kind = _newDeckKind || 'other';
            if (!name) { showToast(t('newDeck.nameRequired'), true); return; }
            fetch('/v1/decks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: state.userId, name: name, kind: kind })
            }).then(function (r) { return r.json(); }).then(function (d) {
                if (d.success) {
                    showToast(t('newDeck.created', { name: d.deck.name }));
                    hideModal('new-deck');
                    renderDeckList(true);
                } else { showToast(d.error || t('newDeck.failed'), true); }
            }).catch(function () { showToast(t('newDeck.failed'), true); });
            return;
        }

        /* How To */
        if (target.closest('#howto-btn')) {
            showModal('template-api');
            var el = $('#api-md-content');
            if (el && !el.dataset.loaded) { el.textContent = TOOL_API_MD; el.dataset.loaded = '1'; }
            return;
        }
        if (target.closest('#template-api-modal-close') || (target.closest('#template-api-modal') && !target.closest('.modal'))) {
            hideModal('template-api'); return;
        }
        if (target.closest('#copy-api-btn')) {
            var text = $('#api-md-content');
            if (text && text.textContent) {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text.textContent).then(function () { showToast('Copied!'); });
                } else {
                    var ta = document.createElement('textarea');
                    ta.style.position = 'fixed'; ta.style.left = '-9999px';
                    var body = document.body;
                    ta.value = text.textContent;
                    body.appendChild(ta); ta.select();
                    document.execCommand('copy'); body.removeChild(ta);
                    showToast('Copied!');
                }
            }
            return;
        }

        /* Manage: reorder */
        if (target.closest('[data-reorder]')) {
            state._reorderDeckId = parseInt(target.closest('[data-reorder]').dataset.reorder);
            hideModal('manage'); showModal('goagain');
            var input = $('#goagain-input');
            var confirmBtn = $('#modal-goagain-confirm');
            input.value = '';
            confirmBtn.disabled = true;
            input.oninput = function () {
                confirmBtn.disabled = this.value.trim() !== '广修万劫证吾道心';
            };
            return;
        }
        if (target.closest('#modal-goagain-cancel')) { hideModal('goagain'); return; }
        if (target.closest('#modal-goagain-confirm')) {
            var btn = target.closest('#modal-goagain-confirm');
            if (btn.disabled) return;
            btn.disabled = true;
            btn.textContent = t('common.processing');
            fetch('/v1/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: state.userId, deck_id: state._reorderDeckId || state.deckId })
            }).then(function (r) { return r.json(); }).then(function (d) {
                hideModal('goagain');
                showToast(t('reorder.success'));
                state.cards = {}; state.tabs = []; state.activeTab = 'catalogue'; state.enteredPages = new Set();
                loadInfo();
            }).catch(function () { showToast(t('reorder.failed'), true); })
            .finally(function () { btn.disabled = false; btn.textContent = t('common.confirm'); });
            return;
        }
        if (target.closest('#import-confirm-cancel')) { hideModal('import-confirm'); return; }
        if (target.closest('#import-confirm-ok')) {
            hideModal('import-confirm');
            if (typeof _pendingImport === 'function') { _pendingImport(); _pendingImport = null; }
            return;
        }

                                                /* Skin selector */
        if (target.closest('#dark-theme-btn')) {
            toggleSkinDropdown();
            return;
        }
        if (target.closest('[data-skin-option]')) {
            var optEl = target.closest('[data-skin-option]');
            var skinId = optEl.dataset.skinOption;
            if (SKINS[skinId]) {
                state.skinId = skinId;
                applySkin();
            }
            toggleSkinDropdown(false);
            return;
        }
        if (target.closest('#skin-dropdown')) {
            return;
        }

        /* Language toggle */
        if (target.closest('#lang-toggle-btn')) {
            toggleLang();
            return;
        }

        /* Settings */
        if (target.closest('#settings-btn')) { showModal('about'); return; }

        /* Online store (opens official site in a new tab) */
        if (target.closest('#store-btn')) {
            window.open('https://dragoncard.top/', '_blank', 'noopener');
            return;
        }

        /* Refresh deck list (manual) */
        if (target.closest('#home-refresh-btn')) {
            renderDeckList(true);
            showToast(t('home.refreshed'));
            return;
        }

        /* Finish modal */
        if (target.closest('#modal-finish-cancel')) { hideModal('finish'); return; }
        if (target.closest('#modal-finish-confirm')) {
            hideModal('finish');
            audioFeedback.playSuccess();
            loadInfo();
            return;
        }

        /* About modal close */
        if (target.closest('#about-modal') && !target.closest('.modal')) hideModal('about');

        /* Voice */
        if (target.closest('.voice-select-btn')) {
            $('.voice-dropdown').style.display = $('.voice-dropdown').style.display === 'none' ? 'block' : 'none';
            return;
        }
        if (target.closest('.voice-option')) {
            var opt = target.closest('.voice-option');
            var v = null;
            for (var vi = 0; vi < voiceMgr.voices.length; vi++) {
                if (voiceMgr.voices[vi].voiceURI === opt.dataset.voiceUri) { v = voiceMgr.voices[vi]; break; }
            }
            if (v) {
                var optLang = opt.dataset.lang || voiceMgr._currentLang || 'en';
                voiceMgr.saveVoice(optLang, v);
                voiceMgr.firstCardWord(function (word) {
                    var u = new SpeechSynthesisUtterance(word || voiceMgr.sampleText(optLang));
                    u.voice = v;
                    speechSynthesis.speak(u);
                });
                renderVoiceDropdown();
            }
            $('.voice-dropdown').style.display = 'none';
            return;
        }

        /* Stats page events */
        if (target.closest('#stats-deck-select')) {
            var val = target.closest('#stats-deck-select').value;
            _stats.deckId = val ? parseInt(val) : null;
            loadStatsActions();
            updateStatsDateDisplay();
            loadStatsData();
            return;
        }
        if (target.closest('.stats-view-btn')) {
            statsSetView(target.closest('.stats-view-btn').dataset.view);
            return;
        }
        if (target.closest('#stats-prev')) { statsNavigate(-1); return; }
        if (target.closest('#stats-next')) { statsNavigate(1); return; }
        if (target.closest('#stats-refresh')) { loadStatsData(); return; }

        /* Font drawer close */
        var fontDrawer = $('#font-drawer');
        if (fontDrawer && fontDrawer.style.display !== 'none' && !target.closest('#font-drawer') && !target.closest('#font-settings-btn')) fontDrawer.style.display = 'none';
        var voiceDD = $('.voice-dropdown');
        if (voiceDD && voiceDD.style.display !== 'none' && !target.closest('.voice-dropdown') && !target.closest('.voice-select-btn')) voiceDD.style.display = 'none';
    });

    /* ===== Global tooltip (hover on any [data-tooltip] element) ===== */
    var _tipTimer = null;
    var _tipEl = null;

    function hideTip() {
        clearTimeout(_tipTimer);
        _tipTimer = null;
        _tipEl = null;
        var tip = $('#global-tooltip');
        if (tip) tip.classList.remove('show');
    }

    document.addEventListener('mouseover', function (e) {
        var t = e.target;
        if (!t || typeof t.closest !== 'function') return;
        var el = t.closest('[data-tooltip]');
        if (!el || el === _tipEl) return;
        _tipEl = el;
        clearTimeout(_tipTimer);
        _tipTimer = setTimeout(function () {
            var text = el.getAttribute('data-tooltip');
            if (!text) return;
            var tip = $('#global-tooltip');
            if (!tip) return;
            tip.textContent = text;
            tip.classList.add('show');
            /* Position below the element, flip above if overflow */
            var r = el.getBoundingClientRect();
            var tr = tip.getBoundingClientRect();
            var left = r.left + r.width / 2 - tr.width / 2;
            var top = r.bottom + 8;
            if (left < 8) left = 8;
            if (left + tr.width > window.innerWidth - 8) left = window.innerWidth - tr.width - 8;
            if (top + tr.height > window.innerHeight - 8) top = r.top - tr.height - 8;
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
        }, 300);
    });
    document.addEventListener('mouseleave', function (e) {
        var t = e.target;
        if (!t || typeof t.closest !== 'function') { hideTip(); return; }
        if (t.closest('[data-tooltip]')) hideTip();
    });
    document.addEventListener('mousedown', function () { hideTip(); });
    window.addEventListener('scroll', function () { hideTip(); }, true);

}

/* ===== Finish Modal ===== */
function showFinishModal(tabId) {
    state._closingTabId = tabId;
    var pageNum = parseInt(tabId.slice(1));
    var cards = state.cards[pageNum] || [];
    var total = cards.length;
    var marked = cards.filter(function (c) { return c.is_unknown === 1; }).length;
    $('#finish-total').textContent = total;
    $('#finish-marked').textContent = marked;
    var subtitle = document.getElementById('finish-subtitle');
    if (subtitle) subtitle.textContent = 'P' + String(pageNum).padStart(3, '0') + ' - ' + t('study.finish.subtitle');
    showModal('finish');
}

/* ===== Modals ===== */
function showModal(id) { var el = $('#' + id + '-modal'); if (el) el.style.display = 'flex'; }
function hideModal(id) { var el = $('#' + id + '-modal'); if (el) el.style.display = 'none'; }

/* ===== Toast ===== */
function showToast(msg, isError) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(function () { el.classList.remove('show'); }, 2500);
}

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', function () {
    initApp();
    setupEventListeners();
    voiceMgr.init();
});
