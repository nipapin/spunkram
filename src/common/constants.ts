export const EXTENSION_NAME = 'Spunkram'
export const AUTHOR_NAME = 'SpunkramTemp'
// Базовый URL API
const BASE_API_URL = 'https://api.get-atomx.com/atomx/v1/'

// Функция для создания URL с параметром ext_name
const createUrlWithExtName = (slug: string, link_slug: string | null) => {
  const url = new URL(slug, BASE_API_URL).toString()
  const authorNameUrlConvert = encodeURIComponent(AUTHOR_NAME)
  const assignAuthor =
    slug == 'author'
      ? `name=${authorNameUrlConvert}`
      : `king=${authorNameUrlConvert}`
  const pPath = slug === 'link' ? `&goto=${link_slug}` : ''

  return `${url}?${assignAuthor}${pPath}`
}

// Прямой API доступ к версиям, скачиванию расширения
// export const URL_VERSIONS_LIST = 'C:/OBS Video/sd/versions.json'
export const URL_VERSIONS_LIST = createUrlWithExtName('versions_list', null)
export const EXTENSION_URL = createUrlWithExtName('download_plugin', null)

// Ссылки - переходы на страницы (редиректы настраиваются в админ панели)
export const URL_REPORT_BUG = createUrlWithExtName('link', 'bug_report')
export const URL_VISIT_WEBSITE = createUrlWithExtName('author', null)
export const URL_HELP_CENTER = createUrlWithExtName('link', 'help_center')
export const URL_UPDATES_LOG = createUrlWithExtName('link', 'updates_log')
export const URL_HELP_INSTALL_MANUALLY = createUrlWithExtName(
  'link',
  'h_manual_installation'
)
