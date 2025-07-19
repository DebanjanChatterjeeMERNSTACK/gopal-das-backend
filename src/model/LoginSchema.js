const mongoose = require("mongoose");

const LoginSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email:{
    type:String,
    require:[true,"email is require"]
  }, 
  password:{
    type:String,
    require:[true,"password is require"]
  },
  role:{
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
const loginschema = new mongoose.model("login", LoginSchema)

module.exports =loginschema

