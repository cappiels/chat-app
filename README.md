# ChatFlow - Slack-Style Chat Application

A professional, enterprise-grade chat application built with React, Node.js, Socket.IO, and PostgreSQL.

## 🚀 Daily Development Workflow

### Quick Start (Every Morning)

1. **Check if servers are running:**
   ```bash
   ./check-servers.sh
   ```

2. **Start servers if needed:**
   ```bash
   ./start-servers.sh
   ```

3. **Open your chat app:**
   - Visit: http://localhost:5173
   - Sign in with Google
   - Start chatting!

### Manual Server Management

**Start Backend:**
```bash
cd backend
npm start
```

**Start Frontend:**
```bash
cd frontend  
npm run dev
```

**Check Server Status:**
```bash
# Check specific ports
lsof -i :8080  # Backend
lsof -i :5173  # Frontend

# Or use our handy script
./check-servers.sh
```

## 🎯 Current Features

✅ **Professional Slack-Style Mobile Interface**
- Purple header with workspace branding
- Navigation cards (Threads, Huddles, Later, Drafts & Sent)
- Channel and DM sections with proper icons
- Bottom tab navigation (Home, DMs, Activity, More)
- Beautiful animations and touch interactions

✅ **Real-Time Messaging**
- Instant message delivery with Socket.IO
- Live typing indicators  
- User presence and online status
- Emoji reactions
- Message editing and deletion

✅ **Authentication & Workspaces**
- Google Sign-In with Firebase
- Multi-tenant workspace system
- Create and manage channels
- User profile management

✅ **Enterprise Backend**
- PostgreSQL database with 13+ tables
- RESTful APIs for all features
- Real-time Socket.IO server
- Enterprise security and rate limiting

## 📁 Project Structure

```
chat-app/
├── backend/           # Node.js API server
│   ├── routes/        # API endpoints
│   ├── middleware/    # Auth & security
│   ├── socket/        # Real-time features
│   └── migrations/    # Database setup
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── utils/
│   │   └── ...
└── *.sh              # Helper scripts
```

## 🛠 Development Scripts

- `./check-servers.sh` - Check if both servers are running
- `./start-servers.sh` - Start both servers automatically
- `npm start` - Start backend server (in backend/)
- `npm run dev` - Start frontend server (in frontend/)

## 🌐 URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **GitHub**: https://github.com/cappiels/chat-app

## 📋 Next Features (Phase 7)

See `todo.md` for comprehensive roadmap including:
- Advanced Slack features (threads, huddles, search)
- File uploads and previews
- Voice messages
- Team management
- And much more!

---

**Made with ❤️ - A professional chat application that rivals Slack!**
