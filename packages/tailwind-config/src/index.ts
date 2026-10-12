/**
 * Centralized Tailwind CSS class definitions and presets (@repo/tailwind-config)
 * These classes can be passed directly to `cn()` or HTML elements.
 */

export const commonClasses = {
  // Page layout
  container: 'max-w-5xl mx-auto px-4 py-8',
  section: 'space-y-6',
  grid3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
  grid2: 'grid grid-cols-1 md:grid-cols-2 gap-6',

  // Surfaces & Cards
  card: 'bg-white border border-slate-200 rounded-xl shadow-xs p-6 transition-all duration-200 hover:shadow-md',
  cardHeader: 'mb-4',
  cardTitle: 'text-lg font-semibold text-slate-900 tracking-tight',
  cardSubtitle: 'text-sm text-slate-500 mt-0.5',
  cardFooter: 'mt-4 pt-4 border-t border-slate-100',

  // Form controls
  label: 'block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5',
  input: 'w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-slate-400',
  inputError: 'border-red-300 focus:ring-red-500 focus:border-red-500',
  errorAlert: 'p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200',
  successAlert: 'p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs border border-emerald-200',

  // Buttons
  button: {
    base: 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
    variants: {
      primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm focus-visible:ring-indigo-500',
      secondary: 'bg-slate-900 hover:bg-slate-800 text-slate-50 shadow-sm focus-visible:ring-slate-500',
      outline: 'border border-slate-300 bg-transparent hover:bg-slate-100 text-slate-700 focus-visible:ring-slate-400',
      danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm focus-visible:ring-red-500',
      ghost: 'bg-transparent hover:bg-slate-100 text-slate-700'
    },
    sizes: {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base'
    }
  },

  // Badges
  badge: {
    base: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
    variants: {
      neutral: 'bg-slate-100 text-slate-700 border-slate-200',
      success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      warning: 'bg-amber-50 text-amber-700 border-amber-200',
      info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      danger: 'bg-red-50 text-red-700 border-red-200'
    }
  }
} as const;

export const brandColors = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
  950: '#1e1b4b'
} as const;
