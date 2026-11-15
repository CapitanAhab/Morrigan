# Morrigan

App personal de Morrigan, maga tiefling (bladesinger) en Curse of Strahd. Se instala en el celular como app (PWA) desde GitHub Pages.

## Cómo está armada

- `canvas/` tiene las pantallas tal como están en el canvas de diseño de Claude (`*.dc.html`). Es la fuente.
- `build.py` convierte cada pantalla en una página de la app:

  | Canvas | App |
  |---|---|
  | `Main.dc.html` | `index.html` |
  | `TiradaLock.dc.html` | `story.html` |
  | `FichaCarta.dc.html` | `character.html` |
  | `Familiars.dc.html` | `familiars.html` |

- `app/support.js` es el motor que dibuja las pantallas fuera del canvas. `app/app.css` tiene las fuentes y el marco a pantalla completa.
- `assets/` tiene las imágenes y el sonido; `icons/` el ícono; `sw.js` hace que funcione sin internet.

## Para cambiar algo

1. Se diseña y se prueba en el canvas.
2. Se copia la pantalla nueva a `canvas/`.
3. Se corre `python3 build.py` y se sube a `main`.

El celular toma la versión nueva la próxima vez que se abre la app.

Para sumar una pantalla nueva (por ejemplo Unwritten): agregarla a `PAGES` en `build.py`, sus imágenes a `BLOBS` y a `assets/`, y enlazarla desde el nodo correspondiente en `Main.dc.html`.
