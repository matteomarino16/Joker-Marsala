import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

var host = document.querySelector('.hero-3d');
var hero = document.querySelector('.hero');
if (host && hero) {
  try { init(); } catch (e) { console.warn('Hero 3D non disponibile:', e); }
}

function init() {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  var camBase = new THREE.Vector3(0, 3.0, 8.4);
  camera.position.copy(camBase);
  camera.lookAt(0, 0, 0);

  // Luci: chiave calda (forno), riempimento neutro, rim leggeri nei colori del logo
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x281436, 0.45));
  var key = new THREE.DirectionalLight(0xffe0b5, 2.1);
  key.castShadow = true;
  key.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
  key.shadow.camera.left = -3.2; key.shadow.camera.right = 3.2;
  key.shadow.camera.top = 3.2; key.shadow.camera.bottom = -3.2;
  key.shadow.camera.near = 1; key.shadow.camera.far = 20;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.035;
  scene.add(key, key.target);
  var fill = new THREE.DirectionalLight(0xdfe6ff, 0.5);
  fill.position.set(-5, 3, 2);
  scene.add(fill);
  var rimPurple = new THREE.PointLight(0x9d4edd, 14, 12);
  rimPurple.position.set(-4, 1.2, -2.5);
  scene.add(rimPurple);
  var rimGreen = new THREE.PointLight(0x3ddc4a, 8, 12);
  rimGreen.position.set(4, 0.6, -2.5);
  scene.add(rimGreen);

  var stage = new THREE.Group();
  scene.add(stage);
  var pizzaGroup = new THREE.Group();
  pizzaGroup.visible = false;
  stage.add(pizzaGroup);

  var maxAniso = renderer.capabilities.getMaxAnisotropy();
  function canvasTex(c) {
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  }
  function rand(seed) {
    return function() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }

  // ---------- Tagliere di legno ----------
  var BOARD_R = 1.95;
  var Y_BOTTOM = -0.05;
  function makeWood() {
    var c = document.createElement('canvas');
    c.width = c.height = 1024;
    var x = c.getContext('2d');
    x.fillStyle = '#9a6537';
    x.fillRect(0, 0, 1024, 1024);
    var r = rand(7);
    for (var i = 0; i < 260; i++) {
      var y0 = r() * 1024;
      x.strokeStyle = r() > 0.5 ? 'rgba(60,30,10,' + (0.08 + r() * 0.18) + ')' : 'rgba(255,210,150,' + (0.05 + r() * 0.1) + ')';
      x.lineWidth = 0.6 + r() * 3;
      x.beginPath();
      var amp = 4 + r() * 10, f = 0.004 + r() * 0.01, ph = r() * 6;
      for (var px = 0; px <= 1024; px += 16) {
        var py = y0 + Math.sin(px * f + ph) * amp + Math.sin(px * f * 3.1 + ph) * amp * 0.3;
        if (px === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
    return canvasTex(c);
  }
  var woodTop = new THREE.MeshStandardMaterial({ map: makeWood(), roughness: 0.62, metalness: 0, envMapIntensity: 0.5 });
  var woodSide = new THREE.MeshStandardMaterial({ color: 0x6e4220, roughness: 0.7, envMapIntensity: 0.4 });
  var board = new THREE.Mesh(new THREE.CylinderGeometry(BOARD_R, BOARD_R * 0.985, 0.09, 128), [woodSide, woodTop, woodSide]);
  board.position.y = Y_BOTTOM - 0.052;
  board.receiveShadow = true;
  pizzaGroup.add(board);

  // un velo di farina sul tagliere
  (function() {
    var r = rand(42), N = 900, pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var a = r() * Math.PI * 2, d = 1.25 + Math.pow(r(), 0.7) * (BOARD_R - 1.3);
      pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = Y_BOTTOM - 0.001; pos[i * 3 + 2] = Math.sin(a) * d;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pizzaGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xf3ead8, size: 0.012, transparent: true, opacity: 0.75, depthWrite: false })));
  })();

  // ---------- Impasto crudo: la stessa pizza, "scotta" con uno shader ----------
  function makeRawDough() {
    var c = document.createElement('canvas');
    c.width = c.height = 512;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(256, 256, 30, 256, 256, 256);
    g.addColorStop(0, '#f4e6c6');
    g.addColorStop(0.8, '#ecd9b0');
    g.addColorStop(1, '#e2c895');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    var r = rand(17);
    for (var i = 0; i < 90; i++) {
      x.fillStyle = 'rgba(205,170,110,' + (0.06 + r() * 0.1) + ')';
      x.beginPath();
      x.ellipse(r() * 512, r() * 512, 6 + r() * 26, 4 + r() * 14, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    for (i = 0; i < 1400; i++) {
      x.fillStyle = 'rgba(255,255,255,' + (0.25 + r() * 0.5) + ')';
      x.fillRect(r() * 512, r() * 512, 1.6, 1.6);
    }
    return canvasTex(c);
  }
  var rawTex = makeRawDough();
  // uniform condivisi da tutti i materiali della pizza
  var bakeU = {
    uBake: { value: 1 },   // 0 = impasto crudo, 1 = pizza cotta
    uTop: { value: 1 },    // altezza dei condimenti
    uRise: { value: 1 },   // il cornicione cresce in forno
    uGlow: { value: 0 },   // bordo incandescente durante la cottura
    uRaw: { value: rawTex }
  };

  // ombra di contatto sotto il tagliere
  var shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  var sctx = shadowCanvas.getContext('2d');
  var sg = sctx.createRadialGradient(64, 64, 20, 64, 64, 64);
  sg.addColorStop(0, 'rgba(0,0,0,0.6)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 128, 128);
  var contact = new THREE.Mesh(
    new THREE.PlaneGeometry(4.9, 4.9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, opacity: 0 })
  );
  contact.rotation.x = -Math.PI / 2;
  // l'ombra morbida si inclina insieme al tagliere: se restasse ferma lo taglierebbe con una riga dritta
  contact.position.y = Y_BOTTOM - 0.14;
  contact.renderOrder = -1;
  pizzaGroup.add(contact);

  // ---------- Pizza (geometria ricavata dalla foto) ----------
  var R = 1.5;
  var sliceLen = Math.PI / 3.6;
  var sliceMid = -Math.PI / 3.6;
  var sliceStart = sliceMid - sliceLen / 2;
  var sliceDir = new THREE.Vector3(Math.cos(sliceMid), 0, -Math.sin(sliceMid));
  var mainPizza = null, slice = null, strings = [], cutMeshes = [], topMatRef = null, pizzaReady = false;
  // gruppo che contiene pizza, fetta e fili: è lui che viene lanciato in aria
  var pie = new THREE.Group();
  pizzaGroup.add(pie);

  var img = new Image();
  img.decoding = 'async';
  img.onload = function() {
    buildPizza(img);
    pizzaReady = true;
    pizzaGroup.visible = true;
    renderOnce();
  };
  img.src = 'hero-pizza.jpg';

  function buildPizza(image) {
    var S = 512;
    var cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(image, 0, 0, S, S);
    var sharp = cx.getImageData(0, 0, S, S).data;
    cx.filter = 'blur(3px)';
    cx.drawImage(image, 0, 0, S, S);
    var soft = cx.getImageData(0, 0, S, S).data;

    function sample(data, u, v) {
      var px = Math.min(S - 1, Math.max(0, Math.round(u * (S - 1))));
      var py = Math.min(S - 1, Math.max(0, Math.round((1 - v) * (S - 1))));
      var i = (py * S + px) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    }

    // contorno reale della pizza nella foto, per ogni angolo
    // (cerchiamo colori caldi: l'ombra grigia sotto la pizza nella foto va ignorata)
    var A = 360, edge = new Float32Array(A);
    for (var k = 0; k < A; k++) {
      var th = k / A * Math.PI * 2, rr = 0.5;
      for (; rr > 0.3; rr -= 0.002) {
        var c = sample(sharp, 0.5 + Math.cos(th) * rr, 0.5 + Math.sin(th) * rr);
        if (c[0] - c[2] > 45 && c[0] > 120) break;
      }
      edge[k] = rr;
    }
    var smooth = new Float32Array(A);
    for (k = 0; k < A; k++) {
      var sum = 0;
      for (var d = -4; d <= 4; d++) sum += edge[(k + d + A) % A];
      smooth[k] = sum / 9;
    }
    function edgeAt(theta) {
      var f = (((theta / (Math.PI * 2)) % 1) + 1) % 1 * A;
      var i = Math.floor(f), fr = f - i;
      return smooth[i % A] * (1 - fr) + smooth[(i + 1) % A] * fr;
    }
    var W = R / 0.49;

    var rn = rand(11), harmonics = [];
    for (k = 3; k < 11; k++) harmonics.push([k, rn() * Math.PI * 2, 0.05 / k]);
    function crustNoise(theta) {
      var n = 0;
      harmonics.forEach(function(h) { n += Math.sin(h[0] * theta + h[1]) * h[2]; });
      return n;
    }
    function smoothstep(a, b, x) {
      var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }
    function toppingHeight(u, v) {
      var c = sample(soft, u, v);
      var tom = Math.min(1, Math.max(0, (c[0] - c[1] - 70) / 70));
      var white = Math.min(1, Math.max(0, (Math.min(c[0], c[1], c[2]) - 185) / 50));
      var green = Math.min(1, Math.max(0, (c[1] - c[0] - 5) / 35));
      return 0.034 * tom + 0.022 * white + 0.028 * green;
    }

    var BASE = 0.035;
    var RS = isSmall ? 70 : 110;
    var LIP = 8;
    var ANG_FULL = isSmall ? 220 : 340;

    // profilo radiale (r, y, uv) per un angolo: base, condimenti, cornicione e bordo arrotondato
    function profile(theta) {
      var e = edgeAt(theta);
      var out = [];
      for (var j = 0; j <= RS; j++) {
        var s = j / RS;
        var uvr = s * e * 0.975;
        var u = 0.5 + Math.cos(theta) * uvr, v = 0.5 + Math.sin(theta) * uvr;
        var cr = 0;
        if (s > 0.76) {
          var q = Math.min(1, (s - 0.76) / 0.24);
          cr = (0.14 + crustNoise(theta)) * Math.pow(Math.sin(q * Math.PI * 0.8), 0.6);
        }
        var top = toppingHeight(u, v) * (1 - smoothstep(0.68, 0.8, s));
        out.push({ r: s * e * W, y: BASE + cr + top, u: u, v: v, t: top, c: cr });
      }
      var last = out[out.length - 1];
      for (j = 1; j <= LIP; j++) {
        var a = j / LIP * Math.PI;
        var uvr2 = e * (0.955 - 0.11 * j / LIP);
        out.push({
          r: last.r + 0.04 * Math.sin(a),
          y: Y_BOTTOM + (last.y - Y_BOTTOM) * (1 + Math.cos(a)) / 2,
          t: 0,
          c: last.c * (1 + Math.cos(a)) / 2,
          u: 0.5 + Math.cos(theta) * uvr2,
          v: 0.5 + Math.sin(theta) * uvr2
        });
      }
      return out;
    }

    var photo = new THREE.Texture(image);
    photo.colorSpace = THREE.SRGBColorSpace;
    photo.anisotropy = maxAniso;
    photo.needsUpdate = true;

    var topMat = new THREE.MeshPhysicalMaterial({
      map: photo, bumpMap: photo, bumpScale: 0.6,
      roughness: 0.62, metalness: 0,
      clearcoat: 0.08, clearcoatRoughness: 0.6,
      sheen: 0.12, sheenColor: new THREE.Color(0xffe9b8), sheenRoughness: 0.7,
      specularIntensity: 0.4,
      envMapIntensity: 0.25
    });
    // crudo → cotto: il colore passa dall'impasto alla foto con una "macchia" che parte dal bordo,
    // i condimenti si alzano e il cornicione cresce come in forno
    topMat.onBeforeCompile = function(sh) {
      Object.assign(sh.uniforms, bakeU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', [
          '#include <common>',
          'attribute float aTop;',
          'attribute float aCrust;',
          'uniform float uTop;',
          'uniform float uRise;'
        ].join('\n'))
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y -= aTop * (1.0 - uTop) + aCrust * (1.0 - uRise) * 0.55;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', [
          '#include <common>',
          'uniform float uBake;',
          'uniform float uGlow;',
          'uniform sampler2D uRaw;',
          'float jkHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
          'float jkNoise(vec2 p) {',
          '  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
          '  return mix(mix(jkHash(i), jkHash(i + vec2(1.0, 0.0)), f.x), mix(jkHash(i + vec2(0.0, 1.0)), jkHash(i + vec2(1.0, 1.0)), f.x), f.y);',
          '}'
        ].join('\n'))
        .replace('#include <map_fragment>', [
          '#include <map_fragment>',
          'float jkR = clamp(length(vMapUv - 0.5) * 2.0, 0.0, 1.0);',
          'float jkN = jkNoise(vMapUv * 14.0) * 0.6 + jkNoise(vMapUv * 41.0) * 0.4;',
          'float jkV = (1.0 - jkR) * 0.55 + jkN * 0.45;',
          'float jkBaked = smoothstep(jkV - 0.06, jkV + 0.06, uBake * 1.5 - 0.25);',
          'diffuseColor.rgb = mix(texture2D(uRaw, vMapUv).rgb, diffuseColor.rgb, jkBaked);',
          'float jkEdge = jkBaked * (1.0 - jkBaked) * 4.0;'
        ].join('\n'))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.42, 0.08) * jkEdge * uGlow * 1.8;');
    };
    // l'ombra deve avere la stessa forma della pizza (impasto piatto o pizza cotta)
    var topDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    topDepth.onBeforeCompile = function(sh) {
      sh.uniforms.uTop = bakeU.uTop;
      sh.uniforms.uRise = bakeU.uRise;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', [
          '#include <common>',
          'attribute float aTop;',
          'attribute float aCrust;',
          'uniform float uTop;',
          'uniform float uRise;'
        ].join('\n'))
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y -= aTop * (1.0 - uTop) + aCrust * (1.0 - uRise) * 0.55;');
    };
    function rawBlend(mat) {
      mat.onBeforeCompile = function(sh) {
        sh.uniforms.uBake = bakeU.uBake;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uBake;')
          .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(vec3(0.8, 0.68, 0.48), diffuseColor.rgb, smoothstep(0.25, 0.9, uBake));');
      };
    }
    var underMat = new THREE.MeshStandardMaterial({ map: makeUnderside(), roughness: 0.92, envMapIntensity: 0.3 });
    var doughMat = new THREE.MeshStandardMaterial({ map: makeCrumb(), roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.35 });
    rawBlend(underMat);
    rawBlend(doughMat);
    topMatRef = topMat;

    function makePart(tStart, tLen) {
      var g = new THREE.Group();
      var segs = Math.max(8, Math.ceil(ANG_FULL * tLen / (Math.PI * 2)));
      var cols = RS + 1 + LIP;
      var pos = [], uv = [], idx = [], aTop = [], aCrust = [];
      var bpos = [], buv = [], bidx = [];
      var profiles = [];
      for (var i = 0; i <= segs; i++) {
        var th = tStart + tLen * i / segs;
        var ct = Math.cos(th), st = Math.sin(th);
        var p = profile(th);
        profiles.push(p);
        p.forEach(function(pt) {
          pos.push(ct * pt.r, pt.y, -st * pt.r);
          uv.push(pt.u, pt.v);
          aTop.push(pt.t);
          aCrust.push(pt.c);
        });
        var rEdge = p[RS].r;
        for (var j = 0; j <= 24; j++) {
          var s = j / 24;
          bpos.push(ct * s * rEdge, Y_BOTTOM, -st * s * rEdge);
          buv.push(0.5 + ct * s * 0.5, 0.5 + st * s * 0.5);
        }
      }
      for (i = 0; i < segs; i++) {
        for (var j2 = 0; j2 < cols - 1; j2++) {
          var a = i * cols + j2, b = (i + 1) * cols + j2, c = b + 1, d = a + 1;
          idx.push(a, d, b, d, c, b);
        }
        for (var k2 = 0; k2 < 24; k2++) {
          var a2 = i * 25 + k2, b2 = (i + 1) * 25 + k2, c2 = b2 + 1, d2 = a2 + 1;
          bidx.push(a2, b2, d2, d2, b2, c2);
        }
      }
      var top = new THREE.BufferGeometry();
      top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      top.setAttribute('aTop', new THREE.Float32BufferAttribute(aTop, 1));
      top.setAttribute('aCrust', new THREE.Float32BufferAttribute(aCrust, 1));
      top.setIndex(idx);
      top.computeVertexNormals();
      var topMesh = new THREE.Mesh(top, topMat);
      topMesh.castShadow = true;
      topMesh.customDepthMaterial = topDepth;
      topMesh.receiveShadow = true;
      g.add(topMesh);

      var bottom = new THREE.BufferGeometry();
      bottom.setAttribute('position', new THREE.Float32BufferAttribute(bpos, 3));
      bottom.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2));
      bottom.setIndex(bidx);
      bottom.computeVertexNormals();
      g.add(new THREE.Mesh(bottom, underMat));

      // facce del taglio: si vede la mollica
      [0, segs].forEach(function(i) {
        var th = tStart + tLen * i / segs;
        var ct = Math.cos(th), st = Math.sin(th);
        var p = profiles[i];
        var cpos = [], cuv = [], cidx = [];
        p.forEach(function(pt, j) {
          cpos.push(ct * pt.r, pt.y, -st * pt.r, ct * pt.r, Y_BOTTOM, -st * pt.r);
          var uu = pt.r / (R * 1.08);
          cuv.push(uu, (pt.y - Y_BOTTOM) / 0.28, uu, 0);
          if (j < p.length - 1) {
            var t0 = j * 2, b0 = t0 + 1, t1 = t0 + 2, b1 = t0 + 3;
            cidx.push(t0, b0, t1, t1, b0, b1);
          }
        });
        var cg = new THREE.BufferGeometry();
        cg.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3));
        cg.setAttribute('uv', new THREE.Float32BufferAttribute(cuv, 2));
        cg.setIndex(cidx);
        cg.computeVertexNormals();
        var cut = new THREE.Mesh(cg, doughMat);
        cutMeshes.push(cut);
        g.add(cut);
      });
      return g;
    }

    function surfacePoint(theta, s) {
      var p = profile(theta)[Math.round(s * RS)];
      return new THREE.Vector3(Math.cos(theta) * p.r, p.y - 0.01, -Math.sin(theta) * p.r);
    }

    mainPizza = makePart(sliceStart + sliceLen, Math.PI * 2 - sliceLen);
    slice = makePart(sliceStart, sliceLen);
    pie.add(mainPizza, slice);

    // fili di mozzarella tra fetta e pizza
    var cheeseMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbefc8, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3,
      sheen: 0.8, sheenColor: new THREE.Color(0xfff6d8), envMapIntensity: 0.6
    });
    var rs = rand(5);
    [[sliceStart, 0.28], [sliceStart, 0.45], [sliceStart, 0.62], [sliceStart + sliceLen, 0.33], [sliceStart + sliceLen, 0.52], [sliceStart + sliceLen, 0.7]].forEach(function(def) {
      var str = makeString(0.014 + rs() * 0.012, cheeseMat);
      str.userData.local = surfacePoint(def[0], def[1]);
      str.userData.jitter = (rs() - 0.5) * 0.12;
      strings.push(str);
      pie.add(str);
    });
  }

  function makeUnderside() {
    var c = document.createElement('canvas');
    c.width = c.height = 512;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(256, 256, 40, 256, 256, 256);
    g.addColorStop(0, '#d9a764');
    g.addColorStop(1, '#a8682e');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    var r = rand(3);
    for (var i = 0; i < 140; i++) {
      x.fillStyle = 'rgba(40,18,5,' + (0.25 + r() * 0.5) + ')';
      x.beginPath();
      x.ellipse(r() * 512, r() * 512, 2 + r() * 9, 2 + r() * 6, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    for (i = 0; i < 600; i++) {
      x.fillStyle = 'rgba(255,248,235,' + (0.2 + r() * 0.4) + ')';
      x.fillRect(r() * 512, r() * 512, 1.5, 1.5);
    }
    return canvasTex(c);
  }

  function makeCrumb() {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, '#8c5524');
    g.addColorStop(0.08, '#e9cf98');
    g.addColorStop(0.6, '#f0d8a4');
    g.addColorStop(0.85, '#d39a52');
    g.addColorStop(1, '#a8652a');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 256);
    var r = rand(9);
    for (var i = 0; i < 260; i++) {
      var px = r() * 512, py = 30 + r() * 200;
      var big = px > 380 ? 2.2 : 1;
      x.fillStyle = 'rgba(150,100,45,' + (0.25 + r() * 0.35) + ')';
      x.beginPath();
      x.ellipse(px, py, (1.5 + r() * 4) * big, (1 + r() * 3) * big, 0, 0, Math.PI * 2);
      x.fill();
    }
    // salsa e mozzarella sopra la base, fino al cornicione
    var sauceTop = 256 - (0.085 / 0.28) * 256;
    x.fillStyle = '#b8261a';
    x.fillRect(0, sauceTop + 2, 400, 9);
    x.fillStyle = '#f7e6b0';
    x.fillRect(0, sauceTop - 12, 400, 14);
    return canvasTex(c);
  }

  // tubo con sezione variabile (più sottile al centro, come un filo che si allunga)
  function makeString(radius, mat) {
    var SEG = 24, RAD = 8;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * (RAD + 1) * 3), 3));
    var idx = [];
    for (var i = 0; i < SEG; i++) {
      for (var j = 0; j < RAD; j++) {
        var a = i * (RAD + 1) + j, b = (i + 1) * (RAD + 1) + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    geo.setIndex(idx);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.userData = { radius: radius, SEG: SEG, RAD: RAD };
    return mesh;
  }
  var _p = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3();
  var _ref = new THREE.Vector3(), _a = new THREE.Vector3(), _bb = new THREE.Vector3(), _m = new THREE.Vector3();
  var _curve = new THREE.QuadraticBezierCurve3(_a, _m, _bb);
  function updateString(mesh, lift) {
    var u = mesh.userData;
    _a.copy(u.local);
    _bb.copy(u.local).applyMatrix4(slice.matrix);
    var dist = _a.distanceTo(_bb);
    _m.copy(_a).add(_bb).multiplyScalar(0.5);
    _m.y -= 0.04 + dist * 0.35;
    _m.x += u.jitter * dist;
    _m.z += u.jitter * dist;
    var arr = mesh.geometry.attributes.position.array;
    var thin = 1 / (1 + dist * 2.5);
    for (var i = 0; i <= u.SEG; i++) {
      var s = i / u.SEG;
      _curve.getPoint(s, _p);
      _curve.getTangent(s, _t).normalize();
      _ref.set(0, 1, 0);
      if (Math.abs(_t.y) > 0.9) _ref.set(1, 0, 0);
      _n.crossVectors(_t, _ref).normalize();
      _b.crossVectors(_t, _n).normalize();
      var rad = u.radius * (0.3 + 0.7 * Math.pow(Math.abs(2 * s - 1), 1.5) + 0.4 * thin) * (0.6 + 0.4 * thin);
      for (var j = 0; j <= u.RAD; j++) {
        var ang = j / u.RAD * Math.PI * 2;
        var cs = Math.cos(ang) * rad, sn = Math.sin(ang) * rad;
        var o = (i * (u.RAD + 1) + j) * 3;
        arr[o] = _p.x + _n.x * cs + _b.x * sn;
        arr[o + 1] = _p.y + _n.y * cs + _b.y * sn;
        arr[o + 2] = _p.z + _n.z * cs + _b.z * sn;
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.visible = lift > 0.04;
  }

  // ---------- Vapore ----------
  function makeSteamTex() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var x = c.getContext('2d');
    var r = rand(21);
    for (var i = 0; i < 9; i++) {
      var px = 34 + r() * 60, py = 34 + r() * 60, rad = 18 + r() * 26;
      var g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
    }
    return canvasTex(c);
  }
  var steamTex = makeSteamTex();
  var steam = [];
  for (var si = 0; si < 14; si++) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0, color: 0xfff8f0 }));
    sp.userData = { life: si / 14, speed: 0.12 + Math.random() * 0.1, x: 0, z: 0, rot: (Math.random() - 0.5) * 0.6 };
    steam.push(sp);
    stage.add(sp);
  }
  function respawnSteam(s) {
    var a = Math.random() * Math.PI * 2, d = Math.random() * 0.9;
    s.userData.x = Math.cos(a) * d;
    s.userData.z = Math.sin(a) * d;
    s.material.rotation = Math.random() * Math.PI * 2;
  }
  steam.forEach(respawnSteam);

  // nuvola di farina quando l'impasto viene lanciato
  var flour = [];
  for (var fo = 0; fo < 12; fo++) {
    var fs = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0, color: 0xfff6e8 }));
    var fa = fo / 12 * Math.PI * 2 + Math.random() * 0.4;
    fs.userData = { dir: new THREE.Vector3(Math.cos(fa), 0.25 + Math.random() * 0.5, Math.sin(fa)), spin: (Math.random() - 0.5) * 2 };
    fs.visible = false;
    flour.push(fs);
    stage.add(fs);
  }


  // ---------- Ingredienti e carte che fluttuano ----------
  var floaters = [];
  function addFloater(obj, pos, amp) {
    obj.position.copy(pos);
    obj.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    stage.add(obj);
    floaters.push({
      obj: obj,
      base: pos.clone(),
      baseScale: obj.scale.clone(),
      phase: Math.random() * Math.PI * 2,
      amp: amp,
      speed: 0.5 + Math.random() * 0.5,
      spin: new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6),
      depth: 1 + pos.z * 0.25,
      // punto della pizza su cui "cade" l'ingrediente nella tappa 2
      target: (function() {
        var a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 1.0;
        return new THREE.Vector3(Math.cos(a) * r, 0.14, Math.sin(a) * r);
      })(),
      delay: Math.random() * 0.03
    });
  }

  function makeLeafTex() {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    var x = c.getContext('2d');
    x.beginPath();
    x.moveTo(128, 500);
    x.bezierCurveTo(250, 380, 240, 120, 128, 10);
    x.bezierCurveTo(16, 120, 6, 380, 128, 500);
    var g = x.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, '#1f6b25');
    g.addColorStop(0.5, '#3f9d36');
    g.addColorStop(1, '#22712a');
    x.fillStyle = g;
    x.fill();
    x.save();
    x.clip();
    x.strokeStyle = 'rgba(190,240,150,0.55)';
    x.lineWidth = 5;
    x.beginPath(); x.moveTo(128, 500); x.lineTo(128, 30); x.stroke();
    x.lineWidth = 2;
    for (var i = 0; i < 7; i++) {
      var y = 440 - i * 55;
      x.beginPath(); x.moveTo(128, y); x.quadraticCurveTo(170, y - 30, 220, y - 70); x.stroke();
      x.beginPath(); x.moveTo(128, y); x.quadraticCurveTo(86, y - 30, 36, y - 70); x.stroke();
    }
    x.restore();
    return canvasTex(c);
  }
  var leafMat = new THREE.MeshPhysicalMaterial({
    map: makeLeafTex(), alphaTest: 0.5, side: THREE.DoubleSide,
    roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: new THREE.Color(0xc8ffb0)
  });
  function makeLeaf() {
    var geo = new THREE.PlaneGeometry(0.34, 0.66, 8, 14);
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i);
      p.setZ(i, -x * x * 2.2 + Math.sin(y * 4) * 0.03);
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, leafMat);
  }

  function makeTomatoInside() {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = '#c4170f';
    x.beginPath(); x.arc(128, 128, 128, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#e8402c';
    x.beginPath(); x.arc(128, 128, 112, 0, Math.PI * 2); x.fill();
    for (var i = 0; i < 3; i++) {
      var a = i / 3 * Math.PI * 2 + 0.3;
      var cxp = 128 + Math.cos(a) * 55, cyp = 128 + Math.sin(a) * 55;
      var g = x.createRadialGradient(cxp, cyp, 4, cxp, cyp, 42);
      g.addColorStop(0, '#f6b86a');
      g.addColorStop(1, '#e65a3a');
      x.fillStyle = g;
      x.beginPath(); x.ellipse(cxp, cyp, 40, 30, a, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#f3e3a0';
      for (var k = 0; k < 6; k++) {
        x.beginPath();
        x.ellipse(128 + Math.cos(a) * (40 + k * 5), 128 + Math.sin(a) * (40 + k * 5) + (k % 2 ? 8 : -8), 4, 6, a, 0, Math.PI * 2);
        x.fill();
      }
    }
    x.fillStyle = '#f07b5c';
    x.beginPath(); x.arc(128, 128, 18, 0, Math.PI * 2); x.fill();
    return canvasTex(c);
  }
  var tomatoSkin = new THREE.MeshPhysicalMaterial({ color: 0xc8160e, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
  var tomatoFlesh = new THREE.MeshPhysicalMaterial({ map: makeTomatoInside(), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  function makeTomato() {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), tomatoSkin));
    var cap = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), tomatoFlesh);
    cap.rotation.x = Math.PI / 2;
    g.add(cap);
    g.scale.set(1, 0.85, 1);
    return g;
  }

  var mozzMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7f2e6, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4,
    sheen: 0.6, sheenColor: new THREE.Color(0xffffff)
  });
  function makeMozz(seed) {
    var geo = new THREE.SphereGeometry(0.17, 48, 32);
    var p = geo.attributes.position, r = rand(seed), a = r() * 6, b = r() * 6, c = r() * 6;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      var n = 1 + 0.16 * Math.sin(x * 14 + a) * Math.sin(y * 12 + b) * Math.sin(z * 13 + c) + 0.05 * Math.sin(x * 40 + y * 30);
      p.setXYZ(i, x * n, y * n * 0.72, z * n);
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mozzMat);
  }

  var oliveMat = new THREE.MeshPhysicalMaterial({ color: 0x15110f, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
  function makeOlive() { return new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.042, 20, 40), oliveMat); }

  function roundRect(x, l, t, w, h, r) {
    x.beginPath();
    x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
  }
  function makeCardFace(front) {
    var c = document.createElement('canvas');
    c.width = 360; c.height = 504;
    var x = c.getContext('2d');
    x.fillStyle = '#fbf8f0';
    x.fillRect(0, 0, 360, 504);
    if (front) {
      x.lineWidth = 6; x.strokeStyle = '#7b2cbf';
      roundRect(x, 18, 18, 324, 468, 18); x.stroke();
      x.fillStyle = '#7b2cbf';
      x.font = 'bold 64px Georgia, serif';
      x.textAlign = 'center';
      x.fillText('J', 58, 90);
      x.save(); x.translate(302, 414); x.rotate(Math.PI); x.fillText('J', 0, 0); x.restore();
      x.font = '64px "Bangers", Impact, sans-serif';
      x.fillStyle = '#2fb53b';
      x.fillText('JOKER', 180, 245);
      x.fillStyle = '#e2b400';
      x.fillText('PIZZA', 180, 310);
    } else {
      x.fillStyle = '#5a1f8f';
      roundRect(x, 16, 16, 328, 472, 16); x.fill();
      x.strokeStyle = 'rgba(255,214,10,0.55)';
      x.lineWidth = 2;
      for (var i = -500; i < 500; i += 18) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 504, 504); x.stroke();
        x.beginPath(); x.moveTo(i + 504, 0); x.lineTo(i, 504); x.stroke();
      }
    }
    return canvasTex(c);
  }
  var cardEdge = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.6 });
  var cardFront = new THREE.MeshPhysicalMaterial({ map: makeCardFace(true), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  var cardBack = new THREE.MeshPhysicalMaterial({ map: makeCardFace(false), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  function makeCard() {
    return new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.006), [cardEdge, cardEdge, cardEdge, cardEdge, cardFront, cardBack]);
  }

  [
    [-2.0, 1.25, 0.4, makeLeaf], [2.25, 1.45, -0.6, makeTomato], [-1.7, -0.5, 1.3, makeTomato],
    [2.5, -0.1, 0.9, makeLeaf], [-0.6, 1.85, -1.2, function() { return makeMozz(3); }],
    [1.15, 2.0, 0.3, makeOlive], [-2.15, 0.25, -1.2, makeCard], [2.6, 0.85, 1.4, makeCard],
    [0.5, -0.95, 2.0, makeLeaf], [-1.35, 1.55, 1.5, makeOlive], [1.9, -0.75, -1.4, function() { return makeMozz(8); }],
    [-0.15, 2.25, 1.1, makeTomato]
  ].forEach(function(s) {
    addFloater(s[3](), new THREE.Vector3(s[0], s[1], s[2]), s[3] === makeCard ? 0.22 : 0.14);
  });

  // ---------- Braci del forno a legna ----------
  var EMBERS = isSmall ? 70 : 120;
  var emberPos = new Float32Array(EMBERS * 3);
  var emberSpeed = new Float32Array(EMBERS);
  for (var e = 0; e < EMBERS; e++) {
    emberPos[e * 3] = (Math.random() - 0.5) * 10;
    emberPos[e * 3 + 1] = Math.random() * 6 - 2.5;
    emberPos[e * 3 + 2] = (Math.random() - 0.5) * 5 - 1;
    emberSpeed[e] = 0.12 + Math.random() * 0.35;
  }
  var emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  var dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  var dctx = dot.getContext('2d');
  var dg = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  dg.addColorStop(0, 'rgba(255,236,190,1)');
  dg.addColorStop(0.3, 'rgba(255,160,50,0.8)');
  dg.addColorStop(1, 'rgba(255,80,0,0)');
  dctx.fillStyle = dg;
  dctx.fillRect(0, 0, 32, 32);
  scene.add(new THREE.Points(emberGeo, new THREE.PointsMaterial({
    size: 0.065, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  })));

  // ---------- Layout responsive ----------
  var view = { w: 1, h: 1, wide: true };
  function resize() {
    var w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    var dist = camBase.length();
    view.h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    view.w = view.h * camera.aspect;
    view.wide = camera.aspect >= 1.05;
    renderOnce();
  }
  new ResizeObserver(resize).observe(host);

  // ---------- Input ----------
  var pointer = new THREE.Vector2(0, 0);
  var pointerSmooth = new THREE.Vector2(0, 0);
  window.addEventListener('pointermove', function(ev) {
    pointer.set(ev.clientX / window.innerWidth * 2 - 1, ev.clientY / window.innerHeight * 2 - 1);
  }, { passive: true });

  // avanzamento dello scroll dentro la sezione hero (0 → 1)
  var P = 0;
  var Ps = 0;
  function readProgress() {
    var r = hero.getBoundingClientRect();
    P = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
  }
  window.addEventListener('scroll', function() {
    readProgress();
    if (reduceMotion) renderOnce();
  }, { passive: true });
  readProgress();
  Ps = P;

  // ---------- Regia: fotogrammi chiave legati allo scroll ----------
  //  0.00 intro · 0.30 impasto lanciato · 0.52 forno · 0.80 servita · 1.00 uscita
  var KEYS = [
    { p: 0.00, x: 0.22, y: -0.10, s: 1.00, tilt: 0.14, camY: 3.0, camZ: 8.4 },
    { p: 0.14, x: 0.20, y: 0.00, s: 1.00, tilt: 0.30, camY: 3.3, camZ: 8.4 },
    { p: 0.30, x: 0.20, y: -0.45, s: 0.92, tilt: 0.5, camY: 3.8, camZ: 8.3 },
    { p: 0.52, x: 0.20, y: -0.05, s: 1.02, tilt: 0.28, camY: 2.3, camZ: 8.3 },
    { p: 0.80, x: 0.19, y: 0.00, s: 1.12, tilt: 0.20, camY: 2.7, camZ: 7.3 },
    { p: 1.00, x: 0.20, y: 0.35, s: 0.92, tilt: 0.32, camY: 3.1, camZ: 8.4 }
  ];
  var pose = {};
  function samplePose(p) {
    var i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    var a = KEYS[i], b = KEYS[i + 1];
    var t = smooth(a.p, b.p, p);
    ['x', 'y', 's', 'tilt', 'camY', 'camZ'].forEach(function(k) { pose[k] = a[k] + (b[k] - a[k]) * t; });
    return pose;
  }
  function smooth(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // ---------- Animazione ----------
  var clock = new THREE.Clock();
  var intro = reduceMotion ? 1 : 0;
  var spin = 0;
  var running = false;
  var visible = true;
  var tiltAxis = new THREE.Vector3(-sliceDir.z, 0, sliceDir.x);
  var steamPos = new THREE.Vector3();
  var steamRot = new THREE.Euler();
  var floatPos = new THREE.Vector3();
  var landPos = new THREE.Vector3();
  var pieWorld = new THREE.Matrix4();
  // rotazione che porta la fetta verso chi guarda
  var SERVE_ROT = -Math.atan2(sliceDir.x, sliceDir.z);

  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  function update(dt, t) {
    if (pizzaReady) intro = Math.min(1, intro + dt / 1.8);
    var k = easeOutCubic(intro);

    // lo scroll viene ammorbidito così la scena "scivola" invece di scattare
    if (dt === 0 || reduceMotion) Ps = P;
    else Ps += (P - Ps) * (1 - Math.pow(0.001, dt));
    var p = Ps;
    var pz = samplePose(p);

    pointerSmooth.lerp(pointer, 1 - Math.pow(0.002, dt));

    // tappe della storia
    var unbake = smooth(0.1, 0.2, p);            // la pizza torna impasto
    var toss = smooth(0.2, 0.4, p);              // impasto lanciato in aria
    var land = smooth(0.41, 0.5, p);             // gli ingredienti cadono sull'impasto
    var bake = smooth(0.5, 0.63, p);             // si cuoce
    var serve = smooth(0.64, 0.76, p);           // la fetta si gira verso di te
    var serveLift = smooth(0.68, 0.86, p);
    var cooked = Math.min(1, Math.max(0, 1 - unbake + bake));
    var topping = Math.min(1, Math.max(0, 1 - unbake + smooth(0.46, 0.53, p)));

    var sizeFit = view.wide ? Math.min(1, (view.w * 0.5) / 4.6) : Math.min(1, (view.w * 0.98) / 4.6);
    var px = view.wide ? view.w * pz.x : 0;
    var py = view.wide ? pz.y : view.h * 0.22 + pz.y * 0.5;
    stage.position.set(px, py, 0);
    // su telefono compensiamo l'avvicinamento della camera, così la pizza non esce dai bordi
    stage.scale.setScalar(sizeFit * (view.wide ? pz.s : Math.min(pz.s, 0.96) * pz.camZ / 8.4));

    // la rotazione legata allo scroll si ferma prima della tappa 3,
    // così la fetta si gira verso di te senza scatti
    var freeze = smooth(0.56, 0.64, p);
    spin += dt * 0.14 * (1 - freeze);
    var baseRot = spin + Math.min(p, 0.64) * Math.PI * 3 + (1 - k) * 1.6;
    var target = SERVE_ROT + Math.PI * 2 * Math.round((baseRot - SERVE_ROT) / (Math.PI * 2));
    pizzaGroup.position.y = (1 - k) * 2.2;
    pizzaGroup.rotation.set(
      pz.tilt + pointerSmooth.y * 0.1,
      baseRot + (target - baseRot) * serve,
      -0.08 + pointerSmooth.x * -0.08
    );
    pizzaGroup.scale.setScalar(0.85 + 0.15 * k);
    contact.material.opacity = 0.85 * k;

    // cottura: tutto nello shader, nessuna sovrapposizione di oggetti
    bakeU.uBake.value = cooked;
    bakeU.uTop.value = topping;
    bakeU.uRise.value = 0.35 + 0.65 * cooked;
    if (topMatRef) topMatRef.bumpScale = 0.6 * cooked;

    // lancio dell'impasto: sale, gira su se stesso e si allarga un poco
    var arc = Math.sin(toss * Math.PI);
    pie.position.y = arc * 1.25;
    pie.rotation.set(Math.sin(toss * Math.PI * 3) * 0.22 * arc, toss * Math.PI * 4, Math.cos(toss * Math.PI * 2) * 0.14 * arc);
    var stretch = 1 + arc * 0.06;
    pie.scale.set(stretch, 1, stretch);

    var lift = 0;
    if (slice) {
      // in apertura la fetta "respira" da sola, alla fine la solleva lo scroll
      var cyc = 0.5 - 0.5 * Math.cos(t * 0.7);
      var timed = Math.pow(cyc, 1.3) * k * (1 - smooth(0.03, 0.1, p));
      lift = Math.max(timed, serveLift * (0.9 + 0.1 * Math.sin(t * 1.4))) * smooth(0.97, 1, cooked);
      slice.position.copy(sliceDir).multiplyScalar(lift * 0.5);
      slice.position.y = lift * 0.65;
      slice.quaternion.setFromAxisAngle(tiltAxis, -lift * 0.26);
      slice.updateMatrix();
      if (lift > 0.04) strings.forEach(function(s) { updateString(s, lift); });
      else strings.forEach(function(s) { s.visible = false; });
      // con la fetta appoggiata le facce del taglio coincidono: le nascondiamo per evitare sfarfallii
      cutMeshes.forEach(function(m) { m.visible = lift > 0.006; });
    }

    // nuvola di farina al momento del lancio
    var puff = smooth(0.19, 0.33, p);
    var puffA = Math.sin(puff * Math.PI) * (1 - smooth(0.33, 0.36, p));
    flour.forEach(function(f) {
      f.visible = puffA > 0.01;
      if (!f.visible) return;
      var d = f.userData;
      f.position.set(d.dir.x * (0.9 + puff * 1.6), pie.position.y * 0.5 + d.dir.y * puff * 1.4, d.dir.z * (0.9 + puff * 1.6));
      f.scale.setScalar(0.5 + puff * 1.4);
      f.material.opacity = puffA * 0.32;
      f.material.rotation = d.spin * puff;
    });

    steamRot.set(0, pizzaGroup.rotation.y, 0);
    steam.forEach(function(s) {
      var d = s.userData;
      d.life += dt * d.speed;
      if (d.life > 1) { d.life -= 1; respawnSteam(s); }
      var L = d.life;
      steamPos.set(d.x, 0.15 + L * 1.6, d.z).applyEuler(steamRot);
      s.position.set(steamPos.x, steamPos.y + pizzaGroup.position.y, steamPos.z);
      s.scale.setScalar(0.35 + L * 1.1);
      s.material.opacity = Math.sin(L * Math.PI) * 0.16 * k * cooked * (1 - smooth(0.9, 1, p));
      s.material.rotation += d.rot * dt;
    });

    // gli ingredienti atterrano proprio sulla superficie della pizza (anche se gira e si inclina)
    pizzaGroup.updateMatrix();
    pie.updateMatrix();
    pieWorld.multiplyMatrices(pizzaGroup.matrix, pie.matrix);
    floaters.forEach(function(f) {
      var o = f.obj;
      floatPos.set(
        f.base.x + pointerSmooth.x * 0.22 * f.depth,
        f.base.y + Math.sin(t * f.speed + f.phase) * f.amp - pointerSmooth.y * 0.15 * f.depth,
        f.base.z
      );
      var d = smooth(0.41 + f.delay, 0.49 + f.delay, p);
      landPos.copy(f.target).applyMatrix4(pieWorld);
      floatPos.lerp(landPos, d);
      floatPos.y += Math.sin(d * Math.PI) * 0.5;
      o.position.copy(floatPos);
      var spinBoost = (1 + toss * 2) * (1 - d);
      o.rotation.x += f.spin.x * dt * spinBoost;
      o.rotation.y += f.spin.y * dt * spinBoost;
      o.rotation.z += f.spin.z * dt * spinBoost;
      // appena toccano l'impasto si "sciolgono" nei condimenti della pizza
      var fade = 1 - smooth(0.47 + f.delay, 0.52 + f.delay, p);
      o.visible = fade > 0.01;
      o.scale.copy(f.baseScale).multiplyScalar(Math.max(0.001, k * fade));
    });

    var ep = emberGeo.attributes.position.array;
    for (var i = 0; i < EMBERS; i++) {
      ep[i * 3 + 1] += emberSpeed[i] * dt;
      ep[i * 3] += Math.sin(t * 0.8 + i) * 0.0015;
      if (ep[i * 3 + 1] > 3.5) {
        ep[i * 3 + 1] = -2.5;
        ep[i * 3] = (Math.random() - 0.5) * 10;
      }
    }
    emberGeo.attributes.position.needsUpdate = true;

    // la luce segue la pizza così l'ombra resta nitida
    key.target.position.copy(stage.position);
    key.position.set(stage.position.x + 2.5, stage.position.y + 7, stage.position.z + 4);

    camera.position.set(pointerSmooth.x * 0.25, pz.camY - pointerSmooth.y * 0.15, pz.camZ);
    camera.lookAt(0, 0, 0);
  }

  function renderOnce() {
    if (!running) {
      update(0, clock.getElapsedTime());
      renderer.render(scene, camera);
    }
  }

  // qualità adattiva: se il dispositivo fatica, abbassiamo la risoluzione
  var perf = { acc: 0, n: 0, dpr: renderer.getPixelRatio() };
  function watchPerf(rawDt) {
    if (document.hidden || rawDt > 0.25) return;
    perf.acc += rawDt;
    perf.n++;
    if (perf.n < 90) return;
    var avg = perf.acc / perf.n;
    perf.acc = 0;
    perf.n = 0;
    if (avg > 1 / 40 && perf.dpr > 1) {
      perf.dpr = Math.max(1, perf.dpr - 0.25);
      renderer.setPixelRatio(perf.dpr);
      resize();
    }
  }

  function loop() {
    if (!visible || reduceMotion) { running = false; return; }
    running = true;
    var raw = clock.getDelta();
    watchPerf(raw);
    var dt = Math.min(raw, 0.05);
    update(dt, clock.elapsedTime);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  new IntersectionObserver(function(entries) {
    visible = entries[0].isIntersecting;
    if (visible && !running && !reduceMotion) { clock.getDelta(); loop(); }
  }).observe(hero);

  resize();
  hero.classList.add('is-3d');
  if (reduceMotion) renderOnce(); else if (!running) loop();
}
