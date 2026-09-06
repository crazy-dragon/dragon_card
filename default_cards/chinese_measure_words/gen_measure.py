#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_measure.py — Chinese Measure Words (量词) 卡组生成器
=========================================================
产物（写入本目录）：
  template.json  cards.json  preview.html

结构：
  intro 引导卡 1 张（量词是什么 + 结构公式 + 七类图例）
  + 量词卡按 HSK 等级升序平铺（1..6, 7-9, Extra 补充）

数据文件 data/{l1,l2,l3,l4,l5,l6,l7plus}.json
  每行: mw / pinyin / category / level / usage(EN) / collocations[3+]
        / example(zh) / exampleEn
  level 取值 '1'..'6' | '7-9' | 'Extra'（HSK 词表内词的官方等级；Extra=词表外补充）
  hsk_word 可选：裸词不在 HSK 词表、但由 HSK 名词引申的量词（容器类，
        如 杯→杯子、桌→桌子），交叉校验时改查该名词词形

校验：
  - 官方词（非 Extra）必须存在于 memory_market_goods/hsk1-9/cards.json
    （有 hsk_word 时查 hsk_word），且若数据集有「量」词性条目，
    其 level/pinyin 必须与数据行一致
    （防 行háng / 卷juǎn / 只zhī 这类多音多义词标错；拼音比对按前缀，
     使 杯 bēi ← 杯子 bēizi 这类派生一致）
  - Extra 词必须不在 HSK 词表（裸词）
  - collocations 每条必须含量词字、无拉丁字母；example 必须含量词字
  - usage 为英文释义，可内嵌中文例释（须含英文单词）；exampleEn 不得含中文；
    example 必须含中文、搭配必须含量词字
  - 等级单调不减（文件顺序即学习路径）
  - hsk_word 为内部校验字段，写入 cards.json 前剔除
