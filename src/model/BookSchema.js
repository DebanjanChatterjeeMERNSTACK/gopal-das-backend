const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema({
  bookTitle: {
    type: String,
  },
  bookImage:{
    type:String,
    require:true,
  }, 
   bookPdf:{
    type:String
  },
  bookDescription:{
    type:String
  },
  Date:{
    type:Date,
    default:Date.now()
  }
},
{
    timestamps:true
});
const bookschema = new mongoose.model("book", BookSchema)

module.exports =bookschema

