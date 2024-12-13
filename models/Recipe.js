const mongoose = require('mongoose');

const RecipeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    cuisine_type: { type: String }
});

module.exports = mongoose.model('Recipe', RecipeSchema);
