/* ================= 模板二：字母砖拼装（拼写） ================= */
(function () {
  'use strict';

  var FIELDS = [
    { key: 'word', label: '单词', hideable: false },
    { key: 'zh', label: '中文' },
    { key: 'phonetic', label: '音标' },
    { key: 'sentence', label: '例句' },
    { key: 'sentenceZh', label: '例句翻译' },
    { key: 'syllable', label: '音节' },
    { key: 'unit', label: '单元' },
    { key: 'tip', label: '易错提示' }
  ];
  var HINT_MAX = 4;

  /* ---------------------------------------------------------- 游戏状态 */
  function newGame(word) {
    var letters = String(word || '').toLowerCase().split('');
    return {
      word: String(word || '').toLowerCase(),
      letters: letters,
      pool: shuffle(letters),
      slots: letters.map(function () { return -1; }),
      status: 'idle', hint: 0, busy: false, t1: 0, t2: 0
    };
  }
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
  function state(cardData, word) {
    if (!cardData._pk) cardData._pk = {};
    var s = cardData._pk;
    if (!s.g || s.g.word !== String(word || '').toLowerCase()) s.g = newGame(word);
    if (s.pendingVeil === undefined) s.pendingVeil = null;
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
  /* 提示阶梯：≥2 时首字母已经落在第一个槽里（锁定） */
  function applyHint(g) {
    clearSlots(g);
    if (g.hint >= 2 && g.letters.length) {
      for (var i = 0; i < g.pool.length; i++) {
        if (g.pool[i].ch === g.letters[0]) { g.slots[0] = i; break; }
      }
    }
  }
  function syllablesOf(word, syl) {
    if (!syl) return null;
    var parts = String(syl).split('-');
    if (parts.join('').toLowerCase() !== String(word).toLowerCase()) return null;
    var out = [], k = 0;
    parts.forEach(function (p) { out.push({ from: k, to: k + p.length }); k += p.length; });
    return out.length > 1 ? out : null;
  }
  function live(cardData) {
    try { return document.querySelector('[data-card-id="' + cardData.id + '"]'); } catch (e) { return null; }
  }

  /* -------------------------------------------------------------- 渲染 */
  function render(cardHtml, cardData, api) {
    var d = (cardData && cardData.data) || {};
    var word = String(d.word || '').toLowerCase();
    var hid = PK.hiddenSet(api);
    var order = cardData.current_order == null ? '' : String(cardData.current_order);
    if (order.length < 2) order = '0' + order;
    var view = PK.viewMode(api);

    var h = '<div class="pk-card pk-bl" data-card-id="' + cardData.id + '">';
    h += '<div class="pk-head"><span class="pk-badge">' + PK.esc(order) + '</span>';
    if (d.unit && !hid.has('unit')) h += '<span class="pk-chip">' + PK.esc(d.unit) + '</span>';
    h += '<span class="pk-spacer"></span>';

    /* 列表模式降级：不跑游戏（一页 100 张卡，一屏 100 个游戏实例） */
    if (view !== 'single') {
      h += '<span class="pk-chip">浏览模式</span></div>';
      h += promptHtml(d, hid, false);
      h += '<div class="pk-teaser">🕹 左上角切到「单卡模式」就能开始拼这一题。</div>';
      h += actsHtml(cardData, false);
      h += PK.galleryHtml() + '<div data-veil-host></div></div>';
      return h;
    }

    var s = state(cardData, word);
    var g = s.g;
    var cursor = firstEmpty(g);
    var used = usedMap(g);
    var groups = (g.hint >= 1) ? syllablesOf(word, d.syllable) : null;
    var nextCh = cursor >= 0 ? g.letters[cursor] : '';

    h += '<span class="pk-chip pk-lv">提示 ' + g.hint + '/' + HINT_MAX + '</span></div>';

    /* 题面：只给中文 + 图，不给英文 */
    h += promptHtml(d, hid, false);

    /* hint 4：直接把整词摆出来当参考答案 */
    if (g.hint >= 4) {
      h += '<div class="pk-reveal-word"><span class="pk-wordbox"><span class="pk-lines"><i></i><i></i><i></i></span>'
        + PK.wordHtml(word) + '</span></div>';
    }

    /* 空槽：四线三格 */
    h += '<div class="pk-answer' + (g.status === 'good' ? ' is-good' : (g.status === 'bad' ? ' is-bad' : '')) + '">';
    for (var i = 0; i < g.slots.length; i++) {
      if (groups) {
        for (var gi = 1; gi < groups.length; gi++) {
          if (groups[gi].from === i) h += '<span class="pk-gap"></span>';
        }
      }
      var p = g.slots[i];
      var cls = '';
      if (p >= 0) cls += ' is-filled';
      if (g.status === 'good') cls += ' is-good';
      if (g.status === 'bad') cls += ' is-bad';
      if (g.hint >= 3 && i === cursor) cls += ' is-next';
      h += PK.slotHtml(p >= 0 ? g.pool[p].ch : '', { i: i, cls: cls });
    }
    h += '</div>';

    /* 砖池 */
    h += '<div class="pk-pool' + (groups ? ' is-grouped' : '') + '">';
    g.pool.forEach(function (p, pi) {
      var cls = used[pi] ? 'is-used' : '';
      if (!used[pi] && g.hint >= 3 && cursor >= 0 && p.ch === nextCh) cls += ' is-hintnext';
      h += PK.tileHtml(p.ch, { cls: cls, data: { pi: pi } });
    });
    h += '</div>';

    /* 角色 + 气泡 */
    var mood = 'idle', msg;
    if (g.status === 'good') {
      mood = 'cheer'; msg = '太棒了！' + word + ' —— 一个字母都没错！';
    } else if (g.status === 'bad') {
      mood = 'sleep'; msg = '没关系，再来一次。（小猫已经把你的错词记下来了）';
    } else if (g.hint >= 4) {
      mood = 'happy'; msg = '看着上面的单词，一个一个点下来就好。';
    } else if (g.hint >= 1) {
      mood = 'happy'; msg = '给你加了一点提示：' + hintText(g, d);
    } else {
      msg = '看图看中文，把字母按顺序点出来。点错了不会扣分，大胆试！';
    }
    h += '<div class="pk-foot"><span class="pk-face">' + PK.animalSvg(g.status === 'good' ? 'dog' : 'cat', mood)
      + '</span><div class="pk-bubble' + (g.status === 'good' ? ' is-good' : (g.status === 'bad' ? ' is-bad' : ''))
      + '">' + PK.esc(msg) + '</div></div>';

    /* 按钮 */
    if (g.status === 'good') {
      h += '<div class="pk-acts"><button type="button" class="pk-act is-pri pk-next">'
        + '<span class="pk-emo">➡️</span>下一题</button></div>';
      h += '<div class="pk-toggles">'
        + '<button type="button" class="pk-mini pk-auto">自动下一题：' + (PK.progress.isAuto() ? '开' : '关') + '</button>'
        + '<button type="button" class="pk-mini pk-mute">音效：' + (PK.progress.isSound() ? '开' : '关') + '</button>'
        + '</div>';
    } else {
      h += actsHtml(cardData, true);
    }

    h += PK.galleryHtml();
    h += '<div data-veil-host>' + (s.pendingVeil ? PK.veilHtml(s.pendingVeil,
      '图鉴 ' + PK.progress.load().gallery.length + '/' + PK.progress.list.length) : '') + '</div>';
    h += '</div>';
    return h;
  }

  function hintText(g, d) {
    if (g.hint >= 4) return '单词已经摆出来了。';
    if (g.hint >= 3) return '虚线框着的砖就是下一个要点的。';
    if (g.hint >= 2) return '首字母已经帮你放好了。';
    if (g.hint >= 1 && d.syllable) return '按音节分组了：' + String(d.syllable).split('-').join(' · ');
    return '想一想第一个字母是什么。';
  }

  function promptHtml(d, hid, showWord) {
    var h = '<div class="pk-prompt">';
    if (d.zh) h += '<span class="pk-zh">' + PK.esc(d.zh) + '</span>';
    if (showWord) h += '<span class="pk-zh">' + PK.esc(d.word) + '</span>';
    h += '</div>';
    return h;
  }

  function actsHtml(cardData, withHint) {
    var unknown = cardData.is_unknown === 1, fav = cardData.is_favorite === 1;
    var h = '<div class="pk-acts">';
    h += '<button type="button" class="pk-act pk-audio"><span class="pk-emo">🔊</span>听</button>';
    if (withHint) {
      h += '<button type="button" class="pk-act pk-hint" data-action="hint"><span class="pk-emo">💡</span>提示</button>';
    }
    h += '<button type="button" class="pk-act pk-mark' + (unknown ? ' is-on' : '') + '" data-action="mark">'
      + '<span class="pk-emo">' + (unknown ? '⭐' : '☆') + '</span>不熟</button>';
    h += '<button type="button" class="pk-act pk-fav' + (fav ? ' is-on' : '') + '" data-action="favorite">'
      + '<span class="pk-emo">🔖</span>收藏</button>';
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
      var r = PK.progress.addCorrect();
      if (r.newly) {
        cardData._pk.pendingVeil = r.newly;
        PK.sfx.star();
        api.rerender();
      } else {
        api.rerender();
        if (PK.progress.isAuto()) {
          g.t2 = setTimeout(function () { PK.next(); }, 2400);
        }
      }
      return;
    }
    /* 拼错：抖一下、退回砖、升级提示、标记不熟（不扣分、不换题） */
    g.status = 'bad';
    api.track('spell_wrong');
    PK.sfx.bad();
    PK.progress.addWrong();
    g.hint = Math.min(HINT_MAX, g.hint + 1);
    try { api.toggleMark(true); } catch (e) { }
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
    var word = String(d.word || '').toLowerCase();
    var view = PK.viewMode(api);
    var s = state(cardData, word);

    /* 通用：点卡片空白处朗读 */
    cardEl.addEventListener('click', function (e) {
      var t = e.target;
      if (!t.closest) return;
      if (t.closest('[data-veil="1"]')) { s.pendingVeil = null; api.rerender(); return; }
      if (t.closest('button')) return;
    });

    /* 遮罩里的动物图鉴 */
    PK.bindGallery(cardEl, api);

    var audio = cardEl.querySelector('.pk-audio');
    if (audio) audio.addEventListener('click', function () {
      api.playAudio(word, 'en');
      api.track('audio_play');
    });
    var mark = cardEl.querySelector('[data-action="mark"]');
    if (mark) mark.addEventListener('click', function () {
      api.toggleMark().then(function () { api.rerender(); });
      api.track('word_mark');
    });
    var fav = cardEl.querySelector('[data-action="favorite"]');
    if (fav) fav.addEventListener('click', function () {
      api.toggleFavorite().then(function () { api.rerender(); });
      api.track('favorite_toggle');
    });
    var hint = cardEl.querySelector('[data-action="hint"]');
    if (hint) hint.addEventListener('click', function () {
      var g = s.g;
      if (g.busy || g.status === 'good') return;
      g.hint = Math.min(HINT_MAX, g.hint + 1);
      applyHint(g);
      api.track('hint_used');
      PK.sfx.key('a');
      api.rerender();
    });
    var next = cardEl.querySelector('.pk-next');
    if (next) next.addEventListener('click', function () { PK.next(); });
    var auto = cardEl.querySelector('.pk-auto');
    if (auto) auto.addEventListener('click', function () {
      PK.progress.setAuto(!PK.progress.isAuto()); api.rerender();
    });
    var mute = cardEl.querySelector('.pk-mute');
    if (mute) mute.addEventListener('click', function () {
      var on = !PK.progress.isSound();
      PK.progress.setSound(on); PK.sfx.setMuted(!on); api.rerender();
    });

    if (view !== 'single') return;
    var g = s.g;
    if (!g) return;

    /* 点砖 → 落进最左边的空槽 */
    var pool = cardEl.querySelector('.pk-pool');
    if (pool) pool.addEventListener('click', function (e) {
      var tile = e.target.closest ? e.target.closest('[data-pi]') : null;
      if (!tile) return;
      if (g.busy || g.status === 'good') return;
      var pi = parseInt(tile.getAttribute('data-pi'), 10);
      if (usedMap(g)[pi]) return;
      var slot = firstEmpty(g);
      if (slot < 0) return;
      PK.sfx.unlock();
      g.slots[slot] = pi;
      var ch = g.pool[pi].ch;
      PK.sfx.key(ch);
      api.playAudio(ch, 'en');            /* 点砖读"字母名"：C-A-T = see-ay-tee */
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
    var ans = cardEl.querySelector('.pk-answer');
    if (ans) ans.addEventListener('click', function (e) {
      var cell = e.target.closest ? e.target.closest('[data-slot]') : null;
      if (!cell) return;
      if (g.busy || g.status === 'good' || g.status === 'bad') return;
      var i = parseInt(cell.getAttribute('data-slot'), 10);
      if (g.hint >= 2 && i === 0) return;       /* 首字母锁定 */
      if (g.slots[i] >= 0) { g.slots[i] = -1; PK.sfx.key('a'); api.rerender(); }
    });
  }

  window.cardTemplate = {
    name: '字母砖拼拼乐',
    fields: FIELDS,
    render: render,
    init: init,
    update: function (cardEl, cardData, api) {
      var p = cardEl.parentElement;
      if (p) cardEl.outerHTML = render('', cardData, api);
    }
  };
})();
