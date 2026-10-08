# Plan: migrar emiliacabral.com a Cloudflare

- **Fecha:** 2026-10-08
- **Estado:** Fases 1–3 implementadas en el código; Fase 0 y Fase 4 pendientes (son pasos en los dashboards de Cloudflare y GitHub); Fase 5 sin empezar.
- **Alcance:** `landing/` y la infraestructura de deploy

## Estado de la ejecución (2026-10-08)

**Hecho en el repo:**

- **Fase 1.** `scripts/build.ts` genera `dist/` sin servidor. Hay una sola lista de páginas, en `src/shared/site.ts`, y un diccionario tipado en `src/shared/i18n/`. Las páginas son funciones puras en `src/site/pages/`. El contenido se valida con Zod. Los bundles y el CSS llevan hash. Se borraron el servidor Hono/Node, `Dockerfile`, `docker-compose.yml` y `vercel.json`. El proyecto pasó a ESM con Node 22.
- **Fase 2.** El Worker (`src/worker/index.ts`) y `wrangler.jsonc`, con tests en `test/` sobre `@cloudflare/vitest-plugin` (el nuevo nombre de `vitest-pool-workers`).
- **Fase 3.** `.github/workflows/ci.yml` y `deploy.yml`.
- Del Opcional/Fase 0: se sacó el preload de `_dotlottie-bundle.js`; canonical y `og:url` por página.

**Verificado:**

- El HTML de las 20 páginas se comparó contra el servidor viejo (`db897e2`). Las únicas diferencias son las buscadas: canonical y `og:url`, `build-id`, sin preload de lottie, `data-set-lang`, fechas con `Intl`, TOC en español bajo `/es` y slugs con acentos.
- Con `wrangler dev` se probaron `/` por idioma y por cookie, los 302 de las URLs sin idioma, `/cv`, el redirect de `/public/<version>/*`, los headers de `/assets/*` y `/sw.js`, y los 404 por idioma.

**Cambios de comportamiento a tener en cuenta:**

- Los anchors con acento cambian (`#mentora` → `#mentoría`). Es lo que pedía el plan.
- `/cv` ahora es un 302 a `/public/cv.pdf`, que se descarga con el mismo nombre de archivo.
- `/api/*` responde 404 hasta la Fase 5. El código viejo del mascot (`src/services/mascot.ts`, `src/routes/api/mascot/index.ts`) se recupera de `db897e2`.

**Falta (a mano):**

1. Fase 0: borrar la Cache Rule que congela `/` y purgar la caché.
2. Crear los secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en GitHub y el environment `production`.
3. Fase 4 completa: deploy a `*.workers.dev`, crawl de paridad contra producción, route, revisión de la zona, custom domain y borrar Render y Vercel.

## Objetivo

Dejar de pagar Render. Una landing con blog no necesita un servidor encendido todo el tiempo: el objetivo es **$0/mes de hosting**.

La velocidad no es el motivo; producción ya carga rápido. Las mejoras de performance de este documento son opcionales y están al final.

## Estado actual

Medido el 2026-10-08 contra producción.

### Dónde corre cada cosa

| Pieza | Dónde | Notas |
|---|---|---|
| `emiliacabral.com` | Render (Node + Hono) detrás del proxy de Cloudflare | Las respuestas traen `x-render-origin-server: Render`. La configuración de Render no está en el repo. |
| `www.emiliacabral.com` | Redirect 301 de Cloudflare al apex | |
| DNS | Cloudflare | La zona ya está en Cloudflare. |
| Proyecto de Vercel `emiliacb-ywfe` | `*.vercel.app` | Mirror del export estático (`npm run export`). Sin dominio propio. |

### Bugs en producción

1. **La home está congelada.** `/` responde con `age: 1541558` (~18 días) y `last-modified: Sun, 20 Sep 2026 18:09:38 GMT`. Todavía incluye `_mascot-bot-bundle.js`, que se apagó en `f73113f` (2026-10-07). El origen manda `cache-control: public, max-age=3605`, así que hay una Cache Rule o Page Rule en la zona que fija su propio Edge TTL.
2. **La home sale en inglés para todos.** `/` elige el idioma con `Accept-Language`, pero Cloudflare la cachea sin distinguir idioma (su caché ignora `Vary: Accept-Language`). Un request con `Accept-Language: es-AR,es;q=0.9` recibe `lang="en"`.

