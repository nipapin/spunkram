import { ipcMain } from 'electron'
import { AUTHOR_NAME } from '@common/constants'

const BASE_API_URL = 'https://api.get-atomx.com/atomx/v1'

export function registerFetchLinksHandlers() {
  ipcMain.handle('fetch-links', async () => {
    const response = await fetch(
      `${BASE_API_URL}/plinks_config?author=${AUTHOR_NAME}`
    )
    if (!response.ok) return {}

    const data = await response.json()
    if (data && Array.isArray(data)) {
      return data.reduce(
        (
          acc: Record<string, string>,
          item: { name: string; href: string }
        ) => ({
          ...acc,
          [item.name]: item.href
        }),
        {}
      )
    }
    return {}
  })
}
