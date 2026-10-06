// 滚动抽词框：词条在框内快速闪过，减速，最后停在一个词上。
//
// 三条容易被忽略但必须处理的：
//   1. 可以点击跳过。每轮都等 5 秒，用三天就会烦。点一下直接落位。
//   2. 尊重 prefers-reduced-motion。开了减弱动效的用户直接落位，不放动画。
//   3. 断点恢复时不重播。刷新页面回到准备阶段，词应该已经在框里停好了，
//      而不是又转 5 秒 —— 那会让人以为刚才那轮白抽了。

import { h } from '../dom.js'

const ITEM_H = 96
const DURATION_MS = 4500
const MIN_STEPS = 30

function pickFiller(pool, prev) {
  if (pool.length === 1) return pool[0]
  let t
  do {
    t = pool[Math.floor(Math.random() * pool.length)]
  } while (t === prev)
  return t
}

export function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/**
 * @param pool   用于填充滚动的词条池（同一分类范围，保证不会滚出无关分类的词）
 * @param target 真正抽中的词，停在最后一格
 * @param instant true = 不播动画，直接落位（断点恢复用）
 * @param onSettle 落位回调
 * @returns { el, skip, destroy }
 */
export function createReel({ pool, target, instant = false, onSettle }) {
  const strip = h('div', { class: 'reel-strip' })

  // 构造滚动序列：随机词打底，最后一格是真正抽中的词
  const steps = Math.max(MIN_STEPS, pool.length)
  let prev = null
  for (let i = 0; i < steps; i++) {
    const t = pickFiller(pool, prev)
    strip.append(h('div', { class: 'reel-item' }, t.term))
    prev = t
  }
  strip.append(h('div', { class: 'reel-item is-target' }, target.term))

  const inner = h('div', { class: 'reel' }, strip)
  const hint = h('div', { class: 'reel-hint' }, '点击可跳过')
  const el = h('div', { class: 'reel-box' }, inner, hint)

  const total = steps * ITEM_H
  let raf = 0
  let settled = false

  function settle() {
    if (settled) return
    settled = true
    cancelAnimationFrame(raf)
    strip.style.transform = `translateY(${-total}px)`
    el.classList.remove('spinning')
    el.classList.add('settled')
    el.style.cursor = ''
    onSettle?.()
  }

  if (instant || prefersReducedMotion()) {
    settle()
    return { el, skip: settle, destroy() {} }
  }

  el.classList.add('spinning')
  el.style.cursor = 'pointer'
  el.addEventListener('click', settle)

  const t0 = performance.now()
  let blurred = false

  function frame(now) {
    const p = Math.min(1, (now - t0) / DURATION_MS)
    // easeOutCubic：开头快得看不清，尾巴慢慢蹭到位
    const eased = 1 - Math.pow(1 - p, 3)
    strip.style.transform = `translateY(${-eased * total}px)`

    // 只在跨过阈值时切一次 class，避免每帧都触发样式重算
    const fast = (1 - p) * (1 - p) * 3 * total / DURATION_MS > 1400
    if (fast !== blurred) {
      blurred = fast
      strip.classList.toggle('fast', fast)
    }

    if (p < 1) raf = requestAnimationFrame(frame)
    else settle()
  }

  raf = requestAnimationFrame(frame)

  return {
    el,
    skip: settle,
    destroy() {
      cancelAnimationFrame(raf)
      el.removeEventListener('click', settle)
    },
  }
}
