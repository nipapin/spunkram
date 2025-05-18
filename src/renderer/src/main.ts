import './assets/main.css'
import './assets/odin.css'

import { createApp } from 'vue'
import App from './App.vue'
document.title = `${process.env.PACKAGE_PRODUCT_NAME} ${process.env.PACKAGE_VERSION}`
createApp(App).mount('#app')
