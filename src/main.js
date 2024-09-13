import * as THREE from '../lib/three.module.js';
import {GUI} from '../lib/examples/jsm/libs/lil-gui.module.min.js';
import {MTLLoader} from '../lib/examples/jsm/loaders/MTLLoader.js';
import {OBJLoader} from '../lib/examples/jsm/loaders/OBJLoader.js';
import {OrbitControls} from '../lib/examples/jsm/controls/OrbitControls.js';
import {depthvert} from '../shaders/depthvert.js';
import {depthfrag} from '../shaders/depthfrag.js';

const currDir = window.location.href;
var target = null;
var depthScene = null;
var depthCamera = null;
var depthMaterial = null;
var renderDepth = false;

function setLoadingMessage(message, request) {
    var progress = Math.round(request.loaded/request.total*100);
    document.querySelector('#message').innerHTML = message + progress + '%';
}

function loadEnvMap(scene, sceneRoot, mapPath) {
    var textureLoader = new THREE.TextureLoader();
    var envMap = textureLoader.load(mapPath);
    envMap.mapping = THREE.EquirectangularReflectionMapping;
    sceneRoot.traverse((node) => {
            if (node.isMesh) {
                if (Array.isArray(node.material)) {
                    for (var i=0; i<node.material.length; i++)
                        node.material[i].envMap = envMap;
                }
                else
                    node.material.envMap = envMap;
            }
        });
    scene.background = envMap;
    scene.backgroundBlurriness = 0.1;
    scene.environment = envMap;
    return sceneRoot;
}

function loadModel(matPath, objPath, envPath, scene, rootName) {
    const loader = new MTLLoader();
    loader.load(matPath,
        function(materials) {
            materials.preload();
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.load(
                objPath,
                function(object) {
                    object.name = rootName;
                    scene.add(object);
                },
                function(request) {
                    setLoadingMessage('Loading materials... ', request);
                },
                function(error) {
                    console.log('Error while loading OBJ: ' + error);
                }
            );
        },
        function(request) {
            setLoadingMessage('Loading model... ', request);
        },
        function(error) {
            console.log('Error while loading MTL: ' + error);
        }
    );
}

class Resizer {
    setSize = (container, camera, renderer) => {
        camera.aspect = container.clientWidth/container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
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

                if (renderDepth) {
                    this.renderer.setRenderTarget(target);
                    this.renderer.render(this.scene, this.camera);

                    depthMaterial.uniforms.depthTex.value =
                        target.depthTexture;

                    this.renderer.setRenderTarget(null);
                    this.renderer.render(depthScene, depthCamera);
                } else {
                    this.renderer.setRenderTarget(null);
                    this.renderer.render(this.scene, this.camera);
                }
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
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true});
    renderer.physicallyCorrectLights = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('silver');

    const loop = new Loop(camera, scene, renderer);
    container.append(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.tick = () => controls.update();

    const ambientLight = new THREE.AmbientLight('white', 1);
    const dirLight = new THREE.DirectionalLight('white', 2);
    const dirLight2 = new THREE.DirectionalLight('white', 3.8);
    dirLight.position.set(0, 0, -1);
    dirLight2.position.set(1, 0, 1.2);

    loop.updatables.push(controls);
    scene.add(ambientLight, dirLight, dirLight2);
    const resizer = new Resizer(container, camera, renderer);

    return {camera, renderer, scene, loop};
}

