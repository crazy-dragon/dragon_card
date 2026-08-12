var state = {
    userId: null,
    mode: 'decks',
    currentDeck: null,
    deckId: null,
    templateId: null,

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

/* ===== Template engine ===== */
var _loadedTpl = {};
var _tplCssEls = {};
var _tplLangs = {};
function templateLangOf(templateId) {
    if (templateId != null && _tplLangs[templateId]) return _tplLangs[templateId];
    return null;
}
var templateEngine = {
    loadTemplate: function (templateId) {
        var self = this;
        if (_loadedTpl[templateId]) {
            /* Re-eval JS so the global cardTemplate matches THIS template */
            self._evalTemplateJs(templateId);
            return Promise.resolve(_loadedTpl[templateId]);
        }
        return fetch('/v1/templates/' + templateId).then(function (r) { return r.json(); }).then(function (d) {
            if (!d.success) throw new Error(d.error || 'template load failed');
            var tpl = d.template;
            _tplLangs[templateId] = tpl.lang || 'en';
            var styleId = 'tpl-css-' + templateId;
            if (_tplCssEls[templateId]) {
                _tplCssEls[templateId].textContent = tpl.card_css || '';
            } else {
                var s = document.createElement('style');
                s.id = styleId; s.textContent = tpl.card_css || '';
                document.head.appendChild(s); _tplCssEls[templateId] = s;
            }
            _loadedTpl[templateId] = tpl;
            self._evalTemplateJs(templateId);
            return tpl;
        });
    },

    /* Execute template JS and stash the resulting cardTemplate per template id */
    _evalTemplateJs: function (templateId) {
        var tpl = _loadedTpl[templateId];
        if (!tpl || !tpl.card_js) return;
        var prev = window.cardTemplate;
        try { (0, eval)(tpl.card_js); } catch (e) { console.error('template js error', e); }
        if (window.cardTemplate) _loadedTpl[templateId]._cardTemplate = window.cardTemplate;
        window.cardTemplate = prev;
    },

    /* Return the cardTemplate object that belongs to the given template id */
    getCardTemplate: function (templateId) {
        if (templateId != null && _loadedTpl[templateId] && _loadedTpl[templateId]._cardTemplate) {
            return _loadedTpl[templateId]._cardTemplate;
        }
        return window.cardTemplate || null;
    },

    renderCard: function (card, htmlOverride) {
        var ct = this.getCardTemplate(card.template_id);
        if (ct && typeof ct.render === 'function') {
            var api = createApiForCard(card);
            card.__api = api;
            try { return ct.render(htmlOverride || '', card, api); }
            catch (e) { return '<div class="error-state">Render error: ' + escapeHtml(e.message) + '</div>'; }
        }
        var data = card.data || {};
        var title = data.word || data.name || data.term || '(no preview)';
        return '<div class="word-card" data-card-id="' + card.id + '"><div class="word-title">' + escapeHtml(String(title)) + '</div></div>';
    },
    initCard: function (el, card) {
        var api = card.__api || createApiForCard(card);
        card.__api = api;
        el.__cardApi = api;
        var ct = this.getCardTemplate(card.template_id);
        if (ct && typeof ct.init === 'function') {
            try { ct.init(el, card, api); } catch (e) { console.error('template init error', e); }
        }
    }
};

/* ===== Batched observability tracking ===== */
var _trackQueue = [];
var _trackTimer = null;
var _trackSeen = {};

function flushTrackQueue() {
    _trackTimer = null;
    if (!_trackQueue.length) return;
    var events = _trackQueue.splice(0, _trackQueue.length);
    _trackSeen = {};
    fetch('/v1/observability/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: events })
    }).catch(function () {});
}

function trackEvent(evt) {
    var key = evt.user_id + ':' + evt.deck_id + ':' + evt.deck_item_id + ':' + evt.action;
    /* Audio plays are real user actions during fast scanning; don't dedupe them. */
    if (evt.action !== 'audio_play') {
        if (_trackSeen[key]) return;
        _trackSeen[key] = true;
    }
    _trackQueue.push(evt);
    if (_trackTimer) clearTimeout(_trackTimer);
    _trackTimer = setTimeout(flushTrackQueue, 1500);
}

/* ===== Per-card API object (window.cardTemplate interface) ===== */
function createApiForCard(cardData) {
    var templateId = (cardData.template_id != null) ? cardData.template_id : state.templateId;
    var deckId = (cardData.deck_id != null) ? cardData.deck_id : state.deckId;
    var cardItemId = cardData.id;
    var hiddenKey = 'dc-hidden-fields-' + templateId;
    var _hidden = {};
    try { _hidden = JSON.parse(localStorage.getItem(hiddenKey) || '{}') || {}; } catch (e) { _hidden = {}; }
    var _isFavorite = !!cardData.is_favorite;
    var _debug = false;
    var _debounce = {};

    function persistHidden() { try { localStorage.setItem(hiddenKey, JSON.stringify(_hidden)); } catch (e) {} }

    function rerender() {
        var el = document.querySelector('[data-card-id="' + cardItemId + '"]');
        if (!el) return;
        var html = templateEngine.renderCard(cardData, '');
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var newEl = tmp.firstElementChild || tmp;
        if (el.parentNode) el.parentNode.replaceChild(newEl, el);
        templateEngine.initCard(newEl, cardData);
    }

    return {
        cardItemId: cardItemId,
        cardId: deckId,
        templateId: templateId,
        getCardData: function () { return cardData; },
        getViewMode: function () {
            if (state.singleCardMode) return 'single';
            return 'list';
        },
        getHiddenFields: function () { return JSON.parse(JSON.stringify(_hidden)); },
        setHiddenFields: function (fields) { _hidden = fields || {}; persistHidden(); },
        toggleMark: function (isUnknown) {
            return fetch('/v1/learn/mark', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deck_item_id: cardItemId, user_id: state.userId, deck_id: deckId, is_unknown: isUnknown })
            }).then(function (r) { return r.json(); }).then(function (d) {
                if (d.success) { cardData.is_unknown = d.is_unknown; }
                return d;
            });
        },
        toggleFavorite: function () {
            return fetch('/v1/learn/favorite', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deck_item_id: cardItemId, user_id: state.userId, deck_id: deckId })
            }).then(function (r) { return r.json(); }).then(function (d) {
                if (d.success) { _isFavorite = !!d.is_favorite; cardData.is_favorite = d.is_favorite; }
                return d;
            });
        },
        isFavorite: function () { return _isFavorite; },
        toggleDebug: function () { _debug = !_debug; return _debug; },
        isDebug: function () { return _debug; },
        playAudio: function (text, lang) {
            if (!text) return;
            voiceMgr.speak(text, lang || templateLangOf(templateId));
        },
        rerender: rerender,
        track: function (action) {
            if (!action || !action.trim()) return;
            action = action.trim();
            var key = cardItemId + ':' + action;
            /* Audio plays during fast scanning should all be counted. */
            if (action !== 'audio_play') {
                if (_debounce[key]) return;
                _debounce[key] = true;
                setTimeout(function () { delete _debounce[key]; }, 800);
            }
            trackEvent({ user_id: state.userId, deck_id: deckId, deck_item_id: cardItemId, template_id: templateId, action: action });
        },
        showTooltip: function (text, x, y) {
            var tip = document.getElementById('card-tooltip');
            if (!tip) { tip = document.createElement('div'); tip.id = 'card-tooltip'; tip.className = 'card-tooltip'; document.body.appendChild(tip); }
            tip.textContent = text;
            tip.style.left = (x || 0) + 'px';
            tip.style.top = (y || 0) + 'px';
            tip.classList.add('show');
        },
        hideTooltip: function () {
            var tip = document.getElementById('card-tooltip');
            if (tip) tip.classList.remove('show');
        },
        confirmDialog: function (anchorEl, message, onConfirm) {
            if (typeof showPopoverConfirm === 'function') {
                showPopoverConfirm(anchorEl, message, onConfirm);
            } else if (onConfirm && window.confirm) {
                if (window.confirm(message)) onConfirm();
            }
        }
    };
}

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

