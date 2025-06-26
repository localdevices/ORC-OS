import api from "../../api.js";
import React, {useEffect, useState, useRef} from "react";
import PropTypes from "prop-types";
import '../cameraAim.scss'
import {DropdownMenu} from "../../utils/dropdownMenu.jsx";
import {createCustomMarker} from "../../utils/leafletUtils.js";
import {rainbowColors, areControlPointsEqual} from "../../utils/helpers.jsx";
import XYZWidget from "../calibrationTabs/XyzWidget.jsx";
import {fitGcps} from "../../utils/apiCalls.jsx";

const PoseDetails = (
  {
    cameraConfig,
    widgets,
    selectedWidgetId,
    imgDims,
    updateWidget,
    setCameraConfig,
    setWidgets,
    setSelectedWidgetId,
    setMessageInfo
  }) => {

  const [fileFormData, setFileFormData] = useState({
    file: '',
  });

  useEffect(() => {
    // if file is set, try to load and set it
    if (fileFormData.file) {
      handleSubmit();
      // setFileFormData({})
    }
  }, [fileFormData]);

  const refreshWidgets = () => {
    const controlPoints = cameraConfig?.gcps?.control_points;
    const newWidgets = controlPoints.map((gcp, index) => {
      const color = rainbowColors[(index) % rainbowColors.length];
      return {
        color: color,
        id: index + 1, // Unique ID for widget
        coordinates: {x: gcp.x, y: gcp.y, z: gcp.z, row: gcp.row, col: gcp.col},
      };
    })
    setWidgets(newWidgets);
    // setSelectedWidgetId(nextId);

  }

  useEffect(() => {
    if (cameraConfig?.gcps?.control_points) {
      refreshWidgets();

    }
  }, [cameraConfig?.gcps?.control_points]);


  const addWidget = () => {
    const newConfig = {
      ...cameraConfig,
      gcps: {
        ...cameraConfig.gcps,
        z_0: null,
        h_ref: null,
        control_points: [
          ...(cameraConfig.gcps?.control_points || []),
          { x: '', y: '', z: '', row: '', col: '' }
        ], // reset any pose dependent parameters
        // automatically select the newly created widget for editing
      },
      camera_position: null,
      camera_rotation: null,
      f: null,
      k1: null,
      k2: null,
      bbox_camera: [],
      bbox: []
    }
    setSelectedWidgetId(newConfig.gcps.control_points.length);
    setCameraConfig(newConfig);
    // ensure user can set a new widget when clicking on add gcp
  };

  const deleteWidget = (id) => {
    // remove control point from the list of control points
    const newConfig = {
      ...cameraConfig,
      gcps: {
        ...cameraConfig.gcps,
        control_points: cameraConfig.gcps.control_points.filter((gcp, index) => index + 1 !== id)
      }, // reset any pose dependent parameters
      camera_position: null,
      camera_rotation: null,
      f: null,
      k1: null,
      k2: null,
      bbox_camera: [],
      bbox: []

    }
    setCameraConfig(newConfig);
    setCS
  };


  const handleSubmit = async () => {
    // submit the form with a GCP file (x, y, z csv or geojson)
    // event.preventDefault();
    try {
      const GcpData = await loadFile();

      // Additional steps after successful file load
      // if a crs is found, set it on cameraConfig.gcps.crs
      if (GcpData) {
        const newConfig = {
          ...cameraConfig,
          gcps: GcpData,

        }
        setCameraConfig(newConfig);
      }
      // setDots({})
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

  const handleCrsChange = async (event) => {
    const {value} = event.target;
    const newConfig = {
      ...cameraConfig,
      gcps: {
        ...cameraConfig.gcps,
        crs: !isNaN(value) ? parseInt(value) : value
      }

    }
    setCameraConfig(newConfig);
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
    const newConfig = {
      ...cameraConfig,
      camera_position: GcpFit.camera_position,
      camera_rotation: GcpFit.camera_rotation,
      f: GcpFit.f,
      k1: GcpFit.k1,
      k2: GcpFit.k2,

    }
    setCameraConfig(newConfig);

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
    <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Control points</h5>
        <label htmlFor='addWidget' className='form-label'>
          Add and provide x, y, z control points manually one by one or load points from a GeoJSON or CSV file with x, y, z header
        </label>
        <div>
          <button onClick={addWidget} id="addWidget" className="btn">Add GCP</button>
        </div>
        <form onSubmit={handleSubmit}>
        <div className='mb-3 mt-3'>
          <input type='file' className='form-control' id='file' name='file'
                 accept=".geojson,.csv" onChange={handleFileChange} required/>
        </div>
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
          <input type='number' className='form-control' id='crs' name='crs' onChange={handleCrsChange} value={cameraConfig?.gcps?.crs ? cameraConfig.gcps.crs : ''}/>
        </div>

      </div>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
      </div>

    <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
      <div className="table-responsive">
        <table className="table table-bordered table-sm text-center">
          <thead className="table-dark">
          <tr>
            <th>Select</th>
            <th>Row</th>
            <th>Col</th>
            <th>X</th>
            <th>Y</th>
            <th>Z</th>
            <th>Delete</th>
          </tr>
          </thead>
          <tbody>

          {widgets.map((widget) => (
            // <div key={widget.id} onClick={() =>
            //   setSelectedWidgetId(widget.id)
            // }
            //      style={{
            //        border: selectedWidgetId === widget.id ? `4px solid ${widget.color}` : `1px solid ${widget.color}`,
            //        marginTop: '10px',
            //        // marginBottom: '10px',
            //        // padding: '5px',
            //        color: 'white',
            //        cursor: 'pointer',
            //      }}
            //      >

            <XYZWidget
              key={widget.id}
              id={widget.id}
              coordinates={widget.coordinates}
              onUpdate={(id, coordinates) => updateWidget(id, coordinates)}
              onDelete={() => {deleteWidget(widget.id)}}
              selectedWidgetId={selectedWidgetId}
              setSelectedWidgetId={setSelectedWidgetId}
              rowColor={widget.color}
          />
            // </div>

            ))}
          </tbody>
        </table>
      </div>
      {/*    {widgets.map((widget) => (*/}
      {/*  <div key={widget.id} onClick={() =>*/}
      {/*    setSelectedWidgetId(widget.id)*/}
      {/*  }*/}
      {/*       style={{*/}
      {/*         border: selectedWidgetId === widget.id ? `4px solid ${widget.color}` : `1px solid ${widget.color}`,*/}
      {/*         marginTop: '10px',*/}
      {/*         marginBottom: '10px',*/}
      {/*         padding: '5px',*/}
      {/*         color: 'white',*/}
      {/*         cursor: 'pointer',*/}
      {/*       }}*/}
      {/*  >*/}
      {/*    <XYZWidget*/}
      {/*      id={widget.id}*/}
      {/*      coordinates={widget.coordinates}*/}
      {/*      onUpdate={(id, coordinates) => updateWidget(id, coordinates)}*/}
      {/*      onDelete={() => {*/}
      {/*        deleteWidget(widget.id);*/}
      {/*      }}*/}
      {/*    />*/}
      {/*  </div>*/}
      {/*))}*/}
    </div>
    </div>
  )

};

export default PoseDetails;
