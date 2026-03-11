import { useEffect, useState } from "react";

const VariablesFilterModal = ({ setShowModal, variables, setVariables }) => {
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (variables === null) {
      setIsLoading(true);
    } else {
      // show variables as soon as page is fully mounted
      setIsLoading(false);
    }
  }, [variables]);

  const closeModal = () => {
    setShowModal(false);
  };

  const handleSelectAll = () => {
    // set all variables to show
    setVariables((prev) => (prev ?? []).map((v) => ({ ...v, show: true })));
  };

  const handleDeselectAll = () => {
    setVariables((prev) => (prev ?? []).map((v) => ({ ...v, show: false })));
  };

  return (
    <>
      <div className="sidebar-overlay"></div>
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{ maxWidth: "400px" }}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Show variables</h5>
              <button
                type="button"
                className="btn-close"
                onClick={closeModal}
              ></button>
            </div>
            <div className="modal-body">
              {isLoading ? (
                <div>Loading variables...</div>
              ) : (
                <>
                  <div className="mb-3">
                    <button className="btn btn-sm btn-secondary me-2" onClick={handleSelectAll}>
                      Select All
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={handleDeselectAll}>
                      Deselect All
                    </button>
                  </div>
                  <div className="form-group">
                    {(variables ?? []).map((variable) => (
                      <div className="form-check" key={variable.name}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`${variable.name}`}
                          checked={variable.show}
                          onChange={() =>
                            setVariables((prev) =>
                              prev.map((v) =>
                                v.name === variable.name ? { ...v, show: !v.show } : v
                              )
                            )
                          }
                        />
                        <label className="form-check-label" htmlFor={`variable-${variable.name}`}>
                          {variable.name}
                        </label>
                      </div>
                    ))}
                  </div>

                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default VariablesFilterModal;