var TEMPLATE_API_MD = `# DragonCard Template Generator

You generate JSON template files for DragonCard, a flashcard learning system.

## Template File Format (JSON)

A template is a JSON file with these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`name\` | string | yes | Template display name |
| \`lang\` | string | no | TTS language (BCP47: en/ja/zh), default en |
| \`description\` | string | no | Short description |
| \`cardHtml\` | string | yes | HTML skeleton with \`{{placeholder}}\` variables |
| \`cardCss\` | string | yes | Card styles (plain CSS; Tailwind is not compiled here) |
| \`cardJs\` | string | yes | JavaScript with \`window.cardTemplate\` (see below) |
| \`sampleData\` | array | no | Example data items (array of objects) for preview |
| \`trackedActions\` | array | no | Observability actions \`[{action,label}]\`, max 5 |

### Example file

\`\`\`json
{
  "name": "English Word Card",
  "lang": "en",
  "description": "English vocabulary card",
  "cardHtml": "<div class=\"word-card\" data-card-id=\"{{id}}\">\\n  <div class=\"word-title\">{{data.word}}</div>\\n  <div class=\"word-phonetic\">{{data.phonetic}}</div>\\n</div>",
  "cardCss": ".word-card { padding: 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--card-bg); }",
  "cardJs": "(function () { 'use strict'; window.cardTemplate = { fields: [ { key: 'word', label: 'Word', hideable: true }, { key: 'def', label: 'Definition', hideable: true } ], render: function(cardHtml, cardData, api) { var data = cardData.data; var html = '<div class=\"word-card\" data-card-id=\"' + cardData.id + '\">'; html += '<div class=\"word-title\">' + (data.word || '') + '</div>'; html += '<div class=\"word-phonetic\">' + (data.phonetic || '') + '</div>'; return html; }, init: function(cardElement, cardData, api) { } }; })();",
  "sampleData": [
    { "word": "serendipity", "phonetic": "/ˌserənˈdɪpəti/", "def": "chance discovery", "examples": [] }
  ],
  "trackedActions": [
    { "action": "audio_play", "label": "发音" },
    { "action": "word_mark", "label": "标记" }
  ]
}
\`\`\`

**Tip:** Use \`\\n\` for newlines inside JSON strings, or escape quotes with \`\\"\`. For simpler escaping, use single quotes (\`'\`) in HTML/CSS/JS where possible.

## \`window.cardTemplate\` Object (inside cardJs)

\`\`\`js
window.cardTemplate = {
  fields: [
    { key: 'word', label: 'Word', hideable: true },
  ],
  render: function(cardHtml, cardData, api) {
    // Return HTML string for the card
    return \`<div>...</div>\`;
  },
  init: function(cardElement, cardData, api) {
    // Bind event listeners after card is in the DOM
  },
  update: function(cardElement, cardData, api) {
    // Optional: partial update without re-render
  }
};
\`\`\`

### \`fields\` Array (optional)
Define fields to appear in the preview sidebar. Each item: \`{ key, label, hideable }\`.

### \`render(cardHtml, cardData, api) -> string\`
Return the rendered HTML. \`cardHtml\` is the raw HTML skeleton from the template file. \`cardData\` contains the card data (see below).

### \`init(cardElement, cardData, api)\`
Called after card enters the DOM. \`cardElement\` is the root DOM element of the rendered card.

## \`cardData\` Object

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | number | Database ID |
| \`deck_id\` | number | Parent deck ID |
| \`item_order\` | number | Original data order |
| \`current_order\` | number | Current study order |
| \`data\` | object | Your custom fields (e.g. \`data.word\`, \`data.phonetic\`) |
| \`is_unknown\` | 0/1 | Marked unknown |
| \`is_favorite\` | 0/1 | Favorited |

## \`api\` Methods

| Method | Description |
|--------|-------------|
| \`getCardData()\` | Returns the current card's data object |
| \`getHiddenFields()\` | Returns Set of hidden field keys |
| \`setHiddenFields(Set)\` | Replace hidden fields and re-render |
| \`toggleMark()\` | Toggle unknown/mark status |
| \`toggleFavorite()\` | Toggle favorite status |
| \`isFavorite()\` | Returns boolean |
| \`playAudio(text, lang?)\` | TTS via speechSynthesis; lang defaults to template lang |
| \`rerender()\` | Re-render from template |
| \`track(action)\` | Record action event (debounced 800ms) |
| \`showTooltip(msg)\` / \`hideTooltip()\` | Show/hide tooltip near element |
| \`confirmDialog(anchorEl, message, onConfirm)\` | Styled confirm popover near an element (callback on confirm) |

## Styling Rules

- Use **Tailwind utility classes** in cardHtml/cardJs (project loads the Tailwind Play CDN).
  Do NOT use \`@apply\`/\`@tailwind\` inside cardCss — it is not compiled.
- Prefer **project CSS variables** so dark mode works: \`var(--card-bg)\`, \`var(--ink)\`, \`var(--line)\`, \`var(--primary)\`. In Tailwind: \`bg-[var(--card-bg)]\`, \`text-[var(--ink)]\`.
- Dark-only styles go in cardCss with the \`body.dark-mode .xxx\` prefix (Tailwind \`dark:\` follows the OS, not the app).
- Use **Font Awesome** for icons (loaded globally): \`<i class="fa-solid fa-volume-high"></i>\` (play), \`fa-star\` (mark), \`fa-bookmark\` (favorite), \`fa-eye\` (toggle).
- Font scale: \`calc(20px * var(--card-font-scale, 1))\`.
- Max **5** \`data-action\` per template.
`;

/* ===== Dark Theme ===== */
function applyDarkTheme() {
    document.body.classList.toggle('dark-mode', state.darkTheme);
    localStorage.setItem('dc-dark-theme', state.darkTheme ? '1' : '0');
    document.querySelectorAll('.dark-icon-light').forEach(function (el) { el.style.display = state.darkTheme ? 'none' : 'inline-block'; });
    document.querySelectorAll('.dark-icon-dark').forEach(function (el) { el.style.display = state.darkTheme ? 'inline-block' : 'none'; });
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
    updateLangBtn();
    renderSagesPop();
    /* Re-render current view so dynamic text updates */
    if (state.mode === 'study') {
        if (state.activeTab && state.activeTab.startsWith('s')) renderStudyPage(parseInt(state.activeTab.slice(1)));
        renderTabs();
    } else {
        renderDeckList();
    }
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
    document.body.classList.remove('study-mode');
    $('#home-panel').style.display = 'flex';
    $('#study-view').style.display = 'none';
    renderDeckList();
}

function showStudyView() {
    state.mode = 'study';
    document.body.classList.add('study-mode');
    $('#home-panel').style.display = 'none';
    $('#study-view').style.display = 'flex';
}

/* ===== Deck List (blue theme home page) ===== */
function progressColor(pct) {
    if (pct > 70) return 'var(--hp-success)';
    if (pct > 40) return 'var(--hp-warning)';
    return 'var(--hp-primary)';
}

/* Deck kind filter state: null = all, otherwise a kind key */
var _deckKindFilter = null;

/* Render the type filter bar (order follows DECK_KIND_META definition order) */
function renderDeckKindFilter() {
    var container = $('#deck-kind-filter');
    if (!container) return;
    var html = '';
    html += '<button class="deck-kind-tab' + (_deckKindFilter === null ? ' active' : '') + '" data-kind="" data-dbl="1">' + t('home.filterAll') + '</button>';
    Object.keys(DECK_KIND_META).forEach(function (k) {
        var meta = DECK_KIND_META[k];
        var active = _deckKindFilter === k;
        html += '<button class="deck-kind-tab' + (active ? ' active' : '') + '" data-kind="' + k + '" style="--kcolor:' + meta.color + ';' + (active ? 'border-color:' + meta.color + ';color:' + meta.color + ';' : '') + '">' + meta.icon + ' ' + t(meta.i18n) + '</button>';
    });
    container.innerHTML = html;
}

