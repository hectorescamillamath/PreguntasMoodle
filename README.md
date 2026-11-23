# Generador de exámenes para Moodle

Aplicación web para crear bancos de preguntas con **valores aleatorios** y exportarlos a **Moodle XML** o a **exámenes impresos** con varias versiones y clave de respuestas.

- **Aplicación:** `index.html`
- **Ayuda:** `ayuda.html`

## Qué hace

- Plantillas de pregunta con variables: `Calcule {a} + {b}` con `a = randint(1, 9)`.
- Tipos: numérica (con margen de error), opción múltiple, verdadero/falso, respuesta corta y ensayo.
- Fórmulas LaTeX (`\( ... \)`, `\[ ... \]`) con vista previa.
- Exportación a Moodle XML con una subcategoría por plantilla, lista para usar con *pregunta aleatoria*: cada estudiante recibe una variante distinta.
- Exámenes impresos o en PDF con versiones A, B, C… y hoja de clave.
- Guardado automático en el navegador y archivos `.json` para respaldar o compartir bancos.
- Todo funciona en el navegador: nada se envía a un servidor.

## Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a la raíz de un repositorio.
2. *Settings › Pages › Deploy from a branch*, rama `main`, carpeta `/ (root)`.

## Estructura

```
index.html        Aplicación
ayuda.html        Manual de uso
css/estilos.css   Estilos
js/motor.js       Evaluador de expresiones, variantes y exportación a Moodle XML
js/app.js         Interfaz, vista previa y examen impreso
js/ejemplos.js    Banco de ejemplo
lib/              KaTeX (MIT) para mostrar fórmulas
```
