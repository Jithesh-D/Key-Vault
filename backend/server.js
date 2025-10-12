// backend/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware - enable CORS for all origins (for development)
app.use(
  cors({
    origin: "*", // Allow all origins in development
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb+srv://root:root@myproject.pmimgo1.mongodb.net/LInkz?retryWrites=true&w=majority&appName=Myproject",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Define Link schema
const linkSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  description: { type: String, required: true },
  studentEmail: { type: String, required: true }, // New field for student email
  createdAt: { type: Date, default: Date.now },
  userToken: { type: String, default: () => generateUserToken() }, // Unique identifier for user
});

const Link = mongoose.model("Link", linkSchema);

// Generate unique user token
function generateUserToken() {
  return (
    "user_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
  );
}

// Validate RVU email
function validateRVUEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@rvu\.edu\.in$/;
  return emailRegex.test(email);
}

// API Routes
app.get("/api/links", async (req, res) => {
  try {
    console.log("📥 Fetching links from database...");
    const links = await Link.find().sort({ createdAt: -1 });
    console.log(`✅ Found ${links.length} links`);
    res.json(links);
  } catch (error) {
    console.error("❌ Error fetching links:", error);
    res.status(500).json({ error: "Failed to fetch links" });
  }
});

app.post("/api/links", async (req, res) => {
  try {
    console.log("📥 Received link submission:", req.body);
    const { title, url, description, studentEmail, userToken } = req.body;

    // Basic validation
    if (!title || !url || !description || !studentEmail) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // RVU Email validation
    if (!validateRVUEmail(studentEmail)) {
      return res
        .status(400)
        .json({ error: "Please use a valid RVU email address (@rvu.edu.in)" });
    }

    // URL validation
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const newLink = new Link({
      title,
      url,
      description,
      studentEmail,
      userToken: userToken || generateUserToken(),
    });
    await newLink.save();
    console.log("✅ Link saved successfully with email:", studentEmail);
    res.status(201).json(newLink);
  } catch (error) {
    console.error("❌ Error creating link:", error);
    res.status(500).json({ error: "Failed to create link" });
  }
});

// Delete link endpoint
app.delete("/api/links/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userToken } = req.body;

    console.log(`🗑️ Attempting to delete link ${id} for user ${userToken}`);

    if (!userToken) {
      return res.status(400).json({ error: "User token is required" });
    }

    const link = await Link.findById(id);

    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    // Check if the user owns this link
    if (link.userToken !== userToken) {
      return res
        .status(403)
        .json({ error: "You can only delete your own links" });
    }

    await Link.findByIdAndDelete(id);
    console.log("✅ Link deleted successfully");
    res.json({ message: "Link deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting link:", error);
    res.status(500).json({ error: "Failed to delete link" });
  }
});

// Get links by student email
app.get("/api/links/email/:email", async (req, res) => {
  try {
    const { email } = req.params;

    if (!validateRVUEmail(email)) {
      return res.status(400).json({ error: "Invalid RVU email format" });
    }

    const links = await Link.find({ studentEmail: email }).sort({
      createdAt: -1,
    });
    res.json(links);
  } catch (error) {
    console.error("❌ Error fetching links by email:", error);
    res.status(500).json({ error: "Failed to fetch links" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Key Vault API is running",
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📚 API Health: http://localhost:${PORT}/api/health`);
  console.log(`🔧 API Test: http://localhost:${PORT}/api/test`);
});
