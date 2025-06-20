import { useState, useEffect } from 'react';
import api from '../api';
import PaginatedRecipes from "./recipeComponents/paginatedRecipes.jsx";
const ListRecipe = () => {
  const [recipeData, setRecipeData] = useState([]); // Stores video metadata

  // Default: One day back until now

  // Fetch video metadata from API
  useEffect(() => {
    api.get('/recipe/') // Retrieve list from api
      .then((response) => {
        setRecipeData(response.data);
        // Calculate the index range for records to display
      })
      .catch((error) => {
        console.error('Error fetching recipe metadata:', error);
      });
  }, []);


  return (
    <div className="container mt-4">
      <h1>Recipes </h1>
      Recipes define how videos are processed from selected frames to projected frames, to velocities, to cross section velocities
      and to river discharge. Also plotting options can be defined.
      <div className="flex-container column" style={{margin: "0px", marginTop: "20px", marginBottom: "20px"}}>
      <PaginatedRecipes
        initialData={recipeData}
      />
    </div>
    </div>
  );
};

export default ListRecipe;
