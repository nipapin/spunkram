import { resolve } from 'path'
import {
  defineConfig,
  externalizeDepsPlugin,
  bytecodePlugin
} from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import pkg from './package.json'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()],
    resolve: {
      alias: {
        '@common': resolve('src/common')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()]
  },
  renderer: {
    define: {
      'process.env.PACKAGE_NAME': JSON.stringify(pkg.name),
      'process.env.PACKAGE_VERSION': JSON.stringify(pkg.version),
      'process.env.PACKAGE_PRODUCT_NAME': JSON.stringify(pkg.productName)
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@common': resolve('src/common')
      }
    },
    plugins: [vue()],
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()]
      }
    }
  }
})
