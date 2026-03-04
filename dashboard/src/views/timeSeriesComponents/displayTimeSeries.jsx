import { useState, useEffect, useRef } from "react";
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
import { useMessage } from "../../messageContext.jsx";
import api from "../../api/api.js";
import { TimeSeriesChangeModal } from "../videoComponents/timeSeriesChangeModal.jsx";
import { getVideoId } from "../../utils/apiCalls/video.jsx";
import FilterTimeSeries from "./filterTimeSeries.jsx";

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

const DisplayTimeSeries = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [data, setData] = useState([]);  // initialize data
  const [filteredData, setFilteredData] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  const chartRef = useRef(null);
  const loadDataTimeoutRef = useRef(null);
  // allow for setting messages
  const { setMessageInfo } = useMessage();
  // View toggle: 'timeSeries' or 'ratingCurve'
  const [viewMode, setViewMode] = useState('timeSeries');
  // Threshold filters
  const [filterH, setFilterH] = useState({ enabled: false, min: null, max: null });
  const [filterQ50, setFilterQ50] = useState({ enabled: false, min: null, max: null });
  const [filterFractionVel, setFilterFractionVel] = useState({ enabled: false, value: 20 });
  // Video config filter
  const [selectedVideoConfigIds, setSelectedVideoConfigIds] = useState(null);
  const [showVideoConfigModal, setShowVideoConfigModal] = useState(false);
  const [allVideoConfigIds, setAllVideoConfigIds] = useState([]);
  const startDateTimeoutRef = useRef(null); // debouncers for preventing too frequent changes in calendar dates
  const endDateTimeoutRef = useRef(null);

  useEffect(() => {
    // Collapse by default on small screens (< 768px)
    if (window.innerWidth < 768) {
      setIsCollapsed(true);
    }
  }, []);

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
    if (allVideoConfigIds.length == 0) {
      fetchAllVideoConfigIds();
    }
  }, []);

  // if start and/or end date changes, reload data
  useEffect(() => {
    const loadData = async (minDate, maxDate, currentMinDate, currentMaxDate, needsDataBefore, needsDataAfter) => {
      // load new data
      console.log(`Loading additional data: ${minDate} to ${maxDate}`);
      setIsLoading(true);
      let uniqueSorted = data;
      // try updating
      try {
        const newStart = needsDataBefore ? minDate.toISOString().slice(0, -1) : currentMinDate.toISOString().slice(0, -1);
        const newEnd = needsDataAfter ? maxDate.toISOString().slice(0, -1) : currentMaxDate.toISOString().slice(0, -1);

        const response = await api.get('/time_series/', {
          params: buildQueryParams(newStart, newEnd)
        });

        // Merge new data with existing, removing duplicates
        const merged = [...data, ...response.data];
        const unique = Array.from(
          new Map(merged.map(item => [item.id, item])).values()
        );
        uniqueSorted = unique.sort((a, b) => new Date(a.timestamp + "Z") - new Date(b.timestamp + "Z"));
      } catch (error) {
        console.error('Error loading additional data:', error);
      }
      return uniqueSorted;
    }
    const updateTimeSeries = async () => {
      const minDate = dateRange.startDate ? getDateDiff(new Date(dateRange.startDate), -0.5) : null;
      const maxDate = dateRange.endDate ? getDateDiff(new Date(dateRange.endDate), + 0.5) : null;
      if (!minDate || !maxDate) return;
      // Check if we need to load more data
      const currentMinDate = new Date(Math.min(...data.map(d => new Date(d.timestamp + "Z"))));
      const currentMaxDate = new Date(Math.max(...data.map(d => new Date(d.timestamp + "Z"))));
      const needsDataBefore = currentMinDate.getTime() ? (minDate < currentMinDate) : true;
      const needsDataAfter = currentMaxDate.getTime() ? (maxDate > currentMaxDate) : true;
      let sortedData = data;
      try {
        if (needsDataBefore || needsDataAfter || !currentMinDate.getTime() || !currentMaxDate.getTime()) {
          sortedData = await loadData(minDate, maxDate, currentMinDate, currentMaxDate, needsDataBefore, needsDataAfter);
        }
      } catch (error) {
        console.error('Error loading additional data:', error);
      } finally {
        setData(
          sortedData.filter(
            d => new Date(d.timestamp + "Z") >= minDate && new Date(d.timestamp + "Z") <= maxDate
          ))
        setIsLoading(false);
      }
    }
    updateTimeSeries();
  }, [dateRange]);

  // Initial data load: one week before last timestamp to last timestamp
  useEffect(() => {
    if (!selectedVideoConfigIds) {
      return;
    } // Wait for video config IDs to be loaded

    const fetchInitialData = async () => {
      // setIsLoading(true);
      try {
        // First, get the last timestamp
        const response = await api.get('/time_series/', { params: { count: 1 } });

        if (response.data && response.data.length > 0) {
          const lastTimestamp = new Date(`${response.data[0].timestamp}Z`);
          const oneWeekBefore = getDateDiff(lastTimestamp, -7);
          setDateRange({
            startDate: toISOLocal(oneWeekBefore), //.toISOString().slice(0, -1),
            endDate: toISOLocal(lastTimestamp) //.toISOString().slice(0, -1)
          });
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
    console.log(filtered, data);
    setFilteredData(filtered);
  }, [data, filterH, filterQ50, filterFractionVel]);

  // helper function to get a difference in date in days
  const getDateDiff = (date, days) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  }

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
  // helper function to get a local timezone specific datestring for use in graphs
  const toISOLocal = (d) => {
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, -1);
  }


  // handle change in time series view mode
  const handleViewModeChange = (view) => {
    setViewMode(view);
  };

  const setStartDate = (date) => {
    if (startDateTimeoutRef.current) {
      clearTimeout(startDateTimeoutRef.current);
    }
    // make a new timeout
    startDateTimeoutRef.current = setTimeout(() => {
      setDateRange({
        ...dateRange,
        startDate: date
      })
    }, 2000)  // delay 1 second to prevent continuous reloading
  }
  const setEndDate = (date) => {
    if (endDateTimeoutRef.current) {
      clearTimeout(endDateTimeoutRef.current);
    }
    // make new timeout
    endDateTimeoutRef.current = setTimeout(() => {
      setDateRange({
        ...dateRange,
        endDate: date
      })
    }, 2000)  // delay of one second
  }
  // Handle zoom and load additional data if needed
  const handleZoomComplete = async ({ chart }) => {
    if (loadDataTimeoutRef.current) {
      clearTimeout(loadDataTimeoutRef.current);
    }
    // debounce in one second to prevent continuous reloading
    loadDataTimeoutRef.current = setTimeout(async () => {
      const xScale = chart.scales.x;
      const minDate = new Date(xScale.min);
      const maxDate = new Date(xScale.max);
      setDateRange({
        startDate: toISOLocal(minDate),
        endDate: toISOLocal(maxDate)
      })
    }, 1000)
  }

  const handleClick = async (event, elements) => {
    const videoId = filteredData[elements[0].index].video_id;
    // retrieve video, check if it is ready to run
    if (videoId) {
      // retrieve video
      const video = await getVideoId(videoId);
      if (video.allowed_to_run) {
        setSelectedVideo(video);
        setShowRunModal(true);
      } else {
        setMessageInfo('warning', `Video configuration not ready for clicked timestamp ${data[elements[0].index].timestamp}Z`);
      }
    } else {
      setMessageInfo('warning', `No video available for clicked timestamp ${data[elements[0].index].timestamp}Z`);
    }
  }


  // Prepare chart data based on view mode
  const chartData = viewMode === 'timeSeries' ? {
    datasets: [
      {
        label: 'Water Level',
        data: filteredData.map(d => ({ x: new Date(d.timestamp + "Z"), y: d.h || NaN })),
        borderColor: 'rgba(30,63,192,0.8)',
        backgroundColor: 'rgba(30, 63, 192, 0.3)',
        yAxisID: 'y',
        tension: 0.0,
        fill: 'origin',
      },
      {
        label: 'Discharge (median)',
        data: filteredData.map(d => ({ x: new Date(d.timestamp + "Z"), y: d.q_50 || NaN })),
        borderColor: 'rgb(255,99,99)',
        backgroundColor: 'rgba(255,99,99,0.5)',
        yAxisID: 'y1',
        tension: 0.0,
      },
      {
        label: 'Surface Velocity',
        data: filteredData.map(d => ({ x: new Date(d.timestamp + "Z"), y: d.v_surf || NaN })),
        borderColor: 'rgb(85,218,53)',
        backgroundColor: 'rgba(85,218,53, 0.5)',
        yAxisID: 'y2',
        tension: 0.0,
      },
      {
        label: 'Bulk Velocity',
        data: filteredData.map(d => ({ x: new Date(d.timestamp + "Z"), y: d.v_bulk || NaN })),
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
      data: filteredData.map(d => ({ x: d.h, y: d.q_50 || NaN })).filter(d => d.y !== null),
      borderColor: 'rgb(30, 63, 192)',
      backgroundColor: 'rgba(30, 63, 192, 0.5)',
      showLine: false,
      pointRadius: 3,
    }],
  };

  const chartOptions = viewMode === 'timeSeries' ? {
    animation: false,
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
            // when panning, current time series may disappear from data
            if (ts) {
              let title = `${ts.id}: ${tooltipItems[0].label}`;
              if (ts.video_id) {
                title += `\nClick to edit analysis of video ${ts.video_id}`;
              }
              return title
            }
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
            return l
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
        min: dateRange.startDate,
        max: dateRange.endDate
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
    onClick: handleClick,

    plugins: {
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          onPanComplete: null,
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
          onZoomComplete: null,
        },
      },

      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: ["Rating Curve (Q-h)", `${dateRange.startDate} to ${dateRange.endDate}`],
      },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (tooltipItems) => {
            const ts = filteredData[tooltipItems[0].dataIndex];
            // when panning, current time series may disappear from data
            if (ts) {
              let title = `${ts.timestamp}: ${tooltipItems[0].label}`;
              if (ts.video_id) {
                title += `\nClick to edit analysis of video ${ts.video_id}`;
              }
              return title
            }
          },

          // title: (context) => `test ${context.parsed.timestamp}`,
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
          <div className="spinner" />
          <div>Loading time series...</div>
        </div>
      )}
      <div className="flex-container column">
        <div className="flex-container no-padding" style={{"flexDirection": "row"}}>
          <button
            className="toggle-service-description" style={{left: 0, alignSelf: "flex-start"}}
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? 'Show upload window' : 'Hide upload window'}
            title={isCollapsed ? 'Show upload window' : 'Hide upload window'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
          <h5>Filters and downloads</h5>
        </div>
        <div className={`collapsible-content${isCollapsed ? ' collapsed' : ''}`}>
          <FilterTimeSeries
            filterH={filterH}
            setFilterH={setFilterH}
            filterQ50={filterQ50}
            setFilterQ50={setFilterQ50}
            filterFractionVel={filterFractionVel}
            setFilterFractionVel={setFilterFractionVel}
            selectedVideoConfigIds={selectedVideoConfigIds}
            allVideoConfigIds={allVideoConfigIds}
            dateRange={dateRange}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
            data={data}
          />
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
        <div style={{ height: '500px', position: 'relative' }}>
          <>
            <Line ref={chartRef} data={chartData} options={chartOptions} key={viewMode} />
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
        <TimeSeriesChangeModal setShowModal={setShowRunModal} video={selectedVideo} setVideo={setSelectedVideo} />
      )}
    </div>
  );
};

export default DisplayTimeSeries;
