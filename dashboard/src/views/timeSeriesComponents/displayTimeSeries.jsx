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

import ActionTimeSeries from "./actionTimeSeries.jsx";
import {useMessage} from "../../messageContext.jsx";
import api from "../../api/api.js";

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

const DisplayTimeSeries = ({startDate, endDate, setStartDate, setEndDate, fractionVelocimetry, setFractionVelocimetry}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState([]);  // initialize data
  const [filteredData, setFilteredData] = useState([]);
  const chartRef = useRef(null);

  // allow for setting messages
  const {setMessageInfo} = useMessage();

  // Variable visibility toggles
  const [showH, setShowH] = useState(true);
  const [showQ50, setShowQ50] = useState(true);
  const [showVSurf, setShowVSurf] = useState(true);
  const [showVBulk, setShowVBulk] = useState(true);

  // View toggle: 'timeSeries' or 'ratingCurve'
  const [viewMode, setViewMode] = useState('timeSeries');

  // Threshold filters
  const [filterH, setFilterH] = useState({enabled: false, operator: '>', value: 0.5});
  const [filterQ50, setFilterQ50] = useState({enabled: false, operator: '<', value: 30});
  const [filterFractionVel, setFilterFractionVel] = useState({enabled: false, operator: '>', value: 90});

  // Initial data load: one week before last timestamp to last timestamp
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // First, get the last timestamp
        const response = await api.get('/time_series/', {params: {limit: 1, order: 'desc'}});

        if (response.data && response.data.length > 0) {
          const lastTimestamp = new Date(response.data[0].timestamp);
          const oneWeekBefore = new Date(lastTimestamp);
          oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);

          setStartDate(oneWeekBefore.toISOString());
          setEndDate(lastTimestamp.toISOString());

          // Fetch data for the range
          const dataResponse = await api.get('/time_series/', {
            params: {
              start: oneWeekBefore.toISOString(),
              stop: lastTimestamp.toISOString()
            }
          });

          setData(dataResponse.data);
        }
      } catch (error) {
        console.error('Error fetching initial time series:', error);
        setMessageInfo({message: 'Failed to load time series data', severity: 'error'});
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Apply filters when data or filter settings change
  useEffect(() => {
    let filtered = [...data];

    if (filterH.enabled) {
      filtered = filtered.filter(d => {
        const value = d.h;
        if (value == null) return false;
        return filterH.operator === '>' ? value > filterH.value : value < filterH.value;
      });
    }

    if (filterQ50.enabled) {
      filtered = filtered.filter(d => {
        const value = d.q_50;
        if (value == null) return false;
        return filterQ50.operator === '>' ? value > filterQ50.value : value < filterQ50.value;
      });
    }

    if (filterFractionVel.enabled) {
      filtered = filtered.filter(d => {
        const value = d.fraction_velocimetry;
        if (value == null) return false;
        return filterFractionVel.operator === '>' ? value > filterFractionVel.value : value < filterFractionVel.value;
      });
    }

    setFilteredData(filtered);
  }, [data, filterH, filterQ50, filterFractionVel]);

  // Handle zoom and load additional data if needed
  const handleZoomComplete = async ({chart}) => {
    const xScale = chart.scales.x;
    const minDate = new Date(xScale.min);
    const maxDate = new Date(xScale.max);

    // Check if we need to load more data
    const currentMinDate = new Date(Math.min(...data.map(d => new Date(d.timestamp))));
    const currentMaxDate = new Date(Math.max(...data.map(d => new Date(d.timestamp))));

    const needsDataBefore = minDate < currentMinDate;
    const needsDataAfter = maxDate > currentMaxDate;

    if (needsDataBefore || needsDataAfter) {
      try {
        const newStart = needsDataBefore ? minDate.toISOString() : currentMinDate.toISOString();
        const newEnd = needsDataAfter ? maxDate.toISOString() : currentMaxDate.toISOString();

        const response = await api.get('/time_series/', {
          params: {
            start: newStart,
            stop: newEnd
          }
        });

        // Merge new data with existing, removing duplicates
        const merged = [...data, ...response.data];
        const unique = merged.filter((item, index, self) =>
          index === self.findIndex((t) => t.timestamp === item.timestamp)
        );

        setData(unique.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
        setStartDate(newStart);
        setEndDate(newEnd);
      } catch (error) {
        console.error('Error loading additional data:', error);
      }
    }
  };

  // Prepare chart data based on view mode
  const chartData = viewMode === 'timeSeries' ? {
    datasets: [
      showH && {
        label: 'Water Level (h)',
        data: filteredData.map(d => ({x: new Date(d.timestamp), y: d.h})),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        yAxisID: 'y',
        tension: 0.1,
      },
      showQ50 && {
        label: 'Discharge (q_50)',
        data: filteredData.map(d => ({x: new Date(d.timestamp), y: d.q_50})),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        yAxisID: 'y1',
        tension: 0.1,
      },
      showVSurf && {
        label: 'Surface Velocity (v_surf)',
        data: filteredData.map(d => ({x: new Date(d.timestamp), y: d.v_surf})),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        yAxisID: 'y2',
        tension: 0.1,
      },
      showVBulk && {
        label: 'Bulk Velocity (v_bulk)',
        data: filteredData.map(d => ({x: new Date(d.timestamp), y: d.v_bulk})),
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        yAxisID: 'y3',
        tension: 0.1,
      },
    ].filter(Boolean),
  } : {
    // Rating curve: x = h (water level), y = q_50 (discharge)
    datasets: [{
      label: 'Rating Curve',
      data: filteredData.map(d => ({x: d.h, y: d.q_50})).filter(d => d.x != null && d.y != null),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
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
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Time Series View',
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
          onZoomComplete: handleZoomComplete,
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'hour',
        },
        title: {
          display: true,
          text: 'Timestamp',
        },
      },
      y: {
        type: 'linear',
        display: showH,
        position: 'left',
        min: 0,
        title: {
          display: true,
          text: 'Water Level (m)',
        },
      },
      y1: {
        type: 'linear',
        display: showQ50,
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
        display: showVSurf,
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
        display: showVBulk,
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
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
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

  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
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
        <ActionTimeSeries
          startDate={startDate}
          endDate={endDate}
          setData={setData}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          setMessageInfo={setMessageInfo}
        />
      </div>

      <div className="flex-container column">
        <h5>View your time series</h5>

        {/* View Mode Toggle */}
        <div className="mb-3">
          <label className="me-3">
            <input
              type="radio"
              value="timeSeries"
              checked={viewMode === 'timeSeries'}
              onChange={(e) => setViewMode(e.target.value)}
              className="me-1"
            />
            Time Series
          </label>
          <label>
            <input
              type="radio"
              value="ratingCurve"
              checked={viewMode === 'ratingCurve'}
              onChange={(e) => setViewMode(e.target.value)}
              className="me-1"
            />
            Rating Curve
          </label>
        </div>

        {/* Variable Toggles - only show in time series mode */}
        {viewMode === 'timeSeries' && (
          <div className="mb-3">
            <h6>Variables</h6>
            <label className="me-3">
              <input
                type="checkbox"
                checked={showH}
                onChange={(e) => setShowH(e.target.checked)}
                className="me-1"
              />
              Water Level (h)
            </label>
            <label className="me-3">
              <input
                type="checkbox"
                checked={showQ50}
                onChange={(e) => setShowQ50(e.target.checked)}
                className="me-1"
              />
              Discharge (q_50)
            </label>
            <label className="me-3">
              <input
                type="checkbox"
                checked={showVSurf}
                onChange={(e) => setShowVSurf(e.target.checked)}
                className="me-1"
              />
              Surface Velocity (v_surf)
            </label>
            <label>
              <input
                type="checkbox"
                checked={showVBulk}
                onChange={(e) => setShowVBulk(e.target.checked)}
                className="me-1"
              />
              Bulk Velocity (v_bulk)
            </label>
          </div>
        )}

        {/* Threshold Filters */}
        <div className="mb-3">
          <h6>Filters</h6>
          <div className="mb-2">
            <label className="me-2">
              <input
                type="checkbox"
                checked={filterH.enabled}
                onChange={(e) => setFilterH({...filterH, enabled: e.target.checked})}
                className="me-1"
              />
              Water Level (h)
            </label>
            <select
              value={filterH.operator}
              onChange={(e) => setFilterH({...filterH, operator: e.target.value})}
              className="me-2"
              disabled={!filterH.enabled}
            >
              <option value=">">{'>'}</option>
              <option value="<">{'<'}</option>
            </select>
            <input
              type="number"
              value={filterH.value}
              onChange={(e) => setFilterH({...filterH, value: parseFloat(e.target.value)})}
              step="0.1"
              className="me-2"
              style={{width: '80px'}}
              disabled={!filterH.enabled}
            />
          </div>

          <div className="mb-2">
            <label className="me-2">
              <input
                type="checkbox"
                checked={filterQ50.enabled}
                onChange={(e) => setFilterQ50({...filterQ50, enabled: e.target.checked})}
                className="me-1"
              />
              Discharge (q_50)
            </label>
            <select
              value={filterQ50.operator}
              onChange={(e) => setFilterQ50({...filterQ50, operator: e.target.value})}
              className="me-2"
              disabled={!filterQ50.enabled}
            >
              <option value=">">{'>'}</option>
              <option value="<">{'<'}</option>
            </select>
            <input
              type="number"
              value={filterQ50.value}
              onChange={(e) => setFilterQ50({...filterQ50, value: parseFloat(e.target.value)})}
              step="1"
              className="me-2"
              style={{width: '80px'}}
              disabled={!filterQ50.enabled}
            />
          </div>

          <div className="mb-2">
            <label className="me-2">
              <input
                type="checkbox"
                checked={filterFractionVel.enabled}
                onChange={(e) => setFilterFractionVel({...filterFractionVel, enabled: e.target.checked})}
                className="me-1"
              />
              Fraction Velocimetry
            </label>
            <select
              value={filterFractionVel.operator}
              onChange={(e) => setFilterFractionVel({...filterFractionVel, operator: e.target.value})}
              className="me-2"
              disabled={!filterFractionVel.enabled}
            >
              <option value=">">{'>'}</option>
              <option value="<">{'<'}</option>
            </select>
            <input
              type="number"
              value={filterFractionVel.value}
              onChange={(e) => setFilterFractionVel({...filterFractionVel, value: parseFloat(e.target.value)})}
              step="1"
              className="me-2"
              style={{width: '80px'}}
              disabled={!filterFractionVel.enabled}
            />
          </div>
        </div>

        {/* Chart */}
        <div style={{height: '500px', position: 'relative'}}>
          {filteredData.length > 0 ? (
            <>
              <Line ref={chartRef} data={chartData} options={chartOptions} />
              {viewMode === 'timeSeries' && (
                <button onClick={resetZoom} className="btn mt-2">Reset Zoom</button>
              )}
            </>
          ) : (
            <div>No data available for the selected filters and date range.</div>
          )}
        </div>
      </div>
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
