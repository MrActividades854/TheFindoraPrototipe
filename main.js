// main.js
import UIManager from './js/ui.js';

const ui = new UIManager({ wsUrl: 'ws://localhost:8080', modelPath: '/models' });
ui.init();

// opcional: exponer ui para debugging en consola
window._ui = ui;
