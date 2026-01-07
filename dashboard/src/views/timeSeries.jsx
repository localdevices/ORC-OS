import { useState } from 'react';

import DisplayTimeSeries from "./timeSeriesComponents/displayTimeSeries.jsx";

const TimeSeries = () => {

  // Date filter states
  return (
    <div>
      <h1>Time Series </h1>
      View, filter, analyze, and download your time series
      <DisplayTimeSeries
      />
    </div>
  );
};

export default TimeSeries;
