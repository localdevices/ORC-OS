import {rainbowColors} from "../../utils/helpers.jsx";
import {Line, Scatter} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

import PropTypes from 'prop-types';

const pointIndexPlugin = {
  id: 'pointIndexPlugin', // Unique ID for the plugin
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    const controlPointsDataset = data.datasets.find(dataset => dataset.label === 'control points');
    if (controlPointsDataset !== -1) {

    // data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(controlPointsDataset);
      console.log(meta);
      meta.data.forEach((element, index) => {
        // Get the data value
        const value = index + 1; // Index + 1 as the label
        const position = element.tooltipPosition(); // Position of the point

        // Draw the text
        ctx.font = '12px sans-serif'; // Set font style
        ctx.textAlign = 'center'; // Align text at the center of the point
        ctx.textBaseline = 'middle'; // Align text vertically at the center
        ctx.fillStyle = 'black'; // Set text color
        ctx.fillText(value, position.x, position.y - 10); // Draw above the point (adjust y as needed)
      });
    };
  },
};

ChartJS.register(pointIndexPlugin);


const TopView = ({CSDischarge, CSWaterLevel, Gcps, cameraPosition, bBox}) => {
  const polygonData =
    bBox && bBox.length > 0
      ? bBox.map((coord) => ({ x: coord[0], y: coord[1] }))
      : [];

  if (polygonData.length > 0) {
    polygonData.push(polygonData[0]); // Closing the polygon
  }

  const gcpPoints = Gcps ? Gcps.map((gcp, index) => ({x: gcp.x, y: gcp.y})) : [];
  const data = {
    datasets: [
      {
        label: "Cross section Q", // First scatter plot
        data: CSDischarge?.x ? CSDischarge.x.map((x, i) => ({x: x, y: CSDischarge.y[i]})) : [], // Map s and z to (x, y) points
        backgroundColor: "rgba(75, 192, 192, 0.6)", // Point color
        borderColor: "rgba(75, 192, 192, 1)", // Optional: Line color
        showLine: true, // Show connecting lines
        tension: 0.3, // Optional: Line smoothness
      },
      {
        label: "Cross section WL", // Second scatter plot
        data: CSWaterLevel?.x ? CSWaterLevel.x.map((x, i) => ({x: x, y: CSWaterLevel.y[i]})) : [], // Map s and z to (x, y) points
        backgroundColor: "rgba(255, 99, 132, 0.6)", // Point color
        borderColor: "rgba(255, 99, 132, 1)", // Optional: Line color
        showLine: true, // Show connecting lines
        tension: 0.3, // Optional: Line smoothness
      },
      {
        label: "AOI", // New polygon dataset
        type: "line",
        data: polygonData,
        backgroundColor: "rgba(153, 102, 255, 0.5)", // Polygon fill color
        borderColor: "rgba(153, 102, 255, 1)", // Polygon edge color
        showLine: true, // Connect the points to form the polygon
        fill: "stack", // Fill the inside of the polygon
        tension: 0,
      },
      {
        label: "control points",
        data: gcpPoints,
        backgroundColor: "rgba(255, 255, 255, 0.6)",
        borderColor: gcpPoints.map((_, index) => {
          return rainbowColors[(index) % rainbowColors.length]
        }),
        pointRadius: 8,
        pointBorderWidth: 2,
        pointStyle: "circle",
        tension: 0,
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: function (tooltipItem) {
              // console.log(tooltipItem);
              return `Point ${tooltipItem.dataIndex + 1}\n x: ${tooltipItem.parsed.x.toFixed(2)} y: ${tooltipItem.parsed.y.toFixed(2)}`;
            },
          }
        },


      }

    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: {
        title: {
          display: true,
          text: 'easting (m)'
        },
        ticks: {
          // ensure not more than 2 decimal digits
          callback: function (value) {
            return Number(value).toFixed(2);
          }
        }
      },
      y: {
        title: {
          display: true,
          text: 'northing (m)'
        },

        ticks: {
          callback: function (value) {
            return Number(value).toFixed(2);
          }
        }
      }
    },
    plugins: {
      legend: {
        display: true,
      },

    },

  }
  return (
    <div style={{ minHeight: "200px", height: "100%" }}>
      <Scatter
        key={Math.random()}
        data={data}
        options={options}
      />
    </div>
  )
  // },
  // maintainAspectRatio: false,
  // aspectRatio: 0.75,
}

TopView.propTypes = {
  CSDischarge: PropTypes.shape({
    s: PropTypes.arrayOf(PropTypes.number).isRequired,
    z: PropTypes.arrayOf(PropTypes.number).isRequired
  }).isRequired,
  CSWaterLevel: PropTypes.any, // Update based on the actual usage of CSWaterLevel
  bBox: PropTypes.arrayOf(
    PropTypes.arrayOf(PropTypes.number)
  ).isRequired, // array of [x, y] coordinates

};
export default TopView;
