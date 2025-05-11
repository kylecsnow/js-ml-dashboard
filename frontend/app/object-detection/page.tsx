'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Client } from '@gradio/client';
// import './YoloDetection.css';

const YoloDetection = () => {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [detectionDetails, setDetectionDetails] = useState([]);
  const [error, setError] = useState<string | null>(null);
  const gradioClient = useRef<any>(null);
  
  // Initialize the Gradio client connecting to your HF Space
  useEffect(() => {
    const initClient = async () => {
      try {
        // Replace with your actual Hugging Face Space URL
        gradioClient.current = await Client.connect("kylecsnow/blood-cell-object-detection");
        console.log("Connected to Hugging Face Space");
      } catch (err) {
        console.error("Error connecting to Hugging Face Space:", err);
        setError("Failed to connect to the detection service");
      }
    };
    
    initClient();
    
    // Cleanup
    return () => {
      // Any cleanup if needed
    };
  }, []);

  // Handle file selection
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImageUrl(URL.createObjectURL(file));
      setResults(null);
      setDetectionDetails([]);
    }
  };

  // Process the image with the YOLOv8 model on HF Space
  const processImage = async () => {
    if (!image || !gradioClient.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Call the Gradio API endpoint
      // Note: The endpoint name might be different depending on your Gradio app setup
      const result = await gradioClient.current.predict("/predict", [
        image, // Pass the image file directly
      ]);
      
      // Handle results
      if (result.data && result.data.length >= 2) {
        // The first output is the annotated image
        setResults(result.data[0]);
        
        // The second output is the detection details JSON
        setDetectionDetails(result.data[1]);
      }
    } catch (err) {
      console.error("Error processing image:", err);
      setError("Failed to process the image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Rest of the component (UI rendering) stays the same as in the previous example
  return (
    <div className="yolo-detection-container">
      <h1>YOLOv8 Object Detection</h1>
      
      <div className="upload-section">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="file-input"
        />
        
        {imageUrl && (
          <div className="preview-container">
            <h3>Image Preview</h3>
            <img src={imageUrl} alt="Preview" className="image-preview" />
            <button 
              onClick={processImage} 
              disabled={isLoading || !image}
              className="process-button"
            >
              {isLoading ? "Processing..." : "Detect Objects"}
            </button>
          </div>
        )}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {results && (
        <div className="results-container">
          <div className="detected-image">
            <h3>Detection Results</h3>
            <img src={results} alt="Detection Results" className="result-image" />
          </div>
          
          <div className="detection-details">
            <h3>Object Details</h3>
            {detectionDetails.length > 0 ? (
              <ul className="details-list">
                {detectionDetails.map((item, index) => (
                  <li key={index} className="detection-item">
                    <strong>{item.class}</strong> (Confidence: {(item.confidence * 100).toFixed(1)}%)
                    <div className="coords">
                      Coordinates: [{item.bbox.map(coord => coord.toFixed(1)).join(', ')}]
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No objects detected</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default YoloDetection;