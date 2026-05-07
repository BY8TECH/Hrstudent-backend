const mongoose = require('mongoose');
require('dotenv').config();

const Candidate = require('./models/Candidate');
const JobPosting = require('./models/JobPosting');

async function seedTestData() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB Atlas!');

        // Check if we have any jobs first
        const jobCount = await JobPosting.countDocuments();
        console.log(`Found ${jobCount} jobs in database`);

        let testJob;
        if (jobCount === 0) {
            console.log('Creating a test job...');
            testJob = await JobPosting.create({
                jobId: 'JOB-TEST-001',
                title: 'Frontend Developer',
                department: 'IT',
                location: 'Bangalore',
                employmentType: 'Full-time',
                description: 'Test job for demo purposes',
                requirements: ['JavaScript', 'React'],
                experience: '2-4 years',
                salaryRange: '500000-800000',
                vacancies: 2,
                status: 'Published'
            });
            console.log('Test job created:', testJob.jobId);
        } else {
            testJob = await JobPosting.findOne({ status: 'Published' });
            console.log('Using existing job:', testJob.jobId);
        }

        // Check existing candidates
        const candidateCount = await Candidate.countDocuments();
        console.log(`Found ${candidateCount} candidates in database`);

        if (candidateCount === 0) {
            console.log('Creating test candidates...');
            const testCandidates = [
                {
                    candidateId: 'CAND-001',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john.doe@example.com',
                    phone: '+91-9876543210',
                    jobId: testJob._id,
                    location: 'Bangalore',
                    experience: 5,
                    currentCompany: 'Tech Corp',
                    expectedSalary: 600000,
                    skills: ['JavaScript', 'React', 'Node.js'],
                    source: 'Direct',
                    status: 'New'
                },
                {
                    candidateId: 'CAND-002',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: 'jane.smith@example.com',
                    phone: '+91-9876543211',
                    jobId: testJob._id,
                    location: 'Mumbai',
                    experience: 3,
                    currentCompany: 'Digital Solutions',
                    expectedSalary: 550000,
                    skills: ['JavaScript', 'Vue.js', 'TypeScript'],
                    source: 'LinkedIn',
                    status: 'New'
                },
                {
                    candidateId: 'CAND-003',
                    firstName: 'Raj',
                    lastName: 'Kumar',
                    email: 'raj.kumar@example.com',
                    phone: '+91-9876543212',
                    jobId: testJob._id,
                    location: 'Bangalore',
                    experience: 4,
                    currentCompany: 'Web Innovations',
                    expectedSalary: 700000,
                    skills: ['React', 'Redux', 'GraphQL'],
                    source: 'Referral',
                    status: 'New'
                }
            ];

            const created = await Candidate.insertMany(testCandidates);
            console.log(`Created ${created.length} test candidates successfully!`);

            created.forEach(c => {
                console.log(`  - ${c.candidateId}: ${c.firstName} ${c.lastName}`);
            });
        } else {
            console.log('Candidates already exist, skipping creation');
        }

        console.log('\nDatabase seeding completed!');
        console.log('You can now view candidates in your application.');

    } catch (error) {
        console.error('Error seeding data:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
        process.exit(0);
    }
}

seedTestData();
