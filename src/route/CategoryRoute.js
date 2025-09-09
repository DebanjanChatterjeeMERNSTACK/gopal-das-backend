const express = require("express");
const route = express.Router();
const CategorySchema = require("../model/CategorySchema");
const dotenv = require("dotenv");
const { authenticate, authorize } = require("../middleware/Auth");
// const ContactSchema = require("../model/ContactSchema");
dotenv.config({ quiet: true });

route.post("/add_category",authenticate,
  authorize(["admin"]),async (req, res) => {
  try {
    const categoryTitle = req.body;
    //  console.log(link)
    if (!categoryTitle) {
      return res.send({
        mess: "error",
        status: 400,
        text: "Category Title Is Require",
      });
    }

    const data = await CategorySchema({
      categoryTitle:categoryTitle
    });
    data.save().then(() => {
      res.send({
        mess: "success",
        status: 200,
        text: "Category Save Successfull",
      });
    });
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});

route.put("/update_category/:id",authenticate,
  authorize(["admin"]),async (req, res) => {
  try {
    const {id}=req.params
    const {categoryTitle} = req.body;
    //  console.log(link)
    if (!categoryTitle) {
      return res.send({
        mess: "error",
        status: 400,
        text: "Category Title Is Require",
      });
    }

    const data = await CategorySchema.findOneAndUpdate({_id:id},{
      categoryTitle:categoryTitle
    });
      res.send({
        mess: "success",
        status: 200,
        text: "Category Update Successfull",
      });
  } catch (err) {
    res.send({ mess: "error", status: 400, text: err.message });
  }
});


module.exports=route