function setDeckKindFilter(kind) {
    _deckKindFilter = kind || null;
    renderDeckKindFilter();
    renderDeckList();
}

function renderDeckList() {
    var grid = $('#deck-grid');
    if (!grid) return;
    renderDeckKindFilter();
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--hp-text-sub);"><i class="fa-solid fa-layer-group" style="font-size:32px;margin-bottom:12px;display:block;"></i><div style="font-size:14px;">' + t('common.loading') + '</div></div>';

    fetch('/v1/decks?user_id=' + state.userId).then(function (r) { return r.json(); }).then(function (d) {
        var decks = d.decks || [];
        if (_deckKindFilter) {
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
            var hasTpl = !!deck.template_name;
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

            /* Description: show TEMPLATE description (deck description removed) */
            html += '<div class="deck-desc">' + (deck.template_description ? escapeHtml(deck.template_description) : t('home.notBound')) + '</div>';

            /* Stats */
            html += '<div class="deck-stats">';
            html += '<span>' + t('home.mastered') + ' <b>' + (deck.mastered_count || 0).toLocaleString() + '</b> / ' + (deck.item_count || 0).toLocaleString() + '</span>';
            html += '<span class="deck-year-days"><i class="fa-solid fa-hand-fist"></i> ' + (deck.year_study_days || 0) + ' ' + t('home.yearDays') + '</span>';
            html += '</div>';

            /* Progress bar */
            html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%;background:' + progressColor(pct) + '"></div></div>';

            /* Badges placeholder */
            html += '<div class="badges-row"></div>';

            /* Template binding footer */
            html += '<div class="deck-tpl-row">';
            if (hasTpl) {
                html += '<span class="deck-tpl-badge">' + escapeHtml(deck.template_name) + '</span>';
            } else {
                html += '<span class="deck-tpl-badge unbind">' + t('home.notBound') + '</span>';
            }
            html += '</div>';

            html += '</div>';
        });
        grid.innerHTML = html;
        updateHomeStats(decks);
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
        state.templateId = d.deck.active_template_id;
        $('#study-deck-title').textContent = d.deck.name;
        if (!state.templateId) {
            showToast(t('study.noTemplate'));
            openManageModal(deckId);
            return;
        }
        return templateEngine.loadTemplate(state.templateId);
    }).then(function () {
        if (!state.templateId) return;
        showStudyView();
        voiceMgr.setLang(templateLangOf(state.templateId));
        renderTabs();
        renderStudyPages();
        return loadInfo();
    }).then(function () {
        if (!state.templateId) return;
        restoreOpenTabs();
        renderTabs();
        renderStudyPages();
        renderContent();
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
        .then(function () { renderCatalogue(); updateStatsText(); });
}

function loadPage(pageNum) {
    if (state.cards[pageNum]) return Promise.resolve(state.cards[pageNum]);
    return fetch('/v1/learn/page?user_id=' + state.userId + '&deck_id=' + state.deckId + '&page=' + pageNum + '&page_size=100')
        .then(function (r) { return r.json(); })
        .then(function (d) {
            state.cards[pageNum] = d.cards.map(function (c) {
                c._pageNum = pageNum;
                c.template_id = c.template_id || state.templateId;
                c._showAnswer = false;
                if (c.data && c.data.examples) c.data.examples.forEach(function (e) { e._show = false; });
                return c;
            });
            return state.cards[pageNum];
        });
}

/* ===== Init ===== */
function initApp() {
    fetch('/v1/users').then(function (r) { return r.json(); }).then(function (d) {
        var defaultUser = d.users.find(function (u) { return u.username === 'default'; });
        state.userId = defaultUser ? defaultUser.id : (d.users[0] ? d.users[0].id : null);
        if (state.userId) showDeckView();
    });
    applyDarkTheme();
    applyStaticI18n();
    updateLangBtn();
    localStorage.removeItem('dc-card-font-weight');
    applyCardFont();
    initSages();

    /* Templates are uploaded later inside the deck management modal */
}

/* ===== Catalogue / Tabs / Pages ===== */
function renderCatalogue() {
    var container = $('#catalogue-grid');
    if (!container) return;
    if (!state.deckId) { container.innerHTML = ''; return; }
    if (!state.templateId) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--unknown);">' +
            '&#x26A0;&#xFE0F; This deck has no template. Go to Manage to add one.</div>';
        return;
    }
    if (state.totalPages === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-3);">' +
            'No data yet. Go to Manage to import data for this deck.</div>';
        return;
    }
    var html = '';
    for (var i = 1; i <= state.totalPages; i++) {
        var marked = i <= state.markedPages;
        html += '<button class="page-btn ' + (marked ? 'marked' : 'mastered') + '" data-page="' + i + '">' + String(i).padStart(3, '0') + '</button>';
    }
    container.innerHTML = html;
}

function renderTabs() {
    var container = $('#study-tabs-container');
    if (!container) return;
    var studyTabs = state.tabs.filter(function (t) { return t.type === 'study'; }).map(function (t) {
        var isActive = state.activeTab === t.id;
        var isReview = t.pageNum > state.markedPages;
        var tabClass = isReview ? 'review-tab' : 'study-tab';
        return '<div class="tab-item ' + tabClass + ' ' + (isActive ? 'active' : '') + '" data-tab="' + t.id + '"><span>' + t.title + '</span><button class="tab-close-btn" data-tab-id="' + t.id + '" data-tooltip="Finish this page">&times;</button></div>';
    }).join('');
    container.innerHTML = studyTabs;
    // Sync sidebar brand button
    var brandBtn = $('#sidebar-home-btn');
    if (brandBtn) brandBtn.classList.toggle('active', state.activeTab === 'catalogue');
}

function renderStudyPage(pageNum) {
    var container = $('#study-' + pageNum);
    if (!container) return;
    var cards = state.cards[pageNum] || [];
    if (cards.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:60px 20px;">No cards on this page.</div>';
        return;
    }
    var firstEnter = !state.enteredPages.has(pageNum);
    if (firstEnter) state.enteredPages.add(pageNum);
    return loadPage(pageNum).then(function () {
        if (state.singleCardMode && pageNum === currentStudyPageNum()) {
            renderSingleCardStage(pageNum);
            return;
        }
        var htmlArr = [];
        cards.forEach(function (card, idx) {
            if (firstEnter) htmlArr.push('<div class="enter" style="animation-delay:' + (idx * 28) + 'ms;">');
            htmlArr.push(templateEngine.renderCard(card, ''));
            if (firstEnter) htmlArr.push('</div>');
        });
        container.innerHTML = htmlArr.join('');
        container.querySelectorAll('[data-card-id]:not(button)').forEach(function (el, idx) {
            if (cards[idx]) templateEngine.initCard(el, cards[idx]);
        });
    });
}

/* ===== Single-Card Mode ===== */
function currentStudyPageNum() {
    if (state.activeTab && state.activeTab.charAt(0) === 's') {
        var n = parseInt(state.activeTab.slice(1));
        return isNaN(n) ? null : n;
    }
    return null;
}

function resetSingleCardMode() {
    state.singleCardMode = false;
    state._singleCard3D = false;
    threeRenderer.dispose();
    var btn = $('#card-view-btn');
    if (btn) btn.classList.remove('active');
}

function toggleSingleCardMode() {
    var pn = currentStudyPageNum();
    if (pn == null) { showToast('Open a page first', true); return; }
    state.singleCardMode = !state.singleCardMode;
    var btn = $('#card-view-btn');
    if (btn) btn.classList.toggle('active', state.singleCardMode);
    if (state.singleCardMode) {
        state.singleCardIndex = 0;
        var cards = state.cards[pn] || [];
        if (!cards.length) {
            loadPage(pn).then(function () { renderSingleCardStage(pn); });
        } else {
            renderSingleCardStage(pn);
        }
    } else {
        renderStudyPage(pn);
    }
}

