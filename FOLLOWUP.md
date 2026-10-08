# 后续待办清单（防止遗忘）

本文件记录「模板 → 小工具替换」期间暂缓、待办的事项。完成一项可勾掉。

## 替换（已完成的）
- [x] 备份项目到 `/Users/alfred/CodeBase/Python/dragoncard_backup/`，备份服务在 **5002**（独立 DB 快照，可回滚/对照）
- [x] `Deck.tool_id`：卡组绑定一个 zip 工具（管理页上传 zip 绑定 / 解绑）
- [x] 进入卡组 → 打开绑定工具（全屏新标签页）；未绑定 → 提示去管理页绑定
- [x] 首页卡组卡片显示工具名 + 工具 icon（无 icon 用 kind 默认图标）+ 轮次（未轮回显示"尚未开始"）
- [x] `cardAPI.track(action, itemId)` 带 `deck_item_id`（工具埋点入库）
- [x] 工具存储改文件系统 `minitools/<id>/`（DB 只存元数据 dir_path）；新增重新上传/下载；工具图标（无则默认）
- [x] 移除独立 tools 页与「用小工具打开」选择器（绑定=管理页上传 zip；进入卡组直接开工具）
- [x] 备份 rsync 已 `--exclude='minitools'`（工具目录不随代码备份；工具重传即可）
- [x] **默认卡组迁移**：default_cards 全部 19 个卡组已绑定工具（`tool.zip` + dist `cards.json` + meta 统一工具名）；`primary_english` 移往 `dragoncard_tools/primary-english/`（未提交），`exam_vocab`/`greek-latin-roots` 保留在工具源、不属 default_cards
- [x] **seed_decks.py 工具化**：只导入 `tool.zip` 卡组（建 Deck + 绑工具 + 导数据），不再处理模板
- [x] **文档清理**：删除 `TEMPLATE_PACK.md`、项目内 `.skill/minitool-zip-builder`（保留 `dragoncard_tools/.skill/dragoncard-tool-builder`）；`DB_relation.md` 更新为工具架构；程序内 HowTo 改为「小工具 API 参考」并指引 skill

## 待办（之后做）
- [x] **旧模板清理**：模板渲染代码（templateEngine/createApiForCard/scopeTemplateCss）、`/v1/templates/*`、
  `/v1/decks/:id/templates`、`/v1/decks/:id/preview`、`/v1/templates/:id/preview` 路由已删；observability 改从工具
  tracked_actions 读动作；`t_template`/`t_deck_template` 表 + `t_deck.active_template_id` + `t_learning_event.template_id`
  已迁移删除（DB 7 张表）
- [x] **study 视图移除**：`#study-view` 整块已删（HTML/CSS/JS），含 catalogue/tabs/单卡/3D/相关监听
  （`e9c68b0`）
- [x] **卡组 icon**：从工具 `assets/icon.png`（/svg/jpg/webp）自动检测，替换文件重传即更新；无则默认
  （`7321699` 回退 Deck.icon 输入，改为 assets 自动检测）
- [x] **DB 备份**：已快照到 `backups/dragon_card_20260928_000942.db`
- [x] **dragoncard_tools 独立工程**：已 `git init`（工具源码在 `tools/` 子目录，忽略 dist/_preview/phonemes）
- [x] **README/README_zh**：已改为工具时代（zip 工具 + cardAPI + `/v1/tools`）

## 环境
- 主服务：`5001`（`/Users/alfred/CodeBase/Python/dragoncard`）
- 备份服务：`5002`（`/Users/alfred/CodeBase/Python/dragoncard_backup`）
- 工具源码：`/Users/alfred/CodeBase/Python/dragoncard_tools`（build.py → dist/*.zip；.skill/dragoncard-tool-builder）