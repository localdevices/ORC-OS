import { useState, useEffect } from 'react';
import api from '../api';
import PaginatedVideos from "./videoComponents/paginatedVideos.jsx";
import {useMessage} from '../messageContext';
import MessageBox from '../messageBox';

const ListVideo = () => {
  const [videoData, setVideoData] = useState([]); // Stores video metadata

  // Default: One day back until now
  const defaultEndDate = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 3); // 1 day back

  // Date filter states
  const [startDate, setStartDate] = useState(defaultStartDate.toISOString().slice(0, 16)); // Format: YYYY-MM-DDTHH:mm
  const [endDate, setEndDate] = useState(defaultEndDate.toISOString().slice(0, 16)); // Format: YYYY-MM-DDTHH:mm


  // Fetch video metadata from API
  useEffect(() => {
    api.get('/video/', { params: {start: startDate, stop: endDate}}) // Retrieve list from api
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
      <MessageBox />
      Browse through your videos, delete them, view details, download, or perform single runs tasks.

      <PaginatedVideos
        initialData={videoData}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
      />
    </div>
  );
};

export default ListVideo;