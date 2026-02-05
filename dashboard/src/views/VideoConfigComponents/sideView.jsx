import {Scatter} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

import PropTypes from 'prop-types';




const SideView = ({CSDischarge, CSWaterLevel, zMin, zMax, waterLevel, yRightOffset = 0}) => { //recipe, cameraConfig}) => {

  const data = {
  datasets: [
    ...(CSDischarge?.s ? [{
      label: "CS - Discharge", // First scatter plot
      data: CSDischarge?.s ? CSDischarge.s.map((s, i) => ({x: s, y: CSDischarge.z[i]})) : [], // Map s and z to (x, y) points
      backgroundColor: "rgba(0, 192, 192, 0.6)", // Point color
      borderColor: "rgba(0, 192, 192, 0.3)", // Optional: Line color
      showLine: true, // Show connecting lines
      tension: 0, // linear connections
    }] : []),
    ...(CSWaterLevel?.s ? [{
      label: "CS - Water Level", // Second scatter plot
      data: CSWaterLevel?.s ? CSWaterLevel.s.map((s, i) => ({x: s, y: CSWaterLevel.z[i]})) : [], // Map s and z to (x, y) points
      backgroundColor: "rgba(255, 99, 0, 0.6)", // Point color
      borderColor: "rgba(255, 99, 0, 0.6)", // Optional: Line color
      showLine: true, // Show connecting lines
      tension: 0, // linear connection
    }] : []),
    {
      label: "Current level",
      data: CSDischarge?.s && waterLevel ? [
        {x: Math.min(...CSDischarge.s), y: waterLevel},
        {x: Math.max(...CSDischarge.s), y: waterLevel}
      ] : [
      ],
      backgroundColor: "rgba(0,50,200, 0.6)",
      borderDash: [5, 10],
      borderColor: "rgb(0, 50, 200)",
      showLine: true,
      tension: 0,
      borderWidth: 2
    },
    ...(CSWaterLevel?.s ? [{
      label: "Min. optical level",
      data: CSWaterLevel?.s ? (
        zMin ? [
          {x: Math.min(...CSWaterLevel.s), y: zMin},
          {x: Math.max(...CSWaterLevel.s), y: zMin}
        ] : [
          {x: Math.min(...CSWaterLevel.s), y: Math.min(...CSWaterLevel.z)},
          {x: Math.max(...CSWaterLevel.s), y: Math.min(...CSWaterLevel.z)}
        ]
      ) : [
      ],
      backgroundColor: "rgba(146,218,66, 0.6)",
      borderDash: [5, 10],
      borderColor: "rgb(146,218,66)",
      showLine: true,
      tension: 0,
      borderWidth: 2
    }] : []),
    ...(CSWaterLevel?.s ? [{
      label: "Max. optical level",
      data: CSWaterLevel?.s ? (
        zMax ? [
          {x: Math.min(...CSWaterLevel.s), y: zMax},
          {x: Math.max(...CSWaterLevel.s), y: zMax}
        ] : [
          {x: Math.min(...CSWaterLevel.s), y: Math.max(...CSWaterLevel.z)},
          {x: Math.max(...CSWaterLevel.s), y: Math.max(...CSWaterLevel.z)}
        ]
      ) : [

      ],
      backgroundColor: "rgba(218,66,66, 0.6)",
      borderDash: [5, 10],
      borderColor: "rgb(218, 66, 66)",
      showLine: true,
      tension: 0,
      borderWidth: 2
    }] : []),
  ],
};

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: 'left-right (m)'
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
          text: 'Z (m)'
        },

        ticks: {
          callback: function (value) {
            return Number(value).toFixed(2);
          }
        }
      },
      y2: {
        position: 'right',
        grid: {
          drawOnChartArea: false
        },
        afterDataLimits: (scale) => {
          const primary = scale.chart.scales.y;
          if (primary) {
            scale.min = primary.min;
            scale.max = primary.max;
          }
        },
        ticks: {
          callback: function(value) {
            return (Number(value) + yRightOffset).toFixed(2);
          }
        },
        title: {
          display: true,
          text: `Water level (m)`
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          boxWidth: 20,
          boxHeight: 10,
          usePointStyle: false,
        },
        display: true,
      }
    }
  }
  return (
    <div style={{ minHeight: "200px", height: "100%" }}>
    <Scatter
      data={data}
      options={options}
    />
      </div>
  )
  // },
  // maintainAspectRatio: false,
  // aspectRatio: 0.75,
}

SideView.propTypes = {
  CSDischarge: PropTypes.object,
  CSWaterLevel: PropTypes.object,
  zMin: PropTypes.number,
  zMax: PropTypes.number,
  waterLevel: PropTypes.number,
  yRightOffset: PropTypes.number
};
export default SideView;
