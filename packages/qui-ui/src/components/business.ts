import { Fragment, defineComponent, h, onBeforeUnmount, onMounted, provide, ref, watch, type PropType, type VNode } from 'vue'
import OverlayShell from './OverlayShell.vue'
import { quiMotionKey } from './motion-context'
import { QuiButton, QuiTabs } from './primitives'
import type { QuiOption } from '../types'

const flattenFragments = (nodes: VNode[]): VNode[] => nodes.flatMap((node) =>
  node.type === Fragment && Array.isArray(node.children)
    ? flattenFragments(node.children as VNode[])
    : [node],
)

export const QuiPicker = defineComponent({
  name: 'QuiPicker',
  props: {
    show: Boolean,
    title: String,
    columns: { type: Array as PropType<Array<Array<string | QuiOption>>>, default: () => [['选项一', '选项二', '选项三']] },
    modelValue: { type: Array as PropType<Array<string | number>>, default: () => [] },
  },
  emits: ['update:show', 'update:modelValue', 'confirm', 'change'],
  setup(props, { emit }) {
    provide(quiMotionKey, 'slide-bottom')
    const selected = ref([...props.modelValue])
    watch(() => props.modelValue, (value) => { selected.value = [...value] })
    const label = (item: string | QuiOption) => typeof item === 'string' ? item : item.label
    const value = (item: string | QuiOption) => typeof item === 'string' ? item : item.value
    return () => {
      const columns = props.columns.map((column, columnIndex) => h('div', { class: 'qui-picker__column', key: columnIndex }, column.map((item, itemIndex) => h('button', {
        class: ['qui-picker__option', { 'is-selected': selected.value[columnIndex] === value(item) }],
        key: itemIndex,
        onClick: () => { selected.value[columnIndex] = value(item); selected.value = [...selected.value]; emit('change', selected.value) },
      }, label(item)))))
      return h(OverlayShell, { show: props.show, placement: 'bottom', 'onUpdate:show': (v: boolean) => emit('update:show', v) }, { default: () => [
        h('header', { class: 'qui-picker__header' }, [
          h('button', { onClick: () => emit('update:show', false) }, '取消'),
          h('strong', props.title ?? '请选择'),
          h('button', { class: 'is-brand', onClick: () => { emit('update:modelValue', selected.value); emit('confirm', selected.value); emit('update:show', false) } }, '确定'),
        ]),
        h('div', { class: 'qui-picker__columns' }, columns),
      ] })
    }
  },
})

export const QuiArea = defineComponent({
  name: 'QuiArea',
  props: { show: Boolean, title: { type: String, default: '地区选择' }, level: { type: Number, default: 3 }, modelValue: { type: Array as PropType<string[]>, default: () => [] } },
  emits: ['update:show', 'update:modelValue', 'confirm', 'change'],
  setup(props, { emit }) {
    provide(quiMotionKey, 'slide-bottom')
    const regions = ref<Array<{ name: string; adcode: string; children?: Array<{ name: string; adcode: string; children?: Array<{ name: string; adcode: string }> }> }>>([])
    const chosen = ref([...props.modelValue])
    const activeColumn = ref(0)
    watch(() => props.show, async (show) => {
      if (show && !regions.value.length) regions.value = (await import('../data/districts.json')).default
      if (show) chosen.value = [...props.modelValue]
    }, { immediate: true })
    const columns = () => {
      const province = regions.value.find((entry) => entry.name === chosen.value[0]) ?? regions.value[0]
      const city = province?.children?.find((entry) => entry.name === chosen.value[1]) ?? province?.children?.[0]
      return [regions.value, ...(props.level > 1 ? [province?.children ?? []] : []), ...(props.level > 2 ? [city?.children ?? []] : [])]
    }
    const choose = (column: number, name: string) => {
      chosen.value[column] = name
      chosen.value.splice(column + 1)
      const next = columns()[column + 1]?.[0]
      if (next) chosen.value[column + 1] = next.name
      emit('change', [...chosen.value])
    }
    return () => h(OverlayShell, { show: props.show, placement: 'bottom', 'onUpdate:show': (v: boolean) => emit('update:show', v) }, { default: () => [
      h('header', { class: 'qui-picker__header' }, [h('button', { onClick: () => emit('update:show', false) }, '取消'), h('strong', props.title), h('button', { class: 'is-brand', onClick: () => { emit('update:modelValue', [...chosen.value]); emit('confirm', [...chosen.value]); emit('update:show', false) } }, '确定')]),
      h(QuiTabs, { modelValue: activeColumn.value, items: columns().map((_, index) => chosen.value[index] || ['省份', '城市', '地区'][index]), onChange: (value: number) => { activeColumn.value = value } }),
      h('div', { class: 'qui-area__list' }, (columns()[activeColumn.value] ?? []).map((entry) => h('button', { class: { 'is-active': chosen.value[activeColumn.value] === entry.name }, onClick: () => choose(activeColumn.value, entry.name) }, entry.name))),
    ] })
  },
})

