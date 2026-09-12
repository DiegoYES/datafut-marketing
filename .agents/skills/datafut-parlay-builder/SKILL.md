---
name: datafut-parlay-builder
description: Build, quote, and rank parlay finalists from candidates verified with exact live DOM evidence. Never place bets, enter stake, publish, or choose for the user.
---

# DataFut Parlay Builder

## RESPONSABILIDAD ÚNICA

Construir, cotizar y clasificar opciones de PARLAY DE DATOS utilizando
exclusivamente candidatos previamente verificados.

Esta skill:

- NO descubre predicciones en DataFut;
- NO decide disponibilidad individual;
- NO modifica porcentajes;
- NO genera contenido;
- NO publica;
- NO realiza apuestas.

Su responsabilidad es:

1. recibir candidatos elegibles;
2. construir un pool editorial de hasta 6 candidatos;
3. generar combinaciones dobles y triples;
4. cotizarlas temporalmente en el betslip público de PlayDoIt;
5. leer el momio combinado REAL;
6. limpiar el betslip;
7. clasificar hasta 5 finalistas;
8. detenerse para que el usuario elija.

---

# INPUT OFICIAL

Leer:

C:\DataFut-Marketing\pipeline-state\verified-candidates.json

Cuando exista reposición, leer como pool acumulado:

C:\DataFut-Marketing\pipeline-state\eligible-candidates.json

Cada entrada de ese archivo debe conservar conjuntamente su objeto Discovery
y su resultado Verification AVAILABLE_EXACT. Nunca perder los elegibles de
rondas anteriores ni reintroducir candidatos descartados.

Puede consultar también:

C:\DataFut-Marketing\pipeline-state\discovery-candidates.json

únicamente para recuperar metadata editorial del candidato:

- porcentaje;
- muestra;
- familia;
- evidencia;
- prioridad editorial.

Nunca utilizar discovery-candidates.json para sustituir una verificación.

---

# OUTPUT OFICIAL

Guardar:

C:\DataFut-Marketing\pipeline-state\parlay-options.json

## COMANDO DOM OFICIAL

Cotizar dobles y triples siguiendo
[`../datafut-marketing/references/dom-capture-contracts.md`](../datafut-marketing/references/dom-capture-contracts.md)
y ejecutar:

`npm run datafut -- parlays-dom --observation <archivo.json>`

El importador rechaza filas que no repitan exactamente la evidencia de
Verification, exige captura PNG hasheada y limpieza posterior del boleto.

### AUTOMATIZACIÓN EN PLAYDOIT (CHROME CDP + SHADOW DOM)

Para evitar bloqueos de Cloudflare WAF (error 403 / "Acceso bloqueado") y acceder al sportsbook:

1. **Anti-bot WAF**: Cloudflare bloquea Playwright en modo headless o con navegadores virtuales. Se debe lanzar Google Chrome real (`chrome.exe`) con `--remote-debugging-port=9222` y conectar mediante `chromium.connectOverCDP('http://localhost:9222')`.
2. **Shadow DOM de Altenar**: La SPA deportiva de PlayDoIt corre dentro de un Shadow Root abierto (`element.shadowRoot`). Todo selector de mercado (`EventDetailsMarketBoxRoot`), cuotas y boleto (`BetSlipContainer`) debe buscarse dentro de `root = shadowHost.shadowRoot`.
3. **Script de captura directa**:
   ```powershell
   node scripts/capture-live-betslip.js
   ```
   Este script controla Chrome sobre CDP, navega al sportsbook, agrega las selecciones de `parlay-quote-request.json`, lee los momios oficiales del boleto, toma el PNG de evidencia con hash SHA-256 y genera `captures/dom/playdoit-betslip-observation-<date>.json`.
4. **Importación y auditoría**:
   ```powershell
   npm run datafut -- parlays-dom --observation captures/dom/playdoit-betslip-observation-<date>.json
   npm run datafut -- audit
   npm run datafut -- finalists
   ```

