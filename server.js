const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const session = require("express-session");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const axios = require("axios");
const cookieParser = require('cookie-parser');
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

// Use cookie-parser middleware
app.use(cookieParser());

app.use(session({
  secret: '123456', // Replace with a strong secret
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/',
    httpOnly: true,
    secure: true, // Ensure HTTPS
    sameSite: 'None', // For cross-site cookies
    domain: '.onrender.com', // Adjust to match your domain
    maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
  }
}));


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

const Restrictions = require("./models/Restrictions"); // Import Restrictions schema
app.get("/fetch-recipes/:ingredients", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const ingredientsParam = req.params.ingredients;
  let ingredients = ingredientsParam.split(",");

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: "Please provide valid ingredients." });
  }

  try {
    const user = await User.findOne({ email: req.session.user.email });
    const userRestriction = await UserRestriction.findOne({ userId: user._id });
    const dietType = userRestriction ? userRestriction.restrictionName : null;

    if (dietType) {
      ingredients = filterIngredientsByDietType(ingredients, dietType);
    }

    console.log("Filtered ingredients:", ingredients);

    if (ingredients.length === 0) {
      return res.status(400).json({ error: "No valid ingredients were provided after filtering." });
    }

    const ingredientsString = ingredients.join(",");
    console.log("Ingredients string for Spoonacular API:", ingredientsString);

    const response = await axios.get(
      `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${ingredientsString}&apiKey=${SPOONACULAR_API_KEY}${
        dietType ? `&diet=${dietType}` : ""
      }`
    );

    if (response.data.length === 0) {
      return res.status(404).send("No recipes found.");
    }

    const detailedRecipes = await Promise.all(
      response.data.map(async (recipe) => {
        const recipeDetailResponse = await axios.get(
          `https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${SPOONACULAR_API_KEY}`
        );
        const { title, readyInMinutes, instructions, extendedIngredients } = recipeDetailResponse.data;

        const usedIngredients = extendedIngredients.map((ing) => ing.name).join(", ");

        return `Recipe Name: ${title}\nCooking Time: ${readyInMinutes} minutes\nIngredients: ${usedIngredients}\nInstructions: ${instructions}\n\n`;
      })
    );

    res.send(`<pre>${detailedRecipes.join("\n\n")}</pre>`);
  } catch (error) {
    console.error("Error fetching recipes:", error.message);
    res.status(500).json({ error: "Error fetching recipes from API." });
  }
});


// Signup
app.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password, foodPreferences } = req.body;

    console.log("Received foodPreferences:", foodPreferences); // Log received foodPreferences

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
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
      foodPreferences: foodPreferences || "None", // Default to 'None' if not provided
    });

    await newUser.save();

    // Email confirmation logic
    const confirmationLink = `https://your-frontend-domain.com/confirm/${token}`;
    const mailOptions = {
      from: "your-email@gmail.com",
      to: email,
      subject: "Please confirm your email",
      html: `<p>Please confirm your email by clicking <a href="${confirmationLink}">here</a></p>`,
    };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "your-email@gmail.com",
        pass: "your-email-password",
      },
    });

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ message: "Error sending confirmation email" });
      }
      res.status(200).json({ message: "User registered successfully, please confirm your email" });
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
