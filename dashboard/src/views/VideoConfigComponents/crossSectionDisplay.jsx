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




const CrossSectionDisplay = ({CSDischarge, CSWaterLevel}) => {

  // const data = {
  //   labels: CSDischarge.s,
  //   datasets: [
  //     {
  //       label: 'Cross Section Profile',
  //       data: CSDischarge.z,
  //       fill: false,
  //       borderColor: 'rgb(75, 192, 192)',
  //       tension: 0.1
  //     }
  //   ]
  //
  // }
  const data = {
  datasets: [
    {
      label: "CSDischarge", // First scatter plot
      data: CSDischarge?.s ? CSDischarge.s.map((s, i) => ({x: s, y: CSDischarge.z[i]})) : [], // Map s and z to (x, y) points
      backgroundColor: "rgba(75, 192, 192, 0.6)", // Point color
      borderColor: "rgba(75, 192, 192, 1)", // Optional: Line color
      showLine: true, // Show connecting lines
      tension: 0.3, // Optional: Line smoothness
    },
    {
      label: "CSWaterLevel", // Second scatter plot
      data: CSWaterLevel?.s ? CSWaterLevel.s.map((s, i) => ({x: s, y: CSWaterLevel.z[i]})) : [], // Map s and z to (x, y) points
      backgroundColor: "rgba(255, 99, 132, 0.6)", // Point color
      borderColor: "rgba(255, 99, 132, 1)", // Optional: Line color
      showLine: true, // Show connecting lines
      tension: 0.3, // Optional: Line smoothness
    },
  ],
};

  const options = {
    responsive: true,
      scales: {
      x: {
        title: {
          display: true,
            text: 'left-right (m)'
        },
        // ticks: {
        //   // ensure not more than 2 decimal digits
        //   callback: function (value) {
        //     return Number(value).toFixed(2);
        //   }
        // }
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
    }
}
  return (
    <>
      <h6>Cross section side view</h6>
      <Scatter
        data={data}
        options={options}
      />
    </>
  )
}

CrossSectionDisplay.propTypes = {
  CSDischarge: PropTypes.shape({
    s: PropTypes.arrayOf(PropTypes.number).isRequired,
    z: PropTypes.arrayOf(PropTypes.number).isRequired
  }).isRequired,
  CSWaterLevel: PropTypes.any // Update based on the actual usage of CSWaterLevel
};
export default CrossSectionDisplay;