"""
import json
import os
import re

DECK = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(DECK, 'data')
OUT = DECK
HSK_SRC = '/Users/alfred/CodeBase/Python/memory_market_goods/hsk1-9/cards.json'

LEVEL_ORDER = ['1', '2', '3', '4', '5', '6', '7-9', 'Extra']
LV_TEXT = {'1': 'HSK1', '2': 'HSK2', '3': 'HSK3', '4': 'HSK4',
           '5': 'HSK5', '6': 'HSK6', '7-9': 'HSK7-9', 'Extra': 'HSK+'}
FILES = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7plus']
MIN_N, MAX_N = 170, 215

# 类别配色（light 主色 / dark 提亮）
CATS = [
    ('个体', '#2f6ac0', '#6ea8f5', 'individual objects'),
    ('集合', '#7c44b4', '#b58ae8', 'pairs, sets & groups'),
    ('容器', '#0e8f84', '#52c7bb', 'containerfuls'),
    ('度量', '#c2572d', '#e8935f', 'units & measures'),
    ('时间', '#5a8a1f', '#9cc95c', 'time spans'),
    ('动作', '#b03a48', '#e07b88', 'counting actions'),
    ('类别', '#64748b', '#9aa8b8', 'kinds & types'),
]
CAT_MAP = {c[0]: c for c in CATS}

# ---------------------------------------------------------------------------
# 模板常量
# ---------------------------------------------------------------------------
NAME = 'Chinese Measure Words · 汉语量词'
DESC = ('汉语量词 %(n)d 个（含 1 张引导卡）：按 HSK 等级升序平铺，每词配英文用法说明、'
        '典型搭配（数词+量词+名词）与自撰例句。量词按七类着色（个体/集合/容器/度量/时间/动作/类别），'
        '等级徽章 HSK1-9（HSK+ = 词表外高频补充）。朗读中文量词（lang: zh），可隐藏搭配作自测。')

CARD_HTML = ''

CARD_CSS = r'''
.mw-root{box-sizing:border-box;border-radius:16px;padding:13px 16px 15px;margin-bottom:16px;
 border:1px solid #dfe3e9;background:#f4f6f9;box-shadow:0 1px 2px rgba(20,24,33,.04)}
@supports (background:color-mix(in srgb,red 10%,white)){
.mw-root{background:color-mix(in srgb,var(--cat) 8%,white);
 border-color:color-mix(in srgb,var(--cat) 24%,white)}
}
.mw-top{display:flex;align-items:center;gap:7px;margin-bottom:9px;flex-wrap:wrap}
.mw-lv{font-size:11px;line-height:1;padding:4px 8px;border-radius:999px;background:#fff;
 color:#5b6472;font-weight:700;letter-spacing:.3px;border:0.5px solid rgba(0,0,0,.05)}
.mw-cat{font-size:11px;line-height:1;padding:4px 9px;border-radius:999px;background:var(--cat);
 color:#fff;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.mw-space{flex:1}
.mw-actions{display:flex;gap:2px}
.mw-actions button{border:0;background:transparent;color:#5b6472;cursor:pointer;padding:6px 8px;
 border-radius:8px;font-size:15px;line-height:1;transition:background .15s}
.mw-actions button:hover{background:rgba(255,255,255,.85);color:var(--cat,#333)}
.mw-word{font-size:calc(48px * var(--card-font-scale,1));line-height:1.12;font-weight:800;
 color:var(--ink,#18202b);letter-spacing:1px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.mw-word .mw-py{font-size:calc(18px * var(--card-font-scale,1));font-weight:500;color:var(--ink,#8a8f98);
 letter-spacing:.5px}
.mw-usage{margin-top:3px;font-size:14px;line-height:1.55;color:var(--ink,#41506b)}
.mw-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:11px}
.mw-chip{border:1px solid #c6cdd9;background:#fff;color:#333a45;border-radius:999px;padding:5px 13px;
 font-size:15px;font-weight:600}
@supports (background:color-mix(in srgb,red 10%,white)){
.mw-chip{border-color:color-mix(in srgb,var(--cat) 40%,white);
 color:color-mix(in srgb,var(--cat) 72%,#14181f)}
}
.mw-ex{margin-top:12px;padding:1px 0 1px 12px;border-left:3px solid var(--cat);
 font-size:calc(18px * var(--card-font-scale,1));line-height:1.6;color:var(--ink,#22303f)}
.mw-exen{font-size:14px;line-height:1.5;color:var(--ink,#8a8f98);margin-top:3px;padding-left:12px}
body.dark-mode .mw-root{border-color:#39404d}
body.dark-mode .mw-lv{background:#2a2f38;color:#d7dbe2}
body.dark-mode .mw-actions button{color:#c7cdd8}
body.dark-mode .mw-actions button:hover{background:rgba(255,255,255,.08)}
body.dark-mode .mw-chip{background:#2a2f38;border-color:#4a5260;color:#e6e9f0}
@supports (background:color-mix(in srgb,red 10%,#20242c)){
body.dark-mode .mw-root{background:color-mix(in srgb,var(--cat) 13%,#20242c)}
body.dark-mode .mw-chip{background:color-mix(in srgb,var(--cat) 15%,#262b34);
 border-color:color-mix(in srgb,var(--cat) 38%,#4a5260);color:#e8ebf2}
}
/* intro */
.mw-intro{border:0;box-shadow:none;padding:0;background:transparent}
.mw-intro .mw-intro-body{background:var(--card-bg,#fff);border:1px solid var(--line,#e2e0da);
 border-radius:16px;padding:20px 22px}
.mw-intro h2{margin:0 0 4px;font-size:calc(26px * var(--card-font-scale,1));color:var(--ink,#161b22)}
.mw-intro .mw-i-en{font-size:14px;color:var(--ink,#8a8f98);margin-bottom:14px}
.mw-i-formula{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 14px;
 font-size:17px;color:var(--ink,#2c3140)}
.mw-i-formula b{padding:4px 10px;border-radius:8px;background:#eef1f6;border:1px solid #d5dbe4}
.mw-intro .mw-i-sec{margin:14px 0 6px;font-weight:800;color:var(--ink,#161b22);font-size:15px}
.mw-intro table{border-collapse:collapse;width:100%;font-size:15px;margin:4px 0 6px}
.mw-intro td{padding:5px 10px;border-bottom:1px dashed var(--line,#e2e0da);color:var(--ink,#2c3140)}
.mw-intro td.zh{font-weight:700;width:120px}
.mw-intro td.en{color:var(--ink,#8a8f98);font-size:13px}
.mw-legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.mw-legend .lg{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#e2e0da);
 border-radius:999px;padding:4px 10px;font-size:12.5px;color:var(--ink,#5b6472);background:var(--card-bg,#fff)}
.mw-legend .lg i{width:9px;height:9px;border-radius:50%;display:inline-block}
'''

CARD_JS = r'''(function(){
var NAME='Chinese Measure Words · 汉语量词';
var CAT_MAP={'个体':'#2f6ac0','集合':'#7c44b4','容器':'#0e8f84','度量':'#c2572d','时间':'#5a8a1f','动作':'#b03a48','类别':'#64748b'};
var LV_TEXT={'1':'HSK1','2':'HSK2','3':'HSK3','4':'HSK4','5':'HSK5','6':'HSK6','7-9':'HSK7-9','Extra':'HSK+'};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function iconBtn(kind, on){return '<button type="button" data-action="'+kind+'" title="'+({play:'朗读',mark:'标记',favorite:'收藏'}[kind])+'">'
  + (kind==='play' ? '<i class="fa-solid fa-volume-high"></i>'
     : kind==='mark' ? '<i class="'+(on?'fa-solid':'fa-regular')+' fa-star"></i>'
     : '<i class="'+(on?'fa-solid':'fa-regular')+' fa-bookmark"></i>') + '</button>';}
function actionBar(api){var cd=api.getCardData?api.getCardData():{};
  return '<div class="mw-actions">'
   + iconBtn('play',0) + iconBtn('mark',!!(cd.is_unknown)) + iconBtn('favorite',!!(cd.is_favorite))
   + '</div>';}
function renderIntro(){
  var rows=[
    ['一张纸','a sheet of paper'],['三本书','three books'],['两只猫','two cats'],
    ['五个人','five people'],['一杯茶','a cup of tea'],['看了一遍','read once through']];
  var table=rows.map(function(r){return '<tr><td class="zh">'+r[0]+'</td><td class="en">'+r[1]+'</td></tr>';}).join('');
  var keys=['个体','集合','容器','度量','时间','动作','类别'];
  var en={'个体':'individual objects','集合':'pairs, sets & groups','容器':'containerfuls','度量':'units & measures','时间':'time spans','动作':'counting actions','类别':'kinds & types'};
  var leg=keys.map(function(k){return '<span class="lg"><i style="background:'+CAT_MAP[k]+'"></i>'+k+' · '+en[k]+'</span>';}).join('');
  return '<div class="mw-root mw-intro" data-card-id="{{ID}}"><div class="mw-intro-body">'
   +'<h2>量词 · Measure Words</h2>'
   +'<div class="mw-i-en">Chinese nouns are not counted directly. Between a number (or 这/那/每) and a noun you must put a <b>measure word</b> chosen for that noun — one of the hardest habits for learners to build.</div>'
   +'<div class="mw-i-formula"><b>数词</b><span>+</span><b>量词</b><span>+</span><b>名词</b><span style="color:#8a8f98">number + measure word + noun</span></div>'
   +'<div class="mw-i-sec">基础搭配 · Core collocations</div>'+table
   +'<div class="mw-i-sec">七类量词 · The 7 kinds in this deck</div><div class="mw-legend">'+leg+'</div>'
   +'<div class="mw-i-en" style="margin-top:12px;margin-bottom:0">Every card shows the measure word, its HSK level, an English usage note, typical collocations (一+量+名), and a self-written example sentence.</div>'
   +'</div></div>';}
function renderCard(d, api){
  var col=CAT_MAP[d.category]||'#64748b';
  var chips=(d.collocations||[]).map(function(s){return '<span class="mw-chip">'+esc(s)+'</span>';}).join('');
  var lv=LV_TEXT[d.level]||d.level;
  return '<div class="mw-root" data-card-id="{{ID}}" style="--cat:'+col+'">'
   +'<div class="mw-top"><span class="mw-lv">'+lv+'</span><span class="mw-cat">'+esc(d.category)+'</span>'
   +'<span class="mw-space"></span>'+actionBar(api)+'</div>'
   +'<div class="mw-word">'+esc(d.mw)+'<span class="mw-py">'+esc(d.pinyin)+'</span></div>'
   +'<div class="mw-usage">'+esc(d.usage)+'</div>'
   +'<div class="mw-chips">'+chips+'</div>'
   +'<div class="mw-ex">'+esc(d.example)+'</div>'
   +'<div class="mw-exen">'+esc(d.exampleEn)+'</div>'
   +'</div>';}
window.cardTemplate={
  name:NAME,
  fields:[
    {key:'mw',label:'量词',hideable:false},
    {key:'pinyin',label:'拼音',hideable:true},
    {key:'usage',label:'用法说明',hideable:true},
    {key:'collocations',label:'典型搭配',hideable:true},
    {key:'example',label:'例句',hideable:true},
    {key:'exampleEn',label:'例句译文',hideable:true},
    {key:'level',label:'HSK 等级',hideable:true}
  ],
  render:function(cardHtml,cardData,api){var d=cardData.data||cardData;
    var id=String((cardData.id!=null)?cardData.id:d.item_order);
    var html=(d.type==='intro')?renderIntro():renderCard(d,api||{});
    return html.split('{{ID}}').join(id);},
  init:function(el,cardData,api){var d=cardData.data||cardData;
    el.querySelectorAll('[data-action]').forEach(function(b){
      b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();
        var a=b.getAttribute('data-action');
        if(a==='play'){api.playAudio(d.mw||'');api.track&&api.track('audio_play');}
        else if(a==='mark'){api.toggleMark&&api.toggleMark();api.rerender&&api.rerender();}
        else if(a==='favorite'){api.toggleFavorite&&api.toggleFavorite();api.rerender&&api.rerender();}
      });});}
};
})();
'''

# intro 引导卡（数据真身）
INTRO = {'type': 'intro', 'nameZh': '量词', 'nameEn': 'Measure Words'}

# ---------------------------------------------------------------------------
# preview 外壳
# ---------------------------------------------------------------------------
PAGE_CSS = r'''
:root{--card-bg:#fff;--ink:#2c3140;--line:#e6e4dd}
*{box-sizing:border-box}
body{margin:0;background:#f6f5f1;color:#2c3140;font-family:-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:26px 18px 80px}
header h1{font-size:26px;margin:0 0 6px}
header p{margin:0;color:#6b7280;font-size:14px;line-height:1.7}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 20px}
.legend .lg{display:inline-flex;align-items:center;gap:6px;border:1px solid #ddd8cf;background:#fff;
 border-radius:999px;padding:5px 12px;font-size:13px}
.legend .lg i{width:9px;height:9px;border-radius:50%;display:inline-block}
.dark-toggle{position:fixed;top:14px;right:14px;z-index:9;border:1px solid #ddd8cf;background:#fff;
 border-radius:999px;padding:6px 14px;font-size:13px;cursor:pointer;color:#2c3140}
body.dark-mode{--card-bg:#1c1f26;--line:#2a2e38;background:#15171c;color:#e6e8ee}
body.dark-mode header p{color:#9aa3b2}
body.dark-mode .dark-toggle{background:#23262e;color:#d7dbe2;border-color:#333845}
body.dark-mode .legend .lg{background:#1c1f26;border-color:#333845;color:#c3c9d4}
body.dark-mode .mw-root{border-color:#39404d}
body.dark-mode .mw-ex{border-left-color:var(--cat)}
body.dark-mode .mw-intro .mw-intro-body{background:#1c1f26;border-color:#2a2e38}
body.dark-mode .mw-i-formula b{background:#232845;border-color:#39407a}
body.dark-mode .mw-intro td{border-bottom-color:#333845}
'''

def build_preview(cards, counts_txt, total):
    legend_html = ''.join(
        '<span class="lg"><i style="background:%s"></i>%s</span>' % (c[1], c[0] + ' · ' + c[2])
        for c in CATS)
    data = json.dumps(cards, ensure_ascii=False)
    return """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>汉语量词 · Chinese Measure Words · %(total)d 张预览</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
