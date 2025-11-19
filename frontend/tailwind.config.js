/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Linear-style greys
        background: "#09090b", // Deep black/zinc
        surface: "#18181b",    // Slightly lighter for cards
        border: "#27272a",     // Distinct borders
        
        // Semantic colors
        primary: "#3b82f6",    // Electric Blue
        success: "#22c55e",
        warning: "#eab308",
        danger: "#ef4444",
        
        // Text
        muted: "#a1a1aa",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'], // For numbers
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
