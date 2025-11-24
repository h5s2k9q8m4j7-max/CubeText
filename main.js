// --- 1. IMPORT DELLE LIBRERIE ---
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import * as CANNON from 'cannon-es';
import gsap from 'gsap';
// **MODIFICA**: Importa il campionatore di superfici
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

// --- 2. SETUP INIZIALE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 20);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas-3d'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Luci
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // CORRETTO
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Controlli
const controls = new OrbitControls(camera, renderer.domElement);

// --- 3. SETUP DELLA FISICA (CANNON-ES) ---
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
});

// Materiali fisici
const defaultMaterial = new CANNON.Material('default');
const contactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 0.1,
        restitution: 0.7
    }
);
world.addContactMaterial(contactMaterial);

// Pavimento fisico
const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: defaultMaterial
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// --- 4. CREAZIONE DEI CUBI ---
const urlParams = new URLSearchParams(window.location.search);
const numCubes = parseInt(urlParams.get('numCubes')) || 500;
document.getElementById('cube-count').value = numCubes; 

document.getElementById('restart-button').addEventListener('click', () => {
    const newCount = document.getElementById('cube-count').value;
    window.location.search = `?numCubes=${newCount}`;
});

const cubeSize = 0.5;
const cubes = []; 
const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x00aaff });

for (let i = 0; i < numCubes; i++) {
    const mesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
    scene.add(mesh);
    const shape = new CANNON.Box(new CANNON.Vec3(cubeSize / 2, cubeSize / 2, cubeSize / 2));
    const body = new CANNON.Body({
        mass: 1,
        material: defaultMaterial,
        position: new CANNON.Vec3(
            (Math.random() - 0.5) * 20, 
            Math.random() * 10 + 5,   
            (Math.random() - 0.5) * 20  
        ),
    });
    body.addShape(shape);
    world.addBody(body);
    cubes.push({ mesh, body });
}
console.log(`Simulazione avviata con ${numCubes} cubi.`);

// --- 5. LOGICA DEL TESTO E ANIMAZIONE ---
let font;
const fontLoader = new FontLoader();
const textInput = document.getElementById('text-input');
const submitButton = document.getElementById('submit-button');
submitButton.disabled = true;

fontLoader.load(
    'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json',
    (loadedFont) => {
        font = loadedFont;
        submitButton.disabled = false;
        console.log("Font caricato, pronto.");
    },
    undefined, 
    (error) => {
        console.error('Errore nel caricamento del font:', error);
    }
);

submitButton.addEventListener('click', () => {
    const text = textInput.value;
    if (text === "") {
        fallDown();
    } else {
        formText(text);
    }
});

/**
 * Funzione 1: I cubi formano il testo (LOGICA "INTELLIGENTE" AGGIUNTA)
 */
function formText(text) {
    if (!font) return; 

    const detailLevel = document.getElementById('detail-select').value;
    let textGeometry;
    const targetPositions = []; // Array per le posizioni finali

    if (detailLevel === 'detailed') {
        // --- LOGICA "INTELLIGENTE" (DETTAGLIATA) CON SAMPLING ---
        textGeometry = new TextGeometry(text, {
            font: font,
            size: 3,
            height: 0.5,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.2,
            bevelSize: 0.1,
            bevelSegments: 5
        });
        textGeometry.center();

        // 1. Crea una mesh temporanea (invisibile) solo per il campionamento
        const tempMesh = new THREE.Mesh(textGeometry);
        // 2. Inizializza il campionatore
        const sampler = new MeshSurfaceSampler(tempMesh).build();
        
        // 3. Genera un punto target per ogni cubo disponibile
        const tempPosition = new THREE.Vector3();
        for (let i = 0; i < numCubes; i++) {
            sampler.sample(tempPosition);
            targetPositions.push(tempPosition.clone());
        }
        
        // 4. Mescola i PUNTI CAMPIONATI. Questo è sicuro
        // e fa sì che i cubi si riempiano in ordine casuale.
        targetPositions.sort(() => 0.5 - Math.random());

    } else {
        // --- LOGICA VECCHIA (PIXELLATA) MA CORRETTA ---
        textGeometry = new TextGeometry(text, {
            font: font,
            size: 3,
            height: 0.5, 
            curveSegments: 1, 
            bevelEnabled: false
        });
        textGeometry.center();

        // 1. Estrai solo i vertici (pochi punti)
        const points = textGeometry.attributes.position.array;
        for (let i = 0; i < points.length; i += 3) {
            targetPositions.push(new THREE.Vector3(points[i], points[i + 1], points[i + 2]));
        }
        
        // 2. NON MESCOLARE (NON FARE .sort())!
        // Rimuovere lo shuffle è la correzione chiave.
        // I vertici sono già nell'ordine corretto per formare le lettere.
        // La casualità dell'animazione è data dalla posizione
        // iniziale casuale dei cubi, non dalla posizione finale.
    }

    console.log(`Livello: ${detailLevel}, Punti generati: ${targetPositions.length}, Cubi usati: ${Math.min(numCubes, targetPositions.length)}`);

    // --- ASSEGNAZIONE CUBI (Logica invariata, ora funziona per entrambi i casi) ---
    cubes.forEach((cube, index) => {
        // Ferma *sempre* qualsiasi animazione GSAP precedente
        gsap.killTweensOf(cube.mesh.position);
        gsap.killTweensOf(cube.mesh.rotation);

        if (index < targetPositions.length) {
            // --- CUBO USATO PER IL TESTO ---
            cube.body.sleep();
            cube.body.position.set(0, 1000, 0); 
            const targetPos = targetPositions[index]; // Prende la posizione target

            gsap.to(cube.mesh.position, {
                x: targetPos.x,
                y: targetPos.y,
                z: targetPos.z,
                duration: 2,
                ease: "power3.inOut"
            });
            gsap.to(cube.mesh.rotation, {
                x: 0,
                y: 0,
                z: 0,
                duration: 2,
                ease: "power3.inOut"
            });

        } else {
            // --- CUBO EXTRA (NON USATO IN MODALITÀ PIXELLATA) ---
            cube.body.position.copy(cube.mesh.position);
            cube.body.quaternion.copy(cube.mesh.quaternion);
            cube.body.wakeUp();
        }
    });
}

/**
 * Funzione 2: I cubi cadono (LOGICA CORRETTA)
 */
function fallDown() {
    cubes.forEach(cube => {
        gsap.killTweensOf(cube.mesh.position);
        gsap.killTweensOf(cube.mesh.rotation);

        cube.body.position.copy(cube.mesh.position);
        cube.body.quaternion.copy(cube.mesh.quaternion);
        
        cube.body.velocity.set(
            (Math.random() - 0.5) * 2,
            Math.random() * 2, 
            (Math.random() - 0.5) * 2
        );
        
        cube.body.wakeUp();
    });
}


// --- 6. CICLO DI ANIMAZIONE (LOOP) ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    world.step(1 / 60, deltaTime, 10);

    cubes.forEach(cube => {
        if (cube.body.sleepState !== CANNON.Body.SLEEPING) { 
            cube.mesh.position.copy(cube.body.position);
            cube.mesh.quaternion.copy(cube.body.quaternion);
        }
    });

    controls.update();
    renderer.render(scene, camera);
}

// Gestione del ridimensionamento della finestra
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Avvia tutto
animate();