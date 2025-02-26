# Image Processing System

A system to efficiently process image data from CSV files.

## Structure

- `/frontend`: React application for uploading CSV files and viewing results
- `/backend`: Node.js server for processing images and managing the database

## Setup Instructions

### Backend

1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `npm install`
3. Create a `.env` file with the following variables:
   - `PORT=5000`
   - `MONGODB_URI=mongodb://localhost:27017/image-processor`
   - `WEBHOOK_URL=http://localhost:5000/api/webhook-receiver` (optional)
4. Start the server: `npm start`

### Frontend

1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Start the development server: `npm start`
4. The application will be available at `http://localhost:3000`

## Features

- Upload CSV files with product information and image URLs
- Process and compress images asynchronously
- Track processing status with progress indicators
- View side-by-side comparisons of original and processed images
- Download output CSV with processed image URLs
- Webhook notifications when processing is complete
