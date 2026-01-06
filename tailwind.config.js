/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'sans': ['Pretendard', 'system-ui', 'sans-serif'],
      },
      colors: {
        'kustody': {
          'dark': '#0a0f1a',
          'navy': '#1a2744',
          'accent': '#00d4aa',
          'accent-dim': '#00a080',
          'surface': '#141c2e',
          'border': '#2a3a54',
          'text': '#e4e8ef',
          'muted': '#8892a4',
        }
      }
    },
  },
  plugins: [],
}
