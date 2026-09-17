/* ==========================================================================
   小学英语 · 共用运行时（几何字形 / 字母砖 / 动物角色 / 音效 / 图鉴）
   三套模板（单词卡、字母砖、点亮记忆）都内置这一份。
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------- 小工具 */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* --------------------------------------------------- 字母砖的配色规则 */
  /* 元音暖色 / 辅音冷色；同一个字母永远是同一个颜色（帮孩子建立"颜色—字母"记忆） */
  var VOWEL = { a: 1, e: 1, i: 1, o: 1, u: 1 };
  var WARM = { a: ['#FFC078', '#E39A4E'], e: ['#FFE066', '#DFBF45'], i: ['#FFB3BA', '#E38E97'],
               o: ['#FFAE72', '#E08C4E'], u: ['#FFD48A', '#E0B463'] };
  function colorOf(ch) {
    ch = String(ch || 'a').toLowerCase();
    if (WARM[ch]) return WARM[ch];
    if (VOWEL[ch]) return WARM[ch] || WARM.a;
    var i = ch.charCodeAt(0) - 97;
    var hue = 152 + ((i * 29) % 118);          /* 152→270：青绿 / 蓝 / 紫，全冷色 */
    return ['hsl(' + hue + ',62%,74%)', 'hsl(' + hue + ',52%,59%)'];
  }

  /* ------------------------------------------------------------ 几何字形 */
  function glyphBox(ch) {
    var g = window.PK_GLYPHS[ch];
    if (!g) return null;
    /* 左 0.08 / 右 0.08 的边距，倾斜溢出部分靠 svg overflow:visible 兜住 */
    return { w: g.w + 0.16, vb: '-0.08 -0.2 ' + (g.w + 0.16).toFixed(3) + ' 3.4', d: g.d };
  }
  /* 砖 / 槽的宽度：字形是绝对定位的，盒子宽度必须自己算（否则会塌成 0）。
     统一宽度（不随字母胖瘦变）—— 砖池看起来才像一副成套的字母块，
     而且四线格能比最宽的 w（1.36U）每侧还多出约 0.28U 的余量，字母不会压到格线外。 */
  var CELL_TW = 2.55;
  function cellTw(ch) { return CELL_TW; }
  function glyphSvg(ch) {
    var b = glyphBox(ch);
    if (!b) return '<span class="pk-rawltr">' + esc(ch) + '</span>';
    return '<span class="pk-glyph"><svg viewBox="' + b.vb + '" preserveAspectRatio="xMidYMid meet">'
      + '<g transform="translate(0,2) scale(1,-1) skewX(6)"><path d="' + b.d + '"/></g></svg></span>';
  }
  function wordWidth(word) {
    var m = 0.6;
    String(word || '').split('').forEach(function (c) {
      var g = window.PK_GLYPHS[c];
      if (g && g.w > m) m = g.w;
    });
    return clamp(m, 0.8, 1.4);
  }
  /* 整词：每个字形自带左右边距，自然字距；共基线 */
  function wordHtml(word, cls) {
    return '<span class="pk-word ' + (cls || '') + '">'
      + String(word || '').split('').map(glyphSvg).join('') + '</span>';
  }
  /* 整词 · 3D 立体版：每个字母一块"厚积木"——深色挤出层垫在右下，顶面字母色。
     元音暖 / 辅音冷（与字母砖同一套配色规则），帮孩子把颜色和字母对上号。
     注意：字形是单线描边路径（fill 会变色块），立体感只能靠两层 stroke 挤出来画。 */
  function word3dHtml(word) {
    return '<span class="pk-word pk-word3d">'
      + String(word || '').split('').map(function (ch) {
        var b = glyphBox(ch);
        if (!b) return '<span class="pk-rawltr">' + esc(ch) + '</span>';
        var c = colorOf(ch);
        return '<span class="pk-g3d" style="--pk-c1:' + c[0] + ';--pk-c2:' + c[1] + '">'
          + '<span class="pk-glyph"><svg viewBox="' + b.vb + '" preserveAspectRatio="xMidYMid meet">'
          /* 挤出层：往右下偏 0.12U 的深色描边 */
          + '<g transform="translate(0.12,2.12) scale(1,-1) skewX(6)"><path d="' + b.d
          + '" style="fill:none;stroke:rgba(30,32,44,.34);stroke-width:.20"/></g>'
          /* 顶面：字母本色描边 */
          + '<g transform="translate(0,2) scale(1,-1) skewX(6)"><path d="' + b.d
          + '" style="fill:none;stroke:' + c[1] + ';stroke-width:.17"/></g>'
          + '</svg></span></span>';
      }).join('') + '</span>';
  }
  /* 砖 / 槽：字形在格子里居中 */
  function tileHtml(ch, opts) {
    opts = opts || {};
    var c = colorOf(ch);
    var cls = 'pk-cell pk-tile' + (opts.cls ? ' ' + opts.cls : '');
    var attrs = ' data-ch="' + esc(ch) + '"';
    if (opts.data) { for (var k in opts.data) { if (opts.data.hasOwnProperty(k)) attrs += ' data-' + k + '="' + esc(opts.data[k]) + '"'; } }
    return '<button type="button" class="' + cls + '"' + attrs
      + ' style="--pk-c1:' + c[0] + ';--pk-c2:' + c[1] + ';--pk-tw:' + cellTw(ch) + '"'
      + (opts.disabled ? ' disabled' : '') + '>'
      + '<span class="pk-lines"><i></i><i></i><i></i></span>'
      + glyphSvg(ch) + '</button>';
  }
  function slotHtml(ch, opts) {
    opts = opts || {};
    var cls = 'pk-cell pk-slot' + (opts.cls ? ' ' + opts.cls : '');
    return '<span class="' + cls + '" data-slot="' + esc(opts.i == null ? '' : opts.i) + '"'
      + ' style="--pk-tw:' + cellTw(ch || 'o') + '">'
      + '<span class="pk-lines"><i></i><i></i><i></i></span>'
      + (ch ? glyphSvg(ch) : '') + '</span>';
  }

  /* ------------------------------------------------------------ 动物角色 */
  var ANIMALS = {
    cat:      { name: 'cat',      zh: '小猫', trait: '软软的，会安慰你',
                kind: 'tri',   fur: '#F3BE6B', fur2: '#D89C44', ear: '#F9D6AC', muzzle: '#FFF4E6', ink: '#3A2A16' },
    dog:      { name: 'dog',      zh: '大狗', trait: '嗓门大，替你欢呼',
                kind: 'flop',  fur: '#CB8F5C', fur2: '#A97038', ear: '#B87C48', muzzle: '#FFEEDA', ink: '#3A2A16' },
    capybara: { name: 'capybara', zh: '水豚', trait: '慢慢来，不着急',
                kind: 'small', fur: '#C29B6C', fur2: '#9E7A4C', ear: '#A8834F', muzzle: '#EBD7B8', ink: '#3A2A16' },
    opossum:  { name: 'opossum',  zh: '负鼠', trait: '摔倒了先装死，再爬起来',
                kind: 'round', fur: '#BFC2C9', fur2: '#9BA0A9', ear: '#E7BCBF', muzzle: '#F6F6F3', ink: '#33353B' },
    monkey:   { name: 'monkey',   zh: '小猴', trait: '好奇，连对时最嗨',
                kind: 'big',   fur: '#C68B4E', fur2: '#A46E38', ear: '#EAC69E', muzzle: '#F7E3CA', ink: '#3A2A16' },
    sloth:    { name: 'sloth',    zh: '树懒', trait: '慢一点，但从不放弃',
                kind: 'flat',  fur: '#C3AE93', fur2: '#A08B70', ear: '#B29C80', muzzle: '#F1E5D3', ink: '#3A2A16' }
  };
  function animalSvg(kind, mood) {
    var A = ANIMALS[kind] || ANIMALS.cat;
    mood = mood || 'idle';
    var s = ['<svg viewBox="0 0 100 100" aria-hidden="true">'];
    /* 耳（先画，被头压住根部） */
    if (A.kind === 'tri') {
      s.push('<path d="M21 38 L26 6 L49 27 Z" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="3" stroke-linejoin="round"/>');
      s.push('<path d="M79 38 L74 6 L51 27 Z" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="3" stroke-linejoin="round"/>');
      s.push('<path d="M28 33 L30 16 L41 27 Z" fill="' + A.ear + '"/>');
      s.push('<path d="M72 33 L70 16 L59 27 Z" fill="' + A.ear + '"/>');
    } else if (A.kind === 'flop') {
      s.push('<ellipse cx="16" cy="57" rx="11" ry="20" fill="' + A.ear + '" stroke="' + A.fur2 + '" stroke-width="3" transform="rotate(-14 16 57)"/>');
      s.push('<ellipse cx="84" cy="57" rx="11" ry="20" fill="' + A.ear + '" stroke="' + A.fur2 + '" stroke-width="3" transform="rotate(14 84 57)"/>');
    } else if (A.kind === 'small') {
      s.push('<circle cx="27" cy="33" r="8" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="2.6"/>');
      s.push('<circle cx="73" cy="33" r="8" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="2.6"/>');
    } else if (A.kind === 'round') {
      s.push('<circle cx="22" cy="39" r="14" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="3"/>');
      s.push('<circle cx="78" cy="39" r="14" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="3"/>');
      s.push('<circle cx="22" cy="39" r="7" fill="' + A.ear + '"/>');
      s.push('<circle cx="78" cy="39" r="7" fill="' + A.ear + '"/>');
    } else if (A.kind === 'big') {
      s.push('<circle cx="17" cy="53" r="14" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="3"/>');
      s.push('<circle cx="83" cy="53" r="14" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="3"/>');
      s.push('<circle cx="17" cy="53" r="7" fill="' + A.ear + '"/>');
      s.push('<circle cx="83" cy="53" r="7" fill="' + A.ear + '"/>');
    } else {
      s.push('<circle cx="25" cy="35" r="11" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="2.8"/>');
      s.push('<circle cx="75" cy="35" r="11" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="2.8"/>');
    }
    /* 头 */
    s.push('<ellipse cx="50" cy="55" rx="33" ry="31" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="3"/>');
    /* 口鼻 */
    s.push('<ellipse cx="50" cy="70" rx="19" ry="13" fill="' + A.muzzle + '"/>');
    /* 腮红 */
    s.push('<ellipse cx="25" cy="64" rx="7" ry="4.6" fill="#F58FA0" opacity=".42"/>');
    s.push('<ellipse cx="75" cy="64" rx="7" ry="4.6" fill="#F58FA0" opacity=".42"/>');
    /* 眼 */
    if (mood === 'sleep') {
      s.push('<path d="M30 50 Q37 58 44 50" fill="none" stroke="' + A.ink + '" stroke-width="3.4" stroke-linecap="round"/>');
      s.push('<path d="M56 50 Q63 58 70 50" fill="none" stroke="' + A.ink + '" stroke-width="3.4" stroke-linecap="round"/>');
    } else if (mood === 'happy' || mood === 'cheer') {
      s.push('<path d="M30 54 Q37 44 44 54" fill="none" stroke="' + A.ink + '" stroke-width="3.6" stroke-linecap="round"/>');
      s.push('<path d="M56 54 Q63 44 70 54" fill="none" stroke="' + A.ink + '" stroke-width="3.6" stroke-linecap="round"/>');
    } else if (mood === 'wow') {
      s.push('<circle cx="37" cy="50" r="6.6" fill="' + A.ink + '"/>');
      s.push('<circle cx="63" cy="50" r="6.6" fill="' + A.ink + '"/>');
      s.push('<circle cx="39.2" cy="47.8" r="2.2" fill="#fff"/>');
      s.push('<circle cx="65.2" cy="47.8" r="2.2" fill="#fff"/>');
    } else {
      s.push('<ellipse cx="37" cy="50" rx="4.6" ry="5.6" fill="' + A.ink + '"/>');
      s.push('<ellipse cx="63" cy="50" rx="4.6" ry="5.6" fill="' + A.ink + '"/>');
      s.push('<circle cx="38.8" cy="47.9" r="1.7" fill="#fff"/>');
      s.push('<circle cx="64.8" cy="47.9" r="1.7" fill="#fff"/>');
    }
    /* 鼻 + 嘴 */
    s.push('<path d="M45 61 Q50 58 55 61 Q50 66 45 61 Z" fill="' + A.fur2 + '"/>');
    if (mood === 'cheer') {
      s.push('<path d="M39 70 Q50 82 61 70 Q50 74 39 70 Z" fill="#C4564F"/>');
    } else if (mood === 'sleep') {
      s.push('<ellipse cx="50" cy="72" rx="4.6" ry="4" fill="' + A.ink + '" opacity=".5"/>');
    } else {
      s.push('<path d="M50 65 Q45 72 41 67 M50 65 Q55 72 59 67" fill="none" stroke="' + A.fur2
        + '" stroke-width="2.6" stroke-linecap="round"/>');
    }
    s.push('</svg>');
    return s.join('');
  }

  /* ------------------------------------------------------- 音效（Web Audio）*/
  /* 零音频文件、不占 TTS 通道；也完全不联网。每个字母有自己的音高。 */
  var sfx = (function () {
    var ctx = null, muted = false;
    function ac() {
      if (ctx) return ctx;
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { ctx = null; }
      return ctx;
    }
    function tone(freq, dur, type, vol, delay) {
      if (muted) return;
      var c = ac();
      if (!c) return;
      if (c.state === 'suspended' && c.resume) { try { c.resume(); } catch (e) { } }
      var t0 = c.currentTime + (delay || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(vol || 0.16, 0.001), t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, 0.05));
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.04);
    }
    /* a–z 映到「C 大调自然音阶」两个八度：每个字母一个音高 */
    var STEP = [0, 2, 4, 5, 7, 9, 11];
    function freqOf(ch) {
      var i = String(ch || 'a').toLowerCase().charCodeAt(0) - 97;
      if (!(i >= 0 && i < 26)) i = 0;
      return 261.63 * Math.pow(2, (STEP[i % 7] + Math.floor(i / 7) * 12) / 12);
    }
    return {
      setMuted: function (v) { muted = !!v; },
      isMuted: function () { return muted; },
      unlock: function () {
        var c = ac();
        if (c && c.state === 'suspended' && c.resume) { try { c.resume(); } catch (e) { } }
      },
      /* 字母砖的音（比人声低一档，避免和朗读抢） */
      key: function (ch) { tone(freqOf(ch), 0.28, 'triangle', 0.11); },
      /* 灯的音（高八度，像"叮"） */
      light: function (ch, delay) { tone(freqOf(ch) * 2, 0.34, 'sine', 0.085, delay || 0); },
      good: function () { tone(783.99, 0.13, 'sine', 0.14); tone(1046.5, 0.26, 'sine', 0.12, 0.1); },
      bad: function () { tone(207.65, 0.18, 'triangle', 0.12); tone(164.81, 0.24, 'triangle', 0.1, 0.09); },
      star: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.22, 'sine', 0.12, i * 0.075); }); }
    };
  })();

  /* ----------------------------------------------------------- 进度与图鉴 */
  var progress = (function () {
    var KEY = 'dc-pk-progress-v1';
    var LIST = ['cat', 'dog', 'capybara', 'opossum', 'monkey', 'sloth'];
    var NEED = { cat: 0, dog: 5, capybara: 12, opossum: 22, monkey: 35, sloth: 50 };
    function blank() { return { correct: 0, wrong: 0, streak: 0, best: 0, gallery: ['cat'], sound: true, autoNext: true }; }
    function load() {
      var o;
      try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { o = {}; }
      var d = blank();
      o.correct = o.correct || 0; o.wrong = o.wrong || 0;
      o.streak = o.streak || 0; o.best = o.best || 0;
      o.gallery = (o.gallery && o.gallery.length) ? o.gallery : d.gallery;
      if (o.sound === undefined) o.sound = true;
      if (o.autoNext === undefined) o.autoNext = true;
      return o;
    }
    function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { } }
    return {
      list: LIST, need: NEED, load: load, save: save,
      setSound: function (v) { var o = load(); o.sound = !!v; save(o); },
      isSound: function () { return load().sound !== false; },
      isAuto: function () { return load().autoNext !== false; },
      setAuto: function (v) { var o = load(); o.autoNext = !!v; save(o); },
      addCorrect: function () {
        var o = load(), newly = null;
        o.correct += 1; o.streak += 1;
        if (o.streak > o.best) o.best = o.streak;
        LIST.forEach(function (k) {
          if (NEED[k] <= o.correct && o.gallery.indexOf(k) < 0) { o.gallery.push(k); newly = k; }
        });
        save(o);
        return { st: o, newly: newly };
      },
      addWrong: function () {
        var o = load(); o.wrong += 1; o.streak = 0; save(o); return o;
      }
    };
  })();

  function galleryHtml() {
    var st = progress.load();
    var h = '<div class="pk-gallery"><div class="pk-gal-list">';
    progress.list.forEach(function (k) {
      var un = st.gallery.indexOf(k) >= 0;
      h += '<button type="button" class="pk-gal-item' + (un ? '' : ' is-locked') + '" data-animal="' + k + '"'
        + ' title="' + esc(un ? ANIMALS[k].name + ' · ' + ANIMALS[k].trait : '还没收集到') + '">'
        + (un ? animalSvg(k, 'idle') : '<span class="pk-gal-q">?</span>') + '</button>';
    });
    h += '</div><div class="pk-gal-name">图鉴 <b>' + st.gallery.length + '</b>/' + progress.list.length
      + '　连对 <b>' + st.streak + '</b></div></div>';
    return h;
  }

  /* 收集解锁的庆祝层（挂在卡内，不挂 body —— 避免作用域与层级问题） */
  function veilHtml(kind, title) {
    var A = ANIMALS[kind] || ANIMALS.cat;
    return '<div class="pk-veil" data-veil="1">'
      + '<div class="pk-face">' + animalSvg(kind, 'cheer') + '</div>'
      + '<div class="pk-name">' + esc(A.name) + '</div>'
      + '<div class="pk-trait">' + esc(A.trait) + '</div>'
      + (title ? '<div class="pk-sub">' + esc(title) + '</div>' : '')
      + '<div class="pk-sub">点一下继续</div></div>';
  }

  /* 绑定：点已收集的动物 → 弹出它的英文名与性格；未收集的点了不响应（title 里写了条件） */
  function bindGallery(root, api) {
    root.querySelectorAll('.pk-gal-item').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.classList.contains('is-locked')) return;
        var host = root.querySelector('[data-veil-host]');
        if (!host) return;
        var k = b.getAttribute('data-animal');
        host.innerHTML = veilHtml(k, ANIMALS[k].zh);
        api.track('pk_gallery_view');
      });
    });
  }

  function closeVeil(root) {
    var host = root.querySelector('[data-veil-host]');
    if (host) host.innerHTML = '';
  }

  /* -------------------------------------------------------- 交给模板用的口 */
  window.PK = {
    esc: esc,
    colorOf: colorOf,
    glyphSvg: glyphSvg,
    wordHtml: wordHtml,
    word3dHtml: word3dHtml,
    wordWidth: wordWidth,
    tileHtml: tileHtml,
    slotHtml: slotHtml,
    assertGlyphs: function () { return !!(window.PK_GLYPHS && window.PK_GLYPHS.a); },
    animals: ANIMALS,
    animalSvg: animalSvg,
    sfx: sfx,
    progress: progress,
    galleryHtml: galleryHtml,
    veilHtml: veilHtml,
    closeVeil: closeVeil,
    bindGallery: bindGallery,
    /* 视图/翻页：单卡模式才玩得动游戏；自动下一题属"非公开 API"，必须 try/catch */
    viewMode: function (api) {
      try { return api.getViewMode ? api.getViewMode() : 'single'; } catch (e) { return 'single'; }
    },
    next: function () {
      try {
        if (typeof window.singleCardNav === 'function') { window.singleCardNav(1); return true; }
      } catch (e) { }
      return false;
    },
    /* 隐藏字段：应用返回的是普通对象（不是 Set），两种都要兼容 */
    hiddenSet: function (api) {
      var h = {};
      try { h = (api.getHiddenFields && api.getHiddenFields()) || {}; } catch (e) { h = {}; }
      return {
        has: function (k) {
          if (h && typeof h.has === 'function') return h.has(k);
          if (h && typeof h.indexOf === 'function') return h.indexOf(k) >= 0;
          return !!(h && h[k]);
        }
      };
    }
  };

  /* 音效静音状态跟着进度走 */
  window.PK.sfx.setMuted(!window.PK.progress.isSound());
})();
