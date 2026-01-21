/**
 * PostHive Design System
 * Based on Drive Component Design Language
 * Black & white, sharp-edged aesthetic
 */

export const theme = {
  colors: {
    // Backgrounds - Pure black base
    background: '#000000',
    surface: 'rgba(0, 0, 0, 0.4)', // bg-black/40
    surfaceElevated: '#09090b', // zinc-950
    surfaceHover: 'rgba(255, 255, 255, 0.03)', // hover:bg-white/[0.03]

    // Borders - White with opacity
    border: 'rgba(255, 255, 255, 0.12)', // border-white/12
    borderHover: 'rgba(255, 255, 255, 0.15)', // border-white/15
    borderActive: 'rgba(255, 255, 255, 0.30)', // border-white/30
    borderSelected: 'rgba(255, 255, 255, 0.70)', // border-white/70
    divider: 'rgba(255, 255, 255, 0.05)', // divide-white/5
    surfaceBorder: 'rgba(255, 255, 255, 0.12)', // Alias for border (backwards compat)

    // Text - White/Gray variants
    textPrimary: '#FFFFFF',
    textSecondary: '#a1a1aa', // zinc-400
    textMuted: '#71717a', // zinc-500
    textDisabled: '#52525b', // zinc-600
    textInteractive: 'rgba(255, 255, 255, 0.6)', // text-white/60
    textInverse: '#000000',

    // Primary Action - White on black
    accent: '#FFFFFF',
    accentBackground: '#FFFFFF',
    accentText: '#000000',

    // Secondary Action
    secondaryBackground: 'rgba(255, 255, 255, 0.1)', // bg-white/10
    secondaryBorder: 'rgba(255, 255, 255, 0.30)', // border-white/30

    // Status colors (used sparingly)
    success: '#4ade80', // green-400
    successBackground: 'rgba(22, 101, 52, 0.2)', // bg-green-900/20
    successBorder: 'rgba(22, 163, 74, 0.5)', // border-green-600/50

    warning: '#facc15', // yellow-400
    warningBackground: 'rgba(113, 63, 18, 0.2)', // bg-yellow-900/20
    warningBorder: 'rgba(202, 138, 4, 0.5)', // border-yellow-600/50

    error: '#f87171', // red-400
    errorBackground: 'rgba(127, 29, 29, 0.2)', // bg-red-900/20
    errorBorder: 'rgba(220, 38, 38, 0.5)', // border-red-600/50

    // Priority colors
    priorityUrgent: '#f87171',
    priorityHigh: '#facc15',
    priorityMedium: '#a1a1aa',
    priorityLow: '#52525b',

    // Status badges
    statusPending: '#71717a',
    statusInProgress: '#facc15',
    statusCompleted: '#4ade80',
    statusDraft: '#52525b',
    statusReview: '#facc15',
    statusApproved: '#4ade80',
    statusFinal: '#a78bfa',

    // Aliases for backwards compatibility
    text: '#FFFFFF',
    primary: '#3B82F6', // Blue accent
    primaryMuted: 'rgba(59, 130, 246, 0.15)', // Blue with opacity
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // SHARP EDGES - No rounded corners
  borderRadius: {
    none: 0,
    sm: 0,
    md: 0,
    lg: 0,
    xl: 0,
    full: 0, // Even "full" is 0 for sharp edges
  },

  // Standard heights
  sizes: {
    buttonHeight: 44, // h-11
    inputHeight: 44,
    iconButton: 44,
    icon: 16, // h-4 w-4
    iconLarge: 48, // h-12 w-12
  },

  typography: {
    // Montserrat fonts - use these for headers, labels, and emphasis
    fontFamily: {
      regular: 'Montserrat-Regular',
      medium: 'Montserrat-Medium',
      semibold: 'Montserrat-SemiBold',
      bold: 'Montserrat-Bold',
      // Aliases
      display: 'Montserrat-SemiBold',
      heading: 'Montserrat-Bold',
      label: 'Montserrat-SemiBold',
    },
    fontSize: {
      xs: 11, // Labels, metadata
      sm: 13, // Body text
      md: 15,
      lg: 17, // Section titles
      xl: 20, // text-xl
      xxl: 28, // text-4xl equivalent
      xxxl: 34,
    },
    // Letter spacing for uppercase labels
    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 2, // tracking-[0.35em] approximation
      wider: 3, // tracking-[0.4em] approximation
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  // Minimal shadows - design is flat
  shadows: {
    none: {},
    sm: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
  },
};

export type Theme = typeof theme;
