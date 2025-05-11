'use client';

import React from 'react';
import Sidebar from '../components/Sidebar';


const YoloDetection = () => {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 overflow-auto">
        <iframe 
          src="https://kylecsnow-blood-cell-object-detection.hf.space" 
          width="100%" 
          height="1000px" 
          style={{ 
            border: 'none', 
            borderRadius: '8px', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            maxWidth: '100%'
          }}
          allow="camera;microphone"
        ></iframe>
      </div>
    </div>
  );
};

export default YoloDetection;