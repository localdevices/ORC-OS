// utils/deepMerge.js (or just inside the same file)
// this is meant to merge patches of components of video configs

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

/**
 * Deeply merges `patch` into `target` without mutating either.
 *
 * - Plain objects are merged recursively.
 * - Arrays, primitives, null, etc. are overwritten by the patch.
 * - If `target` is undefined/null, `patch` is returned (and vice versa).
 */
export const deepMerge = (target, patch) => {
  // If no patch, just return target
  if (patch === undefined) return target;

  // If one side is not a plain object, overwrite
  if (!isPlainObject(target) || !isPlainObject(patch)) {
    return patch;
  }

  const result = { ...target };

  for (const key of Object.keys(patch)) {
    const patchValue = patch[key];
    const targetValue = target[key];

    if (isPlainObject(patchValue) && isPlainObject(targetValue)) {
      // Recurse for nested plain objects
      result[key] = deepMerge(targetValue, patchValue);
    } else {
      // Overwrite for primitives, arrays, null, etc.
      result[key] = patchValue;
    }
  }
  return result;
};