export const QuiDatetimePicker = defineComponent({
  name: 'QuiDatetimePicker',
  props: { show: Boolean, title: { type: String, default: '选择时间' }, modelValue: { type: String, default: '' }, mode: { type: String, default: 'date' } },
  emits: ['update:show', 'update:modelValue', 'confirm'],
  setup(props, { emit }) {
    provide(quiMotionKey, 'slide-bottom')
    const now = new Date()
    const value = ref(props.modelValue || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
    return () => h(OverlayShell, { show: props.show, placement: 'bottom', 'onUpdate:show': (v: boolean) => emit('update:show', v) }, { default: () => [
      h('header', { class: 'qui-picker__header' }, [h('button', { onClick: () => emit('update:show', false) }, '取消'), h('strong', props.title), h('button', { class: 'is-brand', onClick: () => { emit('update:modelValue', value.value); emit('confirm', value.value); emit('update:show', false) } }, '确定')]),
      h('input', { class: 'qui-datetime__input', type: props.mode === 'year' ? 'number' : 'date', value: value.value, onInput: (event: Event) => { value.value = (event.target as HTMLInputElement).value } }),
    ] })
  },
})

export const QuiSwiper = defineComponent({
  name: 'QuiSwiper',
  props: { autoplay: Boolean, interval: { type: Number, default: 3000 }, loop: { type: Boolean, default: true }, modelValue: { type: Number, default: 0 } },
  emits: ['update:modelValue', 'change'],
  setup(props, { slots, emit }) {
    const index = ref(props.modelValue)
    const dragStart = ref<number>()
    let timer: ReturnType<typeof setInterval> | undefined
    const setIndex = (next: number, count: number) => {
      const value = props.loop ? (next + count) % count : Math.max(0, Math.min(next, count - 1))
      if (value !== index.value) {
        index.value = value
        emit('update:modelValue', value)
        emit('change', value)
      }
    }
    watch(() => props.modelValue, (value) => { index.value = value })
    onMounted(() => { if (props.autoplay) timer = setInterval(() => setIndex(index.value + 1, Math.max(1, flattenFragments(slots.default?.() ?? []).length)), props.interval) })
    onBeforeUnmount(() => clearInterval(timer))
    return () => {
      const children = flattenFragments(slots.default?.() ?? [])
      return h('div', { class: 'qui-swiper' }, [
        h('div', { class: 'qui-swiper__track', style: { transform: `translate3d(-${index.value * 100}%, 0, 0)` }, onPointerdown: (event: PointerEvent) => { if (event.isPrimary) dragStart.value = event.clientX }, onPointerup: (event: PointerEvent) => { if (dragStart.value !== undefined && Math.abs(event.clientX - dragStart.value) > 32) setIndex(index.value + (event.clientX < dragStart.value ? 1 : -1), children.length); dragStart.value = undefined }, onPointercancel: () => { dragStart.value = undefined } }, children.map((child, i) => h('div', { class: 'qui-swiper__slide', key: i }, [child]))),
        h('div', { class: 'qui-swiper__dots' }, children.map((_, i) => h('button', { class: { 'is-active': i === index.value }, 'aria-label': `第${i + 1}页`, onClick: () => setIndex(i, children.length) }))),
      ])
    }
  },
})

export const QuiSlipDrawer = defineComponent({
  name: 'QuiSlipDrawer',
  props: { actions: { type: Array as PropType<QuiOption[]>, default: () => [{ label: '置顶', value: 'pin' }, { label: '删除', value: 'delete' }] }, open: Boolean },
  emits: ['select', 'update:open'],
  setup(props, { slots, emit }) {
    const start = ref<number>()
    const pointerDown = (event: PointerEvent) => { if (event.isPrimary) start.value = event.clientX }
    const pointerUp = (event: PointerEvent) => {
      if (!event.isPrimary || start.value === undefined) return
      const delta = event.clientX - start.value
      start.value = undefined
      if (Math.abs(delta) > 24) emit('update:open', delta < 0)
    }
    return () => h('div', { class: 'qui-slip', onPointerdown: pointerDown, onPointerup: pointerUp, onPointercancel: () => { start.value = undefined } }, [
      h('div', { class: 'qui-slip__content', style: { transform: props.open ? `translateX(-${props.actions.length * 56}px)` : undefined } }, slots.default?.()),
      h('div', { class: 'qui-slip__actions' }, props.actions.map((action) => h('button', { class: { 'is-danger': action.value === 'delete' }, onClick: () => { emit('select', action); emit('update:open', false) } }, action.label))),
    ])
  },
})

export const QuiInfiniteLoading = defineComponent({
  name: 'QuiInfiniteLoading',
  props: { loading: Boolean, finished: Boolean, text: { type: String, default: '加载中...' } },
  emits: ['load'],
  setup(props, { slots, emit }) {
    const sentinel = ref<HTMLElement>()
    let observer: IntersectionObserver | undefined
    let requested = false
    const load = () => {
      if (!requested && !props.loading && !props.finished) { requested = true; emit('load') }
    }
    watch(() => [props.loading, props.finished] as const, ([loading, finished]) => { if (!loading || finished) requested = false })
    onMounted(() => {
      if ('IntersectionObserver' in window && sentinel.value) {
        observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) load() })
        observer.observe(sentinel.value)
      }
    })
    onBeforeUnmount(() => observer?.disconnect())
    return () => h('div', { class: 'qui-infinite' }, [slots.default?.(), h('div', { class: 'qui-infinite__state', ref: sentinel }, props.finished ? '没有更多了' : props.loading ? props.text : h(QuiButton, { size: 'small', type: 'secondary', onClick: load }, { default: () => '加载更多' }))])
  },
})

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export const QuiIndexes = defineComponent({
  name: 'QuiIndexes',
  props: { items: { type: Object as PropType<Record<string, string[]>>, default: () => ({ A: ['安庆'], B: ['北京', '北海'], C: ['成都', '重庆'] }) } },
  emits: ['select'],
  setup(props, { emit }) {
    return () => h('div', { class: 'qui-indexes' }, [
      h('div', { class: 'qui-indexes__groups' }, Object.entries(props.items).map(([key, entries]) => h('section', { id: `index-${key}`, key }, [h('h3', key), ...entries.map((entry) => h('button', { class: 'qui-indexes__entry', onClick: () => emit('select', entry) }, entry))]))),
      h('nav', { class: 'qui-indexes__bar', 'aria-label': '字母索引' }, alphabet.map((letter) => h('button', { onClick: () => document.getElementById(`index-${letter}`)?.scrollIntoView({ block: 'start' }) }, letter))),
    ])
  },
})
