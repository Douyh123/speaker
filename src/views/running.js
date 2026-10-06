import { h, mount } from '../dom.js'
import { startTimer, formatMMSS } from '../timer.js'
import { beep, speak, notify } from '../alarm.js'

/**
 * 计时中。用户此刻多半在别的标签页搜索，所以这个视图有两条命脉：
 *   1. document.title 同步倒计时 —— 切到别的标签页也能瞄一眼剩余时间
 *   2. 归零时的全屏覆盖层 —— 切回来一眼看到
 */
export function renderRunning(root, app) {
  const { session, settings } = app.state
  const urgentAt = 60_000

  const digits = h('div', { class: 'timer-digits' }, '--:--')
  const barFill = h('i', { style: 'width:0%' })
  const progress = h('div', { class: 'progress' }, barFill)
  const hintLine = h('div', { class: 'hint-line' })

  const thresholds = [300, 60].filter((t) => t * 1000 < session.plannedDuration * 1000)
  if (thresholds.length) {
    hintLine.textContent = `剩余 ${thresholds.map((t) => `${t / 60} 分钟`).join(' 和 ')}时提示你`
  }

  const node = h(
    'div',
    { class: 'stack focus' },
    h(
      'div',
      { class: 'term-stage', style: 'padding-bottom:0' },
      h('div', { class: 'term-cat' }, session.category),
      h('h1', { class: 'term-text', style: 'font-size:clamp(1.6rem,5vw,2.4rem)' }, session.termText)
    ),
    h(
      'div',
      { class: 'center' },
      digits,
      progress,
      hintLine
    ),
    h(
      'div',
      { class: 'row', style: 'justify-content:center;gap:12px;margin-top:8px' },
      h('button', {
        class: 'btn btn-primary',
        on: { click: () => app.finishEarly() },
      }, '我提前讲完了'),
      h('button', {
        class: 'btn btn-danger',
        on: { click: () => app.abandon() },
      }, '放弃这次')
    )
  )

  mount(root, node)

  const stop = startTimer(session, {
    onTick(ms, fraction) {
      const text = formatMMSS(ms)
      digits.textContent = text
      document.title = `${text} · ${session.termText}`
      barFill.style.width = `${Math.min(100, fraction * 100)}%`

      const urgent = ms <= urgentAt
      digits.classList.toggle('urgent', urgent)
      progress.classList.toggle('urgent', urgent)
    },

    onThreshold(sec) {
      hintLine.textContent = `还剩 ${sec / 60} 分钟`
      if (settings.sound) beep({ freq: 660, duration: 0.14, times: 2 })
    },

    onEnd() {
      app.timerEnded()
    },
  })

  return stop
}

/** 计时归零时的全屏覆盖层。不自动跳转 —— 用户可能还要把话讲完。 */
export function showRingOverlay(app) {
  const { session, settings } = app.state

  document.title = `时间到！${session.termText}`

  if (settings.sound) beep({ freq: 880, duration: 0.18, times: 3 })
  if (settings.voice) speak('时间到')
  if (settings.notify) notify('时间到', `该讲「${session.termText}」了`)

  const overlay = h(
    'div',
    { class: 'ring-overlay' },
    h('div', { class: 'ring-title' }, '时间到'),
    h('div', { class: 'ring-sub' }, `现在把「${session.termText}」讲给别人听`),
    h(
      'button',
      {
        class: 'btn btn-primary btn-lg',
        on: { click: () => { overlay.remove(); app.goReview() } },
      },
      '讲完了，去存档'
    ),
    h(
      'button',
      {
        class: 'btn btn-ghost',
        on: { click: () => { overlay.remove(); app.abandon() } },
      },
      '算了，放弃这次'
    )
  )

  document.body.append(overlay)
  return overlay
}
