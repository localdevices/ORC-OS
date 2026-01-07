import {useState, useEffect, useRef} from "react";
import PropTypes from "prop-types";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';

import VideoConfigFilterModal from "./videoConfigFilterModal.jsx";
import {useMessage} from "../../messageContext.jsx";
import api from "../../api/api.js";
import ReactSlider from "react-slider";
import {TimeSeriesChangeModal} from "../videoComponents/timeSeriesChangeModal.jsx";
import {getVideoId} from "../../utils/apiCalls/video.jsx";
import FilterDates from "../../utils/filterDates.jsx";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  zoomPlugin
);

const DisplayTimeSeries = ({startDate, endDate, setStartDate, setEndDate}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState([]);  // initialize data
  const [filteredData, setFilteredData] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const chartRef = useRef(null);
  const loadDataTimeoutRef = useRef(null);
  // allow for setting messages
  const {setMessageInfo} = useMessage();
  // View toggle: 'timeSeries' or 'ratingCurve'
  const [viewMode, setViewMode] = useState('timeSeries');
  // Threshold filters
  const [filterH, setFilterH] = useState({enabled: false, min: null, max: null});
  const [filterQ50, setFilterQ50] = useState({enabled: false, min: null, max: null});
  const [filterFractionVel, setFilterFractionVel] = useState({enabled: false, value: 20});
  // Video config filter
  const [selectedVideoConfigIds, setSelectedVideoConfigIds] = useState(null);
  const [showVideoConfigModal, setShowVideoConfigModal] = useState(false);
  const [allVideoConfigIds, setAllVideoConfigIds] = useState([]);

  // Fetch all video config IDs on mount
  useEffect(() => {
    const fetchAllVideoConfigIds = async () => {
      try {
        const response = await api.get('/video_config/');
        const allIds = [0, ...response.data.map(vc => vc.id)];
        setAllVideoConfigIds(allIds);
        setSelectedVideoConfigIds(allIds); // Select all by default
      } catch (error) {
        console.error('Error fetching video configs:', error);
      }
    };

    fetchAllVideoConfigIds();
  }, []);

  // Initial data load: one week before last timestamp to last timestamp
  useEffect(() => {
    if (!selectedVideoConfigIds) return; // Wait for video config IDs to be loaded

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // First, get the last timestamp
        const response = await api.get('/time_series/', {params: {count: 1}});

        if (response.data && response.data.length > 0) {
          const lastTimestamp = new Date(`${response.data[0].timestamp}Z`);
          const oneWeekBefore = new Date(lastTimestamp);
          oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);

          setStartDate(oneWeekBefore.toISOString().slice(0, -1));
          setEndDate(lastTimestamp.toISOString().slice(0, -1));

          // Fetch data for the range
          const dataResponse = await api.get('/time_series/', {
            params: buildQueryParams(
              oneWeekBefore.toISOString().slice(0, -1),
              lastTimestamp.toISOString().slice(0, -1)
            )
          });
          setData(dataResponse.data);
        }
      } catch (error) {
        console.error('Error fetching initial time series:', error);
        setMessageInfo('error', 'Failed to load time series data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [selectedVideoConfigIds]);

  // Apply filters when data or filter settings change
  useEffect(() => {
    let filtered = [...data];

    if (filterH.enabled) {
      filtered = filtered.filter(d => {
        const value = d.h;
        if (value == null) return true;
        return value <= (filterH.max || Infinity) && value >= (filterH.min || -Infinity);
      });
    }

    if (filterQ50.enabled) {
      filtered = filtered.filter(d => {
        const value = d.q_50;
        if (value == null) return true;
        return value <= (filterQ50.max || Infinity) && value >= (filterQ50.min || -Infinity);
      });
    }

    if (filterFractionVel.enabled) {
      filtered = filtered.filter(d => {
        const value = d.fraction_velocimetry;
        if (value == null) return true;
        return value > (filterFractionVel.value || 0);
      });
    }

    setFilteredData(filtered);
  }, [data, filterH, filterQ50, filterFractionVel]);

  // Helper function to build query params
  const buildQueryParams = (start, stop) => {
    const params = {
      start: start,
      stop: stop,
      desc: false
    };

    // Only add video_config_ids if not all are selected
    if (selectedVideoConfigIds && allVideoConfigIds.length > 0 &&
      selectedVideoConfigIds.length !== allVideoConfigIds.length) {
      params.video_config_ids = selectedVideoConfigIds.join(',');
    }
    if (selectedVideoConfigIds.length === 0) {
      delete params.video_config_ids;
    }

    return params;
  };

  // handle change in time series view mode
  const handleViewModeChange = (view) => {
    setViewMode(view);
  };

  // Handle zoom and load additional data if needed
  const handleZoomComplete = async ({chart}) => {
    if (loadDataTimeoutRef.current) {
      clearTimeout(loadDataTimeoutRef.current);
    }
    // debounce in one second to prevent continuous reloading
    loadDataTimeoutRef.current = setTimeout(async () => {
      const xScale = chart.scales.x;
      const minDate = new Date(xScale.min);
      const maxDate = new Date(xScale.max);
      // Check if we need to load more data
      const currentMinDate = new Date(Math.min(...data.map(d => new Date(d.timestamp))));
      const currentMaxDate = new Date(Math.max(...data.map(d => new Date(d.timestamp))));
      console.log(`Current view range: ${currentMinDate} to ${currentMaxDate}`);
      const needsDataBefore = currentMinDate.getTime() ? (minDate < currentMinDate) : true;
      const needsDataAfter = currentMaxDate.getTime() ? (maxDate > currentMaxDate) : true;

      if (needsDataBefore || needsDataAfter || !currentMinDate.getTime() || !currentMaxDate.getTime()) {
        // load new data
        console.log(`Loading additional data: ${minDate} to ${maxDate} with  ${needsDataBefore} and ${needsDataAfter}`);
        setIsLoading(true);
        try {
          const newStart = needsDataBefore ? minDate.toISOString().slice(0, -1) : currentMinDate.toISOString().slice(0, -1);
          const newEnd = needsDataAfter ? maxDate.toISOString().slice(0, -1) : currentMaxDate.toISOString().slice(0, -1);

          const response = await api.get('/time_series/', {
            params: buildQueryParams(newStart, newEnd)
          });

          // Merge new data with existing, removing duplicates
          const merged = [...data, ...response.data];
          const unique = merged.filter((item, index, self) =>
            index === self.findIndex((t) => t.timestamp === item.timestamp)
          );

          setData(unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
          setStartDate(newStart);
          setEndDate(newEnd);
        } catch (error) {
          console.error('Error loading additional data:', error);
        } finally {
          // remove any trailing data outside of the current view to prevent delay due to large data in memory
          setData(data.filter(d => new Date(d.timestamp) >= minDate && new Date(d.timestamp) <= maxDate));
          setIsLoading(false);
        }
      }
    }, 1000)
  }


  const handlefilterFracChange = async (value) => {

    // Ensure values are at least `minimumDifference` apart
    const updatedFilterFrac = {
      ...filterFractionVel,
      value: value
    }
    setFilterFractionVel(updatedFilterFrac);
  }

  const handlefilterHChange = async (values) => {
    let [minH, maxH] = values;

    // Ensure values are at least `minimumDifference` apart
    const updatedFilterH = {
      ...filterH,
      min: minH,
      max: maxH
    }
    setFilterH(updatedFilterH);
  }

  const handlefilterQ50Change = async (values) => {
    let [minQ50, maxQ50] = values;

    // Ensure values are at least `minimumDifference` apart
    const updatedFilterQ50 = {
      ...filterQ50,
      min: minQ50,
      max: maxQ50
    }
  setFilterQ50(updatedFilterQ50);
  }

  const handleClick = async (event, elements) => {
    const videoId = data[elements[0].index].video_id;
    // retrieve video, check if it is ready to run
    if (videoId) {
      // retrieve video
      const video = await getVideoId(videoId);
      if (video.allowed_to_run) {
        setSelectedVideo(video);
        setShowRunModal(true);
      } else {
        setMessageInfo('warning', `Video configuration not ready for clicked timestamp ${data[elements[0].index].timestamp}`);
      }
    } else {
      setMessageInfo('warning', `No video available for clicked timestamp ${data[elements[0].index].timestamp}`);
    }
  }

  const convertToCSV = (data) => {
    if (data.length === 0) return '';

    // Get headers from the first object
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    // Convert each row to CSV format
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Handle null/undefined values and escape commas/quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma or quote
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  };

  const handleDownload = async () => {

    if (data.length === 0) {
      setMessageInfo('warning', 'No data available to download');
      return;
    }

    try {
      const csvContent = convertToCSV(data);
      const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with date range
      const startDateStr = startDate ? new Date(startDate).toISOString().split('T')[0] : 'start';
      const endDateStr = endDate ? new Date(endDate).toISOString().split('T')[0] : 'end';
      const filename = `timeseries_${startDateStr}_to_${endDateStr}.csv`;

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setMessageInfo('success', 'Time series data downloaded successfully');
    } catch (error) {
      console.error('Error downloading CSV:', error);
      setMessageInfo('error', 'Failed to download time series data');
    }
  }
  // Prepare chart data based on view mode
  const chartData = viewMode === 'timeSeries' ? {
    datasets: [
    {
      label: 'Water Level',
      data: filteredData.map(d => ({x: new Date(d.timestamp), y: d.h || NaN})),
      borderColor: 'rgba(30,63,192,0.8)',
      backgroundColor: 'rgba(30, 63, 192, 0.3)',
      yAxisID: 'y',
      tension: 0.0,
      fill: 'origin',
    },
    {
      label: 'Discharge (median)',
      data: filteredData.map(d => ({x: new Date(d.timestamp), y: d.q_50 || NaN })),
      borderColor: 'rgb(255,99,99)',
      backgroundColor: 'rgba(255,99,99,0.5)',
      yAxisID: 'y1',
      tension: 0.0,
    },
    {
      label: 'Surface Velocity',
      data: filteredData.map(d => ({x: new Date(d.timestamp), y: d.v_surf || NaN})),
      borderColor: 'rgb(85,218,53)',
      backgroundColor: 'rgba(85,218,53, 0.5)',
      yAxisID: 'y2',
      tension: 0.0,
    },
    {
      label: 'Bulk Velocity',
      data: filteredData.map(d => ({x: new Date(d.timestamp), y: d.v_bulk || NaN})),
      borderColor: 'rgb(33,81,21)',
      backgroundColor: 'rgba(33,81,21, 0.5)',
      yAxisID: 'y3',
      tension: 0.0,
    },
    ].filter(Boolean),
  } : {
    // Rating curve: x = h (water level), y = q_50 (discharge)
    datasets: [{
      label: 'Rating Curve',
      data: filteredData.map(d => ({x: d.h, y: d.q_50 || NaN})).filter(d => d.y !== null),
      borderColor: 'rgb(30, 63, 192)',
      backgroundColor: 'rgba(30, 63, 192, 0.5)',
      showLine: false,
      pointRadius: 3,
    }],
  };

  const chartOptions = viewMode === 'timeSeries' ? {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
      axis: 'xy'
    },
    onClick: handleClick,
    plugins: {
      filler: {
        propagate: false,
      },
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Time Series View',
      },
      tooltip: {
        enabled: true,
        callbacks: {
          title: (tooltipItems) => {
            const ts = data[tooltipItems[0].dataIndex];
            let title = `${ts.id}: ${tooltipItems[0].label}`;
            if (ts.video_id) {
              title += `\nClick to edit analysis of video ${ts.video_id}`;
            }
            return title
          },
          label: (context) => {
            let l = '';
            l += `${context.dataset.label}: ${context.parsed.y.toFixed(3)}`;
            if (l.includes("Velocity")) {
              l += " m/s";
            } else if (l.includes("Discharge")) {
              l += ' m³/s';
            } else {
              l += ' m';
            }

            return l //`${context.dataset.label}: ${context.parsed.y.toFixed(3)}`;

          },
        },
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          onPanComplete: handleZoomComplete,
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
          onZoomComplete: handleZoomComplete,
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        title: {
          display: true,
          text: 'Timestamp',
        },
        min: startDate,
        max: endDate,
      },
      y: {
        type: 'linear',
        // display: showH,
        position: 'left',
        title: {
          display: true,
          text: 'Water Level (m)',
        },
      },
      y1: {
        type: 'linear',
        // display: showQ50,
        position: 'right',
        min: 0,
        title: {
          display: true,
          text: 'Discharge (m³/s)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      y2: {
        type: 'linear',
        // display: showVSurf,
        position: 'right',
        min: 0,
        title: {
          display: true,
          text: 'Surface Velocity (m/s)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      y3: {
        type: 'linear',
        // display: showVBulk,
        position: 'right',
        min: 0,
        title: {
          display: true,
          text: 'Bulk Velocity (m/s)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  } : {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Rating Curve (Discharge vs Water Level)',
      },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: () => '',
          label: (context) => {
            const h = context.parsed.x.toFixed(2);
            const q = context.parsed.y.toFixed(3);
            return [`Water level: ${h} m`, `Discharge: ${q} m³/s`];
          }
        }
      },
    },
    scales: {
      x: {
        type: 'linear',
        // min: 0,
        title: {
          display: true,
          text: 'Water Level (m)',
        },
      },
      y: {
        type: 'linear',
        min: 0,
        title: {
          display: true,
          text: 'Discharge (m³/s)',
        },
      },
    },
  };

  return (
    <div className="flex-container column no-padding">
      {isLoading && (
        <div className="spinner-viewport">
          <div className="spinner"/>
          <div>Loading time series...</div>
        </div>
      )}
      <div className="flex-container column">
        <h5>Filters</h5>
        <div className="flex-container columns no-padding">
          <div style={{"flex": "1 1 auto"}}>
        {/*<div className="mb-3">*/}
        {/*  <h6>Variables</h6>*/}
        {/*  <label className="me-3">*/}
        {/*    <input*/}
        {/*      type="checkbox"*/}
        {/*      checked={showH}*/}
        {/*      disabled={viewMode !== 'timeSeries'}*/}
        {/*      onChange={(e) => setShowH(e.target.checked)}*/}
        {/*      className="me-1"*/}
        {/*    />*/}
        {/*    Water Level (h)*/}
        {/*  </label>*/}
        {/*  <label className="me-3">*/}
        {/*    <input*/}
        {/*      type="checkbox"*/}
        {/*      checked={showQ50}*/}
        {/*      disabled={viewMode !== 'timeSeries'}*/}
        {/*      onChange={(e) => setShowQ50(e.target.checked)}*/}
        {/*      className="me-1"*/}
        {/*    />*/}
        {/*    Discharge (q_50)*/}
        {/*  </label>*/}
        {/*  <label className="me-3">*/}
        {/*    <input*/}
        {/*      type="checkbox"*/}
        {/*      checked={showVSurf}*/}
        {/*      disabled={viewMode !== 'timeSeries'}*/}
        {/*      onChange={(e) => setShowVSurf(e.target.checked)}*/}
        {/*      className="me-1"*/}
        {/*    />*/}
        {/*    Surface Velocity (v_surf)*/}
        {/*  </label>*/}
        {/*  <label>*/}
        {/*    <input*/}
        {/*      type="checkbox"*/}
        {/*      checked={showVBulk}*/}
        {/*      disabled={viewMode !== 'timeSeries'}*/}
        {/*      onChange={(e) => setShowVBulk(e.target.checked)}*/}
        {/*      className="me-1"*/}
        {/*    />*/}
        {/*    Bulk Velocity (v_bulk)*/}
        {/*  </label>*/}
        {/*</div>*/}


        {/* Threshold Filters */}
        <div className="mb-3">
          {/* Video Config Filter Button */}
          <div className="mb-5 mt-3 form-horizontal">
            <label htmlFor="filterHSlider" className="form-label">
              <input
                type="checkbox"
                checked={filterH.enabled}
                // disabled={viewMode !== 'timeSeries'}
                onChange={(e) => setFilterH({...filterH, enabled: e.target.checked})}
                className="me-1"
              />

              Water level (m)
            </label>
            <div className="slider-container">
              <div className="slider-min">{Math.floor(Math.min(...data.map(d => d.h)) * 1000) / 1000 || 0}</div>
              <div className="slider-max">{Math.ceil(Math.max(...data.map(d => d.h)) * 1000) / 1000 || 1}</div>
              <ReactSlider
                className="horizontal-slider small"
                disabled={!filterH.enabled}
                value={[
                  filterH.min || Math.floor(Math.min(...data.map(d => d.h)) * 1000) / 1000 || 0,
                  filterH.max || Math.ceil(Math.max(...data.map(d => d.h)) * 1000) / 1000 || 1
                ]} // Default values if unset
                min={Math.floor(Math.min(...data.map(d => d.h)) * 1000) / 1000 || 0}
                max={Math.ceil(Math.max(...data.map(d => d.h)) * 1000) / 1000 || 1}
                step={0.001}
                renderThumb={(props, state) => (
                  <div {...props} className={!filterH.enabled ? 'thumb thumb-disabled' : 'thumb'}>
                    <div className="thumb-value">{state.valueNow}</div>
                  </div>
                )}
                onAfterChange={handlefilterHChange}
              />
            </div>
          </div>
          <div className="mb-5 mt-3 form-horizontal">
            <label htmlFor="filterQ50Slider" className="form-label">
              <input
                type="checkbox"
                checked={filterQ50.enabled}
                // disabled={viewMode !== 'timeSeries'}
                onChange={(e) => setFilterQ50({...filterQ50, enabled: e.target.checked})}
                className="me-1"
              />
              Discharge (m³/s)
            </label>
            <div className="slider-container">
              <div className="slider-min">{Math.floor(Math.min(...data.map(d => d.q_50)) * 1000) / 1000 || 0}</div>
              <div className="slider-max">{Math.ceil(Math.max(...data.map(d => d.q_50)) * 1000) / 1000 || 1}</div>
              <ReactSlider
                className="horizontal-slider small"
                disabled={!filterQ50.enabled}
                value={[
                  filterQ50.min || Math.floor(Math.min(...data.map(d => d.q_50)) * 1000) / 1000 || 0,
                  filterQ50.max || Math.ceil(Math.max(...data.map(d => d.q_50)) * 1000) / 1000 || 1
                ]} // Default values if unset
                min={Math.floor(Math.min(...data.map(d => d.q_50)) * 1000) / 1000 || 0}
                max={Math.ceil(Math.max(...data.map(d => d.q_50)) * 1000) / 1000 || 1}
                step={0.001}
                renderThumb={(props, state) => (
                  <div {...props} className={!filterQ50.enabled ? 'thumb thumb-disabled' : 'thumb'}>
                    <div className="thumb-value">{state.valueNow}</div>
                  </div>
                )}
                onAfterChange={handlefilterQ50Change}
              />
            </div>
          </div>
          <div className="mb-2 mt-3 form-horizontal">
            <label htmlFor="filterFracSlider" className="form-label">
              <input
                type="checkbox"
                checked={filterFractionVel.enabled}
                // disabled={viewMode !== 'timeSeries'}
                onChange={(e) => setFilterFractionVel({...filterFractionVel, enabled: e.target.checked})}
                className="me-1"
              />
              min. Measured to total flow [%]
            </label>
            <div className="slider-container">
              <div className="slider-min">{0}</div>
              <div className="slider-max">{100}</div>
              <ReactSlider
                className="horizontal-slider small"
                disabled={!filterFractionVel.enabled}
                value={filterFractionVel.value || 0} // Default values if unset
                min={0}
                max={100}
                step={1}
                renderThumb={(props, state) => (
                  <div {...props} className={!filterFractionVel.enabled ? 'thumb thumb-disabled' : 'thumb'}>
                    <div className="thumb-value">{state.valueNow}</div>
                  </div>
                )}
                onAfterChange={handlefilterFracChange}
              />
            </div>
          </div>
          <button
            className="btn"
            onClick={handleDownload}
            disabled={data.length === 0}
          >
            Download selected
          </button>

        </div>
          </div>
          <div style={{"flex": "0 0 auto", "width": "300px"}}>
            <div className="mb-3">
              <button
                className="btn"
                onClick={() => setShowVideoConfigModal(true)}
              >
                Video Configuration
                {selectedVideoConfigIds && allVideoConfigIds.length > 0 &&
                  selectedVideoConfigIds.length !== allVideoConfigIds.length &&
                  selectedVideoConfigIds.length > 0 &&
                  ` (${selectedVideoConfigIds.length} selected)`}
              </button>
            </div>

            <FilterDates
                startDate={startDate}
                endDate={endDate}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
              />
          </div>
        </div>
      </div>
      <div className="flex-container column">

      <h5>Data</h5>

        <div className="tabs-row">
          <button
            className={viewMode === 'timeSeries' ? 'active-tab' : ''}
            onClick={(e) => {
              e.preventDefault();
              handleViewModeChange('timeSeries');
            }}
          >
            Time series
          </button>
          <button
            className={viewMode === 'ratingCurve' ? 'active-tab' : ''}
            onClick={(e) => {
              e.preventDefault();
              handleViewModeChange('ratingCurve');
            }}
          >
            Rating curve
          </button>
        </div>

        {/* Chart */}
        <div style={{height: '500px', position: 'relative'}}>
            <>
              <Line ref={chartRef} data={chartData} options={chartOptions} />
            </>
            {/*<div>No data available for the selected filters and date range.</div>*/}
        </div>

        {/* Tooltip Image Display */}
      </div>

      {/* Video Config Filter Modal */}
      {showVideoConfigModal && (
        <VideoConfigFilterModal
          showModal={showVideoConfigModal}
          setShowModal={setShowVideoConfigModal}
          selectedVideoConfigIds={selectedVideoConfigIds}
          setSelectedVideoConfigIds={setSelectedVideoConfigIds}
          setMessageInfo={setMessageInfo}
        />
      )}
      {/*Modal for running video */}
      {showRunModal && selectedVideo && (
        <TimeSeriesChangeModal setShowModal={setShowRunModal} video={selectedVideo} setVideo={setSelectedVideo}/>
      )}

    </div>
  );
};
DisplayTimeSeries.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  setStartDate: PropTypes.func.isRequired,
  setEndDate: PropTypes.func.isRequired,
  fractionVelocimetry: PropTypes.number.isRequired,
  setFractionVelocimetry: PropTypes.func.isRequired,

};

export default DisplayTimeSeries;
