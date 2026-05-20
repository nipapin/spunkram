<h1 align="center">Spunkram Installer</h1>

<p align="center">
  Electron-приложение, которое скачивает CEP-расширение Spunkram и нативные плагины (CSBridge) для Adobe Premiere Pro и After Effects, и кладёт их в нужные системные папки.
</p>

---

## Что делает установщик

1. Сходить в API `api.get-atomx.com` за списком версий расширения (stable / beta).
2. Скачать выбранный `.zxp` (на самом деле это zip), распаковать его во временный каталог.
3. Атомарно подменить содержимое CEP-каталога расширения (см. [Куда ставится](#куда-ставится)).
4. Распаковать нативные плагины и положить их в системные каталоги Adobe.
5. Сохранить локальный маркер версии в `userData`, чтобы при следующем запуске UI знал, что уже установлено.

Дополнительно: мониторит запущенные Premiere Pro / After Effects и блокирует установку, если они открыты и при этом надо ставить нативные плагины.

---

## Куда ставится

### CEP-расширение

Папка `Spunkram` со скриптами расширения. Установщик выбирает её так:

| Условие | Путь |
|---|---|
| Расширение уже стоит system-wide | `…/CEP/extensions/Spunkram` (та же папка) |
| Иначе | user-каталог |

| ОС | system-wide | per-user |
|---|---|---|
| Windows | `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\Spunkram` | `%APPDATA%\Adobe\CEP\extensions\Spunkram` |
| macOS | `/Library/Application Support/Adobe/CEP/extensions/Spunkram` | `~/Library/Application Support/Adobe/CEP/extensions/Spunkram` |

> Important: если по обоим путям одновременно лежат две копии расширения, CEP грузит system-копию. Поэтому установщик специально пишет туда же, где уже что-то лежит, чтобы не плодить дубликаты.

### Нативные плагины (CSBridge)

| Файл | Windows | macOS |
|---|---|---|
| `MotionflowBridge.*` | `C:\Program Files\Adobe\Common\Plug-ins\ControlSurface` | `/Library/Application Support/Adobe/Common/Plug-ins/ControlSurface` |
| `MotionflowInit.*` | `C:\Program Files\Adobe\Common\Plug-ins\7.0\MediaCore` | `/Library/Application Support/Adobe/Common/Plug-ins/7.0/MediaCore` |

Обе системные папки требуют админ-прав, поэтому копирование туда поднимается одной командой через `sudo-prompt` (UAC на Windows, диалог пароля на macOS).

### Локальный маркер версии

`<userData>/installed_version_Spunkram.json` — JSON с `{version, group, installedAt}`. По нему UI понимает, есть ли что обновлять. `userData` зависит от `productName`:

- Windows: `%APPDATA%\Spunkram Installer\`
- macOS: `~/Library/Application Support/Spunkram Installer/`

---

## Когда придёт запрос админ-прав

Установщик максимально старается обойтись без админа: всё, что можно положить в user-каталог, кладётся туда без UAC. Системный диалог (`UAC` / `sudo`) появляется только в двух случаях:

1. **Установка/обновление нативных плагинов** (`MotionflowBridge`, `MotionflowInit`) — потому что их целевые папки в `Program Files` / `/Library` всегда требуют админа.
2. **Установка/удаление CEP-расширения по system-пути**, если оно когда-то было поставлено system-wide.

Если ни плагинов, ни system-копии расширения нет — UAC вообще не появится.

Windows-сборка идёт как `portable`-EXE с `requestExecutionLevel: user`, поэтому сам запуск установщика админских прав не требует.

---

## Поток установки (диаграмма)

```
[Renderer]                    [Main]
  Install ─────────────►  check Adobe apps running?
                                │
                                ├─ да, и плагины не стоят → блокируем, ждём закрытия
                                │
                                └─ нет / плагины уже стоят
                                       │
                                       ▼
                                  download zxp → tmp
                                       │
                                       ▼
                                  extract → staging-dir
                                       │
                                       ▼
                                  swap staging → CEP-extension path
                                       │ (sudo, если system-path)
                                       ▼
                                  installPlugins()
                                       │
                                       ├─ check missing CSBridge
                                       ├─ (mac) extract cep-helpers.zip → tmp
                                       ├─ sudo cp → system Plug-ins
                                       └─ verify destinations exist
                                       │
                                       ▼
                                  save local version marker
                                       │
                          ◄──── extension-installed { success: true }
```

---

## Разработка

### Установка зависимостей

```bash
npm install
```

### Dev-режим

```bash
npm run dev
```

В dev-режиме плагины берутся из `resources/plugins/{win,mac}` напрямую (через `app.getAppPath()`). В упакованной сборке они кладутся в `<resources>/plugins` через `extraResources` (см. `electron-builder.yml`).

### Билды

```bash
npm run build         # типы + bundle
npm run build:win     # portable .exe
npm run build:mac     # .dmg + .zip
npm run build:linux   # AppImage + .deb
```

Для Mac-релиза нужно добавить code-signing и notarization (см. `electron-builder.yml::mac.notarize` и `build/entitlements.mac.plist`).

### Проверки

```bash
npm run typecheck     # tsc для main/preload + vue-tsc для renderer
npm run lint
```

---

## Структура

```
src/
├── common/
│   ├── constants.ts           # EXTENSION_NAME, URL_*
│   └── interfaces/IVersions.ts
├── main/
│   ├── index.ts               # bootstrap + registerXxxHandlers()
│   └── ipc/
│       ├── cep-paths.ts       # выбор путей CEP/плагинов (источник истины)
│       ├── download-handlers.ts # скачивание + установка/удаление расширения
│       ├── install-plugins.ts   # установка нативных CSBridge плагинов
│       ├── get-versions.ts      # API + сравнение с локальной версией
│       ├── running-apps.ts      # детект запущенных Premiere / AE
│       └── fetchLinks.ts        # quick-links из CMS
├── preload/index.ts
└── renderer/src/
    ├── MainForm.vue
    ├── components/
    └── i18n/locales/{en,tr}.ts
resources/
├── icon.png                   # иконка (Win/Mac/Linux)
└── plugins/
    ├── win/                   # .acsrf / .prm — лежат сразу как файлы
    └── mac/cep-helpers.zip    # bundles — упакованы в zip, распаковываются на лету
build/
└── entitlements.mac.plist     # для будущей подписи macOS-сборки
electron-builder.yml           # ЕДИНСТВЕННАЯ конфигурация сборки
```

> `package.json` намеренно НЕ содержит секции `build` — при наличии `electron-builder.yml` поле `build` в `package.json` electron-builder'ом игнорируется. Если добавить опции туда, они потеряются.

---

## Troubleshooting

| Симптом | Что делать |
|---|---|
| `Plugin source files not found in installer` / `cep-helpers.zip not found` | `resources/plugins/${os}/*` не попали в сборку. Проверь `electron-builder.yml::extraResources`. |
| `Cannot replace existing extension folder … holding files open` | Закрыть Premiere / After Effects (включая фоновые `Adobe After Effects Renderer`) и повторить. |
| UAC появляется при простом обновлении | Значит, у тебя стоит system-копия расширения. Это норма. |
| После Install бейдж «v.X · Installed» врёт | Должно само откатиться при ошибке. Если воспроизводится — приложи `errorDetails` из UI (есть кнопка Copy error). |
| macOS «приложение повреждено» / Gatekeeper блокирует | Сборка пока не подписана. Запусти `xattr -dr com.apple.quarantine "Spunkram Installer.app"` или подпишись и нотаризуйся (см. `electron-builder.yml::mac`). |
