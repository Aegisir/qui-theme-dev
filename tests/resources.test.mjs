import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, dirname, extname } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { root, routes } from './support.mjs'

const generated = resolve(root, 'apps/demo/.cache/public')
const input = resolve(root, 'apps/demo/reference')
const manifest = JSON.parse(await readFile(resolve(root, 'apps/demo/.cache/manifest.json')))
const hash = data => createHash('sha256').update(data).digest('hex').slice(0, 16)
async function normalize(source) {
  for (const match of new Set(source.match(/data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+/g) ?? [])) {
    const data = Buffer.from(match.slice(match.indexOf(',') + 1), 'base64')
    const extension = match.slice(11, match.indexOf(';')).replace('jpeg', 'jpg')
    const path = `reference/assets/${hash(data)}.${extension}`
    assert.deepEqual(await readFile(resolve(generated, path)), data)
    source = source.replaceAll(match, `__QUI_BASE__${path}`)
  }
  for (const match of new Set(source.match(/\/reference\/assets\/[^"'\s)&]+/g) ?? [])) {
    const data = await readFile(resolve(input, match.replace('/reference/', '')))
    source = source.replaceAll(match, `__QUI_BASE__reference/assets/${hash(data)}${extname(match)}`)
  }
  return source.replace(/(<image\b[^>]*?)xlink:href="(__QUI_BASE__[^"#]+)"/g, '$1data-qui-raster="$2"')
}
test('all 39 routes and interaction snapshots preserve content, portals and scroll paths', async () => {
  assert.equal(Object.keys(manifest.routes).length, 39)
  for (const [slug, variants] of Object.entries(routes)) {
    const states = JSON.parse(await readFile(resolve(input, `states/${slug}.json`)).catch(() => '{}'))
    for (const [device, original] of Object.entries(variants)) {
      const page = manifest.routes[slug][device]
      const markup = await normalize(gunzipSync(await readFile(resolve(input, original.html.replace('/reference/', '')))).toString())
      assert.equal(await readFile(resolve(generated, page.html), 'utf8'), markup, `${slug}/${device}`)
      const compact = page.states ? JSON.parse(await readFile(resolve(generated, page.states))) : {}
      assert.deepEqual(Object.keys(compact), Object.keys(states[device] ?? {}))
      for (const [key, state] of Object.entries(states[device] ?? {})) {
        assert.equal(compact[key].markup ?? markup, await normalize(state.markup), `${slug}/${device}/${key}`)
        assert.deepEqual(compact[key].portals, await Promise.all(state.portals.map(normalize)))
        assert.deepEqual(compact[key].scrolls, state.scrolls)
      }
      for (const css of page.styles) await readFile(resolve(generated, css))
      if (page.motion) await readFile(resolve(generated, page.motion))
    }
  }
})
test('generated stylesheet asset URLs resolve and icon state fits 2KB budget', async () => {
  const directory = resolve(generated, 'reference/styles')
  for (const name of await readdir(directory)) {
    const file = resolve(directory, name)
    for (const [, target] of (await readFile(file, 'utf8')).matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
      if (target.startsWith('data:') || target.startsWith('#')) continue
      assert.ok(!target.startsWith('http'), `External asset: ${target}`)
      await readFile(resolve(dirname(file), target))
    }
  }
  assert.ok(gzipSync(await readFile(resolve(generated, manifest.routes.icon.mobile.states))).length < 2048)
})
