// HABILIDADES PERDIDAS - juego de la feria USAM
// Motor: Three.js (lib/three). Mundo: assets/usam.glb exportado desde Blender (BLENDER/USAM_RECORRIDO.blend).
// Ejes: x = avanzar por el recorrido (entrada -> plaza). z negativo = lado izquierdo (Via Masferrer), z positivo = derecho (retratos).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- CONFIGURACION (lo que se ajusta a mano) ----------
const ENLACES = {
  leo: '#', abi: '#', fabi: '#',            // <- portafolios (pendiente de Leo)
  podcast: '#', corto: '#'                  // <- podcast y "Mujeres creadoras"
};
const INICIO = new THREE.Vector3(-6, 0, 0);  // punto de inicio iluminado (acera de la entrada)
const PERSONAJES = [
  { id: 'leo',  nombre: 'Leo',  habilidad: 'Diseño gráfico y 3D', icono: 'pluma',   color: '#f2b93b',
    casa: new THREE.Vector3(112, 0, 3), velHuida: 5.4,
    intro: 'Leo necesita encontrar su habilidad de DISEÑO GRÁFICO Y 3D. Anda suelta en la plaza de la escultura roja. Corre tras ella, atrápala y vuelve al punto de inicio.' },
  { id: 'abi',  nombre: 'Abi',  habilidad: 'Publicidad',          icono: 'megafono', color: '#ff5fa8',
    casa: new THREE.Vector3(77, 0, 0), velHuida: 6.0,
    intro: 'Ahora Abi necesita encontrar su habilidad de PUBLICIDAD. Anda suelta por el lado B, junto a la escalera Bienvenidos. Atrápala y regresa al inicio.' },
  { id: 'fabi', nombre: 'Fabi', habilidad: 'Edición de video',    icono: 'claqueta', color: '#5fd3ff',
    casa: new THREE.Vector3(25, 0, -14), velHuida: 6.6,
    intro: 'Por último Fabi necesita encontrar su habilidad de EDICIÓN DE VIDEO. Se escondió en la fuente del busto, entrando por la Vía Masferrer. ¡Es la más rápida!' }
];
const VEL_CAMINAR = 3.6, VEL_CORRER = 7.2, RADIO = 0.45, ALTURA_PJ = 1.75;
const RADIO_HUIDA = 11, DIST_ATRAPAR = 1.1, R_HAB = 0.75;   // R_HAB: ancho de la habilidad para que no se meta en paredes   // dificultad: a que distancia empieza a huir y que tan cerca hay que llegar

// ---------- ESCENA ----------
const canvas = document.getElementById('mundo');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const CIELO = new THREE.Color('#a3122e');
scene.background = CIELO;
scene.fog = new THREE.Fog('#4a1030', 60, 170);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

scene.add(new THREE.HemisphereLight('#ff7090', '#3040a0', 0.7));
const sol = new THREE.DirectionalLight('#ffffff', 1.3); sol.position.set(-30, 60, 40); scene.add(sol); scene.add(sol.target);
// sombras: solo alrededor del personaje (la "camara" de la sombra lo sigue) para que sea liviano en el celular
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024);
Object.assign(sol.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 160 }); sol.shadow.bias = -0.0015;
const LUZ_OFFSET = new THREE.Vector3(-30, 60, 40);
const contra = new THREE.DirectionalLight('#ff2a4a', 1.2); contra.position.set(60, 25, -30); scene.add(contra);

// degradado de 3 tonos para el cel shading
const tonos = new Uint8Array([60, 60, 90, 255, 140, 140, 165, 255, 230, 230, 235, 255]);
const gradiente = new THREE.DataTexture(tonos, 3, 1, THREE.RGBAFormat);
gradiente.minFilter = gradiente.magFilter = THREE.NearestFilter; gradiente.needsUpdate = true;
const LINEA = new THREE.LineBasicMaterial({ color: '#0b0b25' });

// ---------- TEXTURAS PINTADAS (por codigo; se reemplazan por imagenes en assets/texturas/<material>.jpg) ----------
// Cada material de Blender (M_azul_edificio, M_baldosa...) usa un tipo de textura. Son grises: se multiplican por el color.
const TIPO_TEXTURA = { azul_edificio: 'bloque', gris_azul: 'bloque', azul_marino: 'bloque', baldosa: 'baldosa', adoquin: 'adoquin',
  piso_rojo: 'concreto', acera: 'concreto', planta: 'follaje', jardin: 'follaje', morado: 'follaje', madera: 'madera', gris: 'concreto', verde: 'lamina' };
