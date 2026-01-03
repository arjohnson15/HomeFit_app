// Theme service - handles appearance settings application

const accentColors = {
  blue: { primary: '#0a84ff', hover: '#409cff', muted: 'rgba(10, 132, 255, 0.2)' },
  green: { primary: '#30d158', hover: '#4ade80', muted: 'rgba(48, 209, 88, 0.2)' },
  purple: { primary: '#bf5af2', hover: '#c77dff', muted: 'rgba(191, 90, 242, 0.2)' },
  orange: { primary: '#ff9f0a', hover: '#ffb340', muted: 'rgba(255, 159, 10, 0.2)' },
  red: { primary: '#ff453a', hover: '#ff6961', muted: 'rgba(255, 69, 58, 0.2)' },
  pink: { primary: '#ff375f', hover: '#ff6b8a', muted: 'rgba(255, 55, 95, 0.2)' }
}

// Apply theme settings to DOM
export function applyTheme(settings) {
  const root = document.documentElement

  // Apply accent color
  const accent = accentColors[settings.accentColor] || accentColors.blue
  root.style.setProperty('--color-accent', accent.primary)
  root.style.setProperty('--color-accent-hover', accent.hover)
  root.style.setProperty('--color-accent-muted', accent.muted)

  // Apply theme (light/dark/system)
  if (settings.theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  } else {
    root.setAttribute('data-theme', settings.theme)
  }

  // Apply font size
  const fontSizes = { small: '14px', medium: '16px', large: '18px' }
  root.style.setProperty('--base-font-size', fontSizes[settings.fontSize] || '16px')

  // Apply compact mode
  if (settings.compactMode) {
    root.classList.add('compact')
  } else {
    root.classList.remove('compact')
  }
}

// Load and apply saved settings on app start
export function initializeTheme() {
  const saved = localStorage.getItem('appearanceSettings')
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      applyTheme(settings)
    } catch (e) {
      console.error('Failed to parse appearance settings:', e)
    }
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const saved = localStorage.getItem('appearanceSettings')
    if (saved) {
      const settings = JSON.parse(saved)
      if (settings.theme === 'system') {
        applyTheme(settings)
      }
    }
  })
}

export { accentColors }
