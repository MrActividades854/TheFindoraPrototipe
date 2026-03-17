import AccountSettings from "./AccountSettings.js"
import ProfilesSettings from "./ProfilesSettings.js"
import FDSettings from "./FDSettings.js"
import NotificationsSettings from "./NotificationsSettings.js"
import StyleSettings from "./StyleSettings.js"

class SettingsManager {

    constructor(){

        this.state = {
            useWebSocket: localStorage.getItem("useWebSocket") === "true",
            showThumbnails: localStorage.getItem("showThumbnails") !== "false",
            thumbnailQuality: localStorage.getItem("thumbnailQuality") || "medium",
            thumbnailStyle: localStorage.getItem("thumbnailStyle") || "grid",

            enableLocalCamera: localStorage.getItem("bg_enableLocalCamera") === "true",
            showMiniPreview: localStorage.getItem("bg_showMiniPreview") !== "false",
            previewPosition: localStorage.getItem("bg_previewPosition") || "bottom-right",
            previewSize: localStorage.getItem("bg_previewSize") || "small"
        }

        this.modules = {}
    }

    init(){

        this.modules.account = new AccountSettings(this.state)
        this.modules.profiles = new ProfilesSettings(this.state)
        this.modules.fd = new FDSettings(this.state)
        this.modules.notifications = new NotificationsSettings(this.state)
        this.modules.style = new StyleSettings(this.state)

        Object.values(this.modules).forEach(m=>{
            if(m.init) m.init()
        })

        this.initMenu()
        this.loadSettings()
    }

    loadSettings(){

        Object.values(this.modules).forEach(m=>{
            if(m.load) m.load()
        })
    }

    initMenu(){

        document.querySelectorAll(".menu-item").forEach(item=>{

            item.addEventListener("click",()=>{

                const section = item.dataset.section

                document.querySelectorAll(".menu-item").forEach(i=>{
                    i.classList.remove("active")
                })

                item.classList.add("active")

                document.querySelectorAll(".settings-panel").forEach(p=>{
                    p.classList.remove("active")
                })

                document.getElementById(section).classList.add("active")

            })

        })
    }

    save(){

        localStorage.setItem("useWebSocket",this.state.useWebSocket)
        localStorage.setItem("showThumbnails",this.state.showThumbnails)
        localStorage.setItem("thumbnailQuality",this.state.thumbnailQuality)
        localStorage.setItem("thumbnailStyle",this.state.thumbnailStyle)

        localStorage.setItem("bg_enableLocalCamera",this.state.enableLocalCamera)
        localStorage.setItem("bg_showMiniPreview",this.state.showMiniPreview)
        localStorage.setItem("bg_previewPosition",this.state.previewPosition)
        localStorage.setItem("bg_previewSize",this.state.previewSize)

        alert("✅ Configuración guardada")
    }

}

const settings = new SettingsManager()
settings.init()

window.saveSettings = ()=> settings.save()