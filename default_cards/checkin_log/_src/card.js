(function () {
    'use strict';

    /* ===================================================================
     * 任务定义 —— 想增删任务、改名，只改这个数组
     *   action : 埋点动作名（英文小写 + 下划线，务必保持稳定）
     *            历史记录靠它归属，改了字 = 老记录不再属于这个任务
     *   label  : 卡片上显示的名字
     *   hint   : 副标题，可留空
     *   图标可换成任意 Font Awesome 类名
     * =================================================================== */
    var TASKS = [
        { action: 'movie_20min',  label: '每日 20 分钟美剧', hint: '看一集，20 分钟', icon: 'fa-tv' },
        { action: 'read_10pages', label: '阅读 10 页',       hint: '读完 10 页记一笔', icon: 'fa-book-open' }
    ];

    var WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    /* 预览页（file://）直连本地服务；应用内走相对路径 */
    var API_BASE = (location.protocol === 'file:') ? 'http://localhost:5001' : '';

    /* 列表模式一页会渲染几十张卡，请求必须共享去重 */
    var _heat = {}, _heatQ = {}, _day = {}, _dayQ = {};
    /* 线性排列下"今天"在中间，进页面自动定位一次（每页只做一次） */
    var _autoLocated = false;
    var HEAT_TTL = 60000, DAY_TTL = 30000;

    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function keyOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
    function todayKey() { return keyOf(new Date()); }
    function parseKey(s) { var p = String(s || '').split('-'); return new Date(+p[0], (+p[1]) - 1, +p[2]); }
    function shiftKey(s, n) { var d = parseKey(s); d.setDate(d.getDate() + n); return keyOf(d); }
    function nowHM() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
    function uid() { return (window.state && window.state.userId) || ''; }

    function getJson(path, params) {
        var qs = [], k;
        for (k in params) {
            if (!params.hasOwnProperty(k) || params[k] === '' || params[k] == null) continue;
            qs.push(k + '=' + encodeURIComponent(params[k]));
        }
        return fetch(API_BASE + path + (qs.length ? '?' + qs.join('&') : ''), { credentials: 'same-origin' })
            .then(function (r) { return r.json(); });
    }
    function flush(queue, key, val) {
        var list = queue[key] || [];
        delete queue[key];
        list.forEach(function (fn) { try { fn(val); } catch (e) {} });
    }

    /* 365 天热力图：{ 'YYYY-MM-DD': { action: count } } —— 活跃/连续/历史卡都靠它 */
    function loadHeat(deckId, cb) {
        var c = _heat[deckId];
        if (c && (Date.now() - c.ts) < HEAT_TTL) { cb(c.map); return; }
        if (_heatQ[deckId]) { _heatQ[deckId].push(cb); return; }
        _heatQ[deckId] = [cb];
        getJson('/v1/observability/data', { view: 'heatmap', deck_id: deckId, user_id: uid() })
            .then(function (d) {
                var map = {};
                ((d && d.data) || []).forEach(function (row) {
                    if (row && row.date) map[row.date] = row.actions || {};
                });
                _heat[deckId] = { ts: Date.now(), map: map };
                flush(_heatQ, deckId, map);
            })
            .catch(function () { flush(_heatQ, deckId, {}); });
    }

    /* 某一天的 15 分钟分桶：{ 'HH:MM': { action: count } } —— 用来显示"几点记的" */
    function loadDay(deckId, date, cb) {
        var key = deckId + '|' + date, c = _day[key];
        if (c && (Date.now() - c.ts) < DAY_TTL) { cb(c.map); return; }
        if (_dayQ[key]) { _dayQ[key].push(cb); return; }
        _dayQ[key] = [cb];
        getJson('/v1/observability/data', { view: 'daily', date: date, deck_id: deckId, user_id: uid() })
            .then(function (d) {
                var map = {};
                ((d && d.data) || []).forEach(function (row) {
                    if (row && row.time) map[row.time] = row.actions || {};
                });
                _day[key] = { ts: Date.now(), map: map };
                flush(_dayQ, key, map);
            })
            .catch(function () { flush(_dayQ, key, {}); });
    }

    function total(actions) { var n = 0, k; for (k in actions) if (actions.hasOwnProperty(k)) n += actions[k]; return n; }
    function isActive(map, date) { return total((map && map[date]) || {}) > 0; }
    function countOf(map, date, action) { return (((map || {})[date] || {})[action]) || 0; }
    function streakEndingAt(map, date) {
        var n = 0, k = date, guard = 0;
        while (guard++ < 400 && isActive(map, k)) { n++; k = shiftKey(k, -1); }
        return n;
    }

    window.cardTemplate = {
        name: 'Check-in Log Card',
        lang: 'zh',
        fields: [
            { key: 'date', label: '日期', hideable: false }
        ],
        trackedActions: TASKS.map(function (t) { return { action: t.action, label: t.label }; }),

        render: function (cardHtml, cardData, api) {
            var cd = (api.getCardData && api.getCardData()) || cardData || {};
            var d = cd.data || {};
            var dateStr = d.date || '';
            var tk = todayKey();
            /* 没有日期字段的卡 = 永远"今天"（一份 cards.json 里只有一张卡时用） */
            var mode = !dateStr ? 'today' : (dateStr === tk ? 'today' : (dateStr > tk ? 'future' : 'past'));
            var dt = dateStr ? parseKey(dateStr) : new Date();
            var html = '';

            html += '<div class="ci-card ci-' + mode + '" data-card-id="' + (cd.id != null ? cd.id : '') +
                    '" data-date="' + dateStr + '" data-mode="' + mode + '">';
            html +=   '<div class="ci-bar"></div>';
            html +=   '<div class="ci-body">';

            /* 头部 */
            html +=     '<div class="ci-head">';
            html +=       '<div class="ci-date">';
            html +=         '<span class="ci-day">' + dt.getDate() + '</span>';
            html +=         '<span class="ci-ym"><b>' + dt.getFullYear() + ' 年 ' + (dt.getMonth() + 1) + ' 月</b>' +
                            '<i>' + WEEK_CN[dt.getDay()] + '</i>' +
                            (mode === 'today' ? '<span class="ci-today-chip">今天</span>' : '') + '</span>';
            html +=       '</div>';
            if (mode !== 'future') {
                /* 今天这张用「航行第 N 天」，历史/未来卡还是「连续 N 天」 */
                html +=   '<div class="ci-streak" data-role="streak" title="连续记录天数">' +
                          (mode === 'today'
                              ? '<i class="fa-solid fa-rocket"></i><em>航行第</em><b>—</b><em>天</em>'
                              : '<i class="fa-solid fa-fire"></i><b>—</b><em>天</em>') +
                          '</div>';
            }
            /* 今天的印记：黑洞挂在头部最右侧（.ci-head 的最后一个子元素），
               所以左边的日期块位置和素卡完全一致 */
            if (mode === 'today') {
                html +=   '<span class="bh" aria-hidden="true">' +
                              '<span class="bh-halo"></span><span class="bh-disk"></span>' +
                              '<span class="bh-arc"></span><span class="bh-core"></span>' +
                          '</span>';
            }
            html +=     '</div>';

            /* 状态行 */
            var status = mode === 'future' ? '待解锁 · 到那天就能记录'
                       : (mode === 'past' ? '这一天没有记录' : '今天还没有记录，点一下点亮一颗星');
            html +=     '<div class="ci-status" data-role="status">' + status + '</div>';

            /* 任务区 */
            if (mode === 'future') {
                html +=   '<div class="ci-lock"><i class="fa-solid fa-lock"></i><span>到那天才会解锁</span></div>';
            } else {
                html +=   '<div class="ci-tasks">';
                TASKS.forEach(function (t) {
                    html += '<div class="ci-task" data-task="' + t.action + '" data-role="task" data-action="log" title="' + t.label + '">' +
                              '<span class="ci-dot"><i class="fa-solid ' + (t.icon || 'fa-circle') + '" data-role="dot-task"></i>' +
                              '<i class="fa-solid fa-check" data-role="dot-check"></i></span>' +
                              '<span class="ci-info"><b>' + t.label + '</b>' + (t.hint ? '<i>' + t.hint + '</i>' : '') + '</span>' +
                              '<span class="ci-right" data-role="right"><b>' + (mode === 'today' ? '点亮' : '—') + '</b></span>' +
                            '</div>';
                });
                html +=   '</div>';
            }
            /* 最近 7 天活跃条（init 里填） */
            if (mode !== 'future') html += '<div class="ci-week" data-role="week"></div>';

            html +=   '</div>';
            html += '</div>';
            return html;
        },

        init: function (cardElement, cardData, api) {
            var cd = (api.getCardData && api.getCardData()) || cardData || {};
            var deckId = (cd.deck_id != null) ? cd.deck_id : (api.cardId != null ? api.cardId : '');
            var dateStr = cardElement.getAttribute('data-date') || '';
            var mode = cardElement.getAttribute('data-mode') || 'today';
            if (!dateStr && mode === 'today') dateStr = todayKey();

            var elStreak = cardElement.querySelector('[data-role="streak"]');
            var elStatus = cardElement.querySelector('[data-role="status"]');
            var elWeek = cardElement.querySelector('[data-role="week"]');
            var elTasks = Array.prototype.slice.call(cardElement.querySelectorAll('[data-role="task"]'));

            var heatMap = {}, dayMap = {};

            function alive() {
                return cardElement.isConnected === undefined
                    ? document.body.contains(cardElement)
                    : cardElement.isConnected;
            }
            function taskEl(action) {
                for (var i = 0; i < elTasks.length; i++) {
                    if (elTasks[i].getAttribute('data-task') === action) return elTasks[i];
                }
                return null;
            }

            function paintTasks() {
                TASKS.forEach(function (t) {
                    var el = taskEl(t.action);
                    if (!el) return;
                    var done = countOf(heatMap, dateStr, t.action) > 0;
                    var time = '';
                    for (var hm in dayMap) {
                        if (dayMap.hasOwnProperty(hm) && dayMap[hm] && dayMap[hm][t.action]) { time = hm; break; }
                    }
                    el.classList.toggle('done', done);
                    var right = el.querySelector('[data-role="right"]');
                    if (right) {
                        if (done) right.innerHTML = '<i class="fa-solid fa-check"></i><b>' + (time || '已记录') + '</b>';
                        else right.innerHTML = '<b>' + (mode === 'today' ? '点亮' : '—') + '</b>';
                    }
                });
            }
            function paintStreak() {
                if (!elStreak) return;
                var idle = (mode === 'today' && !isActive(heatMap, dateStr));
                var ref = isActive(heatMap, dateStr) ? dateStr : shiftKey(dateStr, -1);
                var n = streakEndingAt(heatMap, ref);
                elStreak.classList.toggle('is-idle', idle);
                elStreak.innerHTML = (mode === 'today')
                    ? '<i class="fa-solid fa-rocket"></i><em>航行第</em><b>' + n + '</b><em>天</em>'
                    : '<i class="fa-solid fa-fire"></i><b>' + n + '</b><em>天</em>';
                elStreak.setAttribute('title', (mode === 'today' ? '航行第 ' : '连续 ') + n + ' 天' +
                    (idle && n > 0 ? ' · 今天还没记录' : ''));
            }
            function paintWeek() {
                if (!elWeek) return;
                var html = '', i, k, d, on, cls;
                for (i = 6; i >= 0; i--) {
                    k = shiftKey(dateStr, -i);
                    d = parseKey(k);
                    on = isActive(heatMap, k);
                    cls = 'ci-wd' + (on ? ' on' : '') + (k === dateStr ? ' cur' : '') + (k === todayKey() ? ' now' : '');
                    html += '<div class="' + cls + '" title="' + k + (on ? ' · 有记录' : ' · 无记录') + '">' +
                            '<span>' + WEEK_CN[d.getDay()].charAt(1) + '</span><i></i></div>';
                }
                elWeek.innerHTML = html;
            }
            function paintStatus() {
                if (!elStatus) return;
                var n = 0;
                TASKS.forEach(function (t) { if (countOf(heatMap, dateStr, t.action) > 0) n++; });
                var txt;
                if (mode === 'future') txt = '待解锁 · 到那天就能记录';
                else if (mode === 'today') txt = n ? ('今天已记录 ' + n + ' 项' + (n >= TASKS.length ? ' · 全部完成' : '')) : '今天还没有记录，点一下点亮一颗星';
                else txt = n ? ('当天记录了 ' + n + ' 项') : '这一天没有记录';
                elStatus.textContent = txt;
            }
            function paintAll() { if (!alive()) return; paintTasks(); paintStreak(); paintWeek(); paintStatus(); }

            /* 1) 热力图：任务完成态 + 活跃条 + 连续天数（同页多卡共享一次请求） */
            loadHeat(deckId, function (map) { heatMap = map || {}; paintAll(); });

            /* 2) 当天分桶：把"几点记的"补上（今天立即加载，历史卡可见时再加载） */
            if (mode === 'today') {
                loadDay(deckId, dateStr, function (m) { dayMap = m || {}; paintAll(); });
            } else if (mode === 'past') {
                whenVisible(cardElement, function () {
                    loadDay(deckId, dateStr, function (m) { dayMap = m || {}; paintAll(); });
                });
            }

            /* 3) 线性排列时"今天"在中间：首次进页面自动滚到"今天" */
            if (mode === 'today' && !_autoLocated) {
                _autoLocated = true;
                setTimeout(function () {
                    if (!alive() || !cardElement.parentNode) return;
                    try { cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                    catch (e) { try { cardElement.scrollIntoView(); } catch (e2) {} }
                }, 120);
            }

            /* 4) 打卡：只在"今天"这张卡上可点，且每次都要二次确认（防误触） */
            if (mode !== 'today') return;

            function labelOf(action) {
                for (var i = 0; i < TASKS.length; i++) {
                    if (TASKS[i].action === action) return TASKS[i].label;
                }
                return action;
            }
            /* 应用内是就地小气泡（api.confirmDialog）；预览页没有就退化成原生 confirm */
            function askConfirm(anchor, msg, ok) {
                if (api.confirmDialog) { api.confirmDialog(anchor, msg, ok); return; }
                if (window.confirm && window.confirm(msg)) ok();
            }
            function commit(row, action) {
                row.setAttribute('data-busy', '1');
                api.track(action);                      /* 唯一写入口：一条埋点 */
                if (!heatMap[dateStr]) heatMap[dateStr] = {};
                heatMap[dateStr][action] = (heatMap[dateStr][action] || 0) + 1;
                if (!dayMap[nowHM()]) dayMap[nowHM()] = {};
                dayMap[nowHM()][action] = (dayMap[nowHM()][action] || 0) + 1;
                paintAll();
                row.classList.remove('ci-pop');
                void row.offsetWidth;
                row.classList.add('ci-pop');
                setTimeout(function () { row.removeAttribute('data-busy'); }, 500);
            }
            elTasks.forEach(function (row) {
                row.addEventListener('click', function () {
                    var action = row.getAttribute('data-task');
                    if (!action || row.classList.contains('done')) return;
                    if (row.getAttribute('data-busy')) return;
                    askConfirm(row, '确认记录「' + labelOf(action) + '」？', function () {
                        commit(row, action);
                    });
                });
            });
        }
    };

    /* 元素可见时才回调（避免一页几十张历史卡同时发请求）。不支持 IO 就直接回调。 */
    function whenVisible(el, fn) {
        if (typeof IntersectionObserver === 'undefined') { fn(); return; }
        var done = false, io = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) { fire(); return; }
            }
        }, { rootMargin: '160px' });
        function fire() {
            if (done) return;
            done = true;
            try { io.disconnect(); } catch (e) {}
            fn();
        }
        io.observe(el);
    }
})();
