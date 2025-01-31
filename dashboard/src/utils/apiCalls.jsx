export const fitGcps = async (api, widgets, imgDims, epsgCode, setWidgets, setMessageInfo) => {

  // // temporary test function;
  // const updateWidgets = () => {
  //   setWidgets((prevWidgets) =>
  //     prevWidgets.map((widget) => ({
  //       ...widget,
  //       fit: {"row": 1075, "col": 1915},
  //     }))
  //   );
  // };
  try {
    // Checks!
    if (widgets.length < 0) {
      const msg = `Too few GCPs (${widgets.length} / 6)`
      setMessageInfo('error', msg);
//      throw new Error(msg);
    }

    // Extract coordinates into separated lists
    const dst = widgets.map(({ coordinates }) => [
      parseFloat(coordinates.x) || null,
      parseFloat(coordinates.y) || null,
      parseFloat(coordinates.z) || null
    ]);

    const src = widgets.map(({ coordinates }) => [
      parseFloat(coordinates.col, 10) || null,
      parseFloat(coordinates.row, 10) || null,
    ]);
    // check if dst contains null
    if (dst.some(row => row.includes(null))) {
      setMessageInfo('error', 'GCP real-world coordinates are not complete. Ensure the coordinates are entered correctly and try again.');
    }

    // check if src contains null values
    if (src.some(row => row.includes(null))) {
      setMessageInfo('error', 'GCPs must have valid row and column coordinates. Please click the GCPs into the image frame to fix this.');
      return;
    }

    const payload = {
      "src": src,
      "dst": dst,
      "height": imgDims.height,
      "width": imgDims.width,
      "crs": epsgCode.toString()
    };

    console.log('Sending payload:', payload);
    // Send data to API endpoint
    const response = await api.post('/camera_config/fit_perspective', payload);
    // Extract `src_est` and `dst_est` from API response
    const { src_est, dst_est, error } = response.data;
    // Map the fitted coordinates back to the widgets
    setWidgets((prevWidgets) =>
      prevWidgets.map((widget, index) => {
        return {
          ...widget,
          fit: {
            row: src_est ? src_est[index][1] : null, // row from src_est
            col: src_est ? src_est[index][0] : null, // col from src_est
            x: dst_est ? dst_est[index][0] : null,  // x from dst_est
            y: dst_est ? dst_est[index][1] : null,  // y from dst_est
            z: dst_est ? dst_est[index][2] : null,  // z from dst_est
          }
        };
      })
    );
    const err_round = Math.round(error * 1000) / 1000;
    if (err_round > 0.1) {
      setMessageInfo('warning', `GCPs successfully fitted, but with a large average error: ${err_round} m.`);
      return;}
    setMessageInfo('success', `GCPs successfully fitted to image, average error: ${err_round} m.`);
    // map the estimated points on the widgets for plotting
    // updateWidgets();

  } catch (error) {
    setMessageInfo('error', 'Failed to send coordinates:' + error.response.data.detail);
    // Optionally, handle errors (e.g., display an error message)
  }
};
