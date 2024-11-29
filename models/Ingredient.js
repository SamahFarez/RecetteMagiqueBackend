const mongoose = require('mongoose');

const IngredientSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ingredient_name: { type: String, required: true },
    is_available: { type: Boolean, default: true }
});

module.exports = mongoose.model('Ingredient', IngredientSchema);
