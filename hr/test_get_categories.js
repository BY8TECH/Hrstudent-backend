const axios = require('axios');

async function testFetch() {
    try {
        const response = await axios.get('https://student-portal-znxr.onrender.com/api/courses/categories/list');
        console.log("Success:", JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
}

testFetch();
