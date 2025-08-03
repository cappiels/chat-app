// --- Imports ---
require('dotenv').config(); // This loads the .env file
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg'); // PostgreSQL client

// Import route modules
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workspaceRoutes = require('./routes/workspaces');
const threadRoutes = require('./routes/threads');
const knowledgeRoutes = require('./routes/knowledge-advanced');

// Import Socket.IO server
const SocketServer = require('./socket/socketServer');

// --- Initialization ---
const app = express();
const port = process.env.PORT || 8080;

// --- Security & Performance Middleware ---

// CORS configuration for frontend communication  
const allowedOrigins = [
  'http://localhost:5173',           // Local development
  'https://localhost:5173',          // Local HTTPS
  'https://coral-app-rgki8.ondigitalocean.app',  // Production frontend
  process.env.FRONTEND_URL           // Custom environment override
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false // Needed for some frontend frameworks
}));

// Rate limiting for API protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
// Apply to all requests, as the /api prefix is stripped by the platform
app.use(limiter);

// Special rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit auth requests
  message: {
    error: 'Too Many Auth Requests',
    message: 'Too many authentication attempts, please try again later.'
  }
});

// --- Standard Middleware ---
app.use(express.json({ limit: '10mb' })); // Support larger payloads for file uploads
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.originalUrl} - ${req.ip}`);
  next();
});

// --- Database Connection Test ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection on startup
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Check if required tables exist
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'workspaces', 'workspace_members', 'threads', 'messages')
      ORDER BY table_name;
    `);
    
    console.log(`📋 Found ${result.rows.length} core tables:`, result.rows.map(r => r.table_name));
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

testConnection();

// --- API Routes ---

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Chat App API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    services: {
      database: 'connected',
      authentication: 'firebase',
      email: 'nodemailer/gmail'
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Mount route modules
app.use('/auth', authRoutes);
app.use('/users', authLimiter, userRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/knowledge', knowledgeRoutes);

// Legacy workspace endpoint (for backward compatibility)
app.post('/workspaces', async (req, res) => {
  console.log("⚠️  DEPRECATED: Use /api/workspaces instead");
  
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ 
      error: 'Validation Error', 
      message: 'Workspace name is required' 
    });
  }

  try {
    const newWorkspace = await pool.query(
      "INSERT INTO workspaces (name, owner_user_id) VALUES ($1, 'temp-user-id') RETURNING *",
      [name]
    );

    res.status(201).json({
      message: 'Workspace created (legacy endpoint)',
      workspace: newWorkspace.rows[0],
      notice: 'Please migrate to /api/workspaces endpoint'
    });

  } catch (err) {
    console.error("Legacy workspace creation error:", err);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to create workspace' 
    });
  }
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong on our end',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// --- Server Start with Socket.IO ---
// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.IO server
const socketServer = new SocketServer(httpServer);

// Make socket server available globally for API routes
app.set('socketServer', socketServer);

// Graceful shutdown for Socket.IO
const originalSIGTERM = process.listeners('SIGTERM')[0];
const originalSIGINT = process.listeners('SIGINT')[0];

process.removeAllListeners('SIGTERM');
process.removeAllListeners('SIGINT');

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  socketServer.io.close();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  socketServer.io.close();
  await pool.end();
  process.exit(0);
});

httpServer.listen(port, () => {
  console.log(`🚀 Chat App API Server running on port ${port}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`🔌 Socket.IO server initialized and ready for real-time connections`);
  console.log(`📧 Gmail service account configured: ${!!process.env.GMAIL_SERVICE_ACCOUNT_EMAIL}`);
});
