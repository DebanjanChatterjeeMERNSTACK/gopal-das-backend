const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    bookId: {
      type: String,
      require: true,
    },
    commentsName: {
      type: String,
      require: true,
    },
    commentsEmail: {
      type: String,
      require: true,
    },
    comments: {
      type: String,
      require: true,
    },
  },
  {
    timestamps: true,
  }
);
const commentschema = new mongoose.model("comment", commentSchema);

module.exports = commentschema;
