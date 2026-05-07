const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const dbUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!dbUri) {
      throw new Error('MongoDB URI is not defined in environment variables (.env file). Please check MONGO_URI or MONGODB_URI.');
    }

    const conn = await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    let errorMessage = error.message;
    
    // Specifically catch and explain EAI_AGAIN (DNS failure)
    if (errorMessage.includes('EAI_AGAIN')) {
      errorMessage = `Database connection failed: DNS lookup timeout (EAI_AGAIN). This usually means your internet is unstable or the MongoDB Atlas host is unreachable.`;
    }

    console.error(`❌ Database Connection Error: ${errorMessage}`);
    // We don't exit here anymore to allow the server to start and potentially return 503 errors to the frontend
    return false;
  }
};

module.exports = connectDB;
