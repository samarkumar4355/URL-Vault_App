require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5001;

let server;

const startServer = async () => {
  try {
    // 1. Establish database connection
    await connectDB();

    // 2. Start Express HTTP server
    server = app.listen(PORT, () => {
      console.log(`[Server] LinkVault running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(`[Server] Failed to initialize server: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown handling
const handleShutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer();
