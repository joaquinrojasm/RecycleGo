# RecycleGo

Aplicación web con HTML, CSS y JavaScript. Firebase Authentication gestiona cuentas y Cloud Firestore almacena perfiles, puntos de acopio y publicaciones con su estado de recolección. GitHub Pages aloja el frontend. No existe un backend Node.js propio: Node se usa para pruebas, preparación del sitio y servidor estático local.

## Puesta en marcha

1. En Firebase crea el proyecto y registra una aplicación web.
2. Habilita Authentication > Correo/contraseña y configura una longitud mínima de 8 caracteres.
3. Crea Cloud Firestore Standard, base `(default)`, y publica el contenido completo de `firestore.rules` desde Reglas.
4. Copia el objeto `firebaseConfig` en `public/js/config.js`, conservando `export const firebaseConfig = ...`.
5. Ejecuta `npm run dev` y abre http://localhost:5173. También puedes abrir la carpeta `public` con Live Server.
6. Registra un ciudadano y un recolector. Para crear el administrador, registra otra cuenta como ciudadano y cambia su campo `role` a `admin` desde Firestore > users > UID. Cierra sesión y vuelve a ingresar. El registro público y las reglas impiden elegir o cambiar a administrador desde la web.
7. El administrador puede registrar puntos o cargar tres puntos ficticios de demostración. Sus direcciones están identificadas como ejemplos.

## Historias incluidas

- HU01-HU03: registro, inicio/cierre de sesión y permisos por rol.
- HU04-HU06: mantenimiento de puntos, consulta de detalles y filtros de distrito/material.
- HU07-HU09: publicación de materiales, listado personal, edición y cancelación mientras estén disponibles.
- HU10-HU12: oportunidades vigentes, aceptación mediante transacción y finalización con historial para los participantes.

Las recolecciones se guardan en el propio documento de publicación: collectorId, collectorName, acceptedAt, completedAt y status. Las transacciones comprueban la disponibilidad para evitar dos asignaciones simultáneas. Las reglas vuelven a validar los permisos en Firebase.

## Verificación local

```text
npm test
npm run build
npm run security
npm run check:config
```

Las pruebas locales automatizadas validan reglas de negocio y decisiones de permisos del cliente. No sustituyen las pruebas de autorización de Firestore: comprueba las reglas en Firebase Rules Playground y prueba con cuentas de los tres roles. No se debe afirmar una integración exitosa con Firebase hasta completar la configuración y la prueba real.

## GitHub, ramas y Pull Request

1. Crea un repositorio RecycleGo y conserva `main` como producción.
2. Crea la rama `test`; publica allí la implementación con un commit descriptivo.
3. Abre un Pull Request de `test` hacia `main`, revisa los cambios y los resultados CI.
4. Configura Settings > Pages > Build and deployment > Source: GitHub Actions.
5. Integra el PR cuando las comprobaciones estén correctas. El workflow vuelve a ejecutarse en main y publica si build/test/security y Semgrep pasan.
6. Agrega el dominio de la URL publicada a Authentication > Settings > Authorized domains si Firebase lo requiere.

La configuración web de Firebase es pública y puede formar parte del frontend. Las cuentas de servicio y sus claves privadas no se deben subir; este proyecto no las necesita para GitHub Pages. La URL de Firebase y la URL pública del sitio son distintas.

## Pipeline de la pregunta 4

`build-test`: instala desde lockfile, valida sintaxis/HTML, prepara dist, ejecuta pruebas de negocio, escanea secretos y verifica controles del frontend. En main comprueba que exista configuración Firebase antes de subir el artefacto.

`sast`: Semgrep analiza JavaScript con el conjunto p/javascript y bloquea ante hallazgos.

`deploy`: depende de ambos jobs y publica el artefacto con GitHub Pages. Se ejecuta únicamente en main y utiliza los permisos pages:write e id-token:write del job, sin token personal almacenado.

## Evidencias para el informe

- URL del repositorio y captura de las ramas main/test y commits.
- URL y captura del Pull Request test > main.
- Ejecución verde del workflow con build, tests, seguridad/Semgrep y despliegue.
- Resultados de las pruebas y configuración de las reglas de Firebase.
- URL pública y capturas de la aplicación con datos creados en Firebase.

El proyecto requiere que el propietario habilite GitHub Pages, publique las reglas y aporte la configuración de su aplicación Firebase. Las evidencias deben corresponder a ejecuciones reales.
