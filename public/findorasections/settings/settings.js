document.addEventListener("DOMContentLoaded", () => {

const Settings = {

state: {
useWebSocket: localStorage.getItem("useWebSocket") === "true",
showThumbnails: localStorage.getItem("showThumbnails") !== "false",
thumbnailQuality: localStorage.getItem("thumbnailQuality") || "medium",
thumbnailStyle: localStorage.getItem("thumbnailStyle") || "grid",
enableLocalCamera: localStorage.getItem("bg_enableLocalCamera") === "true",
showMiniPreview: localStorage.getItem("bg_showMiniPreview") !== "false",
previewPosition: localStorage.getItem("bg_previewPosition") || "bottom-right",
previewSize: localStorage.getItem("bg_previewSize") || "small"
},

// ============================================================
// HELPERS
// ============================================================

el(id){
return document.getElementById(id)
},

qs(selector){
return document.querySelector(selector)
},

qsa(selector){
return document.querySelectorAll(selector)
},

// ============================================================
// UI UPDATE FUNCTIONS
// ============================================================

updateThumbnailsUI(){

const options = this.el("thumbnailsOptions")

if(!options) return

options.style.display = this.state.showThumbnails ? "block" : "none"

},

updateBGCameraUI(){

const bgOptions = this.el("bg-options")
const bgWarning = this.el("bg-warning")

if(!bgOptions || !bgWarning) return

if(this.state.enableLocalCamera){

bgOptions.style.display = "block"
bgWarning.style.display = "block"

}else{

bgOptions.style.display = "none"
bgWarning.style.display = "none"

}

},

updatePreviewUI(){

const preview = this.el("preview-options")
if(!preview) return

preview.style.display = this.state.showMiniPreview ? "block" : "none"

},

updateWSStatus(){

const dot = this.el("ws-status-dot")
const text = this.el("ws-status-text")

if(!dot || !text) return

if(this.state.useWebSocket){
dot.classList.add("active")
text.textContent = "WebSocket: Habilitado"
}else{
dot.classList.remove("active")
text.textContent = "WebSocket: Deshabilitado"
}

},

// ============================================================
// LOAD SETTINGS INTO UI
// ============================================================

load(){

const thumbnailsToggle = this.el("thumbnailsToggle")
const thumbnailsContainer = this.el("thumbnailsToggleContainer")

if(thumbnailsToggle){

thumbnailsToggle.checked = this.state.showThumbnails

if(this.state.showThumbnails){
thumbnailsContainer?.classList.add("active")
}

}

this.updateThumbnailsUI()

const qualityRadio = this.qs(`input[name="thumbnailQuality"][value="${this.state.thumbnailQuality}"]`)
if (qualityRadio) qualityRadio.checked = true

this.qs(`.radio-option[data-quality="${this.state.thumbnailQuality}"]`)
?.classList.add("selected")

const styleRadio = this.qs(`input[name="thumbnailStyle"][value="${this.state.thumbnailStyle}"]`)
if (styleRadio) styleRadio.checked = true

this.qs(`.radio-option[data-style="${this.state.thumbnailStyle}"]`)
?.classList.add("selected")

const bgCameraToggle = this.el("bgCameraToggle")
const bgCameraContainer = this.el("bgCameraToggleContainer")

if(bgCameraToggle){

bgCameraToggle.checked = this.state.enableLocalCamera

if(this.state.enableLocalCamera){
bgCameraContainer?.classList.add("active")
}

}

this.updateBGCameraUI()

const bgPreviewToggle = this.el("bgPreviewToggle")
const bgPreviewContainer = this.el("bgPreviewToggleContainer")

if(bgPreviewToggle){

bgPreviewToggle.checked = this.state.showMiniPreview

if(this.state.showMiniPreview){
bgPreviewContainer?.classList.add("active")
}

}

this.updatePreviewUI()

const posRadio = this.qs(`input[name="position"][value="${this.state.previewPosition}"]`)
if (posRadio) posRadio.checked = true

this.qs(`.radio-option[data-position="${this.state.previewPosition}"]`)
?.classList.add("selected")

const sizeRadio = this.qs(`input[name="size"][value="${this.state.previewSize}"]`)
if (sizeRadio) sizeRadio.checked = true

this.qs(`.radio-option[data-size="${this.state.previewSize}"]`)
?.classList.add("selected")

},

// ============================================================
// EVENTS
// ============================================================

initEvents(){

const thumbnailsToggle = this.el("thumbnailsToggle")

thumbnailsToggle?.addEventListener("change",(e)=>{

this.state.showThumbnails = e.target.checked

this.el("thumbnailsToggleContainer")
?.classList.toggle("active",e.target.checked)

this.updateThumbnailsUI()

})

this.qsa('input[name="thumbnailQuality"]').forEach(radio=>{

radio.addEventListener("change",(e)=>{

this.state.thumbnailQuality = e.target.value

this.qsa(".radio-option[data-quality]")
.forEach(opt=>opt.classList.remove("selected"))

e.target.closest(".radio-option")
?.classList.add("selected")

})

})

this.qsa('input[name="thumbnailStyle"]').forEach(radio=>{

radio.addEventListener("change",(e)=>{

this.state.thumbnailStyle = e.target.value

this.qsa(".radio-option[data-style]")
.forEach(opt=>opt.classList.remove("selected"))

e.target.closest(".radio-option")
?.classList.add("selected")

})

})

const bgCameraToggle = this.el("bgCameraToggle")

bgCameraToggle?.addEventListener("change",(e)=>{

this.state.enableLocalCamera = e.target.checked

this.el("bgCameraToggleContainer")
?.classList.toggle("active",e.target.checked)

this.updateBGCameraUI()

})

const bgPreviewToggle = this.el("bgPreviewToggle")

bgPreviewToggle?.addEventListener("change",(e)=>{

this.state.showMiniPreview = e.target.checked

this.el("bgPreviewToggleContainer")
?.classList.toggle("active",e.target.checked)

this.updatePreviewUI()

})

this.qsa('input[name="position"]').forEach(radio=>{

radio.addEventListener("change",(e)=>{

this.state.previewPosition = e.target.value

this.qsa(".radio-option[data-position]")
.forEach(opt=>opt.classList.remove("selected"))

e.target.closest(".radio-option")
?.classList.add("selected")

})

})

this.qsa('input[name="size"]').forEach(radio=>{

radio.addEventListener("change",(e)=>{

this.state.previewSize = e.target.value

this.qsa(".radio-option[data-size]")
.forEach(opt=>opt.classList.remove("selected"))

e.target.closest(".radio-option")
?.classList.add("selected")

})

})

},

// ============================================================
// SAVE
// ============================================================

save(){

localStorage.setItem("useWebSocket",this.state.useWebSocket)
localStorage.setItem("showThumbnails",this.state.showThumbnails)
localStorage.setItem("thumbnailQuality",this.state.thumbnailQuality)
localStorage.setItem("thumbnailStyle",this.state.thumbnailStyle)
localStorage.setItem("bg_enableLocalCamera",this.state.enableLocalCamera)
localStorage.setItem("bg_showMiniPreview",this.state.showMiniPreview)
localStorage.setItem("bg_previewPosition",this.state.previewPosition)
localStorage.setItem("bg_previewSize",this.state.previewSize)

alert("✅ Configuración guardada correctamente.")

},

// ============================================================
// SIDEBAR NAV
// ============================================================

initSidebar(){

this.qsa(".menu-item").forEach(item=>{

item.addEventListener("click",()=>{

const section = item.dataset.section

this.qsa(".menu-item").forEach(i=>i.classList.remove("active"))
item.classList.add("active")

this.qsa(".settings-panel")
.forEach(p=>p.classList.remove("active"))

document.getElementById(section)
?.classList.add("active")

})

})

},

// ============================================================
// INIT
// ============================================================

init(){

this.load()
this.initEvents()
this.initSidebar()

}

}

window.saveSettings = ()=>Settings.save()

Settings.init()

})