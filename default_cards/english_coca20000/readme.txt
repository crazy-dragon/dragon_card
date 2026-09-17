English Word Card Deck
=========================

Two templates:
- template.json        English Word Card (standard: phonetic + EN/ZH definition + examples)
- template_simple.json English Word Card (Simple) (minimal: no labels, no examples)

Data
----
- cards.json  COCA top 2000 high-frequency words (free sample)

How to use
----------
1. Create a deck, pick a template (standard or simple)
2. Import cards.json
3. Study: pronunciation, mark unknown, favorite, toggle definition

Appearance (simple template)
----------------------------
The simple template uses a light-3D look with an emerald accent:
- 68px round action buttons (56px on the flashcard); they scale with the
  app's card-font-size setting, and wrap onto their own row on narrow screens
- Chinese definitions sit on a warm block, English on a cool one, so you can
  tell them apart without labels
- Dark skins (Dark / Starry / Sci-Fi) are supported — only the accent tint
  changes, the layout is identical
To go back to a plain look, re-import an older template_simple.json or edit
cardCss; the card markup (cardJs) is a separate file and is not affected.

Appearance (standard template)
------------------------------
Same light-3D + emerald look, with care taken for the app's font-size setting:
- The rank badge before the word scales as a whole — font, height, min-width,
  padding, radius all share one factor (`--ew-idx` = --scale-basic x
  --card-font-scale). At 160%/200% the digits stay centred in the pill instead
  of overflowing it. At 100% every value is identical to before, so nothing
  moves.
- The phonetic pill's padding scales with the same factor, keeping the header
  row balanced at large sizes.
- Rank badge, phonetic pill and buttons are all `flex: 0 0 auto`-safe: they
  wrap instead of being squashed when the row gets tight.

------------------------------------------------------------

English Word Card 英文词汇卡组
==============================

两个模板：
- template.json        English Word Card（标准版：音标 + 中英释义 + 例句）
- template_simple.json English Word Card (Simple)（精简版：无标签无例句）

数据
----
- cards.json  COCA 前 2000 高频词（免费示例）

使用
----
1. 新建卡组，选择模板（标准或精简）
2. 导入数据 cards.json
3. 学习：发音、标记生词、收藏、切换释义

外观（精简版）
--------------
精简版是轻立体造型 + 翡翠配色：
- 操作按钮 68px 圆形（闪卡 56px），会跟随应用的卡片字号一起放大，
  窄屏时整组自动换到下一行
- 中文释义走暖色底、英文释义走冷色底，不加标签也能一眼分清
- 支持暗色皮肤（Dark / Starry / Sci-Fi），只换配色不换版式
想退回朴素外观：重新导入旧版 template_simple.json，或直接改 cardCss 即可；
卡片结构在 cardJs 里，是另一个文件，不受影响。

外观（标准版）
--------------
同样是轻立体 + 翡翠，另外照顾了应用的「卡片字号」设置：
- 单词前的序号徽章整体等比缩放 —— 字号、高、最小宽、内边距、圆角共用同一个
  倍率（`--ew-idx` = --scale-basic × --card-font-scale）。字号调到 160%/200%
  时数字稳稳居中在胶囊里，不会再溢出、圆角也不会切到笔画；100% 时逐项等于
  原来的值，版式一动不动。
- 音标胶囊的内边距跟着同一个倍率走，放大后头部一行仍然匀称。
- 序号徽章、音标胶囊都是不可压缩的：一行挤了宁可换行，也不会被压扁。

------------------------------------------------------------

Author: alfred.long@qq.com
