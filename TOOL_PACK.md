# DragonCard 小工具（zip 模板）打包规范

小工具（Tool）是一种**全屏运行的独立 H5 应用**，以 `.zip` 包形式安装到 DragonCard。
它与卡组数据完全分离：本体负责提供数据（分页）、排序、进度、埋点，工具负责全部展示与交互。
运行在**同源新标签页**中（`/v1/tools/<id>/run`），与主应用零 CSS/JS 污染。

## 目录结构

```
tool.zip
├── index.html        # 必需 — 全屏应用入口，必须在 zip 根目录
├── manifest.json     # 必需 — 元数据（名称/描述/期望字段/埋点）
└── assets/           # 你自己的 js/css/图片/字体（相对路径引用）
```

打包时压缩**目录内容**本身（`cd tool && zip -r ../tool.zip .`），确保 `index.html` 在 zip 根目录。

## manifest.json

```json
{
  "name": "单词闪卡工具",
  "description": "分页展示卡组单词，可标记不熟",
  "lang": "zh",
  "icon": "assets/icon.png",
  "fields": ["word", "phonetic_us", "paraphrase_zh"],
  "trackedActions": ["card_flip", "tool_finish"]
}
```

| 字段 | 说明 |
|---|---|
| `name` | 工具名（必填） |
| `description` | 描述 |
| `lang` | 界面语言（zh/en） |
| `icon` | 图标（zip 内相对路径） |
| `fields` | **工具期望的数据字段**——用它在打开时校验卡组数据是否匹配（缺失字段会提示） |
| `trackedActions` | 你会在 `cardAPI.track()` 里用的动作名（≤5 个） |

## 本体桥接：window.cardAPI

`index.html` 加载后，本体注入 `window.cardAPI`。从 URL 查询参数可获得当前卡组：

```js
window.cardAPI.deckId;   // 卡组 id
window.cardAPI.userId;   // 用户 id
```

| 方法 | 说明 |
|---|---|
| `getPage(page, pageSize)` | 分页读取卡组数据（排序+进度），返回 `{cards, total, page, ...}`；`cards[i].data` 为原始字段，`cards[i].id` 为卡项 id |
| `mark(itemId, isUnknown)` | 标记卡项为不熟/掌握（回写学习进度） |
| `favorite(itemId, fav)` | 收藏/取消收藏 |
| `track(action)` | 埋点（观测页可见） |
| `playAudio(text)` | 播报英文（浏览器 TTS） |
| `finish()` | 记录一次工具完成事件 |

示例：

```js
cardAPI.getPage(1).then(function (d) {
  var c = d.cards[0];
  document.querySelector('#word').textContent = c.data.word;
});
document.querySelector('#mark').onclick = function () {
  cardAPI.mark(cards[idx].id, true);
};
```

## 数据接口（本体提供，功能与卡片模板一致）

- 分页数据：`/v1/learn/page?user_id=&deck_id=&page=&page_size=`（经 `cardAPI.getPage`）
- 标记/收藏/埋点均走本体引擎，**学习进度与观测统计完全复用**

## 预置基础库（直接引用，无需打包）

| 库 | 引用 |
|---|---|
| Three.js | `<script src="/static/vendor/three/three.module.js"></script>`（ESM 动态 `import('three')`、`import('three/addons/...')` 也可） |
| Font Awesome | `<link rel="stylesheet" href="/static/vendor/fontawesome/css/all.min.css">` |
| Tailwind | `<script src="/static/vendor/tailwind/tailwind.browser.min.js"></script>` |
| ECharts | `<script src="/static/vendor/echarts/echarts.min.js"></script>` |

> 其它库请**自行打进 zip**（`assets/` 相对路径引用）。不要引用外部 CDN——工具离线运行，外部资源加载不到。

## 字段匹配校验

打开工具时（卡组详情 → 用小工具打开），本体取卡组前几条数据对比 `manifest.fields`，
**缺失字段会提示**「工具需要字段 X，卡组数据缺少，可能无法正常显示」，可确认继续或取消。
工具开发时请按你实际要用的字段声明 `fields`。

## 环境约束

- 脚本：可内联 `<script>`，也可外置 `<script src="./assets/app.js">`；`window` 命名空间协作
- 不要 `import`/`export`（避免 module 加载问题）；可用 ES2017+
- 资源全用相对路径（zip 内）或 `/static/vendor/...`（本体预置）
- 工具与主应用同源但**完全独立文档**：看不到主应用 DOM，主应用样式不会进入工具

## 安装与使用

1. 「小工具」页 →「安装小工具」→ 上传 `tool.zip`
2. 卡组详情（管理弹窗）→ 数据区魔棒按钮「用小工具打开」→ 选工具 → 新标签页全屏运行