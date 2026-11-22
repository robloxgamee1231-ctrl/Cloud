# XCloud4 Web

**XCloud4 Web** es la edición de navegador de [XCloud4](https://github.com/asp11edgr/XCloud4) — el cliente nativo de Xbox Cloud Gaming para PS4 (GoldHEN). **XCloud4 Web** is the browser edition of XCloud4: it runs on any modern web browser, with no installation, and is deployed automatically to GitHub Pages on every push to `main`.

## Cómo funciona / How it works

- **Catálogo / Catalog:** la app incluye una copia (`data/catalog.json`) del catálogo público de Xbox Cloud Gaming, generada en cada despliegue con los endpoints públicos de `catalog.gamepass.com` (los mismos que usa xbox.com/play). Si la generación falla, se usa una copia de respaldo incluida (`data/catalog-fallback.json`). / The app includes a snapshot (`data/catalog.json`) of the public Xbox Cloud Gaming catalog, generated at every deploy from the public `catalog.gamepass.com` endpoints used by xbox.com/play. If generation ever fails, a small bundled fallback (`data/catalog-fallback.json`) is used.
- **Transmisión / Streaming:** al pulsar «Jugar», la app abre el reproductor oficial de Xbox Cloud Gaming (`xbox.com/play`) con el enlace directo del juego. XCloud4 Web nunca toca tus credenciales: inicias sesión solo en las páginas oficiales de Microsoft. / Pressing "Play" opens the official Xbox Cloud Gaming player (`xbox.com/play`) with the game's deep link. XCloud4 Web never touches your credentials: you sign in only on Microsoft's official pages.
- **Actualizaciones / Updates:** la app consulta una vez por visita la API pública de GitHub Releases del proyecto original, igual que el cliente nativo. / The app checks the upstream project's public GitHub Releases API once per visit, like the native client.

## Funciones / Features

- Interfaz con barra lateral: Inicio, Descubrir, Catálogo, Mis juegos, Buscar, Ayuda y Ajustes / Sidebar interface: Home, Discover, Catalog, My games, Search, Help, Settings
- 6 idiomas: Español, English, Português (Brasil), Français, Italiano, Deutsch (con detección automática) / 6 languages with auto-detection
- Navegación completa con mando (Gamepad API): D-pad/stick para moverte, A/X para seleccionar, B/Círculo para volver, LB/R1 para cambiar de sección, Start para buscar / Full gamepad navigation via the Gamepad API
- Favoritos y vistos recientemente guardados localmente / Favorites and recents stored locally
- Badges táctil / EA Play / gratuito por título; filtros por categoría, táctil y orden / Per-title Touch / EA Play / Free badges; category, touch and sort filters
- Pantalla completa, modo de apertura de streams (pestaña nueva o misma pestaña) / Fullscreen toggle, stream open mode (new tab or same tab)
- Guía de controles y solución de problemas heredada del README nativo / Controls guide and troubleshooting inherited from the native README

## Ejecución local / Run locally

Cualquier servidor estático sirve la carpeta del proyecto:

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

No build step, no dependencies. Para tener datos localmente, genera antes el catálogo (ver abajo) o copia `data/catalog-fallback.json` a `data/catalog.json`.

## Regenerar el catálogo / Refresh the catalog snapshot

```bash
python3 scripts/gen_catalog_snapshot.py   # descarga el catálogo completo -> data/catalog.raw.json
python3 scripts/build_web_catalog.py      # recorta al formato compacto -> data/catalog.json
```

El workflow de GitHub Actions (`.github/workflows/deploy-pages.yml`) ejecuta estos mismos pasos en cada despliegue, así que la web siempre publica el catálogo del día.

## Estructura / Structure

```
index.html                     # app shell (sidebar, splash, topbar)
manifest.webmanifest           # PWA manifest
assets/css/style.css           # dark Xbox-green design system
assets/js/i18n.js              # 6-language interface translations
assets/js/app.js               # views, router, gamepad navigation, stream launching
data/catalog-fallback.json     # bundled fallback catalog (~107 titles)
scripts/gen_catalog_snapshot.py  # downloads the full public cloud catalog
scripts/build_web_catalog.py     # compacts the raw snapshot for the web app
.github/workflows/deploy-pages.yml  # builds the fresh catalog and deploys to Pages
```

## Aviso / Disclaimer

XCloud4 es un proyecto independiente, sin afiliación con Microsoft, Xbox ni Sony. Se ofrece tal cual, sin garantías. Usa XCloud4 respetando los términos de servicio de Microsoft y Xbox. / XCloud4 is an independent project, not affiliated with Microsoft, Xbox or Sony. It is provided as is, without warranty. Use it in accordance with Microsoft and Xbox terms of service.

## Licencia y créditos / License and credits

Edición web original inspirada en el proyecto [asp11edgr/XCloud4](https://github.com/asp11edgr/XCloud4) (GPL-3.0-only). El texto completo de la licencia está disponible en el repositorio original: [LICENSE](https://github.com/asp11edgr/XCloud4/blob/main/LICENSE). Consulta también [NOTICE.md](NOTICE.md).

Web edition original, inspired by the [asp11edgr/XCloud4](https://github.com/asp11edgr/XCloud4) project (GPL-3.0-only). The full license text is available in the upstream repository. See also [NOTICE.md](NOTICE.md).
