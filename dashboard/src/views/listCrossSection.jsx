import { useState, useEffect } from 'react';
import api from '../api/api.js';
import PaginatedCrossSections from "./crossSectionComponents/paginatedCrossSections.jsx";

const ListCrossSection = () => {
  const [crossSectionData, setCrossSectionData] = useState([]); // Stores video metadata

  // Default: One day back until now

  // Fetch video metadata from API
  useEffect(() => {
    api.get('/cross_section/') // Retrieve list from api
      .then((response) => {
        setCrossSectionData(response.data);
        // Calculate the index range for records to display
      })
      .catch((error) => {
        console.error('Error fetching cross section metadata:', error);
      });
  }, []);


  return (
    <div className="container mt-4">
      <h1>Cross Sections</h1>
       Cross sections consist of x, y, z points, taken across the stream, describing a natural profile, or a
       profile that is followed by the optical water level detection scheme.
      <PaginatedCrossSections
        initialData={crossSectionData}
      />
    </div>
  );
};

export default ListCrossSection;
