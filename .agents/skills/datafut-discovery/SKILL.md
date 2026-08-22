---
name: datafut-discovery
description: Discover statistical candidates in DataFut within the current PlayDoIt catalog. Never verify availability, build parlays, render, or publish.
---

# DataFut Discovery

## RESPONSABILIDAD ÚNICA

Explorar DataFut y producir candidatos estadísticos de calidad editorial DENTRO del universo comercial confirmado por PlayDoIt Catalog.

No verifica PlayDoIt.

No declara AVAILABLE_EXACT.

No forma Parlays.

No renderiza.

---

# INPUT COMERCIAL

Antes de descubrir candidatos, leer:

C:\DataFut-Marketing\pipeline-state\playdoit-catalog.json

Debe contener:

catalogStatus = VERIFIED

y:

evidenceSource = live_dom.

Si no existe catálogo válido:

DETENER.

No buscar candidatos a ciegas.

---

# FUENTE ESTADÍSTICA

Fuente:

https://data-fut.com

Usar:

C:\DataFut-Marketing\datafut-marketing-session.json

Solo usuario normal.

Solo lectura.

---

# OUTPUT

Guardar:

C:\DataFut-Marketing\pipeline-state\discovery-candidates.json

---

# PRINCIPIO CENTRAL

PLAYDOIT DEFINE EL UNIVERSO COMERCIAL.

DATAFUT DEFINE SI ESE MERCADO TIENE RESPALDO.

No buscar primero cualquier predicción de DataFut esperando que después exista comercialmente.

---

# FILTRO DE PARTIDOS

Discovery solo debe priorizar partidos que estén presentes en:

playdoit-catalog.json.

Si DataFut tiene:

Athletic Club vs CRB

pero el catálogo PlayDoIt NO tiene dicho partido:

NO gastar un slot de Discovery en ese encuentro.

---

# FILTRO DE FAMILIAS

Si PlayDoIt Catalog confirma para un partido:

- goles;
- corners;
- tiros;

pero NO confirma faltas:

Discovery NO debe generar candidatos de faltas para ese partido durante este flujo.

Esto NO significa que DataFut no tenga faltas.

Significa que no sirven para el objetivo comercial actual.

---

# FILTRO DE LÍNEAS

Cuando el catálogo contiene líneas concretas:

Discovery debe comprobar si DataFut posee predicciones NATIVAS para esas líneas.

Ejemplo:

PlayDoIt:

LDU +13.5 tiros
LDU +14.5 tiros
LDU +15.5 tiros.

Discovery revisa DataFut.

Si DataFut posee:

+14.5 = 83.3%

puede crear candidato.

Si DataFut solo posee:

+12.5 = 85%

NO modificarlo a +14.5.

---

# PROHIBIDO AJUSTAR PREDICCIONES

Nunca adaptar DataFut a PlayDoIt.

Solo buscar INTERSECCIÓN exacta:

MERCADO DATAFUT NATIVO

∩

MERCADO PLAYDOIT DISPONIBLE.

---

# UMBRAL MÍNIMO

percentage > 70.0

obligatorio.

Todo candidato con porcentaje menor o igual a 70.0:

DESCARTAR antes del output.

---

# MERCADOS TRIVIALES

Este filtro se ejecuta ANTES de escribir candidatos y ANTES de enviar cualquier
mercado a Verification. No gastar navegación ni contexto comprobando estos
mercados en PlayDoIt.

Excluir normalmente:

Over 0.5 goles.

Over 0.5 tiros.

Over 1.5 tiros.

Over 2.5 tiros.

Over 0.5 tiros a puerta.

Over 1.5 tiros a puerta.

Over 0.5 tarjetas por equipo.

Over 0.5 corners.

Over 1.5 corners.

Over 0.5, 1.5 o 2.5 faltas.

Over 2.5 corners por equipo:

baja prioridad.

---

# UNDER

Las exclusiones anteriores son direccionales.

