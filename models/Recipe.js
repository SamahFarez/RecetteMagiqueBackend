const mongoose = require('mongoose');

// Define the User schema
const userSchema = new mongoose.Schema({
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    token: { type: String },
    isVerified: { type: Boolean, default: false },
    foodPreferences: { type: Object, default: {} } // Optional food preferences
}, { collection: 'Users' }); // Specify the collection name

// Create the model based on the schema
const User = mongoose.model('User', userSchema);

module.exports = User;

