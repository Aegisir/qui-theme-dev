<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { QuiReplicaRenderer } from '@qui-theme/ui'
import districts from '../../../../packages/qui-ui/src/data/districts.json'
import { entries, routeFor } from '../catalog'

interface PageVariant { html: string; styles: string[] }
interface RouteVariants { mobile: PageVariant; desktop: PageVariant }
interface ScrollState { path: number[]; top: number; left: number }
interface InteractionState { markup: string; portals: string[]; scrolls?: ScrollState[] }
type InteractionMap = Partial<Record<'mobile' | 'desktop', Record<string, InteractionState>>>
type MotionTiming = Omit<KeyframeAnimationOptions, 'iterations'> & { duration: number; delay: number; iterations: number | 'infinite' }
interface MotionAnimation { id: string; selector: string; index: number; pseudoElement?: string | null; keyframes: Keyframe[]; timing: MotionTiming }
interface AutoplayTrack { selector: string; index: number; rootIndex: number; childCount: number; initialIndex: number; initialDot: number; dotCount: number; delay: number; rest: number; timing: MotionTiming }
interface MotionInteraction { enter?: MotionAnimation[]; leave?: MotionAnimation[]; autoCloseMs?: number; autoplay?: { tracks: AutoplayTrack[] } }
type MotionPhaseMap = Record<string, MotionInteraction>
interface MotionManifest { routes: Record<string, Partial<Record<'mobile' | 'desktop', MotionPhaseMap>>> }
interface ReplicaTarget { element: Element; buttonIndex: number; controlIndex: number; text: string }
interface District { name: string; children?: District[] }
interface PickerGesture { column: HTMLUListElement; startY: number; startOffset: number }
type SlipDrawerSide = 'left' | 'right'
interface SlipDrawerGesture { drawer: HTMLElement; wrapper: HTMLElement; startX: number; startY: number; startOffset: number; leftWidth: number; rightWidth: number }
type BlankPageSettings = [fullscreen: boolean, button: boolean, title: boolean, description: boolean]
let motionRequest: Promise<MotionManifest> | undefined
let infiniteObserver: IntersectionObserver | undefined
let infiniteLoadTimer: number | undefined
let infiniteLoadPending = false
const loadingCircleTimers = new Map<SVGSVGElement, number>()
let loadingDemoProgress = 0

const props = defineProps<{ slug: string }>()
const routes = shallowRef<Record<string, RouteVariants>>()
const baseMarkup = ref('')
const markup = ref('')
const portalMarkup = ref('')
const interactions = shallowRef<InteractionMap>({})
const motions = shallowRef<MotionManifest>({ routes: {} })
const baseBodyStyle = ref('')
const narrow = ref(window.innerWidth < 600)
const variantKey = computed(() => narrow.value ? 'mobile' : 'desktop')
let mediaQuery: MediaQueryList | undefined
let loading = 0
let styleGeneration = 0
let interactionTimer: number | undefined
let activeInteraction = ''
let overlayClosing = false
let authorizationReturnInteraction = ''
let activeAnimations: Animation[] = []
let captureRestoreListener: (() => void) | undefined
let captureAutoCloseListener: (() => void) | undefined
let captureAutoplayListener: (() => void) | undefined
let autoplayTimers: number[] = []
let autoplayAnimations: Animation[] = []
let gestureStart: number | undefined
let gestureRoot: Element | null = null
let pickerGesture: PickerGesture | undefined
let slipDrawerGesture: SlipDrawerGesture | undefined
let pickerDraft: string[] = []
let pickerOptionsCache: string[][] = []
const pickerSelections = new Map<string, string[]>()
const openSlipDrawers = new Map<string, SlipDrawerSide>()
const areaDistricts = districts as District[]
let blankPageIndex = 0
let blankPageSettings: BlankPageSettings = [true, true, true, true]

function ensureMotions() {
  motionRequest ??= fetch('/reference/motion/runtime.json')
    .then((result) => result.ok ? result.json() as Promise<MotionManifest> : { routes: {} })
    .catch(() => ({ routes: {} }))
  return motionRequest
}

async function ensureRoutes(): Promise<Record<string, RouteVariants>> {
  if (routes.value) return routes.value
  const data = await fetch('/reference/routes.json').then((response) => response.json() as Promise<Record<string, RouteVariants>>)
  routes.value = data
  return data
}

async function setStyles(styles: string[]) {
  const generation = ++styleGeneration
  const previous = [...document.querySelectorAll<HTMLLinkElement>('link[data-reference-style]')]
  const loaded = await Promise.all(styles.map((href) => new Promise<boolean>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.referenceStyle = ''
    link.onload = () => resolve(true)
    link.onerror = () => { link.remove(); resolve(false) }
    document.head.append(link)
  })))
  if (generation === styleGeneration && loaded.every(Boolean)) previous.forEach((link) => link.remove())
}

function syncIndexHighlight(content = document.querySelector<HTMLElement>('#app .q-index__content')) {
  if (!content) return
  const groups = [...content.querySelectorAll<HTMLElement>('.q-index__group-label')]
  const indicators = [...(content.closest('.q-index')?.querySelectorAll<HTMLElement>('.q-index__indicator > li') ?? [])]
  if (!groups.length || groups.length !== indicators.length) return

  const top = content.getBoundingClientRect().top
  let active = 0
  groups.forEach((group, index) => {
    if (group.getBoundingClientRect().top <= top) active = index
  })
  groups.forEach((group, index) => group.classList.toggle('on', index === active))
  indicators.forEach((item, index) => item.classList.toggle('on', index === active))
}

function onIndexScroll(event: Event) {
  const content = event.target
  if (props.slug === 'indexes' && content instanceof HTMLElement && content.matches('#app .q-index__content')) {
    syncIndexHighlight(content)
  }
}

function stopInfiniteLoading() {
  infiniteObserver?.disconnect()
  infiniteObserver = undefined
  window.clearTimeout(infiniteLoadTimer)
  infiniteLoadTimer = undefined
  infiniteLoadPending = false
}

function stopLoadingProgress() {
  loadingCircleTimers.forEach((timer) => window.clearInterval(timer))
  loadingCircleTimers.clear()
}

function setLoadingProgress(circle: SVGSVGElement, progress: number) {
  const label = circle.querySelector<SVGTextElement>('.q-loading_circle-text')
  if (!label) return
  label.textContent = `${progress}%`
  circle.querySelectorAll<SVGCircleElement>('.q-loading_circle-inner').forEach((arc) => {
    const radius = Number(arc.getAttribute('r'))
    if (radius) arc.setAttribute('stroke-dasharray', `${(2 * Math.PI * radius * progress / 100).toFixed(1)},1000`)
  })
}

