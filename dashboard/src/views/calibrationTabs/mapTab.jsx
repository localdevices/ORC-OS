import React, { useState } from "react";
import proj4 from 'proj4';
import epsg from 'epsg-index';
import epsgDB from '../../proj-db.json'; // Adjust the path as needed

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet"; // For leaflet's marker logic

// Ensure proj4 is set up to convert between CRS definitions
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

// Test: Get the definition of one of the EPSG codes added dynamically
console.log(proj4.defs['EPSG:4326']); // Output: "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs"

console.log(proj4.defs[epsgDB[28992]]); // Output: "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs"


const MapTab = ({epsgCode, widgets, selectedWidgetId, updateWidget}) => {
  const [mapLayers, setMapLayers] = useState("OSM"); // Map layer type
  const [controlPoints, setControlPoints] = useState([]); // Coordinate set
  const [coordinateForms, setCoordinateForms] = useState([]); // Track widgets

  // Define the default CRS as WGS84
  const defaultCrs = 'EPSG:4326';

// Get the Proj4 definition for the EPSG code
  const getProj4Def = (code) => {
    return epsgDB[code] || null;
  }
  // Convert coordinates using the Proj4 definition
  const transformCoordinates = (x, y, sourceCrs) => {
    let proj4Def = null;
    // if a EPSG code is provided, try to get the associated proj4 coordinate
    if (!sourceCrs.toString().startsWith("+proj")) {
      console.log("No proj4 string. converting...")
      try {
        // first, see if a particular projection code is available in database
        proj4Def = getProj4Def(sourceCrs);
        console.log(proj4Def);

        if (!proj4Def) {
          // try to get the proj4 from the defs directly
          try {
            proj4Def = proj4.defs[`EPSG:${sourceCrs.toString()}`]
            console.log(proj4Def);
          } catch (error) {
            console.error(`Projection ${sourceCode} not found in proj4 lib`)
          }
        }
      } catch (error) {
        console.error(`Projection ${sourceCode} not found in proj4 or EPSG database`);
        return null;
      }
    } else {
      proj4Def = sourceCrs;
    }
      // Dynamic transformation
    try {
      const converter = proj4(proj4Def, proj4.defs[defaultCrs]);
      return converter.forward([parseFloat(x), parseFloat(y)]);
     } catch (error) {
       console.error('Error during coordinate transformation:', error);
       return null;
     }
  };


  return (
    <div style={{ display: "flex", height: "100vh", width: "100%" }}>
      {/* Map container */}
        <MapContainer
          center={[0, 0]}
          zoom={3}
          style={{ height: "100vh", width: "100%" }}
        >
          {/* Tile layers */}
          {mapLayers === "OSM" && (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

            />
          )}
          {mapLayers === "Satellite" && (
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />
          )}

          {/* Render dynamically added markers */}
        {widgets.map((widget) => {
          const { x, y } = widget.coordinates;

          // Validate and convert coordinates
          if (!x || !y) return null; // Skip markers without valid coordinates
          const converted = transformCoordinates(x, y, epsgCode);
          if (!converted) return null; // invalid transformation
          const [convertedX, convertedY] = converted;

          return (
            <Marker key={widget.id} position={[convertedY, convertedX]}>
              <Popup>
                <p><strong>Point ID:</strong> {widget.id}</p>
                <p><strong>xy:</strong> ({x}, {y})</p>
              </Popup>
            </Marker>
          );
        })}

        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: 1000,
            background: "white",
            padding: "10px",
            borderRadius: "5px",
          }}
        >
          <label>
            <input
              type="radio"
              name="mapLayer"
              value="OSM"
              checked={mapLayers === "OSM"}
              onChange={() => setMapLayers("OSM")}
            />
            OpenStreetMap
          </label>
          <br />
          <label>
            <input
              type="radio"
              name="mapLayer"
              value="Satellite"
              checked={mapLayers === "Satellite"}
              onChange={() => setMapLayers("Satellite")}
            />
            Satellite
          </label>
        </div>

        </MapContainer>
      </div>
  );
};

export default MapTab;