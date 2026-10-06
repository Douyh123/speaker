import { h, mount, clear } from '../dom.js'
import { categoriesOf } from '../data/terms.js'
import { deleteSession, saveSessions, loadSessions } from '../store.js'
import { heatmapData, termSummary, coveredIds, categoryProgress } from '../stats.js'

const RATING_LABEL = {
  clear: '讲明白了',
  rough: '磕磕绊绊',
  failed: '没讲清楚',
}

const STATUS_LABEL = {
  skipped: '跳过',
  abandoned: '放弃',
}

function ratingOf(s) {
  return STATUS_LABEL[s.status] || RATING_LABEL[s.selfRating] || '—'
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function fmtWhen(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const that = new Date(ts)
  that.setHours(0, 0, 0, 0)
  const diff = Math.round((today - that) / 86400000)

  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (diff === 0) return `今天 ${hm}`
  if (diff === 1) return `昨天 ${hm}`
  if (diff < 7) return `${diff} 天前 ${hm}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
}

function fmtDuration(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`
}

export function renderHistory(root, app) {
  const state = { tab: 'timeline', category: '', rating: '', reviewOnly: false }

  function refresh() {
    app.reloadSessions()
    draw()
  }

  function draw() {
    clear(root)
    mount(root, view(app, state, draw, refresh))
  }

  draw()
}

function view(app, state, draw, refresh) {
  const { sessions, terms } = app.state

  return h(
    'div',
    { class: 'stack' },

    h(
      'div',
      { class: 'row-between' },
      h('h2', {}, '记录'),
      h('button', { class: 'btn btn-ghost', on: { click: () => app.goHome() } }, '返回')
    ),

    h(
      'div',
      { class: 'tab-bar' },
      tab('时间线', state.tab === 'timeline', () => { state.tab = 'timeline'; draw() }),
      tab('按词条', state.tab === 'terms', () => { state.tab = 'terms'; draw() }),
      tab('统计', state.tab === 'stats', () => { state.tab = 'stats'; draw() })
    ),

    state.tab === 'timeline' ? timeline(app, state, sessions, terms, draw, refresh)
      : state.tab === 'terms' ? termView(sessions)
      : statView(sessions, terms)
  )
}

function tab(label, active, onClick) {
  return h('button', { class: `tab${active ? ' active' : ''}`, on: { click: onClick } }, label)
}

// ── 时间线 ────────────────────────────────────────────────

function timeline(app, state, sessions, terms, draw, refresh) {
  const filtered = sessions
    .filter((s) => s.status !== 'ready' && s.status !== 'running')
    .filter((s) => !state.category || s.category === state.category)
    .filter((s) => {
      if (!state.rating) return true
      if (state.rating === 'failed') return s.selfRating === 'failed' || s.needsReview
      return s.selfRating === state.rating && s.status === 'done'
    })
    .sort((a, b) => (b.endedAt || b.startedAt || 0) - (a.endedAt || a.startedAt || 0))

  const select = (value, options, onChange) =>
    h(
      'select',
      { on: { change: (e) => { onChange(e.target.value); draw() } } },
      options.map((o) => h('option', { value: o.v, selected: o.v === value }, o.label))
    )

  // 词库里可能已经删掉了某个分类，但那时候的历史还在 —— 也要能筛出来
  const cats = [...new Set([...categoriesOf(terms), ...sessions.map((s) => s.category)])]
    .filter(Boolean)

  return h(
    'div',
    { class: 'stack' },

    h(
      'div',
      { class: 'filters', style: 'justify-content:flex-start' },
      h('div', { class: 'field' }, h('label', {}, '分类'),
        select(state.category,
          [{ v: '', label: '全部' }, ...cats.map((c) => ({ v: c, label: c }))],
          (v) => { state.category = v })),
      h('div', { class: 'field' }, h('label', {}, '筛选'),
        select(state.rating, [
          { v: '', label: '全部' },
          { v: 'clear', label: '讲明白了' },
          { v: 'rough', label: '磕磕绊绊' },
          { v: 'failed', label: '需复习' },
        ], (v) => { state.rating = v }))
    ),

    filtered.length === 0
      ? h(
          'div',
          { class: 'empty-state' },
          h('div', { class: 'big' }, sessions.length === 0 ? '还没有记录' : '这个筛选下没有记录'),
          h('div', { class: 'sub' },
            sessions.length === 0 ? '抽一个词，讲完回来存档，这里就会长出来。' : '换个筛选条件试试。')
        )
      : h('div', { class: 'hist-list' }, filtered.map((s) => row(app, s, refresh)))
  )
}

function row(app, s, refresh) {
  const detail = h(
    'div',
    { class: 'hist-detail' },

    h('div', { class: 'kv' },
      h('span', { class: 'k' }, '用时'), h('span', {}, fmtDuration(s.actualDuration))),
    h('div', { class: 'kv' },
      h('span', { class: 'k' }, '计划'), h('span', {}, fmtDuration(s.plannedDuration))),

    s.takeaways?.length
      ? h('div', { class: 'kv-block' },
          h('div', { class: 'k' }, '下次要讲到的点'),
          h('ul', { class: 'takeaways' }, s.takeaways.map((t) => h('li', {}, t))))
      : null,

    h('div', { class: 'row', style: 'gap:8px;margin-top:12px' },
      ...['clear', 'rough', 'failed'].map((r) =>
        h('button', {
          class: `btn tiny-btn${s.selfRating === r ? ' is-on' : ''}`,
          on: {
            click: () => {
              s.selfRating = r
              s.status = 'done'
              if (r === 'failed') s.needsReview = true
              const all = loadSessions().map((x) => (x.id === s.id ? s : x))
              saveSessions(all)
              refresh()
            },
          },
        }, RATING_LABEL[r])
      ),
      h('div', { class: 'spacer' }),
      h('button', {
        class: 'btn tiny-btn btn-danger',
        on: {
          click: () => {
            if (!window.confirm(`删掉「${s.termText}」这条记录？`)) return
            deleteSession(s.id)
            refresh()
          },
        },
      }, '删除')
    )
  )

  const node = h(
    'div',
    { class: 'hist-row' },
    h(
      'div',
      {
        class: 'hist-head',
        on: { click: () => node.classList.toggle('open') },
      },
      h('div', { class: 'hist-main' },
        h('div', { class: 'hist-term' }, s.termText),
        h('div', { class: 'hist-meta' },
          `${s.category} · ${fmtWhen(s.endedAt || s.startedAt)} · ${fmtDuration(s.actualDuration)}`)),
      h('div', { class: 'hist-right' },
        h('span', { class: `pill pill-${s.status === 'done' ? (s.selfRating || 'none') : s.status}` },
          ratingOf(s)),
        s.needsReview ? h('span', { class: 'pill pill-flag' }, '待复习') : null)
    ),
    detail
  )

  return node
}

// ── 按词条 ────────────────────────────────────────────────

function termView(sessions) {
  const rows = termSummary(sessions)
    .sort((a, b) => (a.last === 'failed' ? -1 : 0) - (b.last === 'failed' ? -1 : 0) || b.count - a.count)

  if (rows.length === 0) {
    return h('div', { class: 'empty-state' },
      h('div', { class: 'big' }, '还没有讲过任何词'),
      h('div', { class: 'sub' }, '完成一轮讲解后，这里会按词条汇总。'))
  }

  const trendMark = { up: '↑ 在变好', down: '↓ 在变差', flat: '—' }

  return h(
    'div',
    { class: 'hist-list' },
    rows.map((r) =>
      h(
        'div',
        { class: 'hist-row' },
        h('div', { class: 'hist-head static' },
          h('div', { class: 'hist-main' },
            h('div', { class: 'hist-term' }, r.termText),
            h('div', { class: 'hist-meta' },
              `${r.category} · 讲过 ${r.count} 次 · 最近 ${fmtWhen(r.lastAt)}`)),
          h('div', { class: 'hist-right' },
            h('span', { class: `pill pill-${r.last || 'none'}` }, r.last ? RATING_LABEL[r.last] : '—'),
            h('span', { class: `trend trend-${r.trend}` }, trendMark[r.trend]),
            r.needsReview ? h('span', { class: 'pill pill-flag' }, '待复习') : null)
        )
      )
    )
  )
}

// ── 统计 ──────────────────────────────────────────────────

function statView(sessions, terms) {
  const cells = heatmapData(sessions, 90)
  const level = (n) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3)
  const covered = coveredIds(sessions)

  const total = terms.filter((t) => t.enabled !== false).length
  const doneCount = sessions.filter((s) => s.status === 'done').length

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return h(
    'div',
    { class: 'stack' },

    h('div', { class: 'card' },
      h('div', { class: 'tiny muted', style: 'margin-bottom:12px' }, '近 90 天'),
      h('div', { class: 'heat-wrap' },
        h('div', { class: 'heat' },
          weeks.map((w) =>
            h('div', { class: 'heat-col' },
              w.map((c) =>
                h('div', {
                  class: `heat-cell lv${level(c.count)}${c.future ? ' future' : ''}`,
                  title: c.key ? `${c.key}：${c.count} 次` : '',
                })
              ))
          ))),
      h('div', { class: 'heat-legend' },
        h('span', { class: 'faint tiny' }, '少'),
        ...[0, 1, 2, 3].map((l) => h('i', { class: `heat-cell lv${l}` })),
        h('span', { class: 'faint tiny' }, '多'))
    ),

    h('div', { class: 'card' },
      h('div', { class: 'tiny muted', style: 'margin-bottom:14px' },
        `覆盖率 ${covered.size} / ${total} 词 · 累计讲解 ${doneCount} 次`),
      h('div', { class: 'cat-list' },
        categoryProgress({ terms, sessions }).map((r) =>
          h('div', { class: 'cat-row' },
            h('div', { class: 'cat-head' },
              h('span', {}, r.category),
              h('span', { class: 'faint tiny' }, `${r.done} / ${r.total}`)),
            h('div', { class: 'cat-bar' },
              h('i', { style: `width:${r.pct * 100}%` })))
        ))
    )
  )
}