function syncLoadingProgress() {
  const circles = props.slug === 'loading' ? [...document.querySelectorAll<SVGSVGElement>('.q-loading_circle')] : []
  const active = new Set(circles)
  loadingCircleTimers.forEach((timer, circle) => {
    if (active.has(circle)) return
    window.clearInterval(timer)
    loadingCircleTimers.delete(circle)
  })
  circles.forEach((circle) => {
    if (loadingCircleTimers.has(circle)) return
    const demoCircle = circle.closest('.circle-loading') !== null
    let progress = demoCircle ? loadingDemoProgress : 0
    setLoadingProgress(circle, progress)
    loadingCircleTimers.set(circle, window.setInterval(() => {
      progress = progress >= 100 ? 0 : progress + 10
      if (demoCircle) loadingDemoProgress = progress
      setLoadingProgress(circle, progress)
    }, 1000))
  })
}

function observeInfiniteLoading() {
  const scroller = document.querySelector<HTMLElement>('.infinite-loading-demo')
  const list = scroller?.querySelector<HTMLElement>('.infinite-loading-list')
  const sentinel = scroller?.querySelector<HTMLElement>('.q-infinite-loading [class*="__more"]')
  if (!scroller || !list || !sentinel || !('IntersectionObserver' in window)) return

  infiniteObserver = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting || infiniteLoadPending) return
    infiniteLoadPending = true
    sentinel.innerHTML = '<div class="q-infinite-loading__next"><div class="q-loading q-loading_normal"><div class="q-loading__inner"><div class="q-loading__icon q-loading__icon-gray"></div><span class="q-loading__txt-tips">加载中</span></div></div></div>'
    infiniteLoadTimer = window.setTimeout(() => {
      const count = list.children.length
      list.insertAdjacentHTML('beforeend', Array.from({ length: 30 }, (_, index) => `<li class="list-item">${count + index + 1}</li>`).join(''))
      sentinel.innerHTML = '<!---->'
      infiniteLoadTimer = undefined
      infiniteLoadPending = false
    }, 250)
  }, { root: scroller })
  infiniteObserver.observe(sentinel)
}

async function loadPage() {
  const current = ++loading
  document.title = entries.find((entry) => entry.slug === props.slug)?.title ?? 'Web 组件库'
  stopLoadingProgress()
  loadingDemoProgress = 0
  if (props.slug !== 'slip-drawer') openSlipDrawers.clear()
  slipDrawerGesture = undefined
  if (props.slug === 'blank-page') {
    blankPageIndex = 0
    blankPageSettings = [true, true, true, true]
  }
  stopInfiniteLoading()
  window.clearTimeout(interactionTimer)
  stopAutoplay()
  clearCaptureAutoClose()
  cancelAnimations()
  gestureRoot = null
  activeInteraction = ''
  authorizationReturnInteraction = ''
  portalMarkup.value = ''
  const pageRoutes = await ensureRoutes()
  const route = pageRoutes[props.slug] ?? pageRoutes.index
  if (!route) return
  const variant = route[variantKey.value] ?? route.mobile
  if (!variant) return
  await setStyles(variant.styles)
  if (/Windows/i.test(navigator.userAgent)) document.documentElement.classList.add('is-win')
  document.body.style.background = 'var(--bg_bottom_standard, #f5f6fa)'
  baseBodyStyle.value = document.body.getAttribute('style') ?? ''
  const [response, nextInteractions, nextMotions] = await Promise.all([
    fetch(variant.html),
    fetch(`/reference/states/${props.slug}.json`)
      .then((result) => result.ok ? result.json() as Promise<InteractionMap> : {})
      .catch(() => ({})),
    ensureMotions(),
  ])
  const nextMarkup = await response.text()
  if (current !== loading) return
  baseMarkup.value = nextMarkup
  markup.value = nextMarkup
  interactions.value = nextInteractions
  motions.value = nextMotions
  if (props.slug === 'indexes') {
    await nextTick()
    const content = document.querySelector<HTMLElement>('#app .q-index__content')
    if (content) content.scrollTop = 1288
  }
  await nextTick()
  syncLoadingProgress()
  if (props.slug === 'indexes') syncIndexHighlight()
  if (props.slug === 'swiper') syncSwiperPositions()
  if (props.slug === 'slip-drawer') syncSlipDrawerStates()
  if (props.slug === 'infinite-loading') observeInfiniteLoading()
  startAutoplay()
}

function onResizeChange(event: MediaQueryListEvent) {
  narrow.value = event.matches
}

function onSwiperResize() {
  if (props.slug !== 'swiper') return
  stopAutoplay()
  syncSwiperPositions()
  startAutoplay()
}

function navigate(text: string): boolean {
  const normalized = text.trim().replace(/\s+/g, ' ')
  const entry = entries.find((item) => item.label === normalized || item.title === normalized)
  if (!entry) return false
  window.location.hash = routeFor(entry.slug)
  return true
}

function restorePage() {
  window.clearTimeout(interactionTimer)
  stopAutoplay()
  clearCaptureAutoClose()
  cancelAnimations()
  overlayClosing = false
  activeInteraction = ''
  authorizationReturnInteraction = ''
  markup.value = baseMarkup.value
  portalMarkup.value = ''
  document.body.setAttribute('style', baseBodyStyle.value)
  document.querySelectorAll<HTMLElement>('#app .container, #app .container *').forEach((element) => {
    element.scrollTop = 0
    element.scrollLeft = 0
  })
  const indexContent = document.querySelector<HTMLElement>('#app .q-index__content')
  if (indexContent) indexContent.scrollTop = 1288
  void nextTick().then(() => {
    syncLoadingProgress()
    if (props.slug === 'indexes') syncIndexHighlight()
    if (props.slug === 'swiper') syncSwiperPositions()
    if (props.slug === 'blank-page') {
      setBlankPageSlide(blankPageIndex, false)
      applyBlankPageSettings()
    }
    if (props.slug === 'slip-drawer') syncSlipDrawerStates()
    startAutoplay()
  })
}

function setBlankPageSlide(index: number, animate = true) {
  const swiper = document.querySelector<HTMLElement>('#app .q-swiper')
  const list = swiper?.querySelector<HTMLElement>('.q-swiper__list')
  if (!swiper || !list) return
  const count = list.querySelectorAll('.q-swiper__item').length
  if (!count) return
  blankPageIndex = Math.max(0, Math.min(index, count - 1))
  swiper.scrollLeft = 0
  list.style.transition = animate ? 'transform 0.5s' : 'none'
  list.style.transform = `translate3d(${-blankPageIndex * swiper.clientWidth}px, 0px, 0px)`
  swiper.querySelectorAll('.q-swiper__indicator-item').forEach((item, index) => {
    item.classList.toggle('on', index === blankPageIndex)
  })
}

