const express = require("express");
const route = express.Router();
const BookSchema = require("../model/BookSchema");
const { authenticate, authorize } = require("../middleware/Auth");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
dotenv.config({ quiet: true });

const storage = multer.diskStorage({
  destination: "src/Book_Document",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${uuidv4()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage: storage });

route.post(
  "/add_book",
 authenticate,
  authorize(["admin"]),
  upload.fields([
    { name: "book_image", maxCount: 1 },
    { name: "book_pdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { bookTiltle, bookDescription } = req.body;
      const bookImage = req.files["book_image"][0].filename;
      const bookPdf = req.files["book_pdf"][0].filename;

      if (!bookDescription || !bookImage || !bookTiltle || !bookPdf) {
        return res.send({
          mess: "error",
          status: 400,
          text: "Please Fill The All Filed",
        });
      }

      const BookImage = `${process.env.URL}/upload/${bookImage}`;
      const BookPdf = `${process.env.URL}/upload/${bookPdf}`;

      const data = await BookSchema({
        bookTiltle: bookTiltle,
        bookDescription: bookDescription,
        bookImage: BookImage,
        bookPdf: BookPdf,
      });
      data.save().then(() => {
        res.send({
          mess: "success",
          status: 200,
          text: "Book Details Save Successfully",
        });
      });
    } catch (err) {
      res.send({ mess: "error", status: 400, text: err.message });
    }
  }
);

route.get("/get_book", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const data = await BookSchema.find({}).sort({ _id: -1 });
    res.send({
      mess: "success",
      status: 200,
      text: "Fetch Successfull",
      data: data,
    });
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});

module.exports=route
