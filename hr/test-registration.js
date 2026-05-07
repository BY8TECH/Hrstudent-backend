require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/User');
const Employee = require('./models/Employee');

const runTest = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const testEmail = 'testuser_auto@example.com';

        // Cleanup existing test data
        await User.deleteMany({ email: testEmail });
        await Employee.deleteMany({ email: testEmail });
        console.log('🧹 Cleaned up old test data');

        const registerRes = await axios.post('https://by8labs-backend.onrender.com/api/auth/register', {
            username: 'Test AutoUser',
            email: testEmail,
            password: 'password123',
            role: 'Employee'
        });

        const userId = registerRes.data.userId;
        console.log('✅ User registered. ID:', userId);

        // 2. Get OTP from DB (Simulating email check)
        const user = await User.findById(userId).select('+emailOTP');
        if (!user || !user.emailOTP) {
            throw new Error('User or OTP not found in DB');
        }
        console.log('🔑 Retrieved OTP from DB:', user.emailOTP);

        const verifyRes = await axios.post('https://by8labs-backend.onrender.com/api/auth/verify-otp', {
            userId: userId,
            otp: user.emailOTP
        });
        console.log('✅ Verification response:', verifyRes.data);

        // 4. Verify Final State
        const updatedUser = await User.findById(userId);
        if (!updatedUser.employeeId) {
            throw new Error('❌ User does NOT have an employeeId linked!');
        }
        console.log('✅ User linked to Employee ID:', updatedUser.employeeId);

        const employee = await Employee.findById(updatedUser.employeeId);
        if (!employee) {
            throw new Error('❌ Employee record was NOT created!');
        }
        console.log('✅ Employee record found:', employee.firstName, employee.lastName);
        console.log('✅ Department:', employee.department);

        console.log('🎉 TEST PASSED: Auto-creation of Employee record works!');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
};

runTest();