function applyBlankPageSettings() {
  const contentSelectors = ['.blank-page-button', '.q-blank-page__title', '.q-blank-page__desc']
  document.querySelectorAll<HTMLElement>('#app .container .q-blank-page').forEach((page) => {
    page.classList.toggle('q-blank-page_fullscreen', blankPageSettings[0])
    page.querySelectorAll<HTMLElement>('.q-icon').forEach((icon) => {
      icon.style.fontSize = blankPageSettings[0] ? '100px' : '80px'
    })
    contentSelectors.forEach((selector, index) => {
      page.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        element.style.display = blankPageSettings[index + 1] ? '' : 'none'
      })
    })
    page.querySelectorAll<HTMLElement>('.blank-page-button').forEach((button) => {
      button.classList.toggle('q-button_medium', blankPageSettings[0])
      button.classList.toggle('q-button_small', !blankPageSettings[0])
    })
  })
  document.querySelectorAll<HTMLElement>('.q-popup [role="switch"]').forEach((control, index) => {
    const checked = blankPageSettings[index]
    if (checked === undefined) return
    control.setAttribute('aria-checked', String(checked))
    control.classList.toggle('q-switch_checked', checked)
  })
}

function cancelAnimations() {
  activeAnimations.forEach((animation) => animation.cancel())
  activeAnimations = []
  if (captureRestoreListener) window.removeEventListener('qui-motion-capture-settled', captureRestoreListener)
  captureRestoreListener = undefined
}

function clearCaptureAutoClose() {
  if (captureAutoCloseListener) window.removeEventListener('qui-motion-capture-enter-settled', captureAutoCloseListener)
  captureAutoCloseListener = undefined
}

function stopAutoplay() {
  autoplayTimers.forEach((timer) => window.clearTimeout(timer))
  autoplayTimers = []
  if (captureAutoplayListener) window.removeEventListener('qui-motion-capture-autoplay-settled', captureAutoplayListener)
  captureAutoplayListener = undefined
  autoplayAnimations.forEach((animation) => animation.cancel())
  autoplayAnimations = []
  activeAnimations = activeAnimations.filter((animation) => {
    if (!animation.id.includes(':autoplay:')) return true
    animation.cancel()
    return false
  })
}

function setAutoplayState(track: AutoplayTrack, slide: number, dotIndex: number) {
  const root = document.querySelectorAll<HTMLElement>('.q-swiper')[track.rootIndex]
  root?.querySelectorAll('.q-swiper__indicator-item').forEach((dot, index) => dot.classList.toggle('on', index === dotIndex))
  const counter = root?.querySelector<HTMLElement>('.custom-indicator')
  if (counter) counter.textContent = `${slide} / ${track.childCount - 2}`
}

function visibleMotionTargets(selector: string) {
  return [...document.querySelectorAll(selector)].filter((element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
  })
}

function selectTabItem(tabItem: HTMLElement) {
  const tab = tabItem.closest<HTMLElement>('.q-tab')
  const nav = tabItem.parentElement
  if (!tab || !nav) return

  const items = [...nav.children]
  const index = items.indexOf(tabItem)
  if (index < 0) return

  items.forEach((item, itemIndex) => {
    const selected = itemIndex === index
    item.classList.toggle('on', selected)
    if (selected) item.setAttribute('aria-selected', 'true')
    else item.removeAttribute('aria-selected')
  })

  const content = tab.querySelector<HTMLElement>('.q-tab__content')
  if (content) content.style.transform = `translate3d(${-tab.offsetWidth * index}px, 0px, 0px)`
}

function autoplayTransform(index: number, width: number) {
  return `translate3d(${-Math.round(index * width * 1000) / 1000}px, 0px, 0px)`
}

function swiperStepWidth() {
  return Math.max(0, window.innerWidth - 32)
}

function swiperSlideCount(root: HTMLElement, list: HTMLElement) {
  const dots = root.querySelectorAll('.q-swiper__indicator-item').length
  const total = Number(root.querySelector('.custom-indicator')?.textContent?.match(/\/\s*(\d+)/)?.[1])
  return dots || total || Math.max(0, list.children.length - 2)
}

function swiperSlideIndex(root: HTMLElement, list: HTMLElement, count: number) {
  const activeDot = [...root.querySelectorAll('.q-swiper__indicator-item')].findIndex((dot) => dot.classList.contains('on'))
  const current = Number(root.querySelector('.custom-indicator')?.textContent?.match(/^\s*(\d+)/)?.[1]) - 1
  if (activeDot >= 0) return activeDot
  if (Number.isFinite(current) && current >= 0) return Math.min(count - 1, current)
  let offset = 0
  try { offset = new DOMMatrixReadOnly(getComputedStyle(list).transform).m41 } catch {}
  const looped = list.children.length > count
  return Math.max(0, Math.min(count - 1, Math.round(-offset / swiperStepWidth()) - (looped ? 1 : 0)))
}

function setSwiperTransform(list: HTMLElement, index: number, width: number, transition = list.style.transition) {
  list.style.transition = 'none'
  list.style.transform = autoplayTransform(index, width)
  void list.offsetWidth
  if (transition) list.style.transition = transition
  else list.style.removeProperty('transition')
}

function syncSwiperPositions() {
  const width = swiperStepWidth()
  document.querySelectorAll<HTMLElement>('#app .q-swiper').forEach((root) => {
    const list = root.querySelector<HTMLElement>('.q-swiper__list')
    if (!list) return
    const count = swiperSlideCount(root, list)
    if (!count) return
    const index = swiperSlideIndex(root, list, count) + (list.children.length > count ? 1 : 0)
    list.getAnimations().forEach((animation) => animation.cancel())
    setSwiperTransform(list, index, width)
  })
}

function swiperTrackPosition(track: AutoplayTrack) {
  const root = document.querySelectorAll<HTMLElement>('#app .q-swiper')[track.rootIndex]
  const list = root?.querySelector<HTMLElement>('.q-swiper__list')
  if (!root || !list) return { index: track.initialIndex, dot: track.initialDot }
  const count = Math.max(1, track.childCount - 2)
  const slide = swiperSlideIndex(root, list, count)
  return { index: slide + 1, dot: track.dotCount ? slide : -1 }
}

function setSwiperIndicator(root: HTMLElement, slide: number, count: number) {
  root.querySelectorAll('.q-swiper__indicator-item').forEach((dot, index) => dot.classList.toggle('on', index === slide))
  const counter = root.querySelector<HTMLElement>('.custom-indicator')
  if (counter) counter.textContent = `${slide + 1} / ${count}`
}

function swiperTransitionDuration(root: HTMLElement) {
  const rootIndex = [...document.querySelectorAll<HTMLElement>('#app .q-swiper')].indexOf(root)
  const route = motions.value.routes[props.slug]?.[variantKey.value]
  const track = route?.autoplay?.autoplay?.tracks.find((item) => item.rootIndex === rootIndex)
  const gesture = route?.['gesture-left']?.enter?.find((item) => item.selector.includes('q-swiper__list') && item.index === rootIndex)
  return track?.timing.duration ?? gesture?.timing.duration ?? 500
}

