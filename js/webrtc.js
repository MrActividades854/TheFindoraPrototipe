// webrtc.js (versión corregida)
// Manejo de señalización WebSocket + múltiples PeerConnections receptoras (one receiver PC per sender)

export default class WebRTCManager {
  constructor({ wsUrl = 'ws://192.168.101.15:8080', onRemoteFeed = ()=>{}, onLog = ()=>{}, maxFeeds = 5 } = {}) {
    this.wsUrl = wsUrl;
    this.onRemoteFeed = onRemoteFeed;
    this.onLog = onLog;
    this.maxFeeds = maxFeeds;

    this.receiverPCs = {};   // senderId => RTCPeerConnection
    this.remoteVideos = {};  // senderId => HTMLVideoElement
    this.ws = null;
  }

  // -------------------------
  // Init + reconexión WS
  // -------------------------
  init() {
    return new Promise((resolve, reject) => {
      const connect = () => {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          this.onLog('WebSocket conectado a ' + this.wsUrl);
          resolve();
        };

        this.ws.onerror = (e) => {
          this.onLog('WebSocket error: ' + (e?.message || 'error'));
        };

        this.ws.onclose = () => {
          this.onLog('WebSocket cerrado, reintentando en 1s...');
          setTimeout(connect, 1000);
        };

        // manejar mensajes (acepta Blob / ArrayBuffer / string)
        this.ws.onmessage = async (ev) => {
          try {
            let text;
            if (ev.data instanceof Blob) text = await ev.data.text();
            else if (ev.data instanceof ArrayBuffer) text = new TextDecoder().decode(ev.data);
            else text = ev.data;

            const data = JSON.parse(text);
            this._handleMessage(data);
          } catch (err) {
            this.onLog("Error parseando mensaje WS: " + err);
            console.error("Contenido recibido (raw):", ev.data);
          }
        };
      };

      connect();
    });
  }

  // wrapper para enviar JSON por WS
  _sendWS(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(obj));
    } catch (e) {
      this.onLog('WS send error: ' + e);
    }
  }

  send(data) { this._sendWS(data); }

  // -------------------------
  // Mensajes entrantes
  // -------------------------
  _handleMessage(data) {
    const { type } = data;
    if (type === 'offer') {
      this._handleOffer(data);
    } else if (type === 'answer') {
      // Si alguna vez receptor necesita procesar answers, se haría aquí
      this.onLog('Answer recibida (ignorada en receptor).');
    } else if (type === 'ice') {
      this._handleIce(data);
    } else if (type === 'reject') {
      this.onLog(`Sender rechazado: ${data.reason || 'sin motivo'}`);
    } else {
      this.onLog('WS mensaje desconocido: ' + type);
    }

  }

  // -------------------------
  // Crear y configurar Receiver PC
  // -------------------------
  _createReceiverPC(senderId) {
    if (this.receiverPCs[senderId]) return this.receiverPCs[senderId];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    });

    // store
    this.receiverPCs[senderId] = pc;

    // enviar candidatos ICE al sender a través del WS
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this._sendWS({
          type: 'ice',
          to: senderId,
          ice: {
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex
          }
        });
      }
    };

    // cuando llega track remoto
    pc.ontrack = (ev) => {
      const stream = ev.streams && ev.streams[0];
      if (stream) {
        this._registerRemoteFeed(senderId, stream);
        this.onLog(`[WebRTC] track recibido de ${senderId}`);
      } else {
        this.onLog(`[WebRTC] ontrack sin streams de ${senderId}`);
      }
    };

    // conexión cerrada / estado
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState || pc.iceConnectionState;
      this.onLog(`[WebRTC] estado PC ${senderId}: ${s}`);
      if (s === 'failed' || s === 'disconnected' || s === 'closed') {
        // opcional: limpiar resources aquí o esperar a closeRemote
      }
    };

    return pc;
  }

  // -------------------------
  // Manejo de OFFER (sender -> receiver)
  // -------------------------
  async _handleOffer(msg) {
    const senderId = msg.from;
    const offer = msg.offer;
    if (!senderId || !offer) return;

    // límite de feeds
    if (Object.keys(this.remoteVideos).length >= this.maxFeeds && !this.receiverPCs[senderId]) {
      this.onLog(`Máximo de feeds (${this.maxFeeds}) alcanzado — rechazando ${senderId}`);
      this._sendWS({ type: 'reject', to: senderId, reason: 'max_reached' });
      return;
    }

    // si ya tenemos PC para este sender, devolvemos log y no creamos duplicado
    if (this.receiverPCs[senderId]) {
      this.onLog(`Offer recibida pero ya existe PC para ${senderId}`);
      // Intentamos actualizar remoteDesc si queremos soportar renegociación
    }

    // crear PC si no existe
    const pc = this._createReceiverPC(senderId);

    try {
      // set remote (offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // create & set local (answer)
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // enviar answer al sender (usando la localDescription del PC correcto)
      this._sendWS({
        type: 'answer',
        to: senderId,
        answer: {
          type: pc.localDescription.type,
          sdp: pc.localDescription.sdp
        }
      });

      this.onLog('Answer enviada a ' + senderId);
    } catch (err) {
      this.onLog('Error procesando offer: ' + err);
      console.error(err);
    }
  }

  // -------------------------
  // Manejo ICE
  // -------------------------
  async _handleIce(msg) {
    const to = msg.to;
    const from = msg.from;
    const ice = msg.ice;
    // si viene con 'to' que coincide con un receiver PC -> agregar
    if (to && this.receiverPCs[to]) {
      try {
        await this.receiverPCs[to].addIceCandidate(new RTCIceCandidate(ice));
      } catch (e) {
        this.onLog('ICE add error (to): ' + e);
      }
      return;
    }
    // si viene con 'from' que coincide -> agregar
    if (from && this.receiverPCs[from]) {
      try {
        await this.receiverPCs[from].addIceCandidate(new RTCIceCandidate(ice));
      } catch (e) {
        this.onLog('ICE add error (from): ' + e);
      }
      return;
    }
    // si no corresponde a ningún PC -> ignorar
  }

  // -------------------------
  // Registrar feed remoto y crear <video>
  // -------------------------
  _registerRemoteFeed(senderId, stream) {
    // si ya existe video, actualizar stream y notificar UI
    if (this.remoteVideos[senderId]) {
      const v = this.remoteVideos[senderId];
      v.srcObject = stream;
      if (this.onRemoteFeed) this.onRemoteFeed(senderId, stream);
      return;
    }

    // crear <video>
    const videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.className = 'remote-video';
    videoEl.id = `remote-${senderId}`;
    videoEl.srcObject = stream;

    // estilo básico para que el UI pueda colocarlo bien (UI podrá sobreescribir)
    videoEl.style.position = 'absolute';
    videoEl.style.top = '0';
    videoEl.style.left = '0';
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'cover';
    videoEl.style.display = 'none';
    videoEl.style.zIndex = '1';

    // añadir dentro del contenedor (mejor lugar para overlay)
    const container = document.getElementById('container');
    if (container) container.appendChild(videoEl);
    else document.body.appendChild(videoEl);

    this.remoteVideos[senderId] = videoEl;

    // notificar al UI (ahora ya existe en DOM)
    if (this.onRemoteFeed) this.onRemoteFeed(senderId, stream);

    // intentar reproducir cuando metadata esté lista
    videoEl.onloadedmetadata = () => {
      videoEl.play().catch(e => this.onLog('Video play error: ' + e));
    };
  }

  // -------------------------
  // Cerrar feed y limpiar
  // -------------------------
  closeRemote(senderId) {
    const pc = this.receiverPCs[senderId];
    if (pc) { try { pc.close(); } catch(e){} delete this.receiverPCs[senderId]; }
    const v = this.remoteVideos[senderId];
    if (v) { v.srcObject = null; v.remove(); delete this.remoteVideos[senderId]; }
    this.onLog('Remote feed ' + senderId + ' cerrado');
  }

  close() {
    for (const k in this.receiverPCs) this.closeRemote(k);
    if (this.ws) this.ws.close();
  }
}
