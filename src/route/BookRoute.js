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
// Add Cloudinary
const cloudinary = require("cloudinary").v2;

// Only require pdf-poppler on supported platforms
let pdf;
if (os.platform() === 'win32' || os.platform() === 'darwin') {
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
  authenticate,
  authorize(["admin"]),
  upload.fields([
    { name: "book_image", maxCount: 1 },
    { name: "book_pdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { bookTitle, bookDescription } = req.body;
      const bookImage = req.files["book_image"][0];
      const bookPdf = req.files["book_pdf"][0].filename;

      if (!bookDescription || !bookImage || !bookTitle || !bookPdf) {
        return res.send({
          mess: "error",
          status: 400,
          text: "Please fill all fields.",
        });
      }

      // Upload image to Cloudinary
      const imageResult = await cloudinary.uploader.upload(bookImage.path, {
        folder: "books",
        chunk_size: 6000000,
      });

      // Delete local image file after upload
      fs.unlinkSync(bookImage.path);

      const BookImage = imageResult.secure_url;
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

      // Upload PDF images to Cloudinary and collect URLs
      const imageFiles = fs
        .readdirSync(outputDir)
        .filter((file) => file.endsWith(".jpg") || file.endsWith(".jpeg"));
      
      const bookPagesData = [];
      const bookPagesPublicIds = [];
      
      // Upload each image to Cloudinary
      for (const img of imageFiles) {
        const imagePath = path.join(outputDir, img);
        const result = await uploadToCloudinary(imagePath, `books/pages/${path.basename(bookPdf, path.extname(bookPdf))}`);
        bookPagesData.push({
          url: result.secure_url,
          publicId: result.public_id
        });
        bookPagesPublicIds.push(result.public_id);
        
        // Delete local image after upload
        fs.unlinkSync(imagePath);
      }

      // Extract just the URLs for backward compatibility
      const bookPages = bookPagesData.map(page => page.url);

      const data = await BookSchema({
        bookTitle,
        bookDescription,
        bookImage: BookImage,
        bookPdf: BookPdf,
        bookPages: bookPages,
        publicId: imageResult.public_id, // Cover image public ID
        pagesPublicIds: bookPagesPublicIds // Store all page image public IDs
      });

      await data.save();

      // Clean up the temporary directory
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }

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

      // ===== Handle book image update =====
      if (req.files?.book_image?.[0]) {
        // Delete old image from Cloudinary if exists
        if (existingBook.publicId) {
          await cloudinary.uploader.destroy(existingBook.publicId);
        }

        // Upload new image to Cloudinary
        const imageResult = await cloudinary.uploader.upload(req.files.book_image[0].path, {
          folder: "books",
          chunk_size: 6000000,
        });

        // Delete local image file after upload
        fs.unlinkSync(req.files.book_image[0].path);

        updateData.bookImage = imageResult.secure_url;
        updateData.publicId = imageResult.public_id;
      }

      // ===== Handle PDF update & re-conversion =====
      if (req.files?.book_pdf?.[0]) {
        const newPdf = req.files.book_pdf[0].filename;
        updateData.bookPdf = `${process.env.URL}/upload/${newPdf}`;

        const pdfPath = path.join("src/Book_Document", newPdf);
        const pdfFolderName = path.basename(newPdf, path.extname(newPdf));
        const outputDir = path.join("src/Book_Document/images", pdfFolderName);

        // Delete old PDF images from Cloudinary
        if (existingBook.pagesPublicIds && existingBook.pagesPublicIds.length > 0) {
          for (const publicId of existingBook.pagesPublicIds) {
            try {
              await cloudinary.uploader.destroy(publicId);
            } catch (err) {
              console.error("Error deleting image from Cloudinary:", err);
            }
          }
        }

        // Remove old image folder (if exists)
        const oldPdfFolderName = path.basename(existingBook.bookPdf || "", path.extname(existingBook.bookPdf || ""));
        const oldImageDir = path.join("src/Book_Document/images", oldPdfFolderName);
        if (fs.existsSync(oldImageDir)) {
          fs.rmSync(oldImageDir, { recursive: true, force: true });
        }

        // Reconvert new PDF to images
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

        // Upload PDF images to Cloudinary and collect URLs
        const imageFiles = fs
          .readdirSync(outputDir)
          .filter((file) => file.endsWith(".jpg") || file.endsWith(".jpeg"));
        
        const bookPagesData = [];
        const bookPagesPublicIds = [];
        
        // Upload each image to Cloudinary
        for (const img of imageFiles) {
          const imagePath = path.join(outputDir, img);
          const result = await uploadToCloudinary(imagePath, `books/pages/${pdfFolderName}`);
          bookPagesData.push({
            url: result.secure_url,
            publicId: result.public_id
          });
          bookPagesPublicIds.push(result.public_id);
          
          // Delete local image after upload
          fs.unlinkSync(imagePath);
        }

        // Extract just the URLs for backward compatibility
        updateData.bookPages = bookPagesData.map(page => page.url);
        updateData.pagesPublicIds = bookPagesPublicIds;

        // Clean up the temporary directory
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }

        // Mark old PDF file for deletion
        const oldPdfName = existingBook.bookPdf?.split("/").pop();
        if (oldPdfName && fs.existsSync(`src/Book_Document/${oldPdfName}`)) {
          fs.unlinkSync(`src/Book_Document/${oldPdfName}`);
        }
      }

      const updatedBook = await BookSchema.findByIdAndUpdate(id, updateData, {
        new: true,
      });

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

        // ==== Delete local converted PDF images folder if it exists ====
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