### Peso por página

Chromium headless, 1366×800, caché del navegador vacía:

| Página | Requests | Transferido |
|---|---|---|
| `/en` | 33 | 1,028 KB |
| `/en/about` | 31 | 1,031 KB |
| `/en/blog/2026-07-27-limits-of-autonomous-assistants` | 31 | 1,036 KB |

| Recurso | Transferido | Motivo |
|---|---|---|
| `_dotlottie-bundle.js` | 566 KB | Tiene `<link rel="preload">` en el layout, o sea en **todas** las páginas; solo la home lo usa. |
| PostHog (`array.js`, `posthog-recorder.js`, `surveys.js`) | ~200 KB | Session recording y surveys activos. |
| Montserrat (Cloudflare Fonts) | ~170 KB | Bajan los subsets latin, latin-ext, cyrillic e italic: el nombre "ємιℓιαċв" usa glifos cirílicos y griegos. |
| Tracker de Apollo | — | Se pide con `?nocache=<random>`, así que nunca se cachea. |

## Plataforma: Cloudflare Workers con Static Assets

**Por qué Workers y no Pages.** Cloudflare recomienda Workers Static Assets para proyectos nuevos; Pages sigue funcionando, pero las features nuevas van a Workers. Con Workers, el HTML y la API se publican en un solo deploy, con la misma versión, y se revierten juntos con `wrangler rollback`.

**Por qué no quedarse en Vercel.** El export ya funciona ahí gratis, pero el plan Hobby es para uso personal no comercial y el sitio ofrece servicios y cursos. Además, el DNS ya está en Cloudflare.

### Costo

| Qué | Plan gratuito | Uso esperado |
|---|---|---|
| Static assets | Gratis e ilimitados | Casi todo el tráfico |
| Requests al Worker | 100,000/día | Solo `/`, URLs sin idioma y `/api/*` |
| CPU por request del Worker | 10 ms (la espera de red no cuenta) | Elegir idioma: muy por debajo |
| Durable Objects (SQLite) | Incluidos | Solo si vuelve el mascot |
| GitHub Actions | Gratis en repos públicos | Build y deploy |

Queda fuera a propósito **Workers AI**: Kimi K2.6 ahí requiere Workers Paid ($5/mes). Si el mascot vuelve, el Worker llama a la API de Moonshot con la clave actual, como hoy.

La factura de Render se corta cuando se **borra el servicio en Render**, que es el último paso del cutover.

## Arquitectura de deploy

### `wrangler.jsonc`

```jsonc
{
  "name": "emiliacb",
  "main": "src/worker/index.ts",
  "compatibility_date": "2026-10-08",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "404-page",
    "html_handling": "drop-trailing-slash",
    "run_worker_first": ["/", "/about", "/services", "/courses", "/blog", "/blog/*", "/labs/*", "/health", "/api/*"]
  },
  "observability": { "enabled": true },
  "routes": [{ "pattern": "emiliacabral.com", "custom_domain": true }]
}
```

### Quién responde cada ruta

| Ruta | Responde | Detalle |
|---|---|---|
| `/en/**`, `/es/**` | Assets | HTML generado en el build. |
| `/assets/*` | Assets | Nombres con hash y `Cache-Control: immutable` vía `_headers`. |
| `/` | Worker | Elige el idioma (q-values de `Accept-Language`, más una cookie si el visitante eligió con el selector) y devuelve `ASSETS.fetch("/es")` o `ASSETS.fetch("/en")` sin redirigir, con `Cache-Control: private`. |
| `/about`, `/services`, `/courses`, `/blog`, `/blog/*`, `/labs/*` | Worker | 302 a `/{lang}/…`, como hace hoy `langMiddleware`. |
| `/health` | Worker | `{"status":"ok"}`. |
| `/api/mascot-comment` | Worker | Fase 5. |
| `/cv` | `_redirects` + `_headers` | Al PDF, con `Content-Disposition: attachment; filename="Emilia_C_B_Resume.pdf"`. |
| `/sw.js`, `/robots.txt` | Assets | `/sw.js` con `Cache-Control: no-cache` vía `_headers`. |
| Cualquier otra | `404-page` | El `404.html` más cercano: `/es/404.html`, `/en/404.html` o `/404.html`. |

