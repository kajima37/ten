import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ mode }) => {
  const isGithubPages = mode === 'github-pages'
  const isStaticSpa = mode === 'worker' || mode === 'capacitor' || isGithubPages
  const repositoryName =
    process.env.GITHUB_REPOSITORY?.split('/').at(-1) ?? 'ten'

  return {
    base: isGithubPages ? `/${repositoryName}/` : '/',
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart(
        isStaticSpa
          ? {
              spa: {
                enabled: true,
                prerender: { outputPath: '/index.html' },
              },
            }
          : undefined,
      ),
      viteReact(),
    ],
  }
})

export default config
