import { Model } from './Model.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(); 
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;

document.getElementById('ar-container').appendChild(renderer.domElement);

const arSource = new THREEx.ArToolkitSource({ sourceType: 'webcam' });
arSource.init(() => {
    onResize();
});

const arContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: './data/camera_para.dat', 
    detectionMode: 'mono',
});

arContext.init(() => {
    camera.projectionMatrix.copy(arContext.getProjectionMatrix());

    const surface = new Model();
    const geom = surface.CreateSurface();

    const mat = new THREE.MeshStandardMaterial({
        color: 0xff0010, // ← твой цвет
        side: THREE.DoubleSide,
        roughness: 0.5,
        metalness: 0.3
    });

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    scene.add(light);

    const ambient = new THREE.AmbientLight(0x404040); 
    scene.add(ambient);

    const mesh = new THREE.Mesh(geom, mat);
    mesh.scale.set(1, 1, 1);
    markerRoot.add(mesh);
});

window.addEventListener('resize', onResize);

function onResize() {
    arSource.onResizeElement();
    arSource.copyElementSizeTo(renderer.domElement);
    if (arContext.arController) {
        arSource.copyElementSizeTo(arContext.arController.canvas);
    }
}

const markerRoot = new THREE.Group();
scene.add(markerRoot);

new THREEx.ArMarkerControls(arContext, markerRoot, {
    type: 'pattern',
    patternUrl: './data/pattern.patt', 
});

(function animate() {
    requestAnimationFrame(animate);
    if (arSource.ready) arContext.update(arSource.domElement);
    renderer.render(scene, camera);
})();