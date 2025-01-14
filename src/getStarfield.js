import * as THREE from "three";

export default function getStarfield({ numStars = 500 } = {}) {
  function randomSpherePoint() {
    const radius = Math.random() * 25 + 25;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    let x = radius * Math.sin(phi) * Math.cos(theta);
    let y = radius * Math.sin(phi) * Math.sin(theta);
    let z = radius * Math.cos(phi);

    return {
      pos: new THREE.Vector3(x, y, z),
      hue: 0.6,
      minDist: radius,
      baseOpacity: Math.random() * 0.5 + 0.2,
    };
  }

  const verts = [];
  const colors = [];
  const opacities = [];
  const positions = [];
  const starTimers = [];
  let col;

  // Create stars
  for (let i = 0; i < numStars; i += 1) {
    let p = randomSpherePoint();
    const { pos, hue } = p;
    positions.push(p);
    col = new THREE.Color().setHSL(hue, 0.2, Math.random());
    verts.push(pos.x, pos.y, pos.z);
    colors.push(col.r, col.g, col.b);
    opacities.push(p.baseOpacity);
    starTimers.push({
      visible: Math.random() > 0.8,
      nextChange: Math.random() * 2000,
      opacity: Math.random() > 0.8 ? 1 : 0
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("opacity", new THREE.Float32BufferAttribute(opacities, 1));

  // Store original colors for reference
  const originalColors = new Float32Array(colors);

  const mat = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    map: new THREE.TextureLoader().load("./textures/stars/circle.png"),
    transparent: true,
    opacity: 1,
  });

  const points = new THREE.Points(geo, mat);
  points.targetPosition = new THREE.Vector3();
  points.currentPosition = new THREE.Vector3();

  points.updateStarVisibility = function(isMoving, currentTime, camera) {
    const colors = geo.attributes.color;
    const fadeSpeed = 0.01;
    
    // Update position with smooth follow
    points.targetPosition.copy(camera.position);
    points.currentPosition.lerp(points.targetPosition, 0.05); // Adjust this value to change follow speed
    points.position.copy(points.currentPosition);

    if (isMoving) {
        // Fade stars in during movement
        for (let i = 0; i < numStars; i++) {
            const timer = starTimers[i];
            timer.opacity = Math.min(1, timer.opacity + fadeSpeed);
            
            const baseIndex = i * 3;
            colors.array[baseIndex] = originalColors[baseIndex] * timer.opacity;
            colors.array[baseIndex + 1] = originalColors[baseIndex + 1] * timer.opacity;
            colors.array[baseIndex + 2] = originalColors[baseIndex + 2] * timer.opacity;
        }
    } else {
        // Update random stars when static
        for (let i = 0; i < numStars; i++) {
            const timer = starTimers[i];
            
            if (currentTime >= timer.nextChange) {
                timer.visible = Math.random() > 0.8;
                timer.nextChange = currentTime + 2000 + Math.random() * 3000;
            }

            // Smoothly transition opacity
            const targetOpacity = timer.visible ? 1 : 0;
            timer.opacity += (targetOpacity - timer.opacity) * fadeSpeed;
            
            const baseIndex = i * 3;
            colors.array[baseIndex] = originalColors[baseIndex] * timer.opacity;
            colors.array[baseIndex + 1] = originalColors[baseIndex + 1] * timer.opacity;
            colors.array[baseIndex + 2] = originalColors[baseIndex + 2] * timer.opacity;
        }
    }
    
    colors.needsUpdate = true;
  };

  return points;
}