---

# REQUISITOS ABSOLUTOS DE ENTRADA

Un candidato solo puede participar si cumple simultáneamente:

percentage > 70.0

AND

status = AVAILABLE_EXACT

AND

evidenceSource = live_dom.

Si falla cualquiera:

NO puede entrar al Builder.

---

# PORCENTAJES

Los porcentajes DataFut representan exclusivamente respaldo individual.

Está estrictamente prohibido:

- multiplicarlos;
- sumarlos;
- promediarlos para estimar probabilidad;
- calcular probabilidad conjunta;
- asumir independencia;
- presentar un porcentaje del Parlay.

El momio del sportsbook y el porcentaje DataFut son conceptos distintos.

---

# ETAPA 1 — POOL TÉCNICAMENTE ELEGIBLE

Primero identificar TODOS los candidatos que cumplen:

>70%

AVAILABLE_EXACT

live_dom.

Este conjunto se denomina:

eligibleCandidates.

NO limitar inmediatamente a los 6 porcentajes más altos.

---

# ETAPA 2 — VALOR EDITORIAL Y COMERCIAL

Después clasificar cada candidato utilizando cuatro dimensiones:

1. respaldo DataFut;
2. calidad/tamaño de muestra;
3. utilidad comercial de la cuota;
4. interés/diversidad editorial.

La cuota NO modifica el porcentaje DataFut.

La cuota NO representa calidad estadística.

Solo se utiliza para evitar construir Parlays llenos de selecciones
comercialmente poco útiles.

---

# CLASIFICACIÓN DE CUOTA INDIVIDUAL

Cuando la cuota americana esté disponible:

## PRIORIDAD NORMAL

Cuotas mejores que -300.

Ejemplos:

+150
+105
-110
-167
-250.

Estas selecciones pueden competir normalmente por el pool final.

## PRIORIDAD BAJA

Cuotas desde -300 hasta -500 inclusive.

Ejemplos:

-300
-350
-400
-500.

Pueden utilizarse cuando:

- su respaldo sea especialmente fuerte;
- su muestra sea superior;
- aporte diversidad;
- o no existan suficientes alternativas mejores.

## PRIORIDAD MUY BAJA

Cuotas peores que -500.

Ejemplos:

-700
-800
-1200
-2198.

NO están prohibidas técnicamente.

Pero no deben desplazar candidatos de calidad estadística comparable
con cuotas más útiles.

Solo deben entrar al pool final si existe una razón editorial clara
o no existen suficientes alternativas de mejor prioridad.

---

# PROHIBIDO USAR CUOTA COMO PROBABILIDAD DATAFUT

Nunca decir:

"este pick es más probable porque paga -800".

Nunca reemplazar el porcentaje DataFut por probabilidad implícita.

Nunca mezclar ambos valores.

---

# MUESTRA

La muestra debe afectar el ranking editorial.

A igualdad aproximada de calidad:

10+10

debe preferirse frente a:

3+3.

Pero una muestra mayor NO autoriza modificar porcentajes ni descartar
automáticamente muestras pequeñas.

Registrar siempre la muestra real.

---

# DIVERSIDAD EDITORIAL

El pool final debe intentar evitar seis selecciones prácticamente idénticas.

Cuando existan alternativas de calidad comparable, buscar diversidad entre:

- goles;
- corners;
- tiros;
- tiros a puerta;
- faltas;
- tarjetas;
- mercados por equipo;
- totales.

NO forzar diversidad sacrificando significativamente la calidad.

CALIDAD > DIVERSIDAD.

---

# MERCADOS TRIVIALES

Los candidatos ya deberían haber sido filtrados por Discovery.

Builder no debe reintroducir mercados descartados por trivialidad.

Si detecta una inconsistencia:

marcar candidato como:

EDITORIAL_REJECTED.

---

# REPETICIÓN DEL MISMO PARTIDO

