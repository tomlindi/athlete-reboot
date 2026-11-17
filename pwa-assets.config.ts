import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Erzeugt alle App-Icons aus public/logo.svg: npm run icons
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // iPhone-Icon ohne Rand, iOS rundet die Ecken selbst ab
    apple: { sizes: [180], padding: 0 },
    maskable: { sizes: [512], padding: 0 },
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
  },
  images: ['public/logo.svg'],
})
