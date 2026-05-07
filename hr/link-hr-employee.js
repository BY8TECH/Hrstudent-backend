const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

async function linkHRToEmployee() {
    try {
        console.log('=== Linking HR User to Employee Record ===\n');

        const hrUser = await User.findOne({ email: 'hr@test.com' });

        if (!hrUser) {
            console.log('❌ HR user not found!');
            process.exit(1);
        }

        // Check if HR user already has an employee record
        if (hrUser.employeeId) {
            console.log('✓ HR user already has an employee record');
            const employee = await Employee.findById(hrUser.employeeId);
            if (employee) {
                console.log('  Employee ID:', employee.employeeId);
                console.log('  Name:', employee.firstName, employee.lastName);
                console.log('\n✅ HR user is properly linked!');
                process.exit(0);
            }
        }

        // Create employee record for HR user
        console.log('Creating employee record for HR user...');
        const hrEmployee = await Employee.create({
            firstName: 'HR',
            lastName: 'Admin',
            email: 'hr@test.com',
            phone: '9999999999',
            department: 'HR',
            designation: 'HR Manager',
            joiningDate: new Date(),
            employmentStatus: 'Active'
        });

        // Link employee to user
        hrUser.employeeId = hrEmployee._id;
        await hrUser.save();

        console.log('✓ Created employee record:', hrEmployee.employeeId);
        console.log('✓ Linked to HR user account');

        console.log('\n=== ✅ SUCCESS ===');
        console.log('HR user can now:');
        console.log('- Apply for leaves');
        console.log('- Mark own attendance');
        console.log('- View own employee profile');
        console.log('\nPlease LOGOUT and LOGIN again for changes to take effect!');
        console.log('==================\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

linkHRToEmployee();
