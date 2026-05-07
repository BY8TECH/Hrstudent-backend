const mongoose = require("../config/spMongoose");

const counterSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    seq: { type: Number, default: 1999 }
});

module.exports = mongoose.model("Counter", counterSchema);
