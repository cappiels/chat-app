/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Modern Professional Color System
      colors: {
        // Brand Colors - Modern Blue/Slate Professional
        primary: {
          25: '#f8fafc',
          50: '#f1f5f9',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#64748b',
          500: '#475569', // Main brand color
          600: '#334155',
          700: '#1e293b',
          800: '#0f172a',
          900: '#020617',
          950: '#020617'
        },
        
        // Accent Colors - Modern Blue
        accent: {
          25: '#f0f9ff',
          50: '#e0f2fe',
          100: '#bae6fd',
          200: '#7dd3fc',
          300: '#38bdf8',
          400: '#0ea5e9',
          500: '#0284c7', // Main accent color
          600: '#0369a1',
          700: '#0c4a6e',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49'
        },
        
        // Channel Color Coding System - Professional & Distinct
        channel: {
          // Blue family
          'blue': {
            light: '#dbeafe',
            DEFAULT: '#3b82f6',
            dark: '#1d4ed8'
          },
          // Green family
          'green': {
            light: '#dcfce7',
            DEFAULT: '#22c55e',
            dark: '#15803d'
          },
          // Purple family
          'purple': {
            light: '#f3e8ff',
            DEFAULT: '#8b5cf6',
            dark: '#7c3aed'
          },
          // Orange family
          'orange': {
            light: '#fed7aa',
            DEFAULT: '#f97316',
            dark: '#c2410c'
          },
          // Pink family
          'pink': {
            light: '#fce7f3',
            DEFAULT: '#ec4899',
            dark: '#be185d'
          },
          // Teal family
          'teal': {
            light: '#ccfbf1',
            DEFAULT: '#14b8a6',
            dark: '#0f766e'
          },
          // Indigo family
          'indigo': {
            light: '#e0e7ff',
            DEFAULT: '#6366f1',
            dark: '#4338ca'
          },
          // Red family
          'red': {
            light: '#fee2e2',
            DEFAULT: '#ef4444',
            dark: '#dc2626'
          },
          // Yellow family
          'yellow': {
            light: '#fef3c7',
            DEFAULT: '#eab308',
            dark: '#ca8a04'
          },
          // Cyan family
          'cyan': {
            light: '#cffafe',
            DEFAULT: '#06b6d4',
            dark: '#0891b2'
          },
          // Rose family
          'rose': {
            light: '#ffe4e6',
            DEFAULT: '#f43f5e',
            dark: '#e11d48'
          },
          // Violet family
          'violet': {
            light: '#ede9fe',
            DEFAULT: '#a855f7',
            dark: '#9333ea'
          }
        },
        
        // Neutral Scale - Modern and accessible
        gray: {
          25: '#fcfcfd',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        
        // Semantic Colors
        success: {
          25: '#f0fdf4',
          50: '#dcfce7',
          100: '#bbf7d0',
          200: '#86efac',
          300: '#4ade80',
          400: '#22c55e',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#052e16'
        },
        warning: {
          25: '#fffbeb',
          50: '#fef3c7',
          100: '#fde68a',
          200: '#fcd34d',
          300: '#fbbf24',
          400: '#f59e0b',
          500: '#d97706',
          600: '#b45309',
          700: '#92400e',
          800: '#78350f',
          900: '#451a03'
        },
        error: {
          25: '#fef2f2',
          50: '#fee2e2',
          100: '#fecaca',
          200: '#fca5a5',
          300: '#f87171',
          400: '#ef4444',
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#450a0a'
        },
        info: {
          25: '#f0f9ff',
          50: '#e0f2fe',
          100: '#bae6fd',
          200: '#7dd3fc',
          300: '#38bdf8',
          400: '#0ea5e9',
          500: '#0284c7',
          600: '#0369a1',
          700: '#0c4a6e',
          800: '#075985',
          900: '#0c4a6e'
        },
        
        // Status Colors
        online: '#22c55e',
        away: '#f59e0b',
        busy: '#ef4444',
        offline: '#64748b',
        
        // Background System
        background: {
          primary: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
          elevated: '#ffffff',
          overlay: 'rgba(15, 23, 42, 0.6)',
          'overlay-light': 'rgba(248, 250, 252, 0.8)'
        },
        
        // Surface System
        surface: {
          primary: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
          elevated: '#ffffff',
          hover: '#f1f5f9',
          active: '#e2e8f0',
          selected: '#e0f2fe',
          'selected-hover': '#bae6fd'
        },
        
        // Border System
        border: {
          primary: '#e2e8f0',
          secondary: '#cbd5e1',
          strong: '#94a3b8',
          hover: '#64748b',
          focus: '#0284c7',
          'focus-ring': 'rgba(2, 132, 199, 0.2)'
        },
        
        // Text System
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          tertiary: '#64748b',
          quaternary: '#94a3b8',
          inverse: '#ffffff',
          link: '#0284c7',
          'link-hover': '#0369a1',
          muted: '#94a3b8',
          disabled: '#cbd5e1'
        }
      },
      
      // Typography System - Inter focused
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        mono: [
          'SF Mono',
          'Monaco',
          'Inconsolata',
          'Roboto Mono',
          'Consolas',
          'monospace'
        ]
      },
      
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.025em' }],     // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.025em' }], // 14px
        'base': ['0.9375rem', { lineHeight: '1.375rem' }], // 15px (Slack base)
        'lg': ['1.125rem', { lineHeight: '1.75rem' }], // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],  // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],     // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px
        '5xl': ['3rem', { lineHeight: '3rem' }]         // 48px
      },
      
      // Spacing System - 4px base with extended options
      spacing: {
        '0.5': '0.125rem', // 2px
        '1.5': '0.375rem', // 6px
        '2.5': '0.625rem', // 10px
        '3.5': '0.875rem', // 14px
        '4.5': '1.125rem', // 18px
        '5.5': '1.375rem', // 22px
        '6.5': '1.625rem', // 26px
        '7.5': '1.875rem', // 30px
        '8.5': '2.125rem', // 34px
        '9.5': '2.375rem', // 38px
        '15': '3.75rem',   // 60px
        '18': '4.5rem',    // 72px
        '22': '5.5rem',    // 88px
        '26': '6.5rem',    // 104px
        '30': '7.5rem',    // 120px
        '34': '8.5rem',    // 136px
        '38': '9.5rem'     // 152px
      },
      
      // Layout Dimensions
      width: {
        'sidebar': '260px',
        'sidebar-collapsed': '56px',
        'thread': '340px',
        'main-max': '1200px',
        'dropdown': '240px',
        'modal-sm': '400px',
        'modal-md': '500px',
        'modal-lg': '800px'
      },
      
      height: {
        'header': '48px',
        'header-mobile': '56px',
        'message-input': '44px',
        'channel-item': '32px',
        'dropdown-item': '36px'
      },
      
      // Modern Border Radius
      borderRadius: {
        'sm': '0.375rem',  // 6px
        'md': '0.5rem',    // 8px
        'lg': '0.75rem',   // 12px
        'xl': '1rem',      // 16px
        '2xl': '1.25rem',  // 20px
        '3xl': '1.5rem'    // 24px
      },
      
      // Enhanced Shadow System
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'glow': '0 0 0 3px rgba(2, 132, 199, 0.15)',
        'glow-strong': '0 0 0 4px rgba(2, 132, 199, 0.2)',
        'message': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        'elevated': '0 8px 16px -4px rgba(0, 0, 0, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.06)',
        'dropdown': '0 10px 38px -10px rgba(22, 23, 24, 0.35), 0 10px 20px -15px rgba(22, 23, 24, 0.2)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      },
      
      // Animation & Transitions
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-in-up': 'fadeInUp 0.3s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'slide-out': 'slideOut 0.2s ease-in',
        'scale-in': 'scaleIn 0.15s ease-out',
        'pulse-ring': 'pulseRing 2s infinite',
        'skeleton': 'skeleton 1.5s infinite',
        'bounce-gentle': 'bounceGentle 0.6s ease-out',
        'typing': 'typing 1.4s infinite ease-in-out',
        'spin-slow': 'spin 2s linear infinite'
      },
      
      // Z-Index Scale
      zIndex: {
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'overlay': '1080'
      },
      
      // Backdrop Blur
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px'
      },
      
      // Responsive Breakpoints (mobile-first)
      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px'
      },
      
      // Custom Grid Templates
      gridTemplateColumns: {
        'sidebar': '260px 1fr',
        'sidebar-thread': '260px 1fr 340px',
        'sidebar-collapsed': '56px 1fr',
        'mobile': '1fr',
        'calendar': 'repeat(7, 1fr)',
        'timeline': '200px 1fr',
        'channel-multi': '240px 1fr', // For channel dropdown + content
        'dashboard': 'repeat(auto-fit, minmax(300px, 1fr))'
      },
      
      // Professional Gradients
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))',
        'gradient-brand': 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
        'gradient-surface': 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        'gradient-header': 'linear-gradient(135deg, #475569 0%, #334155 100%)',
        'gradient-accent': 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
        'gradient-subtle': 'linear-gradient(180deg, rgba(248, 250, 252, 0.8) 0%, rgba(241, 245, 249, 0.4) 100%)',
        'mesh-gradient': 'radial-gradient(at 40% 20%, hsla(210, 100%, 85%, 0.2) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(200, 100%, 80%, 0.15) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(220, 100%, 70%, 0.1) 0px, transparent 50%)'
      },
      
      // Custom Utilities
      transitionProperty: {
        'height': 'height',
        'width': 'width',
        'spacing': 'margin, padding'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class' // Use .form-input, .form-select etc.
    })
  ]
}
