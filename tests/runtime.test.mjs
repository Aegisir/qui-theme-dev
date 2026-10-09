import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { build } from 'vite'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { browser, serve, setTheme, root, artifacts } from './support.mjs'

let chrome, fixture, gallery
before(async () => {
  const outDir = resolve(artifacts, 'fixture')
  const require = createRequire(resolve(root, 'apps/demo/package.json'))
  await build({ configFile: false, logLevel: 'silent', base: './', resolve: { alias: { vue: require.resolve('vue/dist/vue.runtime.esm-bundler.js') } }, define: { 'process.env.NODE_ENV': '"production"' }, build: { outDir, emptyOutDir: true, rolldownOptions: { input: resolve(root, 'tests/fixture.js'), output: { entryFileNames: 'fixture.js' } } } })
  const { readdir } = await import('node:fs/promises')
  const css = (await readdir(resolve(outDir, 'assets'))).find(name => name.endsWith('.css'))
  await writeFile(resolve(outDir, 'index.html'), `<!doctype html><html lang="zh-CN"><head><link rel="stylesheet" href="./assets/${css}"></head><body><div id="app"></div><script type="module" src="./fixture.js"></script></body></html>`)
  fixture = await serve(outDir, '/library/')
  gallery = await serve('apps/demo/dist', '/gallery/')
  chrome = await browser()
})
after(async () => { await chrome?.close(); await fixture?.close(); await gallery?.close() })
async function withFixture(run) {
  const page = await chrome.newPage()
  try { await page.goto(fixture.url); await page.waitForFunction(() => window.harness); await run(page) } finally { await page.close() }
}
test('stack preserves scroll lock, traps focus, closes only top and releases on unmount', () => withFixture(async page => {
  await page.evaluate(() => {
    const trigger = document.createElement('button')
    trigger.id = 'trigger'; trigger.textContent = 'Open'; document.body.append(trigger); trigger.focus()
    window.harness.mount('stack', { a: true, b: false })
  })
  await page.waitForFunction(() => document.activeElement?.closest('[role="dialog"]'))
  await page.evaluate(() => window.harness.update({ b: true }))
  await page.waitForFunction(() => document.activeElement?.closest('[role="dialog"]')?.textContent.includes('b'))
  const top = page.getByRole('dialog').last()
  const first = top.locator('button').first(), last = top.locator('button').last()
  await last.focus(); await page.keyboard.press('Tab')
  assert.equal(await first.evaluate(element => document.activeElement === element), true)
  await page.keyboard.press('Shift+Tab')
  assert.equal(await last.evaluate(element => document.activeElement === element), true)
  await page.waitForSelector('.qui-overlay-open', { state: 'attached' })
  await page.evaluate(() => window.harness.update({ a: false }))
  assert.equal(await page.locator('body').evaluate(body => body.classList.contains('qui-overlay-open')), true)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.body.classList.contains('qui-overlay-open'))
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'trigger')
  await page.evaluate(() => window.harness.update({ a: true, b: true }))
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('body').evaluate(body => body.classList.contains('qui-overlay-open')), true)
  await page.evaluate(() => window.harness.unmount())
  assert.equal(await page.locator('body').evaluate(body => body.classList.contains('qui-overlay-open')), false)
}))
test('native button type and disabled options', () => withFixture(async page => {
  await page.evaluate(() => window.harness.mount('QuiButton'))
  assert.equal(await page.locator('button').getAttribute('type'), 'button')
  await page.evaluate(() => window.harness.update({ nativeType: 'submit' }))
  assert.equal(await page.locator('button').getAttribute('type'), 'submit')
  for (const name of ['QuiTabs', 'QuiTabBar', 'QuiActionSheet', 'QuiShareSheet', 'QuiSlipDrawer']) {
    await page.evaluate(name => window.harness.mount(name, { show: true, actions: [{ label: 'Disabled', value: 1, disabled: true }], options: [{ label: 'Disabled', value: 1, disabled: true }], items: [{ label: 'Disabled', value: 1, disabled: true }] }), name)
    assert.equal(await page.locator('button').filter({ hasText: 'Disabled' }).isDisabled(), true, name)
  }
}))
test('picker restores canceled draft and datetime tracks external value', () => withFixture(async page => {
  await page.evaluate(() => window.harness.mount('QuiPicker', { show: true, columns: [['A', 'B']], modelValue: ['A'] }))
  await page.getByRole('button', { name: 'B', exact: true }).click()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await page.evaluate(() => window.harness.update({ show: false }))
  await page.evaluate(() => window.harness.update({ show: true }))
  assert.equal(await page.locator('.qui-picker__option.is-selected').textContent(), 'A')
  await page.evaluate(() => window.harness.mount('QuiDatetimePicker', { show: true, modelValue: '2026-01-01' }))
  await page.evaluate(() => window.harness.update({ modelValue: '2026-10-08' }))
  assert.equal(await page.locator('input').inputValue(), '2026-10-08')
}))
test('swiper responds to autoplay, interval, dynamic slides and empty content', () => withFixture(async page => {
  await page.evaluate(() => window.harness.mount('QuiSwiper', { count: 3, autoplay: false, interval: 80 }))
  await page.evaluate(() => window.harness.update({ autoplay: true }))
  await page.waitForFunction(() => window.harness.events.some(([name]) => name === 'change'))
  await page.evaluate(() => window.harness.update({ autoplay: false, count: 0 }))
  await page.waitForFunction(() => document.querySelector('.qui-swiper__track').style.transform.includes('0%'))
  const events = await page.evaluate(() => window.harness.events.length)
  await page.waitForTimeout(200)
  assert.equal(await page.evaluate(() => window.harness.events.length), events)
  assert.doesNotMatch(await page.locator('.qui-swiper__track').getAttribute('style'), /NaN/)
}))
test('indexes have unique IDs per instance', () => withFixture(async page => {
  await page.evaluate(() => window.harness.mount('indexes'))
  const ids = await page.locator('.qui-indexes section').evaluateAll(items => items.map(item => item.id))
  assert.equal(ids.length, new Set(ids).size)
}))
test('icon data retries a failed request in the same browser module context', () => withFixture(async page => {
  let attempts = 0
  await page.route('**/common-0-*.json', async route => { attempts++; if (attempts === 1) await route.fulfill({ status: 503, body: 'retry' }); else await route.continue() })
  const failure = page.waitForResponse(response => response.url().includes('common-0-') && response.status() === 503)
  await page.evaluate(() => window.harness.mount('QuiIcon', { name: 'Add' }))
  await failure
  await page.evaluate(() => window.harness.retry())
  await page.waitForSelector('.qui-icon svg')
  assert.equal(attempts, 2)
}))
test('gallery supports subdirectory, keyboard navigation and route cancellation', async () => {
  const page = await chrome.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  try {
    await page.goto(gallery.url + '#/index')
    await page.getByRole('link', { name: '图标 Icon', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.waitForSelector('.qui-icon_item')
    assert.ok(await page.getByRole('button').count() > 100)
    await page.evaluate(() => { location.hash = '#/area'; setTimeout(() => { location.hash = '#/button' }, 10) })
    await page.waitForFunction(() => document.title === '按钮 Button' && document.querySelector('button'))
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('.q-picker').count(), 0)
    const links = await page.locator('link[data-reference-style]').evaluateAll(items => items.map(item => item.href))
    assert.equal(links.length, new Set(links).size)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
for (const colorScheme of ['light', 'dark']) test(`theme messages preserve the reference protocol under ${colorScheme} system preference`, async () => {
  const page = await chrome.newPage({ viewport: { width: 390, height: 844 }, colorScheme })
  const background = () => page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor)
  const saved = () => page.evaluate(() => localStorage.getItem('qui_themeId'))
  try {
    await page.goto(gallery.url + '#/index'); await page.waitForLoadState('networkidle')
    const initial = colorScheme === 'dark' ? 'rgb(15, 15, 18)' : 'rgb(240, 240, 242)'
    assert.equal(await background(), initial, 'default theme follows the system')
    await page.evaluate(() => document.body.classList.add('unrelated'))
    await setTheme(page, 'dark')
    assert.equal(await background(), 'rgb(15, 15, 18)')
    assert.equal(await saved(), 'dark')
    await setTheme(page, 'default-white', false)
    assert.equal(await background(), 'rgb(245, 245, 245)')
    assert.equal(await saved(), 'dark', 'temporary selection keeps the saved choice')
    await setTheme(page, 'default-dark', false)
    assert.equal(await background(), 'rgb(15, 15, 18)')
    assert.equal(await page.locator('html').evaluate(html => getComputedStyle(html).backgroundColor), 'rgba(0, 0, 0, 0)', 'the canvas uses the themed body background, as on the reference')
    assert.equal(await page.locator('html').evaluate(html => getComputedStyle(html).colorScheme), 'normal', 'theme messages preserve the reference native-control scheme')
    await page.evaluate(() => { location.hash = '#/dialog' })
    await page.waitForFunction(() => document.title === '弹窗 Dialog' && document.querySelector('.container button'))
    await page.locator('.container button').first().click()
    await page.waitForSelector('.qui-replica-portals .q-dialog__box')
    assert.equal(await page.locator('.qui-replica-portals .q-dialog__box').evaluate(box => getComputedStyle(box).backgroundColor), 'rgb(47, 48, 51)')
    await setTheme(page, 'default', false)
    assert.equal(await background(), 'rgb(240, 240, 242)')
    assert.equal(await page.locator('.qui-replica-portals .q-dialog__box').evaluate(box => getComputedStyle(box).backgroundColor), 'rgb(255, 255, 255)')
    assert.equal(await saved(), null)
    assert.equal(await page.locator('body').getAttribute('class'), 'unrelated')
    await setTheme(page, 'dark')
    await page.reload(); await page.waitForLoadState('networkidle')
    assert.equal(await background(), initial, 'reload returns to the system theme')
    assert.equal(await saved(), 'dark')
  } finally { await page.close() }
})

for (const colorScheme of ['light', 'dark']) test(`system theme controls the first frame and navigation switch in ${colorScheme} mode`, async () => {
  const page = await chrome.newPage({ viewport: { width: 390, height: 844 }, colorScheme, isMobile: true, hasTouch: true })
  const initialDark = colorScheme === 'dark'
  const initial = initialDark ? 'rgb(15, 15, 18)' : 'rgb(240, 240, 242)'
  const toggle = page.getByRole('switch', { name: '深色模式', exact: true })
  const checked = () => toggle.getAttribute('aria-checked')
  let release
  const gate = new Promise(resolve => { release = resolve })
  await page.route('**/assets/index-*.js', async route => { await gate; await route.continue() })
  try {
    await page.goto(gallery.url + '#/index', { waitUntil: 'commit' })
    await page.waitForSelector('body', { state: 'attached' })
    assert.equal(await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor), initial, 'theme is applied before the entry module arrives')
    release()
    await toggle.waitFor({ state: 'visible', timeout: 3000 }); await page.waitForLoadState('networkidle')
    assert.equal(await checked(), String(initialDark))
    const color = page.getByRole('link', { name: '色彩 Color', exact: true })
    assert.ok((await toggle.boundingBox()).y < (await color.boundingBox()).y)
    await page.evaluate(() => { window.themeProbe = { root: document.querySelector('.container'), links: [...document.querySelectorAll('.q-list[role="link"]')], requests: performance.getEntriesByType('resource').length } })
    await page.emulateMedia({ colorScheme: initialDark ? 'light' : 'dark' })
    await page.waitForFunction(value => document.querySelector('[data-qui-theme] [role="switch"]')?.getAttribute('aria-checked') === value, String(!initialDark))
    await toggle.focus(); await page.keyboard.press('Space')
    assert.equal(await checked(), String(initialDark))
    await page.emulateMedia({ colorScheme }); await page.emulateMedia({ colorScheme: initialDark ? 'light' : 'dark' })
    await page.waitForTimeout(60)
    assert.equal(await checked(), String(initialDark), 'manual selection takes precedence for this session')
    assert.equal(await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor), initial)
    assert.deepEqual(await page.evaluate(() => ({ root: window.themeProbe.root === document.querySelector('.container'), links: window.themeProbe.links.every(link => link.isConnected), requests: performance.getEntriesByType('resource').length - window.themeProbe.requests })), { root: true, links: true, requests: 0 })
    await page.keyboard.press('Enter')
    assert.equal(await checked(), String(!initialDark))
    await page.getByText('深色模式', { exact: true }).tap()
    await page.getByRole('link', { name: '按钮 Button', exact: true }).click()
    await page.waitForFunction(() => document.title === '按钮 Button' && document.querySelector('.container button'))
    await page.evaluate(() => { location.hash = '#/index' })
    await toggle.waitFor({ state: 'visible' })
    assert.equal(await checked(), String(initialDark), 'navigation keeps the manual selection')
    await page.setViewportSize({ width: 1280, height: 844 }); await page.waitForLoadState('networkidle')
    await toggle.waitFor({ state: 'visible' })
    assert.equal(await toggle.count(), 1)
    assert.equal(await checked(), String(initialDark))
    await page.reload(); await toggle.waitFor({ state: 'visible' })
    assert.equal(await checked(), String(!initialDark), 'reload resumes following the current system preference')
  } finally { release(); await page.close() }
})

for (const colorScheme of ['light', 'dark']) for (const slower of ['html', 'css']) {
  test(`navigation preserves styled frames with delayed ${slower} in ${colorScheme} mode`, async () => {
    const page = await chrome.newPage({ viewport: { width: 390, height: 844 }, colorScheme })
    const manifest = JSON.parse(await readFile(resolve(root, 'apps/demo/.cache/manifest.json')))
    const target = manifest.routes.button.mobile
    const css = target.styles.find(path => !manifest.routes.index.mobile.styles.includes(path))
    let release
    const gate = new Promise(resolve => { release = resolve })
    await page.route('**/' + target.html, async route => { if (slower === 'html') await gate; await route.continue() })
    await page.route('**/' + css, async route => {
      if (slower === 'css') await gate
      await route.fulfill({ contentType: 'text/css', body: await readFile(resolve(root, 'apps/demo/dist', css), 'utf8') + '\nbody { --navigation-probe: ready; }' })
    })
    try {
      await page.goto(gallery.url + '#/index'); await page.waitForLoadState('networkidle')
      await setTheme(page, colorScheme === 'dark' ? 'default-dark' : 'default', false)
      const before = await page.locator('.container').innerHTML()
      await page.evaluate(() => {
        const sheets = [...document.querySelectorAll('link[data-reference-shared]')].map(link => [link, link.sheet])
        const background = getComputedStyle(document.body).backgroundColor
        window.navigationIssues = []
        let running = true
        window.stopNavigationProbe = () => { running = false; return window.navigationIssues }
        const sample = () => {
          if (!document.querySelector('.container')?.children.length) window.navigationIssues.push('empty content')
          if (sheets.some(([link, sheet]) => link.sheet !== sheet)) window.navigationIssues.push('shared stylesheet detached')
          if (getComputedStyle(document.body).backgroundColor !== background) window.navigationIssues.push('background changed')
          if (running) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
      const fast = page.waitForResponse(response => response.url().endsWith(slower === 'html' ? css : target.html))
      await page.getByRole('link', { name: '按钮 Button', exact: true }).click()
      await fast
      await page.waitForFunction(() => document.querySelector('.container')?.getAttribute('aria-busy') === 'true')
      assert.equal(await page.locator('.container').evaluate((element, html) => element.innerHTML === html, before), true, 'keep the previous page while loading')
      if (slower === 'html') {
        await page.waitForFunction(css => [...document.querySelectorAll('link')].some(link => link.href.endsWith(css) && link.sheet), css)
        assert.equal(await page.locator('body').evaluate(body => getComputedStyle(body).getPropertyValue('--navigation-probe').trim()), '', 'pending CSS must not affect the previous page')
      }
      release()
      await page.waitForSelector('.button-demo')
      await page.waitForFunction(() => document.querySelector('.container')?.getAttribute('aria-busy') === 'false')
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      assert.equal(await page.locator('body').evaluate(body => getComputedStyle(body).getPropertyValue('--navigation-probe').trim()), 'ready')
      assert.deepEqual(await page.evaluate(() => [...new Set(window.stopNavigationProbe())]), [])
    } finally { release(); await page.close() }
  })
}

for (const failure of ['html', 'css']) test(`failed ${failure} and canceled navigation retain the page and discard pending styles`, async () => {
  const page = await chrome.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const manifest = JSON.parse(await readFile(resolve(root, 'apps/demo/.cache/manifest.json')))
  const target = manifest.routes.button.mobile
  const failedPath = failure === 'html' ? target.html : target.styles.find(path => !manifest.routes.index.mobile.styles.includes(path))
  let attempts = 0, release, pending
  const gate = new Promise(resolve => { release = resolve })
  const blocked = new Promise(resolve => { pending = resolve })
  await page.route('**/' + failedPath, async route => {
    attempts++
    if (attempts === 1) await route.fulfill({ status: 503, body: 'retry' })
    else if (attempts === 2) { pending(); await gate; await route.continue() }
    else await route.continue()
  })
  try {
    await page.goto(gallery.url + '#/index'); await page.waitForLoadState('networkidle')
    await setTheme(page, 'default-dark', false)
    const before = await page.locator('.container').innerHTML()
    await page.getByRole('link', { name: '按钮 Button', exact: true }).click()
    await page.waitForSelector('[role="alert"]')
    assert.equal(await page.locator('.container').evaluate((element, html) => element.innerHTML === html, before), true)
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await blocked
    await page.getByRole('link', { name: '图标 Icon', exact: true }).click()
    await page.waitForSelector('.qui-icon_item')
    release()
    await page.waitForLoadState('networkidle')
    const styles = await page.locator('link[data-reference-style]').evaluateAll(links => links.map(link => ({ path: new URL(link.href).pathname.split('/gallery/')[1], loaded: !!link.sheet, media: link.media })))
    assert.deepEqual(styles.map(style => style.path), manifest.routes.icon.mobile.styles)
    assert.ok(styles.every(style => style.loaded && style.media !== 'not all'))
    await page.evaluate(() => { location.hash = '#/button' })
    await page.waitForSelector('.button-demo')
    assert.equal(attempts, 3)
  } finally { release(); await page.close() }
})

test('failed interaction request can retry without losing the first click', async () => {
  const page = await chrome.newPage()
  const manifest = JSON.parse(await readFile(resolve(root, 'apps/demo/.cache/manifest.json')))
  const statePath = manifest.routes.dialog.desktop.states
  let attempts = 0
  await page.route('**/' + statePath, async route => { attempts++; if (attempts === 1) await route.fulfill({ status: 503, body: 'retry' }); else await route.continue() })
  try {
    await page.goto(gallery.url + '#/dialog')
    await page.waitForSelector('[role="alert"]')
    await page.locator('.container button').first().click()
    await page.waitForSelector('.qui-replica-portals .q-dialog__box')
    assert.equal(attempts, 2)
  } finally { await page.close() }
})

test('icon first click waits for its deferred controller', async () => {
  const page = await chrome.newPage({ viewport: { width: 390, height: 844 } })
  let release
  const gate = new Promise(resolve => { release = resolve })
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() } }))
  await page.route('**/controllers-*.js', async route => { await gate; await route.continue() })
  try {
    await page.goto(gallery.url + '#/icon', { waitUntil: 'domcontentloaded' })
    await page.locator('.qui-icon_item').first().click()
    assert.equal(await page.locator('.qui-replica-portals').count(), 0)
    release()
    await page.waitForSelector('.qui-replica-portals .q-toast')
  } finally { release(); await page.close() }
})

