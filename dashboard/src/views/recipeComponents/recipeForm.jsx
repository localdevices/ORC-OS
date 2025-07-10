import api from "../../api.js";
import {useEffect, useState} from "react";
import ReactSlider from 'react-slider';
import PropTypes from "prop-types";
import '../cameraAim.scss'
import './recipeComponents.css'

const RecipeForm = ({selectedRecipe, setSelectedRecipe, frameCount, setMessageInfo, CSWaterLevel, CSDischarge}) => {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
    start_frame: '',
    end_frame: '',
    freq: '',
    resolution: '',
    data: ''
  });
  const [showJsonData, setShowJsonData] = useState(false);
  const roughnessValues = [
    {name: "Obstructions", value: "0.50"},
    {name: "Very rough and shallow", value: "0.60"},
    {name: "Some boulders shallow", value: "0.65"},
    {name: "Rocks and pebbles shallow", value: "0.75"},
    {name: "Sandy some ripples shallow", value: "0.80"},
    {name: "Smooth e.g. concrete deep", value: "0.85"},
    {name: "Very smooth concrete deep", value: "0.90"},
  ]

  useEffect(() => {
    if (selectedRecipe) {
      setFormData({
        name: selectedRecipe.name || '',
        id: selectedRecipe.id || '',
        start_frame: selectedRecipe.start_frame,
        end_frame: selectedRecipe.end_frame || '',
        freq: selectedRecipe.freq || '',
        resolution: selectedRecipe.resolution || '',
        data: JSON.stringify(selectedRecipe.data, null, 4) || '',
        alpha: selectedRecipe.alpha,
        quiver_scale_grid: selectedRecipe.quiver_scale_grid,
        quiver_scale_cs: selectedRecipe.quiver_scale_cs,
        quiver_width_grid: selectedRecipe.quiver_width_grid,
        quiver_width_cs: selectedRecipe.quiver_width_cs,
        min_z: selectedRecipe.min_z,
        max_z: selectedRecipe.max_z,
        wl_preprocess: selectedRecipe.wl_preprocess,
        wl_get_frames_method: selectedRecipe.wl_get_frames_method,
        padding: selectedRecipe.padding,
        length: selectedRecipe.length,
        bank: selectedRecipe.bank

      });
    } else {
      setFormData({
        name: '',
        id: '',
        start_frame: '',
        end_frame: '',
        freq: '',
        resolution: '',
        alpha: '',
        quiver_scale_grid: '',
        quiver_scale_cs: '',
        quiver_width_grid: '',
        quiver_width_cs: '',
        min_z: '',
        max_z: '',
        wl_preprocess: '',
        wl_get_frames_method: '',
        padding: '',
        length: '',
        bank: '',
        data: '',
      })
    }
  }, [selectedRecipe]);

  // Utility function to safely parse JSON
  const safelyParseJSON = (jsonString) => {
    try {
      return JSON.parse(jsonString); // Parse if valid JSON string
    } catch (error) {
      console.warn("Invalid JSON string:", error);
      return jsonString; // Fallback: Leave it as the original string
    }
  };

  const renderAlphaValue = (value) => {
    for (let i = 0; i < roughnessValues.length - 1; i++) {
      const currentValue = parseFloat(roughnessValues[i].value);
      const nextValue = parseFloat(roughnessValues[i + 1].value);
      if (value >= currentValue && value < nextValue) {
        return `${value}: ${roughnessValues[i].name}`;
      }
    }
    // Handle the last value range
    if (value >= parseFloat(roughnessValues[roughnessValues.length - 1].value)) {
      return `${value}: ${roughnessValues[roughnessValues.length - 1].name}`;
    }
    // Handle values below the first range
    if (value < parseFloat(roughnessValues[0].value)) {
      return `${value}: ${roughnessValues[0].name}`;
    }
  }

  const loadModal = async () => {
    console.log("load modal");
    const input = document.createElement('input');
    input.type = "file";
    input.accept = ".yml";
    // Wait for the user to select a file
    input.addEventListener('change', async (event) => {
      const file = event.target.files[0]; // Get the selected file
      if (file) {
        const formData = new FormData(); // Prepare form data for file upload
        formData.append("file", file);

        try {
          const response = await api.post(
            '/recipe/from_file/',
            formData,
            {headers: {"Content-Type": "multipart/form-data",},}
          );
          // set the recipe to the returned recipe
          setSelectedRecipe(response.data);
        } catch (error) {
          console.error("Error occurred during file upload:", error);
        }
      }
    });
    // trigger input dialog box to open
    input.click();
  }

  const submitData = (formData) => {
    return {
      id: formData.id || null,
      name: formData.name,
      data: safelyParseJSON(formData.data),
      start_frame: formData.start_frame,
      end_frame: formData.end_frame,
      freq: formData.freq,
      resolution: formData.resolution,
      alpha: formData.alpha,
      quiver_scale_grid: formData.quiver_scale_grid,
      quiver_scale_cs: formData.quiver_scale_cs,
      quiver_width_grid: formData.quiver_width_grid,
      quiver_width_cs: formData.quiver_width_cs,
      min_z: formData.min_z,
      max_z: formData.max_z,
      wl_preprocess: formData.wl_preprocess,
      wl_get_frames_method: formData.wl_get_frames_method,
      padding: formData.padding,
      length: formData.length,
      bank: formData.bank
    }
  }

  const handleInputChange = async (event) => {
    const {name, value, type} = event.target;
    const updatedFormData = {
      ...formData,
      [name]: name === "resolution" ? parseFloat(value) : (type === "number" ? parseInt(value) : value)
    }
    setFormData(updatedFormData);
    try {
      const response = await api.post('/recipe/update/', submitData(updatedFormData));
      setSelectedRecipe(response.data);
    } catch (error) {
      console.error('Error updating recipe:', error);
    }
  }

  const handleInputLiteralChange = async (event) => {

    const {name, value, type} = event.target;
    const updatedFormData = {
      ...formData,
      [name]: value === "" ? null : value
    }
    setFormData(updatedFormData);
    console.log(submitData(updatedFormData));
    try {
      const response = await api.post('/recipe/update/', submitData(updatedFormData));
      setSelectedRecipe(response.data);
    } catch (error) {
      console.error('Error updating recipe:', error);
    }
  }

  const handleFrameChange = async (values) => {
    const minimumDifference = 10;
    let [startValue, endValue] = values;

    // Ensure values are at least `minimumDifference` apart
    if (endValue - startValue < minimumDifference) {
      if (frameCount >= minimumDifference) {
        if (startValue + minimumDifference <= frameCount) {
          endValue = startValue + minimumDifference;
        } else {
          startValue = endValue - minimumDifference;
        }
      } else {
        startValue = 0
        endValue = frameCount;
      }
    }
    const updatedFormData = {
      ...formData,
      start_frame: startValue,
      end_frame: endValue
    }
    setFormData(updatedFormData);
    try {
      const response = await api.post('/recipe/update/', submitData(updatedFormData));
      setSelectedRecipe(response.data);
    } catch (error) {
      console.error('Error updating recipe:', error);
    }
  }

  const handleWaterLevelMinMaxChange = async (values) => {
    const minimumDifference = 0.2;
    let [minValue, maxValue] = values;

    // Ensure values are at least `minimumDifference` apart
    if (maxValue - minValue < minimumDifference) {
      if (Math.max(...CSWaterLevel?.z) - Math.min(...CSWaterLevel?.z) >= minimumDifference) {
        if (minValue + minimumDifference <= Math.max(...CSWaterLevel?.z)) {
          maxValue = minValue + minimumDifference;
        } else {
          minValue = maxValue - minimumDifference;
        }
      } else {
        minValue = Math.min(...CSWaterLevel?.z)
        maxValue = Math.max(...CSWaterLevel?.z);
      }
    }
    const updatedFormData = {
      ...formData,
      min_z: minValue,
      max_z: maxValue
    }
    setFormData(updatedFormData);
    try {
      const response = await api.post('/recipe/update/', submitData(updatedFormData));
      setSelectedRecipe(response.data);
    } catch (error) {
      console.error('Error updating recipe:', error);
    }
  }

  const handleSliderChange = async (name, value) => {
    // Ensure values are at least `minimumDifference` apart
    const updatedFormData = {
      ...formData,
      [name]: value,
    }
    setFormData(updatedFormData);

    try {
      const response = await api.post('/recipe/update/', submitData(updatedFormData));
      setSelectedRecipe(response.data);
    } catch (error) {
      console.error('Error updating recipe:', error);
    }
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    // Dynamically filter only fields with non-empty values
    const filteredData = Object.fromEntries(
      Object.entries(formData).filter(([key, value]) => value !== '' && value !== null)
    );
    // predefine response object
    let response;
    try {
      console.log(submitData(filteredData));

      if (filteredData.id === undefined) {
        response = await api.post('/recipe/', submitData(filteredData));
      } else {
        response = await api.patch(`/recipe/${filteredData.id}`, submitData(filteredData));
      }
      console.log(response);
      if (response.status !== 201 && response.status !== 200) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
      }
      // reload page
      window.location.reload();
      setSelectedRecipe({})
      // set the form data to new device settings
      setFormData({
        name: '',
        id: '',
        start_frame: '',
        end_frame: '',
        freq: '',
        resolution: '',
        data: ''
      });
      setMessageInfo('success', 'Recipe stored successfully');
    } catch (err) {
      setMessageInfo('Error while storing recipe', err.response.data);
    }
  };


  return (
    <div style={{"padding": "5px"}}>
      <button
        className="btn"
        onClick={loadModal}
      >
        Upload from .yml
      </button>
      <div style={{"padding": "5px"}}>
        <form onSubmit={handleFormSubmit}>
          <div className='mb-3 mt-3' style={{display: 'none'}}>
            <label htmlFor='id' className='form-label'>
              Recipe ID
            </label>
            <input type='str' className='form-control' id='id' name='id' value={formData.id} disabled/>
          </div>
          <div className='mb-3 mt-3' style={{display: 'none'}}>
            <label htmlFor='name' className='form-label'>
              Name of recipe
            </label>
            <input type='str' className='form-control' id='name' name='name' onChange={handleInputChange}
                   value={formData.name} required/>
          </div>
          <h5>Video settings</h5>
          <div className="mb-3 mt-3 form-horizontal">
            <label htmlFor="start_end_slider" className="form-label">
              Start and end frame [-]
            </label>
            <div className="slider-container">
              <div className="slider-min">{formData.start_frame || 0}</div>
              <div className="slider-max">Slide to max. to extend {Math.floor((frameCount + formData.end_frame) / frameCount) * frameCount}</div>
              <ReactSlider
              className="horizontal-slider small"
              thumbClassName="thumb"
              trackClassName="track"
              value={[formData.start_frame || 0, formData.end_frame || frameCount]} // Default values if unset
              min={0}
              max={Math.floor((frameCount + formData.end_frame) / frameCount) * frameCount}
              // max={Math.max(frameCount, formData.end_frame + 2)}
              step={1}
              renderThumb={(props, state) => (
                <div {...props}>
                  <div className="thumb-value">{state.valueNow}</div>
                </div>
              )}
              onAfterChange={handleFrameChange}
            />
            </div>
          </div>
          <div className='mb-3 mt-3 form-horizontal'>
            <label htmlFor='freq' className='form-label'>
              Resample frame distance [-]
            </label>
            <input type='number' className='form-control' id='freq' name='freq' step="1" min='1' max='4'
                   onChange={handleInputChange} value={formData.freq} required/>
          </div>
          <div className='mb-3 mt-3 form-horizontal'>
            <label htmlFor='resolution' className='form-label'>
              Resolution [m]
            </label>
            <input type='number' className='form-control' id='resolution' name='resolution' step="0.001" min='0.001'
                   max='0.05' onChange={handleInputChange} value={formData.resolution} required/>
          </div>
          <hr></hr>
          <h5>Optical water level</h5>

          {CSWaterLevel && Object.keys(CSWaterLevel).length > 0 ? (
            <div>
              <div className="mb-3 mt-3 form-horizontal">
                <label htmlFor="water_level_min_max" className="form-label">
                  Minimum and maximum water level [m]
                </label>
                <div className="slider-container">
                  <div className="slider-min">{Math.min(...CSWaterLevel?.z)}</div>
                  <div className="slider-max">{Math.max(...CSWaterLevel?.z)}</div>

                  <ReactSlider
                  className="horizontal-slider"
                  thumbClassName="thumb"
                  trackClassName="track"
                  value={[formData.min_z || Math.min(...CSWaterLevel?.z), formData.max_z || Math.max(...CSWaterLevel?.z)]} // Default values if unset
                  min={Math.min(...CSWaterLevel.z) || 0}
                  max={Math.max(...CSWaterLevel.z) || 1}
                  step={0.001}
                  renderThumb={(props, state) => (
                    <div {...props}>
                      <div className="thumb-value">{state.valueNow}</div>
                    </div>
                  )}
                  onChange={handleWaterLevelMinMaxChange}
                />
                </div>
              </div>
              <div className="mb-3 mt-3 form-horizontal">
                <label htmlFor="padding" className="form-label">
                  Land in/outward distance to measure intensity differences on [m]
                </label>
                <ReactSlider
                  className="horizontal-slider"
                  thumbClassName="thumb"
                  trackClassName="track"
                  value={formData.padding || 0.5} // Default values if unset
                  min={0.1}
                  max={5}
                  step={0.05}
                  renderThumb={(props, state) => (
                    <div {...props}>
                      <div className="thumb-value">{state.valueNow}</div>
                    </div>
                  )}
                  onChange={(value) => {
                    handleSliderChange("padding", value)
                  }}
                />
              </div>
              <div className="mb-3 mt-3 form-horizontal">
                <label htmlFor="rectangle_length" className="form-label">
                  Size of element to measure water level on [m]
                </label>
                <ReactSlider
                  className="horizontal-slider"
                  thumbClassName="thumb"
                  trackClassName="track"
                  value={formData.length || 3} // Default values if unset
                  min={0.1}
                  max={15}
                  step={0.05}
                  renderThumb={(props, state) => (
                    <div {...props}>
                      <div className="thumb-value">{state.valueNow}</div>
                    </div>
                  )}
                  onChange={(value) => {
                    handleSliderChange("length", value)
                  }}
                />
              </div>
              <div className="mb-3 mt-3 form-horizontal" onChange={handleInputLiteralChange}>
                <label htmlFor="bank" className="form-label">
                  Best visible bank for detection (if in doubt, select far)
                </label>
                {/*<div onChange={(e) => setFrameExtractionMethod(e.target.value)}>*/}
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="bank"
                    id="far"
                    value="far"
                    checked={formData.bank === "far"}
                  />
                  <label className="form-check-label" htmlFor="grayscale">
                    Far bank
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="bank"
                    id="near"
                    value="near"
                    checked={formData.bank === "near"}
                  />
                  <label className="form-check-label" htmlFor="hue">
                    Near bank
                  </label>
                </div>
              </div>
              <div className="mb-3 mt-3 form-horizontal" onChange={handleInputLiteralChange}>
                <label htmlFor="wl_get_frames_method" className="form-label">
                  Frame extraction method for water level
                </label>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="wl_get_frames_method"
                    id="grayscale"
                    value="grayscale"
                    checked={formData.wl_get_frames_method === "grayscale"}
                  />
                  <label className="form-check-label" htmlFor="grayscale">
                    Grayscale
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="wl_get_frames_method"
                    id="hue"
                    value="hue"
                    checked={formData.wl_get_frames_method === "hue"}
                  />
                  <label className="form-check-label" htmlFor="hue">
                    Color differences
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="wl_get_frames_method"
                    id="sat"
                    value="sat"
                    checked={formData.wl_get_frames_method === "sat"}
                  />
                  <label className="form-check-label" htmlFor="sat">
                    Saturation level
                  </label>
                </div>

              </div>
              <div className="mb-3 mt-3 form-horizontal" onChange={handleInputLiteralChange}>
                <label htmlFor="wl_preprocess" className="form-label">
                  Preprocess frames
                </label>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="wl_preprocess"
                    id="none"
                    value=""
                    checked={formData.wl_preprocess === null}
                  />
                  <label className="form-check-label" htmlFor="none">
                    None
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="wl_preprocess"
                    id="range"
                    value="range"
                    checked={formData.wl_preprocess === "range"}
                  />
                  <label className="form-check-label" htmlFor="range">
                    time-range intensity
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-3 mt-3 form-horizontal">
              <div role="alert" style={{color: "red", fontStyle: "italic"}}>
                A cross section for optical water level estimation must be selected before setting specific parameters.
              </div>
            </div>
          )
          }
          <hr></hr>
          <h5>Discharge estimation</h5>
          <div className="mb-3 mt-3 form-horizontal">
            {CSDischarge && Object.keys(CSDischarge).length > 0 ? (
              <>
                <label htmlFor="roughness" className="form-label">
                  Velocity index (alpha) [-]
                </label>
                <ReactSlider
                  className="horizontal-slider"
                  thumbClassName="thumb"
                  trackClassName="track"
                  value={formData.alpha || 0.85} // Default values if unset
                  min={0.5}
                  max={0.95}
                  step={0.01}
                  renderThumb={(props, state) => (
                    <div {...props}>
                      <div className="thumb-value">{renderAlphaValue(state.valueNow)}</div>
                    </div>
                  )}
                  onChange={(value) => {
                    handleSliderChange("alpha", value)
                  }}
                />
              </>
            ) : (<div role="alert" style={{color: "red", fontStyle: "italic"}}>
                A cross section for discharge estimation must be selected before setting specific parameters.
              </div>
            )}
          </div>
          <hr></hr>
          <h5>Plotting</h5>
          <div className="mb-3 mt-3 form-horizontal">
            <label htmlFor="quiver_scale_grid" className="form-label">
              grid arrow scale [-]
            </label>
            <ReactSlider
              className="horizontal-slider"
              thumbClassName="thumb"
              trackClassName="track"
              value={formData.quiver_scale_grid || 1} // Default values if unset
              min={0.2}
              max={2}
              step={0.1}
              renderThumb={(props, state) => (
                <div {...props}>
                  <div className="thumb-value">{state.valueNow}</div>
                </div>
              )}
              onChange={(value) => {
                handleSliderChange("quiver_scale_grid", value)
              }}
            />
          </div>
          <div className="mb-3 mt-3 form-horizontal">
            <label htmlFor="quiver_scale_cs" className="form-label">
              cross section arrow scale [-]
            </label>
            <ReactSlider
              className="horizontal-slider"
              thumbClassName="thumb"
              trackClassName="track"
              value={formData.quiver_scale_cs || 1}
              min={0.2}
              max={2}
              step={0.1}
              renderThumb={(props, state) => (
                <div {...props}>
                  <div className="thumb-value">{state.valueNow}</div>
                </div>
              )}
              onChange={(value) => {
                handleSliderChange("quiver_scale_cs", value)
              }}
            />
          </div>
          <div className="mb-3 mt-3 form-horizontal">
            <label htmlFor="quiver_width_grid" className="form-label">
              grid arrow width [-]
            </label>
            <ReactSlider
              className="horizontal-slider"
              thumbClassName="thumb"
              trackClassName="track"
              value={formData.quiver_width_grid || 1}
              min={0.2}
              max={2}
              step={0.1}
              renderThumb={(props, state) => (
                <div {...props}>
                  <div className="thumb-value">{state.valueNow}</div>
                </div>
              )}
              onChange={(value) => {
                handleSliderChange("quiver_width_grid", value)
              }}
            />
          </div>
          <div className="mb-3 mt-3 form-horizontal">
            <label htmlFor="quiver_width_cs" className="form-label">
              Cross section arrow width [-]
            </label>
            {/*<div className="button-container" style={{margin: '20px'}}>*/}
            <ReactSlider
              className="horizontal-slider"
              thumbClassName="thumb"
              trackClassName="track"
              value={formData.quiver_width_cs || 1}
              min={0.2}
              max={2}
              step={0.1}
              renderThumb={(props, state) => (
                <div {...props}>
                  <div className="thumb-value">{state.valueNow}</div>
                </div>
              )}
              onChange={(value) => {
                handleSliderChange("quiver_width_cs", value)
              }}
            />
          </div>
          <hr></hr>
          <h5>Expert users</h5>
          <div className='mb-3 mt-3'>Toggle JSON view for inspection
            <div className="form-check form-switch">
              <label className="form-label" htmlFor="toggleJson" style={{marginLeft: '0'}}></label>
              <input
                style={{width: "40px", height: "20px", borderRadius: "15px"}}
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="toggleJson"
                onClick={() => setShowJsonData(!showJsonData)}
              />
            </div>
          </div>

          {showJsonData && (
            <div className="mb-3">
              <label htmlFor="data" className="form-label">JSON Data</label>
              <textarea
                id="data"
                className="form-control"
                rows="40"
                value={formData.data}
                onChange={handleInputChange}
              ></textarea>
            </div>
          )}
          <div>
          </div>

        </form>
      </div>
    </div>

  )

};
RecipeForm.propTypes = {
  selectedRecipe: PropTypes.object,
  setSelectedRecipe: PropTypes.func.isRequired,
  frameCount: PropTypes.number.isRequired,
  setMessageInfo: PropTypes.func.isRequired,
  CSWaterLevel: PropTypes.object,
  CSDischarge: PropTypes.object
};

export default RecipeForm;
