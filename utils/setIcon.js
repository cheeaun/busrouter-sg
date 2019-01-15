export default (iconText) => {
  let iconSize = 512;
  let iconBackgroundColor = "#F01B48";
  let iconPrimaryColor = "#FFFFFF";
  let iconTextFont = `bold ${Math.round(iconSize * 0.2)}px -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif`;

  // canvas handles
  let c = document.createElement('canvas');
  c.width = iconSize;
  c.height = iconSize;
  let ctx = c.getContext("2d");

  // whitewash canvas first
  ctx.fillStyle = iconPrimaryColor;
  ctx.fillRect(0, 0, c.width, c.height);

  // draw radii. someday I hope canvas comes up with a fillRoundedRect()
  // 1:6.4 ratio (magic const of 0.15625) from https://stackoverflow.com/questions/2105289/iphone-app-icons-exact-radius
  // inset distance of 120 was eyeballed
  ctx.fillStyle = iconBackgroundColor;
  let iconInsetDistance = 120;
  let arcRadius =  Math.round(c.width * 0.15625);
  ctx.beginPath();
  ctx.moveTo(iconInsetDistance - arcRadius, iconInsetDistance);
  ctx.quadraticCurveTo(iconInsetDistance - arcRadius, iconInsetDistance - arcRadius, iconInsetDistance, iconInsetDistance - arcRadius);
  ctx.lineTo(c.width - iconInsetDistance, iconInsetDistance - arcRadius);
  ctx.quadraticCurveTo(c.width - iconInsetDistance + arcRadius, iconInsetDistance - arcRadius, c.width - iconInsetDistance + arcRadius, iconInsetDistance);
  ctx.lineTo(c.width - iconInsetDistance + arcRadius, c.height - iconInsetDistance);
  ctx.quadraticCurveTo(c.width - iconInsetDistance + arcRadius, c.height - iconInsetDistance + arcRadius, c.width - iconInsetDistance, c.height - iconInsetDistance + arcRadius);
  ctx.lineTo(iconInsetDistance, c.height - iconInsetDistance + arcRadius);
  ctx.quadraticCurveTo(iconInsetDistance - arcRadius, c.height - iconInsetDistance + arcRadius, iconInsetDistance - arcRadius, c.height - iconInsetDistance);
  ctx.lineTo(iconInsetDistance - arcRadius, iconInsetDistance);
  ctx.fill();

  // draw the icon text
  // bus stop codes are consistently 5-characters wide
  ctx.font = iconTextFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = iconPrimaryColor;
  ctx.fillText(iconText, (c.width / 2), (c.height / 2));

  // replace existing apple-touch-icon
  document.querySelectorAll('[rel="apple-touch-icon"]')[0].setAttribute("href", c.toDataURL());
};