const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

async function resetHRPassword() {
    try {
        console.log('=== Resetting HR User Password ===\n');

        const hrUser = await User.findOne({ email: 'hr@test.com' });

        if (!hrUser) {
            console.log('❌ HR user not found!');
            console.log('Run: node create-test-users.js');
            process.exit(1);
        }

        console.log('Found HR user:', hrUser.email);

        // Set new password (will be hashed by the pre-save hook)
        hrUser.password = 'password123';
        await hrUser.save();

        console.log('✓ Password reset successfully!');
        console.log('\n=== Login Credentials ===');
        console.log('Email: hr@test.com');
        console.log('Password: password123');
        console.log('========================\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

resetHRPassword();