function renderSingleCardStage(pageNum) {
    var container = $('#study-' + pageNum);
    if (!container) return;
    var cards = state.cards[pageNum] || [];
    if (!cards.length) {
        container.innerHTML = '<div class="empty-state" style="padding:60px 20px;">No cards on this page.</div>';
        return;
    }
    var prevSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
    var nextSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    container.innerHTML =
        '<div class="single-card-stage">' +
            '<div class="sc-card-wrap" id="sc-card-wrap"></div>' +
            '<div class="sc-nav-row">' +
                '<button class="sc-nav sc-prev" data-sc="prev" data-tooltip="' + t('study.prev') + '" aria-label="Previous card">' + prevSvg + '</button>' +
                '<div class="sc-progress"><span id="sc-idx">1</span> / ' + cards.length + '</div>' +
                '<button class="sc-nav sc-next" data-sc="next" data-tooltip="' + t('study.next') + '" aria-label="Next card">' + nextSvg + '</button>' +
                '<span class="sc-nav-gap"></span>' +
                '<button class="sc-3d-btn" id="sc-3d-btn" data-sc-3d data-tooltip="3D 预览" style="display:none;"><i class="fa-solid fa-cube"></i></button>' +
            '</div>' +
        '</div>';
    renderSingleCardContent(pageNum, state.singleCardIndex, false);
}

function renderSingleCardContent(pageNum, idx, animate) {
    var cards = state.cards[pageNum] || [];
    if (!cards.length) return;
    if (idx < 0) idx = cards.length - 1;
    if (idx >= cards.length) idx = 0;
    state.singleCardIndex = idx;
    var wrap = $('#sc-card-wrap');
    if (!wrap) return;
    var card = cards[idx];

    /* Show/hide 3D preview button based on current card having a model */
    var btn3d = $('#sc-3d-btn');
    if (btn3d) {
        btn3d.style.display = cardHasModel(card) ? '' : 'none';
        btn3d.classList.remove('active');
    }
    state._singleCard3D = false;

    wrap.innerHTML = templateEngine.renderCard(card, '');
    var el = wrap.querySelector('[data-card-id]:not(button)');
    if (el) templateEngine.initCard(el, card);
    var idxEl = $('#sc-idx');
    if (idxEl) idxEl.textContent = idx + 1;
    if (animate) {
        var animTarget = el || wrap;
        animTarget.classList.remove('sc-anim');
        void animTarget.offsetWidth;
        animTarget.classList.add('sc-anim');
    }
}

/* Whether a card data contains a 3D model field */
function cardHasModel(card) {
    if (!card || !card.data) return false;
    var d = card.data;
    return (typeof d.model === 'string' && d.model) || (typeof d.url === 'string' && d.url);
}

function singleCardNav(delta) {
    var pn = currentStudyPageNum();
    if (pn == null) return;
    var cards = state.cards[pn] || [];
    if (!cards.length) return;
    var newIdx = state.singleCardIndex + delta;
    if (newIdx < 0) newIdx = cards.length - 1;
    if (newIdx >= cards.length) newIdx = 0;
    state.singleCardIndex = newIdx;
    var card = cards[newIdx];

    var wrap = $('#sc-card-wrap');
    if (!wrap) return;

    /* If currently in 3D preview, keep 3D mode and load the new card's model */
    if (state._singleCard3D) {
        var btn3d = $('#sc-3d-btn');
        if (btn3d) btn3d.style.display = cardHasModel(card) ? '' : 'none';
        var idxEl = $('#sc-idx');
        if (idxEl) idxEl.textContent = newIdx + 1;
        if (cardHasModel(card)) {
            /* Keep the existing 3D container/canvas in the DOM; just swap the model.
               Removing the canvas (via innerHTML) loses the WebGL context and leaves a blank view. */
            var sc3d = document.getElementById('sc-3d-wrap');
            if (!sc3d) {
                wrap.innerHTML = '<div class="sc-3d-wrap" id="sc-3d-wrap"></div>';
                sc3d = document.getElementById('sc-3d-wrap');
            }
            var modelUrl = card.data.model || card.data.url;
            threeRenderer.loadInto(sc3d, modelUrl);
        } else {
            /* New card has no model: exit 3D back to text card */
            state._singleCard3D = false;
            if (btn3d) btn3d.classList.remove('active');
            threeRenderer.dispose();
            renderSingleCardContent(pn, newIdx, true);
        }
        return;
    }

    renderSingleCardContent(pn, newIdx, true);
}

/* Toggle 3D preview inside single-card wrap */
function toggleSingleCard3D() {
    var pn = currentStudyPageNum();
    if (pn == null) return;
    var wrap = $('#sc-card-wrap');
    var btn = $('#sc-3d-btn');
    if (!wrap || !btn) return;
    var cards = state.cards[pn] || [];
    var card = cards[state.singleCardIndex];
    if (!cardHasModel(card)) return;

    if (state._singleCard3D) {
        /* Back to card view */
        state._singleCard3D = false;
        btn.classList.remove('active');
        threeRenderer.dispose();
        renderSingleCardContent(pn, state.singleCardIndex, false);
        return;
    }

    /* Show 3D */
    state._singleCard3D = true;
    btn.classList.add('active');
    wrap.innerHTML = '<div class="sc-3d-wrap" id="sc-3d-wrap"></div>';
    var modelUrl = card.data.model || card.data.url;
    threeRenderer.loadInto($('#sc-3d-wrap'), modelUrl);
}

