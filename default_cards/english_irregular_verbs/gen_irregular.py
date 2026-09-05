# -*- coding: utf-8 -*-
"""
english_irregular_verbs · 英语不规则动词 ~210（五型分组，全平铺 + 每卡自产例句）

数据真身在 data/*.json（aaa/aab/aba/abb/abc = 动词；guides.json = overview + 五张引导卡），
本生成器负责：合并排序 → 产出 template.json + cards.json + preview.html（全量内嵌）。
改动流程：只改 data/*.json 或下方模板常量，再 python3 gen_irregular.py 重跑。
规范：item_order 自动按排列顺序重排（勿手工维护）。
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = HERE
DATA = os.path.join(HERE, 'data')

# 组显示顺序（学习路径：简单小类在前 → ABB 大组 → ABC 最难收尾）
GROUP_ORDER = ['AAA', 'AAB', 'ABA', 'ABB', 'ABC']
GROUP_NAME = {
    'AAA': '三形相同', 'AAB': '原形=过去式', 'ABA': '原形=过去分词',
    'ABB': '过去式=过去分词', 'ABC': '三形全不同',
}

# ---------------------------------------------------------------------------
# 五型配色 + 卡片通用变量（含深色模式）
# ---------------------------------------------------------------------------
CARD_GROUP_CSS = """
:root{
  --iv-aaa:#2f6ac0; --iv-aaa-soft:#e7f0fc; --iv-aaa-bdr:#c4d8f3; --iv-aaa-txt:#2a5fae;
  --iv-aab:#0e8f84; --iv-aab-soft:#e0f4f2; --iv-aab-bdr:#b6e2dd; --iv-aab-txt:#0b7a71;
  --iv-aba:#2f9e44; --iv-aba-soft:#e6f4e9; --iv-aba-bdr:#c3e3cb; --iv-aba-txt:#27813a;
  --iv-abb:#d05c17; --iv-abb-soft:#fbeae0; --iv-abb-bdr:#f2cdb6; --iv-abb-txt:#b94f12;
  --iv-abc:#7c44b4; --iv-abc-soft:#f2ebfb; --iv-abc-bdr:#ddc9f1; --iv-abc-txt:#6f3ba8;
  --card:#ffffff; --border:#e7e2d4; --ink:#211d15; --body:#403a2f; --ink2:#57503f; --ink3:#6d6451;
  --chip:#f1ece0; --gold:#a67c00; --rose:#b3436f; --tagbg:#fbf7ea; --tagfg:#5a4f33;
}
.iv-AAA{ --grp:var(--iv-aaa); --soft:var(--iv-aaa-soft); --bdr:var(--iv-aaa-bdr); --txt:var(--iv-aaa-txt); }
.iv-AAB{ --grp:var(--iv-aab); --soft:var(--iv-aab-soft); --bdr:var(--iv-aab-bdr); --txt:var(--iv-aab-txt); }
.iv-ABA{ --grp:var(--iv-aba); --soft:var(--iv-aba-soft); --bdr:var(--iv-aba-bdr); --txt:var(--iv-aba-txt); }
.iv-ABB{ --grp:var(--iv-abb); --soft:var(--iv-abb-soft); --bdr:var(--iv-abb-bdr); --txt:var(--iv-abb-txt); }
.iv-ABC{ --grp:var(--iv-abc); --soft:var(--iv-abc-soft); --bdr:var(--iv-abc-bdr); --txt:var(--iv-abc-txt); }
body.dark-mode{
  --card:#221e16; --border:#3c362a; --ink:#f4ecd6; --body:#d7ccb2; --ink2:#b6aa8c; --ink3:#a2957a;
  --chip:#3a3323; --gold:#d4a92c; --rose:#d96b98; --tagbg:#332d1d; --tagfg:#d5c79f;
}
body.dark-mode .iv-AAA{ --grp:#7fa9e8; --soft:#232c3d; --bdr:#3d4a66; --txt:#a9c6f2; }
body.dark-mode .iv-AAB{ --grp:#5ecfc4; --soft:#1f3230; --bdr:#2f4a46; --txt:#8fe0d6; }
body.dark-mode .iv-ABA{ --grp:#7fd18e; --soft:#223127; --bdr:#33543c; --txt:#a3e0ae; }
body.dark-mode .iv-ABB{ --grp:#eda06b; --soft:#382a1e; --bdr:#5a412c; --txt:#f7bd93; }
body.dark-mode .iv-ABC{ --grp:#c19bf0; --soft:#322a40; --bdr:#4c3d63; --txt:#d8c0f7; }
"""

CARD_CSS = """
.iv-root{ background:var(--card); border:1px solid var(--border); border-top:4px solid var(--grp); border-radius:16px; box-shadow:0 4px 14px rgba(45,35,15,.07); margin-bottom:16px; padding:14px 18px 15px; }
.iv-top{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.iv-badge{ display:inline-flex; align-items:center; gap:6px; font-family:Georgia,'Times New Roman',serif; font-size:12.5px; font-weight:700; letter-spacing:1.6px; padding:4px 13px; border-radius:9999px; color:#fff; background:var(--grp); box-shadow:0 2px 7px rgba(0,0,0,.14); }
.iv-badge .cn{ font-family:-apple-system,"PingFang SC","Segoe UI",Roboto,Helvetica,Arial,sans-serif; font-size:11px; font-weight:600; letter-spacing:.5px; }
body.dark-mode .iv-badge{ color:#19140c; }
.iv-actions{ display:flex; gap:7px; }
.iv-act{ position:relative; width:38px; height:38px; border-radius:9999px; border:1px solid var(--border); cursor:pointer; background:var(--card); color:var(--ink3); font-size:14px; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,.04); transition:all .18s ease; }
.iv-act:hover{ background:var(--grp); border-color:var(--grp); color:#fff; }
.iv-act:active{ transform:scale(.92); }
.iv-act.act-mark.is-active{ background:var(--gold); border-color:var(--gold); color:#fff; }
.iv-act.act-fav.is-active{ background:var(--rose); border-color:var(--rose); color:#fff; }
.iv-act::after{ content:attr(data-tip); position:absolute; top:100%; left:50%; transform:translateX(-50%) translateY(3px); background:var(--ink); color:var(--card); font-size:11.5px; font-weight:600; padding:4px 9px; border-radius:7px; white-space:nowrap; opacity:0; visibility:hidden; pointer-events:none; z-index:20; transition:opacity .18s ease, transform .18s ease, visibility .18s; }
.iv-act:hover::after{ opacity:1; visibility:visible; transform:translateX(-50%) translateY(7px); }
.iv-base-line{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-top:10px; flex-wrap:wrap; }
.iv-base{ font-size:30px; font-weight:900; color:var(--ink); line-height:1.2; letter-spacing:-.3px; font-family:Georgia,'Times New Roman',serif; }
.iv-zh{ font-size:15px; font-weight:600; color:var(--ink2); background:var(--chip); padding:3px 12px; border-radius:9999px; }
.iv-forms{ display:flex; align-items:stretch; gap:6px; margin-top:14px; }
.iv-f{ flex:1 1 0; min-width:0; background:var(--soft); border:1px solid var(--bdr); border-radius:12px; padding:8px 10px 9px; text-align:center; }
.iv-f-tag{ display:block; font-size:10px; font-weight:700; letter-spacing:1.6px; color:var(--txt); text-transform:uppercase; margin-bottom:4px; }
.iv-f-w{ display:block; font-family:Georgia,'Times New Roman',serif; font-size:17px; font-weight:700; color:var(--ink); word-break:break-all; line-height:1.3; }
.iv-f.dim .iv-f-w{ color:var(--ink3); letter-spacing:.5px; font-weight:600; }
.iv-arrow{ align-self:center; color:var(--grp); font-size:15px; font-weight:900; flex:0 0 auto; }
.iv-ex{ margin-top:13px; background:var(--tagbg); border-left:3px solid var(--grp); border-radius:0 10px 10px 0; padding:9px 14px 10px; }
.iv-ex-tag{ font-size:10px; font-weight:800; letter-spacing:1.8px; color:var(--txt); text-transform:uppercase; margin-bottom:4px; }
.iv-ex-en{ font-size:14.5px; line-height:1.65; color:var(--body); font-family:Georgia,'Times New Roman',serif; font-style:italic; }
.iv-ex-en b{ font-weight:800; color:var(--grp); font-style:normal; }
.iv-ex-zh{ margin-top:3px; font-size:12.5px; color:var(--ink3); line-height:1.6; }
.iv-g-title{ margin-top:12px; font-size:21px; font-weight:900; color:var(--ink); letter-spacing:.2px; }
.iv-g-pattern{ margin-top:12px; font-family:Georgia,'Times New Roman',serif; font-size:23px; font-weight:900; color:var(--ink); background:var(--soft); border:1px solid var(--bdr); border-radius:13px; padding:11px 15px; text-align:center; line-height:1.5; letter-spacing:.5px; }
.iv-g-pattern b{ color:var(--grp); }
.iv-g-rule{ margin-top:12px; font-size:14.5px; line-height:1.85; color:var(--body); }
.iv-g-rule b{ color:var(--ink); font-weight:700; }
.iv-g-tip{ margin-top:11px; font-size:13px; line-height:1.7; color:var(--tagfg); background:var(--tagbg); border:1px dashed var(--bdr); border-radius:10px; padding:8px 13px; }
.iv-g-tip b{ color:var(--txt); }
.iv-ov{ margin-top:12px; overflow:hidden; border:1px solid var(--border); border-radius:13px; }
.iv-ov-row{ display:flex; align-items:center; gap:10px; padding:9px 14px; border-bottom:1px solid var(--border); background:var(--card); }
.iv-ov-row:last-child{ border-bottom:none; }
.iv-ov-dot{ width:11px; height:11px; border-radius:4px; flex:0 0 auto; }
.iv-ov-type{ font-family:Georgia,'Times New Roman',serif; font-weight:800; font-size:13.5px; color:var(--ink); flex:0 0 74px; }
.iv-ov-rule{ font-size:12.5px; color:var(--body); flex:1 1 auto; }
.iv-ov-ex{ font-family:Georgia,'Times New Roman',serif; font-size:13px; font-weight:700; color:var(--ink2); text-align:right; white-space:nowrap; }
.iv-intro{ margin-top:10px; font-size:14px; line-height:1.8; color:var(--body); }
.iv-intro b{ color:var(--ink); }
"""

# ---------------------------------------------------------------------------
# cardJs（模板 JS：render 分支 overview / guide / verb，真实 App 与 preview 共用）
# ---------------------------------------------------------------------------
CARD_JS = r"""(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function cls(k){ return ({'AAA':'AAA','AAB':'AAB','ABA':'ABA','ABB':'ABB','ABC':'ABC'})[k] || 'AAA'; }
  var TYPE_CN = {'AAA':'三形相同','AAB':'原形=过去式','ABA':'原形=过去分词','ABB':'过去式=过去分词','ABC':'三形全不同'};
  function cell(tag, w, dim){
    return '<div class="iv-f'+(dim?' dim':'')+'"><span class="iv-f-tag">'+tag+'</span><span class="iv-f-w">'+esc(w)+'</span></div>';
  }
  var ACTS = '<div class="iv-actions">'
    + '<button class="iv-act act-audio" data-action="audio" data-tip="朗读"><i class="fa-solid fa-volume-high"></i></button>'
    + '<button class="iv-act act-mark" data-action="mark" data-tip="标记"><i class="fa-regular fa-star"></i></button>'
    + '<button class="iv-act act-fav" data-action="favorite" data-tip="收藏"><i class="fa-regular fa-bookmark"></i></button>'
    + '</div>';
  window.cardTemplate = {
    name: 'English Irregular Verbs · 不规则动词',
    fields: [
      {key:'base', label:'原形', hideable:false},
      {key:'zh', label:'中文释义', hideable:true},
      {key:'past', label:'过去式', hideable:true},
      {key:'pp', label:'过去分词', hideable:true},
      {key:'example', label:'英文例句', hideable:true},
      {key:'exampleZh', label:'例句译文', hideable:true}
    ],
    render: function (cardHtml, cardData, api) {
      var data = (api && api.getCardData) ? api.getCardData() : cardData;
      var d = data.data || {};
      var hidden = (api.getHiddenFields && api.getHiddenFields()) || {};
      function on(k){ return !(hidden.has && hidden.has(k)); }
      function h(k, html){ return on(k) ? html : ''; }
      if (d.type === 'overview') {
        var rows = [
          ['AAA','三形相同','cut / cut / cut'],
          ['AAB','原形 = 过去式','beat / beat / beaten'],
          ['ABA','原形 = 过去分词','come / came / come'],
          ['ABB','过去式 = 过去分词','build / built / built'],
          ['ABC','三形全不同','begin / began / begun']
        ];
        var r = rows.map(function(x){
          return '<div class="iv-ov-row"><span class="iv-ov-dot" style="background:var(--iv-'+x[0].toLowerCase()+')"></span>'
            + '<span class="iv-ov-type">'+x[0]+'</span><span class="iv-ov-rule">'+x[1]+'</span>'
            + '<span class="iv-ov-ex">'+x[2]+'</span></div>';
        }).join('');
        return '<div class="iv-root iv-AAA" data-card-id="'+esc(data.id)+'">'
          + '<div class="iv-top"><span class="iv-badge">\u4e94\u578b\u603b\u89c8</span><div class="iv-actions">'
          + '<button class="iv-act act-mark" data-action="mark" data-tip="标记"><i class="fa-regular fa-star"></i></button>'
          + '<button class="iv-act act-fav" data-action="favorite" data-tip="收藏"><i class="fa-regular fa-bookmark"></i></button>'
          + '</div></div>'
          + '<div class="iv-g-title">'+esc(d.nameZh)+'</div>'
          + h('intro', '<div class="iv-intro">'+esc(d.intro)+'</div>')
          + '<div class="iv-ov">'+r+'</div>'
          + '</div>';
      }
      if (d.type === 'guide') {
        var g = cls(d.group);
        return '<div class="iv-root iv-'+g+'" data-card-id="'+esc(data.id)+'">'
          + '<div class="iv-top"><span class="iv-badge">'+esc(g)+' <span class="cn">'+esc(TYPE_CN[g])+'</span></span>' + ACTS + '</div>'
          + '<div class="iv-g-title">'+esc(d.nameZh)+'</div>'
          + h('pattern', '<div class="iv-g-pattern">'+esc(d.pattern)+'</div>')
          + h('rule', '<div class="iv-g-rule">'+esc(d.rule)+'</div>')
          + h('tip', '<div class="iv-g-tip">'+esc(d.tip)+'</div>')
          + h('example', '<div class="iv-ex"><div class="iv-ex-tag">Example · 例句</div>'
              + '<div class="iv-ex-en">'+esc(d.example)+'</div>'
              + h('exampleZh', '<div class="iv-ex-zh">'+esc(d.exampleZh)+'</div>')
              + '</div>')
          + '</div>';
      }
      // verb
      var gv = cls(d.group);
      return '<div class="iv-root iv-'+gv+'" data-card-id="'+esc(data.id)+'">'
        + '<div class="iv-top"><span class="iv-badge">'+esc(d.group)+' <span class="cn">'+esc(TYPE_CN[gv])+'</span></span>' + ACTS + '</div>'
        + '<div class="iv-base-line"><span class="iv-base">'+esc(d.base)+'</span>'
        + h('zh', '<span class="iv-zh">'+esc(d.zh)+'</span>') + '</div>'
        + '<div class="iv-forms">'
        + cell('原形', d.base, false)
        + '<span class="iv-arrow">\u2192</span>'
        + cell('过去式', on('past') ? d.past : '\u00b7 \u00b7 \u00b7', !on('past'))
        + '<span class="iv-arrow">\u2192</span>'
        + cell('过去分词', on('pp') ? d.pp : '\u00b7 \u00b7 \u00b7', !on('pp'))
        + '</div>'
        + h('example', '<div class="iv-ex"><div class="iv-ex-tag">Example · 过去式例句</div>'
            + '<div class="iv-ex-en">'+esc(d.example)+'</div>'
            + h('exampleZh', '<div class="iv-ex-zh">'+esc(d.exampleZh)+'</div>')
            + '</div>')
        + '</div>';
    },
    init: function (el, cardData, api) {
      var data = (api && api.getCardData) ? api.getCardData() : cardData;
      var d = data.data || {};
      var ab = el.querySelector('.act-audio');
      if (ab) ab.addEventListener('click', function(){ if(api&&api.playAudio) api.playAudio(d.anchor || d.base || ''); if(api&&api.track) api.track('audio_play'); });
      var mb = el.querySelector('.act-mark');
      if (mb) mb.addEventListener('click', function(){ if(api&&api.toggleMark) api.toggleMark(); mb.classList.toggle('is-active'); var i=mb.querySelector('i'); if(i){ i.classList.toggle('fa-regular'); i.classList.toggle('fa-solid'); } if(api&&api.track) api.track('word_mark'); });
      var vb = el.querySelector('.act-fav');
      if (vb) vb.addEventListener('click', function(){ if(api&&api.toggleFavorite) api.toggleFavorite(); vb.classList.toggle('is-active'); var i=vb.querySelector('i'); if(i){ i.classList.toggle('fa-regular'); i.classList.toggle('fa-solid'); } if(api&&api.track) api.track('favorite_toggle'); });
    }
  };
})();"""

# ---------------------------------------------------------------------------
# Preview 外壳
# ---------------------------------------------------------------------------
PAGE_CSS = """
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,"PingFang SC","Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#ece7db;color:#322d24;padding:30px 16px 70px;transition:background .2s}
body.dark-mode{background:#17130c}
.wrap{max-width:620px;margin:0 auto}
header{text-align:center;margin-bottom:6px}
header h1{font-size:24px;margin:0 0 6px;color:var(--h1,#322d24);font-weight:800}
header p{margin:0;color:var(--sub,#6f6650);font-size:13.5px;line-height:1.7}
body.dark-mode header h1{--h1:#f0e7cf}
body.dark-mode header p{--sub:#a7987b}
.legend{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:18px 0 26px;font-size:12px;color:var(--sub,#6f6650)}
body.dark-mode .legend{--sub:#a7987b}
.legend .lg{display:inline-flex;align-items:center;gap:6px;background:var(--card,#fdfcf8);border:1px solid var(--border,#e6dfcb);border-radius:9999px;padding:4px 11px}
body.dark-mode .legend{--card:#262016;--border:#3d3625}
.legend .dot{width:10px;height:10px;border-radius:3px;display:inline-block}
#cards{display:flex;flex-direction:column}
.dark-toggle{position:fixed;top:16px;right:16px;z-index:50;border:none;cursor:pointer;background:var(--card,#fdfcf8);color:var(--ink,#322d24);border:1px solid var(--border,#e6dfcb);border-radius:9999px;padding:8px 14px;font-size:13px;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.08)}
body.dark-mode .dark-toggle{--card:#262016;--ink:#f0e7cf;--border:#3d3625}
"""

def build_preview(cards, counts_txt, total):
    legend_items = [
        ('AAA 三形相同', '#2f6ac0'), ('AAB 原形=过去式', '#0e8f84'),
        ('ABA 原形=过去分词', '#2f9e44'), ('ABB 过去式=过去分词', '#d05c17'),
        ('ABC 三形全不同', '#7c44b4'),
    ]
    legend_html = ''.join(
        '<span class="lg"><span class="dot" style="background:%s"></span>%s</span>' % (c, t)
        for t, c in legend_items)
    return """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>英语不规则动词 · English Irregular Verbs · %(total)d 张预览</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
%(page)s
%(group)s
%(card)s
</style>
</head>
<body>
<button class="dark-toggle" onclick="document.body.classList.toggle('dark-mode')">深色</button>
<div class="wrap">
<header>
<h1>英语不规则动词 · Irregular Verbs</h1>
<p>%(counts)s · 按变化规律分五型（每组先看引导卡，再逐个动词）<br>变形为主、示例自撰 · 平铺阅读 + 可隐藏过去式/过去分词作自测</p>
</header>
<div class="legend">%(legend)s</div>
<div id="cards"></div>
</div>
<script>
%(js)s
var CARDS = %(data)s;
var wrap = document.getElementById('cards');
CARDS.forEach(function(d, i){
  var api = {
    getCardData: function(){ return {id: i+1, data: d}; },
    getHiddenFields: function(){ return {}; },
    playAudio: function(t, lang){ try{ var u=new SpeechSynthesisUtterance(t); u.lang = lang || 'en-US'; speechSynthesis.speak(u); }catch(e){} },
    toggleMark: function(){}, toggleFavorite: function(){}, track: function(){}
  };
  var host = document.createElement('div');
  host.innerHTML = window.cardTemplate.render('', {id: i+1, data: d}, api);
  var root = host.firstChild;
  wrap.appendChild(root);
  window.cardTemplate.init(root, {id: i+1, data: d}, api);
});
</script>
</body>
</html>""" % {
        'total': total, 'counts': counts_txt, 'legend': legend_html,
        'page': PAGE_CSS, 'group': CARD_GROUP_CSS, 'card': CARD_CSS,
        'js': CARD_JS, 'data': json.dumps(cards, ensure_ascii=False),
    }

# ---------------------------------------------------------------------------
# 数据合并 + 写文件
# ---------------------------------------------------------------------------
def load_verbs(name):
    with open(os.path.join(DATA, name + '.json'), encoding='utf-8') as f:
        return json.load(f)

def main():
    verbs = {}
    for g in GROUP_ORDER:
        verbs[g] = load_verbs(g.lower())
    verbs['ABC'] = verbs['ABC'] + load_verbs('abc_b')  # ABC 分两文件（核心 + 派生/中频）
    guides = load_verbs('guides')  # [{type:'overview'|'guide', group?...}]
    overview = [g for g in guides if g.get('type') == 'overview']
    guide_map = {g['group']: g for g in guides if g.get('type') == 'guide'}

    cards = []
    cards += overview
    for g in GROUP_ORDER:
        if g in guide_map:
            cards.append(guide_map[g])
        cards += verbs[g]

    # item_order 自动重排（含 overview/guide/verb 全序列）
    for i, c in enumerate(cards, 1):
        c['item_order'] = i

    # 计数
    n_verb = sum(len(verbs[g]) for g in GROUP_ORDER)
    group_nums = {g: len(verbs[g]) for g in GROUP_ORDER}
    total = len(cards)
    counts_txt = ('%(t)d 张卡 · 总览 1 / 引导 5 / 动词 %(v)d'
                  '（AAA %(AAA)s · AAB %(AAB)s · ABA %(ABA)s · ABB %(ABB)s · ABC %(ABC)s）'
                  % dict(t=total, v=n_verb, **group_nums))

    # 断言
    assert total >= 200 and total <= 230, 'target ~210, got %d' % total
    orders = [c['item_order'] for c in cards]
    assert orders == list(range(1, total + 1)), 'item_order broken'
    for c in cards:
        if c.get('type') == 'verb' or 'type' not in c:
            for k in ('base', 'zh', 'past', 'pp', 'group', 'example', 'exampleZh'):
                assert c.get(k) not in (None, ''), 'verb missing %s in %s' % (k, c.get('base'))
            assert c['group'] in GROUP_ORDER, 'bad group ' + c['group']
        if c.get('type') == 'guide':
            for k in ('group', 'nameZh', 'anchor', 'pattern', 'rule', 'tip', 'example', 'exampleZh'):
                assert c.get(k) not in (None, ''), 'guide missing %s' % k

    # 语言域粗查：英文域(base/past/pp/example)不应含中文；中文域(zh/exampleZh)应含中文
    re_cjk = re.compile(r'[\u4e00-\u9fff]')
    bad = []
    for c in verbs.values():
        for v in c:
            for k in ('base', 'past', 'pp', 'example'):
                if re_cjk.search(v.get(k, '')):
                    bad.append((v.get('base'), k, 'has CJK'))
            for k in ('zh', 'exampleZh'):
                if not re_cjk.search(v.get(k, '')):
                    bad.append((v.get('base'), k, 'no CJK'))
    if bad:
        print('!! language-domain warnings (sample):', bad[:8])
    else:
        print('language-domain check passed')

    # 排序键：type overview/guide/verb 序列已在 cards 中排好；组序校验
    seq = [c.get('group') or ('OV' if c.get('type') == 'overview' else '?') for c in cards]
    print('sequence:', seq[:12], '...')

    template = {
        'name': 'English Irregular Verbs · 英语不规则动词',
        'lang': 'en',
        'description': '英语不规则动词 %d 个：按五型（AAA/AAB/ABA/ABB/ABC）分组，每组一张引导卡 + 总览卡；每词带过去式/过去分词与自撰例句（平铺阅读，过去式/过去分词可隐藏作自测）。' % n_verb,
        'cardHtml': '',
        'cardCss': CARD_GROUP_CSS + '\n' + CARD_CSS,
        'cardJs': CARD_JS,
        'trackedActions': [
            {'action': 'audio_play', 'label': '朗读'},
            {'action': 'word_mark', 'label': '标记'},
            {'action': 'favorite_toggle', 'label': '收藏'}
        ],
        'sampleData': (overview[:1] + [guide_map[g] for g in GROUP_ORDER] +
                       [verbs[g][0] for g in GROUP_ORDER if verbs[g]])
    }

    with open(os.path.join(OUT, 'cards.json'), 'w', encoding='utf-8') as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)
        f.write('\n')
    with open(os.path.join(OUT, 'template.json'), 'w', encoding='utf-8') as f:
        json.dump(template, f, ensure_ascii=False, indent=2)
        f.write('\n')
    with open(os.path.join(OUT, 'preview.html'), 'w', encoding='utf-8') as f:
        f.write(build_preview(cards, counts_txt, total))

    print('Wrote template.json + cards.json + preview.html to', OUT)
    print('Cards:', total, '| verbs:', n_verb, '| per group:', group_nums)

if __name__ == '__main__':
    main()
