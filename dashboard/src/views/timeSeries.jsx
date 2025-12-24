import { useState } from 'react';

import DisplayTimeSeries from "./timeSeriesComponents/displayTimeSeries.jsx";

const TimeSeries = () => {

  // Date filter states
  const [startDate, setStartDate] = useState(null); // Format: YYYY-MM-DDTHH:mm
  const [endDate, setEndDate] = useState(null); // Format: YYYY-MM-DDTHH:mm
  const [fractionVelocimetry, setFractionVelocimetry] = useState(90); // Format: YYYY-MM-DDTHH:mm
  return (
    <div>
      <h1>Time Series </h1>
      View, filter, analyze, and download your time series
      <DisplayTimeSeries
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        fractionVelocimetry={fractionVelocimetry}
        setFractionVelocimetry={setFractionVelocimetry}
        // videoRunState={videoRunState}
      />
    </div>
  );
};

export default TimeSeries;
