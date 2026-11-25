# TopoCrime · sustentación de tesis

Presentación en formato *scrollytelling*: el gráfico se queda fijo a la derecha y
cambia con cada paso del texto. Está basada en la sección «Cómo funciona» del
[dashboard](https://cesarpr30.github.io/thesis-dashboard/) y usa sus mismos datos
publicados.

**TopoCrime: Topology-Aware Spatiotemporal Crime Hotspot Detection on Street
Networks** · César Eduardo Pajuelo Reyes · asesor Germain García-Zanabria ·
Ciencia de Datos, UTEC. Pensada para unos 15 minutos.

## Cómo presentarla

Abre `index.html` con doble clic. No necesita servidor ni internet: los datos van
en `data/deck-data.js` (sin conexión, la fuente Inter se reemplaza por la del
sistema).

| Tecla | Acción |
|---|---|
| `↓` `→` `espacio` `AvPág` | siguiente paso (sirve con un clicker) |
| `↑` `←` `RePág` | paso anterior |
| `Inicio` / `Fin` | primera / última lámina |
| `F` | pantalla completa |

También se puede avanzar con la rueda del mouse o saltar de capítulo con los puntos
del borde derecho. La URL guarda el paso (`index.html#18`), así que se puede abrir
directamente en una lámina.

## Guion (22 pasos, ~15 min)

1. **Inicio**: portada TopoCrime sobre el mapa de denuncias y concentración del crimen.
2. **Problema y pregunta**: calles y lugares por separado; gemelos con distinto crimen.
3. **Objetivos** y **datos** (de 3,1 M filas a 1,0 M).
4. **Fase 1 · Detección**: red vial, calor por calles, hotspots, persistencia y Monte Carlo.
5. **Validación**: verdad sintética y misma huella.
6. **Fases 2 y 3**: vector de forma, gemelos y POIs.
7. **Resultados**, **herramienta**, **reconocimientos** (2.º lugar Demo Mode 2026 y
   Ministerio del Interior, DIRTIC-PNP), **conclusiones**, **paper en redacción** y
   **preguntas**.

## Estructura

```text
index.html            guion y texto de cada paso
css/deck.css          estilos (identidad visual del dashboard)
js/figures.js         figuras del método, tomadas de como-funciona-visual.html
js/deck.js            motor de pasos, mapa de Lima y figuras propias
data/deck-data.js     datos empaquetados (generado, no editar)
tools/build_data.py   genera data/deck-data.js
img/                  fotos, captura del dashboard y primera página del paper
```

## Regenerar los datos

Si cambian los artefactos publicados del dashboard:

```bash
python tools/build_data.py            # lee ../thesis-dashboard/public/data/lima
python tools/build_data.py --src RUTA/A/data/lima
```

Solo lee los artefactos públicos (ubicaciones agregadas a celdas de 200 m); nada
del pipeline privado.