/* ===== Three.js renderer (lazy loaded via ES modules) ===== */
var threeRenderer = {
    ready: false,
    THREE: null,
    GLTFLoader: null,
    renderer: null,
    scene: null,
    camera: null,
    model: null,
    animId: null,
    container: null,
    currentUrl: null,
    autoRotate: true,
    _rotX: 0,
    _rotY: 0,
    _zoom: 8,

    /* Load three + GLTFLoader once (ES module dynamic import) */
    load: function () {
        var self = this;
        if (this.ready) return Promise.resolve(true);
        return Promise.all([
            import('three'),
            import('three/addons/loaders/GLTFLoader.js')
        ]).then(function (mods) {
            self.THREE = mods[0];
            self.GLTFLoader = mods[1].GLTFLoader;
            self.ready = true;
            return true;
        }).catch(function (e) {
            console.error('three load failed', e);
            return false;
        });
    },

    loadInto: function (container, url) {
        var self = this;
        this.container = container;
        this.currentUrl = url;
        this._loadSeq = (this._loadSeq || 0) + 1;
        var seq = this._loadSeq;
        this.load().then(function (ok) {
            if (seq !== self._loadSeq) return; /* stale request */
            if (!ok) { container.innerHTML = '<div class="sc-3d-err">Three.js load failed</div>'; return; }
            if (!self.renderer) {
                self._init();
            } else {
                /* Reuse renderer: move existing canvas into the new container */
                if (!self.renderer.domElement.parentNode) container.appendChild(self.renderer.domElement);
                /* Wait one frame so the fresh container has its real size */
                requestAnimationFrame(function () {
                    if (seq !== self._loadSeq) return;
                    self._resize();
                });
            }
            self._loadModel(url, seq);
        });
    },

    _resize: function () {
        if (!this.renderer || !this.container) return;
        var w = this.container.clientWidth || 600;
        var h = this.container.clientHeight || 400;
        this.renderer.setSize(w, h);
        if (this.camera) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }
    },

    _init: function () {
        var container = this.container;
        var w = container.clientWidth || 600;
        var h = container.clientHeight || 400;
        this.renderer = new this.THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        this.scene = new this.THREE.Scene();
        this.camera = new this.THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        this.camera.position.set(0, 1.2, 4.2);
        this.camera.lookAt(0, 0, 0);
        this._zoom = 4.2;

        var ambient = new this.THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);
        var dir = new this.THREE.DirectionalLight(0xffffff, 0.9);
        dir.position.set(5, 10, 7);
        this.scene.add(dir);
        var dir2 = new this.THREE.DirectionalLight(0xffffff, 0.3);
        dir2.position.set(-5, -3, -5);
        this.scene.add(dir2);

        this._setupControls();
        this.animId = requestAnimationFrame(this._animate.bind(this));
        if (!this._resizeBound) {
            this._onResizeHandler = this._onResize.bind(this);
            window.addEventListener('resize', this._onResizeHandler);
            this._resizeBound = true;
        }
    },

    _setupControls: function () {
        var self = this;
        var isDragging = false;
        var prevX = 0, prevY = 0;
        var dom = this.renderer.domElement;

        dom.addEventListener('mousedown', function (e) {
            isDragging = true;
            self.autoRotate = false;
            prevX = e.clientX; prevY = e.clientY;
            dom.style.cursor = 'grabbing';
        });
        window.addEventListener('mouseup', function () {
            if (isDragging) { isDragging = false; dom.style.cursor = 'grab'; }
        });
        dom.addEventListener('mousemove', function (e) {
            if (!isDragging || !self.model) return;
            var dx = e.clientX - prevX;
            var dy = e.clientY - prevY;
            prevX = e.clientX; prevY = e.clientY;
            self._rotY += dx * 0.01;
            self._rotX += dy * 0.01;
            self._rotX = Math.max(-1.5, Math.min(1.5, self._rotX));
            self.model.rotation.y = self._rotY;
            self.model.rotation.x = self._rotX;
        });
        dom.addEventListener('wheel', function (e) {
            e.preventDefault();
            self._zoom += e.deltaY * 0.005;
            self._zoom = Math.max(2, Math.min(20, self._zoom));
        }, { passive: false });
        dom.style.cursor = 'grab';
    },

    _loadModel: function (url, seq) {
        var self = this;
        if (this.model) { this.scene.remove(this.model); this.model = null; }
        var loader = new this.GLTFLoader();
        loader.load(url, function (gltf) {
            if (seq !== self._loadSeq) return; /* stale request */
            self.model = gltf.scene || gltf.scenes[0];
            var box = new self.THREE.Box3().setFromObject(self.model);
            var size = box.getSize(new self.THREE.Vector3());
            var maxDim = Math.max(size.x, size.y, size.z);
            var scale = maxDim > 0 ? 3.2 / maxDim : 1;
            self.model.scale.setScalar(scale);
            var center = box.getCenter(new self.THREE.Vector3());
            self.model.position.sub(center);
            self.scene.add(self.model);
            self.model.rotation.y = self._rotY;
            self.model.rotation.x = self._rotX;
        }, undefined, function (err) {
            if (seq !== self._loadSeq) return;
            console.error('model load error', err);
            if (self.container) self.container.innerHTML = '<div class="sc-3d-err">Failed to load model</div>';
        });
    },

    _animate: function () {
        if (!this.renderer) return;
        if (this.model && this.autoRotate) this.model.rotation.y += 0.004;
        this.camera.position.z = this._zoom;
        this.camera.lookAt(0, 0, 0);
        this.renderer.render(this.scene, this.camera);
        this.animId = requestAnimationFrame(this._animate.bind(this));
    },

    _onResize: function () {
        if (!this.renderer || !this.container) return;
        this._resize();
    },

    dispose: function () {
        if (this.animId) cancelAnimationFrame(this.animId);
        this.animId = null;
        if (this._resizeBound && this._onResizeHandler) {
            window.removeEventListener('resize', this._onResizeHandler);
            this._resizeBound = false;
            this._onResizeHandler = null;
        }
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }
        this.scene = null;
        this.camera = null;
        this.model = null;
        this.container = null;
        this.currentUrl = null;
        this.autoRotate = true;
        this._rotX = 0; this._rotY = 0; this._zoom = 4.2;
        this._loadSeq = (this._loadSeq || 0) + 1;
    }
};

function renderStudyPages() {
    var container = $('#study-pages-container');
    if (!container) return;
    var existing = {};
    container.querySelectorAll('.study-page').forEach(function (el) { existing[el.dataset.tabId] = el; });
    var tabs = state.tabs.filter(function (t) { return t.type === 'study'; });
    var html = '';
    tabs.forEach(function (t) {
        if (existing[t.id]) {
            existing[t.id].style.display = state.activeTab === t.id ? 'block' : 'none';
        } else {
            html += '<div class="study-page" data-tab-id="' + t.id + '" style="display:' + (state.activeTab === t.id ? 'block' : 'none') + '"><div id="study-' + t.pageNum + '"></div></div>';
        }
    });
    Object.keys(existing).forEach(function (id) {
        if (!tabs.find(function (t) { return t.id === id; })) existing[id].remove();
    });
    if (html) container.insertAdjacentHTML('beforeend', html);
    if (state.activeTab && state.activeTab.startsWith('s')) {
        var pageNum = parseInt(state.activeTab.slice(1));
        loadPage(pageNum).then(function () { renderStudyPage(pageNum); });
    }
}

function renderContent() {
    var catalogue = $('#catalogue-view');
    var studyPages = $$('.study-page');
    if (state.activeTab === 'catalogue') {
        catalogue.style.display = 'block';
        studyPages.forEach(function (el) { el.style.display = 'none'; });
    } else {
        catalogue.style.display = 'none';
        studyPages.forEach(function (el) {
            el.style.display = el.dataset.tabId === state.activeTab ? 'block' : 'none';
        });
    }
}

function openPage(n) {
    var existing = state.tabs.find(function (t) { return t.type === 'study' && t.pageNum === n; });
    if (existing) {
        var tabEl = document.querySelector('[data-tab="' + existing.id + '"]');
        if (tabEl) { tabEl.classList.add('shake'); setTimeout(function () { tabEl.classList.remove('shake'); }, 300); }
        return;
    }
    state.tabs.push({ id: 's' + n, type: 'study', title: 'P' + String(n).padStart(3, '0'), pageNum: n });
    state.tabs.sort(function (a, b) { return a.pageNum - b.pageNum; });
    saveOpenTabs();
    renderTabs();
    renderStudyPages();
}

/* Mobile: jump straight into single-card study for a page. */
function openMobilePage(n) {
    if (!state.tabs.find(function (t) { return t.type === 'study' && t.pageNum === n; })) {
        state.tabs.push({ id: 's' + n, type: 'study', title: 'P' + String(n).padStart(3, '0'), pageNum: n });
        state.tabs.sort(function (a, b) { return a.pageNum - b.pageNum; });
        saveOpenTabs();
    }
    state.activeTab = 's' + n;
    renderTabs();
    renderStudyPages();
    renderContent();
    state.singleCardMode = true;
    state.singleCardIndex = 0;
    var btn = $('#card-view-btn');
    if (btn) btn.classList.add('active');
    var cards = state.cards[n] || [];
    var loadOk = cards.length ? Promise.resolve(cards) : loadPage(n);
    loadOk.then(function () { renderSingleCardStage(n); });
}

function closeTab(id) {
    state.tabs = state.tabs.filter(function (t) { return t.id !== id; });
    saveOpenTabs();
    if (state.activeTab === id) state.activeTab = 'catalogue';
    renderTabs();
    renderStudyPages();
    renderContent();
}

function setActiveTab(id) {
    state.activeTab = id;
    renderTabs();
    renderContent();
    if (id.startsWith('s')) {
        var pageNum = parseInt(id.slice(1));
        loadPage(pageNum).then(function () { renderStudyPage(pageNum); });
    }
}

function saveOpenTabs() {
    if (!state.deckId) return;
    localStorage.setItem('dc-open-tabs-' + state.deckId, JSON.stringify(state.tabs.filter(function (t) { return t.type === 'study'; }).map(function (t) { return t.pageNum; })));
}

