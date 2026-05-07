const mongoose = require('mongoose');

/**
 * Dual Database Connection Manager
 * 
 * Connects to two separate MongoDB databases on the same cluster:
 * - HR Database (hr_payroll)      → uses default mongoose connection
 * - Student Portal (student_portal) → uses separate mongoose.createConnection()
 * 
 * IMPORTANT: Both connect to the SAME Atlas cluster with the SAME data.
 * No data is lost — createConnection() just creates a separate connection object.
 */

let spConnection = null;

const connectHRDB = async () => {
    try {
        const dbUri = process.env.MONGODB_URI;
        if (!dbUri) {
            throw new Error('MONGODB_URI is not defined in .env');
        }

        const conn = await mongoose.connect(dbUri, {
            serverSelectionTimeoutMS: 5000,
        });

        console.log(`✅ HR Database Connected: ${conn.connection.host} (${conn.connection.name})`);
        return true;
    } catch (error) {
        let errorMessage = error.message;
        if (errorMessage.includes('EAI_AGAIN')) {
            errorMessage = 'DNS lookup timeout (EAI_AGAIN). Check your internet connection.';
        }
        console.error(`❌ HR Database Connection Error: ${errorMessage}`);
        return false;
    }
};

const connectSPDB = async () => {
    try {
        const dbUri = process.env.SP_MONGO_URI;
        if (!dbUri) {
            throw new Error('SP_MONGO_URI is not defined in .env');
        }

        spConnection = mongoose.createConnection(dbUri, {
            serverSelectionTimeoutMS: 5000,
        });
        await spConnection.asPromise();

        console.log(`✅ Student Portal Database Connected: ${spConnection.host} (${spConnection.name})`);
        return spConnection;
    } catch (error) {
        let errorMessage = error.message;
        if (errorMessage.includes('EAI_AGAIN')) {
            errorMessage = 'DNS lookup timeout (EAI_AGAIN). Check your internet connection.';
        }
        console.error(`❌ Student Portal Database Connection Error: ${errorMessage}`);
        return null;
    }
};

const getSPConnection = () => spConnection;

module.exports = { connectHRDB, connectSPDB, getSPConnection };
