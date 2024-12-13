// models/Session.js
const mongoose = require('mongoose');

// Define the session schema
const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Reference to the User collection
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,  // Store the time the session was created
  },
  expiresAt: {
    type: Date,
    required: true,  // When this session will expire
  },
});

// Create the session model
const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