function restoreOpenTabs() {
    if (!state.deckId) return;
    var saved = localStorage.getItem('dc-open-tabs-' + state.deckId);
    if (saved) {
        try {
            var pages = JSON.parse(saved);
            pages.forEach(function (n) {
                if (!state.tabs.find(function (t) { return t.type === 'study' && t.pageNum === n; })) {
                    state.tabs.push({ id: 's' + n, type: 'study', title: 'P' + String(n).padStart(3, '0'), pageNum: n });
                }
            });
            state.tabs.sort(function (a, b) { return a.pageNum - b.pageNum; });
        } catch (e) {}
    }
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
        document.getElementById('mm-sub').textContent = deck.template_name ? (deck.template_name + (deck.template_description ? ' · ' + deck.template_description : '')) : t('home.notBound');
        document.getElementById('mm-data-count').textContent = (deck.item_count || 0).toLocaleString();

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
                        renderDeckList();
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

        renderMmTemplates(deck);
        renderMmPreview(null);

        $('#manage-modal').style.display = 'flex';
    }).catch(function () { showToast('Failed to load deck info', true); });
}

function closeManageModal() {
    $('#manage-modal').style.display = 'none';
    _manageDeckId = null;
}

function renderMmTemplates(deck) {
    var box = document.getElementById('mm-tpl-list');
    if (!box) return;
    box.innerHTML = '<div style="color:var(--hp-text-sub);font-size:13px;padding:8px 2px;">' + t('common.loading') + '</div>';

    fetch('/v1/decks/' + deck.id + '/templates').then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) { box.innerHTML = ''; return; }
        var list = d.templates || [];
        var activeId = deck.active_template_id;
        box.innerHTML = '';

        /* Render up to 3 slots: existing templates + empty slots */
        for (var i = 0; i < 3; i++) {
            if (i < list.length) {
                var tpl = list[i];
                var isActive = (tpl.id === activeId);
                var el = document.createElement('div');
                el.className = 'tpl-card' + (isActive ? ' active' : '');
                el.dataset.templateId = tpl.id;
                el.innerHTML =
                    '<span class="tpl-name">' + escapeHtml(tpl.name) + '</span>' +
                    '<div class="tpl-actions">' +
                        '<button class="tpl-icon-btn flex items-center justify-center w-7 h-7 border border-[var(--hp-border)] rounded-lg bg-transparent cursor-pointer text-xs text-[var(--hp-text-sub)] transition-all hover:bg-[var(--hp-primary-soft)] hover:text-[var(--hp-primary)] hover:border-[var(--hp-primary)]" data-mm-action="upload-template" data-tid="' + tpl.id + '" title="' + t('manage.replaceTemplate') + '"><i class="fa-solid fa-upload"></i></button>' +
                        '<button class="tpl-icon-btn flex items-center justify-center w-7 h-7 border border-[var(--hp-border)] rounded-lg bg-transparent cursor-pointer text-xs text-[var(--hp-text-sub)] transition-all hover:bg-[var(--hp-primary-soft)] hover:text-[var(--hp-primary)] hover:border-[var(--hp-primary)]" data-mm-action="export-template" data-tid="' + tpl.id + '" title="' + t('manage.exportTemplate') + '"><i class="fa-solid fa-download"></i></button>' +
                    '</div>' +
                    '<div class="tpl-select"></div>';
                el.addEventListener('click', function (e) {
                    if (e.target.closest('.tpl-icon-btn')) return;
                    if (e.target.closest('.tpl-select')) {
                        /* Setting active is handled by the select click below */
                        return;
                    }
                    var tid = parseInt(this.dataset.templateId);
                    renderMmPreview(tid);
                });
                /* Select radio: set as active */
                var selectEl = el.querySelector('.tpl-select');
                if (selectEl) {
                    selectEl.addEventListener('click', function (e) {
                        e.stopPropagation();
                        var tid = parseInt(this.parentElement.dataset.templateId);
                        setActiveMmTemplate(deck.id, tid);
                    });
                }
                box.appendChild(el);
            } else {
                /* Empty slot */
                var empty = document.createElement('div');
                empty.className = 'tpl-card empty';
                empty.innerHTML = '<div class="tpl-empty-inner"><span class="plus">+</span><span>' + t('manage.uploadTemplate') + '</span></div>';
                empty.addEventListener('click', function () {
                    if (_manageDeckId) doUploadDeckTemplate(_manageDeckId);
                });
                box.appendChild(empty);
            }
        }
    }).catch(function () {});
}

function renderMmPreview(templateId) {
    var area = document.getElementById('mm-preview-area');
    var label = document.getElementById('mm-preview-label');
    if (!area) return;
    if (!templateId || !_manageDeckId) {
        area.innerHTML = '<div class="preview-placeholder">' + t('manage.previewPlaceholder') + '</div>';
        if (label) label.textContent = t('manage.previewHint');
        return;
    }
    if (label) label.textContent = t('common.loading');
    area.innerHTML = '<div style="text-align:center;padding:20px;color:var(--hp-text-light);font-size:13px;">' + t('common.loading') + '</div>';

    fetch('/v1/decks/' + _manageDeckId + '/preview?template_id=' + templateId).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) {
            area.innerHTML = '<div class="preview-placeholder">' + (d.error || t('manage.loadPreviewFailed')) + '</div>';
            if (label) label.textContent = t('manage.previewFailed');
            return;
        }
        if (label) label.textContent = (d.template ? d.template.name : t('manage.preview'));
        var cardData = d.sample_card;
        if (!cardData) {
            area.innerHTML = '<div class="preview-placeholder">' + t('manage.noSample') + '</div>';
            return;
        }
        cardData._pageNum = 0;
        cardData._showAnswer = false;
        if (cardData.data && cardData.data.examples) cardData.data.examples.forEach(function (e) { e._show = false; });
        cardData.is_unknown = 0;
        cardData.is_favorite = 0;
        cardData.current_order = cardData.current_order || cardData.item_order || 1;
        /* Use template data directly with shadow DOM to avoid polluting global state */
        var renderedHtml, tplCss;
        try {
            var tpl = d.template;
            var tempApi = createApiForCard(cardData);
            /* Eval this template's JS so window.cardTemplate reflects THIS template,
               then restore the previous global afterwards to avoid polluting the study view. */
            var savedCardTemplate = window.cardTemplate;
            var evalError = null;
            try { (0, eval)(tpl.card_js || ''); } catch (e) { evalError = e; console.error('template js error', e); }
            if (window.cardTemplate && typeof window.cardTemplate.render === 'function') {
                renderedHtml = window.cardTemplate.render(tpl.card_html, cardData, tempApi);
            } else {
                renderedHtml = templateEngine.renderCard(cardData, tpl.card_html);
            }
            tplCss = tpl.card_css || '';
            area.innerHTML = '<style>' + tplCss + '</style><div class="mm-preview-card">' + renderedHtml + '</div>';
            var cardEl = area.querySelector('[data-card-id]');
            if (cardEl && cardData) templateEngine.initCard(cardEl, cardData);
            /* Restore the previously active template global after init */
            window.cardTemplate = savedCardTemplate;
            if (evalError && (!renderedHtml || renderedHtml.indexOf('Render error') === 0)) {
                renderedHtml = '<div class="error-state">Render error: ' + escapeHtml(evalError.message) + '</div>';
                area.innerHTML = '<style>' + tplCss + '</style><div class="mm-preview-card">' + renderedHtml + '</div>';
            }
        } catch (err) {
            renderedHtml = '<div class="error-state">Render error: ' + escapeHtml(err.message) + '</div>';
            tplCss = '';
            area.innerHTML = '<style></style><div class="mm-preview-card">' + renderedHtml + '</div>';
        }
    }).catch(function () {
        area.innerHTML = '<div class="preview-placeholder">' + t('common.loadFailed') + '</div>';
        if (label) label.textContent = t('manage.previewHint');
    });
}

