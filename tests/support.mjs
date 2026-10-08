import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium } from 'playwright'

export const root = resolve(import.meta.dirname, '..')
export const artifacts = resolve(root, 'artifacts/local')
export const routes = JSON.parse(await readFile(resolve(root, 'apps/demo/public/reference/routes.json')).catch(() => readFile(resolve(root, 'apps/demo/reference/routes.json'))))
export async function browser() {
  try { return await chromium.launch({ headless: true }) }
  catch { return chromium.launch({ channel: 'chrome', headless: true }) }
}
export async function setTheme(page, themeId, isSave) {
  await page.evaluate(data => new Promise(resolve => {
    window.addEventListener('message', () => resolve(), { once: true })
    window.postMessage(data, location.origin)
  }), { themeId, isSave })
}
export async function serve(directory, prefix = '/') {
  const base = resolve(directory)
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf' }
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      if (!pathname.startsWith(prefix)) throw new Error('Outside mount')
      const relative = pathname.slice(prefix.length) || 'index.html'
      const file = resolve(base, relative.endsWith('/') ? `${relative}index.html` : relative)
      if (!file.startsWith(base + sep) || !(await stat(file)).isFile()) throw new Error('Missing file')
      let data = await readFile(file)
      const extension = extname(file.endsWith('.gz') ? file.slice(0, -3) : file)
      const headers = { 'Content-Type': types[extension] || 'application/octet-stream', 'Cache-Control': 'no-cache' }
      if (file.endsWith('.gz')) headers['Content-Encoding'] = 'gzip'
      else if (request.headers['accept-encoding']?.includes('gzip') && /\.(html|js|css|json)$/.test(file)) {
        data = gzipSync(data)
        headers['Content-Encoding'] = 'gzip'
      }
      response.writeHead(200, headers).end(data)
    } catch { response.writeHead(404).end('Not found') }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${server.address().port}${prefix}`, close: () => new Promise(resolve => server.close(resolve)) }
}