test('gallery preserves confirmed picker values across routes and discards canceled drafts', async () => {
  const page = await chrome.newPage({ viewport: { width: 390, height: 844 } })
  const open = async () => {
    await page.locator('.container button').first().click()
    await page.waitForFunction(() => document.querySelector('.q-picker-column')?.style.touchAction === 'none')
  }
  const selected = () => page.locator('.q-picker-column').first().evaluate(column => [...column.children].find(item => item.style.height === '56px')?.textContent)
  const close = async label => {
    await page.locator('.q-picker__btn').filter({ hasText: label }).click()
    await page.waitForSelector('.qui-replica-portals > *', { state: 'detached' })
  }
  try {
    await page.goto(gallery.url + '#/picker'); await page.waitForLoadState('networkidle'); await open()
    await page.locator('.q-picker-column').first().locator('li').nth(1).dispatchEvent('click')
    const confirmed = await selected()
    await close('确定')
    await page.evaluate(() => { location.hash = '#/button' })
    await page.waitForFunction(() => document.title === '按钮 Button' && document.querySelector('.container button'))
    await page.evaluate(() => { location.hash = '#/picker' }); await page.waitForLoadState('networkidle'); await open()
    assert.equal(await selected(), confirmed)
    await page.locator('.q-picker-column').first().locator('li').nth(0).dispatchEvent('click')
    await close('取消'); await open()
    assert.equal(await selected(), confirmed)
  } finally { await page.close() }
})

