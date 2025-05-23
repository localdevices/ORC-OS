
// make some colors
export const rainbowColors = Array.from({length: 10}, (_, i) => {
  const hue = (i / 10) * 360; // Distributes hues evenly across 360 degrees
  return `hsl(${hue}, 100%, 50%)`;
});
