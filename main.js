import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';

// Audio setup
let audioContext, audioElement, gainNode, audioPlaying = false;

// City parameters
const CITY_SIZE = 1000;
const BUILDING_COUNT = 500;
const ROAD_WIDTH = 20;
const BLOCK_SIZE = 80;

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
document.getElementById('container').appendChild(renderer.domElement);

// Controls
const controls = new PointerLockControls(camera, document.body);
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

// Clock for animations
const clock = new THREE.Clock();

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(100, 300, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
dirLight.shadow.camera.left = -500;
dirLight.shadow.camera.right = 500;
dirLight.shadow.camera.top = 500;
dirLight.shadow.camera.bottom = -500;
scene.add(dirLight);

// Sky
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

const sun = new THREE.Vector3();
const effectController = {
    turbidity: 10,
    rayleigh: 3,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.7,
    elevation: 45,
    azimuth: 180
};

const uniforms = sky.material.uniforms;
uniforms['turbidity'].value = effectController.turbidity;
uniforms['rayleigh'].value = effectController.rayleigh;
uniforms['mieCoefficient'].value = effectController.mieCoefficient;
uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
const theta = THREE.MathUtils.degToRad(effectController.azimuth);
sun.setFromSphericalCoords(1, phi, theta);
uniforms['sunPosition'].value.copy(sun);

// Ground
const groundGeometry = new THREE.PlaneGeometry(CITY_SIZE * 3, CITY_SIZE * 3);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x1a1a1a,
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// City generation
function generateCity() {
    const cityGroup = new THREE.Group();
    
    // Generate a grid of buildings
    for (let x = -CITY_SIZE/2; x < CITY_SIZE/2; x += BLOCK_SIZE) {
        for (let z = -CITY_SIZE/2; z < CITY_SIZE/2; z += BLOCK_SIZE) {
            // Skip some blocks for variety
            if (Math.random() < 0.1) continue;
            
            // Add buildings to each block
            const buildingsPerBlock = Math.floor(Math.random() * 4) + 1;
            for (let i = 0; i < buildingsPerBlock; i++) {
                const offsetX = (Math.random() - 0.5) * (BLOCK_SIZE - ROAD_WIDTH - 10);
                const offsetZ = (Math.random() - 0.5) * (BLOCK_SIZE - ROAD_WIDTH - 10);
                
                // Building dimensions
                const width = Math.random() * 20 + 10;
                const depth = Math.random() * 20 + 10;
                const height = Math.pow(Math.random(), 2) * 200 + 20; // More small buildings, fewer tall ones
                
                // Create building
                createBuilding(
                    cityGroup, 
                    x + offsetX, 
                    height / 2, 
                    z + offsetZ, 
                    width, 
                    height, 
                    depth
                );
            }
        }
    }
    
    // Add roads
    for (let x = -CITY_SIZE/2; x < CITY_SIZE/2; x += BLOCK_SIZE) {
        createRoad(cityGroup, x, 0.1, 0, ROAD_WIDTH, 0.2, CITY_SIZE);
    }
    
    for (let z = -CITY_SIZE/2; z < CITY_SIZE/2; z += BLOCK_SIZE) {
        createRoad(cityGroup, 0, 0.1, z, CITY_SIZE, 0.2, ROAD_WIDTH);
    }
    
    // Add street lights
    for (let x = -CITY_SIZE/2; x < CITY_SIZE/2; x += BLOCK_SIZE) {
        for (let z = -CITY_SIZE/2; z < CITY_SIZE/2; z += BLOCK_SIZE) {
            if (Math.random() < 0.7) {
                createStreetLight(cityGroup, x + BLOCK_SIZE/2 - ROAD_WIDTH/2, 0, z + BLOCK_SIZE/2 - ROAD_WIDTH/2);
            }
        }
    }
    
    scene.add(cityGroup);
}

function createBuilding(group, x, y, z, width, height, depth) {
    // Building body
    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    
    // Random building color - mostly grays, blues, and browns
    let color;
    const colorType = Math.random();
    if (colorType < 0.5) {
        // Gray buildings
        const grayValue = Math.random() * 0.5 + 0.3;
        color = new THREE.Color(grayValue, grayValue, grayValue);
    } else if (colorType < 0.8) {
        // Blue glass buildings
        color = new THREE.Color(0.2, 0.3, 0.4 + Math.random() * 0.2);
    } else {
        // Brown/tan buildings
        color = new THREE.Color(0.4 + Math.random() * 0.2, 0.3 + Math.random() * 0.1, 0.2);
    }
    
    const roughness = Math.random() * 0.7 + 0.3;
    const metalness = Math.random() * 0.5;
    
    const buildingMaterial = new THREE.MeshStandardMaterial({ 
        color: color,
        roughness: roughness,
        metalness: metalness
    });
    
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(x, y, z);
    building.castShadow = true;
    building.receiveShadow = true;
    
    // Add windows
    if (Math.random() > 0.2) {
        const windowGroup = createWindows(width, height, depth);
        windowGroup.position.set(0, 0, 0);
        building.add(windowGroup);
    }
    
    group.add(building);
    
    // Add antennas or water towers to some tall buildings
    if (height > 100 && Math.random() < 0.4) {
        if (Math.random() < 0.5) {
            createAntenna(building, 0, height/2 + 5, 0);
        } else {
            createWaterTower(building, 0, height/2 + 5, 0);
        }
    }
}

function createWindows(buildingWidth, buildingHeight, buildingDepth) {
    const windowGroup = new THREE.Group();
    
    const floors = Math.floor(buildingHeight / 3);
    const windowsPerFloor = Math.floor(buildingWidth / 2.5);
    
    const windowGeometry = new THREE.PlaneGeometry(1.5, 2);
    const windowMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.9, 0.9, 1),
        emissive: new THREE.Color(0.3, 0.3, 0.5),
        emissiveIntensity: Math.random() * 0.5 + 0.1,
        roughness: 0.1,
        metalness: 0.8
    });
    
    // Front face
    for (let y = 0; y < floors; y++) {
        for (let x = 0; x < windowsPerFloor; x++) {
            if (Math.random() < 0.2) continue; // Some windows are missing
            
            const window = new THREE.Mesh(windowGeometry, windowMaterial.clone());
            window.position.set(
                (x - windowsPerFloor/2 + 0.5) * 2.5,
                (y - floors/2 + 0.5) * 3,
                buildingDepth/2 + 0.1
            );
            
            // Randomize emissive intensity for some windows
            if (Math.random() < 0.3) {
                window.material.emissiveIntensity = Math.random() * 0.8 + 0.2;
            }
            
            windowGroup.add(window);
        }
    }
    
    // Back face
    for (let y = 0; y < floors; y++) {
        for (let x = 0; x < windowsPerFloor; x++) {
            if (Math.random() < 0.2) continue; // Some windows are missing
            
            const window = new THREE.Mesh(windowGeometry, windowMaterial.clone());
            window.position.set(
                (x - windowsPerFloor/2 + 0.5) * 2.5,
                (y - floors/2 + 0.5) * 3,
                -buildingDepth/2 - 0.1
            );
            window.rotation.y = Math.PI;
            
            // Randomize emissive intensity for some windows
            if (Math.random() < 0.3) {
                window.material.emissiveIntensity = Math.random() * 0.8 + 0.2;
            }
            
            windowGroup.add(window);
        }
    }
    
    // Side faces
    const sideWindowsPerFloor = Math.floor(buildingDepth / 2.5);
    
    for (let y = 0; y < floors; y++) {
        for (let x = 0; x < sideWindowsPerFloor; x++) {
            if (Math.random() < 0.2) continue; // Some windows are missing
            
            const window1 = new THREE.Mesh(windowGeometry, windowMaterial.clone());
            window1.position.set(
                buildingWidth/2 + 0.1,
                (y - floors/2 + 0.5) * 3,
                (x - sideWindowsPerFloor/2 + 0.5) * 2.5
            );
            window1.rotation.y = Math.PI / 2;
            
            const window2 = new THREE.Mesh(windowGeometry, windowMaterial.clone());
            window2.position.set(
                -buildingWidth/2 - 0.1,
                (y - floors/2 + 0.5) * 3,
                (x - sideWindowsPerFloor/2 + 0.5) * 2.5
            );
            window2.rotation.y = -Math.PI / 2;
            
            // Randomize emissive intensity for some windows
            if (Math.random() < 0.3) {
                window1.material.emissiveIntensity = Math.random() * 0.8 + 0.2;
                window2.material.emissiveIntensity = Math.random() * 0.8 + 0.2;
            }
            
            windowGroup.add(window1);
            windowGroup.add(window2);
        }
    }
    
    return windowGroup;
}

