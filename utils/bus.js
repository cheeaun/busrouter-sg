export const timeDisplay = (ms) => {
	if (ms === null) return;
	const mins = Math.floor(ms/1000/60);
	return mins <= 0 ? 'Arr' : `${mins}m`;
};

export const sortServices = (a, b) => {
  const a0 = a.toString()[0];
  const b0 = b.toString()[0];
  if (isNaN(a0) && !isNaN(b0)) return 1;
  if (!isNaN(a0) && isNaN(b0)) return -1;
  return parseInt(a, 10) - parseInt(b, 10);
};

export const sortServicesPinned = (pinnedServices) => (a, b) => {
  const pinA = pinnedServices.includes(a.no);
  const pinB = pinnedServices.includes(b.no);
  if (pinA && !pinB){
    return -1;
  } else if (pinB && !pinA){
    return 1;
  } else {
    return sortServices(a.no, b.no);
  }
};