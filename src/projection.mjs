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
