const express = require("express");
const route = express.Router();
const BlogSchema = require("../model/BlogSchema");
const dotenv = require("dotenv");
const { authenticate, authorize } = require("../middleware/Auth");
const multer = require("multer");
const fs = require("fs");
// const blogschema = require("../model/BlogSchema");
const cloudinary = require("cloudinary").v2;
dotenv.config({ quiet: true });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "src/Blog_Image"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage:storage });

route.post(
  "/add_blog",
  authenticate,
  authorize(["admin"]),
  upload.single("blog_Image"),
  async (req, res) => {
    try {
      const { blogTitle, blogDescription } = req.body;
      const blogImage = req.file;

      // console.log(req.body,req.file)

      // return

      const result = await cloudinary.uploader.upload(blogImage.path, {
        folder: "blogImage",
      });

      const data = await BlogSchema({
        blogTitle: blogTitle,
        blogDescription: blogDescription,
        blogImage: result.secure_url,
        publicId: result.public_id,
      });
      fs.unlinkSync(blogImage.path); // Delete temp file
      data.save().then(() => {
        res.send({
          mess: "success",
          status: 200,
          text: "Blog Uploaded Successfully",
          data: data,
        });
      });
    } catch (err) {
      console.error(err);
      res.send({
        mess: "error",
        status: 400,
        text: "Failed To Blog Upload",
        error: err.message,
      });
    }
  }
);

route.get("/get_blog", authenticate, authorize(["admin"]), async (req, res) => {
  try {
    const data = await BlogSchema.find({}).sort({ _id: -1 });

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



route.put(
  "/update_blog/:id",
  authenticate,
  authorize(["admin"]),
  upload.single("blog_Image"),
  async (req, res) => {
    try {
      const blogId = req.params.id;
      const { blogTitle, blogDescription } = req.body;

      const blog = await BlogSchema.findById(blogId);
      if (!blog) {
        return res.send({
          mess: "error",
          status: 404,
          text: "Blog Not Found",
        });
      }

      let updatedFields = {
        blogTitle,
        blogDescription,
      };

      // ✅ If new image uploaded
      if (req.file) {
        // Delete old image from Cloudinary
        if (blog.publicId) {
          await cloudinary.uploader.destroy(blog.publicId);
        }

        // Upload new image to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "blogImage",
        });

        updatedFields.blogImage = result.secure_url;
        updatedFields.publicId = result.public_id;

        // Delete temp file
        fs.unlinkSync(req.file.path);
      }

      // ✅ Update the blog in DB
      const updatedBlog = await BlogSchema.findByIdAndUpdate(
        blogId,
        updatedFields,
        { new: true }
      );

      return res.send({
        mess: "success",
        status: 200,
        text: "Blog Updated Successfully",
        data: updatedBlog,
      });
    } catch (err) {
      console.error(err);
      res.send({
        mess: "error",
        status: 400,
        text: "Failed To Update Blog",
        error: err.message,
      });
    }
  }
);


route.delete(
  "/delete_blog/:id",
  authenticate,
  authorize(["admin"]),
  async (req, res) => {
    const blogId = req.params.id;

    if (!blogId) {
      return res.send({
        mess: "error",
        status: 400,
        text: "Invalid Blog ID.",
      });
    }

    try {
      const blog = await BlogSchema.findById(blogId);

      if (!blog) {
        return res.send({
          mess: "error",
          status: 404,
          text: "Blog Not Found.",
        });
      }

      // Delete image from Cloudinary if exists
      if (blog.publicId) {
        await cloudinary.uploader.destroy(blog.publicId);
      }

      // Delete blog from database
      const deleted = await BlogSchema.findByIdAndDelete(blogId);

      return res.send({
        mess: "success",
        status: 200,
        text: "Blog Deleted Successfully.",
        data: deleted,
      });
    } catch (err) {
      console.error("Blog Delete Error:", err);
      return res.send({
        mess: "error",
        status: 500,
        text: "Blog Delete Failed.",
        error: err.message,
      });
    }
  }
);

module.exports = route;
