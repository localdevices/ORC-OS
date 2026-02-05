// Utility function to safely parse JSON
export const safelyParseJSON = (jsonString) => {
  try {
    return JSON.parse(jsonString); // Parse if valid JSON string
  } catch (error) {
    console.warn("Invalid JSON string:", error);
    return jsonString; // Fallback: Leave it as the original string
  }
};

// Simple debounce utility returning a stable debounced function
export const createDebounce = (callback, delay) => {
  let timeout;
  const debounced = (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
  // return a cancel function to clear the timeout
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
};

// make some colors
export const rainbowColors = Array.from({length: 10}, (_, i) => {
  const hue = (i / 10) * 360; // Distributes hues evenly across 360 degrees
  return `hsl(${hue}, 100%, 50%)`;
});

// Function to style log lines based on severity
export const getLogLineStyle = (line) => {
  if (line.includes("ERROR")) {
    return { color: "red", fontWeight: "bold" };
  } else if (line.includes("WARNING")) {
    return { color: "orange", fontWeight: "bold" };
  } else if (line.includes("INFO")) {
    return { color: "black" };
  } else if (line.includes("DEBUG")) {
    return { color: "steelblue" };
  }
  return {}; // Default style
};


export const areArraysEqual = (arr1, arr2) => {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;

  return arr1.every((item1, index) => {
    const item2 = arr2[index];
    if (Array.isArray(item1) && Array.isArray(item2)) {
      // Recursively compare nested arrays
      return areArraysEqual(item1, item2);
    }
    return item1 === item2;
  });
};

export const areControlPointsEqual = (arr1, arr2) => {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;

  return arr1.every((obj1, index) => {
    const obj2 = arr2[index];
    // Ensure both are dictionaries and compare individual keys
    return obj1.x === obj2.x &&
      obj1.y === obj2.y &&
      obj1.z === obj2.z &&
      obj1.row === obj2.row &&
      obj1.col === obj2.col;
  });
};


// Helper: parse numbers but keep 0 as a valid value
export const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
};
