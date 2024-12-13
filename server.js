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
const Session = require("./models/Session"); // Import Session schema
const UserRestriction = require("./models/UserRestriction"); // Import UserRestriction schema

const app = express();
const PORT = process.env.PORT || 5000;

// Constants
const SPOONACULAR_API_KEY = "725e92e0455f4cc5bcf3cf289d5fc86e"; // Replace with your Spoonacular API key

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "https://recette-magique.vercel.app"], // Make sure both frontend URLs are here
    credentials: true, // Allow cookies to be sent with requests
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json());
const mongoURI = "mongodb+srv://hh:hhhhhhhh@cluster0.5eb3y.mongodb.net/recette?retryWrites=true&w=majority";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "1234",
    resave: true,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Ensure cookies are secure in production
      httpOnly: true,  // Prevents access to cookie via JavaScript
      sameSite: "None",  // Required for cross-origin cookies
      domain: ".onrender.com", // Adjust for your domain setup
    },
  })
);

// MongoDB Connection
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("Error connecting to MongoDB Atlas: ", err));

// Helper functions
const filterNonVegetarianIngredients = (ingredients) => {
  return ingredients.filter(
    (ingredient) => !MEAT_KEYWORDS.includes(ingredient.toLowerCase())
  );
};

const cleanRecipeName = (title) => {
  return title.replace(/^How to Make\s+/i, ""); // Remove 'How to' at the beginning of the title
};

// Session middleware
const retrieveSession = async (req, res, next) => {
  const sessionId = req.cookies.sessionId;

  if (!sessionId) {
    return res.status(401).json({ error: "Session not found" });
  }

  try {
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    // Check if the session has expired
    if (new Date() > session.expiresAt) {
      await Session.findByIdAndDelete(session._id); // Optional: delete expired session
      return res.status(401).json({ error: "Session expired" });
    }

    // Attach session data to the request object
    req.session = session;
    next();
  } catch (error) {
    console.error("Error retrieving session:", error);
    res.status(500).json({ error: "Server error" });
  }
};


// Routes
app.get('/api/user-preferences', async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
  
    try {
      const user = await User.findOne({ email: req.session.user.email });
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Ensure the user preferences (including dietType) are returned
      const dietType = user.foodPreferences.dietType || 'Not Set';
      
      res.status(200).json({ dietType });  // Send the dietType as a response
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

app.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password, foodPreferences } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString("hex");

    const newUser = new User({
      full_name: fullName,
      email,
      password: hashedPassword,
      token,
      isVerified: false,
      foodPreferences: foodPreferences || {},
    });

    await newUser.save();

    const confirmationLink = `https://recettemagique.onrender.com/confirm/${token}`;

    const mailOptions = {
      from: "recette.magique.cy@gmail.com",
      to: email,
      subject: "Email Confirmation",
      html: `<h1>Welcome ${fullName}!</h1>
                   <p>Please confirm your email by clicking the link: 
                   <a href="${confirmationLink}">Confirm Email</a></p>`,
    };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "recette.magique.cy@gmail.com",
        pass: process.env.EMAIL_PASSWORD, // Use environment variable for sensitive data
      },
    });

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ message: "Error sending confirmation email" });
      }
      console.log("Confirmation email sent:", info.response);
      res.status(200).json({
        message: "User registered successfully, please confirm your email",
      });
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Retrieve user data from the User table
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // 2. Check if the email is verified
    if (!user.isVerified) {
      return res
        .status(403)
        .json({ error: "Email not confirmed. Please check your inbox." });
    }

    // 3. Compare the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // 4. Retrieve restriction data from the UserRestriction table
    const userRestriction = await UserRestriction.findOne({ userId: user._id });
    console.log("User Restrictions:", userRestriction ? userRestriction : "NO USER RESTRICTION FOUND IN TABLE"); // Log restriction data
    const dietType = userRestriction ? userRestriction.restrictionName : null;
    console.log("User Restrictions:", dietType ? dietType : "NO DIET FOUND"); // Log restriction data

    // 5. Set the session data
    req.session.user = {
      id: user._id,
      fullName: user.full_name,
      email: user.email,
      foodPreferences: { dietType: dietType || 'Not Set' }, // Set food preferences from restriction data
    };

    // 6. Save session and redirect to the appropriate page
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ error: "Session error" });
      }

      // Redirect to dashboard if dietType is set, otherwise to preferences page
      const redirectUrl = dietType ? "/dashboard" : "/preferences";
      res.status(200).json({
        message: "Login successful",
        user: req.session.user,
        redirectUrl,
      });
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Server error" });
  }
});


// Logout Route
app.post("/logout", async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
      return res.status(400).json({ error: "No active session found" });
    }

    // Find and delete the session from the database
    const session = await Session.findOneAndDelete({ sessionId });

    if (!session) {
      return res.status(400).json({ error: "Session not found" });
    }

    // Clear the session cookie
    res.clearCookie("sessionId", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
    });

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
