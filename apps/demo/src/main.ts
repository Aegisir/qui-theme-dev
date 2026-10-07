import { createApp } from 'vue'
import App from './App.vue'

const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.classList.toggle('default-dark', darkMode)
createApp(App).mount('#app')
