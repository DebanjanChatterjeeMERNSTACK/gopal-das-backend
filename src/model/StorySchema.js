const mongoose = require("mongoose");

const StorySchema = new mongoose.Schema({
  storyTitle: {
    type: String,
  },
  storyDescription:{
    type:String
  },
  fullName:{
    type:String
  },
  phone:{
    type:String
  },
  email:{
    type:String
  },
  Date:{
    type:Date,
    default:Date.now()
  },
  isPublished:{
    type:Boolean,
    default:false
  }
},
{
    timestamps:true
});
const storyschema = new mongoose.model("story", StorySchema)

module.exports =storyschema

