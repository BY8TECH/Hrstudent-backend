const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

async function verifyUsers() {
    try {
        console.log('=== Checking Database Users ===\n');

        const users = await User.find({}).select('+password');

        if (users.length === 0) {
            console.log('❌ No users found in database!');
            console.log('Run: node create-test-users.js');
            process.exit(1);
        }

        console.log(`Found ${users.length} user(s):\n`);

        for (const user of users) {
            console.log(`Email: ${user.email}`);
            console.log(`Role: ${user.role}`);
            console.log(`Active: ${user.isActive}`);
            console.log(`Has Password Hash: ${!!user.password}`);
            console.log(`Password Hash Length: ${user.password ? user.password.length : 0}`);

            // Test password matching
            try {
                const testPassword = 'password123';
                const isMatch = await user.matchPassword(testPassword);
                console.log(`Password "password123" matches: ${isMatch ? '✓ YES' : '✗ NO'}`);
            } catch (err) {
                console.log(`Password check error: ${err.message}`);
            }
            console.log('---');
        }

        console.log('\n=== Login Test ===');
        console.log('Try logging in with:');
        console.log('Email: hr@test.com');
        console.log('Password: password123');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

verifyUsers();
