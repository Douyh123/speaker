// 极简 DOM 构造器。
// 这个体量不值得引 React/Vue；但也比手拼 innerHTML 强 —— 词条、备注都是
// 用户可编辑的内容，一旦走 innerHTML 就等于开了个 XSS 口子。

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag)

  for (const [key, val] of Object.entries(props || {})) {
    if (val == null || val === false) continue
    if (key === 'class') el.className = val
    else if (key === 'on' && typeof val === 'object') {
      for (const [ev, fn] of Object.entries(val)) el.addEventListener(ev, fn)
    } else if (val === true) el.setAttribute(key, '')
    else el.setAttribute(key, val)
  }

  append(el, children)
  return el
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false || c === '') continue
    if (Array.isArray(c)) append(el, c)
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)))
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild)
}

/** 把一串子节点挂到父节点上（视图复用时用） */
export function mount(parent, ...children) {
  append(parent, children)
  return parent
}
