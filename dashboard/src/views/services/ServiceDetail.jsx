import {FaExclamationTriangle} from 'react-icons/fa';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/api.js';
import { useMessage } from '../../messageContext';
import {getLogLineStyle} from "../../utils/helpers.jsx";

import ParameterForm from './ParameterForm.jsx';
import './services.css';

/**
 * ServiceDetail - Component for managing an individual service
 * Displays service information, parameters, and control buttons
 */
const ServiceDetail = ({ devStatus }) => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const {setMessageInfo} = useMessage();

  const [service, setService] = useState(null);
  const [readmeCollapsed, setReadmeCollapsed] = useState(true);
  const [logCollapsed, setLogCollapsed] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [controlLoading, setControlLoading] = useState(false);
  const [parameterValues, setParameterValues] = useState({});
  const [showParameterForm, setShowParameterForm] = useState(false);
  const [editingParameter, setEditingParameter] = useState(null);
  const [isNewParameter, setIsNewParameter] = useState(false);
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [scriptContent, setScriptContent] = useState('');
  const [scriptType, setScriptType] = useState('bash');
  const [logData, setLogData] = useState([]);
  const logContainerRef = useRef(null);

  useEffect(() => {
    fetchService();
    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 5000); // Refresh status every 5 seconds
    return () => clearInterval(statusInterval);
  }, [serviceId]);

  const fetchService = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/service/${serviceId}/`);
      setService(response.data);

      // Initialize parameter values from environment file or defaults
      const values = {};
      console.log('Fetched parameters:', response.data.parameters);
      response.data.parameters.forEach(param => {
        const fallbackValue = ['BOOLEAN', 'INTEGER', 'FLOAT'].includes(param.parameter_type)
        ? null
        : '';
        if (param.current_value !== undefined && param.current_value !== null) {
          values[param.id] = param.current_value;
        } else if (param.parsed_default_value !== undefined && param.parsed_default_value !== null) {
          values[param.id] = param.parsed_default_value;
        } else {
          values[param.id] = fallbackValue;
        }
      });
      setParameterValues(values);
      console.log('Initialized parameter values:', values);
    } catch (error) {
      setMessageInfo({
        type: 'error',
        message: `Failed to load service: ${error.message}`,
      });
      navigate('/services');
    } finally {
      console.log(parameterValues);
      setLoading(false);
    }
  };


  // Automatically scroll to the bottom of the log container when new lines are added
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logData]);


  const fetchStatus = async () => {
    try {
      const response = await api.get(`/service/${serviceId}/status/`);
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  const handleServiceControl = async (action) => {
    try {
      setControlLoading(true);
      const response = await api.post(`/service/${serviceId}/${action}/`);
      setMessageInfo({
        type: 'success',
        message: response.data.message,
      });
      fetchStatus();
    } catch (error) {
      setMessageInfo({
        type: 'error',
        message: `Failed to ${action} service: ${error.message}`,
      });
    } finally {
      setControlLoading(false);
    }
  };

  const handleParameterChange = (paramId, value) => {
    setParameterValues(prev => ({
      ...prev,
      [paramId]: value,
    }));
  };

  const handleSaveParameter = async (formData) => {
    try {
      if (editingParameter?.id) {
        // Update existing parameter
        await api.patch(`/service/parameters/${editingParameter.id}`, formData);
        setMessageInfo('success', 'Parameter updated successfully');
      } else {
        console.log('Creating parameter with data:', formData);
        // Create new parameter
        await api.post(`/service/${serviceId}/parameters/`, formData);
        setMessageInfo('success', 'Parameter created successfully');
      }
      setShowParameterForm(false);
      setEditingParameter(null);
      fetchService();
    } catch (error) {
      setMessageInfo('error', `Failed to save parameter: ${error.message}`);
    }
  };

  const handleDeleteParameter = async (paramId) => {
    if (window.confirm('Are you sure you want to delete this parameter?')) {
      try {
        await api.delete(`/service/parameters/${paramId}/`);
        setMessageInfo({
          type: 'success',
          message: 'Parameter deleted successfully',
        });
        fetchService();
      } catch (error) {
        setMessageInfo({
          type: 'error',
          message: `Failed to delete parameter: ${error.message}`,
        });
      }
    }
  };

  const handleEditParameter = (param) => {
    setEditingParameter(param);
    setIsNewParameter(false);
    setShowParameterForm(true);
  };

  const handleAddParameter = () => {
    setEditingParameter(null);
    setIsNewParameter(true);
    setShowParameterForm(true);
  };

  const handleDeploy = () => {
    setShowDeployForm(true);
  };

  const fetchLogs = async () => {
    try {
      const response = await api.get(`/service/${serviceId}/log/`);
      setLogData(response.data || []);
    } catch (error) {
      setMessageInfo('error', `Failed to fetch logs: ${error.message}`);
    }
  }
  const handleLog = () => {
    try {
      if (!logCollapsed) {
        // If currently expanded, fetch logs before collapsing
        setLogCollapsed(true);
        console.log('Collapsing log...');
      } else {
        setLogLoading(true);
        console.log('Opening log...');
        fetchLogs();
        setLogCollapsed(false);
      }
    } catch (error) {
      setMessageInfo('error', `Failed to fetch logs: ${error.message}`);
      setLogCollapsed(true);
    } finally {
      setLogLoading(false);
    }
  }

  const handleSubmitParameterValues = async () => {
    // saves parameter values to .env file belonging to service.
    try {
      setControlLoading(true);
      console.log('Submitting parameter values:', parameterValues);
      const response = await api.post(
        `/service/${serviceId}/update_env/`,
        parameterValues, {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      setMessageInfo('success', response.data.message || 'Parameters updated successfully');
      fetchStatus();
    } catch (error) {
      console.log(error.response.data.detail);
      setMessageInfo('error', `Failed to update parameters: ${error.response.data.detail}`);
    } finally {
      setControlLoading(false);
    }
  }
  const handleSubmitDeploy = async () => {
    if (!scriptContent.trim()) {
      setMessageInfo({
        type: 'error',
        message: 'Please provide a script content',
      });
      return;
    }

    try {
      setControlLoading(true);
      const response = await api.post(`/service/${serviceId}/deploy/`, null, {
        params: {
          script_content: scriptContent,
        },
      });
      setMessageInfo({
        type: 'success',
        message: response.data.message || 'Service deployed successfully',
      });
      setShowDeployForm(false);
      setScriptContent('');
      setScriptType('bash');
      fetchStatus();
    } catch (error) {
      setMessageInfo({
        type: 'error',
        message: `Failed to deploy service: ${error.message}`,
      });
    } finally {
      setControlLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading service...</div>;
  }

  if (!service) {
    return <div className="error">Service not found</div>;
  }

  return (
    <div className="service-detail-container">
      <div className="page-header">
        <h1>{service.service_long_name}</h1>
          <p>{service.description}</p>
      </div>

        <div className="service-warning">
        <p>You must run ORC-OS back-end with passwordless root privileges
          to use the control panel. AFter modifying one or more parameter values,
          click on <code>Update Parameters</code> to save them.</p>
        {devStatus && (
          <div>
            <p><FaExclamationTriangle color="red"/> <i>You are in development mode. With great powers comes great
              responsibility. Modify parameters and deployment scripts at your own risk. </i></p>
              <p>You may alter the service parameters by
              selecing <code>+Add Parameter</code> or <code>Edit</code>. Click on <code>Deploy</code> to
              deploy the service with a script, containing your parameters. Check for the short names
              in the top-right of each parameter window.</p>
          </div>
        )}

        </div>

      {service.readme && (
        <div className="service-description-wrapper">
          <div className="service-description-header">
            <button
              className="toggle-service-description"
              onClick={() => setReadmeCollapsed(prev => !prev)}
              aria-label={readmeCollapsed ? 'Show README' : 'Hide README'}
            >
              {readmeCollapsed ? '▶' : '▼'}
            </button>
            <span className="service-label">README</span>
          </div>
          {!readmeCollapsed && (
            <div className="service-description">
              <ReactMarkdown>{service.readme}</ReactMarkdown>
            </div>
          )}
        </div>
      )}


      <div className="service-description-wrapper">
        <div className="service-description-header">
          <button
            className="toggle-service-description"
            onClick={() => handleLog()}
            aria-label={logCollapsed ? 'Show Logs' : 'Hide Logs'}
          >
            {logCollapsed ? '▶' : '▼'}
          </button>
          <span className="service-label">Logs</span>
        </div>
        {!logCollapsed && (
          <div className="service-description-green" ref={logContainerRef}>
            {logData.length > 0 ? (
              logData.map((line, index) => (
                <div key={index} style={getLogLineStyle(line)}>
                  {line}
                </div>
              ))
            ) : (
              <div>Loading logs...</div>
            )}

          </div>
        )}
      </div>

      {/* Service Status and Control Panel */}
      <div className="service-control-panel">
        <div className="status-info">
          <h3>Service Status</h3>
          {status ? (
            <div className="status-details">
              <p>
                <strong>Active:</strong>{' '}
                <span className={status.is_active ? 'status-active' : 'status-inactive'}>
                  {status.is_active ? '✓ Active' : '✗ Stopped'}
                </span>
              </p>
              <p>
                <strong>Enabled:</strong>{' '}
                <span className={status.is_enabled ? 'status-enabled' : 'status-disabled'}>
                  {status.is_enabled ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </p>
            </div>
          ) : (
            <p className="status-unknown">Status unknown - service may not be deployed</p>
          )}
        </div>

        <div className="control-buttons" style={{minWidth: "500px"}}>
          <h3>Service Control</h3>
          <div className="button-group">
            <button
              className="btn btn-success"
              onClick={() => handleServiceControl('start')}
              disabled={controlLoading || !status}
            >
              ▶ Start
            </button>
            <button
              className="btn btn-danger"
              onClick={() => handleServiceControl('stop')}
              disabled={controlLoading || !status}
            >
              ⏹ Stop
            </button>
            <button
              className="btn btn-info"
              onClick={() => handleServiceControl('restart')}
              disabled={controlLoading || !status}
            >
              ↻ Restart
            </button>
          </div>

          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={() => handleServiceControl('enable')}
              disabled={controlLoading || !status}
            >
              ☑ Enable
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleServiceControl('disable')}
              disabled={controlLoading || !status}
            >
              ☐ Disable
            </button>
          </div>
        </div>
      </div>

      {/* Parameters Section */}
      <div className="parameters-section">
        <div className="section-header">
          <h2>Configuration Parameters</h2>

          <div className="button-group">
            <button
              className="btn btn-sm"
              onClick={handleSubmitParameterValues}
              disabled={controlLoading}
            >
              Update parameters
            </button>
          {devStatus && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleDeploy}
              disabled={controlLoading}
            >
              Deploy
            </button>
          )}
          {devStatus && (
            <button
                className="btn btn-primary btn-sm"
                onClick={handleAddParameter}
            >
                + Add Parameter
            </button>
          )}
          </div>
        </div>

        {service.parameters && service.parameters.length > 0 ? (
          <div className="parameters-grid">
            {service.parameters.map(param => (
              <div key={param.id} className="parameter-card">
                <div className="param-header">
                  <h4>{param.parameter_long_name}</h4>
                  <code className="param-short-name">{param.parameter_short_name}</code>
                </div>

                {param.description && (
                  <p className="param-description">{param.description}</p>
                )}

                <div className="param-type">
                  <span className="badge">{param.parameter_type}</span>
                  {param.nullable && <span className="badge badge-info">Nullable</span>}
                </div>

                <div className="param-input-group">
                  {param.parameter_type === 'BOOLEAN' ? (
                    <select
                      value={parameterValues[param.id] === null ? "" : parameterValues[param.id]}
                      onChange={(e) => {
                        const value = e.target.value === 'true' ? true : e.target.value === 'false' ? false : null;
                        handleParameterChange(param.id, value);
                      }}
                      className="form-input"
                    >
                      <option value="">-- Use Default --</option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : param.parameter_type === 'INTEGER' ? (
                    <input
                      type="number"
                      value={parameterValues[param.id] || ''}
                      onChange={(e) => handleParameterChange(param.id, parseInt(e.target.value))}
                      className="form-input"
                      placeholder={param.default_value || 'Enter value'}
                    />
                  ) : param.parameter_type === 'FLOAT' ? (
                    <input
                      type="number"
                      step="any"
                      value={parameterValues[param.id] || ''}
                      onChange={(e) => handleParameterChange(param.id, parseFloat(e.target.value))}
                      className="form-input"
                      placeholder={param.default_value || 'Enter value'}
                    />
                  ) : param.parameter_type === 'LITERAL' ? (
                    <textarea
                      value={parameterValues[param.id] || ''}
                      onChange={(e) => handleParameterChange(param.id, e.target.value)}
                      className="form-input"
                      placeholder={param.default_value || 'Enter JSON or structured data'}
                      rows="3"
                    />
                  ) : (
                    <input
                      type="text"
                      value={parameterValues[param.id] || ''}
                      onChange={(e) => handleParameterChange(param.id, e.target.value)}
                      className="form-input"
                      placeholder={param.default_value || 'Enter value'}
                    />
                  )}
                  {param.default_value && (
                    <p className="param-default">Default: {param.default_value}</p>
                  )}
                </div>
                {devStatus && (
                  <div className="param-actions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleEditParameter(param)}
                  >
                      Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteParameter(param.id)}
                  >
                      Delete
                  </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-parameters">No parameters defined yet</p>
        )}
      </div>

      {/* Parameter Form Modal */}
      {showParameterForm && (
        <ParameterForm
          parameter={editingParameter}
          onSave={handleSaveParameter}
          onCancel={() => {
            setShowParameterForm(false);
            setEditingParameter(null);
          }}
          isNew={isNewParameter}
        />
      )}

      {/* Deploy Modal */}
      {showDeployForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Deploy Service</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowDeployForm(false);
                  setScriptContent('');
                  setScriptType('bash');
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="scriptType">Script Type:</label>
                <select
                  id="scriptType"
                  value={scriptType}
                  onChange={(e) => setScriptType(e.target.value)}
                  className="form-input"
                >
                  <option value="bash">Bash Script</option>
                  <option value="python">Python Script</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="scriptContent">Script Content:</label>
                <textarea
                  id="scriptContent"
                  value={scriptContent}
                  onChange={(e) => setScriptContent(e.target.value)}
                  className="form-input deploy-textarea"
                  placeholder={scriptType === 'bash' ? '#!/bin/bash\necho "Hello World"' : '#!/usr/bin/env python\nprint("Hello World")'}
                  rows="12"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowDeployForm(false);
                  setScriptContent('');
                  setScriptType('bash');
                }}
                disabled={controlLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={handleSubmitDeploy}
                disabled={controlLoading || !scriptContent.trim()}
              >
                Deploy
              </button>
            </div>
          </div>
        </div>
      )}
      {devStatus && (
      <div className="action-buttons">
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/services')}
        >
          Back to Services
        </button>
      </div>
      )}
    </div>
  );
};

export default ServiceDetail;
