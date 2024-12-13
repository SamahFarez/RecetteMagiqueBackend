const mongoose = require("mongoose");

const RestrictionsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  restrictedIngredients: {
    type: [String],
    default: [],
  },
});

module.exports = mongoose.model("Restrictions", RestrictionsSchema);
