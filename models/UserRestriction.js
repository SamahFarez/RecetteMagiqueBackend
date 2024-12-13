const mongoose = require("mongoose");

const userRestrictionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  restrictionName: { type: String, required: true }
}, { collection: 'UserRestrictions' }); // Specify the collection name

module.exports = mongoose.model("UserRestrictions", userRestrictionSchema);
