const express = require("express");
const User = require("../models/user");
const { auth } = require("../middlewares/auth");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const router = express.Router();

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByCredentials(email, password);
    const token = await user.generateAuthToken();
    res.send({ user, token });
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: error.message });
  }
});

// Signup
router.post("/signup", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    const token = await user.generateAuthToken();
    res.status(201).send({ user, token });
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: "User already exists" });
  }
});

// Update profile (requires authentication middleware)
router.put("/me", auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ["name", "email", "password"];
  const isValidUpdate = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidUpdate) {
    return res.status(400).send({ error: "Invalid update fields" });
  }

  try {
    const user = req.user;
    updates.forEach((update) => (user[update] = req.body[update]));
    await user.save();
    res.send(user);
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: error.message });
  }
});

// Get current user profile
router.get("/me", auth, async (req, res) => {
  res.send(req.user);
});

// Reset password
router.put("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).send({ error: "Invalid token" });
    }
    user.password = newPassword;
    await user.save();
    res.send({ message: "Password reset successful" });
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: "Failed to reset password" });
  }
});

// Get user by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({ error: "Invalid user ID" });
  }

  try {
    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    res.send(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).send({ error: "Server error" });
  }
});
//Delete user
router.delete("/me", auth, async (req, res) => {
  try {
    const user = req.user;
    await user.remove();
    res.send({ message: "User account deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to delete user account" });
  }
});

//Search Users
router.get("/search", async (req, res) => {
  try {
    const { searchTerm } = req.query;
    const users = await User.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
      ],
    }).select("-password");

    res.send(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Server error" });
  }
});

// Connect with User ( authentication is required)
router.post("/:id/connect", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid user ID" });
    }

    if (user._id.toString() === id) {
      return res.status(400).send({ error: "Cannot connect to yourself" });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).send({ error: "User not found" });
    }

    if (targetUser.pendingConnections.includes(user._id)) {
      return res.status(400).send({ error: "Connection request already sent" });
    }

    targetUser.pendingConnections.push(user._id);
    await targetUser.save();

    res.send({ message: "Connection request sent" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Server error" });
  }
});

// Accept Connection (requires authentication)
router.put("/connections/:requestId/accept", auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).send({ error: "Invalid request ID" });
    }

    if (!user.pendingConnections.includes(requestId)) {
      return res.status(400).send({ error: "No such connection request" });
    }

    user.pendingConnections = user.pendingConnections.filter(
      (id) => id.toString() !== requestId
    );
    user.connections.push(requestId);

    const requestUser = await User.findById(requestId);
    requestUser.connections.push(user._id);
    await user.save();
    await requestUser.save();

    res.send({ message: "Connection request accepted" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Server error" });
  }
});

// Get Connections (requires authentication)
router.get("/me/connections", auth, async (req, res) => {
  try {
    const user = req.user;
    await user.populate("connections", "-password");
    res.send(user.connections);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Server error" });
  }
});

// Get Pending Connections (requires authentication)
router.get("/me/connections/pending", auth, async (req, res) => {
  try {
    const user = req.user;
    await user.populate("pendingConnections", "-password");
    res.send(user.pendingConnections);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Server error" });
  }
});

module.exports = router;
