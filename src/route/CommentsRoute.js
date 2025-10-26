const express = require("express");
const route = express.Router();
const CommentSchema = require("../model/CommentSchema");
const { authenticate, authorize } = require("../middleware/Auth");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });

route.post("/add_comment/:id", async (req, res) => {
  try {
    const { commentsName, commentsEmail, comments } = req.body;
    const bookId = req.params.id;

    //  console.log(link)
    if (!commentsName || !commentsEmail || !comments) {
      return res.send({
        mess: "error",
        status: 400,
        text: "Comment Is Require",
      });
    }

    const data = await CommentSchema({
      bookId: bookId,
      commentsName: commentsName,
      commentsEmail: commentsEmail,
      comments: comments,
    });
    data.save().then(() => {
      res.send({
        mess: "success",
        status: 200,
        text: "Comments Save Successfull",
      });
    });
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});

route.get("/get_comment/:id", async (req, res) => {
  try {
    const data = await CommentSchema.find({ bookId: req.params.id }).sort({
      _id: -1,
    });

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

route.get(
  "/get_all_comments",
  authenticate,
  authorize(["admin"]),
  async (req, res) => {
    try {
      const data = await CommentSchema.find({}).sort({ _id: -1 });

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
  }
);

route.delete(
  "/delete_comment/:id",
  authenticate,
  authorize(["admin"]),
  async (req, res) => {
    try {
      const id = req.params.id;

      const data = await CommentSchema.findOneAndDelete(
        { _id: id },
        { _id: id }
      );
      res.send({
        mess: "success",
        status: 200,
        text: "Comments Save Successfull",
        data,
      });
    } catch (err) {
      res.send({ mess: "error", status: 400, text: err.message });
    }
  }
);

route.post(
  "/add_reply/:id",
  authenticate,
  authorize(["admin"]),
  async (req, res) => {
    try {
      const { replyComment } = req.body;
      const { id } = req.params;

      if (!replyComment || !id) {
        return res.send({
          mess: "error",
          status: 400,
          text: "Reply Comment OR ID Is Missing",
        });
      }

      const comment = await CommentSchema.findById(id);
      if (!comment) {
        return res.send({
          mess: "error",
          status: 404,
          text: "Comment Not Found",
        });
      }

      comment.replyComment = replyComment;

      // If you expect multiple replies, use this instead:
      // comment.replyComment.push(replyComment);

      await comment.save();
      res.send({
        mess: "success",
        status: 200,
        text: "Reply Save Successfull",
      });
    } catch (err) {
      res.send({ mess: "error", status: 400, text: err.message });
    }
  }
);

module.exports = route;
