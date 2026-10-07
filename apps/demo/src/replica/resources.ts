import type { PageVariant, RouteVariants, InteractionState, MotionPhaseMap } from './types'

const routes: Record<string, RouteVariants> = JSON.parse(document.getElementById('qui-reference')!.textContent!).routes
export const pageVariant = (slug: string, device: 'mobile' | 'desktop'): PageVariant => (routes[slug] ?? routes.index)![device]
const base = new URL(import.meta.env.BASE_URL, document.baseURI).href
const url = (path: string) => new URL(path, base).href
const resolveMarkup = (text: string) => text.replaceAll('__QUI_BASE__', base)
async function request(path: string, signal: AbortSignal, priority: RequestPriority = 'low') {
  const response = await fetch(url(path), { signal, priority })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`)
  return response
}
export async function loadMarkup(page: PageVariant, signal: AbortSignal) {
  return resolveMarkup(await (await request(page.html, signal, 'high')).text())
}
export async function loadInteractions(page: PageVariant, signal: AbortSignal): Promise<Record<string, InteractionState>> {
  if (!page.states) return {}
  const states: Record<string, InteractionState> = await (await request(page.states, signal)).json()
  return Object.fromEntries(Object.entries(states).map(([key, state]) => [key, {
    ...state, ...(state.markup === undefined ? {} : { markup: resolveMarkup(state.markup) }), portals: state.portals.map(resolveMarkup),
  }]))
}
export async function loadMotions(page: PageVariant, signal: AbortSignal): Promise<MotionPhaseMap> {
  return page.motion ? (await request(page.motion, signal)).json() : {}
}
export async function setStyles(styles: string[], signal: AbortSignal) {
  const previous = [...document.querySelectorAll<HTMLLinkElement>('link[data-reference-style]')]
  const wanted = new Set(styles.map(url))
  const added: HTMLLinkElement[] = []
  try {
    await Promise.all(styles.map(path => {
      const href = url(path)
      const existing = previous.find(link => link.href === href)
      if (existing?.sheet) return Promise.resolve()
      return new Promise<void>((resolve, reject) => {
        const link = existing ?? document.createElement('link')
        const cleanup = () => { link.onload = null; link.onerror = null; signal.removeEventListener('abort', abort) }
        const abort = () => { cleanup(); reject(signal.reason) }
        link.onload = () => { cleanup(); resolve() }
        link.onerror = () => { cleanup(); reject(new Error(`Stylesheet failed: ${path}`)) }
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) return abort()
        if (!existing) {
          link.rel = 'stylesheet'; link.href = href; link.dataset.referenceStyle = ''; added.push(link); document.head.append(link)
        }
      })
    }))
    signal.throwIfAborted()
    previous.filter(link => !wanted.has(link.href) && !link.hasAttribute('data-reference-shared')).forEach(link => link.remove())
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[data-reference-style]')]
    const ordered = styles.map(path => links.find(link => link.href === url(path))!)
    if (ordered.some((link, index) => link !== links[index])) ordered.forEach(link => document.head.append(link))
  } catch (error) { added.forEach(link => link.remove()); throw error }
}
