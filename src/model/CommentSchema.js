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
    replyComment:{
       type: String,
       default:null
    }
  },
  {
    timestamps: true,
  }
);
const commentschema = new mongoose.model("comment", commentSchema);

module.exports = commentschema;
