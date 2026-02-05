import React from 'react';
import './widget.css'

const XYZWidget = ({ id, coordinates, onUpdate, onDelete, selectedWidgetId, setSelectedWidgetId, rowColor }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onUpdate(id, {...coordinates, [name]: value });
  };

  const handleDelete = () => {
    onDelete(id);
  };

  return (
        <tr
          onClick={() => setSelectedWidgetId(id)} // Highlight the row when clicked
          style={{
            // backgroundColor: selectedWidgetId === id ? rowColor : 'white',
            // border: selectedWidgetId === id ? `4px solid ${rowColor}` : `4px solid ${rowColor}`,
            cursor: 'pointer',
          }}
        >
          <td>
            <div className="gcp-icon"
                 key={id}
                 style={{
                   width: "30px",
                   position: "relative",
                   transform: "translate(0%, 0%)",
                   height: "30px",
                   backgroundColor: selectedWidgetId === id ? `${rowColor}` : 'white',
                   // color: selectedWidgetId === id ? 'white' : 'black',
                   border: selectedWidgetId === id ? `4px solid ${rowColor}` : `2px solid ${rowColor}`,
                   fontSize: "12px",
                   fontWeight:  selectedWidgetId === id ? "bold" : "normal"
                 }}
            >
              {id}
            </div>
          </td>
          <td>
            <input
              type="number"
              name="row"
              value={coordinates.row ?? ''}
              disabled
              className="form-control form-control-sm"
            />
          </td>
          <td>
            <input
              type="number"
              name="col"
              value={coordinates.col ?? ''}
              disabled
              className="form-control form-control-sm"
            />
          </td>
          <td>
            <input
              type="number"
              name="x"
              value={coordinates.x ?? ''}
              onChange={handleChange}
              className="form-control form-control-sm"
            />
          </td>
          <td>
            <input
              type="number"
              name="y"
              value={coordinates.y ?? ''}
              onChange={handleChange}
              className="form-control form-control-sm"
            />
          </td>
          <td>
            <input
              type="number"
              name="z"
              value={coordinates.z ?? ''}
              onChange={handleChange}
              className="form-control form-control-sm"
            />
          </td>
          <td>
            <button
              className="close-button"
              onClick={handleDelete}
              style={{
                background: "none",
                border: "none",
                color: "red",
                cursor: "pointer",
                fontSize: "1.2em",
              }}
            >
              &times;
            </button>
          </td>
        </tr>
  );
};

export default XYZWidget;
