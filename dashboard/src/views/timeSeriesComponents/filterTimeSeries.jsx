import ReactSlider from "react-slider";
import FilterDates from "../../utils/filterDates.jsx";

const FiltersTimeSeries = ({
    filterH, setFilterH, filterQ50, setFilterQ50, filterFractionVel, setFilterFractionVel, selectedVideoConfigIds,
    allVideoConfigIds, dateRange, setStartDate, setEndDate, data }) => {


    // helper functions to get the min / max values for the sliders, without getting Inf
    const safeMin = (values, fallback = 0) => {
        const arr = values.filter(v => v != null);
        if (!arr.length) return fallback;
        const m = Math.min(...arr);
        return Number.isFinite(m) ? m : fallback;
    };

    const safeMax = (values, fallback = 0) => {
        const arr = values.filter(v => v != null);
        if (!arr.length) return fallback;
        const m = Math.max(...arr);
        return Number.isFinite(m) ? m : fallback;
    };
    const handlefilterFracChange = async (value) => {
        // Ensure values are at least `minimumDifference` apart
        const updatedFilterFrac = {
            ...filterFractionVel,
            value: value
        }
        setFilterFractionVel(updatedFilterFrac);
    }

    const handlefilterHChange = async (values) => {
        let [minH, maxH] = values;
        // Ensure values are at least `minimumDifference` apart
        const updatedFilterH = {
            ...filterH,
            min: minH,
            max: maxH
        }
        setFilterH(updatedFilterH);
    }

    const handlefilterQ50Change = async (values) => {
        let [minQ50, maxQ50] = values;

        // Ensure values are at least `minimumDifference` apart
        const updatedFilterQ50 = {
            ...filterQ50,
            min: minQ50,
            max: maxQ50
        }
        setFilterQ50(updatedFilterQ50);
    }

  const convertToCSV = (data) => {
    if (data.length === 0) return '';

    // Get headers from the first object
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    // Convert each row to CSV format
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Handle null/undefined values and escape commas/quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma or quote
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  };


    const handleDownload = async () => {

        if (data.length === 0) {
            setMessageInfo('warning', 'No data available to download');
            return;
        }

        try {
            const csvContent = convertToCSV(data);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Generate filename with date range
            const startDateStr = dateRange.startDate ? new Date(dateRange.startDate).toISOString().slice(0, -1).split('T')[0] : 'start';
            const endDateStr = dateRange.endDate ? new Date(dateRange.endDate).toISOString().slice(0, -1).split('T')[0] : 'end';
            const filename = `timeseries_${startDateStr}_to_${endDateStr}.csv`;

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            setMessageInfo('success', 'Time series data downloaded successfully');
        } catch (error) {
            console.error('Error downloading CSV:', error);
            setMessageInfo('error', 'Failed to download time series data');
        }
    }
    return (
        <div className="flex-container columns no-padding">
            <div style={{ "flex": "1 1 auto" }}>
                {/* Threshold Filters */}
                <div className="mb-3">
                    {/* Video Config Filter Button */}
                    <div className="mb-5 mt-3 form-horizontal">
                        <label htmlFor="filterHSlider" className="form-label">
                            <input
                                type="checkbox"
                                checked={filterH.enabled}
                                // disabled={viewMode !== 'timeSeries'}
                                onChange={(e) => setFilterH({ ...filterH, enabled: e.target.checked })}
                                className="me-1"
                            />

                            Water level (m)
                        </label>
                        <div className="slider-container">
                            <div className="slider-min">{Math.floor(safeMin(data.map(d => d.h), 0) * 1000) / 1000 || 0}</div>
                            <div className="slider-max">{Math.ceil(safeMax(data.map(d => d.h), 1) * 1000) / 1000 || 1}</div>
                            <ReactSlider
                                className="horizontal-slider small"
                                disabled={!filterH.enabled}
                                value={[
                                    filterH.min || Math.floor(safeMin(data.map(d => d.h), 0) * 1000) / 1000 || 0,
                                    filterH.max || Math.ceil(safeMax(data.map(d => d.h), 1) * 1000) / 1000 || 1
                                ]} // Default values if unset
                                min={Math.floor(safeMin(data.map(d => d.h), 0) * 1000) / 1000 || 0}
                                max={Math.ceil(safeMax(data.map(d => d.h), 1) * 1000) / 1000 || 1}
                                step={0.001}
                                renderThumb={(props, state) => {
                                    const { key, ...rest } = props;
                                    return (
                                        <div
                                            key={key}
                                            {...rest}
                                            className={!filterH.enabled ? 'thumb thumb-disabled' : 'thumb'}
                                        >
                                            <div className="thumb-value">{state.valueNow}</div>
                                        </div>
                                    );
                                }}
                                // renderThumb={(props, state) => (
                                //   <div {...props} className={!filterH.enabled ? 'thumb thumb-disabled' : 'thumb'}>
                                //     <div className="thumb-value">{state.valueNow}</div>
                                //   </div>
                                // )}
                                onAfterChange={handlefilterHChange}
                            />
                        </div>
                    </div>
                    <div className="mb-5 mt-3 form-horizontal">
                        <label htmlFor="filterQ50Slider" className="form-label">
                            <input
                                type="checkbox"
                                checked={filterQ50.enabled}
                                // disabled={viewMode !== 'timeSeries'}
                                onChange={(e) => setFilterQ50({ ...filterQ50, enabled: e.target.checked })}
                                className="me-1"
                            />
                            Discharge (m³/s)
                        </label>
                        <div className="slider-container">
                            <div className="slider-min">{Math.floor(safeMin(data.map(d => d.q_50), 0) * 1000) / 1000 || 0}</div>
                            <div className="slider-max">{Math.ceil(safeMax(data.map(d => d.q_50), 1) * 1000) / 1000 || 1}</div>
                            <ReactSlider
                                className="horizontal-slider small"
                                disabled={!filterQ50.enabled}
                                value={[
                                    filterQ50.min || Math.floor(safeMin(data.map(d => d.q_50), 0) * 1000) / 1000 || 0,
                                    filterQ50.max || Math.ceil(safeMax(data.map(d => d.q_50), 1) * 1000) / 1000 || 1
                                ]} // Default values if unset
                                min={Math.floor(safeMin(data.map(d => d.q_50), 0) * 1000) / 1000 || 0}
                                max={Math.ceil(safeMax(data.map(d => d.q_50), 1) * 1000) / 1000 || 1}
                                step={0.001}
                                renderThumb={(props, state) => {
                                    const { key, ...rest } = props;
                                    return (
                                        <div
                                            key={key}
                                            {...rest}
                                            className={!filterQ50.enabled ? 'thumb thumb-disabled' : 'thumb'}
                                        >
                                            <div className="thumb-value">{state.valueNow}</div>
                                        </div>
                                    );
                                }}
                                onAfterChange={handlefilterQ50Change}
                            />
                        </div>
                    </div>
                    <div className="mb-2 mt-3 form-horizontal">
                        <label htmlFor="filterFracSlider" className="form-label">
                            <input
                                type="checkbox"
                                checked={filterFractionVel.enabled}
                                // disabled={viewMode !== 'timeSeries'}
                                onChange={(e) => setFilterFractionVel({ ...filterFractionVel, enabled: e.target.checked })}
                                className="me-1"
                            />
                            min. Measured to total flow [%]
                        </label>
                        <div className="slider-container">
                            <div className="slider-min">{0}</div>
                            <div className="slider-max">{100}</div>
                            <ReactSlider
                                className="horizontal-slider small"
                                disabled={!filterFractionVel.enabled}
                                value={filterFractionVel.value || 0} // Default values if unset
                                min={0}
                                max={100}
                                step={1}
                                renderThumb={(props, state) => {
                                    const { key, ...rest } = props;
                                    return (
                                        <div
                                            key={key}
                                            {...rest}
                                            className={!filterFractionVel.enabled ? 'thumb thumb-disabled' : 'thumb'}
                                        >
                                            <div className="thumb-value">{state.valueNow}</div>
                                        </div>
                                    );
                                }}
                                onAfterChange={handlefilterFracChange}
                            />
                        </div>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleDownload}
                        disabled={data.length === 0}
                    >
                        Download selected
                    </button>

                </div>
            </div>
            <div style={{ "flex": "0 0 auto", "width": "300px" }}>
                <div className="mb-3">
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowVideoConfigModal(true)}
                    >
                        Video Configuration
                        {selectedVideoConfigIds && allVideoConfigIds.length > 0 &&
                            selectedVideoConfigIds.length !== allVideoConfigIds.length &&
                            selectedVideoConfigIds.length > 0 &&
                            ` (${selectedVideoConfigIds.length} selected)`}
                    </button>
                </div>
                <FilterDates
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    setStartDate={setStartDate}
                    setEndDate={setEndDate}
                    title={"Select date range"}
                />
            </div>
        </div>
    )
};

export default FiltersTimeSeries
