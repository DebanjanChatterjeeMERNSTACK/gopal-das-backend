const express = require("express");
const app = express();
const cors = require("cors");
require("./db/db");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });

const Login = require("./route/LoginRoute");
const Video = require("./route/VideoRoute");
const Contact = require("./route/ContactRoute");

const PORT = process.env.PORT;

const corsOptions = {
  origin: "*", // Allow only frontend
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"], // Allow custom headers
};
app.use(cors(corsOptions));

app.use(express.json());

app.use(Login);
app.use(Video);
app.use(Contact);

app.listen(PORT, () => {
  console.log(`Server Connact -${PORT}`);
});
