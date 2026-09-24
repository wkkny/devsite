import { expect, test, type Locator, type Page } from '@playwright/test'

async function getClientRect(locator: Locator) {
  return locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height }
  })
}

async function stubHomepageApis(page: Page) {
  await page.route('https://github-contributions-api.jogruber.de/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ contributions: [] }),
    }),
  )
  await page.route('https://counterapi.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ value: 42 }),
    }),
  )
  await page.route('**/api/now-playing', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'playing',
        track: {
          title: 'Bohemian Rhapsody',
          artist: 'Queen',
          spotifyUrl: 'https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv',
        },
      }),
    }),
  )
}

test('homepage loads and its main controls work', async ({ page }) => {
  await stubHomepageApis(page)

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Kritiraj (Kenny)' })).toBeVisible()
  await expect(page.getByText('Design Engineer', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Bohemian Rhapsody by Queen' })).toHaveAttribute(
    'href',
    'https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv',
  )
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  const workbench = page.getByText('WorkBench', { exact: true }).first()
  await workbench.scrollIntoViewIfNeeded()
  await expect(workbench).toBeVisible()

  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.getByRole('button', { name: 'List view' }).click()
  await expect(page.locator('#projects .flex.flex-col.divide-y')).toBeVisible()

  await page.getByRole('button', { name: 'Add a draggable item' }).click()
  await page.getByRole('menuitem', { name: 'Next.js' }).click()
  await expect(page.getByRole('button', { name: 'Next.js logo', exact: true })).toBeVisible()
})

test('decorations support keyboard and pointer movement without liquid deformation under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await stubHomepageApis(page)
  await page.goto('/')

  const decoration = page.getByRole('button', { name: 'TypeScript logo', exact: true })
  await expect(decoration).toBeVisible()
  await decoration.scrollIntoViewIfNeeded()
  await expect.poll(() => decoration.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(0)
  const beforeKeyboard = await getClientRect(decoration)
  await decoration.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await getClientRect(decoration)).x).toBeGreaterThan(beforeKeyboard.x + 4)

  const beforeDrag = await getClientRect(decoration)
  const from = { x: beforeDrag.x + beforeDrag.width / 2, y: beforeDrag.y + beforeDrag.height / 2 }
  const blob = page.locator('.drg-goo rect').first()
  const ball = page.locator('.drg-ball').first()
  await expect(blob).toHaveCount(1)

  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 160, from.y + 32, { steps: 6 })
  await expect.poll(async () => (await getClientRect(decoration)).x).toBeGreaterThan(beforeDrag.x + 80)
  await expect.poll(async () => {
    return blob.evaluate((element) => {
      const match = element.getAttribute('style')?.match(/scale\(([^,]+),\s*([^)]+)\)/)
      const scaleX = match ? Number(match[1]) : 1
      const scaleY = match ? Number(match[2]) : 1
      return Math.abs(scaleX - scaleY)
    })
  }).toBeLessThan(0.01)
  await page.mouse.up()

  await expect.poll(async () => {
    return blob.evaluate((element) => {
      const match = element.getAttribute('style')?.match(/scale\(([^,]+),\s*([^)]+)\)/)
      const scaleX = match ? Number(match[1]) : 1
      const scaleY = match ? Number(match[2]) : 1
      return Math.abs(scaleX - scaleY)
    })
  }).toBeLessThan(0.01)

  await expect.poll(async () => {
    const transform = await ball.evaluate((element) => getComputedStyle(element).transform)
    if (transform === 'none') return 0
    const matrix = new DOMMatrixReadOnly(transform)
    return Math.abs(Math.hypot(matrix.a, matrix.b) - Math.hypot(matrix.c, matrix.d))
  }).toBeLessThan(0.01)
})

test('decorations remain usable when the dragging ball chunk fails to load', async ({ page }) => {
  await stubHomepageApis(page)
  let chunkRequestBlocked = false
  await page.route('**/*dragging-ball*', (route) => {
    chunkRequestBlocked = true
    return route.abort()
  })
  await page.goto('/')

  const decoration = page.getByRole('button', { name: 'TypeScript logo', exact: true })
  await expect.poll(() => chunkRequestBlocked).toBe(true)
  await expect(decoration).toBeVisible()
  await decoration.scrollIntoViewIfNeeded()
  await expect.poll(() => decoration.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(0)
  const before = await getClientRect(decoration)
  await decoration.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await getClientRect(decoration)).x).toBeGreaterThan(before.x + 4)
})
