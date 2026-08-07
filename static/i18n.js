/* DragonCard i18n — 中英双语（zh/en） */
(function () {
    'use strict';

    var STORAGE_KEY = 'dc-lang';

    var ZH = {
        /* 导航 */
        'nav.home': '我的卡组',
        'nav.achievements': '成就',
        'nav.stats': '统计',
        'nav.market': '市场',
        'nav.docs': '使用文档',
        'nav.sages': '先贤的智慧',

        /* 主页 */
        'home.title': '我的卡组',
        'home.stat.decks': '卡组总数',
        'home.stat.cards': '卡片总数',
        'home.stat.streak': '连续学习天数',
        'home.empty.title': '还没有卡组',
        'home.empty.desc': '点击 <b>新建卡组</b> 创建你的第一个卡组',
        'home.loading': 'Loading...',
        'home.newDeck': '新建卡组',
        'home.darkMode': '深色模式',
        'home.mastered': '已掌握',
        'home.lastStudied': '—',
        'home.notBound': '未绑定模版',
        'home.active': '当前',
        'home.filterAll': '全部',

        /* 侧边栏切换页标题 */
        'page.achievements': '成就中心',
        'page.stats': '数据统计',
        'page.market': '卡组市场',
        'page.docs': '使用文档',

        /* 通用 */
        'common.cancel': '取消',
        'common.confirm': '确认',
        'common.close': '关闭',
        'common.copy': '复制',
        'common.reset': '重置',
        'common.about': '关于',
        'common.manage': '管理卡组',
        'common.stats': '掌握统计',
        'common.rename': '改名',
        'common.delete': '删除',
        'common.export': '导出',
        'common.import': '导入',
        'common.upload': '上传',
        'common.rename': '改名',
        'common.search': '搜索',
        'common.noData': '暂无数据',
        'common.loading': '加载中…',
        'common.loadFailed': '加载失败',
        'common.retry': '重试',
        'common.name': '名称',
        'common.type': '类型',

        /* 侧边栏研究 */
        'study.back': '返回主页',
        'study.font': '字体设置',
        'study.voice': 'Voice',
        'study.scrollTop': 'Scroll to Top',
        'study.scrollBottom': 'Scroll to Bottom',
        'study.singleCard': 'Single Card',
        'study.refresh': 'Refresh',
        'study.prev': '上一张',
        'study.next': '下一张',
        'study.noTemplate': '该卡组还没有模版，请在管理中上传',
        'study.noDataPage': 'No cards on this page.',
        'study.noData': 'No data yet. Go to Manage to import data for this deck.',
        'study.noTemplateTitle': '&#x26A0;&#xFE0F; This deck has no template. Go to Manage to add one.',
        'study.finish.title': '完成学习？',
        'study.finish.subtitle': '回顾你的学习进度',
        'study.finish.total': '总计',
        'study.finish.unknown': '未掌握',
        'study.finish.continue': '继续学习',
        'study.finish.done': '完成',
        'study.reorder.title': '重排卡片？',
        'study.reorder.desc': '这将打乱所有卡片的顺序。请输入以下短语确认：',
        'study.reorder.phrase': '广修万劫证吾道心',
        'study.reorder.input': '输入上方短语...',

        /* 新建卡组 */
        'newDeck.title': '新建卡组',
        'newDeck.nameLabel': '名称',
        'newDeck.namePlaceholder': '例如：考研核心词',
        'newDeck.kindLabel': '类型',
        'newDeck.hint': '创建后可点击「管理卡组」上传模版与数据',
        'newDeck.create': '创建',
        'newDeck.nameRequired': '请填写名称',
        'newDeck.created': '卡组 "{name}" 已创建',
        'newDeck.failed': 'Create failed',

        /* 类型 kind */
        'kind.language': '语言',
        'kind.knowledge': '知识',
        'kind.logic': '逻辑',
        'kind.skill': '技能',
        'kind.other': '其它',
        'kind.updated': '类型已更新',
        'kind.updateFailed': '更新失败',

        /* 管理卡组 */
        'manage.title': '模板',
        'manage.templates': '模板',
        'manage.data': '数据',
        'manage.max3': '最多 3 个',
        'manage.items': '条数据',
        'manage.uploadData': '上传数据',
        'manage.exportData': '导出数据',
        'manage.goagain': '重新打乱',
        'manage.preview': '预览',
        'manage.previewHint': '点击模板查看渲染效果',
        'manage.previewPlaceholder': '点击左侧模板预览卡片渲染效果',
        'manage.uploadTemplate': '上传模版',
        'manage.replaceTemplate': '替换模版',
        'manage.exportTemplate': '导出模版',
        'manage.setActive': '已设为当前模版',
        'manage.previewFailed': '预览失败',
        'manage.noSample': '暂无样本数据',
        'manage.loadPreviewFailed': '无法加载预览',
        'manage.uploaded': 'Template "{name}" uploaded',
        'manage.uploadFailed': 'Upload failed',
        'manage.imported': 'Imported {n} items',
        'manage.exported': 'Exported {n} items',
        'manage.renamed': '已改名',
        'manage.renameFailed': '改名失败',
        'manage.noDeck': 'Deck not found',
        'manage.templateTitle': '模板 API 参考',
        'manage.kindLabel': '类型',
        'manage.sub': '模版 · 描述',

        /* 卡片操作 */
        'card.play': '朗读',
        'card.mark': '标记',
        'card.favorite': '收藏',
        'card.toggle': '切换',

        /* 成就 */
        'ach.roundTitle': '称号 · 按卡组轮次',
        'ach.roundEmpty': '还没有学习记录，去完成一轮学习吧',
        'ach.roundGet': '完成 1 轮学习获得称号',
        'ach.nextTitle': '下一称号「{name}」· 还需 {n} 轮',
        'ach.maxTitle': '已达最高称号',
        'ach.streak': '持之以恒 · 连续学习',
        'ach.decks': '开疆拓土 · 卡组',
        'ach.interaction': '妙手偶得 · 互动',
        'ach.unlocked': '已达成',
        'ach.notStarted': '未开始',
        'ach.loading': '加载中…',
        'ach.loadFailed': '加载失败',
        'ach.rounds': '{n} 轮',
        'ach.levels': '· {n} 阶',
        'ach.title.round1': '学徒',
        'ach.title.round2': '熟练者',
        'ach.title.round3': '专家',
        'ach.title.round4': '大师',
        'ach.title.round5': '宗师',
        'ach.title.round6': '传奇',
        'ach.title.round7': '神话',
        'ach.streak7': '持之以恒',
        'ach.streak7desc': '连续学习 7 天',
        'ach.streak30': '锲而不舍',
        'ach.streak30desc': '连续学习 30 天',
        'ach.streak60': '学而不厌',
        'ach.streak60desc': '连续学习 60 天',
        'ach.deck1': '开山立派',
        'ach.deck1desc': '创建第 1 个卡组',
        'ach.deck5': '博闻强识',
        'ach.deck5desc': '创建 5 个卡组',
        'ach.deck10000': '藏书万卷',
        'ach.deck10000desc': '累计学会 10000 张卡片',
        'ach.inter1': '金声玉振',
        'ach.inter1desc': '累计发音次数',
        'ach.inter2': '孜孜不倦',
        'ach.inter2desc': '累计标记次数',
        'ach.sectionRound': '🏅 称号 · 按卡组',
        'ach.sectionStreak': '<i class="fa-solid fa-fire"></i> 持之以恒 · 连续学习',
        'ach.sectionDecks': '🛡️ 开疆拓土 · 卡组',
        'ach.sectionInteraction': '🎯 妙手偶得 · 互动',

        /* 掌握统计 */
        'mastery.title': '掌握统计',
        'mastery.heatmap': '热力图',
        'mastery.categorized': '掌握分布',
        'mastery.rounds': '轮次统计',
        'mastery.noCards': '该卡组还没有卡片',
        'mastery.noteHeatmap': '按卡组顺序 · 每行 100 张 · 未学习的卡按已掌握显示',
        'mastery.noteCategorized': '按状态分类：已掌握在前 · 每行 100 张',
        'mastery.legendMastered': '已掌握',
        'mastery.legendUnknown': '未掌握',
        'mastery.noRounds': '还没有学习轮次',
        'mastery.noteRounds': '每轮学习时间与被标记数量 · 中轴对称金字塔',
        'mastery.round': '第 {n} 轮',
        'mastery.loading': '加载中…',
        'mastery.loadFailed': '加载失败',

        /* 统计页 */
        'stats.allDecks': '全卡组',
        'stats.heatmap': '热力图',
        'stats.day': '日',
        'stats.week': '周',
        'stats.month': '月',
        'stats.empty': '选择卡组开始查看统计',
        'stats.noRecords': '暂无学习记录',
        'stats.noRecordsSub': '开始学习后统计将在此显示',
        'stats.noData': '暂无数据',
        'stats.noActions': '暂无操作类型',
        'stats.lastYear': '近一年',
        'stats.activities': '次活动',
        'stats.legend': '活动量',
        'stats.prev': '上一页',
        'stats.next': '下一页',
        'stats.refresh': '刷新',

        /* 关于 */
        'about.tagline': '通用卡片学习框架',
        'about.taglineSub': '用自定义模板学习任何内容',

        /* 模板预览 */
        'preview.title': '模板预览',
        'preview.loading': 'Loading template...',
        'preview.noCard': 'No sample data available.<br><b>Import data</b> into a deck using this template to see a live preview.',
        'preview.failed': 'Failed to load',

        /* 首页弹窗 */
        'toast.reordered': 'Cards reordered successfully!',
        'toast.reorderFailed': 'Failed to reorder',
        'toast.statsRefreshed': 'Stats refreshed',
        'toast.templateImported': 'Template "{name}" imported',
        'toast.templateExported': 'Template exported',
        'toast.templateDeleted': 'Template deleted',
        'toast.deckDeleted': 'Deck deleted',
        'toast.deckSwitchFailed': 'Deck not found',
        'toast.invalidJson': 'Invalid JSON',
        'toast.importFailed': 'Import failed',
        'toast.exportFailed': 'Export failed',
        'toast.copyOk': 'Copied!',
        'toast.returnHome': '返回主页？',

        /* 语音 */
        'voice.noVoices': 'No voices available',
        'voice.selectVoice': 'Select Voice',

        /* 先贤的智慧（提问可翻译，古文不翻译） */
        'sages.q1': '你为何事来？',
        'sages.q2': '你是否迷茫？',
        'sages.q3': '你要做何事？',
        'sages.q4': '桃花源在哪？',
        'sages.q5': '少者的世界？',
    };

    var EN = {
        /* 导航 */
        'nav.home': 'My Decks',
        'nav.achievements': 'Achievements',
        'nav.stats': 'Stats',
        'nav.market': 'Market',
        'nav.docs': 'Docs',
        'nav.sages': 'Wisdom of Sages',

        /* 主页 */
        'home.title': 'My Decks',
        'home.stat.decks': 'Decks',
        'home.stat.cards': 'Cards',
        'home.stat.streak': 'Study Streak',
        'home.empty.title': 'No decks yet',
        'home.empty.desc': 'Click <b>New Deck</b> to create your first deck',
        'home.loading': 'Loading...',
        'home.newDeck': 'New Deck',
        'home.darkMode': 'Dark mode',
        'home.mastered': 'Mastered',
        'home.lastStudied': '—',
        'home.notBound': 'No template',
        'home.active': 'Active',
        'home.filterAll': 'All',

        /* 侧边栏切换页标题 */
        'page.achievements': 'Achievements',
        'page.stats': 'Statistics',
        'page.market': 'Deck Market',
        'page.docs': 'Documentation',

        /* 通用 */
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
        'common.close': 'Close',
        'common.copy': 'Copy',
        'common.reset': 'Reset',
        'common.about': 'About',
        'common.manage': 'Manage deck',
        'common.stats': 'Mastery stats',
        'common.rename': 'Rename',
        'common.delete': 'Delete',
        'common.export': 'Export',
        'common.import': 'Import',
        'common.upload': 'Upload',
        'common.search': 'Search',
        'common.noData': 'No data',
        'common.loading': 'Loading…',
        'common.loadFailed': 'Failed to load',
        'common.retry': 'Retry',
        'common.name': 'Name',
        'common.type': 'Type',

        /* 侧边栏研究 */
        'study.back': 'Back to home',
        'study.font': 'Font size',
        'study.voice': 'Voice',
        'study.scrollTop': 'Scroll to Top',
        'study.scrollBottom': 'Scroll to Bottom',
        'study.singleCard': 'Single Card',
        'study.refresh': 'Refresh',
        'study.prev': 'Previous',
        'study.next': 'Next',
        'study.noTemplate': 'This deck has no template. Upload one in Manage.',
        'study.noDataPage': 'No cards on this page.',
        'study.noData': 'No data yet. Go to Manage to import data for this deck.',
        'study.noTemplateTitle': '&#x26A0;&#xFE0F; This deck has no template. Go to Manage to add one.',
        'study.finish.title': 'Finish Study?',
        'study.finish.subtitle': 'Review your progress',
        'study.finish.total': 'Total',
        'study.finish.unknown': 'Unknown',
        'study.finish.continue': 'Keep studying',
        'study.finish.done': 'Finish',
        'study.reorder.title': 'Reorder Cards?',
        'study.reorder.desc': 'This will shuffle all cards. Type the phrase below to confirm:',
        'study.reorder.phrase': '广修万劫证吾道心',
        'study.reorder.input': 'Type the phrase above...',

        /* 新建卡组 */
        'newDeck.title': 'New Deck',
        'newDeck.nameLabel': 'Name',
        'newDeck.namePlaceholder': 'e.g. GRE Core Words',
        'newDeck.kindLabel': 'Type',
        'newDeck.hint': 'After creating, click "Manage deck" to upload template and data',
        'newDeck.create': 'Create',
        'newDeck.nameRequired': 'Please enter a name',
        'newDeck.created': 'Deck "{name}" created',
        'newDeck.failed': 'Create failed',

        /* 类型 kind */
        'kind.language': 'Language',
        'kind.knowledge': 'Knowledge',
        'kind.logic': 'Logic',
        'kind.skill': 'Skill',
        'kind.other': 'Other',
        'kind.updated': 'Type updated',
        'kind.updateFailed': 'Update failed',

        /* 管理卡组 */
        'manage.title': 'Template',
        'manage.templates': 'Templates',
        'manage.data': 'Data',
        'manage.max3': 'Max 3',
        'manage.items': 'items',
        'manage.uploadData': 'Upload data',
        'manage.exportData': 'Export data',
        'manage.goagain': 'Shuffle',
        'manage.preview': 'Preview',
        'manage.previewHint': 'Click a template to preview',
        'manage.previewPlaceholder': 'Click a template to preview rendering',
        'manage.uploadTemplate': 'Upload template',
        'manage.replaceTemplate': 'Replace template',
        'manage.exportTemplate': 'Export template',
        'manage.setActive': 'Set as active',
        'manage.previewFailed': 'Preview failed',
        'manage.noSample': 'No sample data',
        'manage.loadPreviewFailed': 'Cannot load preview',
        'manage.uploaded': 'Template "{name}" uploaded',
        'manage.uploadFailed': 'Upload failed',
        'manage.imported': 'Imported {n} items',
        'manage.exported': 'Exported {n} items',
        'manage.renamed': 'Renamed',
        'manage.renameFailed': 'Rename failed',
        'manage.noDeck': 'Deck not found',
        'manage.templateTitle': 'Template API Reference',
        'manage.kindLabel': 'Type',
        'manage.sub': 'Template · description',

        /* 卡片操作 */
        'card.play': 'Play',
        'card.mark': 'Mark',
        'card.favorite': 'Favorite',
        'card.toggle': 'Toggle',

        /* 成就 */
        'ach.roundTitle': 'Titles · per deck',
        'ach.roundEmpty': 'No study records yet, complete a round to begin',
        'ach.roundGet': 'Complete 1 round to earn a title',
        'ach.nextTitle': 'Next title "{name}" · {n} more rounds',
        'ach.maxTitle': 'Highest title reached',
        'ach.streak': 'Perseverance · study streak',
        'ach.decks': 'Pioneer · decks',
        'ach.interaction': 'Interaction · actions',
        'ach.unlocked': 'unlocked',
        'ach.notStarted': 'Not started',
        'ach.loading': 'Loading…',
        'ach.loadFailed': 'Failed to load',
        'ach.rounds': '{n} rounds',
        'ach.levels': '· tier {n}',
        'ach.title.round1': 'Apprentice',
        'ach.title.round2': 'Skilled',
        'ach.title.round3': 'Expert',
        'ach.title.round4': 'Master',
        'ach.title.round5': 'Grandmaster',
        'ach.title.round6': 'Legend',
        'ach.title.round7': 'Myth',
        'ach.streak7': 'Perseverant',
        'ach.streak7desc': 'Study 7 days in a row',
        'ach.streak30': 'Relentless',
        'ach.streak30desc': 'Study 30 days in a row',
        'ach.streak60': 'Never tired',
        'ach.streak60desc': 'Study 60 days in a row',
        'ach.deck1': 'Pioneer',
        'ach.deck1desc': 'Create your 1st deck',
        'ach.deck5': 'Well-read',
        'ach.deck5desc': 'Create 5 decks',
        'ach.deck10000': 'Grand library',
        'ach.deck10000desc': 'Master 10000 cards in total',
        'ach.inter1': 'Golden voice',
        'ach.inter1desc': 'Total pronunciations',
        'ach.inter2': 'Diligent',
        'ach.inter2desc': 'Total marks',
        'ach.sectionRound': '🏅 Titles · per deck',
        'ach.sectionStreak': '<i class="fa-solid fa-fire"></i> Perseverance · streak',
        'ach.sectionDecks': '🛡️ Pioneer · decks',
        'ach.sectionInteraction': '🎯 Interaction · actions',

        /* 掌握统计 */
        'mastery.title': 'Mastery',
        'mastery.heatmap': 'Heatmap',
        'mastery.categorized': 'By state',
        'mastery.rounds': 'Rounds',
        'mastery.noCards': 'This deck has no cards',
        'mastery.noteHeatmap': 'Deck order · 100 per row · unstudied shown as mastered',
        'mastery.noteCategorized': 'Grouped by state: mastered first · 100 per row',
        'mastery.legendMastered': 'Mastered',
        'mastery.legendUnknown': 'Unknown',
        'mastery.noRounds': 'No study rounds yet',
        'mastery.noteRounds': 'Study time and marked count per round · symmetric pyramid',
        'mastery.round': 'Round {n}',
        'mastery.loading': 'Loading…',
        'mastery.loadFailed': 'Failed to load',

        /* 统计页 */
        'stats.allDecks': 'All decks',
        'stats.heatmap': 'Heatmap',
        'stats.day': 'Day',
        'stats.week': 'Week',
        'stats.month': 'Month',
        'stats.empty': 'Select a deck to view statistics',
        'stats.noRecords': 'No study records',
        'stats.noRecordsSub': 'Statistics will appear here after you study',
        'stats.noData': 'No data',
        'stats.noActions': 'No action types',
        'stats.lastYear': 'Last year',
        'stats.activities': 'activities',
        'stats.legend': 'Activity',
        'stats.prev': 'Previous',
        'stats.next': 'Next',
        'stats.refresh': 'Refresh',

        /* 关于 */
        'about.tagline': 'A generic flashcard learning framework',
        'about.taglineSub': 'Study anything with custom card templates',

        /* 模板预览 */
        'preview.title': 'Template Preview',
        'preview.loading': 'Loading template...',
        'preview.noCard': 'No sample data available.<br><b>Import data</b> into a deck using this template to see a live preview.',
        'preview.failed': 'Failed to load',

        /* 首页弹窗 */
        'toast.reordered': 'Cards reordered successfully!',
        'toast.reorderFailed': 'Failed to reorder',
        'toast.statsRefreshed': 'Stats refreshed',
        'toast.templateImported': 'Template "{name}" imported',
        'toast.templateExported': 'Template exported',
        'toast.templateDeleted': 'Template deleted',
        'toast.deckDeleted': 'Deck deleted',
        'toast.deckSwitchFailed': 'Deck not found',
        'toast.invalidJson': 'Invalid JSON',
        'toast.importFailed': 'Import failed',
        'toast.exportFailed': 'Export failed',
        'toast.copyOk': 'Copied!',
        'toast.returnHome': 'Back to home?',

        /* 语音 */
        'voice.noVoices': 'No voices available',
        'voice.selectVoice': 'Select Voice',

        /* 先贤的智慧（提问可翻译，古文不翻译） */
        'sages.q1': 'Why have you come?',
        'sages.q2': 'Are you lost?',
        'sages.q3': 'What do you seek?',
        'sages.q4': 'Where is Peach Blossom Spring?',
        'sages.q5': 'A world for the few?',
    };

    var DICTS = { zh: ZH, en: EN };

    function detectLang() {
        var saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
        if (saved === 'zh' || saved === 'en') return saved;
        var navLang = (navigator.language || 'en').toLowerCase();
        if (navLang.indexOf('zh') === 0) return 'zh';
        return 'en';
    }

    var currentLang = detectLang();

    window.i18n = {
        get lang() { return currentLang; },

        setLang: function (lang) {
            if (lang !== 'zh' && lang !== 'en') lang = 'en';
            currentLang = lang;
            try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
        },

        toggle: function () {
            this.setLang(currentLang === 'zh' ? 'en' : 'zh');
            return currentLang;
        },

        /* t(key) → text; t(key, {name: x}) with interpolation */
        t: function (key, vars) {
            var dict = DICTS[currentLang] || EN;
            var s = dict[key] != null ? dict[key] : (DICTS.zh[key] != null ? DICTS.zh[key] : key);
            if (vars) {
                Object.keys(vars).forEach(function (k) {
                    s = s.split('{' + k + '}').join(vars[k]);
                });
            }
            return s;
        }
    };
})();