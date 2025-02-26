const sharp = require('sharp');
const axios = require('axios');
const Product = require('../models/Product');
const Request = require('../models/Request');

exports.processImages = async (productId, requestId) => {
  try {
    const product = await Product.findById(productId);
    if (!product) return;

    product.status = 'processing';
    await product.save();

    const outputUrls = [];
    
    for (const imageUrl of product.inputImageUrls) {
      try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        
        const processedBuffer = await sharp(response.data)
          .jpeg({ quality: 50 })
          .toBuffer();

        const outputUrl = `https://processed-image-url/${Date.now()}.jpg`;
        outputUrls.push(outputUrl);
      } catch (error) {
        console.error(`Error processing image ${imageUrl}:`, error);
      }
    }

    product.outputImageUrls = outputUrls;
    product.status = 'completed';
    await product.save();

    const request = await Request.findOne({ requestId }).populate('products');
    const allCompleted = request.products.every(p => 
      p.status === 'completed' || p.status === 'failed'
    );

    if (allCompleted) {
      request.status = 'completed';
      await request.save();
    }
  } catch (error) {
    console.error('Error in image processing:', error);
    await Product.findByIdAndUpdate(productId, { status: 'failed' });
  }
}; 