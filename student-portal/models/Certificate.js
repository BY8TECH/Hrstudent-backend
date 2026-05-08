const mongoose = require("../config/spMongoose");

const certificateSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        requestId: { type: mongoose.Schema.Types.ObjectId, ref: "CertificateRequest" },
        courseName: { type: String, required: true },
        content: { type: String, required: true },
        duration: { type: String, required: true },
        fileUrl: { type: String, required: true },
        issuedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Certificate", certificateSchema);