`html_handling: "drop-trailing-slash"` debería mantener las URLs actuales (`/en/about`, sin barra final). Se confirma con el crawl de paridad de la Fase 4.

## Arquitectura del repo

Sacar el router obliga a tocar casi todos los archivos de `landing/src/`, así que la Fase 1 es el momento de corregir estos problemas en vez de portarlos tal cual.

### Problemas actuales

1. **El render está pegado a HTTP.** Cada handler recibe el `Context` de Hono, lee `c.req.param("lang")` o `accept-language` y devuelve `c.html(...)`. No hay forma de obtener el HTML de una página sin un request; por eso `scripts/generate-static.ts` levanta el servidor, espera `/health` y crawlea por HTTP.
2. **Cuatro listas de páginas que ya no coinciden:** `src/router.ts`, `baseRoutes` en `scripts/generate-static.ts`, `STATIC_PAGES` en `src/services/sitemap.ts` y los links de `src/components/navbar`. El export no genera `/labs/*` porque falta en `baseRoutes`.
3. **La configuración se lee al importar.** `dotenv` se llama en 4 módulos de `src/` (`router.ts`, `components/layout`, `components/tree`, `components/forest`) y hay 17 lecturas de `process.env` en 8 archivos. Componentes de UI leen `CACHE_VERSION` directamente.
4. **El i18n está disperso.** 11 archivos definen su propio `wordings` o `COPY`, hay 7 `|| "en"` como idioma por defecto y varias descripciones con `lang === "es" ? … : …`. Los textos de error del mascot están duplicados a propósito entre `src/routes/api/mascot/index.ts` y `src/client/mascot-bot.js`.
5. **Cada ruta lee el contenido por su cuenta:**
   - Cada handler arma su path con `__dirname` (`../../../content/pages/${lang}/home.md`).
   - El cache de `services/content.ts` está comentado (`//return cache.get(filePath)`).
   - `services/posts.ts` relee el directorio en cada request.
   - El frontmatter no se valida.
   - `getPost` siempre renderiza con `"en"`, así que la tabla de contenidos sale en inglés también bajo `/es`.
   - `parseContent` cambia la configuración global de `marked` en cada llamada.
   - El slug de los headings borra los acentos.
6. **El escapado es inconsistente.** Las listas del blog y de cursos se arman con template strings dentro de `raw(...)` en vez de `html```. Funciona porque el contenido es propio, pero un título con `"` o `<` rompe el HTML.
7. **Los scripts de cliente están cableados a mano.** `scripts/bundle-client.ts` lista 14 entradas una por una, y el layout y los componentes hardcodean `<script src="/public/${CACHE_VERSION}/_x-bundle.js">`. `_phone-drag-bundle.js` se buildea y nadie lo carga.
8. **Hay código en el lugar equivocado.** `src/components/tree/generate.ts` (1,322 líneas) es código de navegador: lo importan `src/client/forest.js` y `scripts/preview-tree.ts`, no el servidor.
9. **El mascot es un solo bloque.** `src/services/mascot.ts` mezcla el armado del prompt, el cliente del proveedor, el protocolo de streaming (deadline del primer token, cortar el body si falla), el logging y workarounds de `@hono/node-server`. No se puede testear una parte sin las otras.
10. **Tooling:**
    - No hay tests ni linter/formatter.
    - `tsconfig.json` tiene `target: es6`, `module: commonjs` y configuración de JSX sin ningún `.tsx`.
    - Los `.js` de `src/client/` no pasan por TypeScript.
    - El `Dockerfile` corre `node dist/index.js`, pero el build genera `dist/src/index.js`: está muerto.
    - `caniuse-lite: "latest"` hace que el build no sea reproducible.
    - Node 20 (`.nvmrc`, `flake.nix`) está fuera de soporte desde abril de 2026.

### Estructura propuesta

