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
            fileUrl: String,
            cloudinaryId: String,
        }, { timestamps: true });
        
        const Document = spConn.model('Document', docSchema);

        const docs = await Document.find().sort({ createdAt: -1 }).limit(10);

        console.log('\n--- All Document fileUrls ---');
        docs.forEach(d => {
            console.log(`ID: ${d._id}`);
            console.log(`  fileName:    ${d.fileName}`);
            console.log(`  fileUrl:     ${d.fileUrl}`);
            console.log(`  cloudinaryId:${d.cloudinaryId}`);
            console.log('');
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
