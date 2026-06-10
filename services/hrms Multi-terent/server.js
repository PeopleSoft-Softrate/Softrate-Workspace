const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

[
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
].filter((envPath) => fs.existsSync(envPath)).forEach((envPath) => {
  dotenv.config({ path: envPath });
});

// ============================
// Startup Guards
// ============================
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET is not set in environment. Refusing to start.');
  process.exit(1);
}

require("./cron/leaveReset.cron");


const app = express();
app.set("trust proxy", 1);
app.use(compression());

// ── CORS: use env-driven allowlist in production ──
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : null;
app.use(cors({
  origin: allowedOrigins || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-company-code',
    'X-Demo-Mode',
    'Cache-Control',
    'Pragma',
    'Expires'
  ]
}));

// ── Body limits: 50 MB for JSON, multer handles large uploads separately ──
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// ============================
// MongoDB Multi-Tenant Connections
// ============================
const { getMasterConnection, getTenantConnection, waitForConnection } = require('./db');

// Pre-warm Master DB connection at startup
const masterDb = getMasterConnection();
waitForConnection(masterDb)
  .then(() => console.log('✅ Master DB (hrdb_master) ready'))
  .catch(err => console.error('❌ Master DB connection error:', err));

// Pre-warm legacy hrdb for existing mobile app users (no companyCode)
const legacyDb = getTenantConnection('hrdb');
waitForConnection(legacyDb)
  .then(() => console.log('✅ Legacy DB (hrdb) ready'))
  .catch(err => console.error('❌ Legacy DB connection error:', err));


// ============================
// Routes
// ============================
app.use('/api/hr', require('./routes/HrRouters'));
app.use('/api/intern', require('./routes/internRoutes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/attendance', require('./routes/attendanceroutes'));
app.use('/api/reviews', require('./routes/internReview.route'));
app.use('/api/resignation', require('./routes/resignation.routes'));
app.use('/api', require('./routes/send-documents'));
app.use('/api/employee', require('./routes/EmployeeRouter'));
app.use('/api/employeeAttanance', require('./routes/EmployeeAttendance'));
app.use("/api/employee-leave", require("./routes/employeeLeave.routes"));
app.use("/api/employee-reviews", require("./routes/employeeReview.routes"));
app.use("/api/employee-resignations", require("./routes/employee-resignation-routes"));
app.use('/api/employee-terminations', require('./routes/employeeTermination.routes'));
app.use('/api/leave-counter', require('./routes/leaveCounter.routes'));
app.use('/api/policy', require('./routes/policyRoutes'));
app.use("/api/holidays", require("./routes/holiday.routes"));
app.use("/api/assignments", require("./routes/assignment.routes"));
app.use("/api/attendance-requests", require("./routes/attendanceRequest.routes"));
app.use('/api/projects', require('./routes/project.routes'));
app.use('/api/onboarding', require('./routes/onboarding.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/performance-templates', require('./routes/performance.routes'));
app.use('/api/convert', require('./routes/conversion.routes'));
app.use('/api/fund-requests', require('./routes/fundRequest.routes'));
app.use('/api/device-change-requests', require('./routes/deviceChangeRequest.routes'));
app.use('/api/public', require('./routes/public.routes'));

// ============================
// Test Route
// ============================
app.get('/', (req, res) => {
  res.send('HRM Backend is running');
});


// ============================
// Start Server with Socket.io
// ============================
const PORT = process.env.PORT || 5001;
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Make io accessible in routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`🏠 Client ${socket.id} joined room: ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// ============================
// Global Error Handler
// ============================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error')
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
