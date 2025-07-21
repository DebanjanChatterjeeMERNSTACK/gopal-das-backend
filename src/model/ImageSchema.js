const mongoose=require("mongoose")

const GalleryImageSchema=new mongoose.Schema({

  galleryImage:{
    type:String,
    require:true
  },
  publicId:{
  type:String,
   require:true
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