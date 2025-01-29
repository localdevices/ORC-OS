import L from "leaflet"; // Import Leaflet for DivIcon

// Function to create a custom DivIcon with dynamic RGBA colors
export const createCustomMarker = (color) => {

  return L.divIcon({
    className: "custom-marker", // Base class (can use CSS for additional styles)
    html: `<div style="
      background-color: ${color};
      width: 1.5rem;
      height: 1.5rem;
      left: -0.75rem;
      top: -0.75rem;
      transform: rotate(45deg);
      border-radius: 1.5rem 1.5rem 0;
      alignItems: center;
      justify-content: center;
      border: 1px solid rgba(0, 0, 0, 0.5);
      color: white
    "><div style='transform: rotate(-45deg)'>1</div></div>`,
    iconSize: [30, 30], // Marker size
    iconAnchor: [15, 15], // Position the icon properly
    popupAnchor: [0, -20], // Adjust popup anchor relative to marker
  });
};