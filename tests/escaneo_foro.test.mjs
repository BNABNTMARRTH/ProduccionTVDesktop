import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describirEscaneoForo,
  intercambiarEscaneoForo,
  normalizarEscaneoForo,
} from '../web-sources/generador-tv/src/escaneoForo.js';

test('escáner de foro: valida y normaliza la respuesta nativa', () => {
  const resultado = normalizarEscaneoForo({
    ok: true,
    ancho: '7.83',
    fondo: 5.91,
    alto: 2.95,
    paredes: 4.9,
    puertas: 1,
  });
  assert.deepEqual(resultado, {
    ok: true,
    ancho: 7.83,
    fondo: 5.91,
    alto: 2.95,
    paredes: 4,
    puertas: 1,
    ventanas: 0,
    aberturas: 0,
  });
  assert.equal(normalizarEscaneoForo({ ok: true, ancho: 0, fondo: 5, alto: 3 }), null);
  assert.equal(normalizarEscaneoForo({ ok: false, cancelado: true }), null);
});

test('escáner de foro: formatea medidas y plurales para la confirmación', () => {
  const texto = describirEscaneoForo({
    ok: true,
    ancho: 7.83,
    fondo: 5.91,
    alto: 2.95,
    paredes: 4,
    puertas: 1,
    ventanas: 0,
  });
  assert.equal(texto, 'Medí 7.83 × 5.91 m, alto 2.95 m (4 paredes, 1 puerta)');
});

test('escáner de foro: intercambia ancho y fondo sin perder el resto', () => {
  const intercambiado = intercambiarEscaneoForo({
    ok: true,
    ancho: 8.2,
    fondo: 5.4,
    alto: 3.1,
    paredes: 6,
    puertas: 2,
    ventanas: 1,
    aberturas: 1,
  });
  assert.equal(intercambiado.ancho, 5.4);
  assert.equal(intercambiado.fondo, 8.2);
  assert.equal(intercambiado.alto, 3.1);
  assert.equal(intercambiado.ventanas, 1);
});
