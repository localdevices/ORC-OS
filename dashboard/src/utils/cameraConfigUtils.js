
export const validateBboxReady = (cameraConfig, setMessageInfo) => {
  // check if all fields are complete for defining a bounding box
  const fieldsComplete = (
    cameraConfig?.gcps?.z_0 &&
    cameraConfig?.f && cameraConfig?.k1 &&
    cameraConfig?.k2 &&
    cameraConfig?.camera_rotation &&
    cameraConfig?.camera_position
  );

  if (!fieldsComplete) {
    return false;
  }
  if (prevCameraConfig.current !== cameraConfig) {
    prevCameraConfig.current = cameraConfig;
    // check if water level values are realistic
    if (cameraConfig?.gcps?.control_points?.length > 0) {
      const avgZ = cameraConfig.gcps.control_points.reduce((sum, point) => sum + point.z, 0) /
        cameraConfig.gcps.control_points.length;
      const zDiff = (avgZ - cameraConfig?.gcps?.z_0);
      if (zDiff < 0) {
        setMessageInfo("warning", `The set water level is ${Math.abs(zDiff).toFixed(2)} above the average height of the control points suggesting all control points are submerged. Is this correct?`)
      } else if (zDiff > 20) {
        setMessageInfo("warning", `The set water level is ${zDiff.toFixed(2)} meters different from the average height of the control points. This may not be realistic.`)
      } else {
        setMessageInfo("success", "Validated set water level")
      }
    }
  }
  return true;
}
