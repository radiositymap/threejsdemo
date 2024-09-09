import * as THREE from '../lib/three.module.js';
import {MTLLoader} from '../lib/examples/jsm/loaders/MTLLoader.js';
import {OBJLoader} from '../lib/examples/jsm/loaders/OBJLoader.js';
import {OrbitControls} from '../lib/examples/jsm/controls/OrbitControls.js';

function loadModel(matPath, objPath, x, y, z, scene) {
    const loader = new MTLLoader();
    loader.load(
        matPath,
        function(materials) {
            materials.preload();
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.load(
                objPath,
                function(object) {
                    console.log(object);
                    scene.add(object);
                },
                function(progress) {
                    console.log((progress.loaded/progress.total*100) + "%");
                },
                function(error) {
                    console.log("Error while loading OBJ: " + error);
                }
            );
        },
        function(progress) {
            console.log((progress.loaded/progress.total*100)+"%");
        },
        function(error) {
            console.log("Error while loading MTL: " + error);
        }
    );
}

class Resizer {
    setSize = (container, camera, renderer) => {
        const h = container.clientHeight;
        const w = container.clientWidth;
        camera.aspect = w/h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);
    };

    constructor(container, camera, renderer) {
        this.setSize(container, camera, renderer);
        window.addEventListener('resize', () => {
            this.setSize(container, camera, renderer);
            this.onResize();
        });
    }
    onResize() {}
}

class Loop {
    constructor(camera, scene, renderer) {
        this.clock = new THREE.Clock();
        this.camera = camera;
        this.scene = scene;
        this.renderer = renderer;
        this.updatables = [];
    }

    start() {
        this.renderer.setAnimationLoop(() => {
                this.tick();
                this.renderer.render(this.scene, this.camera);
                });
    }

    stop() {
        this.renderer.setAnimationLoop(null);
    }

    tick() {
        const delta = this.clock.getDelta();
        for (const object of this.updatables) {
            object.tick(delta);
        }
    }
}

function createWorld(container) {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true});
    renderer.physicallyCorrectLights = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('silver');

    const loop = new Loop(camera, scene, renderer);
    container.append(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.tick = () => controls.update();

    const ambientLight = new THREE.AmbientLight('white', 2);
    const dirLight = new THREE.DirectionalLight('white', 3);
    dirLight.position.set(0, 1, -2);

    loop.updatables.push(controls);
    scene.add(ambientLight, dirLight);
    const resizer = new Resizer(container, camera, renderer);

    return {camera, renderer, scene, loop};
}

function render(renderer, scene, camera) {
    renderer.render(scene, camera);
}

async function main() {
    const container = document.querySelector('#scene-container');
    const {camera, renderer, scene, loop} = createWorld(container);

    const modelPath = '../assets/PRSModel/PRSModel.obj';
    const materialPath = '../assets/PRSModel/PRSModel.mtl';
    const model = loadModel(materialPath, modelPath, 0, 0, 0, scene);

    // remap materials
    //model.getObjectByName('body').material =
    //    new THREE.MeshPhysicalMaterial({
    //        color: 0xff0000,
    //        metalness: 1.0,
    //        roughness: 0.5,
    //        clearcoat: 1.0,
    //        clearcoatRoughness: 0.05
    //    });

    //model.getObjectByName('glass').material =
    //    new THREE.MeshPhysicalMaterial({
    //        color: 0xAAAAAA,
    //        metalness: 0.25,
    //        roughness: 0,
    //        transmission: 1.0
    //    });
    //scene.add(model);

    loop.start();
}

main();