Para PARLAY DE DATOS, priorizar selecciones pertenecientes a partidos diferentes.

No construir un Parlay normal con dos selecciones del mismo encuentro si
eso pudiera comportarse como una combinada del partido / Same Game Parlay.

Si existen candidatos suficientes de encuentros diferentes:

usar partidos distintos.

---

# CONSTRUCCIÓN DEL POOL FINAL

Seleccionar hasta:

6 candidatos.

No elegir simplemente:

"los 6 porcentajes más altos".

Evaluar conjuntamente:

- percentage;
- sample;
- commercialPriority;
- editorialPriority;
- diversidad;
- partido;
- claridad del mercado.

---

# REGLA DE DOMINANCIA EDITORIAL

Si dos candidatos tienen calidad estadística comparable y uno presenta
una cuota comercial sustancialmente más útil:

preferir el de mejor utilidad comercial.

Ejemplo:

Candidato A:

76%
8+8
Under 3.5
-800

Candidato B:

73%
8+8
Corners
-150

No asumir automáticamente que A es mejor únicamente por tener 3 puntos
porcentuales adicionales.

Builder debe considerar B como potencialmente superior para el pool
editorial del Parlay.

---

# NO EXISTE FÓRMULA DE SCORE OBLIGATORIA

No inventar una fórmula matemática del tipo:

percentage × odds × sample.

No crear una falsa métrica científica.

El ranking es editorial y multicriterio.

Debe poder explicarse cualitativamente.

---

# TRANSPARENCIA DEL POOL

Antes de construir combinaciones, registrar para cada candidato seleccionado:

candidateId

match

market

percentage

sample

individualOdds

commercialPriority

family

editorialReason.

---

# ETAPA 3 — COMBINACIONES

Con N candidatos finales:

generar todas las combinaciones posibles de:

2 selecciones

y

3 selecciones.

Si N = 6:

15 dobles

+

20 triples

=

35 combinaciones.

---

# REGLA DE PARTIDOS DIFERENTES

Una combinación debe utilizar partidos diferentes salvo que el sportsbook
permita explícitamente esa estructura y el formato solicitado sea compatible.

Para PARLAY DE DATOS:

por defecto usar partidos distintos.

---

# ETAPA 4 — COTIZACIÓN REAL EN PLAYDOIT

Las combinaciones deben cotizarse utilizando el sportsbook público actual.

NO calcular el momio combinado manualmente como resultado oficial.

NO multiplicar cuotas individuales para presentar un momio "real".

El momio oficial debe proceder del betslip actual de PlayDoIt.

---

# BETSLIP TEMPORAL

Para cada combinación:

1. comprobar que el betslip está limpio;
2. agregar únicamente las selecciones de esa combinación;
3. esperar actualización del betslip;
4. confirmar que aparecen exactamente las selecciones esperadas;
5. leer el momio combinado mostrado;
6. registrar evidencia;
7. retirar todas las selecciones;
8. confirmar que el betslip vuelve a estar vacío;
9. continuar con la siguiente combinación.

---

# IMPORTANTE

"NO CREAR PARLAYS" significa:

NO confirmar apuesta.

NO colocar stake.

NO presionar botones de apostar/confirmar.

SÍ está permitido:

seleccionar temporalmente mercados en el betslip para obtener la cotización.

---

# PROHIBICIONES ABSOLUTAS

Nunca:

- ingresar monto;
- realizar apuesta;
- confirmar apuesta;
- iniciar sesión para apostar;
- utilizar fondos;
- depositar;
- retirar;
- aceptar cambios de cuota en nombre del usuario.

La interacción termina en la lectura pública del momio.

---

# EVIDENCIA DE COTIZACIÓN

Cada combinación cotizada debe registrar:

quotedAt

navigationMode

combinedOddsText

combinedOddsDecimal si PlayDoIt lo muestra

selectionCount

candidateIds

betslipEvidence = live_dom.

---

