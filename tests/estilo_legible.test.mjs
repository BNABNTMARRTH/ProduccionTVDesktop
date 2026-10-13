/* Las hojas de estilo se escriben una declaración por renglón. Las reglas
   comprimidas en un solo renglón (había una de 1.661 caracteres) no se pueden
   leer ni revisar, y dos cambios a propiedades distintas de la misma regla
   chocan en git como si fueran el mismo. Esta prueba impide que vuelvan.
   Los comentarios largos sí se permiten, y también UNA declaración larga
   sola en su renglón (un data: URI o una transición con muchas propiedades). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HOJAS = ['frontend/src/style.css', 'web-sources/generador-tv/src/index.css'];
const LIMITE = 200;

for (const hoja of HOJAS) {
  test(`${hoja}: ninguna regla en un renglón de más de ${LIMITE} caracteres`, () => {
    const texto = readFileSync(new URL(`../${hoja}`, import.meta.url), 'utf8');
    // Se blanquean los comentarios conservando los saltos de línea, para que
    // los números de renglón del aviso sigan siendo los del archivo.
    const sinComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
    const largas = sinComentarios.split('\n')
      .map((linea, i) => ({ n: i + 1, linea: linea.trim() }))
      // Varias declaraciones (o el selector y su cuerpo) apretadas en un renglón.
      .filter(({ linea }) => linea.length > LIMITE && (linea.includes('{') || linea.split(';').filter((d) => d.trim() && d.trim() !== '}').length > 1));
    assert.deepEqual(largas, [], `expande a una declaración por renglón: ${largas.map(({ n }) => `línea ${n}`).join(', ')}`);
  });
}
