const express = require("express");
const route = express.Router();
const GallerySchema = require("../model/ImageSchema");
const { authenticate, authorize } = require("../middleware/Auth");
const multer = require("multer");
const fs = require("fs");

const cloudinary = require("cloudinary").v2;

const dotenv = require("dotenv");
dotenv.config({ quiet: true });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use disk storage so Cloudinary can read temp file path
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "src/Image_Gallery"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

route.post(
  "/add_galleryimage",
  authenticate,
  authorize(["admin"]),
  upload.array("gallery_Image", 10),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.send({
          mess: "error",
          status: 400,
          text: "No Files Were Uploaded.",
        });
      }

      const uploaded = [];

      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "gallery",
        });

        uploaded.push({
          galleryImage: result.secure_url,
          publicId: result.public_id,
        });

        fs.unlinkSync(file.path); // Delete temp file
      }

      const saved = await GallerySchema.insertMany(uploaded);

      res.send({
        mess: "success",
        status: 200,
        text: "Images Uploaded Successfully",
        data: saved,
      });
    } catch (err) {
      console.error(err);
      res.send({
        mess: "error",
        status: 400,
        text: "Failed To Upload Images",
        error: err.message,
      });
    }
  }
);




route.get(
  "/get_galleryimage",
  authenticate,
  authorize(["admin"]),
  async (req, res) => {
    try {
      const data = await GallerySchema.find({}).sort({ _id: -1 });

      res.send({
        mess: "success",
        status: 200,
        text: "Fetch Successfull",
        data: data,
      });
    } catch (err) {
      res.send({ mess: "error", status: 400, text: err.message });
    }
  }
);



route.post("/bulk_delete",  authenticate, authorize(["admin"]), async (req, res) => {
  const { ids } = req.body;


  if (!Array.isArray(ids) || ids.length === 0) {
    return res.send({
      mess: "error",
      status: 400,
      text: "Invalid Or Empty IDs Array.",
    });
  }

  try {
    
    const images = await GallerySchema.find({ _id: { $in: ids } });

    
    const deletePromises = images.map((img) =>
      cloudinary.uploader.destroy(img.publicId)
    );
    await Promise.all(deletePromises);

   
    await GallerySchema.deleteMany({ _id: { $in: ids } });

    return res.send({
      mess: "success",
      status: 200,
      text: "Bulk Delete Successful.",
    });
  } catch (err) {
    console.error("Bulk Delete Error:", err);
    return res.send({
      mess: "error",
      status: 500,
      text: "Bulk Delete Failed.",
      error: err.message,
    });
  }
});

module.exports = route;
