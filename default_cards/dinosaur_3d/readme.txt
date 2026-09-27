Dinosaur 3D / 3D 恐龙
=====================

Two 3D dinosaur cards (T-Rex, Pteranodon) with real .glb models, plus a
companion web tool that renders them with three.js.

两张 3D 恐龙卡（霸王龙、翼龙），带真实 .glb 模型，配套网页小工具用
three.js 渲染。

Contents / 内容
---------------
- LICENSE          DragonCard Data License v1.0
- cards.json       2 cards: name / model / latin / desc
- tool.zip         companion web tool（配套小工具，导入后绑定本卡组）
- readme.txt       this file

Models / 模型文件
-----------------
The .glb files live in the host app at static/media/:
- trex.glb   (Tyrannosaurus rex 霸王龙)
- ptero.glb  (Pteranodon 翼龙)

模型随宿主应用分发（static/media/），无需手动放置。

Using the tool / 使用小工具
---------------------------
1. Import the deck, then import tool.zip and bind it to this deck
   （导入卡组后导入 tool.zip 并绑定到本卡组）.
2. Drag to rotate, scroll to zoom, double-click to reset;
   auto-rotate resumes after 3s idle.
   （拖拽旋转、滚轮缩放、双击复位；闲置 3 秒回到自动旋转。）
3. Only the most visible stage owns the single WebGL renderer; other
   cards show a placeholder until scrolled into view.
   （全局单 renderer：最可见的卡位认领画面，其余卡位滚动到眼前才换上。）
4. 🔊 reads the Chinese name + description; tap the Latin name to hear
   it in English.
   （🔊 读中文名 + 描述；点拉丁学名按英文读。）

------------------------------------------------------------

3D 恐龙卡组
===========

两张 3D 恐龙卡（霸王龙 Tyrannosaurus rex / 翼龙 Pteranodon），配套网页
小工具用 three.js 渲染真实 .glb 模型。

数据字段：name（中文名）/ model（.glb 地址）/ latin（拉丁学名）/ desc（描述）

Author: alfred.long@qq.com
