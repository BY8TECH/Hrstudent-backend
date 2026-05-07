const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

async function fixHRUser() {
    try {
        console.log('=== Fixing HR User ===\n');

        // Delete existing HR user
        await User.deleteOne({ email: 'hr@test.com' });
        console.log('✓ Removed old HR user');

        // Create fresh HR user
        const hrUser = await User.create({
            username: 'HR Admin',
            email: 'hr@test.com',
            password: 'password123',
            role: 'HR',
            isActive: true
        });

        console.log('✓ Created new HR user');
        console.log('\n=== ✅ LOGIN CREDENTIALS ===');
        console.log('Email:    hr@test.com');
        console.log('Password: password123');
        console.log('============================\n');
        console.log('You can now login at: https://by8labs-frontend.onrender.com\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixHRUser();
