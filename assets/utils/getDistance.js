export default function getDistance(x1, y1, x2, y2) {
  let xs = x2 - x1;
  let ys = y2 - y1;
  xs *= xs;
  ys *= ys;
  return Math.sqrt(xs + ys);
}