```
landing/
  content/                 # sin cambios: blog/, pages/{en,es}/, prompts/
  public/                  # se copia tal cual: imágenes, cv.pdf, robots.txt, sw.js
  scripts/
    build.ts               # contenido → HTML → assets → dist/ (único lugar que lee process.env)
    preview-tree.ts
  src/
    shared/                # lo usan el build, el Worker y el navegador
      i18n/{en,es}.ts      # diccionario tipado; reemplaza los wordings/COPY sueltos
      lang.ts              # tipo Lang y negociación de Accept-Language
      site.ts              # URL, nombre y la lista única de páginas
      mascot.ts            # contrato request/response y textos de error
    site/                  # solo en el build
      content/             # carga, schema Zod y markdown (una instancia de Marked)
      components/          # layout, navbar, footer… sin process.env
      pages/               # home.ts, about.ts, blog-index.ts, blog-post.ts… funciones puras
    client/                # bundles del navegador (incluye tree/generate.ts)
    worker/                # solo en Cloudflare
      index.ts             # "/", redirects, /health, /api/*
      mascot/              # prompt.ts, provider.ts, stream.ts, handler.ts
    styles.css
  wrangler.jsonc
.github/workflows/         # ci.yml, deploy.yml
docs/plans/
```

### Reglas

- **Una página es una función pura:** `render(ctx) → HTML`, con `ctx = { lang, t, assets, content }`. Sin `Context`, sin `fs`, sin `process.env`. El mismo render sirve para el build y para un test.
- **Hay una sola lista de páginas,** en `src/shared/site.ts`. De ahí salen el build, los redirects del Worker, el navbar y el sitemap del prompt del mascot.
- **Las dependencias van en una sola dirección.** `site/`, `client/` y `worker/` pueden importar de `shared/`; ninguno importa de los otros.
- **La configuración entra por un solo lugar.** `scripts/build.ts` lee el entorno y lo pasa en `ctx`; el Worker usa `env`.
- **Cada componente declara su script.** El build junta los que usa cada página y escribe los `<script>` desde el manifest de esbuild, con hash. Desaparecen `CACHE_VERSION`, la doble copia `public/` + `public/<version>/` y la lista a mano de `bundle-client.ts`.
- **Todo el HTML pasa por `html```.** `raw()` queda solo para el resultado del markdown.
- **El mascot se divide en cuatro módulos testeables:** `prompt.ts` (puro), `provider.ts` (Moonshot), `stream.ts` (primer token y corte del body) y `handler.ts` (HTTP y rate limit).

### Lo que no cambia

- **Un solo paquete en `landing/`.** No hace falta un monorepo: el build y el Worker son chicos y comparten dependencias.
- **`hono/html` sigue como helper de templates** (`html`, `raw`), que es lo que ya usa todo el código. Hono como router queda solo dentro del Worker.
- **No se migra a Astro.** La mayor parte del código es JS de navegador a medida (`forest.js`, `distortion.js`, `mascot-bot.js`), donde Astro no aporta, y el build estático descrito es chico.

## Fases

El orden apunta a cortar Render lo antes posible. Cada fase es un PR.

### Fase 0: arreglos inmediatos (opcional, sobre Render)

- Sacar el `<link rel="preload">` de `_dotlottie-bundle.js` del layout. Es una línea y le saca 566 KB a cada página que no es la home.
- Encontrar y borrar la regla de caché que congela `/`, y purgar la caché.

### Fase 1: build estático y nueva estructura

1. Crear `src/shared/` (i18n, lang, site) y mover ahí los textos.
2. Convertir cada handler de `src/routes/` en una función pura en `src/site/pages/`.
3. Armar `src/site/content/`:
   - carga única del contenido;
   - schema Zod para el frontmatter (un post inválido rompe el build);
   - `new Marked()` por render, sin tocar la configuración global;
   - slugs que respeten acentos;
   - fechas con `Intl.DateTimeFormat(lang)`.
4. Escribir `scripts/build.ts`. Genera `dist/{en,es}/…/index.html`, los `404.html`, `_headers`, `_redirects` y los bundles con hash.
5. Pasar a ESM (`"type": "module"`), con Node 22 o 24 y sin `__dirname`.
6. Borrar:
   - `src/index.ts`, `src/router.ts`, `src/middlewares/` y `src/client/phone-drag.js`;
   - `scripts/generate-static.ts`;
   - las dependencias `@hono/node-server` y `rate-limiter-flexible`, y `dotenv` en runtime;
   - `Dockerfile`, `docker-compose.yml` y `vercel.json`.
7. Verificar que `dist/` contenga todas las URLs que hoy sirve Render, incluido `/labs/*`.

### Fase 2: Worker mínimo

