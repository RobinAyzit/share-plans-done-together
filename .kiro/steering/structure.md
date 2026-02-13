# Project Structure

## Root Configuration

- `package.json` - Dependencies and npm scripts
- `capacitor.config.ts` - Capacitor mobile app configuration
- `firestore.rules` - Firestore security rules
- `eslint.config.js` - ESLint configuration (flat config format)
- `index.html` - Entry HTML with error handlers and PWA meta tags
- `tsconfig.json` - TypeScript compiler configuration

## Source Directory (`src/`)

### Main Entry Points
- `main.tsx` - React app bootstrap with ErrorBoundary
- `App.tsx` - Main application component with routing and state management
- `App.css` - Application-specific styles
- `index.css` - Global styles and Tailwind imports
- `i18n.ts` - i18next configuration

### Type Definitions (`src/types.ts`)
- `Plan` - Task list with members and items
- `Item` - Individual task with reactions, comments, deadlines
- `UserProfile` - User data with friends and FCM tokens
- `PlanInvite` - Shareable invite links
- `FriendRequest` - Friend connection requests
- `Reaction`, `Comment`, `PlanMember` - Supporting types

### Components (`src/components/`)
Reusable UI components:
- `AuthModal.tsx` - Google OAuth login modal
- `FriendsModal.tsx` - Friend requests management
- `JoinModal.tsx` - Join plan via invite code
- `ShareModal.tsx` - Generate and share plan invites
- `LanguageSwitcher.tsx` - Language selection UI

### Custom Hooks (`src/hooks/`)
Business logic and Firebase integration:
- `useAuth.ts` - Authentication state and Google sign-in
- `useFirestore.ts` - Plan CRUD operations and real-time subscriptions
- `useFriends.ts` - Friend requests and connections
- `useInvites.ts` - Invite code generation and validation
- `useNotifications.ts` - FCM push notification registration

### Utilities (`src/lib/`)
- `firebase.ts` - Firebase SDK initialization
- `notifications.ts` - Push notification helpers
- `utils.ts` - Image compression and utility functions

### Localization (`src/locales/`)
- `en.json` - English translations
- `sv.json` - Swedish translations
- `tr.json` - Turkish translations

### Assets (`src/assets/`)
- Static images and icons

## Mobile Platform (`android/`)

Standard Capacitor Android project structure:
- `app/` - Android application code
- `gradle/` - Gradle wrapper
- `build.gradle` - Android build configuration
- `capacitor.settings.gradle` - Capacitor plugin settings

## Public Assets (`public/`)

- `manifest.json` - PWA manifest
- `pwa-icon.png` - App icon
- `firebase-messaging-sw.js` - Service worker for FCM
- `images/` - Static images

## Build Output

- `dist/` - Production build output (gitignored)

## Conventions

### Component Structure
- Single component per file
- Use functional components with hooks
- TypeScript for all components

### State Management
- Local state with useState
- Firebase real-time subscriptions via custom hooks
- No global state library (Redux, Zustand, etc.)

### Styling
- Tailwind utility classes
- Dark mode via `dark:` prefix
- Responsive design with mobile-first approach
- Custom animations with Framer Motion

### Firebase Patterns
- Real-time listeners in custom hooks
- Firestore collections: `users`, `plans`, `invites`, `friendRequests`
- Timestamp fields use Firebase Timestamp type
- Security enforced via Firestore rules

### Error Handling
- ErrorBoundary in main.tsx catches React errors
- Global error handlers in index.html for pre-React errors
- Try-catch blocks in async operations with user-facing toasts
