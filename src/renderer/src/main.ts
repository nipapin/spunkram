import './assets/main.css'
import './assets/odin.css'

import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
document.title = `${process.env.PACKAGE_PRODUCT_NAME} ${process.env.PACKAGE_VERSION}`
createApp(App).use(i18n).mount('#app')
