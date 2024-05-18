const express = require("express");
const Message = require("../models/message");
const Chat = require("../models/chat");
const User = require("../models/user");
const { auth } = require("../middlewares/auth");
const mongoose = require("mongoose");

const router = express.Router();

// io will passed as an argument to this file
module.exports = function (io) {
  // Send Message (DM)
  router.post("/", auth, async (req, res) => {
    try {
      const { recipientId, content } = req.body;
      const senderId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        return res.status(400).send({ error: "Invalid recipient ID" });
      }

      const recipient = await User.findById(recipientId);
      if (!recipient) {
        return res.status(404).send({ error: "Recipient not found" });
      }

      const message = new Message({
        sender: senderId,
        recipient: recipientId,
        content,
      });
      await message.save();

      // Find or create chat
      let chat = await Chat.findOne({
        participants: { $all: [senderId, recipientId] },
      });

      if (!chat) {
        chat = new Chat({
          participants: [senderId, recipientId],
          messages: [message._id],
        });
      } else {
        chat.messages.push(message._id);
      }

      await chat.save();

      // Emit the new message event
      io.to(recipientId.toString()).emit("newMessage", message);

      res.status(201).send(message);
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: "Failed to send message" });
    }
  });

  // Get Messages
  router.get("/:withUserId", auth, async (req, res) => {
    try {
      const { withUserId } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(withUserId)) {
        return res.status(400).send({ error: "Invalid user ID" });
      }

      const chat = await Chat.findOne({
        participants: { $all: [userId, withUserId] },
      }).populate("messages");

      if (!chat) {
        return res.status(404).send({ error: "Chat not found" });
      }

      res.send(chat.messages);
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: "Failed to fetch messages" });
    }
  });

  return router;
};
