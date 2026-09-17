#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小学英语（面向小学生）模板打包器
======================================
一份数据 → 两套模板（一个模板只做一件事）：
  template_word.json    小学单词卡（直显 · 大立体字母 · 点读主导）
  template_blocks.json  字母砖拼拼乐（拼写 · 按序拼装）

拼装规则：
  cardCss = core.css + <模板>.css
  cardJs  = glyphs.js + core.js + <模板>.js
  cardHtml = <模板>.html（应用实际不用它，仅供阅读；真正的 DOM 由 cardJs 的 render() 产出）

用法：
  python3 _build/build.py            # 生成到 default_cards/primary_english/
  python3 _build/build.py --check    # 只校验，不写文件
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DECK = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'src')

HEADER = ('/* 本文件由 _build/build.py 自动拼装（core.css/core.js/glyphs.js 为共用部分）。\n'
          '   要改样式或逻辑，请改 _build/src/ 下的源文件后重新运行打包脚本。 */\n')

TEMPLATES = [
    {
        'file': 'template_word.json',
        'name': '小学单词卡',
        'description': 'Primary-school word card: the word stands big in 3D hand-written letters on the four-line grid, '
                       'tap anywhere to hear it, with Chinese meaning, phonetic, syllables and example sentence. '
                       '小学单词卡：大号 3D 立体字母直显在四线三格上，点卡片/大喇叭跟读；'
                       '中文、音标、音节、例句一眼全看到，无揭晓步骤。',
        'html': 'word.html', 'css': 'word.css', 'js': 'word.js',
    },
    {
        'file': 'template_blocks.json',
        'name': '字母砖拼拼乐',
        'description': 'Spell the word by tapping hand-drawn letter tiles into a four-line writing grid. Hint ladder, '
                       'tap a tile to hear its letter name, wrong answers never cost points. '
                       '字母砖拼拼乐：把打乱的字母砖按顺序点进四线三格。五级提示阶梯、点砖读字母名、拼错不扣分。',
        'html': 'blocks.html', 'css': 'blocks.css', 'js': 'blocks.js',
    },
]


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def count_actions(*texts):
    s = set()
    for t in texts:
        s.update(re.findall(r'data-action=["\']([^"\']+)["\']', t))
    return sorted(s)


def main():
    write = '--check' not in sys.argv

    glyphs = read('glyphs.js')
    core_js = read('core.js')
    core_css = read('core.css')

    cards_path = os.path.join(DECK, 'cards.json')
    with open(cards_path, encoding='utf-8') as f:
        cards = json.load(f)

    problems = []
    built = []

    for spec in TEMPLATES:
        html, css, js = read(spec['html']), read(spec['css']), read(spec['js'])

        card_css = HEADER + core_css.rstrip() + '\n\n' + css.rstrip() + '\n'
        card_js = (('/* glyphs.js —— 自动生成，见 _build/gen_glyphs.py */\n' + glyphs.rstrip() + '\n\n')
                   + core_js.rstrip() + '\n\n' + js.rstrip() + '\n')

        # ---- 自检：渲染必须返回带 data-card-id 的根节点，否则 init 永远不会被调用
        if "data-card-id=\"' + cardData.id + '\"" not in js:
            problems.append('%s：render() 根节点缺少 data-card-id' % spec['file'])
        if 'window.cardTemplate' not in js:
            problems.append('%s：没有 window.cardTemplate' % spec['file'])
        if 'window.PK' not in core_js:
            problems.append('core.js：没有暴露 window.PK')
        if 'window.PK_GLYPHS' not in glyphs:
            problems.append('glyphs.js：没有暴露 window.PK_GLYPHS')
        # 四个 api 方法都要用到真实存在的接口
        for need in ('playAudio', 'toggleMark', 'toggleFavorite', 'track'):
            if need in js and need not in core_js:
                pass        # 直接用 api.<name>，无需 core 包装
        acts = count_actions(html, js)
        if len(acts) > 5:
            problems.append('%s：data-action 有 %d 个（上限 5）：%s' % (spec['file'], len(acts), acts))
        # 卡片字段必须都被 cards.json 覆盖（hideable 字段允许缺失）
        fields = sorted(set(re.findall(r"key:\s*'([^']+)'", js)))
        card_keys = set()
        for c in cards:
            card_keys.update(c.keys())
        missing = [f for f in fields if f not in card_keys]
        # word/zh 之类若模板用到就必须有
        for must in ('word', 'zh'):
            if must in fields and must not in card_keys:
                problems.append('%s：cards.json 缺少必需字段 %s' % (spec['file'], must))

        sample = [{k: c.get(k) for k in c if k != 'item_order'} for c in cards[:3]]

        tpl = {
            'name': spec['name'],
            'description': spec['description'],
            'lang': 'en',
            'cardHtml': html,
            'cardCss': card_css,
            'cardJs': card_js,
            'sampleData': sample,
        }

        if write:
            out = os.path.join(DECK, spec['file'])
            with open(out, 'w', encoding='utf-8') as f:
                json.dump(tpl, f, ensure_ascii=False, indent=2)
                f.write('\n')

        built.append((spec['file'], len(card_css), len(card_js), len(html), acts, len(fields),
                      missing, len(re.findall(r'@keyframes\s+([\w-]+)', card_css))))

    print('%-22s %8s %8s %7s %-12s %s' % ('模板', 'css', 'js', 'html', 'data-action', '字段'))
    for f, c, j, h, acts, nf, missing, kf in built:
        print('%-22s %8d %8d %7d %-12s %d' % (f, c, j, h, ','.join(acts) or '-', nf))
        if missing:
            print('        ↳ 未在 cards.json 出现的字段（hideable 可缺）:', ', '.join(missing))
        print('        ↳ @keyframes %d 组' % kf)

    print()
    if problems:
        print('✗ 自检未通过：')
        for p in problems:
            print('   -', p)
        return 1
    print('✓ 自检通过' + ('（已写入 %d 个模板）' % len(built) if write else '（--check 模式，未写文件）'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
