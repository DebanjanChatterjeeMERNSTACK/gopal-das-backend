// routes/visitorRoute.js
const express = require("express");
const router = express.Router();
const Visitor = require("../model/VisitorSchema");

// Increment visitor
router.get("/visitor", async (req, res) => {
  try {
    let visitor = await Visitor.findOne();

    if (!visitor) {
      visitor = new Visitor({ count: 1 });
    } else {
      visitor.count += 1;
    }

    await visitor.save();

    res.send({
      status: 200,
      message: "Visitor updated",
      count: visitor.count,
    });
  } catch (err) {
    res.status(400).send({
      status: 400,
      message: err.message,
    });
  }
});

module.exports = router;