const ESCALA_TEXTURA = { bloque: 4, baldosa: 2, adoquin: 2, concreto: 6, follaje: 2, madera: 2, lamina: 2, lapiz: 3 };
function rnd(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function texturaPintada(tipo) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const r = rnd(tipo.length * 977);
  g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
  const linea = (x0, y0, x1, y1, a, w = 2) => { g.strokeStyle = `rgba(20,20,60,${a})`; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const sombreado = (n, a) => { for (let i = 0; i < n; i++) { const x = r() * N, y = r() * N, l = 10 + r() * 30; linea(x, y, x + l, y - l * 0.6, a * r(), 1.2); } };
  if (tipo === 'bloque') {            // bloques de concreto (como el edificio azul) + rayado de lapiz
    for (let y = 0; y < N; y += 32) { linea(0, y, N, y + (r() - 0.5) * 3, 0.35, 2.5); const off = (y / 32) % 2 ? 32 : 0; for (let x = off; x < N; x += 64) linea(x, y, x + (r() - 0.5) * 2, y + 32, 0.25, 2); }
    sombreado(220, 0.18);
  } else if (tipo === 'baldosa') {
    for (let i = 0; i <= N; i += 64) { linea(i, 0, i + (r() - 0.5) * 3, N, 0.3, 2.5); linea(0, i, N, i + (r() - 0.5) * 3, 0.3, 2.5); }
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(255,255,255,${0.25 * r()})`; g.fillRect(((r() * 4) | 0) * 64 + 6, ((r() * 4) | 0) * 64 + 6, 40, 10); }
    sombreado(80, 0.12);
  } else if (tipo === 'adoquin') {    // adoquin hexagonal
    const R = 22; for (let y = -R, f = 0; y < N + R; y += R * 1.5, f++) for (let x = (f % 2) * R * 0.866 - R; x < N + R; x += R * 1.732) {
      g.strokeStyle = 'rgba(20,20,60,0.4)'; g.lineWidth = 2.5; g.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; g.lineTo(x + Math.cos(a) * (R - 2), y + Math.sin(a) * (R - 2)); } g.closePath(); g.stroke();
      g.fillStyle = `rgba(20,20,60,${0.08 * r()})`; g.fill();
    }
    sombreado(60, 0.1);
  } else if (tipo === 'concreto') {
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(20,20,60,${0.12 * r()})`; g.fillRect(r() * N, r() * N, 2, 2); }
    for (let i = 0; i < 5; i++) { let x = r() * N, y = r() * N; for (let k = 0; k < 6; k++) { const nx = x + (r() - 0.5) * 40, ny = y + r() * 30; linea(x, y, nx, ny, 0.18, 1.2); x = nx; y = ny; } }
    sombreado(120, 0.12);
  } else if (tipo === 'follaje') {
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,40,30' : '255,255,255'},${0.22 * r()})`; g.beginPath(); g.ellipse(r() * N, r() * N, 6 + r() * 12, 4 + r() * 7, r() * 3, 0, 7); g.fill(); }
  } else if (tipo === 'madera') {
    for (let y = 0; y < N; y += 21) { linea(0, y, N, y, 0.35, 2); for (let k = 0; k < 4; k++) linea(r() * N, y + 4 + r() * 12, r() * N, y + 4 + r() * 12, 0.15, 1); }
  } else if (tipo === 'lamina') {
    for (let x = 0; x < N; x += 16) { linea(x, 0, x, N, 0.3, 3); linea(x + 6, 0, x + 6, N, 0.1, 2); }
  } else sombreado(260, 0.16);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const cacheTexturas = {};
function texturaDe(mat) {
  const tipo = TIPO_TEXTURA[mat] || 'lapiz';
  if (!cacheTexturas[mat]) {
    cacheTexturas[mat] = texturaPintada(tipo);
    // si existe una imagen hecha a mano/IA para este material, la usa en lugar de la pintada
    new THREE.TextureLoader().load(`assets/texturas/${mat}.jpg`, img => {
      img.wrapS = img.wrapT = THREE.RepeatWrapping; img.colorSpace = THREE.SRGBColorSpace;
      cacheTexturas[mat].image = img.image; cacheTexturas[mat].needsUpdate = true;
    }, undefined, () => {});
  }
  return { tex: cacheTexturas[mat], escala: ESCALA_TEXTURA[tipo] };
}
// coordenadas de textura segun la posicion en el mundo (proyeccion por cara: piso, pared X, pared Z)
function uvMundo(geo, escala) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / escala; uv[i * 2 + 1] = v / escala;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ---------- MUNDO ----------
const pisos = [], obstaculos = [], solidos = [];
function rect(obj) { const b = new THREE.Box3().setFromObject(obj); return { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, y1: b.max.y }; }

function prepararMundo(gltf) {
  const raiz = gltf.scene;
  raiz.updateMatrixWorld(true);
  const mallas = [];
  raiz.traverse(o => { if (o.isMesh) mallas.push(o); });
  // juntar todas las piezas por material: menos dibujos por cuadro = mas fluido en el celular
  const grupos = new Map(), bordes = [];
  for (const m of mallas) {
    const nombre = m.name || m.parent?.name || '';
    if (/^(arbol_|tronco_)/.test(nombre)) continue;      // los arboles ahora son imagenes planas (ver ARBOLES)
    if (/^PISO_/.test(nombre)) pisos.push(rect(m));
    else {
      // todo lo que toca el suelo estorba: paredes, escaleras, columnas, postes, bancas...
      const r = rect(m), b = new THREE.Box3().setFromObject(m);
      const decorado = /LETRERO|retrato|jardin_v|balcon|franja|piedra|busto|pergola|escultura_marco/.test(nombre);
      if (!decorado && b.min.y < 1.8) obstaculos.push({ ...r, n: nombre });
      if (/^OBST_arbol_base/.test(nombre)) continue;      // la base del arbol estorba pero no se dibuja
    }
    const mat = (m.material.name || '').replace(/^M_/, '') || 'gris';
    let geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const { escala } = texturaDe(mat); uvMundo(geo, escala);
    const esPiso = /^PISO_/.test(nombre), bloqueaCamara = !esPiso && !/LETRERO|retrato|jardin_v|balcon|poste|pergola|piedra/.test(nombre);
    const clave = `${mat}|${esPiso ? 'p' : bloqueaCamara ? 's' : 'd'}`;
    if (!grupos.has(clave)) grupos.set(clave, { mat, color: m.material.color.clone(), geos: [], esPiso, bloqueaCamara });
    grupos.get(clave).geos.push(geo);
    const e = new THREE.EdgesGeometry(geo, 35); bordes.push(e);
  }
  for (const gr of grupos.values()) {
    const geo = mergeGeometries(gr.geos, false);
    const malla = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: gr.color, gradientMap: gradiente, map: texturaDe(gr.mat).tex }));
    malla.receiveShadow = true; malla.castShadow = !gr.esPiso;
    scene.add(malla); if (gr.bloqueaCamara) solidos.push(malla);
  }
  const lineas = new THREE.LineSegments(mergeGeometries(bordes, false), LINEA); scene.add(lineas);
}

