import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import pngToIco from 'png-to-ico'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'resources/icon.png')
const out = path.join(root, 'build/icon.ico')

await fs.mkdir(path.dirname(out), { recursive: true })
const buf = await pngToIco(src)
await fs.writeFile(out, buf)
console.log(`Windows icon written: ${out}`)