function createAntenna(building, x, y, z) {
    const height = Math.random() * 20 + 10;
    
    const baseGeometry = new THREE.CylinderGeometry(0.5, 1, 2, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7, metalness: 0.5 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(x, y + 1, z);
    building.add(base);
    
    const poleGeometry = new THREE.CylinderGeometry(0.2, 0.5, height, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7, metalness: 0.5 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(x, y + height/2 + 2, z);
    building.add(pole);
    
    // Add a blinking light at the top
    const lightGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const lightMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1,
        roughness: 0.3,
        metalness: 0.2
    });
    const light = new THREE.Mesh(lightGeometry, lightMaterial);
    light.position.set(x, y + height + 2, z);
    building.add(light);
    
    // Animation for blinking light
    const blinkingLight = {
        mesh: light,
        originalIntensity: 1,
        time: 0,
        update: function(dt) {
            this.time += dt;
            this.mesh.material.emissiveIntensity = this.originalIntensity * (0.5 + 0.5 * Math.sin(this.time * 2));
        }
    };
    
    animatedObjects.push(blinkingLight);
}

function createWaterTower(building, x, y, z) {
    const baseHeight = 6;
    const tankRadius = 5;
    const tankHeight = 8;
    
    // Support structure
    const supportGeometry = new THREE.CylinderGeometry(tankRadius - 2, tankRadius - 1, baseHeight, 8);
    const supportMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555555, 
        roughness: 0.8,
        metalness: 0.5
    });
    const support = new THREE.Mesh(supportGeometry, supportMaterial);
    support.position.set(x, y + baseHeight/2, z);
    building.add(support);
    
    // Tank
    const tankGeometry = new THREE.CylinderGeometry(tankRadius, tankRadius, tankHeight, 16);
    const tankMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x777777, 
        roughness: 0.6,
        metalness: 0.4
    });
    const tank = new THREE.Mesh(tankGeometry, tankMaterial);
    tank.position.set(x, y + baseHeight + tankHeight/2, z);
    building.add(tank);
    
    // Top cap
    const capGeometry = new THREE.ConeGeometry(tankRadius, 3, 16);
    const capMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x666666,
        roughness: 0.7,
        metalness: 0.3
    });
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.set(x, y + baseHeight + tankHeight + 1.5, z);
    building.add(cap);
}