function slideSwiper(root: HTMLElement, direction: 'left' | 'right') {
  const list = root.querySelector<HTMLElement>('.q-swiper__list')
  if (!list) return
  stopAutoplay()
  syncSwiperPositions()
  const count = swiperSlideCount(root, list)
  if (!count) return
  const looped = list.children.length > count
  const current = swiperSlideIndex(root, list, count)
  const delta = direction === 'left' ? 1 : -1
  const next = looped ? (current + delta + count) % count : Math.max(0, Math.min(count - 1, current + delta))
  if (next === current) {
    startAutoplay()
    return
  }
  const index = (looped ? current + 1 : current) + delta
  const wraps = looped && (index < 1 || index > count)
  const width = swiperStepWidth()
  const duration = swiperTransitionDuration(root)
  const target = autoplayTransform(index, width)
  setSwiperIndicator(root, next, count)
  const animation = list.animate([{ transform: getComputedStyle(list).transform }, { transform: target }], {
    duration,
    easing: 'ease',
    fill: 'both',
  })
  animation.finished.then(() => {
    if (!list.isConnected) return
    animation.cancel()
    const settledIndex = wraps ? (delta > 0 ? 1 : count) : index
    setSwiperTransform(list, settledIndex, width, `transform ${duration}ms`)
    startAutoplay()
  }).catch(() => {})
}

function advanceAutoplayTrack(track: AutoplayTrack, index: number, dot: number) {
  const target = visibleMotionTargets(track.selector)[track.index]
  if (!target || !(target instanceof HTMLElement)) return
  const nextIndex = index + 1
  const wraps = nextIndex >= track.childCount - 1
  const nextDot = track.dotCount ? (dot + 1) % track.dotCount : -1
  const width = swiperStepWidth()
  const endTransform = autoplayTransform(nextIndex, width)
  target.style.transition = `transform ${track.timing.duration}ms`
  setAutoplayState(track, wraps ? 1 : nextIndex, nextDot)
  const animation = target.animate([{ transform: getComputedStyle(target).transform }, { transform: endTransform }], {
    ...track.timing,
    delay: 0,
    fill: 'both',
    iterations: 1,
  })
  autoplayAnimations.push(animation)
  animation.finished.then(() => {
    if (!target.isConnected) return
    target.style.transform = endTransform
    animation.cancel()
    autoplayAnimations = autoplayAnimations.filter((item) => item !== animation)
    const currentIndex = wraps ? 1 : nextIndex
    const currentDot = wraps ? 0 : nextDot
    if (wraps) {
      setSwiperTransform(target, currentIndex, width, `transform ${track.timing.duration}ms`)
      setAutoplayState(track, currentIndex, currentDot)
    }
    autoplayTimers.push(window.setTimeout(() => advanceAutoplayTrack(track, currentIndex, currentDot), track.rest))
  }).catch(() => {})
}

function finishCapturedAutoplayTrack(track: AutoplayTrack) {
  const motion = motions.value.routes[props.slug]?.[variantKey.value]?.autoplay
  const descriptor = motion?.enter?.find((item) => item.selector === track.selector && item.index === track.index)
  const target = visibleMotionTargets(track.selector)[track.index]
  const endpoint = descriptor?.keyframes.at(-1)?.transform
  if (target instanceof HTMLElement && typeof endpoint === 'string') target.style.transform = endpoint
  const animation = descriptor && activeAnimations.find((item) => item.id === descriptor.id)
  if (animation) {
    animation.cancel()
    activeAnimations = activeAnimations.filter((item) => item !== animation)
  }
  const nextIndex = track.initialIndex + 1
  const wraps = nextIndex >= track.childCount - 1
  const nextDot = track.dotCount ? (track.initialDot + 1) % track.dotCount : -1
  const currentIndex = wraps ? 1 : nextIndex
  const currentDot = wraps ? 0 : nextDot
  if (wraps && target instanceof HTMLElement) {
    setSwiperTransform(target, currentIndex, swiperStepWidth())
    setAutoplayState(track, currentIndex, currentDot)
  }
  autoplayTimers.push(window.setTimeout(() => advanceAutoplayTrack(track, currentIndex, currentDot), track.rest))
}

function startAvatarAutoplay() {
  document.querySelectorAll<HTMLElement>('.q-avatar_carousel').forEach((carousel) => {
    const images = [...carousel.querySelectorAll<HTMLElement>(':scope > img')]
    if (images.length < 2) return

    let currentIndex = Math.max(0, images.findIndex((image) => getComputedStyle(image).display !== 'none'))
    const advance = () => {
      const current = images[currentIndex]
      const nextIndex = (currentIndex + 1) % images.length
      const next = images[nextIndex]
      next.style.removeProperty('display')

      const outgoingTransform = current.animate([
        { transform: 'none' },
        { transform: 'translateX(-18px) scale(0.82)' },
      ], { duration: 300, easing: 'ease', fill: 'both' })
      const outgoingOpacity = current.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 300,
        easing: 'ease',
        fill: 'both',
      })
      const incomingTransform = next.animate([
        { transform: 'translateX(18px) scale(0.82)' },
        { transform: 'none' },
      ], { duration: 400, easing: 'ease', fill: 'both' })
      const incomingOpacity = next.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 200,
        easing: 'ease',
        fill: 'both',
      })
      const animations = [outgoingTransform, outgoingOpacity, incomingTransform, incomingOpacity]
      autoplayAnimations.push(...animations)
      currentIndex = nextIndex

      incomingTransform.finished.then(() => {
        if (!carousel.isConnected) return
        current.style.display = 'none'
        animations.forEach((animation) => animation.cancel())
        autoplayAnimations = autoplayAnimations.filter((animation) => !animations.includes(animation))
      }).catch(() => {})

      autoplayTimers.push(window.setTimeout(advance, 1500))
    }

    autoplayTimers.push(window.setTimeout(advance, 1500))
  })
}

function startAutoplay() {
  stopAutoplay()
  const captureWindow = window as Window & { __QUI_MOTION_CAPTURE__?: boolean; __QUI_AUTOPLAY_CAPTURE__?: boolean }
  if (captureWindow.__QUI_MOTION_CAPTURE__ && !captureWindow.__QUI_AUTOPLAY_CAPTURE__) return
  if (props.slug === 'avatar') {
    startAvatarAutoplay()
    return
  }
  if (props.slug !== 'swiper') return
  const motion = motions.value.routes[props.slug]?.[variantKey.value]?.autoplay
  const tracks = motion?.autoplay?.tracks ?? []
  if (!tracks.length) return
  if (!captureWindow.__QUI_MOTION_CAPTURE__) {
    tracks.forEach((track) => autoplayTimers.push(window.setTimeout(() => {
      const position = swiperTrackPosition(track)
      advanceAutoplayTrack(track, position.index, position.dot)
    }, track.delay)))
    return
  }
  const timer = window.setTimeout(() => {
    tracks.forEach((track) => setAutoplayState(track, track.initialIndex + 1, track.dotCount ? (track.initialDot + 1) % track.dotCount : -1))
    playMotion('autoplay', 'enter')
    if (captureWindow.__QUI_MOTION_CAPTURE__) {
      captureAutoplayListener = () => {
        captureAutoplayListener = undefined
        tracks.forEach(finishCapturedAutoplayTrack)
      }
      window.addEventListener('qui-motion-capture-autoplay-settled', captureAutoplayListener, { once: true })
    } else {
      tracks.forEach((track) => autoplayTimers.push(window.setTimeout(() => finishCapturedAutoplayTrack(track), track.timing.duration)))
    }
  }, Math.min(...tracks.map((track) => track.delay)))
  autoplayTimers.push(timer)
}