# FALLO DE COTIZACIÓN

Si una combinación no puede cotizarse:

NO inventar momio.

Marcar:

QUOTE_FAILED

o

SELECTION_CHANGED

o

SELECTION_UNAVAILABLE.

No utilizarla como finalista hasta resolverla.

---

# CAMBIO DURANTE BUILDER

Si al intentar cotizar una selección:

- desaparece;
- cambia línea;
- cambia alcance;
- cambia periodo;

NO sustituirla silenciosamente.

Marcar la combinación afectada como inválida.

El candidato debe regresar a Verification antes de reutilizarse.

---

# ETAPA 5 — CLASIFICACIÓN DE COMBINACIONES

Después de cotizar todas las combinaciones válidas:

seleccionar hasta 5 finalistas.

No ordenar únicamente por:

momio más alto

ni únicamente por:

porcentajes más altos.

Evaluar:

- calidad individual de los picks;
- muestras;
- diversidad;
- utilidad del momio combinado;
- claridad editorial;
- ausencia de selecciones de prioridad comercial extremadamente baja;
- equilibrio general.

---

# MOMIOS ALTOS

Un momio alto NO convierte automáticamente un Parlay en mejor opción.

Ejemplo:

+900

con tres selecciones débiles

no debe desplazar automáticamente:

+250

con tres selecciones mejor respaldadas.

---

# MOMIOS BAJOS

Una combinación con momio excesivamente bajo puede tener menor interés editorial.

No descartarla automáticamente si sus selecciones son excelentes.

Pero debe competir editorialmente contra alternativas más útiles.

---

# FINALISTAS

Presentar hasta 5.

Regla dura de diversidad (la aplica `parlays-dom`, no es aspiracional):
ningun pick aparece en mas de 2 finalistas en la primera pasada greedy
por cuota; si no se completan 5, el tope se relaja a 3 y luego sin tope.
Asi, si un pick falla, quedan vivos finalistas sin el.

Intentar incluir variedad cuando existan opciones válidas:

- dobles;
- triples;
- mayor respaldo;
- mayor diversidad;
- alternativa de momio atractivo.

No es obligatorio cubrir todas las categorías.

---

# FORMATO DE PRESENTACIÓN (estándar en chat, obligatorio)

Por cada finalista, una línea de título y UN PÁRRAFO SEPARADO POR PICK
(con línea en blanco entre párrafos; el cliente pega los saltos simples).
CADA PARLAY SE CIERRA CON UNA LÍNEA SEPARADORA `---` EN LÍNEA PROPIA,
para que se vea dónde termina uno y empieza el siguiente:

**Parlay Finalista N (Doble/Triple) +MOMIO (decimal)**

Partido vs Partido (HH:MM CDMX):

📌 Mercado exacto (Momio americano | decimal | Respaldo X%). Razón breve.

Ejemplo:

**Parlay Finalista 1 (Doble) +216 (3.16)**

Coritiba vs Mirassol (08:00 CDMX):

📌 Mirassol menos de 4.5 tiros a puerta del visitante (Momio -160 | 1.63 | Respaldo 78.6%). Línea exacta verificada en vivo, muestra de 20.

Reglas: hora siempre CDMX del catálogo; momio individual americano oficial
más su equivalente decimal entre paréntesis; respaldo = porcentaje DataFut;
sin etiquetas "Pick 1/2/3"; el mercado se transcribe LITERAL (texto exacto
de PlayDoIt, prohibido agregar o quitar palabras: "Total de tarjetas" no
es "tarjetas amarillas", "Total" no es "goles"); cerrar con el aviso de
integridad.

ANTES de los 5 finalistas, ENTREGAR EL LISTADO COMPLETO de picks
individuales elegibles (todos, mismo formato de una línea por pick con
hora CDMX, mercado literal, momio y respaldo).

ORDEN DE ENTREGA OBLIGATORIO: primero el listado completo de picks
individuales, y DESPUÉS los 5 parlays finalistas. Nunca al revés.

