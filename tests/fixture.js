import { createApp, h, reactive } from 'vue'
import * as components from '../packages/qui-ui/dist/index.js'
import '../packages/qui-ui/dist/ui.css'

let app
let state
let instance
const events = []
window.harness = {
  events,
  mount(name, props = {}) {
    app?.unmount()
    events.length = 0
    state = reactive({ ...props })
    const listeners = Object.fromEntries(['update:show', 'update:modelValue', 'change', 'select', 'confirm', 'click'].map(event => [`on${event[0].toUpperCase()}${event.slice(1)}`, (...args) => events.push([event, ...args])]))
    app = createApp({ render: () => {
      if (name === 'stack') return h('div', ['a', 'b'].map(key => h(components.QuiDialog, { show: state[key], title: key, 'onUpdate:show': value => { state[key] = value } })))
      if (name === 'indexes') return h('div', [h(components.QuiIndexes), h(components.QuiIndexes)])
      return h(components[name], { ...state, ...listeners, ref: value => { instance = value } }, state.count === undefined ? undefined : { default: () => Array.from({ length: state.count }, (_, i) => h('div', String(i))) })
    } })
    app.mount('#app')
  },
  update(props) { Object.assign(state, props) },
  retry() { return instance?.retry?.() },
  unmount() { app?.unmount(); app = undefined },
}
