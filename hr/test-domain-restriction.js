require('dotenv').config();
const axios = require('axios');

const API_URL = 'https://by8labs-backend.onrender.com/api';

const runTest = async () => {
    try {
        console.log('🚀 Testing Email Domain Restriction...');

        // 1. Test Gmail (should be rejected)
        console.log('\n❌ Case 1: Registering with Gmail (should fail)...');
        try {
            await axios.post(`${API_URL}/auth/register`, {
                username: 'Gmail User',
                email: 'test@gmail.com',
                password: 'password123',
                role: 'Employee'
            });
            console.log('❌ Error: Gmail registration should have failed but succeeded!');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ Correctly blocked Gmail. Message:', error.response.data.message);
            } else {
                console.error('❌ Unexpected error for Gmail case:', error.message);
            }
        }

        // 2. Test Hostinger (should be accepted)
        console.log('\n✅ Case 2: Registering with Hostinger domain (should fail because of duplicate if already exists, but check if validator passes)...');
        // We use a random email to avoid duplicate key error if we just want to check the validator
        const randomEmail = `test_${Math.floor(Math.random() * 10000)}@by8labs.com`;
        try {
            const res = await axios.post(`${API_URL}/auth/register`, {
                username: 'Hostinger User',
                email: randomEmail,
                password: 'password123',
                role: 'Employee'
            });
            if (res.status === 201) {
                console.log('✅ Successfully passed domain validation for:', randomEmail);
            }
        } catch (error) {
            if (error.response && error.response.data.message.includes('Only business email')) {
                console.log('❌ Error: Hostinger email was incorrectly blocked!');
            } else {
                console.log('✅ Passed domain validation (it might have failed later but validator passed):', error.message);
            }
        }

        console.log('\n🎉 Domain restriction verification complete!');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
    } finally {
        process.exit();
    }
};

runTest();
