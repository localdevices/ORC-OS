import React, { createContext, useState, useContext, useEffect } from 'react';

// Create the units context
const UnitsContext = createContext();

// Create a provider component
export const UnitsProvider = ({ children }) => {
  const [units, setUnits] = useState('metric'); // 'metric' or 'imperial'

  // Initialize units from localStorage on mount
  useEffect(() => {
    const savedUnits = localStorage.getItem('units');
    if (savedUnits && (savedUnits === 'metric' || savedUnits === 'imperial')) {
      setUnits(savedUnits);
    } else {
      // Default to metric
      localStorage.setItem('units', 'metric');
      setUnits('metric');
    }
  }, []);

  // Function to change units
  const changeUnits = (newUnits) => {
    if (newUnits === 'metric' || newUnits === 'imperial') {
      setUnits(newUnits);
      localStorage.setItem('units', newUnits);
    }
  };

  return (
    <UnitsContext.Provider value={{ units, changeUnits }}>
      {children}
    </UnitsContext.Provider>
  );
};

// Hook for context consumption
export const useUnits = () => useContext(UnitsContext);
