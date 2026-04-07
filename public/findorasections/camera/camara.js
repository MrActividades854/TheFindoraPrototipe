// ============================================================
// GESTIÓN DE CÁMARA Y DETECCIÓN FACIAL
// ============================================================
        import WebRTCManager from "../../js/webrtc.js";
        import FaceRecognitionManager from "../../js/face-recognition.js";
        import NotificationManager from "../../js/notifications.js";
        import { CONFIG } from "../../js/config.js";


        // ============================================================
        // ELEMENTOS DEL DOM
        // ============================================================
        const videoEl = document.getElementById("bigFeed");
        const canvasEl = document.getElementById("detectionCanvas");
        const statusOverlay = document.getElementById("statusOverlay");
        const statusText = document.getElementById("statusText");
        const prevBtn = document.getElementById("prevBtn");
        const nextBtn = document.getElementById("nextBtn");
        const cameraContainer = document.getElementById("cameraContainer");
        const detectionPanel = document.getElementById("detectionPanel");
        const panelContent = document.getElementById("panelContent");
        const togglePanelBtn = document.getElementById("togglePanelBtn");

        let titleEl = document.getElementById("cameraTitle");

        // ============================================================
        // CONFIGURACIÓN
        // ============================================================
        const selectedData = JSON.parse(localStorage.getItem("selectedFeed") || "null" || '{}');
        const selectedId = selectedData.id;
        const selectedType = selectedData.type;
        const feedList = JSON.parse(localStorage.getItem("feedList") || "[]");

        console.log('📊 Feed seleccionado:', selectedId);
        console.log('📊 Lista de feeds:', feedList);

        if (!selectedId) {
            showStatus('❌ No se seleccionó ninguna cámara', true);
            setTimeout(() => window.history.back(), 2000);
        }

                // Botón de editar etiqueta

        const editLabelBtn = document.getElementById("editLabelBtn");
        let currentLabel = selectedData.label || selectedId;

        editLabelBtn.addEventListener("click", () => {
            enableEditLabel();
        });

        titleEl.textContent = currentLabel || "Cámara";

        // Variables de estado
        let webrtc = null;
        let faceRec = null;
        let notifier = null;
        let feedReceived = false;
        let connectionTimeout = null;
        let detectedPeople = new Map(); // name -> timestamp

        // ============================================================
        // INICIALIZAR MANAGERS
        // ============================================================
        async function initManagers() {

            // Notificaciones
            notifier = new NotificationManager(
                'https://thefindoraprototipe.onrender.com/api/notifications',
                'history' // Modo silencioso, solo guardar
            );

            // Face Recognition
            faceRec = new FaceRecognitionManager({
                modelPath: CONFIG.MODEL_PATH,
                onNotification: (msg, type) => {
                    console.log(`📢 [${type}] ${msg}`);
                    notifier.show(msg, type);
                    updateDetectionPanel(msg, type);
                }
            });

            try {
                showStatus('⏳ Cargando modelos de IA...');
                await faceRec.loadModels();
                console.log('✅ Modelos cargados');

                showStatus('⏳ Cargando perfiles...');
                await faceRec.loadProfilesFromServer();
                console.log('✅ Perfiles cargados');

            } catch (error) {
                console.error('❌ Error cargando modelos:', error);
                showStatus('⚠️ Detección no disponible', false);
            }
        }

        // ============================================================
        // FUNCIONES DE UI
        // ============================================================
        function showStatus(message, isError = false) {
            statusText.textContent = message;
            statusOverlay.classList.remove('hidden');
            
            if (isError) {
                statusText.style.color = '#ff4444';
                cameraContainer.classList.add('error');
            } else {
                statusText.style.color = '#fff';
                cameraContainer.classList.remove('error');
            }
        }

        function hideStatus() {
            statusOverlay.classList.add('hidden');
            cameraContainer.classList.remove('loading', 'error');
        }

        function updateDetectionPanel(message, type) {
            // Extraer nombre de la notificación
            let name = null;
            if (message.includes('ha entrado')) {
                name = message.replace(' ha entrado', '');
            } else if (message.includes('se movió a')) {
                name = message.split(' se movió')[0];
            } else if (message.includes('salió')) {
                name = message.replace(' salió', '');
            }

            if (name && name !== 'Desconocido') {
                detectedPeople.set(name, Date.now());
            }

            // Actualizar panel
            renderDetectionPanel();
        }

        function renderDetectionPanel() {
            if (detectedPeople.size === 0) {
                panelContent.innerHTML = '<p class="no-detections">Sin detecciones</p>';
                return;
            }

            // Limpiar personas que salieron hace más de 30 segundos
            const now = Date.now();
            for (const [name, timestamp] of detectedPeople.entries()) {
                if (now - timestamp > 30000) {
                    detectedPeople.delete(name);
                }
            }

            // Renderizar lista
            const html = Array.from(detectedPeople.entries())
                .map(([name, timestamp]) => {
                    const ago = Math.floor((now - timestamp) / 1000);
                    return `
                        <div class="detection-item">
                            <div class="detection-avatar">👤</div>
                            <div class="detection-info">
                                <div class="detection-name">${name}</div>
                                <div class="detection-time">Hace ${ago}s</div>
                            </div>
                        </div>
                    `;
                })
                .join('');

            panelContent.innerHTML = html;
        }

        // Toggle panel
        togglePanelBtn.addEventListener('click', () => {
            detectionPanel.classList.toggle('collapsed');
            togglePanelBtn.textContent = detectionPanel.classList.contains('collapsed') ? '+' : '−';
        });

        // ============================================================
        // CONECTAR A FEED REMOTO
        // ============================================================
        async function connectToRemoteFeed() {
            console.log('connectToRemoteFeed llamado, selectedId:', selectedId);

            const forceRemote = !selectedType === "local";
            const useWS = forceRemote || localStorage.getItem("useWebSocket") === "true";
            
            if (!useWS) {
                console.log('⚠️ WebSocket deshabilitado, usando cámara local...');
                await connectToLocalFeed();
                return;
            }

            console.log('🌐 Conectando a feed remoto:', selectedId);
            showStatus('🔄 Conectando a feed remoto...');
            cameraContainer.classList.add('loading');

            if (webrtc) {
                webrtc.close();
                webrtc = null;
            }

            try {
                webrtc = new WebRTCManager({
                    wsUrl: CONFIG.WS_URL,
                    onRemoteFeed: (senderId, stream) => {
                        console.log('📡 Feed remoto recibido:', senderId);
                        
                        if (senderId === selectedId) {
                            console.log('Reemplazando feed con el remoto');
                            feedReceived = true;
                            clearTimeout(connectionTimeout);

                            if (videoEl.srcObject) {
                                videoEl.srcObject.getTracks().forEach(t => t.stop());
                            }
                            videoEl.srcObject = stream;
                            hideStatus();

                            stream.getTracks().forEach(track => {
                                track.onended = () => {
                                    console.warn('El feed remoto se ha detenido');
                                    showStatus('El feed remoto se ha detenido', true);
                                }
                            });

                            videoEl.play()
                                .then(() => {
                                    console.log('Video reproduciéndose');
                                    startDetection();
                                })
                                .catch(err => console.error('Error play:', err));
                        }
                    },
                    onLog: (msg) => console.log('[WebRTC]', msg)
                });

                await webrtc.init();
                console.log('✅ WebRTC inicializado');

                connectionTimeout = setTimeout(() => {
                    if (!feedReceived) {
                        console.warn('⚠️ Timeout');
                        
                        if (selectedType === "local") {
                            connectToLocalFeed();
                        } else {
                            showStatus('❌ No se recibió el feed', true);
                        }
                    }
                }, 10000);

            } catch (error) {
                console.error('❌ Error:', error);
                
                if (selectedType === "local") {
                    await connectToLocalFeed();
                } else {
                    showStatus('❌ Error: ' + error.message, true);
                }
            }
        }

        // ============================================================
        // CONECTAR A CÁMARA LOCAL
        // ============================================================
        async function connectToLocalFeed() {
            console.log('📹 Accediendo a cámara local...');
            showStatus('📹 Iniciando cámara local...');
            cameraContainer.classList.add('loading');

            try {
                const cameraIndex = selectedId ? parseInt(selectedId.split('-')[1]) - 1 : 0;

                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                
                console.log(`📹 ${videoDevices.length} cámara(s) disponible(s)`);

                if (videoDevices.length === 0) {
                    throw new Error('No se encontraron cámaras');
                }

                const selectedDevice = videoDevices[cameraIndex] || videoDevices[0];

                if (videoEl.srcObject) {
                    videoEl.srcObject.getTracks().forEach(t => t.stop());
                    videoEl.srcObject = null;
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: selectedDevice.deviceId ? 
                            { exact: selectedDevice.deviceId } : undefined,
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });

                console.log('✅ Stream obtenido');

                videoEl.srcObject = stream;
                hideStatus();

                await videoEl.play();
                console.log('▶️ Video reproduciéndose');
                
                // Iniciar detección
                startDetection();

            } catch (error) {
                console.error('❌ Error:', error);
                showStatus('❌ No se pudo acceder a la cámara', true);
            }
        }

        // ============================================================
        // INICIAR DETECCIÓN
        // ============================================================
        async function startDetection() {
            if (!faceRec) {
                console.warn('⚠️ Face Recognition no disponible');
                return;
            }

            // Esperar a que el video esté listo
            await waitForVideo();

            console.log('🎬 Iniciando detección facial...');

            // Ajustar canvas al tamaño del video
            canvasEl.width = videoEl.videoWidth;
            canvasEl.height = videoEl.videoHeight;

            console.log('📐 Canvas:', canvasEl.width, 'x', canvasEl.height);

            // Iniciar detección
            faceRec.startMultiDetection({
                videos: [videoEl],
                getRoomByVideo: () => selectedId,
                onDetect: (name, room) => {
                    if (name !== "Desconocido") {
                        console.log('👤 Detectado:', name, 'en', room);
                    }
                }
            });

            console.log('✅ Detección iniciada');
        }

        function waitForVideo() {
            return new Promise((resolve) => {
                if (videoEl.videoWidth && videoEl.videoHeight) {
                    resolve();
                } else {
                    videoEl.addEventListener('loadedmetadata', () => resolve(), { once: true });
                }
            });
        }

        // ============================================================
        // NAVEGACIÓN
        // ============================================================
        function goTo(offset) {
            if (feedList.length === 0) return;

            const index = feedList.indexOf(selectedId);
            if (index === -1) return;

            let newIndex = index + offset;
            
            if (newIndex < 0) newIndex = feedList.length - 1;
            if (newIndex >= feedList.length) newIndex = 0;

            const newId = feedList[newIndex];
            console.log('Cambiando a:', newId);
            
            localStorage.setItem("selectedFeed", newId);
            window.location.reload();
        }

        prevBtn.addEventListener("click", () => goTo(-1));
        nextBtn.addEventListener("click", () => goTo(1));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') goTo(-1);
            if (e.key === 'ArrowRight') goTo(1);
            if (e.key === 'Escape') window.history.back();
        });

        // ============================================================
        // EDICIÓN DE ETIQUETA
        // ============================================================

        function enableEditLabel() {
            const input = document.createElement("input");
            input.type = "text";
            input.value = currentLabel;
            input.style.fontSize = "18px";
            input.style.padding = "5px";

            // Reemplazar título por input
            titleEl.replaceWith(input);
            input.focus();

            // Guardar al presionar Enter
            input.addEventListener("keydown", async (e) => {
                if (e.key === "Enter") {
                    await saveLabel(input.value);
                    restoreTitle(input.value);
                }
            });

            // Guardar si pierde foco
            input.addEventListener("blur", async () => {
                await saveLabel(input.value);
                restoreTitle(input.value);
            });
        }

        async function saveLabel(newLabel) {
            if (!newLabel || newLabel.trim() === "") return;

            try {
                console.log("💾 Guardando label:", newLabel);

                const res = await fetch(`https://thefindoraprototipe.onrender.com/api/cameras`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    device_id: selectedId,
                    label: newLabel
                })
                });

                if (!res.ok) throw new Error("Error guardando");

                currentLabel = newLabel;

                // 🔥 actualizar localStorage
                const updated = {
                    ...selectedData,
                    label: newLabel
                };
                localStorage.setItem("selectedFeed", JSON.stringify(updated));

                console.log("✅ Label actualizado");

            } catch (err) {
                console.error("❌ Error guardando label:", err);
            }
        }

        function restoreTitle(newLabel) {
            const newTitle = document.createElement("h2");
            newTitle.id = "cameraTitle";
            newTitle.textContent = newLabel;

            const input = document.querySelector("input");
            input.replaceWith(newTitle);

            // volver a asignar referencia
            titleEl = newTitle;
        }

        // ============================================================
        // INICIALIZACIÓN
        // ============================================================
        async function init() {
            try {
                // Inicializar managers de detección
                await initManagers();

                // Conectar a feed
                const isLocalFeed = selectedId && selectedType === "local";
                
                if (isLocalFeed) {
                    console.log('📹 Feed local');
                    await connectToLocalFeed();
                } else {
                    console.log('📡 Feed remoto');
                    await connectToRemoteFeed();
                }

                // Actualizar panel cada 5 segundos
                setInterval(renderDetectionPanel, 5000);

            } catch (error) {
                console.error('❌ Error:', error);
                showStatus('❌ Error: ' + error.message, true);
            }
        }

        // Iniciar
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

        // Cleanup
        window.addEventListener('beforeunload', () => {
            if (videoEl.srcObject) {
                videoEl.srcObject.getTracks().forEach(t => t.stop());
            }
            if (webrtc) {
                webrtc.close();
                webrtc = null;
            }
            if (faceRec) {
                faceRec.stopDetection();
            }
        });