const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkData() {
    try {
        const spConn = await mongoose.createConnection(process.env.SP_MONGO_URI).asPromise();
        console.log('Connected to Student Portal Database');

        const docSchema = new mongoose.Schema({
            userId: mongoose.Schema.Types.ObjectId,
            courseName: String,
            fileName: String,
            fileUrl: String
        }, { timestamps: true });
        
        const Document = spConn.model('Document', docSchema);

        const lastDocs = await Document.find().sort({ createdAt: -1 }).limit(5);

        console.log('\n--- Recent Documents ---');
        lastDocs.forEach(d => {
            console.log(`ID: ${d._id}, FileName: ${d.fileName}, Course: ${d.courseName}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
