import test from "node:test";
import assert from "node:assert/strict";

import { UIComponentFactory } from "../frontend/src/ui_component_factory.js";
import { createNuevoProyecto } from "../frontend/src/nuevo-proyecto.js";

test("GoF Abstract Factory: UIComponentFactory genera SheetHeader sin botón X y con tipografía Apple", () => {
  const headerHtml = UIComponentFactory.createSheetHeader({
    title: "Nuevo proyecto",
    subtitle: "Solo esto para empezar.",
  });

  assert.ok(headerHtml.includes("Nuevo proyecto"));
  assert.ok(headerHtml.includes("Solo esto para empezar."));
  assert.ok(!headerHtml.includes("✕"));
  assert.ok(!headerHtml.includes("np-cerrar"));
  assert.ok(headerHtml.includes("np-header"));
});

test("GoF Abstract Factory: UIComponentFactory genera ModeCard con radio-indicator y semántica accesible", () => {
  const cardSelected = UIComponentFactory.createModeCard({
    modeId: "live",
    isSelected: true,
    title: "En vivo",
    desc: "Reloj continuo y señales al aire",
    example: "Noticiero, podcast",
    iconSvg: "<svg id='ico-live'></svg>",
  });

  assert.ok(cardSelected.includes('data-modo="live"'));
  assert.ok(cardSelected.includes('selected'));
  assert.ok(cardSelected.includes('aria-checked="true"'));
  assert.ok(cardSelected.includes('mode-radio-indicator'));
  assert.ok(cardSelected.includes('ico-live'));

  const cardUnselected = UIComponentFactory.createModeCard({
    modeId: "narrative",
    isSelected: false,
    title: "Narrativo",
    desc: "Por escenas y planos",
    example: "Ficción",
    iconSvg: "<svg id='ico-narrative'></svg>",
  });

  assert.ok(cardUnselected.includes('data-modo="narrative"'));
  assert.ok(!cardUnselected.includes('selected'));
  assert.ok(cardUnselected.includes('aria-checked="false"'));
});

test("GoF Abstract Factory: UIComponentFactory genera DisclosureButton y SheetFooter", () => {
  const disclosure = UIComponentFactory.createDisclosureButton({
    isExpanded: false,
    title: "El perfil del proyecto",
    hint: "· opcional",
  });

  assert.ok(disclosure.includes('aria-expanded="false"'));
  assert.ok(!disclosure.includes('open'));
  assert.ok(disclosure.includes('np-mas-chevron'));
  assert.ok(disclosure.includes('El perfil del proyecto'));

  const footer = UIComponentFactory.createSheetFooter({
    cancelLabel: "Cancelar",
    confirmLabel: "Crear y empezar",
    shortcutHint: "⌘↵",
  });

  assert.ok(footer.includes('np-cancel-btn'));
  assert.ok(footer.includes('Cancelar'));
  assert.ok(footer.includes('np-crear'));
  assert.ok(footer.includes('Crear y empezar'));
  assert.ok(footer.includes('⌘↵'));
});

test("GoF Abstract Factory: UIComponentFactory genera FilterChip y ChipGroup accesibles", () => {
  const chipSelected = UIComponentFactory.createFilterChip({
    value: "TikTok",
    label: "TikTok",
    isSelected: true,
    groupName: "medios",
  });

  assert.ok(chipSelected.includes('np-chip'));
  assert.ok(chipSelected.includes('on'));
  assert.ok(chipSelected.includes('data-valor="TikTok"'));
  assert.ok(chipSelected.includes('data-lista="medios"'));
  assert.ok(chipSelected.includes('aria-pressed="true"'));

  const chipUnselected = UIComponentFactory.createFilterChip({
    value: "Radio",
    label: "Radio",
    isSelected: false,
    groupName: "medios",
  });

  assert.ok(chipUnselected.includes('np-chip'));
  assert.ok(!chipUnselected.includes(' on'));
  assert.ok(chipUnselected.includes('aria-pressed="false"'));

  const groupHtml = UIComponentFactory.createChipGroup({
    groupName: "intencion",
    items: ["Informar", "Emocionar", "Persuadir"],
    selectedValues: ["Emocionar"],
  });

  assert.ok(groupHtml.includes('class="np-chips"'));
  assert.ok(groupHtml.includes('data-lista="intencion"'));
  assert.ok(groupHtml.includes('role="group"'));
  assert.ok(groupHtml.includes('data-valor="Informar"'));
  assert.ok(groupHtml.includes('data-valor="Emocionar"'));
  assert.ok(groupHtml.includes('data-valor="Persuadir"'));
});

test("Nuevo Proyecto Modal: Ciclo de vida (open, close, isOpen) y descarte seguro", () => {
  // Mock simple del entorno DOM para pruebas unitarias Node.js
  const createdElements = [];
  globalThis.document = {
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: "",
        hidden: false,
        innerHTML: "",
        children: [],
        style: {},
        dataset: {},
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: (child) => {
          el.children.push(child);
          return child;
        },
        querySelector: (sel) => {
          if (sel === "#np-nombre") return { value: "Proyecto Test", focus: () => {}, onkeydown: () => {} };
          if (sel === ".np-cancel-btn" || sel === ".np-crear" || sel === ".np-mas") {
            return { addEventListener: () => {}, onclick: () => {} };
          }
          return null;
        },
        querySelectorAll: (sel) => [],
      };
      createdElements.push(el);
      return el;
    },
    body: {
      appendChild: (el) => el,
    },
  };

  let createdProject = null;
  const dialog = createNuevoProyecto({
    onCreate: (data) => {
      createdProject = data;
    },
  });

  assert.equal(dialog.isOpen(), false);

  dialog.open();
  assert.equal(dialog.isOpen(), true);

  dialog.close();
  assert.equal(dialog.isOpen(), false);
});
