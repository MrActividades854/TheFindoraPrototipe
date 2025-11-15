// main.js
import UIManager from './js/ui.js';

const ui = new UIManager({ wsUrl: 'ws://192.168.101.10:8080', modelPath: '/models' });
window.ui = ui;
window.webrtc = ui.webrtc;
ui.init();

// opcional: exponer ui para debugging en consola
window._ui = ui;
