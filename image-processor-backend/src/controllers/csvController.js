const { parse } = require('csv-parse');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Request = require('../models/Request');
const Product = require('../models/Product');
const { processImages } = require('../services/imageProcessor');

exports.processCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const requestId = uuidv4();
    const request = new Request({ requestId });
    await request.save();

    processCSVFile(req.file.path, requestId);

    return res.status(200).json({ 
      requestId,
      message: 'File uploaded successfully. Use the requestId to check processing status.' 
    });
  } catch (error) {
    console.error('Error processing CSV:', error);
    return res.status(500).json({ message: 'Error processing CSV file' });
  }
};

async function processCSVFile(filePath, requestId) {
  const parser = fs.createReadStream(filePath).pipe(parse({
    columns: true,
    skip_empty_lines: true
  }));

  for await (const record of parser) {
    const product = new Product({
      serialNumber: record['S. No.'],
      productName: record['Product Name'],
      inputImageUrls: record['Input Image Urls'].split(',').map(url => url.trim())
    });
    
    await product.save();
    
    await Request.findOneAndUpdate(
      { requestId },
      { $push: { products: product._id } }
    );

    processImages(product._id, requestId);
  }

  fs.unlink(filePath, err => {
    if (err) console.error('Error deleting file:', err);
  });
} 