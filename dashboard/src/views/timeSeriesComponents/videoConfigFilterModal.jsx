import {useState, useEffect} from "react";
import PropTypes from "prop-types";
import api from "../../api/api.js";

const VideoConfigFilterModal = ({showModal, setShowModal, selectedVideoConfigIds, setSelectedVideoConfigIds, setMessageInfo}) => {
  const [videoConfigs, setVideoConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVideoConfigs = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/video_config/');
        setVideoConfigs(response.data);

        // If no selection yet, select all by default
        if (selectedVideoConfigIds === null) {
          const allIds = [0, ...response.data.map(vc => vc.id)];
          setSelectedVideoConfigIds(allIds);
        }
      } catch (error) {
        console.error('Error fetching video configs:', error);
        setMessageInfo({message: 'Failed to load video configurations', severity: 'error'});
      } finally {
        setIsLoading(false);
      }
    };

    if (showModal) {
      fetchVideoConfigs();
    }
  }, [showModal]);

  const closeModal = () => {
    setShowModal(false);
  };

  const handleToggle = (id) => {
    setSelectedVideoConfigIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(vid => vid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    const allIds = [0, ...videoConfigs.map(vc => vc.id)];
    setSelectedVideoConfigIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedVideoConfigIds([]);
  };

  const allVideoConfigIds = [0, ...videoConfigs.map(vc => vc.id)];
  const allSelected = selectedVideoConfigIds && selectedVideoConfigIds.length === allVideoConfigIds.length;

  return (
    <>
      <div className="sidebar-overlay"></div>
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{maxWidth: "600px"}}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Filter by Video Configuration</h5>
              <button
                type="button"
                className="btn-close"
                onClick={closeModal}
              ></button>
            </div>
            <div className="modal-body">
              {isLoading ? (
                <div>Loading video configurations...</div>
              ) : (
                <>
                  <div className="mb-3">
                    <button className="btn btn-sm btn-secondary me-2" onClick={handleSelectAll}>
                      Select All
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={handleDeselectAll}>
                      Deselect All
                    </button>
                    {allSelected && (
                      <span className="ms-3 text-muted">(All selected - no filter will be applied)</span>
                    )}
                  </div>

                  <div className="form-group">
                    <div className="mb-2">
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedVideoConfigIds && selectedVideoConfigIds.includes(0)}
                          onChange={() => handleToggle(0)}
                          className="me-2"
                        />
                        <strong>No video attached</strong>
                      </label>
                    </div>

                    {videoConfigs.map(vc => (
                      <div key={vc.id} className="mb-2">
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedVideoConfigIds && selectedVideoConfigIds.includes(vc.id)}
                            onChange={() => handleToggle(vc.id)}
                            className="me-2"
                          />
                          Video Config ID: {vc.id} {vc.name && `- ${vc.name}`}
                        </label>
                      </div>
                    ))}
                  </div>
                </>
              )}
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
  );
};

VideoConfigFilterModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  setShowModal: PropTypes.func.isRequired,
  selectedVideoConfigIds: PropTypes.array,
  setSelectedVideoConfigIds: PropTypes.func.isRequired,
  setMessageInfo: PropTypes.func.isRequired,
};

export default VideoConfigFilterModal;
