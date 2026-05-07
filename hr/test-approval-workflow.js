require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/User');
const Employee = require('./models/Employee');

const API_URL = 'https://by8labs-backend.onrender.com/api';

const runTest = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const testEmail = 'test_approval_final@example.com';
        const hrEmail = 'hr@test.com';

        // Cleanup existing test data
        await User.deleteMany({ email: testEmail });
        await Employee.deleteMany({ email: testEmail });
        console.log('🧹 Cleaned up old test data');

        // 1. Register User
        console.log('🚀 Step 1: Registering user...');
        const registerRes = await axios.post(`${API_URL}/auth/register`, {
            username: 'Test ApprovalUser',
            email: testEmail,
            password: 'password123',
            role: 'Employee'
        });

        const userId = registerRes.data.userId;
        console.log('✅ User registered. ID:', userId);

        // 2. Get OTP from DB
        const user = await User.findById(userId).select('+emailOTP');
        const otp = user.emailOTP;
        console.log('🔑 Retrieved OTP from DB:', otp);

        // 3. Verify OTP
        console.log('✨ Step 2: Verifying OTP (should remain pending)...');
        const verifyRes = await axios.post(`${API_URL}/auth/verify-otp`, {
            userId: userId,
            otp: otp
        });
        console.log('✅ Verification response:', verifyRes.data.message);

        // Check user state after verification
        const verifiedUser = await User.findById(userId);
        console.log('📊 Status after verification:', verifiedUser.approvalStatus);
        console.log('📊 Active status:', verifiedUser.isActive);

        if (verifiedUser.approvalStatus !== 'Pending' || verifiedUser.isActive === true) {
            throw new Error('❌ Error: User should be Pending and Inactive after OTP verification');
        }
        console.log('✅ User is correctly Pending and Inactive.');

        // 4. Attempt login (should fail)
        console.log('🚫 Step 3: Attempting login (should fail)...');
        try {
            await axios.post(`${API_URL}/auth/login`, {
                email: testEmail,
                password: 'password123'
            });
            throw new Error('❌ Error: Login should have failed but succeeded!');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Login correctly blocked message:', error.response.data.message);
            } else {
                throw error;
            }
        }

        // 5. Find or Create HR user for approval
        let hrUser = await User.findOne({ email: hrEmail });
        if (!hrUser) {
            console.log('⚠️ No HR user found in DB. Creating a temporary HR user for testing...');
            hrUser = await User.create({
                username: 'HR Admin',
                email: hrEmail,
                password: 'password123',
                role: 'HR',
                isActive: true,
                approvalStatus: 'Approved',
                isEmailVerified: true
            });
        } else {
            console.log('✅ Existing HR user found. Resetting password and ensuring it is verified/active...');
            hrUser.isEmailVerified = true;
            hrUser.isActive = true;
            hrUser.approvalStatus = 'Approved';
            hrUser.password = 'password123'; // Reset password for test consistency
            await hrUser.save();
        }

        // Login as HR to get token
        console.log('🔑 Logging in as HR...');
        const hrLoginRes = await axios.post(`${API_URL}/auth/login`, {
            email: hrUser.email,
            password: 'password123'
        });
        const hrToken = hrLoginRes.data.token;

        // 6. Approve user
        console.log('✅ Step 4: Approving user as HR...');
        const approveRes = await axios.put(`${API_URL}/auth/approve-user/${userId}`, {}, {
            headers: { Authorization: `Bearer ${hrToken}` }
        });
        console.log('✅ Approval response:', approveRes.data.message);

        // 7. Attempt login again (should succeed)
        console.log('🔓 Step 5: Attempting login after approval...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: testEmail,
            password: 'password123'
        });
        console.log('✅ Login successful! Token received.');

        console.log('🎉 ALL TESTS PASSED: Registration approval workflow is working perfectly!');

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
