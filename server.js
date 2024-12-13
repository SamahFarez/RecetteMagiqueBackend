const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const session = require("express-session");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const axios = require("axios");

require("dotenv").config(); // Load environment variables

const User = require("./models/User"); // Import User schema

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "https://recette-magique.vercel.app"], // Frontend URLs
    credentials: true, // Allow cookies to be sent with requests
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json());
const mongoURI =
  "mongodb+srv://hh:hhhhhhhh@cluster0.5eb3y.mongodb.net/recette?retryWrites=true&w=majority";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "1234",
    resave: true,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Secure cookies for production
      httpOnly: true, // Prevents access to cookies via JavaScript
      maxAge: 1000 * 60 * 60 * 24 * 7, // Persistent cookie: 1 week
      sameSite: "None", // Required for cross-origin cookies
      domain: ".onrender.com", // Adjust for your domain setup
    },
  })
);

// MongoDB Connection
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("Error connecting to MongoDB Atlas: ", err));

// Middleware to log session and cookies
app.use((req, res, next) => {
  console.log("Session ID:", req.sessionID);
  console.log("Session Data:", req.session);
  console.log("Cookies:", req.cookies);
  next();
});

// Helper functions
const cleanRecipeName = (title) => {
  return title.replace(/^How to Make\s+/i, ""); // Remove 'How to' at the beginning of the title
};

// Signup
app.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password, foodPreferences } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("Signup attempt failed: User already exists");
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a unique token for email verification
    const token = crypto.randomBytes(32).toString("hex");

    // Create a new user
    const newUser = new User({
      full_name: fullName,
      email,
      password: hashedPassword,
      token,
      isVerified: false,
      foodPreferences: foodPreferences || "None", // Default to "None" if not provided
    });

    await newUser.save();

    // Create the email confirmation link
    const confirmationLink = `https://recettemagique.onrender.com/confirm/${token}`;

    // Email options
    const mailOptions = {
      from: "recette.magique.cy@gmail.com",
      to: email,
      subject: "Email Confirmation",
      html: `<h1>Welcome ${fullName}!</h1>
                   <p>Please confirm your email by clicking the link: 
                   <a href="${confirmationLink}">Confirm Email</a></p>`,
    };

    // Configure the email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "recette.magique.cy@gmail.com",
        pass: "jyoj afjs utcm swwe",
      },
    });

    // Send the confirmation email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res
          .status(500)
          .json({ message: "Error sending confirmation email" });
      }
      console.log("Confirmation email sent:", info.response);
      res
        .status(200)
        .json({
          message: "User registered successfully, please confirm your email",
        });
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Retrieve user data from the User table
    const user = await User.findOne({ email });
    if (!user) {
      console.log("Login failed: User not found");
      return res.status(401).json({ error: "User not found" });
    }

    // 2. Check if the email is verified
    if (!user.isVerified) {
      console.log("Login failed: Email not confirmed");
      return res
        .status(403)
        .json({ error: "Email not confirmed. Please check your inbox." });
    }

    // 3. Compare the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Login failed: Incorrect password");
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Save user info in session
    req.session.user = {
      id: user._id,
      fullName: user.full_name,
      email: user.email,
      foodPreferences: user.foodPreferences,
    };

    console.log("Login successful, session data:", req.session.user);
    res.status(200).json({
      message: "Login successful",
      user: req.session.user,
      redirectUrl: "/dashboard",
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Email confirmation
app.get("/confirm/:token", async (req, res) => {
  try {
    const token = req.params.token;

    const user = await User.findOne({ token });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid token or user already verified" });
    }

    if (user.isVerified) {
      return res.redirect("https://recette-magique.vercel.app/login");
    }

    user.isVerified = true;
    user.token = null;
    await user.save();

    res.redirect("https://recette-magique.vercel.app/login");
  } catch (error) {
    console.error("Error confirming token:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    console.log("Access denied: No active session");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("Dashboard accessed, session user:", req.session.user);
  res.json({ message: "Welcome to the dashboard!", user: req.session.user });
});

// Logout
app.post("/logout", (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error during logout:", err);
        return res.status(500).json({ error: "Failed to log out" });
      }

      res.clearCookie("connect.sid");
      console.log("Logout successful, session cleared");
      res.status(200).json({ message: "Logged out successfully" });
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
