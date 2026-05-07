const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

async function createTestUsers() {
    try {
        // Check if HR user already exists
        const existingHR = await User.findOne({ email: 'hr@test.com' });
        if (existingHR) {
            console.log('✓ HR user already exists');
        } else {
            // Create HR user
            const hrUser = await User.create({
                username: 'HR Admin',
                email: 'hr@test.com',
                password: 'password123',
                role: 'HR',
                isActive: true
            });
            console.log('✓ Created HR user: hr@test.com / password123');
        }

        // Check if Employee user exists
        const existingEmp = await User.findOne({ email: 'employee@test.com' });
        if (existingEmp) {
            console.log('✓ Employee user already exists');
        } else {
            // Create a test employee record first
            const testEmployee = await Employee.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'employee@test.com',
                phone: '1234567890',
                department: 'IT',
                designation: 'Software Engineer',
                joiningDate: new Date(),
                employmentStatus: 'Active'
            });

            // Create Employee user linked to employee record
            const empUser = await User.create({
                username: 'John Doe',
                email: 'employee@test.com',
                password: 'password123',
                role: 'Employee',
                employeeId: testEmployee._id,
                isActive: true
            });
            console.log('✓ Created Employee user: employee@test.com / password123');
            console.log('✓ Created Employee record:', testEmployee.employeeId);
        }

        // Check if Manager user exists
        const existingMgr = await User.findOne({ email: 'manager@test.com' });
        if (existingMgr) {
            console.log('✓ Manager user already exists');
        } else {
            // Create a test manager employee record
            const testManager = await Employee.create({
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'manager@test.com',
                phone: '0987654321',
                department: 'IT',
                designation: 'IT Manager',
                joiningDate: new Date(),
                employmentStatus: 'Active'
            });

            // Create Manager user
            const mgrUser = await User.create({
                username: 'Jane Smith',
                email: 'manager@test.com',
                password: 'password123',
                role: 'Manager',
                employeeId: testManager._id,
                isActive: true
            });
            console.log('✓ Created Manager user: manager@test.com / password123');
            console.log('✓ Created Manager record:', testManager.employeeId);
        }

        console.log('\n=== Test Users Summary ===');
        console.log('HR Login:       hr@test.com / password123');
        console.log('Employee Login: employee@test.com / password123');
        console.log('Manager Login:  manager@test.com / password123');
        console.log('========================\n');

        process.exit(0);
    } catch (error) {
        console.error('Error creating test users:', error);
        process.exit(1);
    }
}

createTestUsers();
