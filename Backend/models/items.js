const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    marketName: {
        type: String,
        trim: true,
        default: ''
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    dosage: {
        type: String,
        trim: true,
        default: '' // Example: "250mg / 500mg"
    },
    dosageForm: {
        type: String,
        trim: true,
        default: '' // Example: "CAPSULES"
    },
    therapeuticClass: {
        type: String,
        trim: true,
        default: '' // Example: "Antibiotics"
    },
    description: {
        type: String,
        trim: true
    },
    // Array of string URLs / paths (Max 3 images)
    images: {
        type: [String],
        validate: [arrayLimit, '{PATH} exceeds the limit of 3']
    }
}, { timestamps: true });

// Custom validator to restrict maximum 3 images per item
function arrayLimit(val) {
    return val.length <= 3;
}

module.exports = mongoose.model('Item', itemSchema);