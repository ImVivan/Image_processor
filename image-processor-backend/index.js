require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse');
const axios = require('axios');
const sharp = require('sharp');


const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
const processedDir = path.join(__dirname, 'processed');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== 'text/csv' && 
        file.mimetype !== 'application/vnd.ms-excel' && 
        file.mimetype !== 'application/csv') {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  }
}).single('csvFile');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const requestSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  totalImages: { type: Number, default: 0 },
  processedImages: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
  csvPath: String,
  outputCsvPath: String,
  webhookTriggered: { type: Boolean, default: false }
});

const productSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
  serialNumber: Number,
  productName: String,
  inputImageUrls: [String],
  outputImageUrls: [String],
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  }
});

const Request = mongoose.model('Request', requestSchema);
const Product = mongoose.model('Product', productSchema);

app.post('/api/upload', (req, res) => {
  upload(req, res, async function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Multer error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const request = new Request({
        status: 'pending',
        csvPath: req.file.path
      });
      
      await request.save();

      processCSV(request._id, req.file.path);

      return res.status(200).json({ 
        message: 'File uploaded successfully', 
        requestId: request._id 
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({ message: 'Server error during upload' });
    }
  });
});

app.get('/api/status/:requestId', async (req, res) => {
  try {
    const request = await Request.findById(req.params.requestId);
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    return res.status(200).json({
      status: request.status,
      totalImages: request.totalImages,
      processedImages: request.processedImages,
      createdAt: request.createdAt,
      completedAt: request.completedAt,
      webhookTriggered: request.webhookTriggered
    });
  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({ message: 'Server error checking status' });
  }
});

app.get('/api/results/:requestId', async (req, res) => {
  try {
    const request = await Request.findById(req.params.requestId);
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'completed') {
      return res.status(400).json({ 
        message: 'Processing not yet complete',
        status: request.status
      });
    }

    const products = await Product.find({ requestId: req.params.requestId });
    
    return res.status(200).json({
      status: request.status,
      completedAt: request.completedAt,
      products: products,
      outputCsvPath: request.outputCsvPath,
      webhookTriggered: request.webhookTriggered
    });
  } catch (error) {
    console.error('Results fetch error:', error);
    return res.status(500).json({ message: 'Server error fetching results' });
  }
});

app.post('/api/webhook-receiver', (req, res) => {
  console.log('Webhook received:', req.body);
  
  fs.appendFileSync(
    path.join(__dirname, 'webhook-logs.txt'), 
    `${new Date().toISOString()} - Webhook received: ${JSON.stringify(req.body)}\n`
  );
  
  res.status(200).send('Webhook received successfully');
});

app.get('/api/webhook-logs', (req, res) => {
  try {
    const logPath = path.join(__dirname, 'webhook-logs.txt');
    
    if (fs.existsSync(logPath)) {
      const logs = fs.readFileSync(logPath, 'utf8');
      return res.status(200).json({ 
        logs: logs.split('\n').filter(line => line.trim() !== '')
      });
    } else {
      return res.status(200).json({ logs: [] });
    }
  } catch (error) {
    console.error('Error reading webhook logs:', error);
    return res.status(500).json({ message: 'Error reading webhook logs' });
  }
});

app.post('/api/test-webhook', async (req, res) => {
  try {
    if (!process.env.WEBHOOK_URL) {
      return res.status(400).json({ message: 'No webhook URL configured in .env file' });
    }
    
    console.log(`Testing webhook at: ${process.env.WEBHOOK_URL}`);
    
    const testData = {
      requestId: 'test-' + Date.now(),
      status: 'test',
      message: 'This is a test webhook notification',
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending webhook test data:', testData);
    
    const webhookResponse = await axios.post(process.env.WEBHOOK_URL, testData);
    
    console.log('Webhook test response:', webhookResponse.status, webhookResponse.statusText);
    
    return res.status(200).json({ 
      success: true, 
      webhookUrl: process.env.WEBHOOK_URL,
      responseStatus: webhookResponse.status,
      responseStatusText: webhookResponse.statusText
    });
  } catch (error) {
    console.error('Test webhook error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : 'No response'
    });
    
    return res.status(500).json({ 
      success: false, 
      webhookUrl: process.env.WEBHOOK_URL,
      error: error.message,
      errorCode: error.code,
      responseStatus: error.response?.status,
      responseStatusText: error.response?.statusText
    });
  }
});