// ---------- FONDOS COMO IMAGENES PLANAS (siluetas de ciudad detras de los muros, estilo cartel) ----------
function texturaCiudad(semilla, base, ventanas, alto) {
  const W = 2048, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const r = rnd(semilla);
  let x = 0;
  while (x < W) {
    const w = 60 + r() * 160, h = H * (0.25 + r() * alto), y = H - h;
    g.fillStyle = base; g.fillRect(x, y, w, h);
    if (r() < 0.35) { g.fillRect(x + w * 0.3, y - 30 - r() * 40, w * 0.15, 40 + r() * 40); }      // antenas / torres
    // ventanas encendidas
    for (let wy = y + 14; wy < H - 10; wy += 22) for (let wx = x + 10; wx < x + w - 14; wx += 18)
      if (r() < 0.22) { g.fillStyle = ventanas[(r() * ventanas.length) | 0]; g.fillRect(wx, wy, 8, 10); g.fillStyle = base; }
    // borde de luz roja arriba (como en la ilustracion)
    g.fillStyle = 'rgba(255,60,90,0.55)'; g.fillRect(x, y, w, 3);
    x += w + r() * 6;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
function crearFondos() {
  const capas = [
    { dist: 34, alto: 34, color: '#141a4a', vent: ['#ff4f7a', '#f2b93b', '#3a4bb0'], sem: 11, a: 0.75 },
    { dist: 60, alto: 50, color: '#2a1a50', vent: ['#ff7aa0', '#6a5ad0'], sem: 29, a: 0.55 }
  ];
  for (const k of capas) {
    for (const lado of [-1, 1]) {   // izquierda y derecha del recorrido
      const tex = texturaCiudad(k.sem + (lado > 0 ? 7 : 0), k.color, k.vent, k.a); tex.repeat.x = 2;
      const plano = new THREE.Mesh(new THREE.PlaneGeometry(260, k.alto), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide }));
      plano.position.set(60, k.alto / 2 - 1, lado * k.dist); scene.add(plano);
    }
    for (const [x, rot] of [[150 + k.dist * 0.5, -Math.PI / 2], [-35 - k.dist * 0.4, Math.PI / 2]]) {   // al fondo y detras de la entrada
      const tex = texturaCiudad(k.sem + 3, k.color, k.vent, k.a);
      const plano = new THREE.Mesh(new THREE.PlaneGeometry(140, k.alto), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide }));
      plano.position.set(x, k.alto / 2 - 1, 0); plano.rotation.y = rot; scene.add(plano);
    }
  }
}
crearFondos();

