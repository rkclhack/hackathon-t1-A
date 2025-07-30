import { createRouter, createWebHistory } from "vue-router"
import Chat from "../components/Chat.vue"
import Login from "../components/Login.vue"
import AuthService from "../services/AuthService.js"

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "login",
      component: Login
    },{
      path: "/chat/",
      name: "chat",
      component: Chat,
      beforeEnter: (to, from, next) => {
        // Firebase Authenticationでの認証チェック、または従来のログインからの遷移を許可
        if (AuthService.isAuthenticated() || from.name === "login") {
          next()
        } else {
          next({ name:"login" })
        }
      },
    }
  ],
})

export default router