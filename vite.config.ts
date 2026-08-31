import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor'
  const isGitHubPages = mode === 'github-pages'
  const repositoryName =
    process.env.GITHUB_REPOSITORY?.split('/').at(-1) ?? 'ten'

  return {
    base: isGitHubPages ? `/${repositoryName}/` : '/',
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart(
        isCapacitor || isGitHubPages
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
