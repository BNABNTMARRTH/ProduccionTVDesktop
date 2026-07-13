export const STORAGE_KEYS = {
    projects: 'producciontv:desktop:projects:v2',
    activeProject: 'producciontv:desktop:active-project',
    welcomeSeen: 'producciontv:desktop:welcome-seen',
    demoSeeded: 'producciontv:desktop:demo-seeded',
    autosave: 'tvprod:autosave',
    diagram: 'senal:diagram2',
};

export const MAX_PROJECTS = 60;

// Escapa texto para interpolarlo con seguridad en innerHTML.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
