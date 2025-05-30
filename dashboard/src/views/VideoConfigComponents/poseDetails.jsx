import api from "../../api.js";
import {useEffect, useState, useRef} from "react";
import PropTypes from "prop-types";
import '../cameraAim.scss'
import {DropdownMenu} from "../../utils/dropdownMenu.jsx";
import {createCustomMarker} from "../../utils/leafletUtils.js";
import {rainbowColors} from "../../utils/helpers.jsx";
import XYZWidget from "../calibrationTabs/XyzWidget.jsx";
import {fitGcps} from "../../utils/apiCalls.jsx";

const PoseDetails = (
  {
    cameraConfig,
    widgets,
    dots,
    selectedWidgetId,
    imgDims,
    updateWidget,
    setCameraConfig,
    setWidgets,
    setDots,
    setSelectedWidgetId,
    setMessageInfo
  }) => {

  const [fileFormData, setFileFormData] = useState({
    file: '',
  });

  const [nextId, setNextId] = useState(1);  // widget ids increment automatically
  const prevControlPoints = useRef(null);

  useEffect(() => {
    console.log(cameraConfig);
    // only change widgets when control points are really updated
    if (prevControlPoints.current !== cameraConfig?.gcps?.control_points) {
      // set state to new control points for later loops
      const controlPoints = cameraConfig?.gcps?.control_points;
      prevControlPoints.current = controlPoints;
      // create or update widget set
      if (controlPoints) {
        const newWidgets = controlPoints.map((gcp, index) => {
          const color = rainbowColors[(index) % rainbowColors.length];
          return {
            color: color,
            id: index + 1, // Unique ID for widget
            coordinates: {x: gcp.x, y: gcp.y, z: gcp.z, row: gcp.row, col: gcp.col},
            icon: createCustomMarker(color, index + 1)
          };
        })
        setWidgets(newWidgets);
        // ensure user can set a new widget when clicking on add gcp
        setNextId(newWidgets.length + 1);
        // remove all pose information when gcps are altered in any way
        setCameraConfig((prevConfig) => ({
          ...prevConfig,
          camera_position: null,
          camera_rotation: null,
          f: null,
          k1: null,
          k2: null,
        }));
      }
    }
    // }
  }, [cameraConfig]);


  const addWidget = () => {
    setWidgets((prevWidgets) => {
      const color = rainbowColors[(nextId - 1) % rainbowColors.length];
      const newWidget = {
        id: nextId,
        color: color,
        coordinates: { x: '', y: '', z:'', row: '', col: ''},
        icon: createCustomMarker(color, nextId)  // for geographical plotting
      }
      // automatically select the newly created widget for editing
      setSelectedWidgetId(newWidget.id);

      return [
        ...prevWidgets,
        newWidget
      ]
    });
    setNextId((prevId) => prevId + 1); // increment the unique id for the next widget
    // setSelectedWidgetId
  };

  const deleteWidget = (id) => {
    // remove current widget from the list of widgets
    setWidgets((prevWidgets) => prevWidgets.filter((widget) => widget.id !== id));
    // also delete the dot
    setDots((prevDots) => {
      // Copy the previous state object
      const newDots = {...prevDots};
      delete newDots[id];
      return newDots;
    });
  };

  // remove all existing widgets
  const clearWidgets = () => {
    setWidgets([]);
    setDots([]);
    setSelectedWidgetId(null);
  }

  const handleSubmit = async (event) => {
    // submit the form with a GCP file (x, y, z csv or geojson)
    event.preventDefault();
    try {
      const GcpData = await loadFile();
      // Clear existing widgets before adding new ones
      // clearWidgets();

      // Additional steps after successful file load
      console.log("processing control point data...")
      console.log(GcpData);
      // if a crs is found, set it on cameraConfig.gcps.crs
      if (GcpData) {
        setCameraConfig((prevConfig) => ({
          ...prevConfig,
          gcps: GcpData,
        }))
      }
      setDots({})

      // TODO: put the coordinates on the cameraConfig.gcps property
      // Parse coordinates and create new widgets
      // const updatedFormData = {
      //   ...formData,
      //   ["crs"]: GcpData.crs
      // }
      // setFormData(updatedFormData);
      // // formData.crs = GcpData.crs
      // const newWidgets = GcpData.control_points.map((feature, index) => {
      //   const { x, y, z = 0 } = feature; // Defaults Z to 0 if not present
      //   const color = rainbowColors[(index) % rainbowColors.length];
      //   return {
      //     color: color,
      //     id: index + 1, // Unique ID for widget
      //     coordinates: {x, y, z, row: "", col: ""},
      //     icon: createCustomMarker(color, index + 1)
      //   };
      //
      // });
      // setWidgets(newWidgets);
      // setNextId(newWidgets.length + 1);  // ensure the next ID is ready for a new XYZ widget

    } catch (error) {
      console.log("File loading not successful, do nothing...", error);
    }
  }
  const loadFile = async () => {
    // load csv or geojson file with control points
    try {
      try {
        const response = await api.post(
          '/control_points/from_csv/',
          fileFormData,
          {headers: {"Content-Type": "multipart/form-data"}}
        );
        setMessageInfo('success', 'Successfully loaded CSV file');
        return response.data;
      } catch (csvError) {
        try {
          const geoJsonResponse = await api.post(
            '/control_points/from_geojson/',
            fileFormData,
            {headers: {"Content-Type": "multipart/form-data"}}
          );

          setMessageInfo('success', 'Successfully loaded GeoJSON file');
          return geoJsonResponse.data;
        } catch (geoJsonError) {
          throw new Error(`Failed to parse file as CSV (${csvError.response.data.detail}) or as GeoJSON (${geoJsonError.response.data.detail})`);
        }
      }
    } catch (error) {
      console.error("Error occurred during file upload:", error);
      setMessageInfo('error', `Error: ${error.response?.data?.detail || error.message}`);
      throw error;  // error outside this function
    }

  }

  const handleInputChange = async (event) => {
    const {value} = event.target;
    setCameraConfig(prevConfig => ({
      ...prevConfig,
      gcps: {
        ...prevConfig.gcps,
        crs: !isNaN(value) ? parseInt(value) : value
      }
    }));
  }

    const handleFileChange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      setFileFormData({ file });
  }

  const handleFitGcps = async () => {

    const GcpFit = await fitGcps(imgDims, cameraConfig.gcps, setMessageInfo)
    const { src_est, dst_est } = GcpFit;
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
    // set fields in cameraConfig
    setCameraConfig((prevConfig) => ({
      ...prevConfig,
      camera_position: GcpFit.camera_position,
      camera_rotation: GcpFit.camera_rotation,
      f: GcpFit.f,
      k1: GcpFit.k1,
      k2: GcpFit.k2,
    }));

  }
  const validateWidgets = () => {
    // Check there are at least 6 widgets
    if (widgets.length < 6) return false;

    // Check that all required fields are valid for every widget
    return widgets.every(widget => {
      const { row, col, x, y, z } = widget.coordinates;
      return (
        row !== null && row !== '' &&
        col !== null && col !== '' &&
        x !== null && x !== '' &&
        y !== null && y !== '' &&
        z !== null && z !== ''
      );
    });
  };


  return (
    <div className="split-screen" style={{overflow: 'auto'}}>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Control points</h5>
        <label htmlFor='addWidget' className='form-label'>
          You may add control points manually one by one or load points from a GeoJSON or CSV file with x, y, z header
        </label>

        <button onClick={addWidget} id="addWidget" className="btn">Add GCP</button>
        <form onSubmit={handleSubmit}>

        <div className='mb-3 mt-3'>
          <input type='file' className='form-control' id='file' name='file'
                 accept=".geojson,.csv" onChange={handleFileChange} required/>
        </div>
          <button type='submit' className='btn'>
            Load control points
          </button>
        </form>

        <button
          onClick={handleFitGcps}
          className="btn"
          disabled={!validateWidgets()}
        >Validate</button>
        <div className='mb-3 mt-3'>
          <label htmlFor='crs' className='form-label small'>
            Coordinate reference system (only for GPS)
          </label>
          <input type='number' className='form-control' id='crs' name='crs' onChange={handleInputChange} value={cameraConfig?.gcps?.crs ? cameraConfig.gcps.crs : ''}/>
        </div>
      </div>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        {widgets.map((widget) => (
          <div key={widget.id} onClick={() =>
            setSelectedWidgetId(widget.id)
          }
               style={{
                 border: selectedWidgetId === widget.id ? `4px solid ${widget.color}` : `1px solid ${widget.color}`,
                 marginTop: '10px',
                 marginBottom: '10px',
                 padding: '5px',
                 color: 'white',
                 cursor: 'pointer',
               }}
          >
            <XYZWidget
              id={widget.id}
              coordinates={widget.coordinates}
              onUpdate={(id, coordinates) => updateWidget(id, coordinates)}
              onDelete={() => {
                deleteWidget(widget.id);
              }}
            />
          </div>
        ))}
      </div>
    </div>

  )

};

export default PoseDetails;