function createRoad(group, x, y, z, width, height, depth) {
    const roadGeometry = new THREE.BoxGeometry(width, height, depth);
    const roadMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.position.set(x, y, z);
    road.receiveShadow = true;
    group.add(road);
    
    // Add road markings
    if (width > depth) {
        // Horizontal road
        const lineGeometry = new THREE.PlaneGeometry(depth * 0.8, 1);
        const lineMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.1
        });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x, y + 0.11, z);
        group.add(line);
    } else {
        // Vertical road
        const lineGeometry = new THREE.PlaneGeometry(1, width * 0.8);
        const lineMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.1
        });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x, y + 0.11, z);
        group.add(line);
    }
}

function createStreetLight(group, x, y, z) {
    const poleHeight = 12;
    
    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.3, 0.4, poleHeight, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.3
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(x, y + poleHeight/2, z);
    group.add(pole);
    
    // Light fixture
    const fixtureGeometry = new THREE.CylinderGeometry(1, 1.5, 1, 8);
    const fixtureMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.7,
        metalness: 0.5
    });
    const fixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial);
    fixture.position.set(x, y + poleHeight + 0.5, z);
    group.add(fixture);
    
    // Light
    const light = new THREE.PointLight(0xffffcc, 5, 40, 2);
    light.position.set(x, y + poleHeight, z);
    light.castShadow = true;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 50;
    group.add(light);
    
    // Light bulb (visible source)
    const bulbGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const bulbMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffcc,
        emissive: 0xffffcc,
        emissiveIntensity: 1,
        roughness: 0.1,
        metalness: 0.2
    });
    const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
    bulb.position.set(x, y + poleHeight - 0.2, z);
    group.add(bulb);
}

