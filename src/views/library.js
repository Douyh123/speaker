import { h, mount, clear } from '../dom.js'
import { categoriesOf } from '../data/terms.js'
import { uid, restoreBuiltinTerms } from '../store.js'

const NEW_CAT = '__new__'

/** 「讲明白」的词库管理：增删改查 + 批量操作 + 恢复内置 */
export function renderLibrary(root, app) {
  const state = {
    q: '',
    category: '',
    selected: new Set(),
    editing: null,   // null = 没开编辑器；其余为 {mode, term}
  }

  // 列表单独有一块宿主，改动只重绘它 —— 搜索框留在原地，光标就不会跳
  let redrawList = () => {}

  function hideEditor() {
    document.querySelectorAll('.modal-host').forEach((n) => n.remove())
  }

  function showEditor() {
    hideEditor()
    if (!state.editing) return

    const ov = editor(app, state, () => {
      state.editing = null
      draw()   // 可能刚新建了一个分类，分类下拉也要跟着更新
    })
    document.body.append(ov)
    ov.querySelector('input')?.focus()
  }

  const ops = {
    openEditor: (mode, term) => { state.editing = { mode, term }; showEditor() },
    redraw: () => redrawList(),   // 只重绘列表：勾选、搜索、批量启停
    full: () => draw(),           // 整页重绘：增删词条后分类下拉也要跟着变
  }

  function draw() {
    hideEditor()
    clear(root)
    const built = view(app, state, ops)
    redrawList = built.redraw
    mount(root, built.node)
    built.redraw()
    showEditor()
  }

  draw()
}

function view(app, state, ops) {
  const cats = categoriesOf(app.state.terms)

  // 搜索框和筛选器留在静态部分 —— 它们一旦被重建，光标就跳到文字末尾，
  // 搜到一半想改个字都别扭。会变的那几块单独放在 listHost 里重绘。
  const listHost = h('div', { class: 'stack', style: 'gap:14px' })

  const redraw = () => {
    clear(listHost)
    mount(listHost, listSection(app, state, ops, redraw))
  }

  const node = h(
    'div',
    { class: 'stack' },

    h(
      'div',
      { class: 'row-between' },
      h('h2', {}, '词库'),
      h('button', { class: 'btn btn-ghost', on: { click: () => app.goHome() } }, '返回')
    ),

    h(
      'div',
      { class: 'filters', style: 'justify-content:flex-start;margin-top:0' },
      h('div', { class: 'field', style: 'flex:1;min-width:180px' },
        h('label', {}, '搜索'),
        h('input', {
          type: 'text',
          value: state.q,
          placeholder: '词条或别名…',
          on: {
            input: (e) => { state.q = e.target.value; redraw() },
          },
        })),
      h('div', { class: 'field' }, h('label', {}, '分类'),
        h('select', {
          on: { change: (e) => { state.category = e.target.value; redraw() } },
        },
          h('option', { value: '', selected: state.category === '' }, '全部'),
          cats.map((c) =>
            h('option', { value: c, selected: c === state.category }, c))
        ))
    ),

    h('div', { class: 'row', style: 'gap:8px' },
      h('button', {
        class: 'btn btn-primary',
        on: { click: () => ops.openEditor('new', null) },
      }, '＋ 新建词条')),

    listHost,

    h('div', { class: 'footer-nav' },
      h('button', {
        class: 'btn btn-ghost',
        on: { click: () => app.openSettings() },
      }, '备份与设置'),
      h('button', {
        class: 'btn btn-ghost',
        on: { click: () => restoreBuiltin(app, redraw) },
      }, '恢复内置词库'))
  )

  return { node, redraw }
}

