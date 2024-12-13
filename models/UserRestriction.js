const mongoose = require("mongoose");

const userRestrictionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  restrictionName: { type: String, required: true },
});

module.exports = mongoose.model("UserRestriction", userRestrictionSchema);