function playMotion(interaction: string, phase: 'enter' | 'leave'): number {
  cancelAnimations()
  const routeMotions = motions.value.routes[props.slug]?.[variantKey.value]
  const recorded = routeMotions?.[interaction]?.[phase]
  const authorizationExit = props.slug === 'authorization' && phase === 'leave' && ['0', '1'].includes(interaction)
    ? routeMotions?.['2']?.leave
    : undefined
  const descriptors = recorded?.length ? recorded : authorizationExit ?? recorded ?? []
  const targets = new Map<string, Element[]>()
  let duration = 0
  for (const descriptor of descriptors) {
    let visible = targets.get(descriptor.selector)
    if (!visible) {
      const all = [...document.querySelectorAll(descriptor.selector)]
      visible = all.filter((element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      })
      if (!visible.length && descriptor.selector.endsWith('-transition"]')) {
        const baseSelector = descriptor.selector.replace(/-transition(?="\]$)/, '')
        visible = [...document.querySelectorAll(baseSelector)].filter((element) => {
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
        })
      }
      targets.set(descriptor.selector, visible)
    }
    const all = [...document.querySelectorAll(descriptor.selector)]
    const indexed = all[descriptor.index]
    const visibleTarget = visible[descriptor.index]
    const target = visibleTarget ?? (indexed && getComputedStyle(indexed).display === 'none' ? indexed : undefined)
    if (!(target instanceof HTMLElement || target instanceof SVGElement)) continue
    const restoreDisplay = getComputedStyle(target).display === 'none'
    if (restoreDisplay) target.style.removeProperty('display')
    const options = { ...descriptor.timing, iterations: descriptor.timing.iterations === 'infinite' ? Infinity : descriptor.timing.iterations, ...(descriptor.pseudoElement ? { pseudoElement: descriptor.pseudoElement } : {}) }
    const animation = target.animate(descriptor.keyframes, options)
    animation.id = descriptor.id
    activeAnimations.push(animation)
    if (restoreDisplay) animation.finished.then(() => {
      if (target.isConnected) target.style.setProperty('display', 'none')
    }).catch(() => {})
    if (Number.isFinite(options.iterations)) duration = Math.max(duration, options.delay + options.duration * Number(options.iterations))
  }
  return Math.max(0, Math.ceil(duration))
}

function scheduleRestore() {
  if (props.slug === 'popup' || props.slug === 'bottom-sheet') {
    if (overlayClosing) return
    overlayClosing = true
    document.querySelectorAll<HTMLElement>('.q-popup__mask, .q-bottom-sheet__mask').forEach((mask) => {
      mask.style.pointerEvents = 'none'
    })
  }
  window.clearTimeout(interactionTimer)
  const duration = playMotion(activeInteraction, 'leave')
  if (duration && (window as Window & { __QUI_MOTION_CAPTURE__?: boolean }).__QUI_MOTION_CAPTURE__) {
    captureRestoreListener = restorePage
    window.addEventListener('qui-motion-capture-settled', captureRestoreListener, { once: true })
  } else if (duration) interactionTimer = window.setTimeout(restorePage, duration)
  else restorePage()
}

function applyState(interaction: string, state: InteractionState, playEnter = true) {
  window.clearTimeout(interactionTimer)
  stopAutoplay()
  clearCaptureAutoClose()
  cancelAnimations()
  overlayClosing = false
  activeInteraction = interaction
  markup.value = state.markup
  portalMarkup.value = state.portals.join('')
  void nextTick().then(() => {
    syncLoadingProgress()
    const root = document.querySelector<HTMLElement>('#app .container')
    for (const scroll of state.scrolls ?? []) {
      const target = scroll.path.reduce<HTMLElement | null>((node, index) => node?.children.item(index) as HTMLElement | null, root)
      if (target) {
        target.scrollTop = scroll.top
        target.scrollLeft = scroll.left
      }
    }
    if (props.slug === 'indexes') syncIndexHighlight()
    if (props.slug === 'blank-page') {
      setBlankPageSlide(blankPageIndex, false)
      applyBlankPageSettings()
    }
    if (props.slug === 'slip-drawer') syncSlipDrawerStates()
    if (props.slug === 'area' || props.slug === 'datetime-picker' || props.slug === 'picker') hydratePicker(interaction)
    void nextTick().then(() => {
      if (playEnter) playMotion(interaction, 'enter')
      startAutoplay()
    })
  })
  const duration = motions.value.routes[props.slug]?.[variantKey.value]?.[interaction]?.autoCloseMs ?? 0
  if (duration && (window as Window & { __QUI_MOTION_CAPTURE__?: boolean }).__QUI_MOTION_CAPTURE__) {
    captureAutoCloseListener = () => {
      captureAutoCloseListener = undefined
      interactionTimer = window.setTimeout(scheduleRestore, duration)
    }
    window.addEventListener('qui-motion-capture-enter-settled', captureAutoCloseListener, { once: true })
  } else if (duration) interactionTimer = window.setTimeout(scheduleRestore, duration)
}

const pickerTransition = 'transform 0.8s cubic-bezier(0.17, 0.97, 0.2, 0.98)'

function pickerColumns() {
  return [...document.querySelectorAll<HTMLUListElement>('.q-popup__content .q-picker__content .q-picker-column')]
}

function pickerOffset(column: HTMLUListElement) {
  const match = column.style.transform.match(/,\s*(-?[\d.]+)px,/)
  return match ? Number(match[1]) : 90
}

function normalizeArea(values: string[], count: number) {
  const province = areaDistricts.find((item) => item.name === values[0]) ?? areaDistricts[0]
  const city = province?.children?.find((item) => item.name === values[1]) ?? province?.children?.[0]
  const district = city?.children?.find((item) => item.name === values[2]) ?? city?.children?.[0]
  return [province?.name ?? '', city?.name ?? '', district?.name ?? ''].slice(0, count)
}

function normalizeDate(values: string[], count: number) {
  const number = (value: string | undefined, fallback: number) => Number(value?.match(/\d+/)?.[0]) || fallback
  const year = Math.max(2016, Math.min(2036, number(values[0], 2026)))
  const month = Math.max(1, Math.min(12, number(values[1], 10)))
  const day = Math.max(1, Math.min(new Date(year, month, 0).getDate(), number(values[2], 6)))
  return [`${year}年`, `${month}月`, `${day}日`].slice(0, count)
}

function pickerOptions(index: number): string[] {
  if (props.slug === 'area') {
    const province = areaDistricts.find((item) => item.name === pickerDraft[0]) ?? areaDistricts[0]
    const city = province?.children?.find((item) => item.name === pickerDraft[1]) ?? province?.children?.[0]
    return (index === 0 ? areaDistricts : index === 1 ? province?.children ?? [] : city?.children ?? []).map((item) => item.name)
  }
  if (props.slug === 'picker') return pickerOptionsCache[index] ?? []
  const year = Number(pickerDraft[0]?.match(/\d+/)?.[0]) || 2026
  const month = Number(pickerDraft[1]?.match(/\d+/)?.[0]) || 10
  if (index === 0) return Array.from({ length: 21 }, (_, item) => `${2016 + item}年`)
  if (index === 1) return Array.from({ length: 12 }, (_, item) => `${item + 1}月`)
  if (index === 2) return Array.from({ length: new Date(year, month, 0).getDate() }, (_, item) => `${item + 1}日`)
  return []
}

function renderPickerColumns(animate = true) {
  const columns = pickerColumns()
  columns.forEach((column, index) => {
    const options = pickerOptions(index)
    const selectedIndex = Math.max(0, options.indexOf(pickerDraft[index]))
    column.replaceChildren(...options.map((label, itemIndex) => {
      const item = document.createElement('li')
      item.className = 'q-picker-column__item'
      item.textContent = label
      if (itemIndex === selectedIndex) {
        item.style.height = '56px'
        item.style.lineHeight = '56px'
      }
      return item
    }))
    column.style.transition = animate ? pickerTransition : 'none'
    column.style.transform = `translate3d(0px, ${90 - selectedIndex * 45}px, 0px)`
    column.style.touchAction = 'none'
    if (!animate) requestAnimationFrame(() => { if (column.isConnected) column.style.transition = pickerTransition })
  })
}

function hydratePicker(interaction: string) {
  const columns = pickerColumns()
  if (!columns.length) return
  pickerOptionsCache = columns.map((column) => [...column.children].map((item) => item.textContent?.trim() ?? ''))
  const saved = pickerSelections.get(`${props.slug}:${interaction}`)
  const initial = saved ?? columns.map((column) => {
    const selected = [...column.children].find((item) => (item as HTMLElement).style.height === '56px')
    return selected?.textContent?.trim() ?? ''
  })
  pickerDraft = props.slug === 'area' ? normalizeArea(initial, columns.length) : props.slug === 'datetime-picker' ? normalizeDate(initial, columns.length) : initial
  renderPickerColumns(false)
}

function selectPickerIndex(column: HTMLUListElement, selectedIndex: number) {
  const columns = pickerColumns()
  const index = columns.indexOf(column)
  const value = column.children.item(selectedIndex)?.textContent?.trim()
  if (index < 0 || !value) return
  const changed = pickerDraft[index] !== value
  pickerDraft[index] = value
  if (props.slug === 'area') {
    if (changed && index < 2) pickerDraft = pickerDraft.slice(0, index + 1)
    pickerDraft = normalizeArea(pickerDraft, columns.length)
  } else if (props.slug === 'datetime-picker') {
    pickerDraft = normalizeDate(pickerDraft, columns.length)
  }
  renderPickerColumns()
}

function pickerColumn(target: EventTarget | null) {
  if (!(props.slug === 'area' || props.slug === 'datetime-picker' || props.slug === 'picker') || !(target instanceof Element)) return null
  const column = target.closest('.q-popup__content .q-picker__content .q-picker-column')
  return column instanceof HTMLUListElement ? column : null
}

function beginPickerGesture(target: EventTarget | null, y: number) {
  const column = pickerColumn(target)
  if (!column) return false
  pickerGesture = { column, startY: y, startOffset: pickerOffset(column) }
  column.style.transition = 'none'
  return true
}

function movePickerGesture(y: number) {
  if (!pickerGesture) return false
  const { column, startY, startOffset } = pickerGesture
  const lastOffset = 90 - Math.max(0, column.children.length - 1) * 45
  const offset = Math.max(lastOffset, Math.min(90, startOffset + y - startY))
  column.style.transform = `translate3d(0px, ${offset}px, 0px)`
  return true
}

function endPickerGesture(y: number) {
  const gesture = pickerGesture
  pickerGesture = undefined
  if (!gesture) return false
  if (Math.abs(y - gesture.startY) < 4) {
    gesture.column.style.transition = pickerTransition
    gesture.column.style.transform = `translate3d(0px, ${gesture.startOffset}px, 0px)`
    return true
  }
  const offset = Math.max(90 - Math.max(0, gesture.column.children.length - 1) * 45, Math.min(90, gesture.startOffset + y - gesture.startY))
  selectPickerIndex(gesture.column, Math.round((90 - offset) / 45))
  return true
}

function handlePickerClick(element: Element) {
  const popup = element.closest('.q-popup__content')
  if (!popup) return false
  const item = element.closest('.q-picker-column__item')
  if (item) {
    const column = item.closest('.q-picker-column')
    if (column instanceof HTMLUListElement) selectPickerIndex(column, [...column.children].indexOf(item))
    return true
  }
  const button = element.closest('.q-picker__btn')
  if (button) {
    if (button.textContent?.trim() === '确定') pickerSelections.set(`${props.slug}:${activeInteraction}`, [...pickerDraft])
    scheduleRestore()
  }
  return true
}

function slipDrawerTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  return target.closest('.q-slip-drawer__content')?.closest<HTMLElement>('.q-slip-drawer') ?? null
}

function slipDrawerKey(drawer: HTMLElement) {
  return drawer.querySelector('.q-slip-drawer__content .q-list__title-txt')?.textContent?.trim() ?? ''
}

function setSlipDrawerOffset(drawer: HTMLElement, offset: number, animate = true) {
  const wrapper = drawer.querySelector<HTMLElement>('.q-slip-drawer__wrapper')
  if (!wrapper) return false
  wrapper.style.transition = animate ? 'transform 0.4s' : 'none'
  wrapper.style.transform = `translate3d(${offset}px, 0px, 0px)`
  return true
}

function setSlipDrawerSide(drawer: HTMLElement, side: SlipDrawerSide, animate = true) {
  const width = drawer.querySelector<HTMLElement>(side === 'left' ? '.q-slip-drawer__action-left' : '.q-slip-drawer__action-right')?.offsetWidth ?? 0
  const key = slipDrawerKey(drawer)
  if (!width || !key) {
    if (key) openSlipDrawers.delete(key)
    setSlipDrawerOffset(drawer, 0, animate)
    return
  }
  openSlipDrawers.set(key, side)
  setSlipDrawerOffset(drawer, side === 'left' ? width : -width, animate)
}

function syncSlipDrawerStates() {
  const remaining = new Set(openSlipDrawers.keys())
  document.querySelectorAll<HTMLElement>('#app .q-slip-drawer').forEach((drawer) => {
    const key = slipDrawerKey(drawer)
    const side = openSlipDrawers.get(key)
    if (!side) return
    setSlipDrawerSide(drawer, side, false)
    remaining.delete(key)
  })
  remaining.forEach((key) => openSlipDrawers.delete(key))
}

function beginSlipDrawerGesture(target: EventTarget | null, x: number, y: number) {
  if (props.slug !== 'slip-drawer') return false
  const drawer = slipDrawerTarget(target)
  const wrapper = drawer?.querySelector<HTMLElement>('.q-slip-drawer__wrapper')
  const key = drawer && slipDrawerKey(drawer)
  if (!drawer || !wrapper || !key) return false
  const leftWidth = drawer.querySelector<HTMLElement>('.q-slip-drawer__action-left')?.offsetWidth ?? 0
  const rightWidth = drawer.querySelector<HTMLElement>('.q-slip-drawer__action-right')?.offsetWidth ?? 0
  const side = openSlipDrawers.get(key)
  slipDrawerGesture = { drawer, wrapper, startX: x, startY: y, startOffset: side === 'left' ? leftWidth : side === 'right' ? -rightWidth : 0, leftWidth, rightWidth }
  wrapper.style.transition = 'none'
  return true
}

function moveSlipDrawerGesture(x: number, y: number, touch = false) {
  const gesture = slipDrawerGesture
  if (!gesture) return false
  const deltaX = x - gesture.startX
  const deltaY = y - gesture.startY
  if (touch && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
    cancelSlipDrawerGesture()
    return false
  }
  if (Math.abs(deltaX) < 4) return false
  const offset = Math.max(-gesture.rightWidth, Math.min(gesture.leftWidth, gesture.startOffset + deltaX))
  gesture.wrapper.style.transform = `translate3d(${offset}px, 0px, 0px)`
  return true
}

function endSlipDrawerGesture(x: number, y: number) {
  const gesture = slipDrawerGesture
  slipDrawerGesture = undefined
  if (!gesture) return false
  const deltaX = x - gesture.startX
  const side = Math.abs(deltaX) >= 24 && Math.abs(deltaX) > Math.abs(y - gesture.startY)
    ? deltaX < 0 ? 'right' : 'left'
    : undefined
  if (side) setSlipDrawerSide(gesture.drawer, side)
  else setSlipDrawerOffset(gesture.drawer, gesture.startOffset)
  return true
}

function cancelSlipDrawerGesture() {
  const gesture = slipDrawerGesture
  slipDrawerGesture = undefined
  if (gesture) setSlipDrawerOffset(gesture.drawer, gesture.startOffset)
}

function gestureTarget(target: EventTarget | null) {
  if (props.slug === 'slip-drawer') return slipDrawerTarget(target)
  const selector = props.slug === 'swiper' || props.slug === 'blank-page' ? '.q-swiper' : undefined
  return selector && target instanceof Element ? target.closest(selector) : null
}

function finishGesture(start: number | undefined, end: number, target: EventTarget | null) {
  const matched = gestureTarget(gestureRoot ?? target)
  gestureRoot = null
  if (start === undefined || Math.abs(end - start) < 32 || !matched) return
  if (props.slug === 'blank-page') {
    setBlankPageSlide(blankPageIndex + (end < start ? 1 : -1))
    return
  }
  if (props.slug === 'slip-drawer' && matched instanceof HTMLElement) {
    setSlipDrawerSide(matched, end < start ? 'right' : 'left')
    return
  }
  if (props.slug === 'swiper' && matched instanceof HTMLElement) slideSwiper(matched, end < start ? 'left' : 'right')
}

function onTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return
  const touch = event.touches[0]
  if (beginPickerGesture(event.target, touch.clientY)) return
  if (beginSlipDrawerGesture(event.target, touch.clientX, touch.clientY)) return
  const target = gestureTarget(event.target)
  if (target) {
    gestureStart = touch.clientX
    gestureRoot = target
  }
}