/** 会随搜索/筛选/勾选变化的部分。重绘只发生在 listHost 内部。 */
function listSection(app, state, ops, redraw) {
  const terms = app.state.terms   // 每次都重取：删词条会换掉这个数组
  const q = state.q.trim().toLowerCase()
  const list = terms.filter((t) => {
    if (state.category && t.category !== state.category) return false
    if (!q) return true
    if (t.term.toLowerCase().includes(q)) return true
    return (t.aliases || []).some((a) => String(a).toLowerCase().includes(q))
  })

  const enabledCount = terms.filter((t) => t.enabled !== false).length
  const allShownSelected = list.length > 0 && list.every((t) => state.selected.has(t.id))
  const inCat = state.category ? terms.filter((t) => t.category === state.category) : null

  return [
    h('div', { class: 'tiny muted' },
      `共 ${terms.length} 条 · 启用 ${enabledCount} 条 · 当前显示 ${list.length} 条`),

    inCat
      ? h('div', { class: 'row', style: 'gap:8px' },
          h('button', {
            class: 'btn tiny-btn',
            on: { click: () => setEnabled(app, inCat, true, redraw) },
          }, `启用「${state.category}」全部`),
          h('button', {
            class: 'btn tiny-btn',
            on: { click: () => setEnabled(app, inCat, false, redraw) },
          }, `停用「${state.category}」全部`))
      : null,

    state.selected.size > 0
      ? h('div', { class: 'bulk-bar' },
          h('span', {}, `已选 ${state.selected.size} 条`),
          h('div', { class: 'spacer' }),
          h('button', {
            class: 'btn tiny-btn',
            on: { click: () => setEnabled(app, selectedTerms(terms, state), true, redraw) },
          }, '启用'),
          h('button', {
            class: 'btn tiny-btn',
            on: { click: () => setEnabled(app, selectedTerms(terms, state), false, redraw) },
          }, '停用'),
          h('button', {
            class: 'btn tiny-btn btn-danger',
            on: { click: () => removeSelected(app, state, ops.full) },
          }, '删除'),
          h('button', {
            class: 'btn tiny-btn',
            on: { click: () => { state.selected.clear(); redraw() } },
          }, '取消'))
      : null,

    list.length === 0
      ? h('div', { class: 'empty-state' },
          h('div', { class: 'big' }, terms.length === 0 ? '词库是空的' : '没搜到'),
          h('div', { class: 'sub' },
            terms.length === 0 ? '点上面的「新建词条」加一个，或去设置里导入备份。' : '换个关键词或分类。'))
      : h('div', { class: 'lib-list' },
          h('label', { class: 'lib-head' },
            h('input', {
              type: 'checkbox',
              checked: allShownSelected,
              on: {
                change: (e) => {
                  if (e.target.checked) list.forEach((t) => state.selected.add(t.id))
                  else list.forEach((t) => state.selected.delete(t.id))
                  redraw()
                },
              },
            }),
            h('span', { class: 'tiny muted' }, '全选当前显示的')),
          list.map((t) => row(app, t, state, ops, redraw))),
  ]
}

// ── 单行 ──────────────────────────────────────────────────

function row(app, t, state, ops, redraw) {
  const checked = state.selected.has(t.id)
  const on = t.enabled !== false

  return h(
    'div',
    { class: `lib-row${on ? '' : ' off'}` },

    h('input', {
      type: 'checkbox',
      checked,
      on: {
        change: (e) => {
          if (e.target.checked) state.selected.add(t.id)
          else state.selected.delete(t.id)
          redraw()
        },
      },
    }),

    h(
      'div',
      { class: 'lib-main' },
      h(
        'div',
        { class: 'lib-term' },
        t.term,
        t.builtin ? h('span', { class: 'pill pill-none' }, '内置') : h('span', { class: 'pill pill-flag' }, '自建')
      ),
      h('div', { class: 'lib-meta' },
        t.category,
        t.aliases?.length ? ` · 别名：${t.aliases.join(' / ')}` : '',
        t.note ? ' · 有备注' : '')
    ),

    h('label', { class: 'switch', title: on ? '已启用' : '已停用' },
      h('input', {
        type: 'checkbox',
        checked: on,
        on: {
          change: (e) => {
            t.enabled = e.target.checked
            app.saveTermsNow()
            // 就地改状态，不整页重绘 —— 免得刚勾完滚动条跳走
            e.target.closest('.lib-row').classList.toggle('off', !t.enabled)
          },
        },
      }),
      h('i')),

    h('button', {
      class: 'btn tiny-btn',
      on: { click: () => ops.openEditor('edit', t) },
    }, '编辑'),

    // 内置词条不给删除按钮：ensureTerms 启动时会把缺失的内置词补回来，
    // 删了下次打开又回来，不如只让停用 —— 停用状态是能存住的。
    t.builtin
      ? null
      : h('button', {
          class: 'btn tiny-btn btn-danger',
          on: { click: () => removeOne(app, t, state, ops.full) },
        }, '删除')
  )
}

// ── 批量操作 ──────────────────────────────────────────────

function selectedTerms(terms, state) {
  return terms.filter((t) => state.selected.has(t.id))
}

function setEnabled(app, targets, value, draw) {
  for (const t of targets) t.enabled = value
  app.saveTermsNow()
  app.toast(value ? '已启用' : '已停用')
  draw()
}

function removeOne(app, t, state, draw) {
  if (!window.confirm(
    `删掉「${t.term}」？\n\n历史记录不受影响，讲过的还能在记录里看到。\n` +
    '想再加回来只能自己新建一条。'
  )) return

  app.state.terms = app.state.terms.filter((x) => x.id !== t.id)
  app.saveTermsNow()
  state.selected.delete(t.id)
  draw()
}

/** 批量删除。内置词条删不掉（启动时会被补回来），只删自建的。 */
function removeSelected(app, state, draw) {
  const targets = app.state.terms.filter((t) => state.selected.has(t.id))
  const removable = targets.filter((t) => !t.builtin)
  const kept = targets.length - removable.length

  if (removable.length === 0) {
    app.toast('选中的都是内置词条，删不了，可以改成停用', 'warn')
    return
  }

  if (!window.confirm(
    `删掉选中的 ${removable.length} 条自建词条？\n\n历史记录不受影响。` +
    (kept > 0 ? `\n内置的 ${kept} 条会留着（内置词条只能停用，不能删）。` : '')
  )) return

  const ids = new Set(removable.map((t) => t.id))
  app.state.terms = app.state.terms.filter((t) => !ids.has(t.id))
  app.saveTermsNow()
  state.selected.clear()
  app.toast(`已删除 ${removable.length} 条${kept > 0 ? `，保留 ${kept} 条内置` : ''}`)
  draw()
}

