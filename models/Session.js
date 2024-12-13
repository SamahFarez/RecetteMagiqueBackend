// models/Session.js
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  sessionID: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dietType: { type: String, default: 'Not Set' },
  foodPreferences: {
    dietType: { type: String, default: 'Not Set' },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Session", sessionSchema);