// ---------- ARBOLES COMO IMAGENES PLANAS ----------
// Se pintan por codigo (copas por capas con cel shading, borde rojo y contorno). Si existe assets/arbol_<tipo>.png, se usa esa imagen.
function texturaArbol(semilla, tipo) {
  const W = 512, H = 768, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const r = rnd(semilla);
  const alto = tipo === 'alto', arbusto = tipo === 'arbusto';
  const cx = W / 2, base = H - 10, copaY = arbusto ? H - 250 : alto ? 260 : 300, rx = arbusto ? 210 : alto ? 130 : 200, ry = arbusto ? 170 : alto ? 230 : 190;
  const bolas = [];
  for (let i = 0; i < (arbusto ? 9 : 14); i++) { const a = r() * 6.283, d = Math.sqrt(r()); bolas.push([cx + Math.cos(a) * rx * 0.62 * d, copaY + Math.sin(a) * ry * 0.62 * d, (arbusto ? 70 : 60) + r() * 55]); }
  bolas.sort((p, q) => p[1] - q[1]);
  if (!arbusto) {   // tronco con ramas
    g.lineCap = 'round'; g.strokeStyle = '#0b0b25'; g.lineWidth = 34; g.beginPath(); g.moveTo(cx, base); g.lineTo(cx + 6, copaY + 40); g.stroke();
    g.strokeStyle = '#3a2440'; g.lineWidth = 24; g.beginPath(); g.moveTo(cx, base); g.lineTo(cx + 6, copaY + 40); g.stroke();
    g.strokeStyle = '#ff3a5a'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + 9, base); g.lineTo(cx + 15, copaY + 60); g.stroke();
  }
  const circulo = (x, y, rr) => { g.beginPath(); g.arc(x, y, rr, 0, 6.283); };
  g.fillStyle = '#0b0b25'; for (const [x, y, rr] of bolas) { circulo(x, y, rr + 7); g.fill(); }          // contorno
  g.fillStyle = '#16304a'; for (const [x, y, rr] of bolas) { circulo(x, y, rr); g.fill(); }              // sombra azulada
  g.fillStyle = '#25603e'; for (const [x, y, rr] of bolas) { circulo(x - rr * 0.18, y - rr * 0.2, rr * 0.78); g.fill(); }   // tono medio
  g.fillStyle = '#3f8a4a'; for (const [x, y, rr] of bolas) if (y < copaY + 20) { circulo(x - rr * 0.3, y - rr * 0.35, rr * 0.42); g.fill(); }   // luz
  g.strokeStyle = '#ff3a5a'; g.lineWidth = 6; for (const [x, y, rr] of bolas) if (x > cx - 20 && y < copaY + 30) { g.beginPath(); g.arc(x, y, rr - 3, -1.2, 0.2); g.stroke(); }   // borde rojo del cielo
  for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(11,11,37,0.35)'; g.lineWidth = 2; const x = cx + (r() - 0.5) * rx * 1.6, y = copaY + (r() - 0.3) * ry * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y - 6); g.stroke(); }   // rayado de lapiz
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const ARBOLES = [   // posiciones en el juego (x = recorrido, z: negativo = izquierda)
  { x: -3, z: -9, tipo: 'redondo', alto: 7 }, { x: -3, z: 9, tipo: 'redondo', alto: 7 },
  { x: 104, z: 6, tipo: 'redondo', alto: 8 }, { x: 117, z: -7, tipo: 'alto', alto: 9.5 }, { x: 121, z: 3, tipo: 'redondo', alto: 7.5 },
  { x: 100, z: -12, tipo: 'arbusto', alto: 2.6 }, { x: 125, z: 11, tipo: 'arbusto', alto: 2.4 }
];
ARBOLES.forEach((a, i) => {
  const tex = texturaArbol(100 + i * 13, a.tipo);
  new THREE.TextureLoader().load(`assets/arbol_${a.tipo}.png`, img => { img.colorSpace = THREE.SRGBColorSpace; s.material.map = img; s.material.needsUpdate = true; }, undefined, () => {});
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.3, fog: true }));
  s.center.set(0.5, 0); s.scale.set(a.alto * 512 / 768, a.alto, 1); s.position.set(a.x, 0, a.z); scene.add(s);
  const rt = a.tipo === 'arbusto' ? 0.9 : 0.35;   // el tronco (o el arbusto) estorba
  obstaculos.push({ x0: a.x - rt, x1: a.x + rt, z0: a.z - rt, z1: a.z + rt });
});

