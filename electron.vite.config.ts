import vue from '@vitejs/plugin-vue'
import autoprefixer from 'autoprefixer'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'
import tailwindcss from 'tailwindcss'
import pkg from './package.json'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@common': resolve('src/common')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
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
