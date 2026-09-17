/* ================= v2 字母拼拼乐（糖果积木 · 初中英语格式） ================= */
(function () {
  'use strict';

  var FIELDS = [
    { key: 'word', label: '单词', hideable: false },
    { key: 'phonetic_us', label: '音标' },
    { key: 'paraphrase_zh', label: '中文释义' },
    { key: 'paraphrase_en', label: '英文释义' },
    { key: 'examples', label: '例句' }
  ];
  var HINT_MAX = 4;

  /* ---------------------------------------------------------- 游戏状态 */
  function shuffle(letters) {
    var pool = letters.map(function (ch, i) { return { ch: ch, i: i }; });
    for (var guard = 0; guard < 80; guard++) {
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      if (pool.map(function (p) { return p.ch; }).join('') !== letters.join('')) break;
    }
    return pool;
  }
  function newGame(word) {
    var letters = String(word || '').toLowerCase().split('');
    return {
      word: String(word || '').toLowerCase(),
      letters: letters,
      pool: shuffle(letters),
      slots: letters.map(function () { return -1; }),
      status: 'idle', hint: 0, busy: false
    };
  }
  function state(cardData, word) {
    if (!cardData._pk) cardData._pk = {};
    var s = cardData._pk;
    if (!s.g || s.g.word !== String(word || '').toLowerCase()) s.g = newGame(word);
    return s;
  }
  function firstEmpty(g) {
    for (var i = 0; i < g.slots.length; i++) if (g.slots[i] < 0) return i;
    return -1;
  }
  function usedMap(g) {
    var m = {};
    g.slots.forEach(function (p) { if (p >= 0) m[p] = 1; });
    return m;
  }
  function clearSlots(g) { g.slots = g.letters.map(function () { return -1; }); }
  function applyHint(g) {
    clearSlots(g);
    if (g.hint >= 2 && g.letters.length) {
      for (var i = 0; i < g.pool.length; i++) {
        if (g.pool[i].ch === g.letters[0]) { g.slots[0] = i; break; }
      }
    }
  }

  /* ------------------------------------------------------- 糖果积木砖 */
  /* 单个可点糖果砖（带字母） */
  function candyTileHtml(ch, opts) {
    opts = opts || {};
    var bc = PK.blockColors(ch);
    var cls = 'sw-block sw-tile' + (opts.cls ? ' ' + opts.cls : '');
    var attrs = ' data-pi="' + opts.pi + '"';
    return '<button type="button" class="' + cls + '"' + attrs + ' style="--sw-c-hi:' + bc.hi
      + ';--sw-c1:' + bc.c1 + ';--sw-c2:' + bc.c2 + ';--sw-c-deep:' + bc.deep + '">'
      + '<span class="sw-letter">' + PK.esc(ch) + '</span></button>';
  }
  /* 槽位：空槽为虚线框；填入后显示与砖池一致的彩色方块 */
  function candySlotHtml(ch, opts) {
    opts = opts || {};
    var cls = 'sw-slot' + (opts.cls ? ' ' + opts.cls : '');
    var inner = '';
    if (ch) {
      var bc = PK.blockColors(ch);
      inner = '<span class="sw-block sw-in-slot" style="--sw-c-hi:' + bc.hi
        + ';--sw-c1:' + bc.c1 + ';--sw-c2:' + bc.c2 + ';--sw-c-deep:' + bc.deep + '">'
        + '<span class="sw-letter">' + PK.esc(ch) + '</span></span>';
    }
    return '<span class="' + cls + '" data-slot="' + opts.i + '">' + inner + '</span>';
  }

  /* -------------------------------------------------------------- 渲染 */
  function render(cardHtml, cardData, api) {
    var d = (cardData && cardData.data) || {};
    var pd = PK.parseData(d);
    var word = pd.word.toLowerCase();
    var hid = PK.hiddenSet(api);
    var order = cardData.current_order == null ? '' : String(cardData.current_order);
    if (order.length < 2) order = '0' + order;
    var view = PK.viewMode(api);

    var h = '<div class="sw-card sw-bl" data-card-id="' + cardData.id + '">';
    h += '<div class="sw-head"><span class="sw-badge">' + PK.esc(order) + '</span>';
    if (pd.zh && !hid.has('paraphrase_zh')) h += '<span class="sw-chip">' + PK.esc(pd.zh) + '</span>';
    h += '<span class="sw-spacer"></span>';

    /* 列表模式降级 */
    if (view !== 'single') {
      h += '<span class="sw-chip">浏览模式</span></div>';
      h += '<div class="sw-panel"><div class="sw-en">' + PK.esc(pd.word) + '</div>'
        + (pd.zh ? '<div class="sw-cn">' + PK.esc(pd.zh) + '</div>' : '') + '</div>';
      h += '<div class="sw-bubble">🕹 切到「单卡模式」就能玩字母拼拼乐。</div>';
      h += '<div class="sw-acts">';
      h += '<button type="button" class="sw-act is-pri" data-action="play"><span class="sw-emo">🔊</span>读一遍</button>';
      h += '</div>';
      h += PK.themeBarHtml() + '</div>';
      return h;
    }

    var s = state(cardData, word);
    var g = s.g;
    var cursor = firstEmpty(g);
    var used = usedMap(g);
    var nextCh = cursor >= 0 ? g.letters[cursor] : '';

    h += '<span class="sw-chip">提示 ' + g.hint + '/' + HINT_MAX + '</span></div>';

    /* 题面：中文（不给英文） */
    h += '<div class="sw-info">';
    if (pd.zh && !hid.has('paraphrase_zh')) h += '<span class="sw-zh">' + PK.esc(pd.zh) + '</span>';
    h += '</div>';

    /* hint 4：整词摆出来当参考答案 */
    if (g.hint >= 4) {
      h += '<div class="sw-stage" style="margin:4px 0"><span class="sw-wordbox"><span class="sw-lines"><i></i><i></i><i></i></span>'
        + PK.blocksHtml(word) + '</span></div>';
    }

    /* 空槽 */
    h += '<div class="sw-answer' + (g.status === 'good' ? ' is-good' : (g.status === 'bad' ? ' is-bad' : '')) + '">';
    for (var i = 0; i < g.slots.length; i++) {
      var p = g.slots[i];
      var cls = '';
      if (p >= 0) cls += ' is-filled';
      if (g.status === 'good') cls += ' is-good';
      if (g.status === 'bad') cls += ' is-bad';
      if (g.hint >= 3 && i === cursor) cls += ' is-next';
      h += candySlotHtml(p >= 0 ? g.pool[p].ch : '', { i: i, cls: cls });
    }
    h += '</div>';

    /* 砖池 */
    h += '<div class="sw-pool">';
    g.pool.forEach(function (p, pi) {
      var cls = used[pi] ? 'is-used' : '';
      if (!used[pi] && g.hint >= 3 && cursor >= 0 && p.ch === nextCh) cls += ' is-hintnext';
      h += candyTileHtml(p.ch, { pi: pi, cls: cls });
    });
    h += '</div>';

    /* 角色 + 气泡 */
    var mood = 'happy', msg;
    if (g.status === 'good') { mood = 'happy'; msg = '太棒了！' + word + ' 拼对啦！'; }
    else if (g.status === 'bad') { mood = 'sleep'; msg = '没关系，再来一次。'; }
    else if (g.hint >= 3) { msg = '虚线框的砖就是下一个要点的。'; }
    else if (g.hint >= 2) { msg = '首字母已经帮你放好了。'; }
    else { msg = '看中文，把字母按顺序点出来。点错不扣分！'; }
    h += '<div class="sw-foot"><span class="sw-face">' + PK.animalSvg(PK.pickAnimal(word), mood) + '</span>'
      + '<div class="sw-bubble">' + PK.esc(msg) + '</div></div>';

    /* 按钮 */
    if (g.status === 'good') {
      h += '<div class="sw-acts"><button type="button" class="sw-act is-pri sw-next"><span class="sw-emo">➡️</span>下一题</button></div>';
    } else {
      h += '<div class="sw-acts">';
      h += '<button type="button" class="sw-act" data-action="play"><span class="sw-emo">🔊</span>听</button>';
      h += '<button type="button" class="sw-act" data-action="hint"><span class="sw-emo">💡</span>提示</button>';
      h += '<button type="button" class="sw-act' + (cardData.is_unknown === 1 ? ' is-on' : '') + '" data-action="mark">'
        + '<span class="sw-emo">' + (cardData.is_unknown === 1 ? '⭐' : '☆') + '</span>不熟</button>';
      h += '</div>';
    }

    /* 色板 */
    h += PK.themeBarHtml();
    h += '</div>';
    return h;
  }

  /* -------------------------------------------------------------- 判定 */
  function judge(cardData, api, g) {
    var guess = g.slots.map(function (p) { return p < 0 ? '' : g.pool[p].ch; }).join('');
    if (guess === g.word) {
      g.status = 'good';
      api.track('spell_correct');
      PK.sfx.good();
      api.playAudio(g.word, 'en');
      api.rerender();
      return;
    }
    g.status = 'bad';
    api.track('spell_wrong');
    PK.sfx.bad();
    g.hint = Math.min(HINT_MAX, g.hint + 1);
    try { api.toggleMark(true); } catch (e) {}
    api.rerender();
    g.t1 = setTimeout(function () {
      g.status = 'idle';
      applyHint(g);
      g.busy = false;
      api.rerender();
    }, 780);
  }

  /* -------------------------------------------------------------- 交互 */
  function init(cardEl, cardData, api) {
    var d = (cardData && cardData.data) || {};
    var pd = PK.parseData(d);
    var word = pd.word.toLowerCase();
    var view = PK.viewMode(api);

    PK.applyTheme(cardEl);
    PK.bindThemes(cardEl, api);

    var play = cardEl.querySelector('[data-action="play"]');
    if (play) play.addEventListener('click', function (e) { e.stopPropagation(); api.playAudio(word, 'en'); api.track('audio_play'); });
    var mark = cardEl.querySelector('[data-action="mark"]');
    if (mark) mark.addEventListener('click', function (e) { e.stopPropagation(); api.toggleMark().then(function () { api.rerender(); }); api.track('word_mark'); });
    var hint = cardEl.querySelector('[data-action="hint"]');
    var next = cardEl.querySelector('.sw-next');
    if (next) next.addEventListener('click', function () { PK.next(); });

    if (view !== 'single') return;
    var s = state(cardData, word);
    var g = s.g;
    if (!g) return;

    if (hint) hint.addEventListener('click', function (e) {
      e.stopPropagation();
      if (g.busy || g.status === 'good') return;
      g.hint = Math.min(HINT_MAX, g.hint + 1);
      applyHint(g);
      api.track('hint_used');
      PK.sfx.key('a');
      api.rerender();
    });

    /* 点砖 → 落进最左空槽 */
    var pool = cardEl.querySelector('.sw-pool');
    if (pool) pool.addEventListener('click', function (e) {
      var tile = e.target.closest ? e.target.closest('[data-pi]') : null;
      if (!tile) return;
      if (g.busy || g.status === 'good') return;
      var pi = parseInt(tile.getAttribute('data-pi'), 10);
      if (usedMap(g)[pi]) return;
      var slot = firstEmpty(g);
      if (slot < 0) return;
      g.slots[slot] = pi;
      var ch = g.pool[pi].ch;
      PK.sfx.key(ch);
      api.playAudio(ch, 'en');
      api.track('tile_tap');
      if (firstEmpty(g) < 0) {
        g.busy = true;
        api.rerender();
        setTimeout(function () { g.busy = false; judge(cardData, api, g); }, 170);
      } else {
        api.rerender();
      }
    });

    /* 点槽 → 字母退回池子 */
    var ans = cardEl.querySelector('.sw-answer');
    if (ans) ans.addEventListener('click', function (e) {
      var cell = e.target.closest ? e.target.closest('[data-slot]') : null;
      if (!cell) return;
      if (g.busy || g.status === 'good' || g.status === 'bad') return;
      var i = parseInt(cell.getAttribute('data-slot'), 10);
      if (g.hint >= 2 && i === 0) return;
      if (g.slots[i] >= 0) { g.slots[i] = -1; PK.sfx.key('a'); api.rerender(); }
    });
  }

  window.cardTemplate = {
    name: '字母拼拼乐',
    fields: FIELDS,
    render: render,
    init: init,
    update: function (cardEl, cardData, api) {
      var p = cardEl.parentElement;
      if (p) cardEl.outerHTML = render('', cardData, api);
    }
  };
})();