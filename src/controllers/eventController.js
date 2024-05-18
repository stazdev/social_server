const express = require("express");
const Event = require("../models/event");
const { auth } = require("../middlewares/auth");

const router = express.Router();

// Create Event
router.post("/", auth, upload.single("image"), async (req, res) => {
  try {
    const event = new Event({
      ...req.body,
      organizer: req.user._id,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
    });
    await event.save();
    res.status(201).send(event);
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: error.message });
  }
});

// Register for Event
router.post("/:eventId/register", auth, async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).send({ error: "Event not found" });
    }

    if (!event.attendees.includes(req.user._id)) {
      event.attendees.push(req.user._id);
      await event.save();
    }

    res.status(200).send(event);
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: error.message });
  }
});

// Get Events
router.get("/", async (req, res) => {
  try {
    const events = await Event.find(req.query);
    res.send(events);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});

// Get Event by ID
router.get("/:eventId", async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).send({ error: "Event not found" });
    }

    res.send(event);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});

// Get Registered Events for the User
router.get("/me/registered", auth, async (req, res) => {
  try {
    const events = await Event.find({ attendees: req.user._id });
    res.send(events);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});

module.exports = router;