function createUI(model, materials) {
    const panel = new GUI({width:250});

    const settingsFolder = panel.addFolder('Settings');
    const settings = {
        renderMode: 0,
        wireframeColour: 0x93ffe8
    }
    const meshes = model.children;
    settingsFolder.add(settings,
        'renderMode', {Lit: 0, Wireframe: 1, Depth: 2})
        .name('Render Mode')
        .onChange(val => {
            if (val == 0) {
                renderDepth = false;
                for (var i=0; i<meshes.length; i++)
                    meshes[i].material = materials[meshes[i].name];
            }
            if (val == 1) {
                renderDepth = false;
                const wireMat = new THREE.MeshBasicMaterial({
                    color: settings.wireframeColour,
                    wireframe: true,
                    wireframeLinewidth: 0.2
                });
                wireMat.name = 'Wireframe';
                for (var i=0; i<meshes.length; i++)
                    meshes[i].material = wireMat;
            }
            if (val == 2) {
                renderDepth = true;
                const depthMat = new THREE.MeshBasicMaterial({
                    wireframe: false,
                });
                depthMat.name = 'Depth';
                for (var i=0; i<meshes.length; i++)
                    meshes[i].material = depthMat;
            }
         });
    settingsFolder.addColor(settings, 'wireframeColour')
        .name('Wireframe Colour')
        .onChange(val => {
            if (settings.renderMode == 1) {
                const wireMat = new THREE.MeshBasicMaterial({
                    color: val,
                    wireframe: true,
                    wireframeLinewidth: 0.2
                });
                for (var i=0; i<meshes.length; i++)
                    meshes[i].material = wireMat;
            }
        });

    const modelFolder = panel.addFolder('Model');
    var components = {};
    for (var i=0; i<meshes.length; i++) {
        components[meshes[i].name] = meshes[i].material.name;
        if (meshes[i].material.name === undefined)
            components[meshes[i].name] = 'null';
        modelFolder.add(components, meshes[i].name);
    }
    modelFolder.close();
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

function remapMaterials(model) {

    // top
    const topTexPath = currDir + '/../assets/PRSModel/PRSTop.jpg';
    const textureTop = new THREE.TextureLoader().load(topTexPath);
    textureTop.colorSpace = THREE.SRGBColorSpace;
    const topMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0,
            roughness: 0.1,
            map: textureTop,
            clearcoat: 0.8,
            clearcoatRoughness: 0,
            reflectivity: 0.8,
            specularIntensity: 0.3
        });
    topMat.name = 'Top';
    model.getObjectByName('Plane').material[1] = topMat;

    // neck
    const woodTexPath = currDir + '/../assets/PRSModel/NeckWood.jpg';
    const textureWood = new THREE.TextureLoader().load(woodTexPath);
    textureWood.wrapS = THREE.RepeatWrapping;
    textureWood.wrapT = THREE.RepeatWrapping;
    textureWood.repeat.set(5, 1);
    const woodMat = new THREE.MeshPhysicalMaterial({
            color: 0xdddddd,
            metalness: 0.0,
            roughness: 0.8,
            map: textureWood
        });
    woodMat.name = 'Wood';
    model.getObjectByName('Cube.004_Cube.005').material = woodMat;

    // logo
    const logoTexPath = currDir + '/../assets/PRSModel/PRSLogo.png';
    const textureLogo = new THREE.TextureLoader().load(logoTexPath);
    textureLogo.colorSpace = THREE.SRGBColorSpace;
    const logoMat = new THREE.MeshPhysicalMaterial({
            color: 0x000000,
            map: textureLogo,
            transparent: true,
            opacity: 1
        });
    logoMat.name = 'Logo';
    model.getObjectByName('Plane.005_Plane.007').material = logoMat;

    // birds
    const birdsTexPath = currDir + '/../assets/PRSModel/PRSBirds.png';
    const textureBirds = new THREE.TextureLoader().load(birdsTexPath);
    const birdsNormPath = currDir + '/../assets/PRSModel/FoilNormal.jpg';
    const normBirds = new THREE.TextureLoader().load(birdsNormPath);
    normBirds.wrapS = THREE.RepeatWrapping;
    normBirds.wrapT = THREE.RepeatWrapping;
    normBirds.repeat.set(5, 1);
    const birdMat = new THREE.MeshPhysicalMaterial({
            color: 0xbdedff,
            metalness: 1.0,
            roughness: 0.6,
            normalMap: normBirds,
            normalMapType: THREE.ObjectSpaceNormalMap,
            alphaMap: textureBirds,
            transparent: true,
            opacity: 1.0,
            iridescence: 0.9,
            iridescenceIOR: 1.8
        });
    birdMat.name = 'Birds';
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

    // metal
    const metalMat = new THREE.MeshPhysicalMaterial({
            color: 0x999999,
            metalness: 1.0,
            roughness: 0.15,
            opacity: 1
        });
    metalMat.name = 'Metallic';
    for (var i=0; i<model.children.length; i++) {
        if (model.children[i].material.name != undefined &&
                model.children[i].material.name == 'Metal') {
            model.children[i].material = metalMat;
        }
    }
    model.getObjectByName('Cylinder.024_Cylinder.025').material[3] = metalMat;
    model.getObjectByName('Cylinder.025_Cylinder.027').material[3] = metalMat;

    // glass
    const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.01,
            transmission: 1,
            thickness: 0.025,
            ior: 1.5
        });
    glassMat.name = 'Glassy';
    model.getObjectByName('Cylinder.024_Cylinder.025').material[1] = glassMat;
    model.getObjectByName('Cylinder.025_Cylinder.027').material[1] = glassMat;
    // cavity cover
    const coverMat = new THREE.MeshPhysicalMaterial({
            color: 0x000000,
            metalness: 0.5,
            roughness: 0.3,
            reflectivity: 0.8
        });
    coverMat.name = 'Cover';
    model.getObjectByName('Cube.037_Cube.294').material = coverMat;
}

