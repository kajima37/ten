import { chromium } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const outputDir = new URL(
  '../../../docs/deployment/assets/google-play/',
  import.meta.url,
)
const dateKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
}).format(new Date())

const playerState = {
  version: 4,
  best: 8800,
  plays: 11,
  total: 24800,
  dailyRecords: { [dateKey]: { best: 3200, plays: 1 } },
  streak: 1,
  lastDailyDate: dateKey,
  history: Array.from({ length: 11 }, (_, index) => ({
    id: `capture-${index}`,
    playedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    score: Math.max(1200, 8800 - index * 420),
    maxCombo: Math.min(12, 12 - Math.floor(index / 3)),
    daily: index === 0,
    durationSeconds: 60,
  })),
  unlockedAchievements: ['first_play', 'score_1000'],
}

const profile = { id: 'capture-player', name: 'Player' }
const board = [
  5, 1, 3, 1, 2, 4, 3, 1, 2, 4, 3, 5, 5, 3, 5, 4, 1, 3, 4, 2, 4, 5, 2, 4, 3,
]
const leaderboard = {
  date: dateKey,
  total: 328,
  entries: [
    { rank: 1, playerId: 'top-player', name: 'Nana', score: 12800, combo: 14 },
    {
      rank: 2,
      playerId: 'capture-player',
      name: 'Player',
      score: 8800,
      combo: 12,
    },
    { rank: 3, playerId: 'kota-player', name: 'Kota', score: 7420, combo: 10 },
  ],
  mine: { rank: 2, topPercent: 1, score: 8800 },
}

const weekly = {
  week: dateKey,
  total: 512,
  entries: leaderboard.entries.map((entry, index) => ({
    ...entry,
    streak: Math.max(1, 7 - index * 2),
  })),
  mine: leaderboard.mine,
}

async function mockApi(route) {
  const url = new URL(route.request().url())
  const body = (() => {
    if (url.pathname.endsWith('/daily')) return { dateKey, board }
    if (url.pathname.endsWith('/leaderboard')) return leaderboard
    if (url.pathname.endsWith('/leaderboard/weekly')) return weekly
    if (url.pathname.endsWith('/friends')) {
      return {
        friends: [{ id: 'friend-1', name: 'Sajima', streak: 5 }],
        requests: [],
      }
    }
    if (url.pathname.endsWith('/me'))
      return { ...profile, friendCode: 'TEN2026' }
    if (url.pathname.endsWith('/auth/register'))
      return { token: 'capture-token', player: profile }
    if (url.pathname.endsWith('/daily/start'))
      return { dateKey, board, startToken: 'capture-start' }
    return {}
  })()
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function prepare(page) {
  await page.addInitScript(
    ({ playerStateValue, dateKeyValue }) => {
      localStorage.setItem('ten_language', 'ja')
      localStorage.setItem('ten_theme', 'classic')
      localStorage.setItem('ten_tutorial_complete', 'true')
      localStorage.setItem('ten_install_prompt_dismissed', 'true')
      localStorage.setItem('ten_ads_mode', 'silent')
      localStorage.setItem('ten_token', 'capture-token')
      localStorage.setItem(
        'ten_player_profile',
        JSON.stringify({ id: 'capture-player', name: 'Player' }),
      )
      localStorage.setItem('ten_device_id', 'capture-device')
      localStorage.setItem('ten_state', JSON.stringify(playerStateValue))
      localStorage.setItem('ten_daily_capture_date', dateKeyValue)
    },
    { playerStateValue: playerState, dateKeyValue: dateKey },
  )
  await page.route('**/api/**', mockApi)
  await page.goto('http://127.0.0.1:3000/?ads=off')
  await page.addStyleTag({
    content: 'button[aria-label^="Ads:"]{display:none!important}',
  })
}

async function capture(page, filename) {
  await page.screenshot({
    path: fileURLToPath(new URL(filename, outputDir)),
    animations: 'disabled',
  })
}

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width: 480, height: 853 },
  deviceScaleFactor: 1,
  locale: 'ja-JP',
})

const feature = await context.newPage()
await feature.setViewportSize({ width: 1024, height: 500 })
await feature.setContent(
  await readFile(
    new URL(
      '../../../docs/deployment/assets/google-play/feature-graphic.svg',
      import.meta.url,
    ),
    'utf8',
  ),
)
await feature.screenshot({
  path: fileURLToPath(new URL('feature-graphic-corrected.png', outputDir)),
  animations: 'disabled',
})
await feature.close()

const home = await context.newPage()
await prepare(home)
await home.getByRole('button', { name: 'プレイ', exact: true }).waitFor()
await capture(home, '01-home-source.png')
await home.getByRole('button', { name: 'プレイ', exact: true }).click()
await home.getByText('スコア', { exact: true }).waitFor()
await capture(home, '02-game-source.png')

const daily = await context.newPage()
await prepare(daily)
await daily.getByRole('button', { name: 'デイリー', exact: true }).click()
await daily.getByRole('heading', { name: '今日のTEN.' }).waitFor()
await capture(daily, '03-daily-source.png')

const stats = await context.newPage()
await prepare(stats)
await stats.getByRole('button', { name: '統計', exact: true }).click()
await stats.getByRole('heading', { name: 'プレイ統計' }).waitFor()
await capture(stats, '04-stats-source.png')

const mypage = await context.newPage()
await prepare(mypage)
await mypage.getByRole('button', { name: 'マイページ', exact: true }).click()
await mypage.getByRole('heading', { name: 'マイページ' }).waitFor()
await capture(mypage, '05-mypage-source.png')

await browser.close()
