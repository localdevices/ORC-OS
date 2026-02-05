import api, {useDebouncedWsSender} from "../../api/api.js";
import {safelyParseJSON} from "../../utils/helpers.jsx";
import {useEffect, useState} from "react";
import ReactSlider from 'react-slider';
import PropTypes from "prop-types";
import '../cameraAim.scss'
import './recipeComponents.css'

const RecipeForm = ({selectedRecipe, setSelectedRecipe, frameCount, CSWaterLevel, CSDischarge, ws}) => {
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
  const sendDebouncedMsg = useDebouncedWsSender(ws, 400);

  useEffect(() => {
    if (selectedRecipe) {
      setFormData({
        name: selectedRecipe.name || '',
        id: selectedRecipe.id || '',
        start_frame: selectedRecipe.start_frame,
        end_frame: selectedRecipe.end_frame || '',
        lazy: selectedRecipe.lazy || false,
        freq: selectedRecipe.freq || '',
        resolution: selectedRecipe.resolution || '',
        window_size: selectedRecipe.window_size || '',
        data: JSON.stringify(selectedRecipe.data, null, 4) || '',
        v_distance: selectedRecipe.v_distance,
        alpha: selectedRecipe.alpha,
        quiver_scale_grid: selectedRecipe.quiver_scale_grid,
        quiver_scale_cs: selectedRecipe.quiver_scale_cs,
        quiver_width_grid: selectedRecipe.quiver_width_grid,
        quiver_width_cs: selectedRecipe.quiver_width_cs,
        min_z: selectedRecipe.min_z,
        max_z: selectedRecipe.max_z,
        wl_preprocess: selectedRecipe.wl_preprocess,
        wl_s2n_thres: selectedRecipe.wl_s2n_thres,
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
        window_size: '',
        v_distance: '',
        alpha: '',
        quiver_scale_grid: '',
        quiver_scale_cs: '',
        quiver_width_grid: '',
        quiver_width_cs: '',
        min_z: '',
        max_z: '',
        wl_preprocess: '',
        wl_s2n_thres: '',
        padding: '',
        length: '',
        bank: '',
        data: '',
      })
    }
  }, [selectedRecipe]);

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
          console.log(response);
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

  const updateRecipe = async (updatedFields) => {
    const updatedFormData = {
      ...formData,
      ...updatedFields
    }
    setFormData(updatedFormData);
    // const videoPatch = {video_config: {recipe: updatedFields}};
    const msg = {
      action: "update_video_config",
      op: "update_recipe",
      params: {
        recipe_patch: updatedFields
      }
    }
    sendDebouncedMsg(msg)
  }

  const handleRawDataChange = async (event) => {
    const {value} = event.target;
    const updatedFormData ={
      ...formData,
      data: value
    }
    setFormData(updatedFormData);
    // create a new recipe response based on data
    const msg = {
      action: "update_video_config",
      op: "set_recipe_data",
      params: {
        "data": safelyParseJSON(value)
      }
    }
    sendDebouncedMsg(msg)
  }

  const handleInputChange = async (event) => {
    const {name, value, type} = event.target;
    const parsedValue = name === "resolution" ? parseFloat(value) : (type === "number" ? parseInt(value) : value);
    const updatedFields = {[name]: parsedValue};
    await updateRecipe(updatedFields);
  }

  const handleInputLiteralChange = async (event) => {
    const {name, value} = event.target;
    const parsedValue = value === "" ? null : value
    const updatedFields = {[name]: parsedValue};
    await updateRecipe(updatedFields);
  }

  const handleInputBooleanChange = async (event) => {
    const {name, value} = event.target;
    const booleanValue = value === "true" ? true : value === "false" ? false : null;
    const updatedFields = {[name]: booleanValue};
    await updateRecipe(updatedFields);
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
    const updatedFields = {start_frame: startValue, end_frame: endValue};
    await updateRecipe(updatedFields);
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
    const updatedFields = {min_z: minValue, max_z: maxValue};
    await updateRecipe(updatedFields);
  }

  const handleSliderChange = async (name, value) => {
    // Ensure values are at least `minimumDifference` apart
    const updatedFields = {[name]: value};
    await updateRecipe(updatedFields);
  }

  return (
    <div className='container tab'>
      <h5>Video settings</h5>
      <button
        className="btn"
        onClick={loadModal}
      >
        Upload from .yml
      </button>

      <div style={{"padding": "5px"}}>
        {/*<form onSubmit={handleFormSubmit}>*/}
        <form>
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
          <div className="mb-3 mt-3 form-horizontal" onChange={handleInputBooleanChange}>
            <label htmlFor="lazy" className="form-label">
              Read frames in one go or in smaller chunks?
            </label>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="lazy"
                id="false"
                value="false"
                checked={!formData.lazy}
              />
              <label className="form-check-label" htmlFor="grayscale">
                In one go
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="lazy"
                id="true"
                value="true"
                checked={formData.lazy}
              />
              <label className="form-check-label" htmlFor="hue">
                In chunks (less reliable with some video formats)
              </label>
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
              Pixel resampling size [m]
            </label>
            <input type='number' className='form-control' id='resolution' name='resolution' step="0.001" min='0.001'
                   max='0.05' onChange={handleInputChange} value={formData.resolution} required/>
          </div>
          <div className="mb-3 mt-3 form-horizontal">
            <div role="alert" style={{color: "green", fontStyle: "italic"}}>
              Assuming you record at 30 frames-per-second, 1 px/frame would translate
              to {30 / formData.freq * formData.resolution} m/s. This is probably the minimum bulk velocity you can
              reliably measure. If you likely need to measure lower bulk velocities, consider a smaller pixel
              resampling size (i.e. higher resolution) or a higher resample frame distance.
            </div>
          </div>
          <div className="mb-3 mt-3 form-horizontal">
            <label htmlFor="window_size" className="form-label">
              Interrogation window size [px]
            </label>
            <ReactSlider
              className="horizontal-slider"
              thumbClassName="thumb"
              trackClassName="track"
              value={formData.window_size || 64} // Default values if unset
              min={32}
              max={128}
              step={1}
              renderThumb={(props, state) => (
                <div {...props}>
                  <div className="thumb-value">{state.valueNow}</div>
                </div>
              )}
              onChange={(value) => {
                handleSliderChange("window_size", value)
              }}
            />
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
                <label htmlFor="wl_preprocess" className="form-label">
                  Stream characteristics (determines land/water segmentation strategy)
                </label>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="wl_preprocess"
                    id="manmade"
                    value="manmade"
                    checked={formData.wl_preprocess === "manmade"}
                  />
                  <label className="form-check-label" htmlFor="manmade" style={{width: "100%"}}>
                    Man-made canal
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="wl_preprocess"
                    id="natural"
                    value="natural"
                    checked={formData.wl_preprocess === "natural"}
                  />
                  <label className="form-check-label" htmlFor="natural"  style={{width: "100%"}}>
                    Natural
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="wl_preprocess"
                    id="movements"
                    value="movements"
                    checked={formData.wl_preprocess === "movements"}
                  />
                  <label className="form-check-label" htmlFor="movements" style={{width: "100%"}}>
                    Always turbulent
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="wl_preprocess"
                    id="grayscale"
                    value="grayscale"
                    checked={formData.wl_preprocess === "grayscale"}
                  />
                  <label className="form-check-label" htmlFor="grayscale" style={{width: "100%"}}>
                    Dark water
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="wl_preprocess"
                    id="saturation"
                    value="saturation"
                    checked={formData.wl_preprocess === "saturation"}
                  />
                  <label className="form-check-label" htmlFor="saturation" style={{width: "100%"}}>
                    Vegetated banks
                  </label>
                </div>
              </div>
              <div className="mb-3 mt-3 form-horizontal">
                <label htmlFor="wl_s2n_thres" className="form-label">
                  Signal-to-noise ratio for measuring levels. Lower accepts more noise, higher is more reliable.
                </label>
                <ReactSlider
                  className="horizontal-slider"
                  thumbClassName="thumb"
                  trackClassName="track"
                  value={formData.wl_s2n_thres || 3} // Default values if unset
                  min={2.0}
                  max={5.0}
                  step={0.1}
                  renderThumb={(props, state) => (
                    <div {...props}>
                      <div className="thumb-value">{state.valueNow}</div>
                    </div>
                  )}
                  onChange={(value) => {
                    handleSliderChange("wl_s2n_thres", value)
                  }}
                />
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
            {CSDischarge && Object.keys(CSDischarge).length > 0 ? (
              <>
                <div className="mb-3 mt-3 form-horizontal">
                  <label htmlFor="v_distance" className="form-label">
                    Velocity sampling distance [m]
                  </label>
                  <ReactSlider
                    className="horizontal-slider"
                    thumbClassName="thumb"
                    trackClassName="track"
                    value={formData.v_distance || 0.5} // Default values if unset
                    min={0.1}
                    max={1}
                    step={0.05}
                    renderThumb={(props, state) => (
                      <div {...props}>
                        <div className="thumb-value">{state.valueNow}</div>
                      </div>
                    )}
                    onChange={(value) => {
                      handleSliderChange("v_distance", value)
                    }}
                  />
                </div>
                <div className="mb-3 mt-3 form-horizontal">

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
                </div>
              </>
            ) : (<div role="alert" style={{color: "red", fontStyle: "italic"}}>
                A cross section for discharge estimation must be selected before setting specific parameters.
              </div>
            )}
          {/*</div>*/}
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
                onChange={handleRawDataChange}
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
  CSWaterLevel: PropTypes.object,
  CSDischarge: PropTypes.object,
  ws: PropTypes.object.isRequired
};

export default RecipeForm;
