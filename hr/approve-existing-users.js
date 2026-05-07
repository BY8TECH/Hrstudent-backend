const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

async function updateExistingUsers() {
    try {
        console.log('=== Updating Existing Users to Approved Status ===\n');

        // Update all existing users to Approved
        const result = await User.updateMany(
            { approvalStatus: { $exists: false } }, // Users without approvalStatus field
            {
                $set: {
                    approvalStatus: 'Approved',
                    isActive: true
                }
            }
        );

        console.log(`✓ Updated ${result.modifiedCount} users without approval status`);

        // Also update any Pending users to Approved (for existing users)
        const result2 = await User.updateMany(
            {
                approvalStatus: 'Pending',
                createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } // Created more than 5 minutes ago
            },
            {
                $set: {
                    approvalStatus: 'Approved',
                    isActive: true,
                    approvedDate: new Date()
                }
            }
        );

        console.log(`✓ Auto-approved ${result2.modifiedCount} old pending users`);

        // Show all users and their status
        const users = await User.find({}).select('username email role approvalStatus isActive');

        console.log('\n=== Current User Status ===');
        users.forEach(user => {
            console.log(`${user.email}`);
            console.log(`  Role: ${user.role}`);
            console.log(`  Status: ${user.approvalStatus}`);
            console.log(`  Active: ${user.isActive}`);
            console.log('---');
        });

        console.log('\n✅ All existing users are now approved!');
        console.log('You can now login without issues.\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateExistingUsers();
