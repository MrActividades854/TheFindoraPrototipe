
        // ============================================================
        // CARGAR CONFIGURACIÓN ACTUAL
        // ============================================================
        
        const config = {
            useWebSocket: localStorage.getItem("useWebSocket") === "true",
            showThumbnails: localStorage.getItem('showThumbnails') !== 'false',
            thumbnailQuality: localStorage.getItem('thumbnailQuality') || 'medium',
            thumbnailStyle: localStorage.getItem('thumbnailStyle') || 'grid',
            enableLocalCamera: localStorage.getItem('bg_enableLocalCamera') === 'true',
            showMiniPreview: localStorage.getItem('bg_showMiniPreview') !== 'false',
            previewPosition: localStorage.getItem('bg_previewPosition') || 'bottom-right',
            previewSize: localStorage.getItem('bg_previewSize') || 'small'
        };

        // ============================================================
        // APLICAR VALORES INICIALES
        // ============================================================
        
        function loadSettings() {
            // WebSocket
            const wsToggle = document.getElementById('wsToggle');
            const wsToggleContainer = document.getElementById('wsToggleContainer');
            wsToggle.checked = config.useWebSocket;
            if (config.useWebSocket) wsToggleContainer.classList.add('active');
            updateWSStatus();

            // Thumbnails
            const thumbnailsToggle = document.getElementById('thumbnailsToggle');
            const thumbnailsContainer = document.getElementById('thumbnailsToggleContainer');
            thumbnailsToggle.checked = config.showThumbnails;
            if (config.showThumbnails) thumbnailsContainer.classList.add('active');
            updateThumbnailsUI();

            // Thumbnail Quality
            document.querySelector(`input[name="thumbnailQuality"][value="${config.thumbnailQuality}"]`).checked = true;
            document.querySelector(`.radio-option[data-quality="${config.thumbnailQuality}"]`).classList.add('selected');

            // Thumbnail Style
            document.querySelector(`input[name="thumbnailStyle"][value="${config.thumbnailStyle}"]`).checked = true;
            document.querySelector(`.radio-option[data-style="${config.thumbnailStyle}"]`).classList.add('selected');

            // Background Camera
            const bgCameraToggle = document.getElementById('bgCameraToggle');
            const bgCameraContainer = document.getElementById('bgCameraToggleContainer');
            bgCameraToggle.checked = config.enableLocalCamera;
            if (config.enableLocalCamera) bgCameraContainer.classList.add('active');
            updateBGCameraUI();

            // Preview
            const bgPreviewToggle = document.getElementById('bgPreviewToggle');
            const bgPreviewContainer = document.getElementById('bgPreviewToggleContainer');
            bgPreviewToggle.checked = config.showMiniPreview;
            if (config.showMiniPreview) bgPreviewContainer.classList.add('active');
            updatePreviewUI();

            // Radio buttons
            document.querySelector(`input[name="position"][value="${config.previewPosition}"]`).checked = true;
            document.querySelector(`.radio-option[data-position="${config.previewPosition}"]`).classList.add('selected');

            document.querySelector(`input[name="size"][value="${config.previewSize}"]`).checked = true;
            document.querySelector(`.radio-option[data-size="${config.previewSize}"]`).classList.add('selected');
        }

        // ============================================================
        // EVENT LISTENERS
        // ============================================================
        
        // WebSocket Toggle
        document.getElementById('wsToggle').addEventListener('change', function() {
            config.useWebSocket = this.checked;
            
            const container = document.getElementById('wsToggleContainer');
            if (this.checked) {
                container.classList.add('active');
            } else {
                container.classList.remove('active');
            }
            
            updateWSStatus();
        });

        // Thumbnails Toggle
        document.getElementById('thumbnailsToggle').addEventListener('change', function() {
            config.showThumbnails = this.checked;
            
            const container = document.getElementById('thumbnailsToggleContainer');
            if (this.checked) {
                container.classList.add('active');
            } else {
                container.classList.remove('active');
            }
            
            updateThumbnailsUI();
        });

        // Thumbnail Quality Radio Buttons
        document.querySelectorAll('input[name="thumbnailQuality"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                config.thumbnailQuality = e.target.value;
                
                // Update visual selection
                document.querySelectorAll('.radio-option[data-quality]').forEach(opt => {
                    opt.classList.remove('selected');
                });
                e.target.closest('.radio-option').classList.add('selected');
            });
        });

        // Thumbnail Style Radio Buttons
        document.querySelectorAll('input[name="thumbnailStyle"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                config.thumbnailStyle = e.target.value;
                
                // Update visual selection
                document.querySelectorAll('.radio-option[data-style]').forEach(opt => {
                    opt.classList.remove('selected');
                });
                e.target.closest('.radio-option').classList.add('selected');
            });
        });

        // Background Camera Toggle
        document.getElementById('bgCameraToggle').addEventListener('change', function() {
            config.enableLocalCamera = this.checked;
            
            const container = document.getElementById('bgCameraToggleContainer');
            if (this.checked) {
                container.classList.add('active');
            } else {
                container.classList.remove('active');
            }
            
            updateBGCameraUI();
        });

        // Preview Toggle
        document.getElementById('bgPreviewToggle').addEventListener('change', function() {
            config.showMiniPreview = this.checked;
            
            const container = document.getElementById('bgPreviewToggleContainer');
            if (this.checked) {
                container.classList.add('active');
            } else {
                container.classList.remove('active');
            }
            
            updatePreviewUI();
        });

        // Position Radio Buttons
        document.querySelectorAll('input[name="position"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                config.previewPosition = e.target.value;
                
                // Update visual selection
                document.querySelectorAll('.radio-option[data-position]').forEach(opt => {
                    opt.classList.remove('selected');
                });
                e.target.closest('.radio-option').classList.add('selected');
            });
        });

        // Size Radio Buttons
        document.querySelectorAll('input[name="size"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                config.previewSize = e.target.value;
                
                // Update visual selection
                document.querySelectorAll('.radio-option[data-size]').forEach(opt => {
                    opt.classList.remove('selected');
                });
                e.target.closest('.radio-option').classList.add('selected');
            });
        });

        // ============================================================
        // UI UPDATES
        // ============================================================
        
        function updateWSStatus() {
            const dot = document.getElementById('ws-status-dot');
            const text = document.getElementById('ws-status-text');
            
            if (config.useWebSocket) {
                dot.classList.add('active');
                text.textContent = 'WebSocket: Habilitado';
            } else {
                dot.classList.remove('active');
                text.textContent = 'WebSocket: Deshabilitado';
            }
        }

        function updateThumbnailsUI() {
            const thumbnailsOptions = document.getElementById('thumbnailsOptions');
            
            if (config.showThumbnails) {
                thumbnailsOptions.style.display = 'block';
            } else {
                thumbnailsOptions.style.display = 'none';
            }
        }

        function updateBGCameraUI() {
            const bgOptions = document.getElementById('bg-options');
            const bgWarning = document.getElementById('bg-warning');
            
            if (config.enableLocalCamera) {
                bgOptions.style.display = 'block';
                bgWarning.style.display = 'block';
            } else {
                bgOptions.style.display = 'none';
                bgWarning.style.display = 'none';
            }
        }

        function updatePreviewUI() {
            const previewOptions = document.getElementById('preview-options');
            
            if (config.showMiniPreview) {
                previewOptions.style.display = 'block';
            } else {
                previewOptions.style.display = 'none';
            }
        }

        // ============================================================
        // GUARDAR CONFIGURACIÓN
        // ============================================================
        
        window.saveSettings = function() {
            // Guardar en localStorage
            localStorage.setItem('useWebSocket', config.useWebSocket);
            localStorage.setItem('showThumbnails', config.showThumbnails);
            localStorage.setItem('thumbnailQuality', config.thumbnailQuality);
            localStorage.setItem('thumbnailStyle', config.thumbnailStyle);
            localStorage.setItem('bg_enableLocalCamera', config.enableLocalCamera);
            localStorage.setItem('bg_showMiniPreview', config.showMiniPreview);
            localStorage.setItem('bg_previewPosition', config.previewPosition);
            localStorage.setItem('bg_previewSize', config.previewSize);

            // Mostrar confirmación
            alert('✅ Configuración guardada correctamente.\n\nLos cambios se aplicarán al recargar las páginas.');
            
        };

        // ============================================================
        // INICIALIZACIÓN
        // ============================================================
        
        loadSettings();