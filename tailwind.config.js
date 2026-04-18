/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        accent: {
          blue: 'var(--accent-blue)',
          red: 'var(--accent-red)',
          green: 'var(--accent-green)',
          orange: 'var(--accent-orange)',
          purple: 'var(--accent-purple)',
          yellow: 'var(--accent-yellow)',
        }
      }
    },
  },
  plugins: [],
}