---

# FORMATO DE PRESENTACIÓN (detalle interno)

Para cada finalista:

## Finalista X

Tipo:

Parlay Doble / Parlay Triple

Momio REAL actual PlayDoIt:

...

Selección 1:

Partido:
Mercado exacto:
Porcentaje DataFut:
Muestra:
Cuota individual actual:

Selección 2:

...

Selección 3:

...

Razón editorial:

...

---

# AVISO DE INTEGRIDAD

Siempre aclarar:

Los porcentajes corresponden exclusivamente al respaldo individual de cada
selección según DataFut.

No representan la probabilidad conjunta del Parlay.

El momio corresponde a la cotización mostrada por PlayDoIt al momento de
la consulta y puede cambiar.

---

# CONTROL HUMANO OBLIGATORIO

Después de presentar los finalistas:

DETENER.

No elegir uno automáticamente.

No ejecutar datafut-content.

No ejecutar datafut-social.

Esperar explícitamente a que el usuario seleccione una opción.

---

# PUBLICAR EN DATA-FUT (FASE 3.5+)

Con la opción elegida por el humano (`--option <PAR-...>`) y visibilidad
(`--visibility gratis|premium`):

```
node scripts/publish-to-datafut.js --option <optionId> --visibility <gratis|premium> --dry-run --boleta-name "<nombre>"
node scripts/publish-to-datafut.js --option <optionId> --visibility <gratis|premium> --publish --boleta-name "<nombre>"
```

Reglas duras: puerta de auditoría (solo finalistas oficiales); Por armar
debe traer EXACTAMENTE las selecciones (si no, aborto); momio total en
decimal convertido del americano real del boleto; momios individuales
verificados por pick (inputs "Ej. 1.35"); destacar=Destacada; visible
hasta = ahora + 24h; verificación fail-closed tras submit (si la
publicación no aparece, ERROR, nunca reportar éxito sin confirmar).
Tras editar momios individuales la plataforma recalcula el total: refijar
el total real siempre. `--publish` SOLO con orden literal del humano.

---

# OUTPUT parlay-options.json

Ejemplo:

{
  "generatedAt": "...",
  "eligibleCount": 20,
  "poolSize": 6,
  "pool": [
    {
      "candidateId": "DF-018",
      "percentage": 70.0,
      "sample": {
        "home": 3,
        "away": 3
      },
      "individualOdds": "+125",
      "commercialPriority": "normal",
      "family": "shots_on_target",
      "editorialReason": "Mercado no trivial con cuota útil y respaldo suficiente."
    }
  ],
  "combinationsEvaluated": 35,
  "finalists": [
    {
      "rank": 1,
      "type": "triple",
      "candidateIds": [
        "DF-018",
        "DF-011",
        "DF-020"
      ],
      "combinedOddsText": "+...",
      "betslipEvidence": "live_dom",
      "quotedAt": "..."
    }
  ]
}

---

# REVALIDACIÓN POSTERIOR

La selección del usuario NO congela para siempre la disponibilidad.

Antes de generar contenido:

playdoit-verification

debe revalidar nuevamente las selecciones elegidas.

Si alguna deja de ser AVAILABLE_EXACT:

NO reemplazar automáticamente dentro del Parlay ya elegido.

Informar al usuario.

---

# REGLA FINAL

BUILDER NO BUSCA EL MOMIO MÁS ALTO.

BUILDER NO BUSCA LOS SEIS PORCENTAJES MÁS ALTOS.

BUILDER BUSCA UN POOL DE CANDIDATOS ESTADÍSTICAMENTE ELEGIBLES,
COMERCIALMENTE ÚTILES Y EDITORIALMENTE INTERESANTES.

DESPUÉS:

COTIZA TODAS LAS COMBINACIONES VÁLIDAS EN EL BETSLIP REAL.

Y EL USUARIO DECIDE.
