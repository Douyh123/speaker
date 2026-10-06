import './styles.css'

import { h, clear } from './dom.js'
import {
  ensureTerms, saveTerms, loadSessions, loadSettings, saveSettings, saveSessions,
  loadActive, saveActive, clearActive, appendSession, uid,
  clearSessions, clearAll, DEFAULT_SETTINGS,
} from './store.js'
import { drawTerm } from './draw.js'
import { remainingMs, elapsedMs } from './timer.js'
import { requestNotifyPermission } from './alarm.js'

import { renderHome } from './views/home.js'
import { renderReady } from './views/ready.js'
import { renderRunning, showRingOverlay } from './views/running.js'
import { renderReview } from './views/review.js'
import { renderHistory } from './views/history.js'
import { renderLibrary } from './views/library.js'
import { renderSettings } from './views/settings.js'

const root = document.getElementById('app')

// 视图切换时的收尾（计时器 interval、覆盖层），漏掉一个就会留下幽灵定时器
let cleanupFn = null
let overlay = null

const app = {
  state: {
    view: 'home',
    session: null,
    rerolls: 0,
    readyInstant: false,   // true = 断点恢复，滚动框直接落位不重播
    settings: loadSettings(),
    terms: [],
    sessions: [],
  },

  render() {
    if (cleanupFn) { cleanupFn(); cleanupFn = null }
    if (overlay) { overlay.remove(); overlay = null }
    clear(root)
    document.title = '讲明白'

    // 视图可以返回一个收尾函数（停计时器、取消动画）
    switch (app.state.view) {
      case 'home': renderHome(root, app); break
      case 'ready': cleanupFn = renderReady(root, app, { instant: app.state.readyInstant }); break
      case 'running': cleanupFn = renderRunning(root, app); break
      case 'review': renderReview(root, app); break
      case 'history': renderHistory(root, app); break
      case 'library': renderLibrary(root, app); break
      case 'settings': renderSettings(root, app); break
    }
    app.state.readyInstant = false
  },

  toast(msg, kind = '') {
    let host = document.querySelector('.toast-host')
    if (!host) {
      host = h('div', { class: 'toast-host' })
      document.body.append(host)
    }
    const t = h('div', { class: `toast ${kind}` }, msg)
    host.append(t)
    setTimeout(() => t.remove(), 2600)
  },

  patchSettings(patch) {
    Object.assign(app.state.settings, patch)
    saveSettings(app.state.settings)
    app.render()
  },

  // ── 流程 ──────────────────────────────────────────────

  draw() {
    const { terms, sessions, settings } = app.state
    const res = drawTerm({
      terms, sessions,
      mode: settings.drawMode,
      category: settings.category,
    })

    if (!res.term) {
      app.toast(
        res.reason === 'empty-review'
          ? '待复习池是空的 —— 先在复盘里把词标成「待复习」'
          : '词库里没有可抽的词',
        'warn'
      )
      return
    }

    app.state.rerolls = 0
    app.state.session = makeSession(res.term, settings)
    app.state.view = 'ready'
    saveActive(app.state.session)
    app.render()
  },

  reroll() {
    const { terms, sessions, settings, session } = app.state
    const res = drawTerm({
      terms, sessions,
      mode: settings.drawMode,
      category: settings.category,
      excludeId: session?.termId,
    })

    if (!res.term) { app.toast('这个范围内没有别的词了', 'warn'); return }

    app.state.rerolls++
    app.state.session = makeSession(res.term, settings)
    saveActive(app.state.session)
    app.render()
  },

  async begin() {
    const s = app.state.session
    s.status = 'running'
    s.startedAt = Date.now()
    saveActive(s)

    // 申请通知权限要趁现在 —— 用户刚点完按钮，有手势，浏览器才会弹窗
    if (app.state.settings.notify) await requestNotifyPermission()

    app.state.view = 'running'
    app.render()
  },

  timerEnded() {
    const s = app.state.session
    s.endedAt = s.startedAt + s.plannedDuration * 1000
    s.actualDuration = s.plannedDuration
    saveActive(s)
    overlay = showRingOverlay(app)
  },

  goReview() {
    app.state.view = 'review'
    app.render()
  },

  finishEarly() {
    const s = app.state.session
    s.endedAt = Date.now()
    s.actualDuration = Math.max(1, Math.round(elapsedMs(s) / 1000))
    saveActive(s)
    app.goReview()
  },

  abandon() {
    if (!window.confirm('放弃这次？本轮不计入完成数，但会留在记录里。')) return
    const s = app.state.session
    s.status = 'abandoned'
    s.endedAt = Date.now()
    s.actualDuration = s.startedAt ? Math.max(1, Math.round(elapsedMs(s) / 1000)) : 0
    finalize(s)
  },

  skipTerm() {
    if (!window.confirm('这轮没讲？会记为「跳过」。')) return
    const s = app.state.session
    s.status = 'skipped'
    s.endedAt = Date.now()
    s.actualDuration = s.startedAt ? Math.max(1, Math.round(elapsedMs(s) / 1000)) : 0
    finalize(s)
  },

  archive({ rating, takeaways, needsReview, pledged }) {
    const s = app.state.session
    s.status = 'done'
    s.selfRating = rating
    s.needsReview = needsReview
    s.pledged = pledged
    s.takeaways = takeaways.map((t) => t.trim()).filter(Boolean)
    if (!s.endedAt) {
      s.endedAt = Date.now()
      s.actualDuration = s.startedAt ? Math.max(1, Math.round(elapsedMs(s) / 1000)) : 0
    }
    finalize(s)
    app.toast('已存档')
  },

  goHome() {
    app.state.session = null
    app.state.rerolls = 0
    clearActive()
    app.state.view = 'home'
    app.render()
  },

  openHistory() {
    app.state.view = 'history'
    app.render()
  },

  openLibrary() {
    app.state.view = 'library'
    app.render()
  },

  openSettings() {
    app.state.view = 'settings'
    app.render()
  },

  /** 历史页里删掉一条记录后刷新内存里的副本 */
  reloadSessions() {
    app.state.sessions = loadSessions()
  },

  // ── 词库 / 设置（M3） ─────────────────────────────────

  saveTermsNow() {
    saveTerms(app.state.terms)
  },

  saveSettingsNow() {
    saveSettings(app.state.settings)
  },

  clearSessionsNow() {
    clearSessions()
    app.state.sessions = []
  },

  /** 清空全部 → 重新灌内置词库。调用方负责后续跳转。 */
  resetAllNow() {
    clearAll()
    const { terms } = ensureTerms()
    app.state.terms = terms
    app.state.sessions = []
    app.state.settings = loadSettings()
    app.state.session = null
    app.state.rerolls = 0
  },

  /**
   * 导入备份后整体换一份数据。
   * 故意不调 render() —— 调用方（设置页）接着会自己重绘，
   * 这里再渲染一次会多跑一遍而且用的是旧的闭包。
   */
  replaceData({ terms, sessions, settings }) {
    saveTerms(terms)
    saveSessions(sessions)
    saveSettings(settings)
    app.state.terms = terms
    app.state.sessions = sessions
    app.state.settings = { ...DEFAULT_SETTINGS, ...settings }
  },
}

