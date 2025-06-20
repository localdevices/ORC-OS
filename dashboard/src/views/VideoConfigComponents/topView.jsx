import {rainbowColors} from "../../utils/helpers.jsx";
import {Line, Scatter, Chart } from 'react-chartjs-2';
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
    const controlPointsDatasetIndex = data.datasets.findIndex(
      dataset => dataset.label === "control points"
    );
    if (controlPointsDatasetIndex !== -1) {

    // data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(controlPointsDatasetIndex);
      meta.data.forEach((element, index) => {
        // Get the data value
        const value = index + 1; // Index + 1 as the label
        const position = element.tooltipPosition(); // Position of the point
        // console.log(position);
        // Draw the text
        ctx.font = '12px sans-serif'; // Set font style
        ctx.textAlign = 'center'; // Align text at the center of the point
        ctx.textBaseline = 'middle'; // Align text vertically at the center
        ctx.fillStyle = 'black'; // Set text color
        ctx.fillText(value, position.x, position.y); // Draw above the point (adjust y as needed)
      });
    };
  },
};

const cameraIconPlugin = {
  id: "cameraIconPlugin",
  afterDatasetsDraw(chart, args, options) {
    const { ctx } = chart;
    const cameraDataset = chart.data.datasets.find(dataset => dataset.label === "Camera Position");

    if (cameraDataset && cameraDataset.data.length > 0) {
      const meta = chart.getDatasetMeta(chart.data.datasets.indexOf(cameraDataset));
      const cameraPoint = meta.data[0]; // The single point representing the camera position

      if (cameraPoint) {
        const { x, y } = cameraPoint.getProps(["x", "y"]); // Camera's position
        const cameraSize = 30;  // Size of the camera body
        const lensRadius = 10;  // Lens radius
        const directionLength = 20; // Direction triangle length
        const rotationAngle = options.rotation - 0.5 * Math.PI || 0;
        // Helper function to calculate rotated coordinates
        const calculateRotatedPoint = (xOffset, yOffset) => {
          return {
            x: x + xOffset * Math.cos(rotationAngle) - yOffset * Math.sin(rotationAngle),
            y: y + xOffset * Math.sin(rotationAngle) + yOffset * Math.cos(rotationAngle),
          };
        };

        // Calculate the corners of the camera's body (rectangle)
        const topLeft = calculateRotatedPoint(-cameraSize / 2, -cameraSize / 4);
        const topRight = calculateRotatedPoint(cameraSize / 2, -cameraSize / 4);
        const bottomLeft = calculateRotatedPoint(-cameraSize / 2, cameraSize / 4);
        const bottomRight = calculateRotatedPoint(cameraSize / 2, cameraSize / 4);

        // Draw the camera body as a rotated rectangle
        ctx.beginPath();
        ctx.fillStyle = "black";
        ctx.moveTo(topLeft.x, topLeft.y);
        ctx.lineTo(topRight.x, topRight.y);
        ctx.lineTo(bottomRight.x, bottomRight.y);
        ctx.lineTo(bottomLeft.x, bottomLeft.y);
        ctx.closePath();
        ctx.fill();

        // Calculate the center of the lens
        const lensCenter = calculateRotatedPoint(0, 0);

        // Draw the lens as a circle
        ctx.beginPath();
        ctx.fillStyle = "blue";
        ctx.arc(lensCenter.x, lensCenter.y, lensRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Draw the directional indicator (triangle pointing forward)
        const tip = calculateRotatedPoint(cameraSize / 2 + directionLength, 0); // Triangle tip
        const baseLeft = calculateRotatedPoint(cameraSize / 2, -cameraSize / 8); // Triangle base left
        const baseRight = calculateRotatedPoint(cameraSize / 2, cameraSize / 8); // Triangle base right

        ctx.beginPath();
        ctx.fillStyle = "red";
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(baseLeft.x, baseLeft.y);
        ctx.lineTo(baseRight.x, baseRight.y);
        ctx.closePath();
        ctx.fill();
      }



    }
  },
};

// Register the plugins
ChartJS.register(pointIndexPlugin);
ChartJS.register(cameraIconPlugin);


const TopView = ({CSDischarge, CSWaterLevel, Gcps, cameraPosition, rotation, bBox}) => {
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
        type: "line",
        data: CSDischarge?.x ? CSDischarge.x.map((x, i) => ({x: x, y: CSDischarge.y[i]})) : [], // Map s and z to (x, y) points
        backgroundColor: "rgba(75, 192, 192, 0.6)", // Point color
        borderColor: "rgba(75, 192, 192, 1)", // Optional: Line color
        showLine: true, // Show connecting lines
        tension: 0.3, // Optional: Line smoothness
      },
      {
        label: "Cross section WL", // Second scatter plot
        type: "line",
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
        backgroundColor: "rgb(122,184,255)", // Polygon fill color
        borderColor: "rgb(122,184,255)", // Polygon edge color
        showLine: true, // Connect the points to form the polygon
        fill: true, // Fill the inside of the polygon
        tension: 0,
      },
      {
        label: "control points",
        type: "scatter",
        data: gcpPoints,
        backgroundColor: "rgba(200, 200, 200, 0.6)",
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


      },
      {
        label: "Camera Position",
        type: "scatter", // Scatter for controlling the (x, y) position
        data: cameraPosition ? [{ x: cameraPosition[0], y: cameraPosition[1] }] : [], // Single camera position
        backgroundColor: "rgba(0, 0, 0, 0)", // Transparent so it doesn't show default points
        borderColor: "transparent",         // No border
        pointRadius: 0,                     // No visible radius
      }


    ],
  };

  const options = {
    // responsive: true,
    aspectRatio: 1,
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
            return Number(value).toFixed(1);
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
            return Number(value).toFixed(1);
          }
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          filter: (item) => item.text !== "Camera Position",
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: false,
        },
        display: true,
      },
      cameraIconPlugin: {
        rotation: rotation || 0,
      }

    },

  }
  return (
    <div style={{ minHeight: "200px", overflowY: "auto"}}>
      <Chart
        type="scatter"
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
