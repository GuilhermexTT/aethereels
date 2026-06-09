import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#030712',
        surface: 'rgba(11, 19, 41, 0.2)', // #0b1329/20 Glassmorphism v1.1
        surfaceMuted: 'rgba(9, 15, 28, 0.6)', // #090f1c/60 Sub-containers
        borderCustom: 'rgba(30, 41, 59, 0.4)', // #1e293b/40 Sutil borders
        borderGlow: 'rgba(6, 182, 212, 0.3)', // border-cyan-500/30 Active border
        accent: {
          primary: '#0070f3', // Institutional Blue
          cyan: '#00e5ff', // Neon Cyan
        },
      },
      backgroundImage: {
        'main-gradient': 'linear-gradient(to right, #3b82f6, #00e5ff)',
      },
    },
  },
  plugins: [],
};

export default config;