No aplicar automáticamente a Under.

Ejemplos potencialmente válidos:

Under 0.5 goles

Under 1.5 tiros a puerta

Under 2.5 corners

si:

percentage >70%

y existe línea exacta en catálogo.

---

# CUOTAS EXTREMADAMENTE BAJAS — PREFILTRO EDITORIAL

El catálogo puede contener mercados con cuotas extremadamente bajas.

Ejemplo:

-2198.

Estos mercados pueden existir y tener respaldo estadístico, pero generalmente tienen muy poco valor editorial.

Discovery debe clasificarlos como:

commercialPriority = very_low

cuando la cuota sea claramente extrema.

No necesariamente descartarlos todavía de forma absoluta.

Sin embargo:

NO deben desplazar candidatos de calidad comparable con cuotas comercialmente más útiles.

---

# MERCADOS PREFERIDOS

Cuando existan en la intersección Catalog + DataFut y tengan >70%:

priorizar:

- tiros totales exigentes;
- tiros a puerta exigentes;
- corners por equipo;
- corners totales;
- faltas;
- tarjetas interesantes;
- goles no triviales;
- mercados de equipo;
- periodos.

---

# EXPLORACIÓN DATAFUT

Dentro de los partidos comercialmente disponibles:

explorar:

Producción Avanzada;

primer tiempo;

segundo tiempo;

goles;

tiros;

tiros a puerta;

corners;

faltas;

tarjetas;

mercados de equipo.

No limitarse a goles.

---

# LOTE INICIAL

Hasta:

20 candidatos.

Todos:

>70%.

Todos:

compatibles conceptualmente con el catálogo actual.

---

# REPOSICIÓN

Rondas nuevas:

hasta 10 candidatos NUEVOS.

No repetir:

partido
+
sujeto
+
estadística
+
alcance
+
dirección
+
línea
+
periodo.

La identidad exacta anterior debe registrarse como `candidateKey` estable. El
`candidateId` puede cambiar por ronda, pero `candidateKey` no. Discovery debe
recibir y respetar todas las claves ya evaluadas por el orquestador.

En reposición, no devolver simplemente los primeros mercados encontrados.
Ordenar los candidatos restantes priorizando utilidad comercial, porcentaje,
muestra y claridad editorial; después aplicar el límite de 10.

---

# DIVERSIDAD

Buscar diversidad dentro del universo realmente comercializado.

No forzar.

Calidad manda.

---

# MUESTRA

Registrar siempre muestra.

No ocultar:

3+3

3+4.

Muestras pequeñas deben penalizarse editorialmente frente a muestras mayores de calidad comparable.

---

# EVIDENCIA

Debe proceder exclusivamente del candidato DataFut exacto.

Nunca reutilizar evidencia.

Nunca inventar.

---

# OUTPUT

{
  "generatedAt": "...",
  "catalogGeneratedAt": "...",
  "percentageThresholdExclusive": 70.0,
  "round": 1,
  "candidates": [
    {
      "candidateId": "DF-001",
      "catalogMatchId": "PD-001",
      "match": "...",
      "league": "...",
      "subject": "...",
      "statistic": "...",
      "scope": "...",
      "direction": "...",
      "line": 14.5,
      "period": "full_time",
      "market": "...",
      "percentage": 83.3,
      "sample": {
        "home": 3,
        "away": 3
      },
      "evidence": [
        "..."
      ],
      "family": "shots",
      "editorialPriority": "high",
      "commercialPriority": "normal"
    }
  ]
}

---

# NO DISPONIBILIDAD

Discovery NO puede escribir:

AVAILABLE_EXACT.

Solo propone candidatos compatibles con el catálogo.

Verification sigue siendo obligatoria.

---

# FINAL

Discovery responde:

"De los mercados que PlayDoIt realmente comercializa, estos son los que DataFut respalda con >70%."

No responde:

"estos ya están verificados para publicación".
