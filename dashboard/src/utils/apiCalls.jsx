export const fitGcps = async (api, widgets, setWidgets, setMessageInfo) => {

  // temporary test function;
  const updateWidgets = () => {
    setWidgets((prevWidgets) =>
      prevWidgets.map((widget) => ({
        ...widget,
        fit: {"row": 1075, "col": 1915},
      }))
    );
  };
  try {
    // Checks!
    if (widgets.length < 0) {
      const msg = `Too few GCPs (${widgets.length} / 6)`
      setMessageInfo('error', msg);
//      throw new Error(msg);
    }

    // Extract coordinates into separated lists
    const src = widgets.map(({ coordinates }) => [
      parseFloat(coordinates.x) || 0,
      parseFloat(coordinates.y) || 0,
      coordinates.z === '' || isNaN(Number(coordinates.z)) ? NaN : parseFloat(coordinates.z)
    ]);

    const dst = widgets.map(({ coordinates }) => [
      parseFloat(coordinates.row, 10) || 0,
      parseFloat(coordinates.col, 10) || 0,
    ]);

    const payload = {
      "src": src,
      "dst": dst,
    };

    console.log('Sending payload:', payload);
    updateWidgets();
    console.log(widgets);
//    // Send data to API endpoint
//    const response = await api.post('https://api.example.com/endpoint', payload);
//    console.log('API Response:', response.data);

  } catch (error) {
    console.error('Failed to send coordinates:', error);
    // Optionally, handle errors (e.g., display an error message)
  }
};
