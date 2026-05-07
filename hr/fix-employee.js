require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');

const fixEmployeeRecord = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const email = 'nithyabalu2209@gmail.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log('❌ User not found with email:', email);
            process.exit(1);
        }

        console.log('Found user:', user.username);

        // Check if employee record already exists
        let employee = await Employee.findOne({ email });

        if (!employee) {
            console.log('⚠️ No employee record found. Creating one...');

            employee = await Employee.create({
                firstName: 'Nithya',
                lastName: 'Balu',
                email: email,
                employeeId: 'EMP' + Math.floor(1000 + Math.random() * 9000), // Random 4-digit ID
                department: 'IT',
                position: 'Software Engineer',
                designation: 'Software Engineer', // Added designation as per schema
                joiningDate: new Date(),
                status: 'Active',
                phone: '9876543210',
                address: {
                    city: 'Chennai',
                    state: 'Tamil Nadu'
                }
            });
            console.log('✅ Created new employee record:', employee.employeeId);
        } else {
            console.log('ℹ️ Employee record already exists:', employee.employeeId);
        }

        // Link employee to user
        user.employeeId = employee._id;
        user.hasDataAccess = true; // Grant access automatically for this fix
        await user.save();

        console.log('✅ User linked to Employee record');
        console.log('✅ hasDataAccess set to true');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

fixEmployeeRecord();
