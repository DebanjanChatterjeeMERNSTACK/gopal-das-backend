const express = require("express");
const route = express.Router();
const BookSchema = require("../model/BookSchema");
const { authenticate, authorize } = require("../middleware/Auth");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
// Use platform detection to handle different operating systems
const os = require('os');
const { execFile } = require('child_process');

// Only require pdf-poppler on supported platforms
let pdf;
if (os.platform() === 'win32' || os.platform() === 'darwin') {
  pdf = require("pdf-poppler");
}

dotenv.config({ quiet: true });

const storage = multer.diskStorage({
  destination: "src/Book_Document",
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

// Function to convert PDF to images on Linux using pdftocairo
const convertPdfToImagesLinux = (pdfPath, outputDir, options) => {
  return new Promise((resolve, reject) => {
    const format = options.format || 'jpeg';
    const outPrefix = options.out_prefix || 'page';
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Build command arguments
    const args = [
      `-${format}`,
      '-scale-to', '1024',
      pdfPath,
      `${path.join(outputDir, outPrefix)}`
    ];
    
    // Execute pdftocairo command
    execFile('pdftocairo', args, (error, stdout, stderr) => {
      if (error) {
        console.error('PDF conversion error:', error);
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
};

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
      const { bookTitle, bookDescription } = req.body;
      const bookImage = req.files["book_image"][0].filename;
      const bookPdf = req.files["book_pdf"][0].filename;

      if (!bookDescription || !bookImage || !bookTitle || !bookPdf) {
        return res.send({
          mess: "error",
          status: 400,
          text: "Please fill all fields.",
        });
      }

      const BookImage = `${process.env.URL}/upload/${bookImage}`;
      const BookPdf = `${process.env.URL}/upload/${bookPdf}`;

      // Convert PDF to images
      const pdfPath = path.join("src/Book_Document", bookPdf);
      const outputDir = path.join(
        "src/Book_Document/images",
        path.basename(bookPdf, path.extname(bookPdf))
      );

      fs.mkdirSync(outputDir, { recursive: true });

      // Use appropriate conversion method based on platform
      const platform = os.platform();
      if (platform === 'win32' || platform === 'darwin') {
        // Use pdf-poppler for Windows and Mac
        await pdf.convert(pdfPath, {
          format: "jpeg",
          out_dir: outputDir,
          out_prefix: "page",
          page: null,
        });
      } else {
        // Use pdftocairo for Linux
        await convertPdfToImagesLinux(pdfPath, outputDir, {
          format: "jpeg",
          out_prefix: "page"
        });
      }

      const imageFiles = fs
        .readdirSync(outputDir)
        .filter((file) => file.endsWith(".jpg") || file.endsWith(".jpeg"))
        .map(
          (img) =>
            `${process.env.URL}/upload/images/${path.basename(
              bookPdf,
              path.extname(bookPdf)
            )}/${img}`
        );

      const data = await BookSchema({
        bookTitle,
        bookDescription,
        bookImage: BookImage,
        bookPdf: BookPdf,
        bookPages: imageFiles,
      });

      await data.save();

      res.send({
        mess: "success",
        status: 200,
        text: "Book uploaded and converted successfully",
        data,
      });
    } catch (err) {
      console.error(err);
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
}
);

route.put("/update_book/:id", authenticate, authorize(["admin"]),
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
          status: 404,
          text: "Book not found",
        });
      }

      const updateData = {
        bookTitle,
        bookDescription,
      };

      const filesToDelete = [];

      // ===== Handle book image update =====
      if (req.files?.book_image?.[0]) {
        const newImage = req.files.book_image[0].filename;
        updateData.bookImage = `${process.env.URL}/upload/${newImage}`;
        const oldImageName = existingBook.bookImage?.split("/").pop();
        filesToDelete.push(`src/Book_Document/${oldImageName}`);
      }

      // ===== Handle PDF update & re-conversion =====
      if (req.files?.book_pdf?.[0]) {
        const newPdf = req.files.book_pdf[0].filename;
        updateData.bookPdf = `${process.env.URL}/upload/${newPdf}`;

        const pdfPath = path.join("src/Book_Document", newPdf);
        const pdfFolderName = path.basename(newPdf, path.extname(newPdf));
        const outputDir = path.join("src/Book_Document/images", pdfFolderName);

        // Remove old image folder (if exists)
        const oldPdfFolderName = path.basename(existingBook.bookPdf || "", path.extname(existingBook.bookPdf || ""));
        const oldImageDir = path.join("src/Book_Document/images", oldPdfFolderName);
        if (fs.existsSync(oldImageDir)) {
          fs.rmSync(oldImageDir, { recursive: true, force: true });
        }

        // Reconvert new PDF to images
        fs.mkdirSync(outputDir, { recursive: true });

        await pdf.convert(pdfPath, {
          format: "jpeg",
          out_dir: outputDir,
          out_prefix: "page",
          page: null,
        });

        const newImages = fs
          .readdirSync(outputDir)
          .filter((file) => file.endsWith(".jpg") || file.endsWith(".jpeg"))
          .map((img) => `${process.env.URL}/upload/images/${pdfFolderName}/${img}`);

        updateData.bookPages = newImages;

        // Mark old PDF file for deletion
        const oldPdfName = existingBook.bookPdf?.split("/").pop();
        if (oldPdfName) filesToDelete.push(`src/Book_Document/${oldPdfName}`);
      }

      const updatedBook = await BookSchema.findByIdAndUpdate(id, updateData, {
        new: true,
      });

      // Delete old image and PDF files (not converted pages)
      for (const filePath of filesToDelete) {
        try {
          await fs.promises.unlink(filePath);
        } catch (err) {
          console.error("Failed to delete file:", filePath, err.message);
        }
      }

      res.send({
        mess: "success",
        status: 200,
        text: "Book updated successfully",
        data: updatedBook,
      });
    } catch (err) {
      console.error(err);
      res.send({
        mess: "error",
        status: 400,
        text: err.message,
      });
    }
  }
);

