const mongoose=require("mongoose")

const GalleryImageSchema=new mongoose.Schema({

  galleryImage:{
    type:String
  },
  publicId:{
  type:String
  }, 
  Date:{
     type:Date,
    default:Date.now()
  }

},{
    timestamps:true
})

const galleryImage=new mongoose.model("imageGallery",GalleryImageSchema)

module.exports=galleryImage