// ---------- COLISIONES ----------
// se revisan las 4 esquinas del personaje: asi no se mete en las paredes (antes solo se miraba el centro)
function puntoEnPiso(x, z) { for (const p of pisos) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) return true; return false; }
function enPiso(x, z, r = RADIO) { return puntoEnPiso(x - r, z - r) && puntoEnPiso(x + r, z - r) && puntoEnPiso(x - r, z + r) && puntoEnPiso(x + r, z + r) && puntoEnPiso(x, z); }
function libre(x, z, r = RADIO) {
  if (!enPiso(x, z, r)) return false;
  for (const o of obstaculos) if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return false;
  return true;
}
function mover(pos, dx, dz, r = RADIO) {
  // en pasos cortos, para que nada atraviese una pared delgada aunque vaya rapido
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2)); let ok = false;
  for (let i = 0; i < n; i++) {
    const sx = dx / n, sz = dz / n;
    if (libre(pos.x + sx, pos.z + sz, r)) { pos.x += sx; pos.z += sz; ok = true; continue; }
    if (libre(pos.x + sx, pos.z, r)) { pos.x += sx; ok = true; }
    if (libre(pos.x, pos.z + sz, r)) { pos.z += sz; ok = true; }
  }
  return ok;
}

// ---------- PERSONAJE (recorte 2D dentro del mundo 3D) ----------
const cargador = new THREE.TextureLoader();
const texturas = {};
function crearSprite(tex) {
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.2 });
  const s = new THREE.Sprite(mat);
  const asp = tex.image.width / tex.image.height;
  s.scale.set(ALTURA_PJ * asp, ALTURA_PJ, 1);
  s.center.set(0.5, 0); s.userData.ancho = ALTURA_PJ * asp;
  return s;
}
const jugador = new THREE.Group(); scene.add(jugador);
let spritePJ = null, mirandoIzq = false;
// poses de caminar: assets/<id>_espalda_0.png (quieto), _1 (pie izq adelante), _2 (pie der adelante). Si no existen, usa la de frente.
const poses = {};
function poseDe(id, tipo) { const p = poses[id]; if (!p) return texturas[id]; if (tipo === 'frente') return texturas[id]; return p[tipo] || texturas[id]; }
function ponerPose(tex) {
  if (!spritePJ || !tex || spritePJ.material.map === tex) return;
  spritePJ.material.map = tex; spritePJ.material.needsUpdate = true;
  const asp = tex.image.width / tex.image.height; spritePJ.userData.ancho = ALTURA_PJ * asp;
}
const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: '#12081a', transparent: true, opacity: 0.45 }));
sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.02; jugador.add(sombra);

// ---------- HABILIDADES (iconos que flotan y huyen) ----------
function iconoTextura(tipo, color) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  grad.addColorStop(0, color); grad.addColorStop(0.45, color + 'cc'); grad.addColorStop(1, color + '00');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#1a2363'; g.beginPath(); g.arc(128, 128, 62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#f3e9ef'; g.fillStyle = '#f3e9ef'; g.lineWidth = 9; g.lineJoin = g.lineCap = 'round';
  g.save(); g.translate(128, 128);
  if (tipo === 'pluma') { // pluma vectorial
    g.beginPath(); g.moveTo(0, -38); g.lineTo(26, 8); g.lineTo(0, 34); g.lineTo(-26, 8); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(0, -38); g.lineTo(0, 6); g.stroke(); g.beginPath(); g.arc(0, 10, 6, 0, Math.PI * 2); g.fill();
  } else if (tipo === 'megafono') {
    g.beginPath(); g.moveTo(-30, -10); g.lineTo(-10, -10); g.lineTo(26, -32); g.lineTo(26, 32); g.lineTo(-10, 10); g.lineTo(-30, 10); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(-18, 10); g.lineTo(-12, 32); g.stroke();
  } else { // claqueta
    g.strokeRect(-32, -8, 64, 42);
    g.beginPath(); g.moveTo(-32, -20); g.lineTo(32, -34); g.stroke();
    g.beginPath(); g.moveTo(-14, -24); g.lineTo(-6, -10); g.moveTo(6, -28); g.lineTo(14, -14); g.stroke();
  }
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const habilidades = PERSONAJES.map(p => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconoTextura(p.icono, p.color), transparent: true, depthWrite: false }));
  s.scale.set(1.6, 1.6, 1);
  const g = new THREE.Group(); g.add(s); g.position.copy(p.casa); scene.add(g);
  return { p, grupo: g, sprite: s, atrapada: false, fase: Math.random() * 6, rebote: 0, dirAzar: new THREE.Vector2(1, 0) };
});

