# 后续待办清单（防止遗忘）

本文件记录「模板 → 小工具替换」期间暂缓、待办的事项。完成一项可勾掉。

## 替换（已完成的）
- [x] 备份项目到 `/Users/alfred/CodeBase/Python/dragoncard_backup/`，备份服务在 **5002**（独立 DB 快照，可回滚/对照）
- [x] `Deck.tool_id`：卡组绑定一个 zip 工具（管理页上传 zip 绑定 / 解绑）
- [x] 进入卡组 → 打开绑定工具（全屏新标签页）；未绑定 → 提示去管理页绑定
- [x] 首页卡组卡片显示工具名 + 工具 icon（无 icon 用 kind 默认图标）
- [x] `cardAPI.track(action, itemId)` 带 `deck_item_id`（工具埋点入库；模板埋点本就正常）
- [x] 主 dragoncard 提交：`434b1ce`

## 待办（之后做）
- [ ] **旧模板清理**：模板渲染路径已不用，`Template`/`DeckTemplate` 数据保留（迁移期）。确定工具稳定后：
  - 清理 `templateEngine`/`createApiForCard`/`scopeTemplateCss` 等模板渲染代码
  - 清理 `t_template`/`t_deck_template` 表（备份后）
  - 清理 `/v1/templates/*`、`/v1/decks/:id/templates` 等路由
- [ ] **study 视图移除**：`#study-view` HTML/CSS 保留但不再进入。稳定后删掉
  （`showStudyView`/`renderStudyPages`/`renderSingleCardStage`/`singleCardNav` 等）
- [ ] **默认卡组迁移**：现有卡组逐个绑定工具（coca20000 → coca-cards 工具等）；未绑定工具前进入会提示
- [ ] **卡组 icon**：当前显示工具 manifest 的 icon；如需卡组自定义 icon（emoji/URL），后续加 `Deck.icon` 字段 + 管理页输入
- [ ] **工具管理页**：小工具页（tools 页）保留；管理页绑定现在只支持"上传 zip"。之后可考虑从已安装工具选择绑定
- [ ] **DB 备份**：替换期间主 DB 已变（绑定了 tool_id）。`backups/` 保留旧备份，必要时再快照
- [ ] **dragoncard_tools 独立工程**：稳定后 `git init` 单独管理（build.py + 工具源码 + dist）
- [ ] **种子/发行**：seed_decks.py 目前导模板；之后考虑打包工具随卡组分发

## 环境
- 主服务：`5001`（`/Users/alfred/CodeBase/Python/dragoncard`）
- 备份服务：`5002`（`/Users/alfred/CodeBase/Python/dragoncard_backup`）
- 工具源码：`/Users/alfred/CodeBase/Python/dragoncard_tools`（build.py → dist/*.zip）
