export default function getWalkingMinutes(distance) { // meters
  const walkingSpeed = 1.4; // meter/second
  return Math.ceil(distance / walkingSpeed / 60);
};