function setActiveMmTemplate(deckId, templateId) {
    fetch('/v1/decks/' + deckId + '/active-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId })
    }).then(function (r) { return r.json(); }).then(function (d) {
        if (d.success) {
            showToast(t('manage.setActive'));
            if (_manageDeckId == deckId) openManageModal(deckId);
            renderDeckList();
            if (state.deckId == deckId) {
                state.templateId = templateId;
                templateEngine.loadTemplate(templateId).then(function () {
                    state.cards = {}; renderStudyPages(); loadInfo();
                });
            }
        } else { showToast(d.error || 'Failed', true); }
    }).catch(function () { showToast('Failed', true); });
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

/* ===== Template & Data Upload ===== */
function doUploadDeckTemplate(deckId, replaceTid) {
    var input = $('#deck-template-input');
    input.onchange = function () {
        if (!input.files || !input.files[0]) return;
        var file = input.files[0];
        var reader = new FileReader();
        reader.onload = function (e) {
            var body = { content: e.target.result };
            if (replaceTid) body.replace_template_id = replaceTid;
            fetch('/v1/decks/' + deckId + '/templates', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            }).then(function (r) { return r.json(); }).then(function (d) {
                if (d.success) {
                    showToast(t('manage.uploaded', { name: d.template.name }));
                    if (_manageDeckId == deckId) openManageModal(deckId);
                    else openManageModal(deckId);
                    if (state.deckId === deckId) state.templateId = d.template.id || state.templateId;
                } else { showToast(d.error || t('manage.uploadFailed'), true); }
            }).catch(function () { showToast(t('manage.uploadFailed'), true); });
        };
        reader.readAsText(file);
        input.value = '';
    };
    input.click();
}

function doUploadDeckData(deckId, anchorEl) {
    var input = $('#deck-data-input');
    input.onchange = function () {
        if (!input.files || !input.files[0]) return;
        var file = input.files[0];
        var doImport = function () {
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                var formData = new FormData();
                formData.append('file', file);
                fetch('/v1/decks/' + deckId + '/import-excel', { method: 'POST', body: formData })
                    .then(function (r) { return r.json(); }).then(function (d) {
                        if (d.success) {
                            showToast('Imported ' + d.count + ' items from Excel');
                            if (_manageDeckId == deckId) openManageModal(deckId);
                            else openManageModal(deckId);
                            if (state.deckId == deckId) { state.cards = {}; loadInfo(); renderCatalogue(); }
                        } else { showToast(d.error || t('toast.importFailed'), true); }
                    }).catch(function () { showToast(t('toast.importFailed'), true); });
            } else {
                var reader = new FileReader();
                reader.onload = function (e) {
                    var jsonData;
                    try { jsonData = JSON.parse(e.target.result); } catch (err) { showToast(t('toast.invalidJson'), true); return; }
                    fetch('/v1/decks/' + deckId + '/import', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(jsonData)
                    }).then(function (r) { return r.json(); }).then(function (d) {
                        if (d.success) {
                            showToast(t('manage.imported', { n: d.count }));
                            if (_manageDeckId == deckId) openManageModal(deckId);
                            else openManageModal(deckId);
                            if (state.deckId == deckId) { state.cards = {}; loadInfo(); renderCatalogue(); }
                        } else { showToast(d.error || t('toast.importFailed'), true); }
                    }).catch(function () { showToast(t('toast.importFailed'), true); });
                };
                reader.readAsText(file);
            }
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

function doExportDeckTemplate(deckId) {
    fetch('/v1/decks/' + deckId).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success || !d.deck.active_template_id) { showToast('No template to export', true); return; }
        return fetch('/v1/templates/' + d.deck.active_template_id + '/export');
    }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) { showToast('Export failed', true); return; }
        var blob = new Blob([d.content], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = $('#download-helper');
        a.href = url; a.download = d.name; a.click();
        URL.revokeObjectURL(url);
        showToast('Template exported');
    }).catch(function () { showToast('Export failed', true); });
}

function exportTemplate(templateId) {
    fetch('/v1/templates/' + templateId + '/export').then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) { showToast('Export failed', true); return; }
        var blob = new Blob([d.content], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = $('#download-helper');
        a.href = url; a.download = d.name; a.click();
        URL.revokeObjectURL(url);
        showToast('Template exported');
    }).catch(function () { showToast('Export failed', true); });
}

/* ===== Template Preview (standalone modal, no sidebar) ===== */
function openDeckPreview(deckId) {
    showModal('preview');
    var canvas = $('#preview-canvas');
    canvas.innerHTML = '<div class="preview-loading">' + t('preview.loading') + '</div>';
    fetch('/v1/decks/' + deckId + '/preview').then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) { canvas.innerHTML = '<div class="error-state">' + (d.error || t('preview.failed')) + '</div>'; return; }
        var oldScript = document.getElementById('dc-template-script');
        if (oldScript) oldScript.remove();
        var script = document.createElement('script');
        script.id = 'dc-template-script';
        script.textContent = '\n' + d.template.card_js + '\n//# sourceURL=preview-deck-' + deckId + '\n';
        document.head.appendChild(script);
        renderPreviewCard(canvas, d.template, d.sample_card);
    }).catch(function () { canvas.innerHTML = '<div class="error-state">' + t('preview.failed') + '</div>'; });
}

