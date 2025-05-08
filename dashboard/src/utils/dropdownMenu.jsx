import PropTypes from 'prop-types';

export const DropdownMenu = ({dropdownLabel, callbackFunc, data}) => {

  return (
    <>
      <label htmlFor={`${dropdownLabel.toLowerCase().replace(/\s+/g, '_')}`} className='form-label'>
        {dropdownLabel}
      </label>
      <select
        id={`${dropdownLabel.toLowerCase().replace(/\s+/g, '_')}`}
        onChange={(event) => callbackFunc(event.target.value)}
        className='form-control'
      >
        <option value="" disabled selected>
          {"-- Select " + dropdownLabel + " --"}
        </option>
        {data.length > 0 ? (
          data.map((item) => (
            <option key={item.id} value={item.id}>
              {`${item.id}: ${item.name}`}
            </option>
          ))
        ) : (
          <option disabled>{`${dropdownLabel} not available`}</option>
        )}
      </select>
    </>
  )
};
DropdownMenu.propTypes = {
  dropdownLabel: PropTypes.string.isRequired,
  callbackFunc: PropTypes.func.isRequired,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired
    })
  ).isRequired
};
