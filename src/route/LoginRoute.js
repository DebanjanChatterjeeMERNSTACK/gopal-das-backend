const express = require("express");
const route = express.Router();
const LoginSchema = require("../model/LoginSchema");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });
const jwt = require("jsonwebtoken");


route.post("/admin_login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.send({
        mess: "error",
        status: 400,
        text: "Please Send The Valid ID",
      });
    }

    const data = await LoginSchema.findOne({ email });

    if (!data) {
      return res.send({
        mess: "error",
        status: 400,
        text: "Invalid Details",
      });
    }

    const match = await bcrypt.compare(password, data.password);

    if (!match) {
      return res.send({
        mess: "error",
        status: 400,
        text: "Password Not Match",
      });
    }

    // Generate JWT
    jwt.sign(
      {name:data.name, id: data._id, role: data.role },
      process.env.JWTKEY,
      { expiresIn: "24h" },
      (err, token) => {
        if (err) {
          return res.send({
            mess: "error",
            status: 400,
            text: err.message,
          });
        }

        return res.send({
          mess: "success",
          status: 200,
          text: "Login Complete",
          token,
        });
      }
    );
  } catch (err) {
    return res.send({
      mess: "error",
      status: 400,
      text: err.message,
    });
  }
});

module.exports=route