async function processCSV(requestId, filePath) {
  const request = await Request.findById(requestId);
  request.status = 'processing';
  await request.save();

  try {
    const parser = fs.createReadStream(filePath).pipe(parse({
      columns: true,
      skip_empty_lines: true
    }));

    let totalImages = 0;
    let processedImages = 0;
    const products = [];

    for await (const record of parser) {
      const serialNumber = parseInt(record['S. No.']);
      const productName = record['Product Name'];
      const inputImageUrls = record['Input Image Urls'].split(',').map(url => url.trim());
      
      totalImages += inputImageUrls.length;
      
      const product = new Product({
        requestId,
        serialNumber,
        productName,
        inputImageUrls,
        status: 'pending'
      });
      
      await product.save();
      products.push(product);
    }

    request.totalImages = totalImages;
    await request.save();

    for (const product of products) {
      product.status = 'processing';
      await product.save();
      
      const outputImageUrls = [];
      
      for (const imageUrl of product.inputImageUrls) {
        try {
          const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(response.data);
          
          const processedImageBuffer = await sharp(imageBuffer)
            .jpeg({ quality: 50 })
            .toBuffer();
          
          const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
          const outputPath = path.join(processedDir, filename);
          
          await fs.promises.writeFile(outputPath, processedImageBuffer);

          const outputUrl = `${API_URL}/processed/${filename}`;
          outputImageUrls.push(outputUrl);
          
          processedImages++;
          request.processedImages = processedImages;
          await request.save();
        } catch (error) {
          console.error(`Error processing image ${imageUrl}:`, error);
        }
      }
      
      product.outputImageUrls = outputImageUrls;
      product.status = 'completed';
      await product.save();
    }

    const outputCsvPath = path.join(processedDir, `output-${requestId}.csv`);
    const csvHeader = 'S. No.,Product Name,Input Image Urls,Output Image Urls\n';
    let csvContent = csvHeader;
    
    for (const product of products) {
      csvContent += `${product.serialNumber},${product.productName},"${product.inputImageUrls.join(', ')}","${product.outputImageUrls.join(', ')}"\n`;
    }
    
    await fs.promises.writeFile(outputCsvPath, csvContent);
    
    request.status = 'completed';
    request.completedAt = new Date();
    request.outputCsvPath = outputCsvPath;
    await request.save();
    
    triggerWebhook(requestId, totalImages, processedImages);
    
  } catch (error) {
    console.error('CSV processing error:', error);
    request.status = 'failed';
    await request.save();
  }
}

async function triggerWebhook(requestId, totalImages, processedImages) {
  const webhookUrl = process.env.WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('No webhook URL configured. Skipping webhook notification.');
    return;
  }
  
  try {
    console.log(`Triggering webhook notification to ${webhookUrl}`);
    
    const request = await Request.findById(requestId);
    const products = await Product.find({ requestId });
    
    const payload = {
      requestId: requestId,
      status: request.status,
      totalImages: totalImages,
      processedImages: processedImages,
      completedAt: request.completedAt,
      products: products.map(product => ({
        serialNumber: product.serialNumber,
        productName: product.productName,
        inputImageCount: product.inputImageUrls.length,
        outputImageCount: product.outputImageUrls.length
      })),
      outputCsvUrl: `${REACT_APP_API_URL}/processed/${path.basename(request.outputCsvPath)}`    };
    
    const response = await axios.post(webhookUrl, payload);
    
    console.log(`Webhook notification sent successfully. Status: ${response.status}`);
    
    request.webhookTriggered = true;
    await request.save();
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId: requestId,
      webhookUrl: webhookUrl,
      payload: payload,
      response: {
        status: response.status,
        statusText: response.statusText
      }
    };
    
    fs.appendFileSync(
      path.join(__dirname, 'webhook-logs.txt'),
      `${JSON.stringify(logEntry)}\n`
    );
    
  } catch (error) {
    console.error('Webhook notification error:', error.message);
    
    if (error.response) {
      console.error('Webhook response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId: requestId,
      webhookUrl: webhookUrl,
      error: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : null
    };
    
    fs.appendFileSync(
      path.join(__dirname, 'webhook-logs.txt'),
      `${JSON.stringify(logEntry)}\n`
    );
  }
}

app.use('/processed', express.static(processedDir));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 