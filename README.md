# Sustentación de tesis: crimen urbano sobre la red vial de Lima

Presentación en formato *scrollytelling*: el gráfico se queda fijo a la derecha y
cambia con cada paso del texto. Está basada en la sección «Cómo funciona» del
[dashboard](https://cesarpr30.github.io/thesis-dashboard/) y usa sus mismos datos
publicados.

**Tesis:** *El efecto de los puntos de interés y la topología de la red vial en la
distribución espacial del crimen urbano* · César Eduardo Pajuelo Reyes · asesor
Germain García-Zanabria · Ciencia de Datos, UTEC.

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

## Guion (34 pasos)

1. **Inicio y contexto**: portada sobre el mapa de 1 016 306 denuncias, victimización,
   concentración del crimen y serie mensual.
2. **Problema**: topología y POIs estudiados por separado, celdas frente a red vial,
   pregunta de investigación.
3. **Objetivos** y **propuesta** (encontrar, validar, comparar).
4. **Datos**: embudo de 3,1 M filas a 1,0 M y recuperación por dirección.
5. **Fase 1 · Detección**: red vial, densidad geodésica, hotspots, persistencia
   (join tree) y test de Monte Carlo con número de hotspots por mes.
6. **Validación**: verdad sintética, misma huella, sensibilidad a σ.
7. **Fase 2 · Similitud**: vector de forma de 146 dimensiones y coseno.
8. **Fase 3 · Gemelos**: misma forma, distinto crimen, y qué POIs los separan.
9. **Hallazgos**: cobertura y trayectorias.
10. **Herramienta**, **Reconocimientos** (2.º lugar en Demo Mode 2026 y presentación
    en el Ministerio del Interior, DIRTIC-PNP), **Limitaciones**, **Conclusiones**,
    **Trabajo futuro** y **Preguntas**.

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
