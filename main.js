import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';
import { TextGeometry } from 'jsm/geometries/TextGeometry.js';
import { FontLoader } from 'jsm/loaders/FontLoader.js';

import getStarfield from "./src/getStarfield.js";
import { getFresnelMat } from "./src/getFresnelMat.js";

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 1000);
camera.position.z = 5;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const earthGroup = new THREE.Group();
earthGroup.rotation.z = -23.4 * Math.PI / 180;
scene.add(earthGroup);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
const detail = 12;
const loader = new THREE.TextureLoader();
const geometry = new THREE.IcosahedronGeometry(1, detail);
const material = new THREE.MeshPhongMaterial({
  map: loader.load("./textures/00_earthmap1k.jpg"),
  specularMap: loader.load("./textures/02_earthspec1k.jpg"),
  bumpMap: loader.load("./textures/01_earthbump1k.jpg"),
  bumpScale: 0.04,
});
const earthMesh = new THREE.Mesh(geometry, material);
earthGroup.add(earthMesh);

const lightsMat = new THREE.MeshBasicMaterial({
  map: loader.load("./textures/03_earthlights1k.jpg"),
  blending: THREE.AdditiveBlending,
});
const lightsMesh = new THREE.Mesh(geometry, lightsMat);
earthGroup.add(lightsMesh);

const cloudsMat = new THREE.MeshStandardMaterial({
  map: loader.load("./textures/04_earthcloudmap.jpg"),
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending,
  alphaMap: loader.load('./textures/05_earthcloudmaptrans.jpg'),
});
const cloudsMesh = new THREE.Mesh(geometry, cloudsMat);
cloudsMesh.scale.setScalar(1.003);
earthGroup.add(cloudsMesh);

const fresnelMat = getFresnelMat();
const glowMesh = new THREE.Mesh(geometry, fresnelMat);
glowMesh.scale.setScalar(1.01);
earthGroup.add(glowMesh);

const stars = getStarfield({numStars: 2000});
stars.material.transparent = true;
scene.add(stars);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
sunLight.position.set(-2, 0.5, 1.5);
scene.add(sunLight);