// punto de inicio iluminado
const anillo = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.6, 40), new THREE.MeshBasicMaterial({ color: '#f2b93b', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
anillo.rotation.x = -Math.PI / 2; anillo.position.copy(INICIO).setY(0.03); scene.add(anillo);
const haz = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#f2b93b', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
haz.position.copy(INICIO).setY(4.5); scene.add(haz);

// ---------- ESTADO ----------
const E = { fase: 'menu', idx: 0, lleva: false, t0: 0, rumbo: 0, camRumbo: 0, anim: 0 };
const $ = id => document.getElementById(id);
function aviso(txt, ms = 1800) { const a = $('aviso'); a.textContent = txt; a.classList.add('ver'); clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove('ver'), ms); }

function ponerPersonaje(i) {
  const p = PERSONAJES[i];
  if (spritePJ) jugador.remove(spritePJ);
  spritePJ = crearSprite(texturas[p.id]); jugador.add(spritePJ);
  jugador.position.copy(INICIO).add(new THREE.Vector3(1.5, 0, 0));
  E.rumbo = 0; E.camRumbo = 0; E.lleva = false;
  $('hudCara').src = `assets/cara_${p.id}.png`; $('hudTitulo').textContent = p.nombre;
  $('hudTexto').textContent = `Atrapa: ${p.habilidad}`;
}
function mostrarIntro(i) {
  const p = PERSONAJES[i];
  $('introCara').src = `assets/cara_${p.id}.png`; $('introTitulo').textContent = p.nombre.toUpperCase();
  $('introTexto').textContent = p.intro;
  $('intro').classList.remove('oculto'); E.fase = 'intro';
}
function jugar() { $('intro').classList.add('oculto'); ['hud', 'flecha', 'dist', 'zonaJoy', 'joy', 'ayudaJoy'].forEach(id => $(id).classList.remove('oculto')); E.fase = 'juego'; if (!E.t0) E.t0 = performance.now(); setTimeout(() => $('ayudaJoy').classList.add('oculto'), 6000); }
function terminar() {
  E.fase = 'final'; ['hud', 'flecha', 'dist', 'zonaJoy', 'joy'].forEach(id => $(id).classList.add('oculto'));
  const s = Math.round((performance.now() - E.t0) / 1000);
  $('tiempoFinal').textContent = `Tu tiempo: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('final').classList.remove('oculto');
}
function reiniciar() {
  habilidades.forEach(h => { h.atrapada = false; h.grupo.visible = true; h.grupo.position.copy(h.p.casa); });
  document.querySelectorAll('#progreso span').forEach(s => s.classList.remove('ok'));
  E.idx = 0; E.t0 = 0; ponerPersonaje(0); $('final').classList.add('oculto'); mostrarIntro(0);
}

// ---------- CONTROLES ----------
const joy = { x: 0, y: 0, activo: false, id: null, cx: 0, cy: 0 };
const zona = $('zonaJoy'), base = $('joy'), perilla = $('perilla');
function centroJoy() { const r = base.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width / 2]; }
function moverJoy(e) {
  const [cx, cy, R] = centroJoy(); let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  perilla.style.transform = `translate(${dx}px,${dy}px)`; joy.x = dx / R; joy.y = dy / R;
}
zona.addEventListener('pointerdown', e => { joy.activo = true; joy.id = e.pointerId; zona.setPointerCapture(e.pointerId); moverJoy(e); });
zona.addEventListener('pointermove', e => { if (joy.activo && e.pointerId === joy.id) moverJoy(e); });
const soltar = e => { if (e.pointerId !== joy.id) return; joy.activo = false; joy.x = joy.y = 0; perilla.style.transform = ''; };
zona.addEventListener('pointerup', soltar); zona.addEventListener('pointercancel', soltar);
const teclas = {};
addEventListener('keydown', e => teclas[e.key.toLowerCase()] = true);
addEventListener('keyup', e => teclas[e.key.toLowerCase()] = false);
function entrada() {
  let x = joy.x, y = joy.y;
  const k = (a, b) => (teclas[a] || teclas[b]) ? 1 : 0;
  const kx = k('d', 'arrowright') - k('a', 'arrowleft'), ky = k('s', 'arrowdown') - k('w', 'arrowup');
  if (kx || ky) { const n = Math.hypot(kx, ky); x = kx / n * (teclas['shift'] ? 1 : 0.6); y = ky / n * (teclas['shift'] ? 1 : 0.6); }
  return { x, y, mag: Math.min(1, Math.hypot(x, y)) };
}

// ---------- BUCLE ----------
const reloj = new THREE.Clock();
const ray = new THREE.Raycaster();
const tmp = new THREE.Vector3(), objetivo = new THREE.Vector3();

function actualizarJugador(dt) {
  const inp = entrada();
  if (inp.mag > 0.12) {
    // direccion relativa a la camara
    const ang = Math.atan2(inp.x, -inp.y) + E.camRumbo;
    const vel = inp.mag > 0.85 ? VEL_CORRER : VEL_CAMINAR * Math.max(0.5, inp.mag);
    const dx = Math.cos(ang) * vel * dt, dz = Math.sin(ang) * vel * dt;
    mover(jugador.position, dx, dz);
    E.rumbo = ang; E.anim += dt * vel * 1.6;
    if (Math.abs(inp.x) > 0.25) mirandoIzq = inp.x < 0;
    // la camara se acomoda detras, despacio
    let d = ang - E.camRumbo; d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < 2.4) E.camRumbo += d * Math.min(1, dt * 1.1 * inp.mag);
  }
  if (spritePJ) {
    const id = PERSONAJES[E.idx].id, camina = inp.mag > 0.12;
    const haciaCamara = inp.y > 0.45;                     // si viene hacia la camara se le ve de frente
    let tex;
    if (haciaCamara) tex = poseDe(id, 'frente');
    else if (!camina) tex = poseDe(id, 'quieto');
    else { const f = Math.floor(E.anim) % 4; tex = poseDe(id, f === 0 ? 'paso1' : f === 2 ? 'paso2' : 'quieto'); }
    ponerPose(tex);
    const b = camina ? Math.abs(Math.sin(E.anim * Math.PI / 2)) * 0.06 : 0;
    spritePJ.position.y = b;
    const ancho = spritePJ.userData.ancho || spritePJ.scale.x;
    spritePJ.scale.set(mirandoIzq ? -Math.abs(ancho) : Math.abs(ancho), ALTURA_PJ, 1);
  }
}

function actualizarHabilidades(dt, t) {
  for (const h of habilidades) {
    if (h.atrapada) continue;
    const g = h.grupo, pj = jugador.position;
    h.sprite.position.y = 1.4 + Math.sin(t * 2.2 + h.fase) * 0.25;
    h.sprite.material.rotation = Math.sin(t * 1.5 + h.fase) * 0.15;
    const dx = g.position.x - pj.x, dz = g.position.z - pj.z, dist = Math.hypot(dx, dz);
    let vx = 0, vz = 0;
    const esLaMia = h.p === PERSONAJES[E.idx] && !E.lleva;
    if (E.fase === 'juego' && dist < RADIO_HUIDA) {   // huir del jugador, con zigzag para que cueste mas
      const vel = esLaMia ? h.p.velHuida : 3;
      const zig = esLaMia ? Math.sin(t * 3.1 + h.fase) * 0.55 : 0;
      vx = (dx / dist - dz / dist * zig) * vel; vz = (dz / dist + dx / dist * zig) * vel;
      // si choca, probar a los lados
      if (!libre(g.position.x + vx * dt * 3, g.position.z + vz * dt * 3, R_HAB)) {
        const izq = libre(g.position.x - vz * dt * 3, g.position.z + vx * dt * 3, R_HAB);
        if (izq) { const a = vx; vx = -vz; vz = a; } else { const a = vx; vx = vz; vz = -a; }
      }
    } else {                                           // pasear cerca de su casa
      if (Math.random() < dt * 0.6) h.dirAzar.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
      vx = h.dirAzar.x * 1.2; vz = h.dirAzar.y * 1.2;
      const cx = h.p.casa.x - g.position.x, cz = h.p.casa.z - g.position.z;
      if (Math.hypot(cx, cz) > 6) { vx += cx * 0.4; vz += cz * 0.4; }
    }
    mover(g.position, vx * dt, vz * dt, R_HAB);
    // contacto
    if (E.fase === 'juego' && dist < DIST_ATRAPAR && h.rebote <= 0) {
      if (esLaMia) {
        h.atrapada = true; g.visible = false; E.lleva = true;
        document.querySelectorAll('#progreso span')[E.idx].classList.add('ok');
        $('hudTexto').textContent = '¡La tienes! Vuelve al punto de inicio';
        aviso(`¡${h.p.nombre} recuperó ${h.p.habilidad.toUpperCase()}!`, 2400);
      } else {
        const actual = PERSONAJES[E.idx];
        aviso(E.lleva ? `Ya tienes la de ${actual.nombre}: vuelve al inicio` : `Esa no es de ${actual.nombre}: es ${h.p.habilidad} de ${h.p.nombre}`, 2200);
        h.rebote = 1.5; mover(g.position, dx / dist * 3, dz / dist * 3, R_HAB);
      }
    }
    h.rebote -= dt;
  }
}

function actualizarObjetivo() {
  const actual = habilidades[E.idx];
  if (E.lleva) objetivo.copy(INICIO); else objetivo.copy(actual.grupo.position);
  // flecha: angulo del objetivo relativo a la camara
  const dx = objetivo.x - jugador.position.x, dz = objetivo.z - jugador.position.z;
  const ang = Math.atan2(dz, dx) - E.camRumbo;
  $('flecha').style.transform = `rotate(${ang * 180 / Math.PI}deg)`;
  const d = Math.hypot(dx, dz);
  $('dist').textContent = (E.lleva ? 'Punto de inicio · ' : 'Habilidad · ') + Math.round(d) + ' m';
  // entregar en el inicio
  if (E.lleva && jugador.position.distanceTo(INICIO) < 1.8) {
    E.lleva = false; E.idx++;
    if (E.idx >= PERSONAJES.length) { terminar(); return; }
    aviso('¡Cambio de personaje!', 1400);
    ponerPersonaje(E.idx); E.fase = 'pausa'; setTimeout(() => mostrarIntro(E.idx), 900);
  }
}

function actualizarCamara(dt) {
  const pj = jugador.position;
  const atras = 5.0, alto = 2.6;
  const deseada = tmp.set(pj.x - Math.cos(E.camRumbo) * atras, alto, pj.z - Math.sin(E.camRumbo) * atras);
  // que la camara no atraviese paredes
  const cabeza = new THREE.Vector3(pj.x, 1.6, pj.z);
  const dir = deseada.clone().sub(cabeza); const largo = dir.length(); dir.normalize();
  ray.set(cabeza, dir); ray.far = largo;
  const golpe = ray.intersectObjects(solidos, false)[0];
  if (golpe) deseada.copy(cabeza).addScaledVector(dir, Math.max(0.8, golpe.distance - 0.3));
  camera.position.lerp(deseada, Math.min(1, dt * 6));
  sol.position.copy(pj).add(LUZ_OFFSET); sol.target.position.copy(pj);
  camera.lookAt(pj.x + Math.cos(E.camRumbo) * 3, 1.4, pj.z + Math.sin(E.camRumbo) * 3);
}

function cuadro() {
  // la velocidad no depende de cuantos cuadros por segundo de el celular: se divide en pasos cortos
  const total = Math.min(0.2, reloj.getDelta()), t = reloj.elapsedTime;
  const pasos = Math.max(1, Math.ceil(total / 0.034)), dt = total / pasos;
  for (let i = 0; i < pasos; i++) {
    if (E.fase === 'juego') { actualizarJugador(dt); actualizarObjetivo(); }
    actualizarHabilidades(dt, t);
  }
  anillo.material.opacity = 0.6 + Math.sin(t * 4) * 0.3;
  const cerca = Math.min(1, Math.max(0, (jugador.position.distanceTo(INICIO) - 3) / 6));   // el haz se apaga si el personaje esta adentro
  haz.material.opacity = (E.lleva ? 0.35 + Math.sin(t * 4) * 0.1 : 0.15) * cerca;
  if (E.fase === 'menu') { // camara de presentacion recorriendo el pasillo
    const x = 20 + Math.sin(t * 0.08) * 40; camera.position.set(x, 6, 3); camera.lookAt(x + 12, 3, -2);
  } else actualizarCamara(total);
  renderer.render(scene, camera);
  requestAnimationFrame(cuadro);
}

function ajustar() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 72 : 60; camera.updateProjectionMatrix(); }
addEventListener('resize', ajustar); ajustar();

// ---------- ARRANQUE ----------
for (const [k, v] of Object.entries({ linkLeo: ENLACES.leo, linkAbi: ENLACES.abi, linkFabi: ENLACES.fabi, linkPodcast: ENLACES.podcast, linkCorto: ENLACES.corto })) $(k).href = v;
const btn = $('btnEmpezar');
const manager = new THREE.LoadingManager();
manager.onProgress = (u, a, b) => $('cargando').textContent = `Cargando ${Math.round(a / b * 100)}%`;
manager.onLoad = () => { btn.disabled = false; btn.textContent = 'EMPEZAR A JUGAR'; $('cargando').textContent = ''; ponerPersonaje(0); };
const VERSION_MUNDO = '5';   // subir este numero cada vez que se exporte un usam.glb nuevo (asi el celular no usa el viejo guardado)
new GLTFLoader(manager).load('assets/usam.glb?v=' + VERSION_MUNDO, prepararMundo, undefined, e => { $('cargando').textContent = 'No se pudo cargar el mundo'; console.error(e); });
for (const p of PERSONAJES) {
  new THREE.TextureLoader(manager).load(`assets/${p.id}.png`, t => { t.colorSpace = THREE.SRGBColorSpace; texturas[p.id] = t; });
  poses[p.id] = {};
  [['quieto', 0], ['paso1', 1], ['paso2', 2]].forEach(([k, n]) => new THREE.TextureLoader().load(`assets/${p.id}_espalda_${n}.png`,
    t => { t.colorSpace = THREE.SRGBColorSpace; poses[p.id][k] = t; }, undefined, () => {}));
}
btn.onclick = () => { $('inicio').classList.add('oculto'); mostrarIntro(0); };
$('btnIr').onclick = jugar;
$('btnOtraVez').onclick = reiniciar;
// acceso solo para pruebas desde la consola (mover al personaje, ver el estado)
window.__prueba = { jugador, E, obstaculos, pisos, ir: (x, z) => { jugador.position.set(x, 0, z); }, girar: a => { E.camRumbo = a; } };
cuadro();