- `src/worker/index.ts` maneja `/`, los redirects de URLs sin idioma y `/health`.
- Redirect de transición `/public/:version/*` → `/public/*`, para el HTML viejo que quede en el service worker o en prerenders.
- Tests con `@cloudflare/vitest-pool-workers` para la elección de idioma y los redirects.

### Fase 3: GitHub Actions

- **`ci.yml`** en cada PR: `npm ci`, typecheck, tests, build y `wrangler versions upload` para tener una URL de preview.
- **`deploy.yml`** en cada push a `master` que toque `landing/**`: build más `wrangler deploy` con `cloudflare/wrangler-action`, y `concurrency` para que dos deploys no se pisen.
- **Secrets** que hay que crear a mano en GitHub:
  - `CLOUDFLARE_API_TOKEN`, con permiso para editar Workers en la cuenta y routes/custom domains en la zona;
  - `CLOUDFLARE_ACCOUNT_ID`.

### Fase 4: cutover

1. Deploy a `*.workers.dev`.
2. Crawl de paridad contra producción: todas las URLs (páginas × idiomas × posts, más las URLs sin idioma y `/cv`), comparando status, redirects y HTML normalizado.
3. Worker Route `emiliacabral.com/*` sobre el registro DNS actual. Es instantánea y se revierte borrando la route.
4. Revisar la zona:
   - Borrar la regla de caché de la Fase 0.
   - Revisar Cloudflare Fonts.
   - Revisar Speed Brain, que se pisa con las `speculationrules` del layout.
   - Revisar Email Obfuscation, que puede interferir con `email-link`.
   - El redirect www → apex se queda.
5. Pasar de Route a Custom Domain: borrar el registro DNS que apunta a Render y agregar `custom_domain: true`.
6. Dejar Render unos días como respaldo y después **borrar el servicio**. Borrar también el proyecto de Vercel `emiliacb-ywfe`.

### Fase 5: mascot en el Worker (cuando se reactive)

Hoy está apagado (`AI_FEATURE_ENABLED = false` en `src/components/layout/frame.ts`) y no hace falta para cortar Render.

- Los prompts `.md` se importan como módulos de texto, sin `fs`.
- `KIMI_API_KEY` se carga con `wrangler secret put`, nunca en GitHub.
- Los `Map` `lastRequestAt` e `inFlightSince` no funcionan en Workers, porque cada isolate tiene su propia memoria. Se reemplazan por un Durable Object por IP con cooldown, una sola generación en curso y presupuesto diario.
- Se quitan los workarounds de `@hono/node-server` (`combineSignals`, `X-Accel-Buffering`) y se prueba cómo llega la desconexión del cliente en Workers.
- Hay que medir el CPU: el límite del plan gratuito es 10 ms por request. Si el pacing palabra por palabra (`smoothStream`) se pasa, el pacing se mueve al navegador.
- Revisar el modelo: `KIMI_MODEL` usa por defecto `kimi-k2-0711-preview` (julio 2025).

### Opcionales

- **Performance:**
  - La animación Lottie solo en la home, cargada en idle, o reemplazada por el árbol procedural de `generate.ts` en SVG.
  - Montserrat self-hosted con subset.
  - PostHog sin recorder ni surveys, o inicializado en idle; Apollo también en idle.
  - Imágenes a AVIF/WebP en el build (`mixed.png` pesa 540 KB y `hermes-logo.png` 195 KB para un thumbnail).
- **SEO** (si se abre `robots.txt`): `og:url` y canonical por página (hoy apuntan a `/` en todas menos los posts), `hreflang`, sitemap y RSS.
- **Calidad:** Biome, `checkJs` para `src/client/`, Playwright con screenshots y headers de seguridad en `_headers`.

## Decisiones abiertas

1. **`robots.txt` tiene `Disallow: /`** ("This is a private website"), pero el sitio tiene blog, OG tags y página de servicios. ¿Es intencional? Define si vale la pena el trabajo de sitemap, RSS y SEO.
2. **Mascot:** ¿se porta en la Fase 2 o en la 5? Recomendación: Fase 5.
3. **Árbol de la home:** ¿Lottie con un player más liviano, o el árbol procedural en SVG?
4. **Posts bajo `/es`:** los posts existen solo en inglés y también se publican en `/es/blog/…`. ¿Se traducen, o se pone canonical a `/en`?
