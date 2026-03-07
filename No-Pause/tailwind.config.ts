import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['Nunito', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '3xl': '1.5rem',
      },
      colors: {
        surface: {
          primary: 'var(--surface-card)',
          secondary: 'var(--surface-elevated)',
          elevated: 'var(--surface-elevated)',
          interactive: 'var(--surface-interactive)',
          base: 'var(--background-base)',
          card: 'var(--surface-card)',
        },
        sage: {
          50: '#f0f5f5',
          100: '#dae6e5',
          200: '#b5cccb',
          300: '#8fb3b1',
          400: '#6a9997',
          500: '#5A7D7C',
          600: '#486463',
          700: '#364b4a',
          800: '#243232',
          900: '#121919',
        },
        sand: {
          50: '#fdfcfa',
          100: '#f7f5f0',
          200: '#f2f0ea',
          300: '#e8e6df',
          400: '#d4d1c7',
          500: '#b8b4a8',
        },
        terracotta: {
          50: '#fdf3ef',
          100: '#fbe3da',
          200: '#f5c4b1',
          300: '#eca085',
          400: '#D97C5F',
          500: '#c4613e',
          600: '#a24c30',
        },
        ember: {
          100: '#5f3022',
          200: '#7a3e2b',
          300: '#954a32',
          400: '#b85d3d',
          500: '#d47451',
          600: '#e68c6a',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      boxShadow: {
        'soft': '0 10px 30px -14px rgba(230, 140, 106, 0.22)',
        'card': '0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)',
        'float': '0 22px 48px -24px rgba(0, 0, 0, 0.82)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
