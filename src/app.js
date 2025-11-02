const express = require("express");
const app = express();
const cors = require("cors");
require("./db/db");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
dotenv.config({ quiet: true });

// Create necessary directories if they don't exist
const directories = [
  "src/Image_Gallery",
  "src/Blog_Image",
  "src/Book_Document",
  "src/Book_Document/images"
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

const Login = require("./route/LoginRoute");
const Video = require("./route/VideoRoute");
const Contact = require("./route/ContactRoute");
const Image=require("./route/ImageRoute");
const Blog=require("./route/BlogRoute");
const Story=require("./route/StoryRoute")
const Book=require("./route/BookRoute");
const Category=require("./route/CategoryRoute");
const Comments=require("./route/CommentsRoute");

const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: "*", // Allow only frontend
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"], // Allow custom headers
};
app.use(cors(corsOptions));

app.use(express.json());

app.use("/upload",express.static("src/Image_Gallery"));
app.use("/upload",express.static("src/Blog_Image"));
app.use("/upload",express.static("src/Book_Document"));


app.use(Login);
app.use(Video);
app.use(Contact);
app.use(Image);
app.use(Blog);
app.use(Story)
app.use(Book);
app.use(Category)
app.use(Comments)

app.listen(PORT, () => {
  console.log(`Server Connected on port ${PORT}`);
});
