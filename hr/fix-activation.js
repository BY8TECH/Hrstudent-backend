require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const activateUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const email = 'nithyabalu2209@gmail.com'; // Using the email fro logs
        const user = await User.findOne({ email });

        if (!user) {
            console.log('❌ User not found with email:', email);
            process.exit(1);
        }

        console.log('Found user:', user.username);
        console.log('Current status:', {
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            approvalStatus: user.approvalStatus
        });

        // Force activation
        user.isActive = true;
        user.isEmailVerified = true;
        user.approvalStatus = 'Approved';

        await user.save();

        console.log('✅ User activated successfully!');
        console.log('New status:', {
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            approvalStatus: user.approvalStatus
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

activateUser();
