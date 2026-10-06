import { h, mount } from '../dom.js'
import { createReel } from './reel.js'
import { fillerPool } from '../draw.js'

/**
 * 准备阶段：词条在滚动框里闪过、减速、停住，但计时还没开始。
 * 留这个缓冲是因为用户这会儿正要摊纸笔、开搜索窗口，计时不该在此时吞掉秒数。
 *
 * @param instant 断点恢复传 true，直接落位不重播动画
 */
export function renderReady(root, app, { instant = false } = {}) {
  const { session, rerolls, terms, settings } = app.state
  const minutes = session.plannedDuration / 60

  const startBtn = h(
    'button',
    { class: 'btn btn-primary btn-lg', disabled: true },
    `开始 ${minutes}:00 计时`
  )
  startBtn.addEventListener('click', () => app.begin())

  const swapBtn = h(
    'button',
    { class: 'btn btn-ghost', disabled: true },
    `换一个${rerolls > 0 ? `（已换 ${rerolls} 次）` : ''}`
  )
  swapBtn.addEventListener('click', () => app.reroll())

  const reel = createReel({
    pool: fillerPool({ terms, category: settings.category }),
    target: { term: session.termText },
    instant,
    onSettle() {
      // 滚动期间这两个按钮都锁着：一个会重开滚动，一个会开始计时
      startBtn.disabled = false
      swapBtn.disabled = false
    },
  })

  mount(
    root,
    h(
      'div',
      { class: 'stack' },
      h(
        'div',
        { class: 'row-between' },
        swapBtn,
        h('button', { class: 'btn btn-ghost', on: { click: () => app.goHome() } }, '返回')
      ),

      h(
        'div',
        { class: 'term-stage' },
        h('div', { class: 'term-cat' }, session.category),
        reel.el,
        h('div', { class: 'term-rule' }, '去搜索 · 别问 AI · 用自己的话记下来')
      ),

      h(
        'div',
        { class: 'center' },
        startBtn,
        h(
          'div',
          { class: 'faint tiny', style: 'margin-top:16px' },
          '纸笔摊开了吗？搜索窗口开了吗？'
        )
      )
    )
  )

  return () => reel.destroy()
}
