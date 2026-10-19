export function fitView(width, height, size, levels) {
  const topPadding = 24;
  const bottomPadding = 40;
  const diameter = size * Math.SQRT2;
  const groundDepth = diameter * 0.46;
  const towerHeight = (levels + 0.06) * 0.91;
  const availableHeight = height - topPadding - bottomPadding;
  const scale = Math.min((width - 40) / diameter, availableHeight / (towerHeight + groundDepth));
  return {
    scale,
    originX: width / 2,
    originY: topPadding + (availableHeight - (towerHeight + groundDepth) * scale) / 2 + (towerHeight + groundDepth / 2) * scale,
  };
}

export function projectPoint(x, y, z, angle, view, size) {
  const a = x - size / 2;
  const b = z - size / 2;
  return {
    x: view.originX + (a * Math.cos(angle) - b * Math.sin(angle)) * view.scale,
    y: view.originY + (a * Math.sin(angle) + b * Math.cos(angle)) * view.scale * 0.46 - y * view.scale * 0.91,
  };
}

export function cubeFaces(project, angle) {
  const p = project;
  const top = [p(0, 1, 0), p(1, 1, 0), p(1, 1, 1), p(0, 1, 1)];
  const sides = [];
  if (Math.cos(angle) > 0) sides.push([p(0, 1, 1), p(1, 1, 1), p(1, 0, 1), p(0, 0, 1)]);
  else sides.push([p(1, 1, 0), p(0, 1, 0), p(0, 0, 0), p(1, 0, 0)]);
  if (Math.sin(angle) > 0) sides.push([p(1, 1, 1), p(1, 1, 0), p(1, 0, 0), p(1, 0, 1)]);
  else sides.push([p(0, 1, 0), p(0, 1, 1), p(0, 0, 1), p(0, 0, 0)]);
  return { top, sides };
}

export function compareCubes(a, b, angle) {
  // The camera direction is perpendicular to both screen axes in project().
  return (a.x - b.x) * Math.sin(angle) + (a.z - b.z) * Math.cos(angle) + (a.y - b.y) * (0.46 / 0.91);
}