function renderPreviewCard(canvas, template, sampleCard) {
    if (!sampleCard) {
        canvas.innerHTML = '<div class="preview-no-card">' + t('preview.noCard') + '</div>';
        return;
    }
    var cardData = JSON.parse(JSON.stringify(sampleCard));
    cardData._pageNum = 0;
    cardData._showAnswer = false;
    if (cardData.data && cardData.data.examples) cardData.data.examples.forEach(function (e) { e._show = false; });
    cardData.is_unknown = 0;
    cardData.is_favorite = 0;
    cardData.current_order = cardData.current_order || cardData.item_order || 1;
    var html = templateEngine.renderCard(cardData, '');
    canvas.innerHTML = '<style>' + (template.card_css || '') + '</style><div style="max-width:600px;margin:0 auto;">' + html + '</div>';
    var cardEl = canvas.querySelector('[data-card-id]');
    if (cardEl) templateEngine.initCard(cardEl, cardData);
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

/* ===== Back to Home ===== */
 function goHomeFromStudy() {
    resetSingleCardMode();
    state.deckId = null;
    state.templateId = null;
    state.currentDeck = null;
    state.cards = {};
    state.tabs = [];
    state.activeTab = 'catalogue';
    state.enteredPages = new Set();
    showDeckView();
    switchGlobalPage('home');
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
        var titles = { achievements: 'page.achievements', stats: 'page.stats', market: 'page.market', docs: 'page.docs' };
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

        /* Global sidebar navigation */
        var gsItem = target.closest('.gs-nav-item');
        if (gsItem) {
            switchGlobalPage(gsItem.dataset.gsPage);
            return;
        }

        /* Back button (study -> home) */
        if (target.closest('#study-back-btn')) {
            if (isMobile()) {
                /* Mobile: minimal flow. Step back from single-card to the page
                   list, then straight home on the next tap (no confirm dialog). */
                if (state.singleCardMode) {
                    resetSingleCardMode();
                    state.activeTab = 'catalogue';
                    renderContent();
                } else {
                    goHomeFromStudy();
                }
                return;
            }
            if (state.mode === 'study') {
                showPopoverConfirm(target.closest('#study-back-btn'), t('toast.returnHome'), goHomeFromStudy);
            } else {
                goHomeFromStudy();
            }
            return;
        }

        /* Sidebar DragonCard -> catalogue tab */
        if (target.closest('#sidebar-home-btn')) {
            setActiveTab('catalogue');
            return;
        }

        /* Scroll to top / bottom */
        if (target.closest('#scroll-top-btn')) {
            var scroller = $('.study-scroll');
            if (scroller) scroller.scrollTop = 0;
            return;
        }
        if (target.closest('#scroll-bottom-btn')) {
            var scroller = $('.study-scroll');
            if (scroller) scroller.scrollTop = scroller.scrollHeight;
            return;
        }

        /* Single-card mode toggle + navigation */
        if (target.closest('#card-view-btn')) { toggleSingleCardMode(); return; }
        if (target.closest('[data-sc="prev"]')) { singleCardNav(-1); return; }
        if (target.closest('[data-sc="next"]')) { singleCardNav(1); return; }
        if (target.closest('[data-sc-3d]')) { toggleSingleCard3D(); return; }

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
        if (target.closest('[data-mm-action="upload-template"]')) {
            if (_manageDeckId) doUploadDeckTemplate(_manageDeckId, parseInt(target.closest('[data-mm-action="upload-template"]').dataset.tid));
            return;
        }
        /* Export template */
        if (target.closest('[data-mm-action="export-template"]')) {
            var tid = target.closest('[data-mm-action="export-template"]').dataset.tid;
            if (_manageDeckId && tid) exportTemplate(tid);
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
                        if (d.success) { nameEl.textContent = d.deck.name; showToast(t('manage.renamed')); renderDeckList(); }
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
                    renderDeckList();
                } else { showToast(d.error || t('newDeck.failed'), true); }
            }).catch(function () { showToast(t('newDeck.failed'), true); });
            return;
        }

        /* How To */
        if (target.closest('#howto-btn')) {
            showModal('template-api');
            var el = $('#api-md-content');
            if (el && !el.dataset.loaded) { el.textContent = TEMPLATE_API_MD; el.dataset.loaded = '1'; }
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

        /* Manage: template operations (upload / remove / set-active) */
        if (target.closest('[data-upload-template]')) {
            doUploadDeckTemplate(parseInt(target.closest('[data-upload-template]').dataset.uploadTemplate));
            return;
        }
        if (target.closest('[data-set-active-template]')) {
            var sBtn = target.closest('[data-set-active-template]');
            setActiveMmTemplate(parseInt(sBtn.dataset.setActiveTemplate), parseInt(sBtn.dataset.tid));
            return;
        }
        if (target.closest('[data-export-template]')) {
            doExportDeckTemplate(parseInt(target.closest('[data-export-template]').dataset.exportTemplate));
            return;
        }
        if (target.closest('[data-upload-data]')) {
            var udBtn = target.closest('[data-upload-data]');
            doUploadDeckData(parseInt(udBtn.dataset.uploadData), udBtn);
            return;
        }
        if (target.closest('[data-preview-deck]')) {
            openDeckPreview(parseInt(target.closest('[data-preview-deck]').dataset.previewDeck));
            return;
        }

        /* Preview modal close */
        if (target.closest('#preview-modal-close') || (target.closest('#preview-modal') && !target.closest('.preview-modal-content'))) {
            var pts = document.getElementById('dc-template-script');
            if (pts) pts.remove();
            hideModal('preview');
            if (state.templateId && state.deckId) {
                templateEngine.loadTemplate(state.templateId).then(function () {
                    if (state.activeTab && state.activeTab.startsWith('s')) { state.cards = {}; renderStudyPages(); }
                });
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
            btn.textContent = 'Processing...';
            fetch('/v1/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: state.userId, deck_id: state._reorderDeckId || state.deckId })
            }).then(function (r) { return r.json(); }).then(function (d) {
                hideModal('goagain');
                showToast('Cards reordered successfully!');
                state.cards = {}; state.tabs = []; state.activeTab = 'catalogue'; state.enteredPages = new Set();
                renderTabs(); renderStudyPages(); renderContent(); loadInfo();
            }).catch(function () { showToast('Failed to reorder', true); })
            .finally(function () { btn.disabled = false; btn.textContent = 'Confirm'; });
            return;
        }
        if (target.closest('#import-confirm-cancel')) { hideModal('import-confirm'); return; }
        if (target.closest('#import-confirm-ok')) {
            hideModal('import-confirm');
            if (typeof _pendingImport === 'function') { _pendingImport(); _pendingImport = null; }
            return;
        }

        /* Catalogue page click */
        if (target.closest('.page-btn')) {
            var page = parseInt(target.closest('.page-btn').dataset.page);
            if (isMobile()) {
                openMobilePage(page);
            } else {
                var alreadyOpen = state.tabs.find(function (t) { return t.type === 'study' && t.pageNum === page; });
                if (alreadyOpen) {
                    var tabEl = document.querySelector('[data-tab="' + alreadyOpen.id + '"]');
                    if (tabEl) { tabEl.classList.add('shake'); setTimeout(function () { tabEl.classList.remove('shake'); }, 300); }
                } else {
                    openPage(page);
                }
            }
            return;
        }

        /* Tab click */
        if (target.closest('.tab-item') && !target.closest('.tab-close-btn')) {
            var tabId = target.closest('.tab-item').dataset.tab;
            if (state.activeTab === tabId) {
                var el = target.closest('.tab-item');
                el.classList.add('shake');
                setTimeout(function () { el.classList.remove('shake'); }, 300);
            } else {
                setActiveTab(tabId);
            }
            return;
        }

        /* Tab close */
        if (target.closest('.tab-close-btn')) {
            showFinishModal(target.closest('.tab-close-btn').dataset.tabId);
            return;
        }

        /* Font scale */
        if (target.closest('#font-settings-btn')) {
            var drawer = $('#font-drawer');
            var btn = target.closest('#font-settings-btn');
            var rect = btn.getBoundingClientRect();
            drawer.style.top = (rect.bottom + 8) + 'px';
            drawer.style.left = (rect.left + rect.width / 2) + 'px';
            drawer.style.transform = 'translateX(-50%)';
            drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
            return;
        }
        if (target.closest('#font-size-minus')) { state.fontSize = Math.max(0.8, Math.round((state.fontSize - 0.1) * 10) / 10); applyCardFont(); return; }
        if (target.closest('#font-size-plus')) { state.fontSize = Math.min(1.8, Math.round((state.fontSize + 0.1) * 10) / 10); applyCardFont(); return; }
        if (target.closest('#reset-fonts')) { state.fontSize = 1; applyCardFont(); return; }

        /* Refresh stats */
        if (target.closest('#refresh-stats')) {
            if (!state._refreshLock) {
                state._refreshLock = true;
                loadInfo();
                showToast('Stats refreshed');
                setTimeout(function () { state._refreshLock = false; }, 1000);
            }
            return;
        }

        /* Dark theme */
        if (target.closest('#dark-theme-btn') || target.closest('#dark-theme-btn-study')) {
            state.darkTheme = !state.darkTheme;
            applyDarkTheme();
            return;
        }

        /* Language toggle */
        if (target.closest('#lang-toggle-btn')) {
            toggleLang();
            return;
        }

        /* Settings */
        if (target.closest('#settings-btn')) { showModal('about'); return; }

        /* Finish modal */
        if (target.closest('#modal-finish-cancel')) { hideModal('finish'); return; }
        if (target.closest('#modal-finish-confirm')) {
            hideModal('finish');
            audioFeedback.playSuccess();
            closeTab(state._closingTabId);
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

    /* Keyboard navigation for single-card mode */
    document.addEventListener('keydown', function (e) {
        if (!state.singleCardMode) return;
        var pn = currentStudyPageNum();
        if (pn == null) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); singleCardNav(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); singleCardNav(1); }
        else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); singleCardNav(1); }
        else if (e.key === 'Escape') { toggleSingleCardMode(); }
    });

    /* Swipe to navigate cards in single-card mode (mobile) */
    var _touchStartX = null, _touchStartY = null;
    document.addEventListener('touchstart', function (e) {
        if (!isMobile() || !state.singleCardMode) return;
        if (e.touches.length !== 1) return;
        var t = e.touches[0];
        _touchStartX = t.clientX; _touchStartY = t.clientY;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
        if (_touchStartX == null || !isMobile() || !state.singleCardMode) return;
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        var dx = t.clientX - _touchStartX;
        var dy = t.clientY - _touchStartY;
        _touchStartX = null; _touchStartY = null;
        /* Require horizontal intent and a decent swipe distance */
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
        singleCardNav(dx < 0 ? 1 : -1);
    }, { passive: true });
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
