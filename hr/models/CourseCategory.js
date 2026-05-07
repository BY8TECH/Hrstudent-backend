const mongoose = require('mongoose');

const courseCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    fees: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

module.exports = mongoose.model('CourseCategory', courseCategorySchema);
