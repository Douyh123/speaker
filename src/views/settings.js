import { h, mount, clear } from '../dom.js'
import { storageBytes } from '../store.js'
import {
  makeBackup, parseBackup, applyBackup, downloadBackup, readTextFile,
  backupFileName, backupAgeDays, BACKUP_REMIND_DAYS,
} from '../backup.js'

export function renderSettings(root, app) {
  const state = { mode: 'merge', busy: false }

  function draw() {
    clear(root)
    mount(root, view(app, state, draw))
  }

  draw()
}

function view(app, state, draw) {
  const { terms, sessions, settings } = app.state
  const age = backupAgeDays(settings)
  const bytes = storageBytes()

  const fileInput = h('input', {
    type: 'file',
    accept: '.json,application/json',
    style: 'display:none',
    on: {
      change: (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''   // 允许连续选同一个文件（否则第二次不触发 change）
        onFile(app, state, file, draw)
      },
    },
  })

  return h(
    'div',
    { class: 'stack' },

    h('div', { class: 'row-between' },
      h('h2', {}, '设置'),
      h('button', { class: 'btn btn-ghost', on: { click: () => app.goHome() } }, '返回')),

    // ── 备份 ────────────────────────────────────────────
    h('div', { class: 'card' },
      h('h3', { style: 'margin-bottom:6px' }, '备份'),
      h('div', { class: 'muted tiny', style: 'margin-bottom:14px' },
        age === null
          ? '还没备份过。数据只在这台机器的浏览器里，清了就没了。'
          : `上次备份：${age === 0 ? '今天' : `${age} 天前`}` +
            (age >= BACKUP_REMIND_DAYS ? '（有点久了）' : '')),

      h('div', { class: 'tiny muted', style: 'margin:12px 0 6px' },
        `导出内容：${terms.length} 条词条 · ${sessions.length} 条记录 · 设置`),

      h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' },
        h('button', {
          class: 'btn btn-primary',
          on: { click: () => onExport(app, draw) },
        }, '导出备份'),
        h('button', {
          class: 'btn',
          on: { click: () => fileInput.click() },
        }, '导入备份'),
        fileInput),

      h('div', { class: 'field', style: 'margin-top:14px' },
        h('label', {}, '导入方式'),
        h('div', { class: 'choices' },
          radio(state, 'merge', '合并（推荐）', '两边都留着，同一条以备份为准'),
          radio(state, 'replace', '覆盖', '丢掉现有数据，完全按备份来'))),

      h('div', { class: 'notice', style: 'margin-top:6px' },
        '备份是一个 JSON 文件，里面是全部数据 —— 词库、历史、设置。',
        h('br'),
        h('span', { class: 'faint tiny' }, '可以放到网盘或另一台机器上，再导入回来。'))
    ),

    // ── 存储 ────────────────────────────────────────────
    h('div', { class: 'card' },
      h('h3', { style: 'margin-bottom:12px' }, '存储'),
      kv('词条', `${terms.length} 条（启用 ${terms.filter((t) => t.enabled !== false).length} 条）`),
      kv('练习记录', `${sessions.length} 条`),
      kv('占用', `${fmtBytes(bytes)}`),
      h('div', { class: 'tiny faint', style: 'margin-top:8px' },
        '浏览器给每个站点的额度通常在 5MB 上下。纯文字数据离写满差得远，' +
        '真正要防的是清缓存或换电脑 —— 那才需要靠备份。')
    ),

    // ── 危险操作 ────────────────────────────────────────
    h('div', { class: 'card' },
      h('h3', { style: 'margin-bottom:12px;color:var(--danger)' }, '危险操作'),

      h('div', { class: 'row-between', style: 'align-items:flex-start' },
        h('div', {},
          h('div', {}, '清空练习记录'),
          h('div', { class: 'tiny muted' }, '词库和设置留着，只删历史。')),
        h('button', {
          class: 'btn tiny-btn btn-danger',
          on: { click: () => onClearSessions(app, draw) },
        }, '清空')),

      h('div', { class: 'row-between', style: 'align-items:flex-start;margin-top:16px' },
        h('div', {},
          h('div', {}, '清空所有数据'),
          h('div', { class: 'tiny muted' }, '词库回到内置 80 个，历史全没，设置回默认。')),
        h('button', {
          class: 'btn tiny-btn btn-danger',
          on: { click: () => onClearAll(app, draw) },
        }, '清空'))
    )
  )
}

function radio(state, value, label, desc) {
  return h('label', { class: `choice${state.mode === value ? ' sel' : ''}` },
    h('input', {
      type: 'radio',
      name: 'import-mode',
      checked: state.mode === value,
      on: {
        change: (e) => {
          state.mode = value
          // 只切换选中样式，不整页重绘 —— 重绘会把「导入方式」的滚动位置弹回去
          const host = e.target.closest('.choices')
          host?.querySelectorAll('.choice').forEach((n) => n.classList.remove('sel'))
          e.target.closest('.choice')?.classList.add('sel')
        },
      },
    }),
    h('div', {},
      h('div', { class: 't' }, label),
      h('div', { class: 'd' }, desc)))
}

function kv(k, v) {
  return h('div', { class: 'kv' }, h('span', { class: 'k' }, k), h('span', {}, v))
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

// ── 动作 ──────────────────────────────────────────────────

function onExport(app, draw) {
  const data = makeBackup({
    terms: app.state.terms,
    sessions: app.state.sessions,
    settings: app.state.settings,
  })

  downloadBackup(data)

  app.state.settings.lastBackupAt = new Date().toISOString()
  app.saveSettingsNow()
  app.toast(`已导出 ${backupFileName()}`)
  draw()
}

async function onFile(app, state, file, draw) {
  if (!file) return

  let text
  try {
    text = await readTextFile(file)
  } catch {
    app.toast('读不了这个文件', 'danger')
    return
  }

  const res = parseBackup(text)
  if (!res.ok) { app.toast(res.error, 'danger'); return }

  const { terms, sessions } = res.data
  const verb = state.mode === 'replace' ? '覆盖' : '合并'
  const warn = state.mode === 'replace'
    ? '\n\n现有的词库、记录、设置都会被换掉，没法撤销。'
    : `\n\n现有 ${app.state.sessions.length} 条记录、${app.state.terms.length} 条词条会保留下来。`

  if (!window.confirm(
    `从备份${verb}？\n备份里有 ${terms.length} 条词条、${sessions.length} 条记录。${warn}`
  )) return

  const next = applyBackup({ data: res.data, current: app.state, mode: state.mode })
  app.replaceData(next)

  app.toast(`已${verb}：${next.terms.length} 词条 / ${next.sessions.length} 记录`)
  draw()
}

function onClearSessions(app, draw) {
  const n = app.state.sessions.length
  if (n === 0) { app.toast('本来就没有记录'); return }
  if (!window.confirm(`清空全部 ${n} 条练习记录？\n词库和设置不动。这一步没法撤销。`)) return

  app.clearSessionsNow()
  app.toast('记录已清空')
  draw()
}

function onClearAll(app, draw) {
  if (!window.confirm('清空所有数据？\n\n词库回到内置 80 个，历史全没，设置回默认。\n没法撤销。')) return
  if (!window.confirm('真的确定？建议先导出备份。')) return

  app.resetAllNow()
  app.toast('已恢复到初始状态', 'warn')
  app.goHome()
}
