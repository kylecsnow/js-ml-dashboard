'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface ModelContextType {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export function ModelProvider({ children }: { children: ReactNode }) {
  const [selectedModel, setSelectedModel] = useState('');

  // Load the saved model from localStorage when the component mounts
  useEffect(() => {
    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  // Wrap setSelectedModel to save to localStorage
  const handleSetSelectedModel = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('selectedModel', model);
  };

  return (
    <ModelContext.Provider value={{ selectedModel, setSelectedModel: handleSetSelectedModel }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
} 
