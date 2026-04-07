export default class AccountSettings {

    constructor(state){
        this.state = state
        this.api = "/api"
        this.token = localStorage.getItem("token")
    }

    init(){

        this.bindEvents()
        this.loadUser()

    }

    bindEvents(){

        document.getElementById("updateNameBtn")
        ?.addEventListener("click",()=>this.updateName())

        document.getElementById("updateEmailBtn")
        ?.addEventListener("click",()=>this.updateEmail())

        document.getElementById("updatePasswordBtn")
        ?.addEventListener("click",()=>this.updatePassword())

        document.getElementById("uploadProfileBtn")
        ?.addEventListener("click",()=>this.uploadImage())

        document.getElementById("logoutBtn")
        ?.addEventListener("click",()=>this.logout())

    }

    async loadUser(){

        try{

            const res = await fetch(`https://thefindoraprototipe.onrender.com/api/me`,{
                headers:{
                    Authorization:`Bearer ${this.token}`
                }
            })

            const user = await res.json()

            const nameInput = document.getElementById("accountNameInput")
            const emailInput = document.getElementById("accountEmailInput")
            const img = document.getElementById("accountProfilePreview")

            if(nameInput) nameInput.value = user.name
            if(emailInput) emailInput.value = user.email
            if(img && user.profile_image) img.src = user.profile_image

        }catch(err){

            console.error("Error loading user",err)

        }

    }

    async updateName(){

        const name = document.getElementById("accountNameInput").value

        const res = await fetch(`https://thefindoraprototipe.onrender.com/api/user/update_name`,{

            method:"PUT",

            headers:{
                "Content-Type":"application/json",
                Authorization:`Bearer ${this.token}`
            },

            body:JSON.stringify({name})

        })

        if(res.ok){

            alert("✅ Name updated")

        }else{

            alert("❌ Error updating name")

        }

    }

    async updateEmail(){

        const email = document.getElementById("accountEmailInput").value

        const res = await fetch(`https://thefindoraprototipe.onrender.com/api/user/update_email`,{

            method:"PUT",

            headers:{
                "Content-Type":"application/json",
                Authorization:`Bearer ${this.token}`
            },

            body:JSON.stringify({email})

        })

        if(res.ok){

            alert("✅ Email updated")

        }else{

            alert("❌ Error updating email")

        }

    }

    async updatePassword(){

        const currentPassword = document.getElementById("currentPassword").value
        const newPassword = document.getElementById("newPassword").value

        const res = await fetch(`https://thefindoraprototipe.onrender.com/api/user/update_password`,{

            method:"PUT",

            headers:{
                "Content-Type":"application/json",
                Authorization:`Bearer ${this.token}`
            },

            body:JSON.stringify({currentPassword,newPassword})

        })

        if(res.ok){

            alert("✅ Password updated")

        }else{

            alert("❌ Error updating password")

        }

    }

    async uploadImage(){

        const file = document.getElementById("accountProfileImage").files[0]

        if(!file){
            alert("Select an image")
            return
        }

        const form = new FormData()
        form.append("image",file)

        const res = await fetch(`https://thefindoraprototipe.onrender.com/api/user/upload_profile`,{

            method:"POST",

            headers:{
                Authorization:`Bearer ${this.token}`
            },

            body:form

        })

        if(res.ok){

            alert("✅ Image uploaded")

            this.loadUser()

        }else{

            alert("❌ Upload failed")

        }

    }

    logout(){

        localStorage.removeItem("token")

        window.location.href = "/login.html"

    }

}