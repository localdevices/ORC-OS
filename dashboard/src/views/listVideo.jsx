import { useState } from 'react';

import PaginatedVideos from "./videoComponents/paginatedVideos.jsx";
const ListVideo = ({videoRunState}) => {

  // Date filter states
  const [startDate, setStartDate] = useState(null); // Format: YYYY-MM-DDTHH:mm
  const [endDate, setEndDate] = useState(null); // Format: YYYY-MM-DDTHH:mm
  return (
    <div>
      <h1>Video </h1>
      Drop new videos. Browse through your videos, delete them, view details, download, or perform single runs tasks.
      <PaginatedVideos
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        videoRunState={videoRunState}
      />
    </div>
  );
};

export default ListVideo;
