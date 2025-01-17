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
camera.position.z = 4;
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
controls.minDistance = 2;
controls.maxDistance = 10;
const detail = 12;
const loader = new THREE.TextureLoader();
const geometry = new THREE.IcosahedronGeometry(1, detail);
const material = new THREE.MeshPhongMaterial({
  map: loader.load("./textures/00_earthmap1k.jpg"),
  specularMap: loader.load("./textures/02_earthspec1k.jpg"),
  bumpMap: loader.load("./textures/01_earthbump1k.jpg"),
  bumpScale: 0.04,
  color: 0x9aa5a6,
  saturation: 0,
});
const earthMesh = new THREE.Mesh(geometry, material);
earthGroup.add(earthMesh);

const lightsMat = new THREE.MeshBasicMaterial({
  map: loader.load("./textures/8k_earth_nightmap.jpg"),
  blending: THREE.AdditiveBlending,
  color: 0xffffff,
  opacity: 1   
});

const lightsMesh = new THREE.Mesh(geometry, lightsMat);
earthGroup.add(lightsMesh);

const cloudsMat = new THREE.MeshStandardMaterial({
  map: loader.load("./textures/8k_earth_clouds.jpg"),
  transparent: true,
  opacity: 0.7,  // Reduced from 0.8 to make clouds less dense
  blending: THREE.AdditiveBlending,
  alphaMap: loader.load('./textures/05_earthcloudmaptrans.jpg'),
  color: 0xffffff  // Changed from 0xe0e0e0 to white for brighter clouds
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

const sunLight = new THREE.DirectionalLight(0xffffff, 2.5); // Increased intensity from 2.0 to 2.5
sunLight.position.set(-2, 0.5, 1.5);
scene.add(sunLight);

function createLightPillar(country, lat, lon, color = 0xffffff) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -Math.sin(phi) * Math.cos(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.sin(theta);

  const pillarHeight = 1.5;
  const pillarRadius = 0.002;
  const baseHeight = 0.015;
  const baseRadius = pillarRadius * 12;

  // Create the main pillar
  const pillarGeometry = new THREE.CylinderGeometry(pillarRadius, pillarRadius, pillarHeight, 8, 1, true);
  
  // Create the triangular base
  const baseGeometry = new THREE.CylinderGeometry(0, baseRadius, baseHeight, 8, 1, false);

  const pillarMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      glowIntensity: { value: 2.0 },
      hoverIntensity: { value: 0.0 }
    },
    vertexShader: `
      uniform float hoverIntensity;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      
      void main() {
        vUv = uv;
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        
        // Simple scale effect on hover
        vec3 scaled = position * (1.0 + hoverIntensity * 0.15);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(scaled, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float glowIntensity;
      uniform float hoverIntensity;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      
      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float facing = dot(vNormal, viewDir);
        
        float distanceFromCenter = length(vUv - vec2(0.5, 0.5)) * 2.0;
        float intensity = exp(-distanceFromCenter * 4.0) * (glowIntensity + (hoverIntensity * step(facing, 0.0)));
        float yFalloff = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        intensity *= yFalloff;
        gl_FragColor = vec4(color * intensity, intensity * 0.8);
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

// Replace the existing countries array with this organization structure
const organizations = {
    BRICS: [
        { name: "Бразилия", lat: -23.5, lon: 47.2, flag: "/images/png22.png" },
        { name: "Эфиопия", lat: 12.7, lon: -85.3, flag: "/images/png19.png" },
        { name: "Россия", lat: 67.2, lon: 178.4, flag: "/images/png26.png" },
        { name: "Индия", lat: -45.8, lon: 22.1, flag: "/images/png16.png" },
        { name: "Китай", lat: 31.4, lon: -142.7, flag: "/images/png24.png" },
        { name: "ОАЭ", lat: -78.3, lon: 95.6, flag: "/images/png12.png" },
        { name: "ЮАР", lat: 52.9, lon: -37.8, flag: "/images/png10.png" },
        { name: "Иран", lat: -15.6, lon: 163.2, flag: "/images/png14.png" },
        { name: "Египет", lat: 82.1, lon: -159.4, flag: "/images/png06.png" },
        { name: "Саудовская Аравия", lat: -62.7, lon: 12.9, flag: "/images/png02.png" }
    ],
    SCO: [
        { name: "Казахстан", lat: 34.8, lon: -126.5, flag: "/images/png21.png" },
        { name: "Пакистан", lat: -51.2, lon: 67.8, flag: "/images/png18.png" },
        { name: "Беларусь", lat: 73.6, lon: -23.4, flag: "/images/png27.png" },
        { name: "Россия", lat: -37.9, lon: 145.2, flag: "/images/png26.png" },
        { name: "Иран", lat: 28.4, lon: -175.6, flag: "/images/png14.png" },
        { name: "Китай", lat: -84.3, lon: 34.7, flag: "/images/png24.png" },
        { name: "Индия", lat: 61.5, lon: -92.8, flag: "/images/png16.png" },
        { name: "Узбекистан", lat: -42.1, lon: 123.9, flag: "/images/png17.png" },
        { name: "Кыргызстан", lat: 15.7, lon: -148.3, flag: "/images/png20.png" },
        { name: "Таджикистан", lat: -69.4, lon: 56.1, flag: "/images/png15.png" }
    ],
    CIS: [
        { name: "Россия", lat: 43.2, lon: -67.5, flag: "/images/png26.png" },
        { name: "Армения", lat: -28.9, lon: 134.8, flag: "/images/png29.png" },
        { name: "Беларусь", lat: 76.3, lon: -157.2, flag: "/images/png27.png" },
        { name: "Молдавия", lat: -58.7, lon: 23.6, flag: "/images/png28.png" },
        { name: "Узбекистан", lat: 25.1, lon: -112.9, flag: "/images/png17.png" },
        { name: "Кыргызстан", lat: -73.8, lon: 89.4, flag: "/images/png20.png" },
        { name: "Таджикистан", lat: 54.6, lon: -45.7, flag: "/images/png15.png" },
        { name: "Азербайджан", lat: -31.2, lon: 167.3, flag: "/images/png25.png" }
    ],
    EAEU: [
        { name: "Россия", lat: 64.8, lon: -134.2, flag: "/images/png26.png" },
        { name: "Беларусь", lat: -47.5, lon: 78.9, flag: "/images/png27.png" },
        { name: "Казахстан", lat: 21.3, lon: -168.7, flag: "/images/png21.png" },
        { name: "Кыргызстан", lat: -82.6, lon: 45.3, flag: "/images/png20.png" },
        { name: "Таджикистан", lat: 58.9, lon: -78.4, flag: "/images/png15.png" }
    ],
    APEC: [
        { name: "Филиппины", lat: -34.7, lon: 156.8, flag: "/images/png32.png" },
        { name: "Австралия", lat: 71.5, lon: -89.3, flag: "/images/png31.png" },
        { name: "Сингапур", lat: -63.2, lon: 12.4, flag: "/images/png30.png" },
        { name: "Канада", lat: 37.8, lon: -145.6, flag: "/images/png28.png" },
        { name: "Россия", lat: -52.4, lon: 67.9, flag: "/images/png26.png" },
        { name: "Китай", lat: 28.6, lon: -123.8, flag: "/images/png24.png" },
        { name: "Бруней", lat: -76.9, lon: 134.5, flag: "/images/png17.png" },
        { name: "Япония", lat: 48.3, lon: -56.7, flag: "/images/png13.png" },
        { name: "Таиланд", lat: -25.7, lon: 178.2, flag: "/images/png09.png" },
        { name: "Малайзия", lat: 83.4, lon: -112.6, flag: "/images/png04.png" },
        { name: "Индонезия", lat: -57.8, lon: 89.3, flag: "/images/png03.png" },
        { name: "Республика Корея", lat: 41.6, lon: -167.5, flag: "/images/png01.png" }
    ]
};

let activeOrganization = null;
let activePillars = [];

// Update the DOM with country list
function updateCountryList(orgName) {
    const countryList = document.getElementById('country-list');
    countryList.innerHTML = '';
    
    organizations[orgName].forEach((country, index) => {
        const countryItem = document.createElement('div');
        countryItem.className = 'country-item';
        
        const flag = document.createElement('img');
        flag.alt = country.name;
        flag.src = country.flag;
        
        const name = document.createElement('span');
        name.className = 'country-name';
        name.textContent = country.name;
        
        countryItem.appendChild(name);
        countryItem.appendChild(flag);
        countryItem.addEventListener('click', () => focusOnCountry(index, orgName));
        
        countryList.appendChild(countryItem);
    });
}

// Add event listeners to organization buttons
document.querySelectorAll('.organization-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const orgName = btn.dataset.org;
        
        // Remove active class from all buttons
        document.querySelectorAll('.organization-btn').forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Remove existing pillars
        activePillars.forEach(pillar => earthGroup.remove(pillar));
        activePillars = [];
        
        // Create new pillars for selected organization
        organizations[orgName].forEach(country => {
            const pillar = createLightPillar(country.name, country.lat, country.lon);
            earthGroup.add(pillar);
            activePillars.push(pillar);
        });
        
        // Update country list
        updateCountryList(orgName);
        activeOrganization = orgName;
    });
});

let currentFocusedGroup = null;

// Update focusOnCountry function to work with organization structure
function focusOnCountry(index, orgName) {
    const country = organizations[orgName][index];
    const phi = (90 - country.lat) * (Math.PI / 180);
    const theta = (country.lon + 180) * (Math.PI / 180);

    // Calculate the position on the surface of the Earth
    const x = -Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);

    // Position camera further from the pillar
    const distance = 3; // Increased from 2 to stay further out
    const targetX = x * distance;
    const targetY = y * distance;
    const targetZ = z * distance;
    
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
        pillar.material.uniforms.hoverIntensity.value = 2.0;
    }

    // Calculate arc path points
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(targetX, targetY, targetZ);
    const arcPoints = calculateArcPath(startPos, endPos, 10);

    // Animate along the arc path
    let progress = 0;
    gsap.to({}, {
        progress: 1,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: function() {
            progress = this.progress();
            const point = getPointOnPath(arcPoints, progress);
            camera.position.copy(point);
            camera.lookAt(x * 1.015, y * 1.015, z * 1.015);
            checkCameraMovement();
        },
        onComplete: () => {
            controls.update();
            isMoving = false;
        }
    });
}

// Helper function to calculate arc path points
function calculateArcPath(start, end, numPoints) {
    const points = [];
    const center = new THREE.Vector3(0, 0, 0);
    
    // Ensure minimum distance from Earth's surface
    const minRadius = Math.max(start.length(), end.length(), 2.5);
    
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const point = new THREE.Vector3().lerpVectors(start, end, t);
        // Maintain distance from center
        point.normalize().multiplyScalar(minRadius);
        points.push(point);
    }
    return points;
}

// Helper function to get point on path
function getPointOnPath(points, progress) {
    const index = (points.length - 1) * progress;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const t = index % 1;
    
    if (upper >= points.length) return points[points.length - 1];
    
    const point = new THREE.Vector3();
    point.lerpVectors(points[lower], points[upper], t);
    return point;
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

function animate(currentTime) {
    requestAnimationFrame(animate);
    
    // Update time uniform for all pillars
    earthGroup.children.forEach(group => {
        if (group.userData && group.userData.country) {
            const pillar = group.children[0];
            if (pillar && pillar.material.uniforms) {
                pillar.material.uniforms.time = currentTime * 0.001;
            }
        }
    });

    cloudsMesh.rotation.y += 0.0002;
    glowMesh.rotation.y += 0.002;
    
    // Pass camera to updateStarVisibility
    stars.updateStarVisibility(isMoving, currentTime, camera);
    
    checkIntersections();
    
    controls.update();
    renderer.render(scene, camera);
}

animate(); // Start with currentTime = 0

function handleWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', handleWindowResize, false);