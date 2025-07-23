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

route.post( "/add_book", authenticate, authorize(["admin"]),
  upload.fields([
    { name: "book_image", maxCount: 1 },
    { name: "book_pdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { bookTitle, bookDescription } = req.body;
      const bookImage = req.files["book_image"][0].filename;
      const bookPdf = req.files["book_pdf"][0].filename;

      if (!bookDescription || !bookImage || !bookTitle || !bookPdf) {
        return res.send({
          mess: "error",
          status: 400,
          text: "Please Fill The All Filed",
        });
      }

      const BookImage = `${process.env.URL}/upload/${bookImage}`;
      const BookPdf = `${process.env.URL}/upload/${bookPdf}`;

      const data = await BookSchema({
        bookTitle: bookTitle,
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

route.get("/get_book", authenticate, authorize(["admin"]),
 async (req, res) => {
  try {
    const data = await BookSchema.find({}).sort({ _id: -1 });
    res.send({
      mess: "success",
      status: 200,
      text: "Fetch Successfully",
      data: data,
    });
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});

// UPDATE BOOK API
route.put("/update_book/:id",authenticate,authorize(["admin"]),
  upload.fields([
    { name: "book_image", maxCount: 1 },
    { name: "book_pdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { bookTitle, bookDescription } = req.body;

      const existingBook = await BookSchema.findById(id);
      if (!existingBook) {
        return res.status(404).send({
          mess: "error",
          status: 400,
          text: "Book Not Found",
        });
      }

      // Handle image update
      const updateData = {
        bookTitle,
        bookDescription,
      };

      // Handle file updates
      const filesToDelete = [];
      
      if (req.files?.book_image?.[0]) {
        const newImage = req.files.book_image[0].filename;
        updateData.bookImage = `${process.env.URL}/upload/${newImage}`;
        filesToDelete.push(existingBook.bookImage);
      }

      if (req.files?.book_pdf?.[0]) {
        const newPdf = req.files.book_pdf[0].filename;
        updateData.bookPdf = `${process.env.URL}/upload/${newPdf}`;
        filesToDelete.push(existingBook.bookPdf);
      }

      // Update book in database
      const updatedBook = await BookSchema.findByIdAndUpdate(
        id,
        updateData,
        {new:true}
    );

      // Delete old files after successful update
      if (filesToDelete.length > 0) {
        await Promise.all(
          filesToDelete.map(fileUrl => {
            if (!fileUrl) return;
            const fileName = fileUrl.split('/').pop();
            return fs.promises.unlink(`src/Book_Document/${fileName}`)
              .catch(err => console.error(`Error deleting file ${fileName}:`, err));
          })
        );
      }


       res.send({
        message: "Book Updated Successfully",
        status: 200,
        data: updatedBook,
      });
    } catch (err) {
      res.send({
        mess: "error",
        status: 400,
        text: err.message,
      });
    }
  }
);

route.delete("/delete_book/:id",  authenticate,authorize(["admin"]), 
async (req, res) => {
  const id = req.params.id;
  try {
    const data = await BookSchema.fineOneAndDelete({ _id: id }, { _id: id });
    const book_image = data.bookImage.split("/");
    fs.unlink(`src/Book_Document/${book_image[4]}`, (err) => {
      if (err) console.error("Error deleting image:", err);
    });

    const book_pdf = data.bookPdf.split("/");
    fs.unlink(`src/Book_Document/${book_pdf[4]}`, (err) => {
      if (err) console.error("Error deleting pdf:", err);
    });
    res.send({
      mess: "success",
      status: 200,
      text: "Book Details Delete Successfully",
    });
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});

module.exports = route;
