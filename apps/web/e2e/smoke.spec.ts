import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ten_language', 'en')
  })
})

test('onboarding leads to a playable normal game', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Start' }).click()

  await page.getByRole('button', { name: 'PLAY' }).click()
  await expect(page.getByText('Score', { exact: true })).toBeVisible()
  await expect(page.getByText('Combo', { exact: true })).toBeVisible()
  await expect(page.getByText('Time', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('profile navigation and language preferences persist', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('ten_tutorial_complete', 'true')
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'My page' }).click()
  await expect(page.getByRole('heading', { name: 'MY PAGE' })).toBeVisible()

  await page.getByRole('button', { name: '日本語' }).click()
  await expect(page.getByRole('heading', { name: 'マイページ' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'マイページ' })).toBeVisible()
})
