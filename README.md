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

## Guion (29 pasos + referencias, ~15 min)

1. **Inicio**: portada TopoCrime sobre el mapa de denuncias y concentración del crimen.
2. **Estado del arte**: desafío C1 (representación del hotspot), desafío C2 (dinámica temporal), entorno urbano (CACC y topología) y formulación.
3. **Objetivos** y **datos** (de 3,1 M filas a 1,0 M).
4. **Fase 1 · Detección**: grafo vial, KDE geodésico, join tree con persistencia, scan de Kulldorff y selección de k.
5. **Validación**: verdad sintética, misma huella y sensibilidad a σ.
6. **Fases 2 y 3**: descriptor φ ∈ ℝ¹⁴⁶, coseno, gemelos y contraste emparejado de POIs. Las afirmaciones de la literatura van citadas en APA 7; al final hay una lámina de referencias.
7. **Resultados**, **otras ciudades** (la misma tubería sobre Chicago), **herramienta**, **reconocimientos** (2.º lugar Demo Mode 2026 y
   Ministerio del Interior, DIRTIC-PNP), **conclusiones**, **paper en redacción** y
   **preguntas**.

## Estructura

```text
index.html            guion y texto de cada paso
css/deck.css          estilos (identidad visual del dashboard)
js/figures.js         figuras del método, tomadas de como-funciona-visual.html
js/real.js            figuras con datos reales: representaciones, trayectoria, join tree, Monte Carlo, coseno
js/deck.js            motor de pasos, mapas de ciudad y figuras propias
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

Solo lee artefactos publicados y agregados (celdas de 200 m, polígonos de
hotspots, resúmenes). La lámina de Chicago necesita además la carpeta de
artefactos de esa ciudad:

```bash
python tools/build_data.py --chicago RUTA/A/data/chicago
```

Todas las figuras se dibujan con datos reales; ninguna es un esquema simulado.
