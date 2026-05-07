const axios = require('axios');

async function testFetch() {
    try {
        console.log("Logging in...");
        const loginRes = await axios.post('https://student-portal-znxr.onrender.com/api/auth/login', {
            identifier: 'hr@test.com', // or whatever works
            password: 'password123'
        });

        const token = loginRes.data.token || loginRes.data.data.token;
        console.log("Token received.");

        console.log("Fetching categories...");
        const response = await axios.get('https://student-portal-znxr.onrender.com/api/courses/categories/list', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Success:", JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
}

testFetch();
