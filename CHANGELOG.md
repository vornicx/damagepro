# Changelog

## 0.2.0 — 2026-09-04

### Añadido

- Borradores automáticos recuperables para entregas y devoluciones.
- Selector cuando existen varias entregas pendientes.
- Informes PDF completos, resumen del expediente y manifiesto de integridad SHA-256.
- Preferencia de empleado predeterminado y aplicación real del idioma y las unidades.
- Pruebas unitarias con Vitest y documentación de QA.

### Mejorado

- Guardado transaccional de inspecciones, vehículo y borrador.
- Validación y restauración atómica de backups, compatible con backups v0.1.
- Validación, compresión y gestión de memoria de imágenes.
- Rendimiento inicial mediante carga diferida de PDF y ZIP.
- Navegación accesible, modales, estados vacíos y experiencia móvil.
- Iconos PWA dedicados y soporte offline verificado.

### Corregido

- Error de compilación en la comparativa de inspecciones.
- Configuración TypeScript incompatible con `allowImportingTsExtensions`.
- Fechas locales desplazadas por usar UTC en campos `datetime-local`.
- Posible reducción del odómetro del vehículo al registrar una devolución.
- URL de objetos de imagen que no se liberaban.
- Estructura HTML inválida en las filas interactivas.
