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
const os = require("os");
const { execFile } = require("child_process");
// Add Cloudinary
const cloudinary = require("cloudinary").v2;

// Only require pdf-poppler on supported platforms
let pdf;
if (os.platform() === "win32" || os.platform() === "darwin") {
  pdf = require("pdf-poppler");
}

dotenv.config({ quiet: true });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use disk storage for temporary files
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
    const format = options.format || "jpeg";
    const outPrefix = options.out_prefix || "page";

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Build command arguments
    const args = [
      `-${format}`,
      "-scale-to",
      "1024",
      pdfPath,
      `${path.join(outputDir, outPrefix)}`,
    ];

    // Execute pdftocairo command
    execFile("pdftocairo", args, (error, stdout, stderr) => {
      if (error) {
        console.error("PDF conversion error:", error);
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
};

// Function to upload images to Cloudinary
const uploadToCloudinary = async (imagePath, folder) => {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: folder,
      resource_type: "image",
    });
    return result;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw error;
  }
};

route.post(
  "/add_book",
  upload.fields([
    { name: "book_image", maxCount: 1 },
    { name: "book_pdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { bookTitle, bookDescription, categoryName } = req.body;
      const bookImage = req.files["book_image"]?.[0];
      const bookPdfFile = req.files["book_pdf"]?.[0];

      if (
        !bookDescription ||
        !bookImage ||
        !bookTitle ||
        !bookPdfFile ||
        !categoryName
      ) {
        return res.send({
          mess: "error",
          status: 400,
          text: "Please fill all fields.",
        });
      }

      // Upload book cover image to Cloudinary
      const imageResult = await cloudinary.uploader.upload(bookImage.path, {
        folder: "books/covers",
        chunk_size: 6000000,
      });
      fs.unlinkSync(bookImage.path);

      // PDF local path
      const pdfPath = bookPdfFile.path;
      const pdfFileName = bookPdfFile.filename;
      // const BookPdf = `${process.env.URL}/upload/${pdfFileName}`;

      // (Optional) Upload raw PDF to Cloudinary (comment out if not needed)
      const pdfCloud = await cloudinary.uploader.upload(pdfPath, {
        folder: "books/pdf",
        resource_type: "raw",
      });
      console.log("pdfCloud upload result:", pdfCloud);
      const BookPdf = pdfCloud.secure_url;

      // fs.unlinkSync(pdfPath);

      // Convert PDF to images
      const outputDir = path.join(
        "src/Book_Document/images",
        path.basename(pdfFileName, path.extname(pdfFileName))
      );
      // Ensure the output directory exists
      fs.mkdirSync(outputDir, { recursive: true });

      const platform = os.platform();
      if (platform === "win32" || platform === "darwin") {
        await pdf.convert(pdfPath, {
          format: "jpeg",
          out_dir: outputDir,
          out_prefix: "page",
          page: null,
        });
      } else {
        await convertPdfToImagesLinux(pdfPath, outputDir, {
          format: "jpeg",
          out_prefix: "page",
        });
      }

      // Upload all pages to Cloudinary
      const imageFiles = fs
        .readdirSync(outputDir)
        .filter((f) => f.endsWith(".jpg") || f.endsWith(".jpeg"));
      const bookPagesData = [];
      const bookPagesPublicIds = [];

      for (const img of imageFiles) {
        const imagePath = path.join(outputDir, img);
        const result = await uploadToCloudinary(
          imagePath,
          `books/pages/${path.basename(pdfFileName, path.extname(pdfFileName))}`
        );
        bookPagesData.push({
          url: result.secure_url,
          publicId: result.public_id,
        });
        bookPagesPublicIds.push(result.public_id);
        fs.unlinkSync(imagePath);
      }
      fs.unlinkSync(pdfPath);
      const bookPages = bookPagesData.map((p) => p.url);

      const data = await BookSchema({
        bookTitle,
        bookDescription,
        categoryName,
        bookImage: imageResult.secure_url,
        bookPdf: BookPdf,
        pdf_publicId: pdfCloud.public_id,
        bookPages,
        publicId: imageResult.public_id,
        pagesPublicIds: bookPagesPublicIds,
      });

      await data.save();

      // Clean up folder
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }

      res.send({
        mess: "success",
        status: 200,
        text: "Book uploaded successfully",
        data,
      });
    } catch (err) {
      console.error(err);
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
      text: "Fetch Successfully",
      data: data,
    });
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});

