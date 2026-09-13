/* LA BARRA DE PESTAÑAS del proyecto (como DaVinci Resolve o Premiere).
 *
 * De qué se trata: el proyecto abre en UNA pestaña —"Proyecto"— con su
 * navegación por etapas de siempre. Cualquier módulo (el guion, el diagrama,
 * el plano del set…) se puede DESANCLAR: sale de la navegación y se queda en
 * su propia pestaña, que conserva su estado aunque cambies a otra. Y si esa
 * pestaña la arrastras FUERA de la barra, se despega en una ventana de macOS
 * aparte, que puedes mandar al segundo monitor. Igual que en Chrome.
 *
 * Este archivo es solo la BARRA: sabe qué pestañas hay, cuál está activa, en
 * qué orden van y qué gesto hizo el usuario. No sabe nada de iframes, de
 * proyectos ni de ventanas — de eso se encarga main.js, que es quien tiene el
 * estado. Se comunican por los callbacks de crearPestanas().
 *
 * La pestaña "Proyecto" (id PRINCIPAL) es fija: ni se cierra, ni se arrastra,
 * ni se saca a una ventana. Es la casa; las demás son cuartos que se prestan.
 *
 * 2026-08-28: cada pestaña lleva además un botón ⧉ que hace lo mismo que
 * arrastrarla fuera. El gesto seguía siendo el atajo bonito, pero era invisible
 * y por lo tanto no existía para quien no lo hubiera leído en un aviso.
 */

import { icono } from './iconos.js';

export const PRINCIPAL = 'proyecto';

// Cuánto hay que alejar el puntero de la barra para que contar como "la sacó
// afuera". Con menos, un arrastre torpe para reordenar se convertía en ventana
// sin querer; con más, hay que cruzar media pantalla para lograrlo.
const DISTANCIA_PARA_SACAR = 90;

