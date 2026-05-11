const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function check() {
    try {
        console.log('Connecting to HR DB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const Notification = require('../hr/models/Notification');
        const User = require('../hr/models/User');

        const count = await Notification.countDocuments();
        console.log(`Total Notifications in HR DB: ${count}`);

        const latest = await Notification.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('recipientId', 'username email');

        console.log('Latest 5 Notifications:');
        console.log(JSON.stringify(latest, null, 2));

        const hrUsers = await User.find({ role: 'HR' });
        console.log(`HR Users found: ${hrUsers.length}`);
        hrUsers.forEach(u => console.log(`- ${u.username} (${u.email}) [${u._id}]`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
