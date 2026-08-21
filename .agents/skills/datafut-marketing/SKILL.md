---
name: datafut-marketing
description: Orchestrate the modular DataFut marketing workflow across catalog, discovery, verification, parlay building, human selection, content, and social outputs.
---

# DataFut Marketing — Orquestador

## OBJETIVO

Esta skill coordina la arquitectura modular de DataFut Marketing.

No scrapea DataFut directamente.

No verifica mercados directamente.

No renderiza directamente.

No genera imágenes directamente.

Skills oficiales:

1. playdoit-catalog
2. datafut-discovery
3. playdoit-verification
4. datafut-parlay-builder
5. datafut-content
6. datafut-social

El flujo es serial y modular.

---

# ARCHIVOS DE ESTADO OFICIALES

Directorio:

C:\DataFut-Marketing\pipeline-state

Archivos:

playdoit-catalog.json

discovery-candidates.json

verified-candidates.json

parlay-options.json

---

# FORMATOS EDITORIALES OFICIALES

1. OJO CON ESTE PARTIDO
2. PARLAY DE DATOS
3. COMBINADA DEL PARTIDO

Las imágenes sociales son salidas derivadas.

---

# PRINCIPIO FUNDAMENTAL

Cada skill tiene una responsabilidad exclusiva.

playdoit-catalog:

define qué existe comercialmente.

datafut-discovery:

encuentra respaldo estadístico dentro de ese universo.

playdoit-verification:

confirma nuevamente la coincidencia exacta.

datafut-parlay-builder:

forma y cotiza combinaciones.

datafut-content:

produce contenido.

datafut-social:

genera salidas sociales.

---

# NUEVO FLUJO PRINCIPAL

Para PARLAY DE DATOS:

playdoit-catalog

→ datafut-discovery

→ playdoit-verification

→ filtrar elegibles

→ reposición si faltan

→ datafut-parlay-builder

→ usuario elige

→ revalidación final

→ datafut-content

→ datafut-social.

---

# POR QUÉ CATALOG VA PRIMERO

No tiene sentido que Discovery genere decenas de candidatos pertenecientes a:

- partidos inexistentes en PlayDoIt;
- familias de mercado no comercializadas;
- líneas que PlayDoIt no ofrece.

Por tanto:

Discovery debe recibir el universo comercial confirmado previamente.

Esto NO significa que PlayDoIt genere picks.

PlayDoIt únicamente define:

QUÉ PUEDE SER VERIFICADO COMERCIALMENTE.

DataFut sigue siendo la autoridad estadística.

---

# UMBRAL MÍNIMO GLOBAL

Para cualquier formato oficial:

percentage >= 65.0

es obligatorio.

Aplica individualmente a cada mercado.

No promediar.

No compensar.

No calcular probabilidad conjunta.

---

# CONDICIONES DE ELEGIBILIDAD

Un candidato solo es elegible cuando cumple:

percentage >= 65.0

AND

status = AVAILABLE_EXACT

AND

evidenceSource = live_dom.

AVAILABLE_EXACT no sustituye el filtro DataFut.

---

# CATALOG NO ES AVAILABLE_EXACT

Que un mercado aparezca en:

playdoit-catalog.json

NO significa que ya esté verificado para publicación.

El candidato todavía debe pasar por:

playdoit-verification.

---

# RONDA INICIAL

1. ejecutar playdoit-catalog;
2. obtener catálogo actual;
3. ejecutar datafut-discovery usando dicho catálogo;
4. Discovery produce hasta 20 candidatos;
5. Verification revisa candidatos exactos;
6. contar elegibles.

---

# LOOP DE REPOSICIÓN

Objetivo Parlay:

hasta 6 candidatos elegibles.

Si eligibleCount < 6:

volver a datafut-discovery.

La nueva ronda debe:

- usar el mismo catálogo si sigue siendo suficientemente reciente;
- evitar candidatos exactos ya evaluados;
- buscar otras predicciones DataFut compatibles con líneas del catálogo.

Después:

playdoit-verification.

Repetir.

---

# REFRESCO DE CATÁLOGO

El catálogo comercial puede cambiar.

Si durante el loop:

- pasan muchos minutos;
- desaparecen partidos;
- aparecen inconsistencias;
- Verification detecta múltiples cambios;

puede ejecutarse nuevamente:

playdoit-catalog.

No asumir que un catálogo viejo sigue vigente indefinidamente.

---

# MÁXIMO DE RONDAS

Ronda inicial:

hasta 20 candidatos.

Reposición:

hasta 10 nuevos por ronda.

Máximo recomendado:

4 rondas totales.

Si no se consiguen 6:

presentar menos.

No degradar calidad.

---

# REPOSICIÓN INTELIGENTE

Si un candidato falla:

NO repetirlo.

Si PlayDoIt ofrece otra línea:

Discovery puede evaluarla SOLO si DataFut posee una predicción NATIVA e independiente para esa línea exacta.

Nunca transportar porcentaje.

---

# CONTROL HUMANO

El usuario SIEMPRE elige:

- Parlay;
- pick individual;
- Combinada.

El pipeline nunca debe elegir automáticamente qué contenido publicar.

---

# PARLAY

Cuando existan hasta 6 elegibles:

datafut-parlay-builder.

Builder presenta hasta 5 finalistas.

DETENER.

Esperar elección.

---

# OJO CON ESTE PARTIDO

Catalog

→ Discovery

→ Verification

→ presentar opciones >=65%.

DETENER.

Usuario elige.

---

# COMBINADA

Catalog debe identificar mercados disponibles del partido.

Discovery busca respaldo DataFut.

Verification confirma.

Debe comprobarse además compatibilidad Bet Builder.

Presentar opciones.

DETENER.

Usuario elige.

---

# REVALIDACIÓN FINAL

Después de elección del usuario:

Verification vuelve a consultar los mercados exactos.

Si alguno falla:

NO sustituir.

Informar:

NO REVALIDABLE EN SU FORMA ORIGINAL.

---

# FALLAS

Si catalog falla:

no ejecutar Discovery suponiendo disponibilidad.

Si Discovery falla:

no inventar candidatos.

Si Verification falla:

no presentar AVAILABLE_EXACT.

Si Builder falla:

no inventar momios.

---

# PRINCIPIO DE AUTORIDAD

PlayDoIt Catalog:

universo comercial.

DataFut:

respaldo estadístico.

PlayDoIt Verification:

disponibilidad exacta actual.

Builder:

momio combinado actual.

---

# REGLA FINAL

CATALOGAR
→ DESCUBRIR
→ VERIFICAR
→ REPONER
→ CONSTRUIR
→ USUARIO ELIGE
→ REVALIDAR
→ GENERAR.

Nunca invertir responsabilidades.
