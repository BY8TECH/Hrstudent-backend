const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to HR Database');

        const Student = require('../hr/models/Student');
        const StudentAdmission = require('../hr/models/StudentAdmission');

        const lastAdmissions = await StudentAdmission.find().sort({ createdAt: -1 }).limit(5);
        const lastStudents = await Student.find().sort({ createdAt: -1 }).limit(5);

        console.log('\n--- Recent Admissions ---');
        lastAdmissions.forEach(a => {
            console.log(`ID: ${a.admissionId}, Name: ${a.applicantName}, Status: ${a.status}, StudentLink: ${a.student}`);
        });

        console.log('\n--- Recent Students ---');
        lastStudents.forEach(s => {
            console.log(`ID: ${s.studentId}, Name: ${s.name}, CreatedAt: ${s.createdAt}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
