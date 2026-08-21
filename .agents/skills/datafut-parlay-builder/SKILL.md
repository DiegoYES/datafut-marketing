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

---

# REQUISITOS ABSOLUTOS DE ENTRADA

Un candidato solo puede participar si cumple simultáneamente:

percentage >= 65.0

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

>=65%

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

Intentar incluir variedad cuando existan opciones válidas:

- dobles;
- triples;
- mayor respaldo;
- mayor diversidad;
- alternativa de momio atractivo.

No es obligatorio cubrir todas las categorías.

---

# FORMATO DE PRESENTACIÓN

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