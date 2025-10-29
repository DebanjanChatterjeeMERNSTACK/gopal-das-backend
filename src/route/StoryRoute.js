const express = require("express");
const route = express.Router();
const StorySchema = require("../model/StorySchema");
const { authenticate, authorize } = require("../middleware/Auth");

route.post( "/story", async (req, res) => {
    try {
      const { storyTitle, storyDescription ,fullName,phone,email} = req.body;  

      const data = await StorySchema({
        storyTitle,storyDescription,fullName,phone,email
      });
      data.save().then(() => {
        res.send({
          mess: "success",
          status: 200,
          text: "Story Uploaded Successfully",
          data: data,
        });
      });
    } catch (err) {
      console.error(err);
      res.send({
        mess: "error",
        status: 400,
        text: "Failed To Story Upload",
        error: err.message,
      });
    }
  }
);

route.get("/story", authenticate, authorize(["admin"]), 
async (req, res) => {
  try {
    const data = await StorySchema.find({}).sort({ _id: -1 });

    res.send({
      mess: "success",
      status: 200,
      text: "Fetch Successfull",
      data: data,
    });
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
}
);


route.delete("/story/:id",authenticate,authorize(["admin"]),
  async (req, res) => {
    const storyId = req.params.id;

    if (!storyId) {
      return res.send({
        mess: "error",
        status: 400,
        text: "Invalid Story ID.",
      });
    }

    try {
      const story = await StorySchema.findById(storyId);

      if (!story) {
        return res.send({
          mess: "error",
          status: 404,
          text: "Story Not Found.",
        });
      }


      const deleted = await StorySchema.findByIdAndDelete(storyId);

      return res.send({
        mess: "success",
        status: 200,
        text: "Story Deleted Successfully.",
        data: deleted,
      });
    } catch (err) {
      console.error("Story Delete Error:", err);
      return res.send({
        mess: "error",
        status: 500,
        text: "Story Delete Failed.",
        error: err.message,
      });
    }
  }
);



module.exports = route;
