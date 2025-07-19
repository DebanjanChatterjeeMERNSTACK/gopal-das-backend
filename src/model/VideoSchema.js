const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({
  link: {
    type: String,
  },
  Date:{
    type:Date,
    default:Date.now()
  }
},
{
    timestamps:true
});
const videoschema = new mongoose.model("video", VideoSchema)

module.exports =videoschema

