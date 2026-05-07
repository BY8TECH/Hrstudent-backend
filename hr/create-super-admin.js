const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

async function createSuperAdmin() {
    try {
        console.log('=== Creating Super Admin Account ===\n');

        // Delete if exists
        await User.deleteOne({ email: 'admin@test.com' });
        console.log('✓ Cleaned up old admin account');

        // Create employee record for admin
        const adminEmployee = await Employee.create({
            firstName: 'Super',
            lastName: 'Admin',
            email: 'admin@test.com',
            phone: '1111111111',
            department: 'HR',
            designation: 'System Administrator',
            joiningDate: new Date(),
            employmentStatus: 'Active'
        });
        console.log('✓ Created employee record:', adminEmployee.employeeId);

        // Create user account
        const adminUser = await User.create({
            username: 'Super Admin',
            email: 'admin@test.com',
            password: 'admin123',
            role: 'HR',
            employeeId: adminEmployee._id,
            isActive: true,
            approvalStatus: 'Approved',
            approvedDate: new Date()
        });
        console.log('✓ Created user account');

        console.log('\n=== ✅ SUCCESS ===');
        console.log('Fresh admin account created!');
        console.log('\n📧 LOGIN CREDENTIALS:');
        console.log('   Email:    admin@test.com');
        console.log('   Password: admin123');
        console.log('\n✨ This account has:');
        console.log('   ✓ HR Role (full access)');
        console.log('   ✓ Employee record linked');
        console.log('   ✓ Approved status');
        console.log('   ✓ Active status');
        console.log('\n🚀 GO TO: https://by8labs-frontend.onrender.com');
        console.log('   Login with credentials above\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createSuperAdmin();