test('mouse and touch swipes work and canceled gestures cannot update the next route', async () => {
  const context = await chrome.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  try {
    for (const kind of ['mouse', 'touch']) {
      await page.goto('about:blank'); await page.goto(gallery.url + '#/blank-page'); await page.waitForLoadState('networkidle')
      const swiper = page.locator('.q-swiper').first()
      const box = await swiper.boundingBox(), y = Math.min(700, box.y + box.height / 2)
      const before = await swiper.locator('.q-swiper__list').evaluate(list => list.style.transform)
      if (kind === 'mouse') {
        await page.mouse.move(280, y); await page.mouse.down(); await page.mouse.move(100, y, { steps: 4 }); await page.mouse.up()
      } else {
        const session = await context.newCDPSession(page)
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 280, y }] })
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 100, y }] })
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await session.detach()
      }
      await page.waitForFunction(before => document.querySelector('.q-swiper__list').style.transform !== before, before)
    }
    await page.goto(gallery.url + '#/swiper'); await page.waitForLoadState('networkidle')
    await page.waitForFunction(() => document.title === '轮播 Swiper' && document.querySelector('.q-swiper')?.getBoundingClientRect().height)
    const box = await page.locator('.q-swiper').first().boundingBox()
    await page.mouse.move(280, box.y + 20); await page.mouse.down(); await page.mouse.move(100, box.y + 20)
    await page.evaluate(() => { location.hash = '#/button' }); await page.mouse.up()
    await page.waitForFunction(() => document.title === '按钮 Button' && document.querySelector('.container button'))
    await page.waitForTimeout(700)
    assert.equal(await page.locator('.q-swiper').count(), 0)
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
})
