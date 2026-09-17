/* ==========================================================================
   v2 糖果积木 · 共用运行时
   色板系统 / 数据解析（初中英语格式）/ 糖果积木生成 / 动物角色 / 音效
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

  /* 解析可能为 JSON 字符串 / 数组 / 单值的字段 → 数组 */
  function toArr(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      var t = v.trim();
      if (t.charAt(0) === '[' || t.charAt(0) === '{') {
        try { var p = JSON.parse(t); if (Array.isArray(p)) return p; } catch (e) {}
      }
      return [t];
    }
    return [String(v)];
  }
  /* 取第一个非空释义 */
  function firstDef(v) {
    var a = toArr(v);
    return a.length ? String(a[0]).trim() : '';
  }

  /* -------------------------------------------------------- 色板系统 */
  /* 每套色板：pal 为字母块主色（饱和深色，配白色粗体字母，对比度高） */
  var THEMES = {
    candy:  { name: '糖果', accent: '#e11d63', bg1: '#fff5f8', bg2: '#eef4fb',
              grid: '#c3d0e0', pal: ['#E8446E', '#E8890B', '#1E9E6A', '#2F74D0', '#7C4DE0', '#DC5A2A'] },
    ocean:  { name: '海洋', accent: '#0369a1', bg1: '#eef7fd', bg2: '#e8f6fb',
              grid: '#b8cee0', pal: ['#0E7FBF', '#0891B2', '#0D9488', '#2563EB', '#0284C7', '#1D4ED8'] },
    forest: { name: '森林', accent: '#15803d', bg1: '#f1fbf4', bg2: '#eef7ee',
              grid: '#bcd6bc', pal: ['#16A34A', '#15803D', '#4D7C0F', '#059669', '#0E9F6E', '#3F6212'] },
    sunset: { name: '夕阳', accent: '#c2410c', bg1: '#fff6ef', bg2: '#fdf0e6',
              grid: '#e0c6b0', pal: ['#EA580C', '#DC2626', '#D97706', '#DB2777', '#C2410C', '#B45309'] },
    night:  { name: '星空', accent: '#6d28d9', bg1: '#f2f3ff', bg2: '#eef0fb',
              grid: '#c2c2e0', pal: ['#6366F1', '#8B5CF6', '#7C3AED', '#3B82F6', '#A855F7', '#4F46E5'] },
    berry:  { name: '莓果', accent: '#be185d', bg1: '#fdf2f8', bg2: '#fbeef4',
              grid: '#dcc0cc', pal: ['#DB2777', '#E11D48', '#BE185D', '#C026D3', '#F43F5E', '#9D174D'] }
  };

  var THEME_KEY = 'dc-pk2-theme';
  function themeName() {
    try { return localStorage.getItem(THEME_KEY) || 'candy'; } catch (e) { return 'candy'; }
  }
  function saveTheme(name) {
    try { localStorage.setItem(THEME_KEY, name); } catch (e) {}
  }
  /* 依主题给字母定积木色：同一字母同一主色（元音偏暖、辅音按序取冷），但主色深浅按主题色板微调 */
  function theme() { return THEMES[themeName()] || THEMES.candy; }

  /* 字母积木配色（统一规则，与游戏版一致）：
     元音 → 暖橙(hue 26)；辅音 → 青/蓝/紫(hue 176-244)。
     方块为饱和底 + 白色字母（方案 B），对比度高。 */
  function blockColors(ch) {
    var c = String(ch || 'a').toLowerCase();
    var hue = 'aeiou'.indexOf(c) >= 0 ? 26 : 176 + (c.charCodeAt(0) * 11) % 68;
    return {
      hi: 'hsl(' + hue + ',72%,64%)',
      c1: 'hsl(' + hue + ',68%,52%)',
      c2: 'hsl(' + hue + ',66%,44%)',
      deep: 'hsl(' + hue + ',60%,36%)'
    };
  }

  /* 单个糖果积木字母（用字体而非 SVG 笔画，做厚实糖果感） */
  function blockHtml(ch) {
    var bc = blockColors(ch);
    return '<span class="sw-block" style="--sw-c-hi:' + bc.hi + ';--sw-c1:' + bc.c1
      + ';--sw-c2:' + bc.c2 + ';--sw-c-deep:' + bc.deep + '"><span class="sw-letter">' + esc(ch) + '</span></span>';
  }
  /* 整词：一排糖果积木 */
  function blocksHtml(word) {
    return String(word || '').split('').map(blockHtml).join('');
  }

  /* 把当前主题注入卡片根（--sw-* 系列） */
  function applyTheme(root) {
    var th = theme();
    var style = '--sw-accent:' + th.accent + ';--sw-bg1:' + th.bg1 + ';--sw-bg2:' + th.bg2
      + ';--sw-grid:' + th.grid + ';';
    root.setAttribute('style', (root.getAttribute('style') || '') + style);
  }

  /* 色板切换条 HTML */
  function themeBarHtml() {
    var cur = themeName();
    var h = '<div class="sw-themes">';
    Object.keys(THEMES).forEach(function (k) {
      var th = THEMES[k];
      var active = k === cur ? ' is-active' : '';
      h += '<button type="button" class="sw-theme-btn' + active + '" data-theme="' + k
        + '" title="' + esc(th.name) + '" style="background:' + th.pal[0] + '"></button>';
    });
    h += '</div>';
    return h;
  }
  function bindThemes(root, api) {
    root.querySelectorAll('.sw-theme-btn').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var k = b.getAttribute('data-theme');
        if (THEMES[k]) {
          saveTheme(k);
          api.rerender();
          api.track('pk2_theme');
        }
      });
    });
  }

  /* ------------------------------------------------------ 数据解析（初中英语格式） */
  /* 从卡片数据提取展示字段，兼容 v1 与初中格式 */
  function parseData(d) {
    var out = {
      word: d.word || '',
      phonetic: firstDef(d.phonetic_us != null ? d.phonetic_us : d.phonetic),
      zh: firstDef(d.paraphrase_zh != null ? d.paraphrase_zh : d.zh),
      en: firstDef(d.paraphrase_en != null ? d.paraphrase_en : d.meaning),
      example: null, exampleZh: null,
      coca: d.coca_rank
    };
    // examples 数组
    if (Array.isArray(d.examples) && d.examples.length) {
      var ex = d.examples[0] || {};
      out.example = ex.en || ex.sentence || '';
      out.exampleZh = ex.zh || '';
    } else if (d.sentence) { out.example = d.sentence; out.exampleZh = d.sentenceZh || ''; }
    return out;
  }

  /* ---------------------------------------------------------- 动物角色（简版） */
  var ANIMALS = {
    cat: { zh: '小猫', fur: '#F3BE6B', fur2: '#D89C44', ink: '#3A2A16' },
    dog: { zh: '大狗', fur: '#CB8F5C', fur2: '#A97038', ink: '#3A2A16' },
    capybara: { zh: '水豚', fur: '#C29B6C', fur2: '#9E7A4C', ink: '#3A2A16' },
    sloth: { zh: '树懒', fur: '#C3AE93', fur2: '#A08B70', ink: '#3A2A16' }
  };
  var ANIMAL_KEYS = Object.keys(ANIMALS);
  function animalSvg(kind, mood) {
    var A = ANIMALS[kind] || ANIMALS.cat;
    mood = mood || 'idle';
    var s = ['<svg viewBox="0 0 100 100" aria-hidden="true">'];
    s.push('<ellipse cx="50" cy="55" rx="33" ry="31" fill="' + A.fur + '" stroke="' + A.fur2 + '" stroke-width="3"/>');
    s.push('<ellipse cx="50" cy="70" rx="19" ry="13" fill="#FFF4E6"/>');
    s.push('<ellipse cx="25" cy="64" rx="7" ry="4.6" fill="#F58FA0" opacity=".42"/>');
    s.push('<ellipse cx="75" cy="64" rx="7" ry="4.6" fill="#F58FA0" opacity=".42"/>');
    if (mood === 'sleep') {
      s.push('<path d="M30 50 Q37 58 44 50" fill="none" stroke="' + A.ink + '" stroke-width="3.4" stroke-linecap="round"/>');
      s.push('<path d="M56 50 Q63 58 70 50" fill="none" stroke="' + A.ink + '" stroke-width="3.4" stroke-linecap="round"/>');
    } else if (mood === 'happy') {
      s.push('<path d="M30 54 Q37 44 44 54" fill="none" stroke="' + A.ink + '" stroke-width="3.6" stroke-linecap="round"/>');
      s.push('<path d="M56 54 Q63 44 70 54" fill="none" stroke="' + A.ink + '" stroke-width="3.6" stroke-linecap="round"/>');
    } else {
      s.push('<ellipse cx="37" cy="50" rx="4.6" ry="5.6" fill="' + A.ink + '"/>');
      s.push('<ellipse cx="63" cy="50" rx="4.6" ry="5.6" fill="' + A.ink + '"/>');
    }
    s.push('<path d="M45 61 Q50 58 55 61 Q50 66 45 61 Z" fill="' + A.fur2 + '"/>');
    s.push('</svg>');
    return s.join('');
  }
  function pickAnimal(word) {
    var n = 0;
    String(word || '').split('').forEach(function (c) { n += c.charCodeAt(0); });
    return ANIMAL_KEYS[n % ANIMAL_KEYS.length];
  }

  /* --------------------------------------------------------- 音效（简版） */
  var sfx = (function () {
    var ctx = null;
    function ac() {
      if (ctx) return ctx;
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { ctx = null; }
      return ctx;
    }
    function tone(freq, dur, type, vol, delay) {
      var c = ac(); if (!c) return;
      if (c.state === 'suspended' && c.resume) { try { c.resume(); } catch (e) {} }
      var t0 = c.currentTime + (delay || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(vol || 0.12, 0.001), t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, 0.05));
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.04);
    }
    var STEP = [0, 2, 4, 5, 7, 9, 11];
    function freqOf(ch) {
      var i = String(ch || 'a').toLowerCase().charCodeAt(0) - 97;
      if (!(i >= 0 && i < 26)) i = 0;
      return 261.63 * Math.pow(2, (STEP[i % 7] + Math.floor(i / 7) * 12) / 12);
    }
    return {
      key: function (ch) { tone(freqOf(ch), 0.28, 'triangle', 0.10); },
      good: function () { tone(783.99, 0.13, 'sine', 0.12); tone(1046.5, 0.26, 'sine', 0.10, 0.1); },
      bad: function () { tone(207.65, 0.18, 'triangle', 0.10); tone(164.81, 0.24, 'triangle', 0.08, 0.09); }
    };
  })();

  /* ------------------------------------------------------- 暴露给模板 */
  window.PK = {
    esc: esc,
    THEMES: THEMES,
    themeName: themeName,
    theme: theme,
    applyTheme: applyTheme,
    themeBarHtml: themeBarHtml,
    bindThemes: bindThemes,
    blockColors: blockColors,
    blocksHtml: blocksHtml,
    parseData: parseData,
    animalSvg: animalSvg,
    pickAnimal: pickAnimal,
    sfx: sfx,
    /* 视图/翻页 */
    viewMode: function (api) {
      try { return api.getViewMode ? api.getViewMode() : 'single'; } catch (e) { return 'single'; }
    },
    next: function () {
      try { if (typeof window.singleCardNav === 'function') { window.singleCardNav(1); return true; } } catch (e) {}
      return false;
    },
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
})();