import * as THREE from 'three';
import jquery from 'jquery';

const $ = jquery;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();

renderer.setSize( window.innerWidth, window.innerHeight );

const geometry = new THREE.SphereGeometry(1, 8, 3);
const material = new THREE.MeshBasicMaterial({ color: "#0xffffff", wireframe: true });
const cube = new THREE.Mesh( geometry, material );

scene.add(cube);
scene.background = new THREE.Color( 'skyblue' );

// camera.position
camera.position.set(0, 0, 10);

// Light scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

function animate() {
	requestAnimationFrame( animate );

  cube.rotation.x += 0.01;
	cube.rotation.y += 0.01;

	renderer.render( scene, camera );
}

animate();

document.body.appendChild(renderer.domElement);