export default class FDSettings{

    constructor(state){
        this.state = state
    }

    init(){

        const toggle = document.getElementById("bgCameraToggle")

        toggle?.addEventListener("change",(e)=>{

            this.state.enableLocalCamera = e.target.checked

            const container = document.getElementById("bgCameraToggleContainer")

            container.classList.toggle("active",e.target.checked)

            this.updateUI()

        })

    }

    load(){

        const toggle = document.getElementById("bgCameraToggle")

        if(toggle) toggle.checked = this.state.enableLocalCamera

        this.updateUI()

    }

    updateUI(){

        const options = document.getElementById("bg-options")
        const warning = document.getElementById("bg-warning")

        if(!options) return

        const show = this.state.enableLocalCamera

        options.style.display = show ? "block":"none"
        warning.style.display = show ? "block":"none"

    }

}