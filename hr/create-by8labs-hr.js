const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

async function createBy8LabsHR() {
    try {
        console.log('=== Creating By8Labs HR Account ===\n');

        // Delete if exists
        await User.deleteOne({ email: 'hr@by8labs.com' });
        await Employee.deleteOne({ email: 'hr@by8labs.com' });

        // Create employee record
        const hrEmployee = await Employee.create({
            firstName: 'HR',
            lastName: 'By8Labs',
            email: 'hr@by8labs.com',
            phone: '0000000000',
            department: 'HR',
            designation: 'HR Manager',
            joiningDate: new Date(),
            employmentStatus: 'Active'
        });

        // Create user account
        const hrUser = await User.create({
            username: 'HR By8Labs',
            email: 'hr@by8labs.com',
            password: 'by8labs1234hr',
            role: 'HR',
            employeeId: hrEmployee._id,
            isActive: true,
            approvalStatus: 'Approved',
            approvedDate: new Date(),
            hasDataAccess: true
        });

        console.log('✅ SUCCESS!\n');
        console.log('📧 LOGIN CREDENTIALS:');
        console.log('   Email:    hr@by8labs.com');
        console.log('   Password: by8labs1234hr');
        console.log('\n✨ Account Details:');
        console.log('   Role: HR (Full Access)');
        console.log('   Employee ID:', hrEmployee.employeeId);
        console.log('   User ID:', hrUser._id);
        console.log('\n🚀 Login at: https://by8labs-frontend.onrender.com\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createBy8LabsHR();
