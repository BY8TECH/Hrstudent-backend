const axios = require('axios');

async function addCategory() {
    try {
        const response = await axios.post('https://student-portal-znxr.onrender.com/api/courses/categories/list', {
            name: "Data Science",
            description: "Learn Python, ML, and AI basics",
            imageUrl: "https://example.com/data-science.jpg"
        });
        console.log("Success:", response.data);
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
}

addCategory();
