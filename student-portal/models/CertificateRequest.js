const mongoose = require("../config/spMongoose");

const certificateRequestSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
        studentName: { type: String },
        studentEmail: { type: String },
        courseName: { type: String },
        duration: { type: String },
        status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
        requestedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

module.exports = mongoose.model("CertificateRequest", certificateRequestSchema);