export function crearPestanas({
    barra,              // el <nav> donde se dibuja
    alActivar,          // (id) => void        · el usuario eligió una pestaña
    alCerrar,           // (id) => void        · la cerró
    alSacar,            // (id) => void        · la arrastró fuera de la barra
    alPedirModulo,      // (ancla) => void     · picó el "+"
    etiquetaDe,         // (id) => string      · nombre visible del módulo
    iconoDe,            // (id) => string|null · nombre del icono del módulo
}) {
    /* HAY SITIOS DONDE UNA APP ES UNA SOLA VENTANA (el iPad). Ahí, sacar una
       pestaña a "su propia ventana" no abre nada nuevo: tapa la pantalla con
       el módulo, que es lo mismo que navegar a él pero con un rodeo. Donde no
       se puede hacer de verdad, no se ofrece: ni el botón ⧉ ni el arrastre
       hacia fuera. Las pestañas, que viven dentro de esta misma ventana, se
       quedan igual. */
    const haySegundaVentana = !globalThis.__ptvSinVentanas;

    let abiertas = [];        // ids de los módulos desanclados, en orden
    let activa = PRINCIPAL;
    let arrastrando = null;   // { id, desdeX, desdeY, saliendo }

    const hay = (id) => abiertas.includes(id);

    function render() {
        // La barra de pestañas y el botón "+" están siempre disponibles en la ventana
        // del proyecto para permitir desanclar módulos directamente desde el primer instante.
        barra.hidden = false;
        if (typeof barra.setAttribute === 'function') barra.setAttribute('aria-orientation', 'horizontal');

        /* El botón ⧉ existe por DESCUBRIMIENTO. Sacar la pestaña a su propia
           ventana era solo un gesto —arrastrarla fuera de la barra—, y un
           gesto que no se ve es un gesto que no existe: nadie se enteraba de
           que se podía. Ahora es un botón a la vista, con el arrastre como
           atajo para quien ya lo sepa. */
        const pestana = (id, etiqueta, ico, fija) => `
          <div class="pestana${id === activa ? ' activa' : ''}${fija ? ' fija' : ''}"
               data-pestana="${id}" id="tab-${id}" role="tab" tabindex="0"
               aria-selected="${id === activa}"
               aria-controls="panel-${id}"
               title="${fija ? 'Recorrido del proyecto (⌃Tab)'
                : `“${etiqueta}” (⌃Tab)`}">
            ${ico ? `<span class="pestana-ic">${icono(ico, 15)}</span>` : ''}
            <span class="pestana-txt">${etiqueta}</span>
            ${fija ? '' : `${haySegundaVentana ? `<button class="pestana-ventana" data-ventana="${id}" tabindex="-1" aria-label="Abrir ${etiqueta} en su propia ventana" title="Abrir en ventana independiente">${icono('ventana', 13)}</button>` : ''}
            <button class="pestana-x" data-cerrar="${id}" tabindex="-1" aria-label="Cerrar la pestaña ${etiqueta}" title="Cerrar pestaña (⌘W)">${icono('cerrar', 13)}</button>`}
          </div>`;

        barra.innerHTML =
            pestana(PRINCIPAL, 'Proyecto', 'proyecto', true)
            + abiertas.map((id) => pestana(id, etiquetaDe(id), iconoDe(id), false)).join('')
            + `<button class="pestana-mas" id="pestana-mas" title="Desanclar otro módulo en una pestaña nueva" aria-label="Desanclar otro módulo">${icono('mas', 15)}</button>`;

        barra.querySelectorAll('[data-pestana]').forEach((el) => {
            const id = el.dataset.pestana;
            el.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alActivar(id); }
                // Cerrar con Supr/Retroceso: la pestaña fija no se cierra.
                if ((e.key === 'Delete' || e.key === 'Backspace') && id !== PRINCIPAL) { e.preventDefault(); alCerrar(id); }
            };
            el.onpointerdown = (e) => empezarArrastre(e, el, id);
        });
        barra.querySelectorAll('[data-cerrar]').forEach((b) => {
            b.onclick = (e) => { e.stopPropagation(); alCerrar(b.dataset.cerrar); };
        });
        barra.querySelectorAll('[data-ventana]').forEach((b) => {
            b.onclick = (e) => { e.stopPropagation(); alSacar(b.dataset.ventana); };
        });
        const masBtn = barra.querySelector('#pestana-mas');
        if (masBtn) masBtn.onclick = (e) => alPedirModulo(e.currentTarget);

        const elActiva = barra.querySelector(`[data-pestana="${activa}"]`);
        if (elActiva && typeof elActiva.scrollIntoView === 'function') {
            requestAnimationFrame(() => {
                elActiva.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            });
        }
    }

    /* ---- ARRASTRE. Dos gestos con el mismo movimiento -------------------
       Dentro de la barra, reordena. Lo bastante lejos de la barra, saca la
       pestaña a su propia ventana.

       Se usan eventos de PUNTERO, no la API de drag-and-drop del navegador:
       esa API no deja saber dónde soltó el usuario cuando soltó fuera de la
       ventana, que es justo el caso que nos importa. Por lo mismo la pestaña
       tampoco lleva draggable="true": ese atributo arranca el arrastre nativo,
       que se traga los pointermove y mata el gesto al primer pixel.

       Y la captura del puntero va en la BARRA, no en la pestaña. Mover una
       pestaña de lugar (o volver a dibujar la barra) la saca del documento un
       instante, y eso SUELTA su captura: el arrastre se moría justo al hacer
       el primer reacomodo. La barra, en cambio, siempre está ahí. */
    function empezarArrastre(e, el, id) {
        if (id === PRINCIPAL) { alActivar(id); return; }
        if (e.button !== 0 || e.target.closest('[data-cerrar],[data-ventana]')) return;
        arrastrando = { id, desdeX: e.clientX, desdeY: e.clientY, movio: false, saliendo: false, puntero: e.pointerId };
        try { barra.setPointerCapture(e.pointerId); } catch { /* sin captura el gesto sigue, solo se pierde si sales de la ventana */ }
    }

    barra.addEventListener('pointermove', (e) => {
        if (!arrastrando) return;
        const dx = e.clientX - arrastrando.desdeX;
        const dy = e.clientY - arrastrando.desdeY;
        if (!arrastrando.movio && Math.hypot(dx, dy) < 5) return;
        arrastrando.movio = true;
        const caja = barra.getBoundingClientRect();
        // "Fuera" = lejos de la barra en vertical. En horizontal el usuario
        // está reordenando, no sacando.
        const fuera = haySegundaVentana
            && (e.clientY < caja.top - DISTANCIA_PARA_SACAR || e.clientY > caja.bottom + DISTANCIA_PARA_SACAR);
        arrastrando.saliendo = fuera;
        const el = barra.querySelector(`[data-pestana="${arrastrando.id}"]`);
        el?.classList.toggle('sacando', fuera);
        barra.classList.toggle('soltando-fuera', fuera);
        if (!fuera) reordenarSegunPuntero(arrastrando.id, e.clientX);
    });

    const soltar = (e) => {
        if (!arrastrando) return;
        const { id, movio, saliendo, puntero } = arrastrando;
        arrastrando = null;
        barra.querySelector(`[data-pestana="${id}"]`)?.classList.remove('sacando');
        barra.classList.remove('soltando-fuera');
        try { barra.releasePointerCapture(puntero); } catch { /* ya se soltó */ }
        if (saliendo) { alSacar(id); return; }
        // Sin movimiento fue un clic: eso es elegir la pestaña.
        if (!movio) alActivar(id);
        else render();
    };
    barra.addEventListener('pointerup', soltar);
    barra.addEventListener('pointercancel', soltar);

    // Reordena en vivo: la pestaña arrastrada se pasa del lado de aquella
    // sobre cuya mitad está el puntero. Mueve el NODO (no vuelve a dibujar),
    // y el orden real se relee del DOM, que a media maniobra es la verdad.
    function reordenarSegunPuntero(id, x) {
        const arrastrada = barra.querySelector(`[data-pestana="${id}"]`);
        if (!arrastrada) return;
        const destino = [...barra.querySelectorAll('[data-pestana]')].find((n) => {
            if (n === arrastrada || n.dataset.pestana === PRINCIPAL) return false;
            const c = n.getBoundingClientRect();
            return x >= c.left && x <= c.right;
        });
        if (!destino) return;
        const c = destino.getBoundingClientRect();
        const antes = x < c.left + c.width / 2;
        const referencia = antes ? destino : destino.nextSibling;
        if (referencia === arrastrada) return;
        barra.insertBefore(arrastrada, referencia);
        abiertas = [...barra.querySelectorAll('[data-pestana]')]
            .map((n) => n.dataset.pestana)
            .filter((v) => v !== PRINCIPAL);
    }

    // Render inicial: dibuja la pestaña fija 'Proyecto' y el botón '+' de inmediato.
    render();

    return {
        get abiertas() { return [...abiertas]; },
        get activa() { return activa; },
        tiene: hay,
        abrir(id) {
            if (!hay(id)) abiertas.push(id);
            activa = id;
            render();
            requestAnimationFrame(() => {
                const nuevo = barra.querySelector(`[data-pestana="${id}"]`);
                if (nuevo && typeof nuevo.scrollIntoView === 'function') {
                    nuevo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
                const mas = barra.querySelector('#pestana-mas');
                if (mas && typeof mas.scrollIntoView === 'function') {
                    mas.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            });
        },
        cerrar(id) { abiertas = abiertas.filter((x) => x !== id); if (activa === id) activa = PRINCIPAL; render(); },
        activar(id) { activa = hay(id) || id === PRINCIPAL ? id : PRINCIPAL; render(); },
        render,
    };
}
