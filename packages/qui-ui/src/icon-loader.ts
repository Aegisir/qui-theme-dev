import index from './data/icon-index.json'

type IconMap = Record<string, string>
type IconModule = { default: IconMap }

const chunkFor = index as Record<string, string>
const loaders: Record<string, () => Promise<IconModule>> = {
  'aio-0': () => import('./data/icon-chunks/aio-0.json') as Promise<IconModule>,
  'brand-0': () => import('./data/icon-chunks/brand-0.json') as Promise<IconModule>,
  'common-0': () => import('./data/icon-chunks/common-0.json') as Promise<IconModule>,
  'common-1': () => import('./data/icon-chunks/common-1.json') as Promise<IconModule>,
  'common-2': () => import('./data/icon-chunks/common-2.json') as Promise<IconModule>,
  'file-0': () => import('./data/icon-chunks/file-0.json') as Promise<IconModule>,
  'other-0': () => import('./data/icon-chunks/other-0.json') as Promise<IconModule>,
  'qzone-0': () => import('./data/icon-chunks/qzone-0.json') as Promise<IconModule>,
}
const cache = new Map<string, Promise<IconMap>>()

export async function loadIcon(name: string) {
  const key = name in chunkFor ? name : name.replace(/^Q/, '')
  const chunk = chunkFor[key]
  const loader = loaders[chunk]
  if (!loader) return ''
  let icons = cache.get(chunk)
  if (!icons) {
    icons = loader().then((module) => module.default)
    cache.set(chunk, icons)
  }
  const data = await icons
  return data[name] ?? data[key] ?? ''
}
