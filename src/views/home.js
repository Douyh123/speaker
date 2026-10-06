import { h, mount } from '../dom.js'
import { categoriesOf } from '../data/terms.js'
import { coveredIds, totalDone, streakDays } from '../stats.js'
import { needsBackupReminder, BACKUP_REMIND_DAYS } from '../backup.js'

const DURATIONS = [5, 10, 15, 25, 45]
const MODES = [
  { v: 'unseen', label: '优先未讲过' },
  { v: 'random', label: '纯随机' },
  { v: 'review', label: '待复习优先' },
]

export function renderHome(root, app) {
  const { settings, terms, sessions } = app.state

  const enabled = terms.filter((t) => t.enabled !== false)
  const covered = coveredIds(sessions)
  const coveredCount = enabled.filter((t) => covered.has(t.id)).length
  const done = totalDone(sessions)
  const streak = streakDays(sessions)
  // 抽词用的下拉：只列有启用词条的分类，否则选中了只会抽到空
  const cats = categoriesOf(terms, { enabledOnly: true })

  // 上次选中的分类可能刚被停用/删光了。留着它下拉会显示"全部"但实际抽不到词，
  // 界面对不上状态，所以直接退回全部。
  if (settings.category && !cats.includes(settings.category)) {
    settings.category = null
    app.saveSettingsNow()
  }
  const remindBackup = needsBackupReminder({ settings, sessions })

  const select = (value, options, onChange) =>
    h(
      'select',
      { on: { change: (e) => onChange(e.target.value) } },
      options.map((o) =>
        h('option', { value: o.v, selected: String(o.v) === String(value) }, o.label)
      )
    )

  const view = h(
    'div',
    { class: 'stack' },

    h(
      'div',
      { class: 'topbar' },
      h('div', { class: 'brand' }, '讲明白'),
      h(
        'div',
        { class: 'muted tiny' },
        streak > 0 ? `连续打卡 ${streak} 天` : '还没开始'
      )
    ),

    h(
      'div',
      { class: 'hero' },
      h('button', {
        class: 'btn btn-primary btn-lg',
        on: { click: () => app.draw() },
      }, '抽 一 个 词'),
      h(
        'div',
        { class: 'filters' },
        h(
          'div',
          { class: 'field' },
          h('label', {}, '时长'),
          select(
            settings.duration / 60,
            DURATIONS.map((m) => ({ v: m, label: `${m} 分钟` })),
            (v) => app.patchSettings({ duration: Number(v) * 60 })
          )
        ),
        h(
          'div',
          { class: 'field' },
          h('label', {}, '抽词模式'),
          select(
            settings.drawMode,
            MODES,
            (v) => app.patchSettings({ drawMode: v })
          )
        ),
        h(
          'div',
          { class: 'field' },
          h('label', {}, '分类'),
          select(
            settings.category || '',
            [{ v: '', label: '全部' }, ...cats.map((c) => ({ v: c, label: c }))],
            (v) => app.patchSettings({ category: v || null })
          )
        )
      )
    ),

    h(
      'div',
      { class: 'stats' },
      h(
        'div',
        { class: 'stat' },
        h('div', { class: 'val' }, `${coveredCount}`, h('small', {}, ` / ${enabled.length}`)),
        h('div', { class: 'lbl' }, '已覆盖词数')
      ),
      h(
        'div',
        { class: 'stat' },
        h('div', { class: 'val' }, `${done}`),
        h('div', { class: 'lbl' }, '累计讲解次数')
      )
    ),

    h(
      'div',
      { class: 'notice' },
      `流程：抽词 → 开始计时 → ${settings.duration / 60} 分钟内查资料、记纸质笔记 → 时间到，把它讲给别人听 → 回来存档。`,
      h('br'),
      h('span', { class: 'faint tiny' }, '全程别问 AI。讲得出来才算数。')
    ),

    remindBackup
      ? h('div', { class: 'notice warn' },
          `已经 ${BACKUP_REMIND_DAYS} 天以上没备份了。记录只存在这台机器的浏览器里，清一次缓存就全没了。`,
          h('br'),
          h('button', {
            class: 'btn tiny-btn',
            style: 'margin-top:8px',
            on: { click: () => app.openSettings() },
          }, '去备份'))
      : null,

    h(
      'div',
      { class: 'footer-nav' },
      h('button', {
        class: 'btn btn-ghost',
        on: { click: () => app.openHistory() },
      }, `记录与统计${sessions.length ? `（${sessions.length}）` : ''}`),
      h('button', {
        class: 'btn btn-ghost',
        on: { click: () => app.openLibrary() },
      }, `词库${terms.length ? `（${enabled.length}）` : ''}`),
      h('button', {
        class: 'btn btn-ghost',
        on: { click: () => app.openSettings() },
      }, '设置')
    )
  )

  mount(root, view)
}
