const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkData() {
    try {
        // Connect to Student Portal Database
        const spConn = await mongoose.createConnection(process.env.SP_MONGO_URI).asPromise();
        console.log('Connected to Student Portal Database');

        const userSchema = new mongoose.Schema({
            name: String,
            email: String,
            role: String
        }, { timestamps: true });
        
        const User = spConn.model('User', userSchema);

        const lastUsers = await User.find().sort({ createdAt: -1 }).limit(5);

        console.log('\n--- Recent SP Users ---');
        lastUsers.forEach(u => {
            console.log(`Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, CreatedAt: ${u.createdAt}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
