import PropTypes from 'prop-types';

export const DropdownMenu = ({dropdownLabel, callbackFunc, data, value, defaultValue, name, disabled}) => {
  const resolveDefaultValue = () => {
    // get the default from the data if available
    if (defaultValue && data.some(item => (item.value || item.id) === defaultValue)) {
      return defaultValue;
    }
    return '';
  };

  return (
    <>
      <label htmlFor={`${dropdownLabel.toLowerCase().replace(/\s+/g, '_')}`} className='form-label'>
        {dropdownLabel}
      </label>
      <select
        id={`${dropdownLabel.toLowerCase().replace(/\s+/g, '_')}`}
        name={name}
        disabled={disabled}
        onChange={callbackFunc}
        className='form-control'
        value={disabled ? 0 : (value || "")}
      >
        <option value="">
          {"-- No value selected --"}
        </option>
        {data.length > 0 ? (
          data.map((item) => (
            <option key={item.id} value={item?.value ? item.value : item.id}>
              {`${item?.value ? item.value : item.id}: ${item.name}`}
            </option>
          ))
        ) : (
          <option disabled>{`${dropdownLabel} not available`}</option>
        )}
      </select>
    </>
  );
};
DropdownMenu.propTypes = {
  dropdownLabel: PropTypes.string.isRequired,
  callbackFunc: PropTypes.func.isRequired,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      value: PropTypes.number,
    })
  ).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  name: PropTypes.string,
  disabled: PropTypes.bool,

};
