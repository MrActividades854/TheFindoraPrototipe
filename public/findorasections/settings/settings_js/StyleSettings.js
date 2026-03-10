export default class StyleSettings{

    constructor(state){
        this.state = state
    }

    init(){

        document.querySelectorAll('input[name="position"]').forEach(radio=>{

            radio.addEventListener("change",(e)=>{
                this.state.previewPosition = e.target.value
            })

        })

        document.querySelectorAll('input[name="size"]').forEach(radio=>{

            radio.addEventListener("change",(e)=>{
                this.state.previewSize = e.target.value
            })

        })

    }

    load(){}

}