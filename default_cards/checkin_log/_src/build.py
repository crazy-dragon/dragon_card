#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""构建 checkin_log 卡包。

用法：
    python3 _src/build.py                              # 默认：历史首卡 → 明年今天
    python3 _src/build.py --start 2026-08-06 --end 2027-09-12
    python3 _src/build.py --deck-id 42                 # 让 preview.html 读取真实卡组数据

产物（写在上一级目录）：
    template.json     模板定义
    cards.json        多日卡（**按日期线性升序**，index 1 = 最早一天）
    cards_single.json 单卡·永久模式（只有一张"永远今天"的卡）
    preview.html      预览页
"""
import json
import os
import re
import sys
from datetime import date, datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

# 打卡历史首卡（旧卡组 deck 11「20分钟美剧」最早一天），新卡组从这里起铺
HISTORY_START = date(2026, 8, 6)


def next_year_today(today=None):
    """明年今天（用于把卡组一次铺满一年，年内不用重建）。"""
    t = today or date.today()
    try:
        return t.replace(year=t.year + 1)
    except ValueError:          # 2/29
        return t.replace(year=t.year + 1, day=28)

NAME = '星际航行日志 · Voyage Log'
# 卡组卡片上只显示 4 行（.deck-desc 固定 72px、line-clamp:4），所以描述保持两三行以内
DESCRIPTION = '一张卡 = 一天，点一下记一笔。连续天数与最近 7 天实时算出。'


def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()


def day_list(start, end):
    """按日期**线性升序**生成卡片日期列表：index 1 = start，最后一张 = end。

    线性排列的好处：卡片顺序与时间一一对应，"第 N 张 = 第 N 天"。
    代价是"今天"落在中间（历史越长越靠后）——由模板 render 自动标注 +
    前端自动定位到今天来补偿。
    """
    if end < start:
        raise SystemExit('--end 不能早于 --start（%s < %s）' % (end, start))
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


PREVIEW_TPL = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} · 预览</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<style>
  *, *::before, *::after {{ box-sizing: border-box; }}   /* 与应用保持一致（应用全局是 border-box） */
  body {{ margin:0; padding:22px; background:#eef2f7; font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }}
  .pv-wrap {{ max-width:720px; margin:0 auto; }}
  .pv-tip {{ font-size:12px; color:#64748b; margin:0 0 14px; line-height:1.7;
            background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:9px 12px; }}
  .pv-label {{ font-size:12px; font-weight:700; color:#475569; margin:18px 0 7px; letter-spacing:.5px; }}
  .pv-confirm {{ position:fixed; z-index:99; display:flex; align-items:center; gap:9px;
                background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:8px 10px 8px 13px;
                box-shadow:0 12px 32px rgba(15,23,42,.16); font-size:13px; color:#1f2937; }}
  .pv-confirm button {{ font:inherit; font-size:12px; padding:4px 11px; border-radius:8px; cursor:pointer; border:1px solid #e2e8f0; background:#fff; color:#475569; }}
  .pv-confirm button[data-pc="ok"] {{ border-color:#10b981; background:#10b981; color:#fff; font-weight:600; }}
{css}
</style>
</head>
<body>
<div class="pv-wrap">
  <p class="pv-tip"><b>这是预览页</b>：三张卡分别是<b>今天（可打卡）/ 昨天（只读）/ 三天后（未解锁）</b>。<br>
  <b>只有"今天"这张换装</b>——深空底 + 星尘 + 头部右侧的黑洞（纯 CSS 动画，没有 canvas）；历史卡与未来卡保持素净，所以混在长列表里不吵。<br>
  今天已记一项「每日 20 分钟美剧」，剩下那项点一下会先弹<b>确认气泡</b>（防误触），确认后才算记录。<br>
  卡片里的连续天数、最近 7 天、记录时间用的是<b>内置演示数据</b>（不是真实记录）；点"点亮"只演示交互，不会写库。<br>
  要真正打卡：把 template.json + cards.json 导入应用，在学习页里点。</p>
  <div id="pv-host"></div>
</div>
<script>
/* 用演示数据顶掉统计接口：预览页不依赖本地服务，也不会污染真实记录 */
(function () {{
  function pad2(n) {{ return (n < 10 ? '0' : '') + n; }}
  function key(d) {{ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }}
  var TIMES = {{ movie_20min: '21:40', read_10pages: '22:05' }};
  /* 第 4 天前断一次，其余连续 → 今天连续 4 天、最近 7 天亮 6 格。
     今天故意只记一项：另一项留空才点得动，用来演示"点一下先弹确认"。 */
  var PATTERN = {{ '0': ['movie_20min'], '1': ['movie_20min'], '2': ['movie_20min'],
                   '3': ['movie_20min'], '4': [], '5': ['movie_20min'], '6': ['movie_20min', 'read_10pages'] }};
  function actionsFor(offset) {{
    var list = PATTERN[String(offset)] || [];
    var acts = {{}};
    list.forEach(function (a) {{ acts[a] = 1; }});
    return acts;
  }}
  function offsetOf(dateStr) {{
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var d = new Date(dateStr + 'T00:00:00');
    return Math.round((d - today) / 86400000);
  }}
  var _orig = window.fetch;
  window.fetch = function (url) {{
    var u = String(url);
    if (u.indexOf('/v1/observability/data') !== -1) {{
      var body;
      if (u.indexOf('view=heatmap') !== -1) {{
        var rows = [];
        Object.keys(PATTERN).forEach(function (off) {{
          var d = new Date(); d.setDate(d.getDate() - Number(off));
          rows.push({{ date: key(d), actions: actionsFor(Number(off)) }});
        }});
        body = {{ success: true, view: 'heatmap', data: rows.sort(function (a, b) {{ return a.date < b.date ? -1 : 1; }}) }};
      }} else {{
        var m = /date=([\\d-]+)/.exec(u);
        var acts = m ? actionsFor(offsetOf(m[1])) : {{}};
        var buckets = Object.keys(acts).map(function (a) {{
          var one = {{}}; one[a] = acts[a];
          return {{ time: TIMES[a] || '21:00', actions: one }};
        }});
        body = {{ success: true, view: 'daily', data: buckets }};
      }}
      return Promise.resolve({{ ok: true, json: function () {{ return Promise.resolve(body); }} }});
    }}
    return _orig.apply(window, arguments);
  }};
}})();
</script>
<script>{js}</script>
<script>
(function () {{
  var host = document.getElementById('pv-host');
  function pad2(n) {{ return (n < 10 ? '0' : '') + n; }}
  function key(d) {{ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }}
  function mk(dateStr, label) {{
    var cardData = {{ id: 'pv' + dateStr, deck_id: 0, data: {{ date: dateStr }},
                     current_order: 1, is_unknown: 0, is_favorite: 0 }};
    var api = {{
      cardItemId: cardData.id, cardId: 0, templateId: 0,
      getCardData: function () {{ return cardData; }},
      getViewMode: function () {{ return 'single'; }},
      getHiddenFields: function () {{ return {{}}; }},
      setHiddenFields: function () {{}},
      toggleMark: function () {{ return Promise.resolve({{ success: true, is_unknown: 1 }}); }},
      toggleFavorite: function () {{ return Promise.resolve({{ success: true }}); }},
      isFavorite: function () {{ return false; }},
      playAudio: function () {{}},
      rerender: function () {{}},
      track: function (a) {{ console.log('[preview] track:', a); }},
      /* 和真实应用一致：就地弹出小气泡二次确认（防止误触写库） */
      confirmDialog: function (el, msg, ok) {{
        var old = document.getElementById('pv-confirm');
        if (old) old.parentNode.removeChild(old);
        var pop = document.createElement('div');
        pop.id = 'pv-confirm'; pop.className = 'pv-confirm';
        pop.innerHTML = '<span></span>' +
          '<button type="button" data-pc="cancel">取消</button>' +
          '<button type="button" data-pc="ok">确认</button>';
        pop.firstChild.textContent = msg;
        document.body.appendChild(pop);
        var r = el.getBoundingClientRect();
        pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
        pop.style.top = (r.bottom + 6) + 'px';
        function close() {{ if (pop.parentNode) pop.parentNode.removeChild(pop); document.removeEventListener('mousedown', onDown); }}
        function onDown(e) {{ if (!pop.contains(e.target)) close(); }}
        pop.querySelector('[data-pc="cancel"]').addEventListener('click', close);
        pop.querySelector('[data-pc="ok"]').addEventListener('click', function () {{ close(); ok(); }});
        setTimeout(function () {{ document.addEventListener('mousedown', onDown); }}, 0);
      }},
      showTooltip: function () {{}}, hideTooltip: function () {{}}
    }};
    var holder = document.createElement('div');
    holder.innerHTML = window.cardTemplate.render('', cardData, api);
    var root = holder.querySelector('[data-card-id]');
    var lab = document.createElement('div');
    lab.className = 'pv-label';
    lab.textContent = label;
    host.appendChild(lab);
    host.appendChild(holder);
    window.cardTemplate.init(root, cardData, api);
  }}
  var t = new Date();
  var y = new Date(); y.setDate(y.getDate() - 1);
  var f = new Date(); f.setDate(f.getDate() + 3);
  mk(key(t), '今天（可打卡）');
  mk(key(y), '昨天（只读）');
  mk(key(f), '三天后（未解锁）');
}})();
</script>
</body>
</html>
'''


def main():
    args = sys.argv[1:]
    start_str = end_str = None
    deck_id = 0
    i = 0
    while i < len(args):
        if args[i] == '--deck-id':
            deck_id = int(args[i + 1]); i += 2; continue
        if args[i] == '--start':
            start_str = args[i + 1]; i += 2; continue
        if args[i] == '--end':
            end_str = args[i + 1]; i += 2; continue
        i += 1
    start = datetime.strptime(start_str, '%Y-%m-%d').date() if start_str else HISTORY_START
    end = datetime.strptime(end_str, '%Y-%m-%d').date() if end_str else next_year_today()
    today = date.today()

    tpl = {
        'name': NAME,
        'lang': 'zh',
        'description': DESCRIPTION,
        'cardHtml': read('card.html'),
        'cardCss': read('card.css'),
        'cardJs': read('card.js'),
        'trackedActions': [],           # 由 card.js 的 TASKS 决定，导入时应用也会自动补全
        'sampleData': [{'date': today.isoformat()}],
    }
    # trackedActions 从 card.js 的 TASKS 数组解析出来，写进模板声明（统计页图例用它）
    acts = re.findall(r"\{\s*action:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'", tpl['cardJs'])
    tpl['trackedActions'] = [{'action': a, 'label': lb} for a, lb in acts]

    with open(os.path.join(OUT, 'template.json'), 'w', encoding='utf-8') as f:
        json.dump(tpl, f, ensure_ascii=False, indent=1)

    days = day_list(start, end)
    cards = [{'item_order': n + 1, 'data': {'date': d.isoformat()}} for n, d in enumerate(days)]
    with open(os.path.join(OUT, 'cards.json'), 'w', encoding='utf-8') as f:
        json.dump(cards, f, ensure_ascii=False, indent=1)

    single = [{'item_order': 1, 'data': {}}]
    with open(os.path.join(OUT, 'cards_single.json'), 'w', encoding='utf-8') as f:
        json.dump(single, f, ensure_ascii=False, indent=1)

    with open(os.path.join(OUT, 'preview.html'), 'w', encoding='utf-8') as f:
        f.write(PREVIEW_TPL.format(name=NAME, css=tpl['cardCss'], js=tpl['cardJs']))

    print('template.json  html=%d css=%d js=%d tracked=%s' % (
        len(tpl['cardHtml']), len(tpl['cardCss']), len(tpl['cardJs']), [a['action'] for a in tpl['trackedActions']]))
    today_idx = next((n + 1 for n, d in enumerate(days) if d == today), 0)
    print('cards.json     %d 张（%s → %s，线性升序；今天 = 第 %d 张）'
          % (len(cards), days[0], days[-1], today_idx))
    print('cards_single.json 1 张（永久"今天"模式）')
    print('preview.html   完成（内置演示数据）')


if __name__ == '__main__':
    main()