// Animation objects container
const animatedObjects = [];

// Initialize audio
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioElement = new Audio('/Midnight Void - Track 2 - Sonauto.wav');
    audioElement.loop = true;
    
    const source = audioContext.createMediaElementSource(audioElement);
    gainNode = audioContext.createGain();
    
    // Create fade-in effect
    gainNode.gain.value = 0;
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    document.getElementById('toggle-audio').addEventListener('click', toggleAudio);
}

function toggleAudio() {
    const button = document.getElementById('toggle-audio');
    
    if (audioPlaying) {
        // Fade out
        const fadeOut = audioContext.currentTime;
        gainNode.gain.setValueAtTime(gainNode.gain.value, fadeOut);
        gainNode.gain.linearRampToValueAtTime(0, fadeOut + 1);
        
        setTimeout(() => {
            audioElement.pause();
        }, 1000);
        
        button.textContent = 'Play Audio';
        audioPlaying = false;
    } else {
        audioElement.play();
        
        // Fade in
        const fadeIn = audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, fadeIn);
        gainNode.gain.linearRampToValueAtTime(1, fadeIn + 1);
        
        button.textContent = 'Pause Audio';
        audioPlaying = true;
    }
}

// Controls setup
function setupControls() {
    camera.position.set(0, 5, CITY_SIZE / 2 + 50);
    controls.getObject().position.copy(camera.position);
    
    const instructions = document.getElementById('instructions');
    
    instructions.addEventListener('click', function() {
        controls.lock();
    });
    
    controls.addEventListener('lock', function() {
        instructions.style.opacity = '0';
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        if (!audioPlaying) {
            toggleAudio();
        }
    });
    
    controls.addEventListener('unlock', function() {
        instructions.style.opacity = '1';
    });
    
    const onKeyDown = function(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'Space':
                if (canJump === true) velocity.y += 30;
                canJump = false;
                break;
        }
    };
    
    const onKeyUp = function(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };
    
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    scene.add(controls.getObject());
}

// Main initialization
function init() {
    setupControls();
    initAudio();
    generateCity();
    
    // Hide loading screen after initialization
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 2000);
    
    animate();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    
    // Update controls
    if (controls.isLocked === true) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 10.0 * delta; // gravity
        
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        
        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;
        
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        
        controls.getObject().position.y += (velocity.y * delta);
        
        // Prevent falling through the floor
        if (controls.getObject().position.y < 2) {
            velocity.y = 0;
            controls.getObject().position.y = 2;
            canJump = true;
        }
        
        // Prevent moving outside the city
        const limitX = CITY_SIZE / 2 + 50;
        const limitZ = CITY_SIZE / 2 + 50;
        
        if (controls.getObject().position.x < -limitX) controls.getObject().position.x = -limitX;
        if (controls.getObject().position.x > limitX) controls.getObject().position.x = limitX;
        if (controls.getObject().position.z < -limitZ) controls.getObject().position.z = -limitZ;
        if (controls.getObject().position.z > limitZ) controls.getObject().position.z = limitZ;
    }
    
    prevTime = time;
    
    // Update animations
    const dt = clock.getDelta();
    for (const obj of animatedObjects) {
        obj.update(dt);
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

// Initialize the application
init();