function makeSession(term, settings) {
  return {
    id: uid('s'),
    termId: term.id,
    termText: term.term,      // 快照：词库改了也要能还原当时抽的是什么
    category: term.category,
    startedAt: null,
    endedAt: null,
    plannedDuration: settings.duration,
    actualDuration: null,
    status: 'ready',
    selfRating: null,
    needsReview: false,
    pledged: false,
    notesText: '',
    takeaways: [],
    audience: '',             // M5 再决定是否开机
  }
}

function finalize(session) {
  appendSession(session)
  clearActive()
  app.state.sessions = loadSessions()
  app.state.session = null
  app.state.rerolls = 0
  app.state.view = 'home'
  app.render()
}

/**
 * 启动时恢复。
 * 计时中关掉标签页、系统休眠、浏览器崩溃 —— 都靠这里接住。
 */
function restore() {
  const active = loadActive()
  if (!active) return

  if (active.status === 'ready') {
    app.state.session = active
    app.state.readyInstant = true   // 别重播滚动动画，词直接显示
    app.state.view = 'ready'
    return
  }

  if (active.status !== 'running') {
    clearActive()
    return
  }

  app.state.session = active

  if (remainingMs(active) > 0) {
    app.state.view = 'running'
  } else {
    // 离开期间就已经超时了，直接进复盘
    active.endedAt = active.startedAt + active.plannedDuration * 1000
    active.actualDuration = active.plannedDuration
    saveActive(active)
    app.state.view = 'review'
    setTimeout(() => app.toast('上一轮计时已经结束，去存档', 'warn'), 300)
  }
}

// ── 启动 ────────────────────────────────────────────────

const { terms, added } = ensureTerms()
app.state.terms = terms
app.state.sessions = loadSessions()

// 词库补齐了就顺手存回去（ensureTerms 内部已写，这里只是把引用同步进内存）
if (added > 0) saveTerms(terms)

restore()
app.render()
