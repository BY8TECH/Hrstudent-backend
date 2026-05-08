const mongoose = require("../config/spMongoose");

const certificateRequestSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        courseName: { type: String, required: true },
        duration: { type: String, required: true },
        status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
        requestedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

module.exports = mongoose.model("CertificateRequest", certificateRequestSchema);
