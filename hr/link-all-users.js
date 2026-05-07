const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

async function checkUserEmployeeLinks() {
    try {
        console.log('=== Checking User-Employee Links ===\n');

        const users = await User.find({}).populate('employeeId');

        for (const user of users) {
            console.log(`Email: ${user.email}`);
            console.log(`Role: ${user.role}`);
            console.log(`Has employeeId: ${!!user.employeeId}`);

            if (user.employeeId) {
                if (typeof user.employeeId === 'object' && user.employeeId.firstName) {
                    console.log(`  ✓ Linked to: ${user.employeeId.firstName} ${user.employeeId.lastName} (${user.employeeId.employeeId})`);
                } else {
                    console.log(`  ⚠️  Has employeeId but not populated properly`);
                }
            } else {
                console.log(`  ✗ NOT linked to any employee record`);

                // Try to find or create employee record
                const employee = await Employee.findOne({ email: user.email });
                if (employee) {
                    console.log(`  → Found matching employee record: ${employee.employeeId}`);
                    console.log(`  → Linking now...`);
                    user.employeeId = employee._id;
                    await user.save();
                    console.log(`  ✓ Linked!`);
                } else if (user.role !== 'HR') {
                    console.log(`  → No employee record found. Creating one...`);
                    const newEmployee = await Employee.create({
                        firstName: user.username.split(' ')[0] || 'User',
                        lastName: user.username.split(' ')[1] || 'Name',
                        email: user.email,
                        phone: '0000000000',
                        department: user.role === 'Manager' ? 'Management' : 'IT',
                        designation: user.role === 'Manager' ? 'Manager' : 'Employee',
                        joiningDate: new Date(),
                        employmentStatus: 'Active'
                    });
                    user.employeeId = newEmployee._id;
                    await user.save();
                    console.log(`  ✓ Created and linked: ${newEmployee.employeeId}`);
                }
            }
            console.log('---\n');
        }

        console.log('=== Summary ===');
        console.log('All users now have employee records linked!');
        console.log('\n⚠️  IMPORTANT: LOGOUT and LOGIN again for changes to take effect!\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUserEmployeeLinks();