function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch) return
  if (moveSlipDrawerGesture(touch.clientX, touch.clientY, true) || movePickerGesture(touch.clientY)) event.preventDefault()
}

function onTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0]
  if (slipDrawerGesture) {
    endSlipDrawerGesture(touch?.clientX ?? slipDrawerGesture.startX, touch?.clientY ?? slipDrawerGesture.startY)
    gestureStart = undefined
    return
  }
  if (pickerGesture) {
    endPickerGesture(touch?.clientY ?? pickerGesture.startY)
    gestureStart = undefined
    return
  }
  const start = gestureStart
  gestureStart = undefined
  if (start !== undefined) finishGesture(start, touch?.clientX ?? start, gestureRoot ?? event.target)
}

function onTouchCancel() {
  if (slipDrawerGesture) cancelSlipDrawerGesture()
  if (pickerGesture) {
    pickerGesture = undefined
    renderPickerColumns()
  }
  gestureStart = undefined
  gestureRoot = null
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  if (beginPickerGesture(event.target, event.clientY)) return
  if (beginSlipDrawerGesture(event.target, event.clientX, event.clientY)) return
  const target = gestureTarget(event.target)
  if (target) {
    gestureStart = event.clientX
    gestureRoot = target
  }
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  if (moveSlipDrawerGesture(event.clientX, event.clientY)) return
  movePickerGesture(event.clientY)
}