route.delete("/delete_book/:id", authenticate, authorize(["admin"]),
  async (req, res) => {
    const id = req.params.id;
    try {
      const data = await BookSchema.findByIdAndDelete(id);
      if (!data) {
        return res.status(404).send({
          mess: "error",
          status: 404,
          text: "Book not found",
        });
      }

      // ==== Delete book image ====
      const bookImageFile = data.bookImage?.split("/").pop();
      if (bookImageFile) {
        try {
          if (fs.existsSync(`src/Book_Document/${bookImageFile}`)) {
            fs.unlinkSync(`src/Book_Document/${bookImageFile}`);
          } else {
            console.log(`Image file not found: src/Book_Document/${bookImageFile}`);
          }
        } catch (err) {
          console.error("Error deleting image:", err);
        }
      }

      // ==== Delete book PDF ====
      const bookPdfFile = data.bookPdf?.split("/").pop();
      if (bookPdfFile) {
        try {
          if (fs.existsSync(`src/Book_Document/${bookPdfFile}`)) {
            fs.unlinkSync(`src/Book_Document/${bookPdfFile}`);
          } else {
            console.log(`PDF file not found: src/Book_Document/${bookPdfFile}`);
          }
        } catch (err) {
          console.error("Error deleting PDF:", err);
        }

        // ==== Delete converted PDF images folder ====
        const pdfFolderName = path.basename(bookPdfFile, path.extname(bookPdfFile));
        const imageFolder = path.join("src/Book_Document/images", pdfFolderName);
        if (fs.existsSync(imageFolder)) {
          try {
            fs.rmSync(imageFolder, { recursive: true, force: true });
          } catch (err) {
            console.error("Error deleting image folder:", err);
          }
        }
      }

      res.send({
        mess: "success",
        status: 200,
        text: "Book deleted successfully",
      });
    } catch (err) {
      console.error(err);
      res.status(500).send({
        mess: "error",
        status: 500,
        text: err.message,
      });
    }
  }
);





route.get("/get_all_book", async (req, res) => {
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

route.get("/get_id_book/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = await BookSchema.findOne({ _id: id });
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

route.get("/get_search_book", async (req, res) => {
  try {
    const search = req.query.s;
    const data = await BookSchema.find({
      $or: [
        { bookTitle: { $regex: search, $options: "i" } },
        { bookDescription: { $regex: search, $options: "i" } },
      ],
    }).sort({ _id: -1 });
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

module.exports = route;
