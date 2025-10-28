const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
     bookId: {
      type: mongoose.Schema.Types.ObjectId, // Use ObjectId instead of String
      ref: "book", // Must match the name of your Book model
      required: true,
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
