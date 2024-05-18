const express = require("express");
const Chat = require("../models/chat");
const { auth } = require("../middlewares/auth");
const mongoose = require("mongoose");

const router = express.Router();

// Assuming io is passed as an argument to this file
module.exports = function (io) {
  // Start Chat
  router.post("/", auth, async (req, res) => {
    try {
      const { userId } = req.body;
      const currentUserId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).send({ error: "Invalid user ID" });
      }

      if (userId === currentUserId.toString()) {
        return res
          .status(400)
          .send({ error: "Cannot start a chat with yourself" });
      }

      let chat = await Chat.findOne({
        participants: { $all: [currentUserId, userId] },
      });

      if (!chat) {
        chat = new Chat({ participants: [currentUserId, userId] });
        await chat.save();
      }

      res.status(201).send(chat);
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: "Failed to start chat" });
    }
  });

  // Get Chats
  router.get("/", auth, async (req, res) => {
    try {
      const userId = req.user._id;
      const chats = await Chat.find({
        participants: userId,
      })
        .populate("participants", "-password")
        .populate({
          path: "messages",
          options: { sort: { timestamp: -1 }, limit: 1 },
        });

      res.send(chats);
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: "Failed to fetch chats" });
    }
  });

  return router;
};