function createLightPillar(country, lat, lon, color = 0xffffff) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -Math.sin(phi) * Math.cos(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.sin(theta);

  const pillarHeight = 1.5;
  const pillarRadius = 0.004;
  const baseHeight = 0.02; // Height of the triangular base
  const baseRadius = pillarRadius * 15; // Width of the base at its widest point

  // Create the main pillar
  const pillarGeometry = new THREE.CylinderGeometry(pillarRadius, pillarRadius, pillarHeight, 8, 1, true);
  
  // Create the triangular base
  const baseGeometry = new THREE.CylinderGeometry(0, baseRadius, baseHeight, 8, 1, false);

  const pillarMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      glowIntensity: { value: 3.0 },
      hoverIntensity: { value: 0.0 },
    },
    vertexShader: `
      uniform float hoverIntensity;
      varying vec3 vPosition;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vPosition = position;
        vec3 scaled = position * (1.0 + hoverIntensity * 0.1);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(scaled, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float glowIntensity;
      uniform float hoverIntensity;
      varying vec3 vPosition;
      varying vec2 vUv;
      void main() {
        float distanceFromCenter = length(vUv - vec2(0.5, 0.5)) * 2.0;
        float intensity = exp(-distanceFromCenter * 5.0) * (glowIntensity + hoverIntensity);
        float yFalloff = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
        intensity *= yFalloff;
        gl_FragColor = vec4(color * intensity, intensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
  const base = new THREE.Mesh(baseGeometry, pillarMaterial);

  // Position and orient the pillar and base
  pillar.position.set(x, y, z);
  pillar.lookAt(0, 0, 0);
  pillar.rotateX(Math.PI / 2);
  
  base.position.set(x, y, z);
  base.lookAt(0, 0, 0);
  base.rotateX(Math.PI / 2);

  // Adjust the scale to position slightly above the Earth's surface
  const scaleAboveEarth = 1.015;
  pillar.scale.setScalar(scaleAboveEarth);
  base.scale.setScalar(scaleAboveEarth);

  const group = new THREE.Group();
  group.add(pillar);
  group.add(base);
  group.userData = { country: country };

  // Animate only the pillar, not the base
  gsap.from(pillar.scale, {
    y: 0,
    duration: 2,
    ease: "power2.out"
  });

  return group;
}



const countries = [
  { name: "USA", lat: 37.0902, lon: -95.7129, color: "#E6F8FF" },
  { name: "China", lat: 35.8617, lon: 104.1954, color: "#E6F8FF" },
  { name: "Russia", lat: 61.5240, lon: 105.3188, color: "#E6F8FF" },
  { name: "Brazil", lat: -14.2350, lon: -51.9253, color: "#E6F8FF" },
  { name: "Australia", lat: -25.2744, lon: 133.7751, color: "#E6F8FF" },
];

let currentFocusedGroup = null;

// Create light pillars for each country
Promise.all(countries.map(country => 
  createLightPillar(country.name, country.lat, country.lon, country.color)
)).then(groups => {
  groups.forEach(group => earthGroup.add(group));
  checkIntersections();
  animate();
});

function focusOnCountry(index) {
  const country = countries[index];
  const phi = (90 - country.lat) * (Math.PI / 180);
  const theta = (country.lon + 180) * (Math.PI / 180);

  const x = -Math.sin(phi) * Math.cos(theta) * 8;
  const y = Math.cos(phi) * 3;
  const z = Math.sin(phi) * Math.sin(theta) * 3;

  // Reset previous focused group
  if (currentFocusedGroup) {
    const pillar = currentFocusedGroup.children[0];
    pillar.material.uniforms.hoverIntensity.value = 0.0;
  }

  // Set new focused group
  currentFocusedGroup = earthGroup.children.find(child => 
    child.userData && child.userData.country === country.name
  );
  
  if (currentFocusedGroup) {
    const pillar = currentFocusedGroup.children[0];
    pillar.material.uniforms.hoverIntensity.value = 2.0; // Highlight focused pillar
    console.log(`Focused on ${country.name}`, currentFocusedGroup); // Debugging
  }

  gsap.to(camera.position, {
    duration: 1,
    x: x,
    y: y,
    z: z,
    onUpdate: () => {
      camera.lookAt(0, 0, 0);
      checkCameraMovement();
    },
    onComplete: () => {
      controls.update();
      isMoving = false;
    }
  });
}

let isMoving = false;
let movementTimeout;

function checkCameraMovement() {
  isMoving = true;
  clearTimeout(movementTimeout);
  movementTimeout = setTimeout(() => {
    isMoving = false;
  }, 500);
}

controls.addEventListener('change', checkCameraMovement);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener('mousemove', onMouseMove, false);

let hoveredGroup = null;

function checkIntersections() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(earthMesh, true);

  // Reset all pillars
  earthGroup.children.forEach(group => {
    if (group.userData && group.userData.country) {
      const pillar = group.children[0];
      if (pillar && pillar.material.uniforms) {
        gsap.to(pillar.material.uniforms.hoverIntensity, { value: 0.0, duration: 0.3 });
      }
    }
  });

  if (intersects.length > 0) {
    const intersectedPoint = intersects[0].point;
    const closestPillar = earthGroup.children.reduce((closest, child) => {
      if (child.userData && child.userData.country) {
        const distance = child.children[0].position.distanceTo(intersectedPoint);
        return (!closest || distance < closest.distance) ? { obj: child, distance } : closest;
      }
      return closest;
    }, null);

    if (closestPillar && closestPillar.distance < 0.5) {
      const pillar = closestPillar.obj.children[0];
      if (pillar && pillar.material.uniforms) {
        gsap.to(pillar.material.uniforms.hoverIntensity, { value: 2.0, duration: 0.3 });
      }
    }
  }
}

function handleListItemHover(country, isHovering) {
  earthGroup.children.forEach(group => {
    if (group.userData && group.userData.country === country) {
      const pillar = group.children[0];
      const base = group.children[1];
      const hoverIntensity = isHovering ? 2.0 : 0.0;

      if (pillar && pillar.material.uniforms) {
        gsap.to(pillar.material.uniforms.hoverIntensity, { value: hoverIntensity, duration: 0.3 });
      }
      if (base && base.material.uniforms) {
        gsap.to(base.material.uniforms.hoverIntensity, { value: hoverIntensity, duration: 0.3 });
      }
    }
  });
}

const countryListUl = document.getElementById('country-list-ul');
countries.forEach((country, index) => {
  const li = document.createElement('li');
  li.textContent = country.name;
  li.style.color = '#' + country.color.toString(16).padStart(6, '0');
  li.addEventListener('click', () => focusOnCountry(index));
  li.addEventListener('mouseenter', () => handleListItemHover(country.name, true));
  li.addEventListener('mouseleave', () => handleListItemHover(country.name, false));
  countryListUl.appendChild(li);
});

function animate() {
  requestAnimationFrame(animate);
  cloudsMesh.rotation.y += 0.0002;
  glowMesh.rotation.y += 0.002;
  stars.rotation.y -= 0.0002;
  
  if (isMoving) {
    stars.material.opacity = Math.min(stars.material.opacity + 0.05, 1);
  } else {
    stars.material.opacity = Math.max(stars.material.opacity - 0.05, 0);
  }
  
  checkIntersections();
  
  controls.update();
  renderer.render(scene, camera);
}
function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', handleWindowResize, false);