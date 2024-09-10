import * as THREE from '../lib/three.module.js';
import {GUI} from '../lib/examples/jsm/libs/lil-gui.module.min.js';
import {MTLLoader} from '../lib/examples/jsm/loaders/MTLLoader.js';
import {OBJLoader} from '../lib/examples/jsm/loaders/OBJLoader.js';
import {OrbitControls} from '../lib/examples/jsm/controls/OrbitControls.js';

function loadModel(matPath, objPath, x, y, z, scene, rootName) {
    console.log('Loading material from ' + matPath);
    console.log('Loading model from ' + objPath);
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
                    object.name = rootName;
                    scene.add(object);
                }, function(progress) { console.log((progress.loaded/progress.total*100) + '%'); },
                function(error) {
                    console.log('Error while loading OBJ: ' + error);
                }
            );
        },
        function(progress) {
            console.log((progress.loaded/progress.total*100)+'%');
        },
        function(error) {
            console.log('Error while loading MTL: ' + error);
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
    const dirLight2 = new THREE.DirectionalLight('white', 5);
    dirLight.position.set(0, 0, -1);
    dirLight2.position.set(1, 0, 1);

    loop.updatables.push(controls);
    scene.add(ambientLight, dirLight, dirLight2);
    const resizer = new Resizer(container, camera, renderer);

    return {camera, renderer, scene, loop};
}

function render(renderer, scene, camera) {
    renderer.render(scene, camera);
}

function createUI(model) {
    const panel = new GUI({width:280});
    const folder = panel.addFolder('Model');
    var components = {};
    for (var i=0; i<model.children.length; i++) {
        var child = model.children[i];
        components[child.name] = child.material.name;
        if (child.material.name === undefined)
            components[child.name] = 'null';
        folder.add(components, child.name);
    }
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

async function main() {
    const container = document.querySelector('#scene-container');
    const {camera, renderer, scene, loop} = createWorld(container);
    const currDir = window.location.href;

    const modelPath = currDir + '/../assets/PRSModel/PRSModel.obj';
    const materialPath = currDir + '/../assets/PRSModel/PRSModel.mtl';
    loadModel(materialPath, modelPath, 0, 0, 0, scene, 'scene_root');
    var model = null;
    do {
        model = scene.getObjectByName('scene_root');
        await delay(1000);
    } while (model == null);

    createUI(model);

    // remap materials

    // neck
    const texture =
        new THREE.TextureLoader().load('../assets/PRSModel/NeckWood.jpg');
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 1);
    model.getObjectByName('Cube.004_Cube.005').material =
        new THREE.MeshPhysicalMaterial({
            color: 0xdddddd,
            metalness: 0.0,
            roughness: 0.8,
            map: texture
        });

    // logo
    const textureLogo =
        new THREE.TextureLoader().load('../assets/PRSModel/PRSLogo.jpg');
    textureLogo.center.set(0.5, 0.5);
    textureLogo.rotation = -Math.PI/2;
    model.getObjectByName('Plane.005_Plane.007').material =
        new THREE.MeshPhysicalMaterial({
            color: 0x000000,
            alphaMap: textureLogo,
            transparent: true,
            opacity: 1
        });

    // birds
    const textureBirds =
        new THREE.TextureLoader().load('../assets/PRSModel/PRSBirds.png');
    const birdMat = new THREE.MeshPhysicalMaterial({
            color: 0xaaddff,
            metalness: 1.0,
            roughness: 0.5,
            alphaMap: textureBirds,
            transparent: true,
            opacity: 1.0,
            iridescence: 1.0,
            iridescenceIOR: 1.5
        });
    model.getObjectByName('Plane.007_Plane.019').material = birdMat;
    model.getObjectByName('Plane.009_Plane.010').material = birdMat;
    model.getObjectByName('Plane.010_Plane.011').material = birdMat;
    model.getObjectByName('Plane.011_Plane.012').material = birdMat;
    model.getObjectByName('Plane.012_Plane.013').material = birdMat;
    model.getObjectByName('Plane.013_Plane.014').material = birdMat;
    model.getObjectByName('Plane.014_Plane.015').material = birdMat;
    model.getObjectByName('Plane.015_Plane.016').material = birdMat;
    model.getObjectByName('Plane.016_Plane.017').material = birdMat;
    model.getObjectByName('Plane.017_Plane.018').material = birdMat;

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
