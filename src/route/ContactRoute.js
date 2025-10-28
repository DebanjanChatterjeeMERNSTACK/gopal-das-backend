const express = require("express");
const route = express.Router();
const ContactSchema = require("../model/ContactSchema");
const dotenv = require("dotenv");
const { authenticate, authorize } = require("../middleware/Auth");
// const ContactSchema = require("../model/ContactSchema");
dotenv.config({ quiet: true });

route.post("/add_contact",async (req, res) => {
  try {
    const {fullName,phoneNumber,email,message} = req.body;
    //  console.log(link)
    if (!email) {
      return res.send({
        mess: "error",
        status: 400,
        text: "Email Is Require",
      });
    }

    const data = await ContactSchema({
      fullName:fullName,
      phoneNumber:phoneNumber,
      email:email,
      message:message
    });
    data.save().then(() => {
      res.send({
        mess: "success",
        status: 200,
        text: "Contact Details Send Successfull",
      });
    });
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});



route.get("/get_contact",  authenticate,
  authorize(["admin"]), async (req, res) => {
  try {
    const data = await ContactSchema.find({}).sort({_id:-1});

    if (data) {
      res.send({
        mess: "success",
        status: 200,
        text: "Fetch Successfull",
        data: data,
      });
    }
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});

route.delete(
  "/delete_contact/:id",
  authenticate,
  authorize(["admin"]),
  async (req, res) => {
    try {
      const id = req.params.id;

      const data = await ContactSchema.find({ _id: id });
      if (!data) {
        return res.send({
          mess: "error",
          status: 400,
          text: "Id is Invalid",
        });
      }

      const deleteid = await ContactSchema.findOneAndDelete(
        { _id: id },
        { _id: id }
      );
      if (deleteid) {
        res.send({
          mess: "success",
          status: 200,
          text: "Permanent Delete Successfull",
        });
      }
    } catch (err) {
      res.send({ mess: "error", status: 400, text: err.message });
    }
  }
);

module.exports=route
