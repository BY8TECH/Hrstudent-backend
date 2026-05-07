// This script creates sample holidays for the calendar
// Run with: node create-holidays.js

require('dotenv').config();
const mongoose = require('mongoose');
const Holiday = require('./models/Holiday');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
};

const holidays = [
    {
        name: 'Republic Day',
        date: new Date('2026-01-26'),
        type: 'National',
        description: 'National Holiday',
        isOptional: false
    },
    {
        name: 'Holi',
        date: new Date('2026-03-14'),
        type: 'Festival',
        description: 'Festival of Colors',
        isOptional: false
    },
    {
        name: 'Eid al-Fitr',
        date: new Date('2026-04-01'),
        type: 'Festival',
        description: 'Islamic Holiday',
        isOptional: false
    },
    {
        name: 'Good Friday',
        date: new Date('2026-04-03'),
        type: 'Festival',
        description: 'Christian Holiday',
        isOptional: false
    },
    {
        name: 'Independence Day',
        date: new Date('2026-08-15'),
        type: 'National',
        description: 'National Holiday',
        isOptional: false
    },
    {
        name: 'Gandhi Jayanti',
        date: new Date('2026-10-02'),
        type: 'National',
        description: 'National Holiday',
        isOptional: false
    },
    {
        name: 'Diwali',
        date: new Date('2026-10-20'),
        type: 'Festival',
        description: 'Festival of Lights',
        isOptional: false
    },
    {
        name: 'Christmas',
        date: new Date('2026-12-25'),
        type: 'Festival',
        description: 'Christian Holiday',
        isOptional: false
    }
];

const createHolidays = async () => {
    try {
        await connectDB();

        // Clear existing holidays
        await Holiday.deleteMany({});
        console.log('🗑️  Cleared existing holidays');

        // Insert new holidays
        await Holiday.insertMany(holidays);
        console.log(`✅ Created ${holidays.length} holidays`);

        console.log('\nHolidays created:');
        holidays.forEach(h => {
            console.log(`  - ${h.name} (${h.date.toDateString()})`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating holidays:', error);
        process.exit(1);
    }
};

createHolidays();