function saveMaterials(model) {
    var materials = {};
    for (var i=0; i<model.children.length; i++)
        materials[model.children[i].name] = model.children[i].material;
    return materials;
}

function initRenderTarget(renderer) {
    if (target)
        target.dispose();

    const format = parseInt( THREE.DepthFormat );
    const type = parseInt( THREE.UnsignedShortType );
    const samples = parseInt( 0 );

    const dpr = renderer.getPixelRatio();
    target = new THREE.WebGLRenderTarget(
            window.innerWidth * dpr, window.innerHeight * dpr);
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.magFilter = THREE.NearestFilter;
    target.stencilBuffer =
        (format === THREE.DepthStencilFormat) ? true : false;
    target.samples = samples;

    target.depthTexture = new THREE.DepthTexture();
    target.depthTexture.format = format;
    target.depthTexture.type = type;
}

function initDepthPass() {
    depthCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    depthMaterial = new THREE.ShaderMaterial({
        vertexShader: depthvert,
        fragmentShader: depthfrag,
        uniforms: {
            depthTex: {value:null}
        }
    });
    const plane = new THREE.PlaneGeometry(2,2);
    const quad = new THREE.Mesh(plane, depthMaterial);
    depthScene = new THREE.Scene();
    depthScene.add(quad);
}

async function main() {
    const container = document.querySelector('#scene-container');
    const {camera, renderer, scene, loop} = createWorld(container);
    initRenderTarget(renderer);
    initDepthPass();

    const modelPath = currDir + '/../assets/PRSModel/PRSModel.obj';
    const materialPath = currDir + '/../assets/PRSModel/PRSModel.mtl';
    const envMapPath = currDir + '/../assets/brown_photostudio_07.jpg';
    loadModel(materialPath, modelPath, envMapPath, scene, 'scene_root');
    var model = null;
    do {
        model = scene.getObjectByName('scene_root');
        await delay(1000);
    } while (model == null);
    document.querySelector('#message').innerHTML = "";

    document.querySelector('#footer').innerHTML =
        'Model and textures from ' +
        'https://www.cgtrader.com/designers/bootbadger04';

    remapMaterials(model);
    loadEnvMap(scene, model, envMapPath);
    const materials = saveMaterials(model);
    createUI(model, materials);

    loop.start();
}

main();
