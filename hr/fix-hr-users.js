const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

async function fixHRUsers() {
    try {
        console.log('🔧 Fixing HR users...\n');

        // Update all HR users to ensure they have proper flags
        const result = await User.updateMany(
            { role: 'HR' },
            {
                $set: {
                    isActive: true,
                    approvalStatus: 'Approved',
                    hasDataAccess: true
                }
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} HR users`);

        // Show all HR users
        const hrUsers = await User.find({ role: 'HR' }).select('-password');
        console.log('\n📋 Current HR Users:');
        hrUsers.forEach(user => {
            console.log(`  - ${user.email}`);
            console.log(`    Role: ${user.role}`);
            console.log(`    Active: ${user.isActive}`);
            console.log(`    Approval: ${user.approvalStatus}`);
            console.log(`    Data Access: ${user.hasDataAccess}\n`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixHRUsers();
