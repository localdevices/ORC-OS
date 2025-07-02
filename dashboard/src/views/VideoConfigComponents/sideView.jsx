import {Line, Scatter} from 'react-chartjs-2';
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




const SideView = ({CSDischarge, CSWaterLevel, recipe, cameraConfig}) => {

  const data = {
  datasets: [
    {
      label: "CS - Discharge", // First scatter plot
      data: CSDischarge?.s ? CSDischarge.s.map((s, i) => ({x: s, y: CSDischarge.z[i]})) : [], // Map s and z to (x, y) points
      backgroundColor: "rgba(0, 192, 192, 0.6)", // Point color
      borderColor: "rgba(0, 192, 192, 0.3)", // Optional: Line color
      showLine: true, // Show connecting lines
      tension: 0.3, // Optional: Line smoothness
    },
    {
      label: "CS - Water Level", // Second scatter plot
      data: CSWaterLevel?.s ? CSWaterLevel.s.map((s, i) => ({x: s, y: CSWaterLevel.z[i]})) : [], // Map s and z to (x, y) points
      backgroundColor: "rgba(255, 99, 0, 0.6)", // Point color
      borderColor: "rgba(255, 99, 0, 0.6)", // Optional: Line color
      showLine: true, // Show connecting lines
      tension: 0.3, // Optional: Line smoothness
    },
    {
      label: "Level during survey",
      data: CSDischarge?.s && cameraConfig?.gcps?.z_0 ? [
        {x: Math.min(...CSDischarge.s), y: cameraConfig?.gcps?.z_0},
        {x: Math.max(...CSDischarge.s), y: cameraConfig?.gcps?.z_0}
      ] : [
      ],
      backgroundColor: "rgba(0,50,200, 0.6)",
      borderDash: [5, 10],
      borderColor: "rgb(0, 50, 200)",
      showLine: true,
      tension: 0,
      borderWidth: 2
    },
    {
      label: "Min. optical level",
      data: CSWaterLevel?.s ? (
        recipe?.min_h ? [
          {x: Math.min(...CSWaterLevel.s), y: recipe?.min_h},
          {x: Math.max(...CSWaterLevel.s), y: recipe?.min_h}
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
    },
    {
      label: "Max. optical level",
      data: CSWaterLevel?.s ? (
        recipe?.max_h ? [
          {x: Math.min(...CSWaterLevel.s), y: recipe?.max_h},
          {x: Math.max(...CSWaterLevel.s), y: recipe?.max_h}
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
    },
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
  CSDischarge: PropTypes.shape({
    s: PropTypes.arrayOf(PropTypes.number),
    z: PropTypes.arrayOf(PropTypes.number)
  }).isRequired,
  CSWaterLevel: PropTypes.shape({
    s: PropTypes.arrayOf(PropTypes.number),
    z: PropTypes.arrayOf(PropTypes.number)
  }).isRequired,
  recipe: PropTypes.object,
  cameraConfig: PropTypes.object,
};
export default SideView;
