// Simple test script to identify the error
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

console.log('=== Testing Backend Setup ===\n');

// Test 1: Check environment variables
console.log('✓ Environment variables loaded');
console.log('  PORT:', process.env.PORT);
console.log('  MONGODB_URI:', process.env.MONGODB_URI);
console.log('  JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('');

// Test 2: Load models
try {
    console.log('Loading models...');
    require('./models/User');
    console.log('  ✓ User model');
    require('./models/Employee');
    console.log('  ✓ Employee model');
    require('./models/Attendance');
    console.log('  ✓ Attendance model');
    require('./models/Leave');
    console.log('  ✓ Leave model');
    require('./models/Payroll');
    console.log('  ✓ Payroll model');
    require('./models/Performance');
    console.log('  ✓ Performance model');
    require('./models/Recruitment');
    console.log('  ✓ Recruitment model');
    require('./models/Expense');
    console.log('  ✓ Expense model');
    require('./models/Exit');
    console.log('  ✓ Exit model');
    require('./models/Notification');
    console.log('  ✓ Notification model');
    console.log('✓ All models loaded successfully\n');
} catch (error) {
    console.log('✗ Error loading models:');
    console.log(error.message);
    console.log(error.stack);
    process.exit(1);
}

// Test 3: Load routes
try {
    console.log('Loading routes...');
    require('./routes/auth');
    console.log('  ✓ Auth routes');
    require('./routes/employees');
    console.log('  ✓ Employee routes');
    require('./routes/attendance');
    console.log('  ✓ Attendance routes');
    require('./routes/leaves');
    console.log('  ✓ Leave routes');
    require('./routes/payroll');
    console.log('  ✓ Payroll routes');
    console.log('✓ All routes loaded successfully\n');
} catch (error) {
    console.log('✗ Error loading routes:');
    console.log(error.message);
    console.log(error.stack);
    process.exit(1);
}

// Test 4: MongoDB connection (optional - only if MongoDB is running)
console.log('Attempting MongoDB connection...');
const connectDB = require('./config/db');
connectDB()
    .then(() => {
        console.log('✓ MongoDB connected successfully\n');
        console.log('=== All tests passed! ===');
        console.log('You can now run: npm run dev');
        process.exit(0);
    })
    .catch((error) => {
        console.log('✗ MongoDB connection failed:');
        console.log(error.message);
        console.log('\nNote: Make sure MongoDB is running locally or update MONGODB_URI in .env');
        console.log('\nDespite MongoDB error, syntax is correct. Fix MongoDB and server should work.');
        process.exit(0);
    });