route.put(
  "/update_book/:id",
  upload.fields([
    { name: "book_image", maxCount: 1 },
    { name: "book_pdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { bookTitle, bookDescription, categoryName } = req.body;

      const existingBook = await BookSchema.findById(id);
      if (!existingBook) {
        return res.status(404).send({
          mess: "error",
          status: 404,
          text: "Book not found",
        });
      }

      const updateData = { bookTitle, bookDescription, categoryName };

      // ====== Handle book image update ======
      if (req.files?.book_image?.[0]) {
        // Delete old image from Cloudinary
        if (existingBook.publicId) {
          await cloudinary.uploader.destroy(existingBook.publicId);
        }

        // Upload new image
        const imageResult = await cloudinary.uploader.upload(
          req.files.book_image[0].path,
          { folder: "books/covers" }
        );

        // Delete local temp image
        fs.unlinkSync(req.files.book_image[0].path);

        updateData.bookImage = imageResult.secure_url;
        updateData.publicId = imageResult.public_id;
      }

      // ====== Handle book PDF update ======
      if (req.files?.book_pdf?.[0]) {
        const pdfPath = req.files.book_pdf[0].path;
        const pdfFileName = req.files.book_pdf[0].filename;

        // Upload new PDF to Cloudinary
        const pdfCloud = await cloudinary.uploader.upload(pdfPath, {
          folder: "books/pdf",
          resource_type: "raw",
        });

        updateData.bookPdf = pdfCloud.secure_url;
        updateData.pdf_publicId = pdfCloud.public_id;

        // Convert uploaded PDF (local copy) to images before deleting it
        const outputDir = path.join(
          "src/Book_Document/images",
          path.basename(pdfFileName, path.extname(pdfFileName))
        );
        fs.mkdirSync(outputDir, { recursive: true });

        const platform = os.platform();
        if (platform === "win32" || platform === "darwin") {
          await pdf.convert(pdfPath, {
            format: "jpeg",
            out_dir: outputDir,
            out_prefix: "page",
            page: null,
          });
        } else {
          await convertPdfToImagesLinux(pdfPath, outputDir, {
            format: "jpeg",
            out_prefix: "page",
          });
        }

        // Upload generated images to Cloudinary
        const imageFiles = fs
          .readdirSync(outputDir)
          .filter((f) => f.endsWith(".jpg") || f.endsWith(".jpeg"));
        const bookPagesData = [];
        const bookPagesPublicIds = [];

        for (const img of imageFiles) {
          const imgPath = path.join(outputDir, img);
          const upload = await uploadToCloudinary(imgPath, `books/pages/${req.params.id}`);
          bookPagesData.push({ url: upload.secure_url });
          bookPagesPublicIds.push(upload.public_id);
          try { fs.unlinkSync(imgPath); } catch (e) { /* ignore */ }
        }

        // Remove local pdf and temp folder
        try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (e) { console.error(e); }
        try { if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true }); } catch (e) { console.error(e); }

        updateData.bookPages = bookPagesData.map((p) => p.url);
        updateData.pagesPublicIds = bookPagesPublicIds;

        // Delete old PDF from Cloudinary
        if (existingBook.pdf_publicId) {
          try {
            await cloudinary.uploader.destroy(existingBook.pdf_publicId, {
              resource_type: "raw",
            });
          } catch (err) {
            console.error("Error deleting old PDF:", err);
          }
        }

        // Delete old page images from Cloudinary
        if (existingBook.pagesPublicIds?.length) {
          for (const pid of existingBook.pagesPublicIds) {
            try {
              await cloudinary.uploader.destroy(pid);
            } catch (err) {
              console.error("Error deleting old page image:", err);
            }
          }
        }
      }

      // ====== Update Book in DB ======
      const updatedBook = await BookSchema.findByIdAndUpdate(id, updateData, {
        new: true,
      });

      res.status(200).send({
        mess: "success",
        status: 200,
        text: "Book updated successfully",
        data: updatedBook,
      });
    } catch (err) {
      console.error("❌ Error:", err);
      res.status(400).send({
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

      // ==== Delete book image from Cloudinary ====
      if (data.publicId) {
        try {
          await cloudinary.uploader.destroy(data.publicId);
        } catch (err) {
          console.error("Error deleting image from Cloudinary:", err);
        }
      }

      // ==== Delete PDF page images from Cloudinary ====
      if (data.pagesPublicIds && data.pagesPublicIds.length > 0) {
        for (const publicId of data.pagesPublicIds) {
          try {
            await cloudinary.uploader.destroy(publicId);
          } catch (err) {
            console.error("Error deleting page image from Cloudinary:", err);
          }
        }
      }


       if (data.pdf_publicId) {
        try {
          await cloudinary.uploader.destroy(data.pdf_publicId, { resource_type: "raw" });
        } catch (err) {
          console.error("Error deleting pdf from Cloudinary:", err);
        }
      }

      // ==== Delete book PDF ====
      // const bookPdfFile = data.bookPdf?.split("/").pop();
      // if (bookPdfFile) {
      //   try {
      //     if (fs.existsSync(`src/Book_Document/${bookPdfFile}`)) {
      //       fs.unlinkSync(`src/Book_Document/${bookPdfFile}`);
      //     } else {
      //       console.log(`PDF file not found: src/Book_Document/${bookPdfFile}`);
      //     }
      //   } catch (err) {
      //     console.error("Error deleting PDF:", err);
      //   }

      //   // ==== Delete local converted PDF images folder if it exists ====
      //   const pdfFolderName = path.basename(
      //     bookPdfFile,
      //     path.extname(bookPdfFile)
      //   );
      //   const imageFolder = path.join(
      //     "src/Book_Document/images",
      //     pdfFolderName
      //   );
      //   if (fs.existsSync(imageFolder)) {
      //     try {
      //       fs.rmSync(imageFolder, { recursive: true, force: true });
      //     } catch (err) {
      //       console.error("Error deleting image folder:", err);
      //     }
      //   }
      // }

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

route.get("/get_book/:cat", async (req, res) => {
  try {
    const data = await BookSchema.find({ categoryName: req.params.cat }).sort({
      _id: -1,
    });
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
