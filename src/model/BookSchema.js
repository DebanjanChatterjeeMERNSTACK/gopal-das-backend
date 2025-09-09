const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema(
  {
    bookTitle: {
      type: String,
    },
    bookImage: {
      type: String,
      require: true,
    },
    bookPdf: {
      type: String,
    },
    categoryName: {
      type: String,
      required: false,
    },
    publicId: {
      type: String,
      required: false,
    },
    pagesPublicIds: {
      type: [String],
      default: [],
    },
    bookDescription: {
      type: String,
    },
    bookPages: [String],
    Date: {
      type: Date,
      default: Date.now(),
    },
  },
  {
    timestamps: true,
  }
);
const bookschema = new mongoose.model("book", BookSchema);

module.exports = bookschema;