function onPointerUp(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  if (slipDrawerGesture && endSlipDrawerGesture(event.clientX, event.clientY)) {
    gestureStart = undefined
    return
  }
  if (pickerGesture && endPickerGesture(event.clientY)) {
    gestureStart = undefined
    return
  }
  if (gestureStart === undefined) return
  const start = gestureStart
  gestureStart = undefined
  finishGesture(start, event.clientX, gestureRoot ?? event.target)
}

function onPointerCancel(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  if (slipDrawerGesture) cancelSlipDrawerGesture()
  if (pickerGesture) {
    pickerGesture = undefined
    renderPickerColumns()
  }
  gestureStart = undefined
  gestureRoot = null
}

function adjustProgressDemo(element: Element) {
  const label = element.closest('button')?.textContent?.trim()
  const step = label === '+' ? 10 : label === '-' ? -10 : 0
  if (!step) return false
  document.querySelectorAll<HTMLElement>('.progress-demo .q-progress').forEach((progress) => {
    const bar = progress.querySelector<HTMLElement>('.q-progress__inner')
    const current = Number.parseFloat(bar?.style.width ?? '')
    if (!bar || !Number.isFinite(current)) return
    const value = Math.max(0, Math.min(100, current + step))
    bar.style.width = `${value}%`
    const text = progress.querySelector<HTMLElement>('.q-progress__text') ?? progress.querySelector<HTMLElement>('span')
    if (text) text.textContent = text.classList.contains('q-progress__text') ? `${value}%` : `LV${Math.floor(value / 10)}`
  })
  return true
}

function matchAuthorizationCardHeight(state: InteractionState) {
  const height = document.querySelector<HTMLElement>('.qui-replica-portals .q-authorization-wrapper')?.style.height
  if (!height) return state
  const portals = state.portals.map((markup) => {
    const template = document.createElement('template')
    template.innerHTML = markup
    const wrapper = template.content.querySelector<HTMLElement>('.q-authorization-wrapper')
    if (wrapper) wrapper.style.height = height
    return template.innerHTML
  })
  return { ...state, portals }
}

function copyWithSelection(text: string): boolean {
  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0'
  document.body.append(input)
  input.focus()
  input.select()
  input.setSelectionRange(0, text.length)
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    input.remove()
  }
}

