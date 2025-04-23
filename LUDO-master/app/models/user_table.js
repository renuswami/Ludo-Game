const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    seed: { type: String },
    clientId: { type: String },
    profilePic: { type: String, default: "0" },
    lastBet: { type: String },
    lastAction: { type: String },
    chips: { type: Number, default: 0 },
    turn: { type: Boolean, default: false },
    winner: { type: Boolean, default: false },
    show: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    deal: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    packed: { type: Boolean, default: false },
    isSideShowAvailable: { type: Boolean, default: false },
    lasttableId: { type: String },
    cardSet: { type: Object }, 
    type: { type: String, default: "premium" },
    mobile: { type: String, required: true },
    email: { type: String },
    password: { type: String, required: true },
    sms_verify: { type: Number, default: 0 },
    email_verify: { type: Number, default: 0 },
    displayName: { type: String }
}, { collection: "users" });

// Create the model
const User = mongoose.model("users", userSchema);

module.exports = User;
