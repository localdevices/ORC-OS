/**
 * Unit conversion utilities for metric and imperial systems
 * This functionality was written through copilot
 */

// Conversion factors
export const CONVERSIONS = {
  waterLevel: 3.28084,      // m to ft
  discharge: 35.3147,       // m³/s to ft³/s
  velocity: 3.28084,        // m/s to ft/s
  surface: 10.7639,          // m² to ft²
};

/**
 * Convert water level from metric to imperial units
 * @param {number} valueInMeters - Water level in meters
 * @param {string} units - 'metric' or 'imperial'
 * @returns {number} Converted value
 */
export const convertWaterLevel = (valueInMeters, units) => {
  if (!valueInMeters || valueInMeters === null) return valueInMeters;
  if (units === 'imperial') {
    return valueInMeters * CONVERSIONS.waterLevel;
  }
  return valueInMeters;
};

/**
 * Convert discharge from metric to imperial units
 * @param {number} valueInCubicMetersPerSecond - Discharge in m³/s
 * @param {string} units - 'metric' or 'imperial'
 * @returns {number} Converted value
 */
export const convertDischarge = (valueInCubicMetersPerSecond, units) => {
  if (!valueInCubicMetersPerSecond || valueInCubicMetersPerSecond === null) return valueInCubicMetersPerSecond;
  if (units === 'imperial') {
    return valueInCubicMetersPerSecond * CONVERSIONS.discharge;
  }
  return valueInCubicMetersPerSecond;
};

/**
 * Convert velocity from metric to imperial units
 * @param {number} valueInMetersPerSecond - Velocity in m/s
 * @param {string} units - 'metric' or 'imperial'
 * @returns {number} Converted value
 */
export const convertVelocity = (valueInMetersPerSecond, units) => {
  if (!valueInMetersPerSecond || valueInMetersPerSecond === null) return valueInMetersPerSecond;
  if (units === 'imperial') {
    return valueInMetersPerSecond * CONVERSIONS.velocity;
  }
  return valueInMetersPerSecond;
};

/**
 * Convert surface areafrom metric to imperial units
 * @param {number} valueInSquareMeters - Surface area in m²
 * @param {string} units - 'metric' or 'imperial'
 * @returns {number} Converted value
 */
export const convertSurface = (valueInSquareMeters, units) => {
  if (!valueInSquareMeters || valueInSquareMeters === null) return valueInSquareMeters;
  if (units === 'imperial') {
    return valueInSquareMeters * CONVERSIONS.surface;
  }
  return valueInSquareMeters;
};


/**
 * Get the unit label for water level
 * @param {string} units - 'metric' or 'imperial'
 * @returns {string} Unit label
 */
export const getWaterLevelUnit = (units) => {
  return units === 'imperial' ? 'ft' : 'm';
};

/**
 * Get the unit label for discharge
 * @param {string} units - 'metric' or 'imperial'
 * @returns {string} Unit label
 */
export const getDischargeUnit = (units) => {
  return units === 'imperial' ? 'ft³/s' : 'm³/s';
};


/**
 * Get the unit label for surface
 * @param {string} units - 'metric' or 'imperial'
 * @returns {string} Unit label
 */
export const getSurfaceUnit = (units) => {
  return units === 'imperial' ? 'ft²' : 'm²';
};

/**
 * Get the unit label for velocity
 * @param {string} units - 'metric' or 'imperial'
 * @returns {string} Unit label
 */
export const getVelocityUnit = (units) => {
  return units === 'imperial' ? 'ft/s' : 'm/s';
};

/**
 * Convert water level from imperial back to metric units
 * @param {number} valueInFeet - Water level in feet
 * @returns {number} Value in meters
 */
export const convertWaterLevelToMetric = (valueInFeet) => {
  if (!valueInFeet || valueInFeet === null) return valueInFeet;
  return valueInFeet / CONVERSIONS.waterLevel;
};

/**
 * Convert discharge from imperial back to metric units
 * @param {number} valueInCubicFeetPerSecond - Discharge in ft³/s
 * @returns {number} Value in m³/s
 */
export const convertDischargeToMetric = (valueInCubicFeetPerSecond) => {
  if (!valueInCubicFeetPerSecond || valueInCubicFeetPerSecond === null) return valueInCubicFeetPerSecond;
  return valueInCubicFeetPerSecond / CONVERSIONS.discharge;
};
