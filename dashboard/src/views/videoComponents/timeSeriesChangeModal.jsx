import {useState, useEffect, useRef} from "react";
import api from "../../api/api.js";
import {useMessage} from '../../messageContext';
import PropTypes from "prop-types";
import ReactSlider from "react-slider";
import SideView from "../VideoConfigComponents/sideView.jsx";
import {patchTimeSeries, postTimeSeries} from "../../utils/apiCalls/timeSeries.jsx";
import {getWettedSurface, getWaterLines} from "../../utils/apiCalls/crossSection.jsx";
import {run_video} from "../../utils/apiCalls/video.jsx"
import { getFrameUrl, useDebouncedImageUrl, PolygonDrawer } from "../../utils/images.jsx";


export const TimeSeriesChangeModal = ({setShowModal, video, setVideo}) => {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imgDims, setImgDims] = useState({width: 0, height: 0});
  const [waterLevelMin, setWaterLevelMin] = useState(0); // max water level
  const [waterLevelMax, setWaterLevelMax] = useState(1); // min water level
  const [waterLevel, setWaterLevel] = useState(null);  // current water level
  const [waterLevelChange, setWaterLevelChange] = useState(false);
  const [CSDischargePolygon, setCSDischargePolygon] = useState([]);
  const [CSWettedSurfacePolygon, setCSWettedSurfacePolygon] = useState([]);
  const [CSWaterLines, setCSWaterLines] = useState([]);
  const [yOffset, setYOffset] = useState(0);
  const [videoConfig, setVideoConfig] = useState(null);
  const [crossSection, setCrossSection] = useState(null);  // current water level
  const {setMessageInfo} = useMessage();

  const imageRef = useRef(null);


  const rescale_coords = (coords, imgDims, bBoxImg, bBoxParent) => {
    // rescale coordinates to fit the image dimensions as shown on screen
    const offsetX = bBoxImg.left - bBoxParent.left;
    const offsetY = bBoxImg.top - bBoxParent.top;

    return coords.map(p => {
      return {
        x: offsetX + (p[0] / imgDims.width) * bBoxImg.width,
        y: offsetY + (p[1] / imgDims.height) * bBoxImg.height
      }
    })
  }
  // load the image
  useDebouncedImageUrl({
    setImageUrl,
    deps: [video],
    urlBuilder: () => {
      const frameNr = video?.video_config?.recipe?.start_frame ?? 0;
      const rotate = video?.video_config?.camera_config?.rotation ?? null;
      return getFrameUrl(video, frameNr, rotate);
    },
    onUrlReady: (url, { cached }) => {
      if (cached) setLoading(false);
    },
    delayMs: 300
  });

  useEffect(() => {
    // retrieve water level and other data from video and time series
    // get the entire record
    api.get(`/video/${video.id}/`)
      .then((response) => {
        setVideo(response.data);
        setVideoConfig(response.data.video_config);
        if (response.data?.video_config?.cross_section_wl) {
          setCrossSection(response.data.video_config.cross_section_wl);
        } else {
          // if no water level cross section is set, use the default one
          setCrossSection(response.data.video_config.cross_section);
        }
      })
  }, [])


  useEffect(() => {
    if (crossSection) {
      setWaterLevelMin(Math.ceil(Math.min(...crossSection.z) * 100) /100);
      setWaterLevelMax(Math.floor(Math.max(...crossSection.z) * 100) /100);
      if (videoConfig?.camera_config?.gcps) {
        setYOffset(videoConfig.camera_config.gcps.h_ref - videoConfig.camera_config.gcps.z_0);
      }
      if (video?.time_series?.h) {
        setWaterLevel(video.time_series.h);
      }

      if (imageRef.current && imgDims.width && imgDims.height) {
        const bBoxRect = imageRef.current.getBoundingClientRect()
        const containerRect = imageRef.current.parentElement.parentElement.getBoundingClientRect()
        const newCSPolPoints = rescale_coords(
          crossSection.bottom_surface,
          imgDims,
          bBoxRect,
          containerRect
        )
        setCSDischargePolygon(newCSPolPoints);
      }
    }
  }, [crossSection, imageRef.current, imgDims, videoConfig?.camera_config?.gcps])

  useEffect(() => {
    if (crossSection && videoConfig && imageRef?.current && !loading && imgDims.width > 0 && imgDims.height > 0) {
      // Debounce getWettedSurface by 300ms
      const timeoutWaterLevel = setTimeout(() => {
        const bBoxRect = imageRef.current.getBoundingClientRect()
        const containerRect = imageRef.current.parentElement.parentElement.getBoundingClientRect()
        // retrieve cross section at set water level
        getWettedSurface(crossSection.id, videoConfig.camera_config.id, waterLevel).then(
          response => {
            const drawPol = rescale_coords(
              response,
              imgDims,
              bBoxRect,
              containerRect
            )
            setCSWettedSurfacePolygon(drawPol);
          }
        )
        // also retrieve water lines
        getWaterLines(crossSection.id, videoConfig.camera_config.id, waterLevel).then(
          response => {
            if (response) {
              const drawLines = response.map(line => {
                return rescale_coords(
                  line,
                  imgDims,
                  bBoxRect,
                  containerRect
                )
              })
              setCSWaterLines(drawLines);
            }
          }
        )
      }, 100);
      // Cleanup if dependencies change within 300ms
      return () => clearTimeout(timeoutWaterLevel);
    }
  }, [waterLevel, crossSection, videoConfig, imageRef.current, loading, imgDims])

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setVideo(null);
  };

  const handleImageLoad = () => {
    if (imageRef.current && imageUrl) {
      setImgDims({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
      setLoading(false); // Ensure loading state is set to false after dimensions are set
    }
  };

  const handleAddWaterLevel = async (e) => {
    console.log(waterLevelMin, yOffset);
    setWaterLevel(waterLevelMin + yOffset);
  }
  // Password change submit (adjust API endpoint as needed)
  const handleSubmitVideo = async (e, {forceOptical = false } = {}) => {
    e.preventDefault();
    const waterLevelSubmit = forceOptical ? null : waterLevel;
    const waterLevelChangeSubmit = forceOptical ? true : waterLevelChange;
    if (waterLevelChangeSubmit && video.time_series) {
      // with existing time series, first update time series in front end and database with new water level and status
      setVideo({...video, time_series: {...video.time_series, h: waterLevelSubmit}});
      try {
        // patching the time series record
        await patchTimeSeries({id: video.time_series.id, h: waterLevelSubmit});
      } catch (error) {
        console.error(`Error updating water level: ${error.response.data.detail}`);
        return
      }
    }
    // if no time series exists yet, create with the video time stamp
    if (!video.time_series && waterLevelChangeSubmit) {
      try {
        await postTimeSeries({timestamp: video.timestamp, h: waterLevelSubmit});
      } catch (error) {
        console.error(`Error creating water level: ${error.response.data.detail}`);
        return
      }
    }
    setVideo({...video, status: 2}); // status 2 is QUEUE
    // finally, enqueue the video for processing
    try {
      await run_video(video, setMessageInfo);
      setMessageInfo('success', 'Video submitted successfully');
      setShowModal(false);
    } catch (error) {
      console.error(error.response.data.detail);
    }
  };
  const handleChangeWaterLevel = async (value) => {
    setWaterLevel(value);
    // ensure water level is updated in the databse
    setWaterLevelChange(true);
    // ask for a new water level and return water lines, plot these on modal
  }
  return (
    <>
      <div className="sidebar-overlay"></div> {/*make background grey*/}
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{maxWidth: "600px", marginTop: "30px"}}>  {/*ensure modal spans a broad screen size*/}
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{`Process video ${video.id} - ${video.file.split(`/${video.id}/`)[1]}`}</h5>
              <button
                type="button"
                className="btn-close"
                onClick={closeModal}
              ></button>
            </div>
            <div className="modal-body">
              {waterLevel !== null && (
                <div className="mb-3 mt-0">
                  <label htmlFor="waterLevel" className="form-label">
                    Water level [m]
                  </label>
                  <div className="slider-container">
                    <div className="slider-min">{(waterLevelMin + yOffset).toFixed(2)}</div>
                    <div className="slider-max">{(waterLevelMax + yOffset).toFixed(2)}</div>
                    <ReactSlider
                      title="Move slider to adjust water level manually"
                      className="horizontal-slider"
                      thumbClassName="thumb"
                      trackClassName="track"
                      disabled={waterLevel == null}
                      value={waterLevel !== null ? waterLevel : Number.NaN}
                      min={waterLevelMin + yOffset}
                      max={waterLevelMax + yOffset}
                      step={0.01}
                      renderThumb={(props, state) => {
                        return (
                        <div {...props}>
                          <div className="thumb-value">{state.valueNow !== null ? state.valueNow : "N/A"}</div>
                        </div>
                        );
                      }}
                      onChange={handleChangeWaterLevel}
                    />
                  </div>
                    <div className="help-block" style={{marginTop: "80px"}}>
                      Select or improve the set water level visually with this slider, before processing. If you want to
                      remove a set water level and optically re-estimate it, click on the right-hand button below.
                    </div>
                </div>
              )}
              {!waterLevel && (<div role="alert" style={{color: "green", fontStyle: "italic"}}>
                No water level is set. Click on "Add water level" to set a water level manually.
              </div>
              )}
              <button
                className="btn"
                type="submit"
                disabled={waterLevel}
                onClick={handleAddWaterLevel}
              >Add water level
              </button>
              <span
                title={waterLevel ? "Submit video with set water level" : "Disabled, because no water level is set"}
                style={{ display: "inline-block" }}
              >

              <button
                  className="btn"
                  type="submit"
                  disabled={!waterLevel}
                  onClick={handleSubmitVideo}
                >Submit video with water level
                </button>
              </span>
                <span
                  title={(videoConfig?.cross_section_wl) ? "(Re-)estimate water level optically using the water level cross section" : "Disabled, because either water level or cross section for water level estimation is not set"}
                  style={{ display: "inline-block" }}
                >
              {videoConfig?.cross_section_wl && (<div role="alert" style={{color: "green", fontStyle: "italic"}}>
                  You have set a cross section for water levels. Click on "Submit and estimate level optically"
                  to remove any set water level and estimate the water level visually.
                </div>
              )}
                <button
                  className="btn"
                  type="submit"
                  onClick={(e) => handleSubmitVideo(e, { forceOptical: true })}
                  disabled={!videoConfig?.cross_section_wl}
                >Submit and estimate level optically
                </button>
                </span>
            </div>
            <SideView
              CSWaterLevel={videoConfig?.cross_section_wl}
              CSDischarge={videoConfig?.cross_section}
              zMin={videoConfig?.recipe?.min_z}
              zMax={videoConfig?.recipe?.max_z}
              waterLevel={waterLevel ? waterLevel - yOffset : null}
              yRightOffset={yOffset}
            />
            <div>
            <div className="image-container">
              <span>
              <img
                style={{width: '100%', height: '100%', maxHeight: '400px', objectFit: 'contain'}}
                className="img-calibration"
                ref={imageRef}
                onLoad={() => {
                  setLoading(true);
                  handleImageLoad()
                }}
                onError={() => {
                  setLoading(false); // Always unset loading on error
                  console.error('Image failed to load.');
                }}
                src={imageUrl}
                alt="img-set-water-level"
              />
              {CSDischargePolygon && (
                <PolygonDrawer
                  points={CSDischargePolygon}
                  fill={"rgba(75, 192, 192, 0.3)"}
                  stroke={"white"}
                  strokeWidth={2}
                  zIndex={0}
                />
              )}
              {CSWettedSurfacePolygon && (
                <PolygonDrawer
                  points={CSWettedSurfacePolygon}
                  fill={"rgba(75, 130, 192, 0.3)"}
                  stroke={"white"}
                  strokeWidth={2}
                  zIndex={100}
                />
              )}
              {CSWaterLines && CSWaterLines.length > 0 && CSWaterLines.map((line, idx) => (
                <PolygonDrawer
                  points={line}
                  key={`water line ${idx}`}
                  fill={"rgba(75, 130, 192, 0.3)"}
                  stroke={"red"}
                  strokeWidth={4}
                  zIndex={100}
                />
              ))}
            </span>
            </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeModal}
              >
                Close
              </button>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
TimeSeriesChangeModal.propTypes = {
  setShowModal: PropTypes.func.isRequired,
  video: PropTypes.object.isRequired,
  setVideo: PropTypes.func.isRequired,
};
