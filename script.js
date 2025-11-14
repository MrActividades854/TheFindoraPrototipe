import { initWebRTC } from "./js/webrtc.js";
import { initFaceRecognition } from "./js/face-recognition.js";
import { initUI } from "./js/ui.js";

(async () => {
    await initFaceRecognition(); // carga modelos
    initWebRTC();                // conecta WS y prepara WebRTC
    initUI();                    // UI y cámaras
})();
