const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  serialNumber: {
    type: Number,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  inputImageUrls: [{
    type: String,
    required: true
  }],
  outputImageUrls: [{
    type: String,
    default: []
  }],
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  }
});

module.exports = mongoose.model('Product', productSchema); 