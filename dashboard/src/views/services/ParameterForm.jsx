import { useState, useEffect } from 'react';
import { useMessage } from '../../messageContext';
import '../../App.css';

/**
 * ParameterForm - Component for editing service parameters
 * Renders form fields based on parameter type
 */
export const ParameterForm = ({ parameter, onSave, onCancel, isNew = false }) => {
  const [formData, setFormData] = useState({
    parameter_short_name: '',
    parameter_long_name: '',
    parameter_type: 'BOOLEAN',
    default_value: '',
    nullable: false,
    description: '',
  });
  const { setMessageInfo } = useMessage();

  useEffect(() => {
    if (parameter) {
      setFormData({
        parameter_short_name: parameter.parameter_short_name || '',
        parameter_long_name: parameter.parameter_long_name || '',
        parameter_type: parameter.parameter_type || 'BOOLEAN',
        default_value: parameter.default_value || '',
        nullable: parameter.nullable || false,
        description: parameter.description || '',
      });
    }
  }, [parameter]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.parameter_short_name || !formData.parameter_long_name) {
      setMessageInfo({
        type: 'error',
        message: 'Parameter name and long name are required',
      });
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{isNew ? 'Add Parameter' : 'Edit Parameter'}</h3>

        <form onSubmit={handleSubmit} className="form-group">
          <div className="form-field">
            <label htmlFor="parameter_short_name">Short Name (Variable Name)*</label>
            <input
              type="text"
              id="parameter_short_name"
              name="parameter_short_name"
              value={formData.parameter_short_name}
              onChange={handleChange}
              placeholder="MY_PARAMETER"
              required
              pattern="[A-Za-z0-9_]+"
              title="Only alphanumeric characters and underscores allowed"
            />
          </div>

          <div className="form-field">
            <label htmlFor="parameter_long_name">Long Name (Display Name)*</label>
            <input
              type="text"
              id="parameter_long_name"
              name="parameter_long_name"
              value={formData.parameter_long_name}
              onChange={handleChange}
              placeholder="My Parameter"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="parameter_type">Data Type*</label>
            <select
              id="parameter_type"
              name="parameter_type"
              value={formData.parameter_type}
              onChange={handleChange}
              required
            >
              <option value="BOOLEAN">Boolean (true/false)</option>
              <option value="INTEGER">Integer (whole numbers)</option>
              <option value="FLOAT">Float (decimal numbers)</option>
              <option value="STRING">String (text)</option>
              <option value="LITERAL">Literal (JSON or structured data)</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="default_value">
              Default Value
              {formData.parameter_type === 'BOOLEAN' && ' (true or false)'}
              {formData.parameter_type === 'INTEGER' && ' (whole number)'}
              {formData.parameter_type === 'FLOAT' && ' (decimal number)'}
            </label>
            {formData.parameter_type === 'BOOLEAN' ? (
              <select
                id="default_value"
                name="default_value"
                value={formData.default_value}
                onChange={handleChange}
              >
                <option value="">-- None --</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input
                type={formData.parameter_type === 'INTEGER' ? 'number' :
                      formData.parameter_type === 'FLOAT' ? 'number' : 'text'}
                id="default_value"
                name="default_value"
                value={formData.default_value}
                onChange={handleChange}
                placeholder="Leave empty for no default"
                step={formData.parameter_type === 'FLOAT' ? 'any' : undefined}
              />
            )}
          </div>

          <div className="form-field">
            <label htmlFor="nullable">
              <input
                type="checkbox"
                id="nullable"
                name="nullable"
                checked={formData.nullable}
                onChange={handleChange}
              />
              {' '}Nullable (can be empty)
            </label>
          </div>

          <div className="form-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Short description of what this parameter does"
              rows="3"
            />
          </div>

          <div className="form-buttons">
            <button type="submit" className="btn btn-primary">
              Save Parameter
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

export default ParameterForm;
