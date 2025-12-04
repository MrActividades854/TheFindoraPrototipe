// Inicialización compartida para TODAS las páginas

export async function initBackgroundDetection() {
  // Si ya está inicializado, no hacer nada
  if (window.__uiInitialized) return;
  window.__uiInitialized = true;

  try {
    // Importar después de verificar
    const UIManager = (await import('./ui.js')).default;

    const ui = new UIManager({
      wsUrl: 'https://thefindoraprototipe.onrender.com/ws',
      modelPath: '/models'
    });

    // Guardar en sessionStorage para acceso global
    sessionStorage.setItem('ui_initialized', 'true');
    window.ui = ui;

    await ui.init();
    console.log('✓ Detección iniciada en background');

  } catch (err) {
    console.error('Error inicializando detección:', err);
  }
}