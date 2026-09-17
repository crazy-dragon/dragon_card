#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小学初中英语 · 糖果积木版模板打包器（v2）
=============================================
适配初中英语数据格式（word / phonetic_us / paraphrase_en / paraphrase_zh /
examples[数组] / coca_rank / source / form_note），生成两个独立模板：
  template_word_v2.json    单词卡（糖果积木 3D 字母 · 多色板 · 渐变背景）
  template_blocks_v2.json  字母拼拼乐（拼写 · 糖果积木砖 · 多色板）

与 v1 区别：
  - 3D 字母改为「糖果积木」：圆角立体块 + 高光 + 阴影（不靠 SVG 描边，改用
    CSS box-shadow 多层 + 渐变，视觉更厚实、更"糖果"）
  - 保留四线三格但可选（可关闭线格）
  - 内置多套色板，卡内点按钮切换（localStorage 记忆）
  - 卡片背景柔和渐变 + 可选装饰
  - 数据字段按初中英语格式解析

用法：
  python3 _build_v2/build.py            # 生成到 default_cards/primary_english/
  python3 _build_v2/build.py --check    # 只校验
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DECK = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'src')
V1_SRC = os.path.join(os.path.dirname(HERE), '_build', 'src')

HEADER = ('/* v2 糖果积木版 — 由 _build_v2/build.py 自动拼装。 */\n')

TEMPLATES = [
    {
        'file': 'template_word_v2.json',
        'name': '糖果单词卡',
        'description': 'Candy-block word card: big glossy 3D letters on the writing grid, '
                       'tap to hear it; Chinese meaning, phonetic and example shown directly. '
                       'Multiple color themes switchable in-card. 糖果单词卡：立体糖果字母 + 四线三格，'
                       '点读/中文/音标/例句全直显，支持多套色板切换。',
        'html': 'word.html', 'css': 'word.css', 'js': 'word.js',
    },
    {
        'file': 'template_blocks_v2.json',
        'name': '字母拼拼乐',
        'description': 'Spell the word by tapping candy letter bricks into the writing grid. '
                       'Letter-name audio, hint ladder, no penalty. 字母拼拼乐：糖果字母砖拼写单词，点砖听字母名。',
        'html': 'blocks.html', 'css': 'blocks.css', 'js': 'blocks.js',
    },
    {
        'file': 'template_grid.json',
        'name': '光点拼词 · 记忆版',
        'description': 'Memory grid game: watch the word light up, it goes out, then tap the letters in order from memory. '
                       '记忆拼词：看一眼 → 熄灭 → 凭记忆按顺序点亮字母方块。',
        'html': 'grid.html', 'css': 'grid.css', 'js': 'grid.js',
    },
    {
        'file': 'template_grid5.json',
        'name': '光点拼词 · 简版',
        'description': 'Find-the-letter grid: letters shown (upper+lower case) with a few distractors; tap the right one '
                       'to spell. 3 difficulty levels. 找字母拼词：大小写字母 + 干扰，点对拼出单词，三档难度。',
        'html': 'grid5.html', 'css': 'grid.css', 'js': 'grid5.js',
    },
]


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def count_actions(*texts):
    s = set()
    for t in texts:
        s.update(re.findall(r'data-action=["\']([^"\']+)["\']', t))
    return sorted(s)


def main():
    write = '--check' not in sys.argv

    glyphs = read(os.path.join(V1_SRC, 'glyphs.js'))
    core_js = read(os.path.join(SRC, 'core.js'))
    core_css = read(os.path.join(SRC, 'core.css'))

    cards_path = os.path.join(DECK, 'cards.json')
    with open(cards_path, encoding='utf-8') as f:
        cards = json.load(f)

    problems = []
    built = []

    for spec in TEMPLATES:
        html = read(os.path.join(SRC, spec['html']))
        css = read(os.path.join(SRC, spec['css']))
        js = read(os.path.join(SRC, spec['js']))

        card_css = HEADER + core_css.rstrip() + '\n\n' + css.rstrip() + '\n'
        card_js = (('/* glyphs.js —— 复用 v1 生成（见 _build/gen_glyphs.py） */\n' + glyphs.rstrip() + '\n\n')
                   + core_js.rstrip() + '\n\n' + js.rstrip() + '\n')

        # ---- 自检
        if "data-card-id=\"' + cardData.id + '\"" not in js:
            problems.append('%s：render() 根节点缺少 data-card-id' % spec['file'])
        if 'window.cardTemplate' not in js:
            problems.append('%s：没有 window.cardTemplate' % spec['file'])
        if 'window.PK' not in core_js:
            problems.append('core.js：没有暴露 window.PK')
        if 'window.PK_GLYPHS' not in glyphs:
            problems.append('glyphs.js：没有暴露 window.PK_GLYPHS')
        acts = count_actions(html, js)
        if len(acts) > 5:
            problems.append('%s：data-action 有 %d 个（上限 5）：%s' % (spec['file'], len(acts), acts))
        # 字段必须被 cards.json 覆盖
        fields = sorted(set(re.findall(r"key:\s*'([^']+)'", js)))
        card_keys = set()
        for c in cards:
            card_keys.update(c.keys())
        missing = [f for f in fields if f not in card_keys]
        # 只强制 word；释义字段（paraphrase_zh / zh）parseData 兼容两种格式，允许缺失
        if 'word' in fields and 'word' not in card_keys:
            problems.append('%s：cards.json 缺少必需字段 word' % spec['file'])

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

        built.append((spec['file'], len(card_css), len(card_js), len(html), acts, len(fields), missing,
                      len(re.findall(r'@keyframes\s+([\w-]+)', card_css))))

    print('%-24s %8s %8s %7s %-14s %s' % ('模板', 'css', 'js', 'html', 'data-action', '字段'))
    for f, c, j, h, acts, nf, missing, kf in built:
        print('%-24s %8d %8d %7d %-14s %d' % (f, c, j, h, ','.join(acts) or '-', nf))
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