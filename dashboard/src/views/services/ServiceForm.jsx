import { useState, useEffect } from 'react';
import { useMessage } from '../../messageContext';
import '../../App.css';

/**
 * ServiceForm - Component for creating or editing a service
 * Accepts `initialData` when editing and includes a README markdown field
 */
const ServiceForm = ({ onSave, onCancel, isNew = false, initialData = null }) => {
  const [formData, setFormData] = useState({
    service_short_name: '',
    service_long_name: '',
    service_type: 'ONE_TIME',
    description: '',
    readme: '',
  });
  const { setMessageInfo } = useMessage();

  useEffect(() => {
    if (initialData) {
      setFormData({
        service_short_name: initialData.service_short_name || '',
        service_long_name: initialData.service_long_name || '',
        // backend stores numeric types; map to strings used by this form
        service_type: initialData.service_type === 1 || initialData.service_type === 'ONE_TIME' ? 'ONE_TIME' : 'TIMER',
        description: initialData.description || '',
        readme: initialData.readme || '',
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.service_short_name || !formData.service_long_name) {
      setMessageInfo('error', 'Service short name and long name are required');
      return;
    }

    // Validate short name format
    if (!/^[a-z0-9-]+$/.test(formData.service_short_name)) {
      setMessageInfo('error', 'Service short name must be lowercase alphanumeric with hyphens only');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-lg" style={{minWidth: "1200px"}}>
        <h2>{isNew ? 'Create New Service' : 'Edit Service'}</h2>

        <form onSubmit={handleSubmit} className="form-group">
          <div className="form-field">
            <label htmlFor="service_short_name">
              Service Short Name (URL & systemd file naming)*
            </label>
            <input
              type="text"
              id="service_short_name"
              name="service_short_name"
              value={formData.service_short_name}
              onChange={handleChange}
              placeholder="my-custom-service"
              required
              pattern="[a-z0-9-]+"
              title="Only lowercase letters, numbers, and hyphens allowed"
              disabled={!isNew}
            />
            <small>
              Will be used as: <code>orc-{formData.service_short_name}.service</code>
            </small>
          </div>

          <div className="form-field">
            <label htmlFor="service_long_name">Service Long Name (Display Name)*</label>
            <input
              type="text"
              id="service_long_name"
              name="service_long_name"
              value={formData.service_long_name}
              onChange={handleChange}
              placeholder="My Custom Service"
              required
            />
            <small>This is shown in the UI and systemd description</small>
          </div>

          <div className="form-field">
            <label htmlFor="service_type">Service Type*</label>
            <select
              id="service_type"
              name="service_type"
              value={formData.service_type}
              onChange={handleChange}
              required
            >
              <option value="ONE_TIME">
                One-Time Service (runs when triggered)
              </option>
              <option value="TIMER">
                Timer Service (runs on schedule)
              </option>
            </select>
            <small>
              {formData.service_type === 'ONE_TIME'
                ? 'Service will run when manually started'
                : 'Service will run according to a timer schedule'}
            </small>
          </div>

          <div className="form-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what this service does..."
              rows="4"
            />
          </div>

          <div className="form-field">
            <label htmlFor="readme">README (Markdown)</label>
            <textarea
              id="readme"
              name="readme"
              value={formData.readme}
              onChange={handleChange}
              placeholder="# Usage\n\nDescribe how to use this service in markdown..."
              rows="8"
            />
            <small>Admin-editable markdown content shown on the service page</small>
          </div>

          <div className="info-box">
            <h4>Next Steps After Creation</h4>
            <ul>
              <li>Add parameters that your service script will read as environment variables</li>
              <li>Deploy the service to systemd with the parameters</li>
              <li>Start/stop and enable/disable the service from the management page</li>
            </ul>
          </div>

          <div className="form-buttons">
            <button type="submit" className="btn btn-primary">
              {isNew ? 'Create Service' : 'Save Changes'}
            </button>
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceForm;
