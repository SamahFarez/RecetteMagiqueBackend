const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const preferencesRoutes = require('./routes/preferencesRoutes.js'); // Import the preferences routes

require('dotenv').config(); // Load environment variables

const app = express();
const port = 5000;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000', // Change to your frontend URL
    credentials: true // Allow cookies to be sent
}));

// Configure express-session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || '123', // Use env variable for a better secret in production
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

app.use(express.json());

// MongoDB Connection
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://hh:hhhhhhhh@cluster0.5eb3y.mongodb.net/recette?retryWrites=true&w=majority';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((err) => console.error('Error connecting to MongoDB Atlas: ', err));

// Models
const User = require('./models/User'); // Import User schema

// Save preferences route
app.post('/api/save-preferences', async (req, res) => {
    console.log('Session data:', req.session);
    try {
        const { preferences } = req.body;

        // Make sure the user is logged in and has a valid session
        if (!req.session.user) {
            return res.status(401).json({ error: 'Unauthorized. Please log in first.' });
        }

        // Find the user and update their food preferences
        const user = await User.findOne({ email: req.session.user.email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update the user's preferences in the database
        user.foodPreferences = preferences;
        await user.save();

        res.status(200).json({ message: 'Preferences saved successfully!' });

    } catch (error) {
        console.error('Error saving preferences:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Signup handler
const handleSignup = async (req, res) => {
    try {
        const { fullName, email, password, foodPreferences } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a random token for email verification
        const token = crypto.randomBytes(32).toString('hex');

        // Create a new user and assign the token
        const newUser = new User({
            full_name: fullName,
            email,
            password: hashedPassword,
            token,  // Assign the token here
            isVerified: false,  // Initially, the user is not verified
            foodPreferences: foodPreferences || {}, // Default to empty object if not provided
        });

        // Save the new user to the database
        await newUser.save();

        // Create the confirmation link with the token
        const confirmationLink = `http://localhost:5000/confirm/${token}`;

        // Prepare the email content
        const mailOptions = {
            from: 'samah.ikramfarez@gmail.com',  // Your email address
            to: email,  // Recipient's email address
            subject: 'Email Confirmation',
            html: `<h1>Welcome ${fullName}!</h1>
                   <p>Please confirm your email by clicking the link: 
                   <a href="${confirmationLink}">Confirm Email</a></p>`
        };

        // Send the email with the confirmation link
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending confirmation email' });
            }
            console.log('Confirmation email sent:', info.response);
            res.status(200).json({ message: 'User registered successfully, please confirm your email' });
        });

    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Login handler
const handleLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (!user.isVerified) {
            return res.status(403).json({ error: 'Email not confirmed. Please check your inbox.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // Create session if everything is fine
        req.session.user = {
            email: user.email,
            fullName: user.full_name,
        };

        // Check if the user has preferences
        if (Object.keys(user.foodPreferences).length === 0) {
            return res.status(200).json({
                message: 'Login successful',
                redirectUrl: '/preferences',  // Relative path (NOT full URL)
            });
        }

        res.status(200).json({
            message: 'Login successful',
            redirectUrl: '/dashboard',  // Relative path to dashboard
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Dashboard route
app.get('/dashboard', (req, res) => {
    if (req.session.user) {
        res.json({ message: 'Welcome to the dashboard!', user: req.session.user });
    } else {
        res.status(401).json({ message: 'Unauthorized access' });
    }
});

// Email confirmation endpoint
app.get('/confirm/:token', async (req, res) => {
    const token = req.params.token;

    try {
        // Find the user by the token
        const user = await User.findOne({ token });

        // If no user is found, or the token doesn't match
        if (!user) {
            return res.status(400).json({ message: 'Invalid token or user already verified' });
        }

        // If the user is already verified, inform them
        if (user.isVerified) {
            return res.status(200).json({
                message: 'Email already confirmed. You can now login.',
                redirectUrl: 'http://localhost:3000/login',  // Redirect to login page
            });
        }

        // Mark the user as verified
        user.isVerified = true;
        user.token = null;  // Clear the token after successful verification
        await user.save();  // Save the updated user

        // Redirect to login page after successful confirmation
        res.redirect('http://localhost:3000/login');  // Redirect user to login page

    } catch (error) {
        console.error('Error confirming token:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Signup route
app.post('/signup', handleSignup);

// Login route
app.post('/login', handleLogin);

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
