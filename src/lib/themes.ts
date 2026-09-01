export const THEME_IDS = [
  'classic',
  'midnight',
  'cafe',
  'sakura',
  'zen',
  'neon',
] as const

export type ThemeId = (typeof THEME_IDS)[number]

export type PixiPalette = {
  canvas: number
  cell: number
  selected: number
  accent: number
  text: string
  border: number
}

export const THEME_CSS_KEYS = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--input',
  '--ring',
  '--ambient',
] as const

export type ThemeCss = Record<(typeof THEME_CSS_KEYS)[number], string>

export type ThemeDefinition = {
  id: ThemeId
  swatch: string
  palette: PixiPalette
  css: ThemeCss
}

export const THEMES: Array<ThemeDefinition> = [
  {
    id: 'classic',
    swatch: '#242426',
    palette: {
      canvas: 0x121214,
      cell: 0x1b1b1e,
      selected: 0x332b18,
      accent: 0xf3c75f,
      text: '#f6f3ed',
      border: 0x303033,
    },
    css: {
      '--background': '#09090a',
      '--foreground': '#f6f3ed',
      '--card': '#121214',
      '--card-foreground': '#f6f3ed',
      '--primary': '#f6f3ed',
      '--primary-foreground': '#111113',
      '--secondary': '#1b1b1e',
      '--secondary-foreground': '#f6f3ed',
      '--muted': '#1b1b1e',
      '--muted-foreground': '#9f9c95',
      '--accent': '#f3c75f',
      '--accent-foreground': '#15120a',
      '--border': '#2a2a2d',
      '--input': '#303033',
      '--ring': '#f3c75f',
      '--ambient': '#342b19',
    },
  },
  {
    id: 'midnight',
    swatch: '#111b33',
    palette: {
      canvas: 0x0b1020,
      cell: 0x121b31,
      selected: 0x182c50,
      accent: 0x75a7ff,
      text: '#edf4ff',
      border: 0x263a5f,
    },
    css: {
      '--background': '#070b16',
      '--foreground': '#edf4ff',
      '--card': '#0b1020',
      '--card-foreground': '#edf4ff',
      '--primary': '#dce9ff',
      '--primary-foreground': '#09101f',
      '--secondary': '#121b31',
      '--secondary-foreground': '#edf4ff',
      '--muted': '#121b31',
      '--muted-foreground': '#91a0bb',
      '--accent': '#75a7ff',
      '--accent-foreground': '#071126',
      '--border': '#263a5f',
      '--input': '#263a5f',
      '--ring': '#75a7ff',
      '--ambient': '#18366d',
    },
  },
  {
    id: 'cafe',
    swatch: '#3b281a',
    palette: {
      canvas: 0x21170f,
      cell: 0x302116,
      selected: 0x49331f,
      accent: 0xd9a66f,
      text: '#f7ead8',
      border: 0x59422d,
    },
    css: {
      '--background': '#17110c',
      '--foreground': '#f7ead8',
      '--card': '#21170f',
      '--card-foreground': '#f7ead8',
      '--primary': '#f0dcc2',
      '--primary-foreground': '#23170e',
      '--secondary': '#302116',
      '--secondary-foreground': '#f7ead8',
      '--muted': '#302116',
      '--muted-foreground': '#b7a28a',
      '--accent': '#d9a66f',
      '--accent-foreground': '#24160b',
      '--border': '#59422d',
      '--input': '#59422d',
      '--ring': '#d9a66f',
      '--ambient': '#70451f',
    },
  },
  {
    id: 'sakura',
    swatch: '#442232',
    palette: {
      canvas: 0x211219,
      cell: 0x321a25,
      selected: 0x4c2435,
      accent: 0xff9fbd,
      text: '#fff0f5',
      border: 0x5c3042,
    },
    css: {
      '--background': '#190f15',
      '--foreground': '#fff0f5',
      '--card': '#211219',
      '--card-foreground': '#fff0f5',
      '--primary': '#ffe4ed',
      '--primary-foreground': '#271019',
      '--secondary': '#321a25',
      '--secondary-foreground': '#fff0f5',
      '--muted': '#321a25',
      '--muted-foreground': '#c9a0ae',
      '--accent': '#ff9fbd',
      '--accent-foreground': '#2d0d18',
      '--border': '#5c3042',
      '--input': '#5c3042',
      '--ring': '#ff9fbd',
      '--ambient': '#782b4d',
    },
  },
  {
    id: 'zen',
    swatch: '#26352a',
    palette: {
      canvas: 0x141b17,
      cell: 0x1e2922,
      selected: 0x30422e,
      accent: 0x9ebc86,
      text: '#edf3e9',
      border: 0x3a4b3e,
    },
    css: {
      '--background': '#101513',
      '--foreground': '#edf3e9',
      '--card': '#141b17',
      '--card-foreground': '#edf3e9',
      '--primary': '#dfe9d8',
      '--primary-foreground': '#101811',
      '--secondary': '#1e2922',
      '--secondary-foreground': '#edf3e9',
      '--muted': '#1e2922',
      '--muted-foreground': '#9dab98',
      '--accent': '#9ebc86',
      '--accent-foreground': '#10190d',
      '--border': '#3a4b3e',
      '--input': '#3a4b3e',
      '--ring': '#9ebc86',
      '--ambient': '#31523a',
    },
  },
  {
    id: 'neon',
    swatch: '#251635',
    palette: {
      canvas: 0x0d0915,
      cell: 0x181022,
      selected: 0x293411,
      accent: 0xc8ff38,
      text: '#f6f2ff',
      border: 0x493261,
    },
    css: {
      '--background': '#07050d',
      '--foreground': '#f6f2ff',
      '--card': '#0d0915',
      '--card-foreground': '#f6f2ff',
      '--primary': '#ecdcff',
      '--primary-foreground': '#110719',
      '--secondary': '#181022',
      '--secondary-foreground': '#f6f2ff',
      '--muted': '#181022',
      '--muted-foreground': '#a99ab8',
      '--accent': '#c8ff38',
      '--accent-foreground': '#111704',
      '--border': '#493261',
      '--input': '#493261',
      '--ring': '#c8ff38',
      '--ambient': '#61298b',
    },
  },
]

const THEME_STYLE_ID = 'ten-theme-styles'

function buildThemeCss() {
  return THEMES.map((theme) => {
    const declarations = Object.entries(theme.css)
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n')
    return `:root[data-theme='${theme.id}'] {\n${declarations}\n}`
  }).join('\n')
}

export function injectThemeStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(THEME_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = THEME_STYLE_ID
  style.textContent = buildThemeCss()
  document.head.appendChild(style)
}

export function getThemePalette(theme: string): PixiPalette {
  return (
    THEMES.find((candidate) => candidate.id === theme)?.palette ??
    THEMES[0].palette
  )
}
