# Production Deployment Fix Guide

## 🚨 Current Production Issue

The production frontend at `https://coral-app-rgki8.ondigitalocean.app` is trying to call `localhost:8080` which fails.

## ✅ What We Fixed

### 1. Frontend Environment Variables
- Updated `frontend/src/utils/api.js` to use `VITE_API_URL` environment variable
- Updated `frontend/src/utils/socket.js` to use `VITE_SOCKET_URL` environment variable
- Created `frontend/.env.production` template

### 2. Backend CORS Configuration
- Updated `backend/index.js` CORS to allow:
  - `http://localhost:5173` (development)
  - `https://localhost:5173` (local HTTPS)
  - `https://coral-app-rgki8.ondigitalocean.app` (production frontend)
  - Custom `FRONTEND_URL` environment variable

## 🔧 To Fix Production Deployment

### Option 1: Update Build Environment Variables

When deploying the frontend, set these environment variables:

```bash
# For your production build
VITE_API_URL=https://your-backend-domain.com/api
VITE_SOCKET_URL=https://your-backend-domain.com
```

### Option 2: Create .env.production.local

In your `frontend/` folder, create `.env.production.local`:

```env
VITE_API_URL=https://your-backend-domain.com/api
VITE_SOCKET_URL=https://your-backend-domain.com
```

### Option 3: Deploy Backend and Update URLs

1. Deploy your backend to a production server
2. Update the URLs in your build process
3. Rebuild and redeploy frontend

## 🚀 Quick Fix for Current Deployment

If you need to quickly fix the current deployment:

1. Find your production backend URL
2. Update your build process to include:
   ```bash
   VITE_API_URL=https://your-actual-backend-url.com/api npm run build
   ```
3. Redeploy the frontend

## 📋 Production Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend environment variables set correctly
- [ ] CORS allows your frontend domain
- [ ] Firebase config matches between environments
- [ ] Database connection working in production
- [ ] Socket.IO connections working

## 🔍 Testing

After fixing, verify:
1. Frontend can fetch workspaces: Check browser console
2. No CORS errors in browser console
3. Socket.IO connections work
4. Real-time features functional

---

**The issue is now fixed in the code - you just need to redeploy with proper environment variables!**
