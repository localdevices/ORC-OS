import {useState} from 'react';
import PropTypes from "prop-types";
import {useDebouncedWsSender} from "../../api/api.js";
import api from "../../api/api.js";

const CrossSectionUploadModal = ({setShowModal, setMessageInfo, callback, ws}) => {
  return (
    <>
      <div className="sidebar-overlay"></div> {/*make background grey*/}
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{maxWidth: "600px", marginTop: "30px"}}>  {/*ensure modal spans a broad screen size*/}
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{`Upload new cross section`}</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowModal(false)}
              ></button>
            </div>
            <div className="modal-body">
              <CrossSectionUpload
                setShowModal={setShowModal}
                setMessageInfo={setMessageInfo}
                callback={callback}
                ws={ws}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const CrossSectionUpload = ({setShowModal, setMessageInfo, callback, ws}) => {
  // form data as the user sees it on the screen
  const [formData, setFormData] = useState({
    name: '',
    file: null,
    linearize: false,
  });

  const sendDebouncedMsg = useDebouncedWsSender(ws, 400);

  const handleCheckboxChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.checked});
  }
  const handleInputChange = (event) => {
    const value = event.target.type === 'file' ? event.target.files[0] : event.target.value;

    setFormData({
      ...formData,
      [event.target.name]: value
    });
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const crossSectionData = await loadFile();
      // Additional steps after successful file load
      console.log("processing cross section data...")
      if (formData.name) {
        const updatedFormSubmitData = {
          name: formData.name,
          features: crossSectionData.features,
        };
        await api.post('/cross_section/', updatedFormSubmitData);
        setMessageInfo('success', 'Successfully created cross section');
        // refresh the cross section data
        callback();
        setShowModal(false);

      }
    } catch (error) {
      console.log("File loading not successful, do nothing...", error);
    }

  }

  const loadFile = async () => {
    try {

      if (!formData.file) {
        setMessageInfo('error', 'Please select a file');
        return;
      }

      const fileFormData = new FormData();
      fileFormData.append("file", formData.file);
      fileFormData.append("linearize", formData.linearize);
      console.log(formData);

      try {
        const response = await api.post(
          '/cross_section/from_csv/',
          fileFormData,
          {headers: {"Content-Type": "multipart/form-data"}}
        );
        setMessageInfo('success', 'Successfully uploaded CSV file');
        return response.data;
      } catch (csvError) {
        try {
          const geoJsonResponse = await api.post(
            '/cross_section/from_geojson/',
            fileFormData,
            {headers: {"Content-Type": "multipart/form-data"}}
          );

          setMessageInfo('success', 'Successfully uploaded GeoJSON file');
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


  return (
    <div>
      <div className="flex-container no-padding" style={{overflow: "auto"}}>
        <div className='container tab'>
          <form onSubmit={handleSubmit}>
            <div className='mb-3 mt-3'>
              <label htmlFor='name' className='form-label'>
                Name of cross section
              </label>
              <input type='str' className='form-control' id='name' name='name' onChange={handleInputChange} value={formData.name} required/>

            </div>
            <div className='mb-3 mt-3'>
              <label htmlFor='file' className='form-label'>
                Choose file (.csv with X, Y, Z, or GeoJSON)
              </label>
              <input type='file' className='form-control' id='file' name='file'
                     accept=".geojson,.csv" onChange={handleInputChange} required/>
            </div>
            <div className='mb-3 mt-3'>Straighten cross section
              <div className="form-check form-switch">
                <label className="form-label" htmlFor="active" style={{marginLeft: '0'}}></label>
                <input
                  style={{width: "40px", height: "20px", borderRadius: "15px"}}
                  className="form-check-input"
                  type="checkbox"
                  id="linearize"
                  name="linearize"
                  onChange={handleCheckboxChange}
                  value={formData.linearize}
                  checked={formData.linearize}
                />
              </div>
              <div className="help-block">
                  Activate this to make a straight line from your survey points before storing. The straight line will
                  follow the same left-to-right direction as the original and bottom points are snapped to the closest
                  coordinate on this line.
              </div>
            </div>

            <button type='submit' className='btn'>
              Upload
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
CrossSectionUploadModal.propTypes = {
  setShowModal: PropTypes.func.isRequired,
  setMessageInfo: PropTypes.func.isRequired,
  callback: PropTypes.func.isRequired,
  ws: PropTypes.object
};

CrossSectionUpload.propTypes = {
  setMessageInfo: PropTypes.func.isRequired,
  callback: PropTypes.func.isRequired,
  ws: PropTypes.object
};

// export default CameraParameters;

export default CrossSectionUploadModal;
