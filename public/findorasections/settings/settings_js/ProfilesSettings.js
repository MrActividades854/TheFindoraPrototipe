export default class ProfilesSettings{

    constructor(state){
        this.state = state
    }

    init(){

        const toggle = document.getElementById("thumbnailsToggle")

        toggle?.addEventListener("change",(e)=>{

            this.state.showThumbnails = e.target.checked

            const container = document.getElementById("thumbnailsToggleContainer")

            container.classList.toggle("active",e.target.checked)

            this.updateUI()
        })


        document.querySelectorAll('input[name="thumbnailQuality"]').forEach(radio=>{

            radio.addEventListener("change",(e)=>{

                this.state.thumbnailQuality = e.target.value

                document.querySelectorAll(".radio-option[data-quality]").forEach(o=>{
                    o.classList.remove("selected")
                })

                e.target.closest(".radio-option").classList.add("selected")

            })

        })

    }

    load(){

        const toggle = document.getElementById("thumbnailsToggle")

        if(toggle) toggle.checked = this.state.showThumbnails

        this.updateUI()

    }

    updateUI(){

        const options = document.getElementById("thumbnailsOptions")

        if(!options) return

        options.style.display = this.state.showThumbnails ? "block":"none"

    }

}