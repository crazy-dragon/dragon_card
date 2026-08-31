# 皮肤系统 (Skin System)

DragonCard 前端皮肤机制：允许切换界面外观与**两侧空白区域的装饰**。
皮肤完全在前端实现（`static/app.js` + `static/styles.css` + `static/i18n.js`），
通过 `localStorage` 持久化，**不涉及后端**。

## 内置皮肤

| 皮肤 id | 名称 | 深色 | 说明 |
|---------|------|------|------|
| `default` | Default / 默认 | 否 | 亮色主题，无装饰 |
| `dark` | Dark / 深色 | 是 | 深色主题（`body.dark-mode`），无装饰 |
| `ocean` | Ocean / 海洋 | 否 | 海洋蓝配色 + 天空→海面渐变 + 🐬🐠🌊🐟 边缘装饰 |
| `starry` | Starry / 星空 | 是 | 靛蓝夜色配色 + CSS 星点背景 + 🌙✨🌠 边缘装饰 |
| `scifi` | Sci-Fi / 科幻 | 是 | 青色霓虹配色 + CSS 网格背景 + 🛸⚡📡 边缘装饰 |

> 皮肤之间互相独立；切换皮肤会完整替换当前皮肤（含深色状态与装饰）。
> **设计红线**（马里奥皮肤的教训）：皮肤不得修改任何布局尺寸（max-width、
> padding 等），只能覆盖颜色变量 + 设置背景 + 添加 `pointer-events:none`
> 的边缘装饰，确保内容区布局在任何皮肤下完全不变。
> **第二条红线**：皮肤不得覆盖**卡片内容变量**（`--primary`、`--ink`、
> `--card-bg`、`--line`、`--action-btn-bg`、`--amber`、`--unknown` 等——
> 模板 cardCss 使用的变量）。卡组卡片保持用户定义的原样；深色皮肤
> （`dark: true`）下卡片走标准 `body.dark-mode` 变量（模板已适配）。
> 皮肤只覆盖框架变量：`--hp-*`（首页/侧边栏/顶栏）、`--study-sidebar`、
> `--study-content-bg`（学习页框架背景）。

## 入口

首页顶栏的**深色模式按钮**（🌙/☀️）现在打开**皮肤选择面板**，
列出所有内置皮肤与用户自定义皮肤。

- 存储键：`dc-skin-id`（当前皮肤 id）、`dc-dark-theme`（深色状态，兼容旧版）

## 皮肤模型

皮肤定义在 `static/app.js` 的 `SKINS` 对象中：

```js
{
  id:    'mario',                 // 唯一 ID（也用作 body[data-skin] 选择器后缀）
  name:  'Mario',                 // 显示名（回退：可加 t('skin.mario') i18n 文案）
  icon:  'fa-gamepad',            // Font Awesome 图标
  dark:  false,                   // true = 该皮肤启用深色模式（body.dark-mode）
  css:   '/* 注入到 <style id="skin-css"> 的 CSS */',
  html:  '/* 注入到 #skin-deco 装饰层的 HTML 元素 */',
  js:    '/* 可选：应用皮肤时执行的 JS（如动画循环） */'
}
```

## 工作原理

`applySkin()`（`static/app.js`）：

1. 设置 `body.dark-mode` class 与 `body[data-skin="<id>"]` 属性（用于 CSS 作用域）
2. 若有 `css` → 注入 `<style id="skin-css">`；否则清空
3. 若有 `html` → 注入 `<div id="skin-deco">` 装饰层；否则清空
4. 若有 `js` → 执行一次（存为 `_skinJsFn`，切换皮肤时先回收再执行新的）
5. 持久化到 `localStorage`

## 装饰层规则

- **`#skin-deco`**：`position: fixed; inset: 0; z-index: 5; pointer-events: none`
  - 全屏固定层，**不拦截任何点击/交互**
  - 装饰元素请用 `body[data-skin="<id>"] .skin-deco ...` 作用域编写样式
- **只占两侧空白**：内容区有 `max-width` 居中（首页卡组 1200px / 学习 1000px），
  两侧空白放装饰。若装饰需要更多空间，可在皮肤的 `css` 中收窄内容区：
  ```css
  body[data-skin="mario"] .deck-grid { max-width: 820px; }
  body[data-skin="mario"] .study-content { max-width: 720px; }
  ```
- **窄屏自动隐藏**：`@media (max-width: 1240px)` 下 `#skin-deco` 隐藏
  （小屏没有两侧空白），移动端不受影响。

## 添加自定义皮肤

1. 在 `static/app.js` 的 `SKINS` 对象中追加一个 skin 定义（如上面的 `mario`）
2. 在 `static/styles.css` 中用 `body[data-skin="<id>"]` 作用域写装饰样式
3. （可选）在 `static/i18n.js` 添加 `skin.<id>` 中英文案
4. 刷新页面 → 深色模式按钮 → 选择新皮肤

> 装饰元素推荐使用 emoji 或 Font Awesome 图标（无需额外图片资源）。
> 装饰层 `pointer-events: none`，元素可放心放在内容区边缘。

## 当前状态

- 内置：`default`、`dark`
- 正在规划：用户上传自定义皮肤文件（限制最多 5 个，仅本地存储，不共享）