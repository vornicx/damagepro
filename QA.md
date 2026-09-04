# QA — DAMAGEPRO v0.2

Validación realizada el 4 de septiembre de 2026.

## Resultado

- `npm test`: PASS — 5 pruebas unitarias.
- `npm run build`: PASS — TypeScript estricto, build de producción y service worker generado.
- Flujo E2E en Chromium: PASS — 0 errores o advertencias de consola.
- Recarga offline del build de producción: PASS — service worker activo y página operativa sin red.
- Expediente: PASS — 17 archivos originales cotejados con sus hashes SHA-256.
- Backup: PASS — exportación y restauración desde la interfaz con 1 vehículo, 2 inspecciones y 0 borradores.
- PDFs: PASS — 6 páginas A4 renderizadas e inspeccionadas visualmente, sin recortes ni solapamientos.

## Casos verificados

- Alta de vehículo y bloqueo de matrícula duplicada sin distinguir mayúsculas.
- Guardado automático, salida, recuperación y descarte de un borrador.
- Entrega con datos del cliente, 6 fotos obligatorias y 2 firmas.
- Devolución con bloqueo de un odómetro inferior al de entrega.
- Registro de daño con fotografía, clasificación como nuevo y actualización del estado.
- Generación y descarga del expediente ZIP.
- Exportación y restauración del backup.
- Menú, formulario y pie de acciones en 390 × 844 px.
- Dashboard y flujo completo en 1440 × 1000 px.

## Revisión visual

La referencia fue la interfaz existente de v0.1; no se proporcionó una maqueta externa. Se mantuvieron su navegación lateral, tipografía de sistema, paleta negra/verde, contenedores rectangulares y densidad de escritorio. Las desviaciones intencionadas son el selector de devoluciones, la barra de estado del borrador, los estados de error y el pie fijo del asistente en móvil. No se añadió texto promocional por encima del contenido principal.

## Riesgo residual

No se realizó una prueba de estrés con backups cercanos al límite de 1 GB ni una prueba física de cámara/firma en iOS y Android. La compatibilidad automatizada se verificó en Chromium; conviene hacer una prueba rápida en los dispositivos objetivo antes de desplegar en producción.
