const express = require("express");
const route = express.Router();
const VideoSchema = require("../model/VideoSchema");
const dotenv = require("dotenv");
const { authenticate, authorize } = require("../middleware/Auth");
dotenv.config({ quiet: true });

route.post("/add_video", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const {link} = req.body;
    //  console.log(link)
    if (!link) {
      return res.send({
        mess: "error",
        status: 400,
        text: "Link Is Require",
      });
    }

    const data = await VideoSchema({
      link: link,
    });
    data.save().then(() => {
      res.send({
        mess: "success",
        status: 200,
        text: "Link Save Successfull",
      });
    });
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});



route.get("/get_video",  authenticate,
  authorize(["admin"]), async (req, res) => {
  try {
    const data = await VideoSchema.find({}).sort({_id:-1});

    if (data) {
      res.send({
        mess: "success",
        status: 200,
        text: "Fetch Successfull",
        data: data,
      });
    }
  } catch (error) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});

route.delete(
  "/delete_video/:id",
  authenticate,
  authorize(["admin"]),
  async (req, res) => {
    try {
      const id = req.params.id;

      const data = await VideoSchema.find({ _id: id });
      if (!data) {
        return res.send({
          mess: "error",
          status: 400,
          text: "Id is Invalid",
        });
      }

      const deleteid = await VideoSchema.findOneAndDelete(
        { _id: id },
        { _id: id }
      );
      if (deleteid) {
        res.send({
          mess: "success",
          status: 200,
          text: "Delete Successfull",
        });
      }
    } catch (error) {
      res.send({ mess: "error", status: 400, text: err.message });
    }
  }
);

module.exports=route
