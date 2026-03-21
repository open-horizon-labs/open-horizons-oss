import type { Config } from 'tailwindcss'

const preset = require('@oh/ui/tailwind.config')

export default {
  presets: [preset.default ?? preset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './packages/ui/src/**/*.{ts,tsx}'
  ],
  theme: { extend: {} },
  plugins: []
} satisfies Config

