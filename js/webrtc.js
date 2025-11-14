// webrtc.js
// Clase encargada de la señalización (WebSocket) y de manejar RTCPeerConnections entrantes (senders).
export default class WebRTCManager {
  /**
   * @param {string} wsUrl - URL del servidor WebSocket (ej: ws://localhost:8080)
   * @param {function(senderId:string, MediaStream):void} onRemoteFeed - callback cuando llega un feed remoto
   * @param {function(string):void} onLog - callback para logs
   * @param {number} maxFeeds - máximo feeds remotos permitidos
   */
  constructor({ wsUrl = 'ws://localhost:8080', onRemoteFeed = ()=>{}, onLog = ()=>{}, maxFeeds = 5 } = {}) {
    this.wsUrl = wsUrl;
    this.onRemoteFeed = onRemoteFeed;
    this.onLog = onLog;
    this.maxFeeds = maxFeeds;

    /** Map senderId => RTCPeerConnection */
    this.receiverPCs = {};

    /** Map senderId => HTMLVideoElement (oculto) */
    this.remoteVideos = {};

    this.ws = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.onLog('WebSocket conectado a ' + this.wsUrl);
        resolve();
      };

      this.ws.onerror = (e) => {
        this.onLog('WebSocket error: ' + (e?.message || 'error'));
        reject(e);
      };

      this.ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          this._handleMessage(data);
        } catch (err) {
          this.onLog('Error parseando mensaje WS: ' + err);
        }
      };
    });
  }

  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(data));
  }

  _handleMessage(data) {
    const { type } = data;
    if (type === 'offer') {
      this._handleOffer(data);
    } else if (type === 'answer') {
      // los senders procesan answers; este receptor no necesita actuar aquí
      this.onLog('Answer recibida (ignorada en receptor).');
    } else if (type === 'ice') {
      this._handleIce(data);
    } else {
      this.onLog('WS mensaje desconocido: ' + type);
    }
  }

  async _handleOffer(msg) {
    const from = msg.from;
    const offer = msg.offer;
    if (!from || !offer) return;

    // limitar feeds
    if (Object.keys(this.remoteVideos).length >= this.maxFeeds && !this.receiverPCs[from]) {
      this.onLog(`Máximo de feeds (${this.maxFeeds}) alcanzado — rechazando ${from}`);
      // opcional: enviar mensaje de rechazo
      this.send({ type: 'reject', to: from, reason: 'max_reached' });
      return;
    }

    if (this.receiverPCs[from]) {
      this.onLog(`Offer recibida pero ya existe PC para ${from}`);
      return;
    }

    const pc = new RTCPeerConnection();
    this.receiverPCs[from] = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.send({ type: 'ice', to: from, ice: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      // registrar feed remoto
      this._registerRemoteFeed(from, stream);
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.send({ type: 'answer', to: from, answer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      this.onLog('Answer enviada a ' + from);
    } catch (err) {
      this.onLog('Error procesando offer: ' + err);
    }
  }

  async _handleIce(msg) {
    // ice puede venir con { to, from, ice }
    const to = msg.to;
    const from = msg.from;
    const ice = msg.ice;
    // si el message trae 'to' y ese to corresponde a un pc en receiverPCs => agregar
    if (to && this.receiverPCs[to]) {
      try { await this.receiverPCs[to].addIceCandidate(new RTCIceCandidate(ice)); } catch(e){ this.onLog('ICE add error: ' + e); }
      return;
    }
    // si vino con 'from' que coincide
    if (from && this.receiverPCs[from]) {
      try { await this.receiverPCs[from].addIceCandidate(new RTCIceCandidate(ice)); } catch(e){ this.onLog('ICE add error: ' + e); }
      return;
    }
    // en general ignorar
  }

  _registerRemoteFeed(senderId, stream) {
    // si ya existe, reemplazar stream
    if (this.remoteVideos[senderId]) {
      this.remoteVideos[senderId].srcObject = stream;
      this.onRemoteFeed(senderId, stream);
      return;
    }

    // crear elemento video oculto (el UI puede moverlo a donde quiera)
    const videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.muted = true;
    videoEl.className = 'remote-video';
    videoEl.id = `remote-${senderId}`;
    videoEl.srcObject = stream;

    // mantener referencias
    this.remoteVideos[senderId] = videoEl;

    // notificar al UI
    this.onRemoteFeed(senderId, stream);

    // dejar elemento en body (oculto) para que pueda reproducirse
    document.body.appendChild(videoEl);
  }

  // Permite cerrar y limpiar resources de un sender
  closeRemote(senderId) {
    const pc = this.receiverPCs[senderId];
    if (pc) { pc.close(); delete this.receiverPCs[senderId]; }
    const v = this.remoteVideos[senderId];
    if (v) { v.srcObject = null; v.remove(); delete this.remoteVideos[senderId]; }
    this.onLog('Remote feed ' + senderId + ' cerrado');
  }

  // Cierra todo
  close() {
    for (const k in this.receiverPCs) this.closeRemote(k);
    if (this.ws) this.ws.close();
  }
}