%(page)s
%(card)s
</style>
</head>
<body>
<button class="dark-toggle" onclick="document.body.classList.toggle('dark-mode')">深色</button>
<div class="wrap">
<header>
<h1>汉语量词 · Chinese Measure Words</h1>
<p>%(counts)s · HSK 等级升序 · 搭配与例句自撰<br>每卡：量词 + 拼音 + 英文用法 + 典型搭配 + 例句（平铺阅读）</p>
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
    getCardData: function(){ return {id: i+1, data: d, is_unknown:false, is_favorite:false}; },
    getHiddenFields: function(){ return {}; },
    playAudio: function(t, lang){ try{ var u=new SpeechSynthesisUtterance(t); u.lang = lang || 'zh'; u.rate=0.9; speechSynthesis.speak(u); }catch(e){} },
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
        'page': PAGE_CSS, 'card': CARD_CSS,
        'js': CARD_JS, 'data': data,
    }

# ---------------------------------------------------------------------------
# 数据合并 + 校验 + 写文件
# ---------------------------------------------------------------------------
def load_rows(name):
    with open(os.path.join(DATA, name + '.json'), encoding='utf-8') as f:
        return json.load(f)

def hsk_index():
    with open(HSK_SRC, encoding='utf-8') as f:
        hsk = json.load(f)
    idx = {}
    for x in hsk:
        b = re.sub(r'\d+$', '', x['word'])
        idx.setdefault(b, []).append(x)
    return idx

