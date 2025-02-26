import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [file, setFile] = useState(null);
  const [requestId, setRequestId] = useState('');
  const [checkRequestId, setCheckRequestId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [processingData, setProcessingData] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
  };

  const handleUpload = async () => {
    try {
      if (!file) {
        setError('Please select a file');
        return;
      }

      const formData = new FormData();
      formData.append('csvFile', file);

      setStatus('Uploading...');
      
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setRequestId(response.data.requestId);
      setStatus('File uploaded successfully! Use the request ID to check status.');
      setCheckRequestId(response.data.requestId);
      setActiveTab('status');
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading file');
      setStatus('');
    }
  };

  const checkStatus = async () => {
    try {
      if (!checkRequestId) {
        setError('Please enter a request ID');
        return;
      }

      setError('');
      setStatus('Checking status...');
      
      const response = await axios.get(`${API_URL}/api/status/${checkRequestId}`);
      setProcessingData(response.data);
      setStatus(`Status: ${response.data.status}`);
      
      // If processing is complete, fetch results
      if (response.data.status === 'completed') {
        fetchResults(checkRequestId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error checking status');
      setStatus('');
    }
  };

  const fetchResults = async (id) => {
    try {
      const response = await axios.get(`${API_URL}/api/results/${id}`);
      setResults(response.data);
    } catch (err) {
      console.error('Error fetching results:', err);
    }
  };

  const downloadCSV = () => {
    if (results && results.outputCsvPath) {
      // Extract filename from path
      const filename = results.outputCsvPath.split('/').pop();
      window.open(`${API_URL}/processed/${filename}`, '_blank');
    }
  };

  // Poll for status updates if we have a request ID and processing is not complete
  useEffect(() => {
    let interval;
    
    if (checkRequestId && processingData && 
        (processingData.status === 'pending' || processingData.status === 'processing')) {
      interval = setInterval(() => {
        checkStatus();
      }, 5000); // Check every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checkRequestId, processingData]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Image Processing System</h1>
        
        <div className="tabs">
          <button 
            className={activeTab === 'upload' ? 'active' : ''} 
            onClick={() => setActiveTab('upload')}
          >
            Upload CSV
          </button>
          <button 
            className={activeTab === 'status' ? 'active' : ''} 
            onClick={() => setActiveTab('status')}
          >
            Check Status
          </button>
          <button 
            className={activeTab === 'results' ? 'active' : ''} 
            onClick={() => setActiveTab('results')}
            disabled={!results}
          >
            View Results
          </button>
        </div>
        
        {activeTab === 'upload' && (
          <div className="tab-content">
            <h2>Upload CSV File</h2>
            <div className="file-input-container">
              <input 
                type="file" 
                id="csv-file"
                accept=".csv"
                onChange={handleFileChange}
              />
              <label htmlFor="csv-file" className="file-label">
                {file ? file.name : 'Choose CSV File'}
              </label>
              <button className="upload-btn" onClick={handleUpload} disabled={!file}>
                Upload
              </button>
            </div>
            
            {requestId && (
              <div className="request-id-container">
                <h3>Your Request ID:</h3>
                <div className="request-id">{requestId}</div>
                <p>Save this ID to check the processing status later.</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'status' && (
          <div className="tab-content">
            <h2>Check Processing Status</h2>
            <div className="status-input">
              <input
                type="text"
                placeholder="Enter Request ID"
                value={checkRequestId}
                onChange={(e) => setCheckRequestId(e.target.value)}
              />
              <button onClick={checkStatus}>Check Status</button>
            </div>
            
            {processingData && (
              <div className="status-details">
                <h3>Processing Status: <span className={`status-${processingData.status}`}>{processingData.status}</span></h3>
                
                {processingData.status === 'processing' && (
                  <div className="progress-container">
                    <div className="progress-info">
                      <span>Processing: {processingData.processedImages} of {processingData.totalImages} images</span>
                      <span>{Math.round((processingData.processedImages / processingData.totalImages) * 100)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{width: `${(processingData.processedImages / processingData.totalImages) * 100}%`}}
                      ></div>
                    </div>
                  </div>
                )}
                
                {processingData.status === 'completed' && (
                  <div className="completed-info">
                    <p>All {processingData.totalImages} images have been processed!</p>
                    <button 
                      className="view-results-btn"
                      onClick={() => setActiveTab('results')}
                    >
                      View Results
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'results' && results && (
          <div className="tab-content results-tab">
            <h2>Processing Results</h2>
            <div className="results-actions">
              <button className="download-btn" onClick={downloadCSV}>
                Download Output CSV
              </button>
            </div>
            
            <div className="results-grid">
              {results.products && results.products.map((product, index) => (
                <div className="product-card" key={index}>
                  <h3>{product.productName}</h3>
                  <p>Serial Number: {product.serialNumber}</p>
                  
                  <div className="image-comparison">
                    {product.inputImageUrls.map((url, imgIndex) => (
                      <div className="image-pair" key={imgIndex}>
                        <div className="image-container">
                          <h4>Original</h4>
                          <img src={url} alt={`Original ${imgIndex}`} />
                        </div>
                        
                        <div className="image-container">
                          <h4>Processed</h4>
                          <img 
                            src={product.outputImageUrls[imgIndex]} 
                            alt={`Processed ${imgIndex}`} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {error && <div className="error-message">{error}</div>}
        {status && !error && <div className="status-message">{status}</div>}
      </header>
    </div>
  );
}

export default App;