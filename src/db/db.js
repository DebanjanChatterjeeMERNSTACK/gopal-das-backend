const mongoose= require("mongoose")

const dotenv =require("dotenv")
dotenv.config({ quiet: true })

mongoose.connect(process.env.DB_URL)
.then(()=>{
    console.log("Database Connected")
}).catch((err)=>{
console.log(err)
})
