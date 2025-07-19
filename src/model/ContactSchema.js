const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
  fullName: {
    type: String,
  },
  email:{
    type:String,
    require:[true,"email is require"]
  }, 
  phoneNumber:{
    type:String,
    require:[true,"Phone Number is require"]
  },
  message:{
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
const contactschema = new mongoose.model("contact", ContactSchema)

module.exports =contactschema