def main():
    re_cjk = re.compile(r'[\u4e00-\u9fff]')
    idx = hsk_index()

    cards = [dict(INTRO)]
    n_by_level = {}
    warn = []
    last_lv_i = -1
    for fn in FILES:
        for r in load_rows(fn):
            mw = r['mw']
            assert r['level'] in LEVEL_ORDER, mw + ' bad level ' + r['level']
            assert r['category'] in CAT_MAP, mw + ' bad category ' + r['category']
            for k in ('mw', 'pinyin', 'category', 'level', 'usage',
                      'collocations', 'example', 'exampleEn'):
                assert r.get(k) not in (None, ''), mw + ' missing ' + k
            assert isinstance(r['collocations'], list) and len(r['collocations']) >= 3, mw + ' colloc<3'
            for s in r['collocations']:
                assert mw in s, mw + ' colloc lacks mw: ' + s
                assert not re.search(r'[A-Za-z0-9]', s), mw + ' colloc has latin/digit: ' + s
            assert mw in r['example'], mw + ' example lacks mw'
            assert re.search(r'[A-Za-z]{2,}', r['usage']), mw + ' usage lacks English'
            assert not re_cjk.search(r['exampleEn']), mw + ' exampleEn has CJK'
            assert re_cjk.search(r['example']), mw + ' example lacks CJK'

            lv_i = LEVEL_ORDER.index(r['level'])
            assert lv_i >= last_lv_i, (mw, 'level out of order (files must be HSK asc)')
            last_lv_i = lv_i

            # --- HSK 数据集交叉校验 ---
            src = r.get('hsk_word') or r['mw']
            entries = idx.get(src, []) or idx.get(r['mw'], [])
            if r['level'] == 'Extra':
                assert not entries, mw + ' marked Extra but IS in HSK list: ' + str([e['level'] for e in entries])
            else:
                assert entries, mw + ' not in HSK list but level ' + r['level']
                q = [e for e in entries if '量' in (e.get('part_of_speech') or '')]
                if q:
                    # 官方量词条目：level 与 pinyin 必须一致（防多音词标错）
                    ok_lv = any(e['level'] == r['level'] for e in q)
                    assert ok_lv, mw + ' 量-entry levels ' + str([e['level'] for e in q]) + ' != ' + r['level']
                    pys = sorted(set(e['pinyin'] for e in q if e['level'] == r['level']))
                    if pys and not any(p.startswith(r['pinyin']) for p in pys):
                        warn.append('%s pinyin %s vs HSK %s' % (mw, r['pinyin'], pys))
                else:
                    # 名词/动词借用量词：只需该词存在且等级对上（pinyin 仅提示）
                    if not any(e['level'] == r['level'] for e in entries):
                        warn.append('%s level %s but HSK levels %s' % (
                            mw, r['level'], sorted(set(e['level'] for e in entries))))
                    pys = sorted(set(e['pinyin'] for e in entries if e['level'] == r['level']))
                    if pys and not any(p.startswith(r['pinyin']) for p in pys):
                        warn.append('%s pinyin %s vs HSK %s (noun-usage)' % (mw, r['pinyin'], pys))

            n_by_level[r['level']] = n_by_level.get(r['level'], 0) + 1
            card = dict(r)
            card.pop('hsk_word', None)  # 内部校验字段不入卡
            cards.append(card)

    total = len(cards)
    assert MIN_N <= total <= MAX_N, 'target %d-%d, got %d' % (MIN_N, MAX_N, total)
    for i, c in enumerate(cards, 1):
        c['item_order'] = i
    orders = [c['item_order'] for c in cards]
    assert orders == list(range(1, total + 1)), 'item_order broken'

    n_mw = total - 1
    counts_txt = ('%(t)d 张 · 引导 1 + 量词 %(m)d（HSK1 %(l1)s · 2 %(l2)s · 3 %(l3)s · 4 %(l4)s · '
                  '5 %(l5)s · 6 %(l6)s · 7-9 %(l79)s · HSK+ 补充 %(ex)s）'
                  % dict(t=total, m=n_mw,
                         l1=n_by_level.get('1', 0), l2=n_by_level.get('2', 0),
                         l3=n_by_level.get('3', 0), l4=n_by_level.get('4', 0),
                         l5=n_by_level.get('5', 0), l6=n_by_level.get('6', 0),
                         l79=n_by_level.get('7-9', 0), ex=n_by_level.get('Extra', 0)))

    sample_words = ['个', '张', '杯', '次', '斤', '双', '颗', '串']
    sample = [cards[0]] + [c for c in cards[1:] if c['mw'] in sample_words]

    template = {
        'name': NAME,
        'lang': 'zh',
        'description': DESC % {'n': n_mw},
        'cardHtml': CARD_HTML,
        'cardCss': CARD_CSS,
        'cardJs': CARD_JS,
        'trackedActions': [
            {'action': 'audio_play', 'label': '朗读'},
            {'action': 'word_mark', 'label': '标记'},
            {'action': 'favorite_toggle', 'label': '收藏'}
        ],
        'sampleData': sample,
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
    print('Cards:', total, '| measure words:', n_mw, '| by level:', n_by_level)
    print('sampleData:', len(sample), [c.get('mw') or c.get('nameZh') for c in sample])
    if warn:
        print('--- pinyin/level notes (non-fatal) ---')
        for w in warn[:25]:
            print(' *', w)
    else:
        print('pinyin/level cross-check: all consistent')

if __name__ == '__main__':
    main()
