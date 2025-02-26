const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const { processCSV } = require('./controllers/csvController');
const { getStatus } = require('./controllers/statusController');

require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });


app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));


app.post('/api/upload', upload.single('csv'), processCSV);
app.get('/api/status/:requestId', getStatus);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 