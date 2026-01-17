# Crew Chat - Project Instructions for Claude

## Overview

**Crew Chat** is a full-stack real-time chat and task management application with:
- **React frontend** (Vite + Tailwind CSS)
- **Node.js backend** (Express + Socket.IO)
- **Flutter mobile app** (iOS/Android)

Current version: **1.8.112**

## Project Structure

```
chat-app/
├── frontend/          # React web app (Vite + React 19 + Tailwind)
│   └── src/
│       ├── components/   # React components
│       ├── contexts/     # React contexts
│       └── utils/        # Utility functions
├── backend/           # Node.js API server (Express + Socket.IO)
│   ├── migrations/       # Database migrations
│   └── middleware/       # Express middleware
├── mobile/            # Flutter mobile app
│   └── lib/              # Dart source code
├── scripts/           # Deployment and utility scripts
└── syncup-staging/    # Staging environment (separate app)
```

## Tech Stack

### Frontend (React)
- React 19 with Vite 7
- Tailwind CSS for styling
- Zustand for state management
- React Query for data fetching
- Socket.IO client for real-time updates
- Firebase for authentication

### Backend (Node.js)
- Express.js server
- Socket.IO for WebSocket connections
- PostgreSQL database (DigitalOcean managed)
- Google Calendar/Tasks API integration

### Mobile (Flutter)
- Flutter with Riverpod state management
- Firebase Auth + Google Sign-In
- Socket.IO client for real-time
- Dio for HTTP requests

## Deployment

### Deploy to Production (All Platforms)

Run the production deploy script which handles everything:

```bash
./deploy-prod.sh                                    # Interactive mode (prompts for version bump type and message)
./deploy-prod.sh patch "Fixed bug in task list"    # Patch version bump with message
./deploy-prod.sh minor "Added new calendar feature" # Minor version bump with message
./deploy-prod.sh major "Breaking API changes"       # Major version bump with message
```

**Example:** After fixing multiple issues:
```bash
./deploy-prod.sh patch "Fixed task fade animation, quick add, and layout switching"
```

This script:
1. Bumps version in `package.json`, `frontend/package.json`, `backend/package.json`, and `mobile/pubspec.yaml`
2. Creates a git commit and tag
3. Pushes to GitHub `main` branch
4. **DigitalOcean** auto-deploys from the `main` branch
5. Builds Flutter IPA and uploads to **Apple TestFlight** (if API credentials configured)

### Deploy to Development/Staging

```bash
./deploy-dev.sh
```

### Manual Version Bump

```bash
npm run bump "commit message"           # Patch: 1.0.0 → 1.0.1
npm run bump:minor "commit message"     # Minor: 1.0.0 → 1.1.0
npm run bump:major "commit message"     # Major: 1.0.0 → 2.0.0
```

## TestFlight Auto-Upload

To enable automatic TestFlight uploads, set these environment variables:
- `ASC_KEY_ID` - App Store Connect API Key ID
- `ASC_ISSUER_ID` - App Store Connect Issuer ID

See `TESTFLIGHT-AUTOMATED-UPLOAD.md` for setup instructions.

## Production URLs

- **Web App**: https://crewchat.elbarriobk.com
- **Backend API**: Hosted on DigitalOcean App Platform

## Development

### Start Frontend Dev Server
```bash
cd frontend && npm run dev
# or from root:
npm run dev:frontend
```

### Start Backend Dev Server
```bash
./start-backend-dev.sh
# or:
cd backend && npm run dev
```

### Install All Dependencies
```bash
npm run install:all
```

## Key Configuration Files

- `backend/.env` - Backend environment variables (DB credentials, API keys)
- `mobile/pubspec.yaml` - Flutter dependencies and version
- `frontend/vite.config.js` - Vite configuration
- `ecosystem.config.js` - PM2 configuration (if using PM2)

## Database

- PostgreSQL hosted on DigitalOcean
- Migrations located in `backend/migrations/`
- Migrations run automatically on deploy

## Important Notes

- Version is kept in sync across all package.json files and pubspec.yaml
- Flutter build number is derived from version (e.g., 1.8.39 → build 1839)
- The `syncup-staging/` directory is a separate staging application
- Always test on staging before deploying to production
