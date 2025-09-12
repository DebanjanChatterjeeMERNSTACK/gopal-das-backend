const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  categoryTitle: {
    type: String,
    require:true
  },
},
{
    timestamps:true
});
const categoryschema = new mongoose.model("category", categorySchema)

module.exports =categoryschema

