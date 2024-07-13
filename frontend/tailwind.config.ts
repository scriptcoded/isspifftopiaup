import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Playfair Display', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
export default config;
