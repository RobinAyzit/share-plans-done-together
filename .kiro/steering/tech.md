# Tech Stack

## Build System & Tooling

- **Build Tool**: Vite 7.2.4
- **Package Manager**: npm
- **Language**: TypeScript 5.9.3
- **Module System**: ES Modules

## Frontend Framework & Libraries

- **UI Framework**: React 19.2.0
- **Routing**: React Router DOM 7.13.0
- **Styling**: Tailwind CSS 4.1.18 with Vite plugin
- **Animations**: Framer Motion 12.33.0
- **Icons**: Lucide React 0.563.0
- **Confetti Effects**: canvas-confetti 1.9.4

## Internationalization

- **i18n**: i18next 25.8.4
- **React Integration**: react-i18next 16.5.4
- **Language Detection**: i18next-browser-languagedetector 8.2.0
- **Supported Languages**: English, Swedish, Turkish

## Backend & Services

- **Backend**: Firebase 12.9.0
  - Authentication (Google OAuth)
  - Firestore (real-time database)
  - Cloud Messaging (push notifications)
- **Security Rules**: Firestore rules in `firestore.rules`

## Mobile & PWA

- **Capacitor Core**: 8.0.2
- **Capacitor CLI**: 7.4.5
- **Android Platform**: @capacitor/android 8.0.2
- **App ID**: nrn.donetogether.app
- **Web Directory**: dist

## Code Quality

- **Linter**: ESLint 9.39.1
- **TypeScript ESLint**: 8.46.4
- **React Plugins**: 
  - eslint-plugin-react-hooks 7.0.1
  - eslint-plugin-react-refresh 0.4.24

## Common Commands

```bash
# Development
npm run dev              # Start Vite dev server

# Build
npm run build            # TypeScript compile + Vite build

# Code Quality
npm run lint             # Run ESLint

# Preview
npm run preview          # Preview production build

# Mobile (Android)
npx cap sync android     # Sync web assets to Android
npx cap open android     # Open Android Studio
```

## Environment Requirements

- Node.js (for npm and build tools)
- Firebase project configuration
- Android Studio (for mobile development)
