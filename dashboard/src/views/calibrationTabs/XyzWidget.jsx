import React from 'react';
import './widget.css'

const XYZWidget = ({ id, coordinates, onUpdate, onDelete }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onUpdate(id, { ...coordinates, [name]: value });
  };

  const handleDelete = () => {
    onDelete(id);
  };

  return (
    <div className="widget">
      <div style={{ display: 'flex', gap: '10px' }}>
          <label>
            X:
            <input
              type="number"
              name="x"
              value={coordinates.x || ''}
              onChange={handleChange}
            />
          </label>
          <label>
            Y:
            <input
              type="number"
              name="y"
              value={coordinates.y || ''}
              onChange={handleChange}
            />
          </label>
          <label>
            Z:
            <input
              type="number"
              name="z"
              value={coordinates.z || ''}
              onChange={handleChange}
            />
          </label>
      </div>
      <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
          <label>
            row:
            <input
              type="number"
              name="row"
              step="1"
              value={coordinates.row || ''}
              onChange={handleChange}
            />
          </label>
          <label>
            column:
            <input
              type="number"
              name="col"
              step="1"
              value={coordinates.col || ''}
              onChange={handleChange}
            />
          </label>
          <button className="close-button" onClick={handleDelete}>
            &times;
          </button>
      </div>
    </div>
  );
};

export default XYZWidget;
