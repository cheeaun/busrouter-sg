// https://stackoverflow.com/a/21829819/20838
// http://w3c.github.io/deviceorientation/spec-source-orientation.html#worked-example
const degtorad = Math.PI / 180; // Degree-to-Radian conversion
export default function compassHeading(alpha, beta, gamma) {
  const _x = beta ? beta * degtorad : 0; // beta value
  const _y = gamma ? gamma * degtorad : 0; // gamma value
  const _z = alpha ? alpha * degtorad : 0; // alpha value

  const cX = Math.cos(_x);
  const cY = Math.cos(_y);
  const cZ = Math.cos(_z);
  const sX = Math.sin(_x);
  const sY = Math.sin(_y);
  const sZ = Math.sin(_z);

  // Calculate Vx and Vy components
  const Vx = -cZ * sY - sZ * sX * cY;
  const Vy = -sZ * sY + cZ * sX * cY;

  // Calculate compass heading
  let compassHeading = Math.atan(Vx / Vy);

  // Convert compass heading to use whole unit circle
  if (Vy < 0) {
    compassHeading += Math.PI;
  } else if (Vx < 0) {
    compassHeading += 2 * Math.PI;
  }

  return compassHeading * (180 / Math.PI); // Compass Heading (in degrees)
}
