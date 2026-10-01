const mongoose = require('mongoose');

let mongodInstance = null;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/teamup';
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[MongoDB Fatal Error]: Primary MongoDB connection failed (${error.message}). In-memory fallback is disabled in production.`);
      process.exit(1);
    }
    console.warn(`[MongoDB Warning]: Primary connection failed (${error.message}). Attempting in-memory MongoDB fallback for local development...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      const fallbackUri = mongodInstance.getUri();
      const conn = await mongoose.connect(fallbackUri);
      console.log(`[MongoDB] Connected to in-memory fallback instance: ${conn.connection.host}`);
    } catch (fallbackErr) {
      console.error(`[MongoDB Fatal Error]: ${fallbackErr.message}`);
      process.exit(1);
    }
  }
};

module.exports = { connectDB };
