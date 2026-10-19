/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "sans-serif"],
      },
      colors: {
        blue: {
          50: '#fffee6',
          100: '#fffab3',
          200: '#fff466',
          300: '#ffee1a',
          400: '#ffe500',
          500: '#ffd600',
          600: '#e6be00',
          700: '#bda000',
          800: '#8a7400',
          900: '#5c4d00',
          950: '#332b00',
        },
        indigo: {
          50: '#fffee6',
          100: '#fffab3',
          200: '#fff466',
          300: '#ffee1a',
          400: '#ffe500',
          500: '#ffd600',
          600: '#e6be00',
          700: '#bda000',
          800: '#8a7400',
          900: '#5c4d00',
          950: '#332b00',
        },
        purple: {
          50: '#fffee6',
          100: '#fffab3',
          200: '#fff466',
          300: '#ffee1a',
          400: '#ffe500',
          500: '#ffd600',
          600: '#e6be00',
          700: '#bda000',
          800: '#8a7400',
          900: '#5c4d00',
          950: '#332b00',
        },
        violet: {
          50: '#fffee6',
          100: '#fffab3',
          200: '#fff466',
          300: '#ffee1a',
          400: '#ffe500',
          500: '#ffd600',
          600: '#e6be00',
          700: '#bda000',
          800: '#8a7400',
          900: '#5c4d00',
          950: '#332b00',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "breathe": "breathe 8s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.02)" },
        },
      },
    },
  },
  plugins: [],
}