// ── 编辑器 ────────────────────────────────────────────────

function editor(app, state, onClose) {
  const { mode, term } = state.editing
  const cats = categoriesOf(app.state.terms)

  const draft = {
    term: term?.term ?? '',
    category: term?.category ?? (cats[0] || ''),
    aliases: (term?.aliases ?? []).join(', '),
    note: term?.note ?? '',
    enabled: term ? term.enabled !== false : true,
  }

  const close = () => { overlay.remove(); onClose() }

  const catSelect = h('select', {
    on: {
      change: (e) => {
        const isNew = e.target.value === NEW_CAT
        newCatField.style.display = isNew ? 'flex' : 'none'
        if (isNew) newCatInput.focus()
        else draft.category = e.target.value
      },
    },
  },
    cats.map((c) => h('option', { value: c, selected: c === draft.category }, c)),
    h('option', { value: NEW_CAT }, '＋ 新建分类…'))

  const newCatInput = h('input', {
    type: 'text',
    placeholder: '新分类名称',
    on: { input: (e) => { draft.category = e.target.value } },
  })

  const newCatField = h('div', { class: 'field', style: 'display:none' },
    h('label', {}, '新分类'), newCatInput)

  const err = h('div', { class: 'tiny', style: 'color:var(--danger);min-height:1.2em' })

  const save = () => {
    const name = draft.term.trim()
    const cat = draft.category.trim()
    if (!name) { err.textContent = '词条不能为空'; return }
    if (!cat) { err.textContent = '分类不能为空'; return }

    const clash = app.state.terms.find(
      (t) => t.term === name && t.id !== term?.id)
    if (clash) { err.textContent = `「${name}」已经在了（${clash.category}）`; return }

    const aliases = draft.aliases.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean)

    if (mode === 'new') {
      app.state.terms.push({
        id: uid('u'),
        term: name,
        category: cat,
        aliases,
        note: draft.note.trim(),
        builtin: false,
        enabled: draft.enabled,
        createdAt: Date.now(),
      })
    } else {
      Object.assign(term, {
        term: name,
        category: cat,
        aliases,
        note: draft.note.trim(),
        enabled: draft.enabled,
      })
    }

    app.saveTermsNow()
    app.toast(mode === 'new' ? '已添加' : '已保存')
    close()
  }

  const overlay = h(
    'div',
    {
      class: 'modal-host',
      on: { click: (e) => { if (e.target === overlay) close() } },
    },
    h(
      'div',
      { class: 'modal' },
      h('h3', {}, mode === 'new' ? '新建词条' : '编辑词条'),

      h('div', { class: 'field' },
        h('label', {}, '词条'),
        h('input', {
          type: 'text',
          value: draft.term,
          placeholder: '比如：锚定效应',
          on: { input: (e) => { draft.term = e.target.value } },
        })),

      h('div', { class: 'field' },
        h('label', {}, '分类'),
        catSelect,
        newCatField),

      h('div', { class: 'field' },
        h('label', {}, '别名'),
        h('input', {
          type: 'text',
          value: draft.aliases,
          placeholder: '逗号分隔，只用于搜索',
          on: { input: (e) => { draft.aliases = e.target.value } },
        })),

      h('div', { class: 'field' },
        h('label', {}, '备注'),
        h('textarea', {
          rows: '3',
          placeholder: '来源、易错点…（复盘存档后才看得到）',
          on: { input: (e) => { draft.note = e.target.value } },
        }, draft.note)),

      h('label', { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: draft.enabled,
          on: { change: (e) => { draft.enabled = e.target.checked } },
        }),
        h('span', {}, '参与抽词')),

      err,

      h('div', { class: 'row', style: 'gap:8px;justify-content:flex-end;margin-top:8px' },
        h('button', { class: 'btn', on: { click: close } }, '取消'),
        h('button', { class: 'btn btn-primary', on: { click: save } }, '保存'))
    )
  )

  return overlay
}

// ── 恢复内置 ──────────────────────────────────────────────

export function restoreBuiltin(app, onDone) {
  if (!window.confirm(
    '恢复内置词库？\n\n' +
    '· 内置的 80 个词条：名字、分类、别名、备注改回出厂\n' +
    '· 缺失的内置词条会被补回来\n' +
    '· 你自己加的词条不受影响\n' +
    '· 启用/停用状态不动'
  )) return

  app.state.terms = restoreBuiltinTerms()
  onDone()
  app.toast('已恢复内置词库')
}
