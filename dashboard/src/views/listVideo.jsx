import { useState, useEffect } from 'react';
import { FaPlay, FaEye, FaTrash } from 'react-icons/fa'; // Icons from FontAwesome
import api from '../api';
import PaginatedVideos from "./videoComponents/paginatedVideos.jsx";

const ListVideo = () => {
  const [videoData, setVideoData] = useState([]); // Stores video metadata
  const [currentPage, setCurrentPage] = useState(1); // tracks which page is shown
  const rowsPerPage = 2;
  const currentVideoRecords = [] //videoData.slice(currentPage * rowsPerPage, currentPage * rowsPerPage + rowsPerPage);

  // Fetch video metadata from API
  useEffect(() => {
    api.get('/video/') // Retrieve list from api
      .then((response) => {
        setVideoData(response.data);
        // Calculate the index range for records to display
      })
      .catch((error) => {
        console.error('Error fetching video metadata:', error);
      });
  }, []);


  return (
    <div className="container mt-4">
      <h1>Video </h1>
      Browse through your videos, delete them, view details, download, or perform single runs tasks.

      <PaginatedVideos initialData={videoData}/>
    </div>
  );
};

export default ListVideo;