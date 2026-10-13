/* Lógica que salió de VistaSet.jsx a funciones puras: apuntar una cámara
   (sets.js) y guardar una captura 3D en el storyboard (tomas.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conOrientacionDeCamara } from '../web-sources/generador-tv/src/sets.js';
import { conCapturaEnStoryboard } from '../web-sources/generador-tv/src/tomas.js';

const set = { id: 's1', setLayout: { pos: {}, rot: { 'cam:c1': 10 }, tilt: { 'cam:c1': 5 } } };

test('apuntar una cámara guarda pan en rot y tilt en tilt, sin tocar las demás', () => {
  const r = conOrientacionDeCamara({ ...set, setLayout: { ...set.setLayout, rot: { ...set.setLayout.rot, 'cam:c2': 90 } } }, 'c1', { rot: 45, tilt: -8 });
  assert.equal(r.setLayout.rot['cam:c1'], 45);
  assert.equal(r.setLayout.tilt['cam:c1'], -8);
  assert.equal(r.setLayout.rot['cam:c2'], 90);
  assert.equal(set.setLayout.rot['cam:c1'], 10, 'no muta el set original');
});

test('sin pan numérico la cámara vuelve a auto-apuntar; tilt inválido = horizonte', () => {
  const r = conOrientacionDeCamara(set, 'c1', { rot: null, tilt: NaN });
  assert.ok(!('cam:c1' in r.setLayout.rot));
  assert.equal(r.setLayout.tilt['cam:c1'], 0);
});

const captura3d = { camId: 'c2', focal: 35, tilt: -3 };
const ids = () => 'nuevo';

test('captura a un plano nuevo en narrativo: plano con la cámara de la captura', () => {
  const cfg = { modo: 'narrative', camaras: [{ id: 'c1' }, { id: 'c2' }], escaleta: [{ id: 'e1', tomas: [] }] };
  const r = conCapturaEnStoryboard(cfg, { segmentoId: 'e1', tomaId: null, imagen: 'data:x', captura3d }, ids);
  const [plano] = r.escaleta[0].tomas;
  assert.equal(plano.id, 'nuevo');
  assert.equal(plano.camId, 'c2');
  assert.equal(plano.imagen, 'data:x');
  assert.deepEqual(plano.captura3d, captura3d);
});

test('captura a un plano existente: respeta su cámara si ya tenía; si no, le pone la de la captura', () => {
  const cfg = {
    modo: 'live', camaras: [{ id: 'c1' }, { id: 'c2' }],
    escaleta: [{ id: 'b1', tomas: [{ id: 't1', tipo: 'camara', alAire: 'c1' }, { id: 't2', tipo: 'camara', alAire: '' }] }],
  };
  const a = conCapturaEnStoryboard(cfg, { segmentoId: 'b1', tomaId: 't1', imagen: 'i1', captura3d }, ids);
  assert.equal(a.escaleta[0].tomas[0].alAire, 'c1');
  assert.equal(a.escaleta[0].tomas[0].imagen, 'i1');
  const b = conCapturaEnStoryboard(cfg, { segmentoId: 'b1', tomaId: 't2', imagen: 'i2', captura3d }, ids);
  assert.equal(b.escaleta[0].tomas[1].alAire, 'c2');
  assert.equal(cfg.escaleta[0].tomas[1].alAire, '', 'no muta el proyecto original');
});
