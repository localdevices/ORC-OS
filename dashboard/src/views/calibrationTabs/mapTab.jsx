import { useState, useRef, useEffect } from "react";
import proj4 from 'proj4';
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from 'leaflet';

import "leaflet/dist/leaflet.css";
import epsgDB from '../../proj-db.json'; // Adjust the path as needed


// Ensure proj4 is set up to convert between CRS definitions
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

// Test: Get the definition of one of the EPSG codes added dynamically
// console.log(proj4.defs['EPSG:4326']); // Output: "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs"
// console.log(proj4.defs[epsgDB[28992]]); // Output: "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs"

import PropTypes from "prop-types";

const MapTab = ({epsgCode, widgets, mapIsVisible}) => {
  const [mapLayers, setMapLayers] = useState("OSM"); // Map layer type
  const mapRef = useRef(null);
  // Define the default CRS as WGS84
  const defaultCrs = 'EPSG:4326';
  // zoom te fit bounds of control controlPoints
  const zoomToFit = () => {
    const map = mapRef.current; // Get the map instance
    if (!map) return;

    // Create LatLng bounds using Leaflet
    const bounds = L.latLngBounds([]);
    widgets.forEach((widget) => {
      const { x, y } = widget.coordinates;
      if (!x || !y) return; // Skip invalid coordinates

      const converted = transformCoordinates(x, y, epsgCode); // Transform coordinates
      if (converted) {
        const [convertedX, convertedY] = converted;
        bounds.extend([convertedY, convertedX]); // Add point to bounds
      }
    });

    // If bounds are valid, fit the map to them
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] }); // Add optional padding
    }
  };

  useEffect(() => {
    if (mapIsVisible) {
      // due to async issues, we are forced to use a timeout
      const timer = setTimeout(() => {
      const map = mapRef.current;
      if (map) {
        map.whenReady(() => zoomToFit()); // Adjust map when widgets change
      }
    }, 100);
  return () => {
    clearTimeout(timer);
  }
  }
  }, [mapIsVisible, widgets]); // Re-run when widgets change or when visibility of map changes


// Get the Proj4 definition for the EPSG code
  const getProj4Def = (code) => {
    return epsgDB[code] || null;
  }
  // Convert coordinates using the Proj4 definition
  const transformCoordinates = (x, y, sourceCrs) => {
    let proj4Def = null;
    // if a EPSG code is provided, try to get the associated proj4 coordinate
    if (!sourceCrs.toString().startsWith("+proj")) {
      try {
        // first, see if a particular projection code is available in database
        proj4Def = getProj4Def(sourceCrs);

        if (!proj4Def) {
          // try to get the proj4 from the defs directly
          try {
            proj4Def = proj4.defs[`EPSG:${sourceCrs.toString()}`]
          } catch {
            console.error(`Projection ${sourceCrs} not found in proj4 lib`)
          }
        }
      } catch {
        console.error(`Projection ${sourceCrs} not found in proj4 or EPSG database`);
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
/* first div is problematic, makes the page overflow */
  return (
    <div style={{overflow: "hidden", height: "100vh", width: "100%" }}>
      {/* Map container */}
        <MapContainer
          ref={mapRef}
          center={[0, 0]}
          zoom={3}
          style={{ height: "70vh", width: "100%", position: "relative"}}
        >
          {/* Tile layers */}
          {mapLayers === "OSM" && (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={22} maxNativeZoom={19}
            />
          )}
          {mapLayers === "Satellite" && (
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" maxZoom={22} maxNativeZoom={19}/>

          )}

          {/* Render dynamically added markers */}
        {widgets.map((widget) => {
          const { x, y } = widget.coordinates;

          // Validate and convert coordinates
          if (!x || !y) return null; // Skip markers without valid coordinates
          const converted = transformCoordinates(x, y, epsgCode);

          if (!converted) return null; // invalid transformation
          const [convertedX, convertedY] = converted;
          // bounds
          return (
            <Marker key={widget.id} position={[convertedY, convertedX]} icon={widget.icon}>
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
            top: "90px",
            left: "10px",
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

MapTab.propTypes = {
    epsgCode: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    widgets: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.number.isRequired,
        coordinates: PropTypes.shape({
            x: PropTypes.number.isRequired,
            y: PropTypes.number.isRequired,
        }).isRequired,
        icon: PropTypes.object, // Assuming icon is an object (Leaflet icons are objects)
    })).isRequired,
    mapIsVisible: PropTypes.bool.isRequired,
};

export default MapTab;
