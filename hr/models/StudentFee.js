const mongoose = require('mongoose');

const studentFeeSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentCourse' },
    feeType: { type: String, required: true, trim: true }, // e.g., "Tuition", "Lab", "Exam"
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    dueDate: { type: Date },
    paidDate: { type: Date },
    status: {
        type: String,
        enum: ['Pending', 'Paid', 'Partial', 'Overdue'],
        default: 'Pending',
    },
    receiptNumber: { type: String, unique: true, sparse: true },
    installment: { type: String, trim: true }, // e.g., "Installment 1", "Down Payment"
    paymentMode: { type: String, enum: ['Cash', 'UPI', 'Card', 'Online', 'Cheque', 'DD'], default: 'Cash' },
    notes: { type: String },
}, { timestamps: true });

// Auto-generate receipt number on payment
studentFeeSchema.pre('save', async function (next) {
    if ((this.status === 'Paid' || this.status === 'Partial') && !this.receiptNumber) {
        const count = await mongoose.model('StudentFee').countDocuments();
        this.receiptNumber = `RCP${Date.now()}-${count + 1}`;
    }
    next();
});

module.exports = mongoose.model('StudentFee', studentFeeSchema);
