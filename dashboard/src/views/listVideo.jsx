import { useState } from 'react';

import PaginatedVideos from "./videoComponents/paginatedVideos.jsx";
const ListVideo = () => {
  const [videoData, setVideoData] = useState([]); // Stores video metadata

  // Default: One day back until now
  const defaultEndDate = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 60); // 2 months back

  // Date filter states
  // const [startDate, setStartDate] = useState(defaultStartDate.toISOString().slice(0, 16)); // Format: YYYY-MM-DDTHH:mm
  // const [endDate, setEndDate] = useState(defaultEndDate.toISOString().slice(0, 16)); // Format: YYYY-MM-DDTHH:mm
  const [startDate, setStartDate] = useState(null); // Format: YYYY-MM-DDTHH:mm
  const [endDate, setEndDate] = useState(null); // Format: YYYY-MM-DDTHH:mm
  const [status, setStatus] = useState(null);
  // useEffect(() => {
  //   api.get('/video/', { params: {start: startDate, stop: endDate}}) // Retrieve list from api
  //     .then((response) => {
  //       setVideoData(response.data);
  //       // Calculate the index range for records to display
  //     })
  //     .catch((error) => {
  //       console.error('Error fetching video metadata:', error);
  //     });
  // }, []);


  return (
    <div>
      <h1>Video </h1>
      Drop new videos. Browse through your videos, delete them, view details, download, or perform single runs tasks.
      <PaginatedVideos
        startDate={startDate}
        endDate={endDate}
        status={status}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        setStatus={setStatus}
      />
    </div>
  );
};

export default ListVideo;