function copyText(text: string): Promise<boolean> {
  const clipboard = navigator.clipboard
  if (!clipboard?.writeText) return Promise.resolve(copyWithSelection(text))
  try {
    return clipboard.writeText(text).then(() => true, () => copyWithSelection(text))
  } catch {
    return Promise.resolve(copyWithSelection(text))
  }
}

function onClick({ element, buttonIndex, controlIndex }: ReplicaTarget) {
  if (props.slug === 'authorization') {
    const states = interactions.value[variantKey.value]
    if (element.closest('.q-authorization-header__right') && activeInteraction !== 'authorization-info') {
      const state = states?.['authorization-info']
      if (state) {
        authorizationReturnInteraction = activeInteraction || '0'
        applyState('authorization-info', matchAuthorizationCardHeight(state))
      }
      return
    }
    if (activeInteraction === 'authorization-info' && element.closest('.q-authorization-header__left')) {
      const interaction = authorizationReturnInteraction || '0'
      const state = states?.[interaction]
      authorizationReturnInteraction = ''
      if (!state) return
      const duration = playMotion('authorization-info', 'leave')
      if (duration) interactionTimer = window.setTimeout(() => applyState(interaction, state, false), duration)
      else applyState(interaction, state, false)
      return
    }
    if (activeInteraction === 'authorization-info' && element.closest('button, .q-popup__mask, .q-bottom-sheet__mask')) {
      activeInteraction = authorizationReturnInteraction || '0'
      authorizationReturnInteraction = ''
    }
  }
  if (props.slug === 'action-sheet') {
    const option = element.closest('.q-action-sheet__menu')
    if (option) {
      if (activeInteraction === '3') {
        const index = [...document.querySelectorAll('.qui-replica-portals .q-action-sheet__menu')].indexOf(option)
        const state = interactions.value[variantKey.value]?.[`3-selected-${index}`]
        if (state) applyState('3', state, false)
      }
      return
    }
  }
  if (props.slug === 'toast' && element.closest('.q-toast.clickable')) {
    window.location.assign('https://im.qq.com/index/#/')
    return
  }
  if (props.slug === 'blank-page') {
    const settingSwitch = element.closest('.q-popup [role="switch"]')
    if (settingSwitch) {
      const index = [...document.querySelectorAll('.q-popup [role="switch"]')].indexOf(settingSwitch)
      if (index >= 0 && index < blankPageSettings.length) {
        blankPageSettings[index] = !blankPageSettings[index]
        applyBlankPageSettings()
      }
      return
    }
  }
  if ((props.slug === 'area' || props.slug === 'datetime-picker' || props.slug === 'picker') && handlePickerClick(element)) return
  if (props.slug === 'progress' && adjustProgressDemo(element)) return
  const popup = element.closest('.q-popup__content, .q-dialog__box, .q-bottom-sheet__content_bottom')
  if (popup && !popup.matches('[style*="display: none"]')) {
    if (element.closest('button, a, [role="button"], .q-popup__mask, .q-dialog__mask, .q-bottom-sheet__mask')) {
      scheduleRestore()
    }
    return
  }
  if (element.closest('.q-popup__mask, .q-bottom-sheet__mask')) {
    scheduleRestore()
    return
  }
  const tabItem = element.closest('.q-tab__item, .q-tab__item-capsule')
  if (tabItem instanceof HTMLElement) {
    selectTabItem(tabItem)
    return
  }
  const item = element.closest('.q-list')
  const label = item?.querySelector('.q-list__title-txt')?.textContent
  if (label && navigate(label)) return
  const states = interactions.value[variantKey.value]
  const iconItem = element.closest('.qui-icon_item')
  const baseInteraction = buttonIndex >= 0 ? String(buttonIndex) : iconItem ? 'target-0' : `target-${controlIndex}`
  const alternateInteraction = `${baseInteraction}-alt`
  const interaction = activeInteraction === baseInteraction && states?.[alternateInteraction]
    ? alternateInteraction
    : activeInteraction === alternateInteraction ? baseInteraction : baseInteraction
  const state = states?.[interaction] ?? states?.[baseInteraction]
  if (iconItem) {
    const name = iconItem.querySelector('.qui-icon_name')?.textContent?.trim()
    if (!name) return
    void copyText(`<${name} />`).then((copied) => {
      if (copied && state) applyState(interaction, state)
    })
    return
  }
  if (state) {
    applyState(interaction, state)
    return
  }
  const tabbarItem = element.closest('.q-tabbar-item')
  if (tabbarItem && !state) {
    const parent = tabbarItem.parentElement
    parent?.querySelectorAll('.on').forEach((item) => item.classList.remove('on'))
    tabbarItem.classList.add('on')
  }
}

function onInput(input: HTMLInputElement | HTMLTextAreaElement) {
  const field = input.closest('.q-input')
  const counter = field?.querySelector('.q-input__indicator')
  if (counter) {
    const limit = input.maxLength > 0 ? input.maxLength : Number(counter.textContent?.match(/\/(\d+)/)?.[1] ?? 0)
    counter.textContent = `${input.value.length}/${limit}字`
  }
  const search = input.closest('.q-search-bar')
  if (search && input.value) search.classList.add('q-search-bar--focus')
}

function onChange(input: HTMLInputElement | HTMLSelectElement) {
  const checkbox = input.closest('.q-checkbox__icon')
  if (checkbox && input instanceof HTMLInputElement) checkbox.classList.toggle('q-checkbox_checked', input.checked)
}

watch([() => props.slug, variantKey], () => { void loadPage() }, { immediate: true })
onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 599px)')
  mediaQuery.addEventListener('change', onResizeChange)
  window.addEventListener('resize', onSwiperResize)
  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onTouchEnd)
  document.addEventListener('touchcancel', onTouchCancel)
  document.addEventListener('pointerdown', onPointerDown, { passive: true })
  document.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('pointerup', onPointerUp, { passive: true })
  document.addEventListener('pointercancel', onPointerCancel)
  document.addEventListener('scroll', onIndexScroll, true)
})
onBeforeUnmount(() => {
  loading++
  stopInfiniteLoading()
  stopLoadingProgress()
  window.clearTimeout(interactionTimer)
  stopAutoplay()
  clearCaptureAutoClose()
  cancelAnimations()
  mediaQuery?.removeEventListener('change', onResizeChange)
  window.removeEventListener('resize', onSwiperResize)
  document.removeEventListener('touchstart', onTouchStart)
  document.removeEventListener('touchmove', onTouchMove)
  document.removeEventListener('touchend', onTouchEnd)
  document.removeEventListener('touchcancel', onTouchCancel)
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('pointercancel', onPointerCancel)
  document.removeEventListener('scroll', onIndexScroll, true)
  document.querySelectorAll('link[data-reference-style]').forEach((link) => link.remove())
})
</script>

<template>
  <QuiReplicaRenderer ref="renderer" :markup="markup" :portals="portalMarkup" @click="onClick" @input="onInput" @change="onChange" />
</template>
