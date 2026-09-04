# DAMAGEPRO v0.2

DAMAGEPRO es una PWA local-first para documentar entregas y devoluciones de vehículos con fotografías, daños y firmas. Los datos se guardan en IndexedDB en el dispositivo; no requiere cuentas, backend ni conexión para operar después de la primera carga.

## Funciones principales

- Alta y archivo de vehículos, con control de matrículas duplicadas.
- Flujo guiado de entrega y devolución con seis fotografías obligatorias y cuatro opcionales.
- Registro visual de daños, foto asociada y clasificación posterior.
- Firma de cliente y empleado.
- Borradores automáticos recuperables, incluidas fotos y firmas.
- Validación del odómetro para impedir que una devolución reduzca el kilometraje.
- Informes PDF completos y expediente ZIP con fotos originales, firmas, comparativa y manifiesto SHA-256.
- Backup y restauración completos, validados y aplicados de forma transaccional.
- Interfaz adaptable a escritorio y móvil, instalable como PWA y utilizable sin conexión.
- Documentos en español o inglés y unidades en kilómetros o millas.

## Desarrollo

```bash
npm install
npm run dev
```

## Verificación

```bash
npm test
npm run build
npm run preview
```

Consulta [QA.md](./QA.md) para conocer el alcance de la última validación.

## Flujo operativo

1. Crea el vehículo.
2. Registra la entrega, las evidencias y las firmas.
3. Registra la devolución y los posibles daños.
4. Compara el antes y el después y clasifica los daños nuevos.
5. Genera el expediente ZIP.
6. Exporta un backup y guárdalo fuera del dispositivo.

## Privacidad y conservación

La aplicación no envía datos a un servidor. Borrar los datos del navegador o perder el dispositivo puede eliminar la información local, por lo que conviene exportar backups periódicos y conservarlos en un lugar seguro.

## Tecnología

React 18, TypeScript, Vite, Dexie/IndexedDB, jsPDF, JSZip, Vitest y `vite-plugin-pwa`.
