const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema({
  blogTitle: {
    type: String,
  },
  blogImage:{
    type:String,
    require:true,
  }, 
  publicId:{
    type:String,
    require:true,
  },
  blogDescription:{
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
const blogschema = new mongoose.model("blog", BlogSchema)

module.exports =blogschema

