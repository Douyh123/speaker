import { h, mount } from '../dom.js'

const RATINGS = [
  { v: 'clear', t: '讲明白了', d: '对方听懂，还能自己复述一遍' },
  { v: 'rough', t: '磕磕绊绊', d: '讲完了，但自己不满意' },
  { v: 'failed', t: '没讲清楚', d: '卡住了，或者讲岔了' },
]

export function renderReview(root, app) {
  const { session } = app.state

  // 表单状态放闭包变量里，不每敲一个字就重渲染整棵树（输入框会失焦）
  let rating = session.selfRating || null
  let takeaways = session.takeaways?.length ? [...session.takeaways] : ['', '', '']
  let needsReview = Boolean(session.needsReview)
  let reviewTouched = false
  let pledged = false

  const saveBtn = h('button', {
    class: 'btn btn-primary btn-lg',
    disabled: true,
    on: { click: () => app.archive({ rating, takeaways, needsReview, pledged }) },
  }, '存 档')

  const syncSave = () => { saveBtn.disabled = !rating || !pledged }

  const reviewBox = h('input', {
    type: 'checkbox',
    checked: needsReview,
    on: {
      change: (e) => { needsReview = e.target.checked; reviewTouched = true },
    },
  })

  const pledgeBox = h('input', {
    type: 'checkbox',
    on: { change: (e) => { pledged = e.target.checked; syncSave() } },
  })

  const choiceNodes = RATINGS.map((r) =>
    h(
      'label',
      {
        class: `choice${rating === r.v ? ' sel' : ''}`,
        'data-v': r.v,
        on: {
          click: () => {
            rating = r.v
            for (const n of choiceNodes) n.classList.toggle('sel', n.dataset.v === rating)
            // 自评"没讲清楚"时默认勾上待复习，用户手动改过就不再自动干预
            if (rating === 'failed' && !reviewTouched) {
              needsReview = true
              reviewBox.checked = true
            }
            syncSave()
          },
        },
      },
      h('input', { type: 'radio', name: 'rating', checked: rating === r.v, tabindex: '-1' }),
      h('div', {}, h('div', { class: 't' }, r.t), h('div', { class: 'd' }, r.d))
    )
  )

  const takeawayRows = takeaways.map((val, i) =>
    h(
      'div',
      { class: 'takeaway-row' },
      h('span', { class: 'idx' }, `${i + 1}.`),
      h('input', {
        type: 'text',
        value: val,
        placeholder: i === 0 ? '下次要第一个讲到的点' : '',
        on: { input: (e) => { takeaways[i] = e.target.value } },
      })
    )
  )

  const usedSeconds = session.actualDuration ?? session.plannedDuration
  const usedText = `${Math.floor(usedSeconds / 60)} 分 ${usedSeconds % 60} 秒`

  mount(
    root,
    h(
      'div',
      { class: 'stack' },
      h(
        'div',
        {},
        h('div', { class: 'tiny muted' }, `本轮用时 ${usedText}`),
        h('h2', {}, `复盘 · ${session.termText}`)
      ),

      h(
        'div',
        { class: 'field' },
        h('label', {}, '讲得怎么样？'),
        h('div', { class: 'choices' }, choiceNodes)
      ),

      h(
        'label',
        { class: 'check' },
        pledgeBox,
        h('span', {}, '我已经把这个词讲给别人听了')
      ),

      h(
        'div',
        { class: 'field' },
        h('label', {}, '下次要讲到的点（选填，自己写给自己看）'),
        h('div', { class: 'takeaway-list' }, takeawayRows)
      ),

      h('label', { class: 'check' }, reviewBox, h('span', {}, '加入待复习')),

      h(
        'div',
        { class: 'row', style: 'gap:12px;margin-top:4px' },
        saveBtn,
        h('button', { class: 'btn btn-ghost', on: { click: () => app.skipTerm() } }, '这轮没讲')
      ),

      h(
        'div',
        { class: 'faint tiny center' },
        '必须勾上「已经讲给别人听了」才能存档 —— 这一条是给你自己守的。'
      )
    )
  )

  syncSave()
}
