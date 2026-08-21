import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


# ============================================================
# CONFIGURACIÓN
# ============================================================

PROJECT_DIR = Path(__file__).resolve().parent

DATA_FILE = PROJECT_DIR / "parlay-data.json"

OUTPUT_DIR = PROJECT_DIR / "parlay-audio"

VOICE = "es-MX-JorgeNeural"

RATE = "+11%"


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def ensure_file_exists(path: Path, description: str):
    if not path.exists():
        raise FileNotFoundError(
            f"No existe {description}: {path}"
        )


def clean_text(text: str) -> str:
    """
    Limpia espacios duplicados y saltos innecesarios.
    """
    return re.sub(
        r"\s+",
        " ",
        str(text)
    ).strip()


def normalize_for_matching(text: str) -> str:
    """
    Normaliza texto para poder detectar conceptos técnicos
    independientemente de mayúsculas o acentos.
    """
    text = str(text)

    replacements = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ü": "u",
        "ñ": "n"
    }

    text = text.lower()

    for original, replacement in replacements.items():
        text = text.replace(
            original,
            replacement
        )

    return clean_text(text)


def speech_number(value) -> str:
    """
    Convierte valores escritos con punto a una forma que Edge TTS
    pronuncia de manera más natural en español.

    Ejemplos:

    73.1
    ->
    "73 punto 1"

    0.11
    ->
    "0 punto 11"

    68.2%
    ->
    "68 punto 2 por ciento"
    """
    text = str(value).strip()

    text = text.replace(
        "%",
        " por ciento"
    )

    text = text.replace(
        "+",
        " más "
    )

    text = re.sub(
        r"(-?\d+)\.(\d+)",
        r"\1 punto \2",
        text
    )

    return clean_text(
        text
    )


def speech_market(market: str) -> str:
    """
    Convierte mercados a una pronunciación más natural.
    """
    text = market.strip().lower()

    text = re.sub(
        r"(\d+)\.(\d+)",
        r"\1 punto \2",
        text
    )

    return clean_text(
        text
    )


def is_low_value_technical_evidence(evidence: dict) -> bool:
    """
    Detecta evidencias que son útiles internamente pero no aportan
    valor narrativo al Reel.

    Ejemplos que se omiten:

    - Cobertura
    - Muestra
    - 7+7
    - partidos analizados
    - cobertura avanzada

    IMPORTANTE:
    La evidencia NO se reemplaza ni se inventa.
    Simplemente no se narra.
    """

    label = normalize_for_matching(
        evidence.get(
            "label",
            ""
        )
    )

    detail = normalize_for_matching(
        evidence.get(
            "detail",
            ""
        )
    )

    value = clean_text(
        evidence.get(
            "value",
            ""
        )
    )

    combined = (
        f"{label} {detail}"
    )

    blocked_terms = [
        "cobertura",
        "cobertura avanzada",
        "muestra",
        "partidos analizados",
        "partidos disponibles",
        "fuentes validadas",
        "datos disponibles"
    ]

    for term in blocked_terms:
        if term in combined:
            return True

    # Ejemplos:
    # 7+7
    # 9+9
    # 12 + 8

    if re.fullmatch(
        r"\s*\d+\s*\+\s*\d+\s*",
        value
    ):
        return True

    return False


def build_evidence_sentence(evidence: dict) -> str:
    """
    Construye una frase natural únicamente para evidencia
    considerada útil para el espectador.
    """

    label = clean_text(
        evidence["label"]
    )

    value = speech_number(
        evidence["value"]
    )

    detail = clean_text(
        evidence["detail"]
    )

    return clean_text(
        f"{label}, {value} {detail}."
    )


def get_narratable_evidence(pick: dict) -> list:
    """
    Devuelve únicamente las evidencias que sí vale la pena
    explicar mediante voz.

    No inventa sustitutos.
    """

    evidence_list = pick.get(
        "evidence",
        []
    )

    narratable = []

    for evidence in evidence_list:

        if is_low_value_technical_evidence(
            evidence
        ):
            continue

        narratable.append(
            evidence
        )

    return narratable


def build_pick_narration(
    prefix: str,
    pick: dict
) -> str:
    """
    Genera la narración completa de un pick.

    Ejemplo:

    Primero, Unión Santa Fe contra Central Córdoba.
    Menos de tres punto cinco goles, con setenta y tres...
    Central Córdoba fuera...
    Unión en casa...

    Si una evidencia es puramente técnica, no se lee.
    """

    home_team = clean_text(
        pick["homeTeam"]
    )

    away_team = clean_text(
        pick["awayTeam"]
    )

    market = speech_market(
        pick["market"]
    )

    percentage = speech_number(
        pick["percentage"]
    )

    parts = [
        (
            f"{prefix}, "
            f"{home_team} "
            f"contra "
            f"{away_team}."
        ),
        (
            f"{market}, "
            f"con "
            f"{percentage} "
            f"por ciento de respaldo."
        )
    ]

    narratable_evidence = (
        get_narratable_evidence(
            pick
        )
    )

    for evidence in narratable_evidence:
        parts.append(
            build_evidence_sentence(
                evidence
            )
        )

    return clean_text(
        " ".join(
            parts
        )
    )


def parse_srt_timestamp(timestamp: str) -> float:
    """
    Convierte:

    00:00:12,450

    a:

    12.45 segundos
    """

    hours, minutes, rest = timestamp.split(
        ":"
    )

    seconds, milliseconds = rest.split(
        ","
    )

    total = (
        int(hours) * 3600
        + int(minutes) * 60
        + int(seconds)
        + int(milliseconds) / 1000
    )

    return total


def get_srt_duration(srt_path: Path) -> float:
    """
    Obtiene la duración aproximada del bloque usando
    el último timestamp generado por Edge TTS.
    """

    content = srt_path.read_text(
        encoding="utf-8"
    )

    timestamps = re.findall(
        r"\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+"
        r"(\d{2}:\d{2}:\d{2},\d{3})",
        content
    )

    if not timestamps:
        raise RuntimeError(
            f"No se pudieron encontrar timestamps en {srt_path}"
        )

    return parse_srt_timestamp(
        timestamps[-1]
    )


def generate_tts(
    text: str,
    mp3_path: Path,
    srt_path: Path
):
    """
    Genera MP3 + SRT utilizando Edge TTS.
    """

    command = [
        sys.executable,
        "-m",
        "edge_tts",

        "--voice",
        VOICE,

        "--rate",
        RATE,

        "--text",
        text,

        "--write-media",
        str(mp3_path),

        "--write-subtitles",
        str(srt_path)
    ]

    print("")

    print(
        f"Generando: {mp3_path.name}"
    )

    result = subprocess.run(
        command,
        check=False
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Edge TTS terminó con código {result.returncode}"
        )

    if not mp3_path.exists():
        raise RuntimeError(
            f"No se generó {mp3_path}"
        )

    if not srt_path.exists():
        raise RuntimeError(
            f"No se generó {srt_path}"
        )


# ============================================================
# CARGA DE DATOS
# ============================================================

ensure_file_exists(
    DATA_FILE,
    "parlay-data.json"
)

with DATA_FILE.open(
    "r",
    encoding="utf-8"
) as file:

    parlay_data = json.load(
        file
    )


# ============================================================
# VALIDACIÓN
# ============================================================

picks = parlay_data.get(
    "picks"
)

if (
    not isinstance(picks, list)
    or len(picks) != 3
):
    raise ValueError(
        "parlay-data.json debe contener exactamente 3 picks."
    )


# ============================================================
# PICKS
# ============================================================

pick1 = picks[0]
pick2 = picks[1]
pick3 = picks[2]


# ============================================================
# MOSTRAR QUÉ EVIDENCIAS SE OMITIRÁN
# ============================================================

print("")
print("========================================")
print(" REVISIÓN DE EVIDENCIAS PARA NARRACIÓN")
print("========================================")
print("")

for pick_index, pick in enumerate(
    picks,
    start=1
):

    print(
        f"Pick {pick_index}: "
        f"{pick['homeTeam']} vs {pick['awayTeam']}"
    )

    for evidence_index, evidence in enumerate(
        pick.get(
            "evidence",
            []
        ),
        start=1
    ):

        if is_low_value_technical_evidence(
            evidence
        ):

            print(
                f"  OMITIDA evidencia {evidence_index}: "
                f"{evidence['label']} / "
                f"{evidence['value']} / "
                f"{evidence['detail']}"
            )

        else:

            print(
                f"  NARRADA evidencia {evidence_index}: "
                f"{evidence['label']} / "
                f"{evidence['value']} / "
                f"{evidence['detail']}"
            )

    print("")


# ============================================================
# CREAR GUION
# ============================================================

intro_text = (
    "Tres picks respaldados por los datos para hoy."
)


pick1_text = build_pick_narration(
    "Primero",
    pick1
)


pick2_text = build_pick_narration(
    "Segundo",
    pick2
)


pick3_text = build_pick_narration(
    "Y tercero",
    pick3
)


outro_text = (
    "Tres selecciones basadas en estadísticas históricas de DataFut. "
    "Estas estimaciones no garantizan resultados. "
    "Consulta el análisis completo en Data Fut."
)


blocks = [
    {
        "id":
            "intro",

        "filename":
            "01-intro",

        "text":
            clean_text(
                intro_text
            )
    },

    {
        "id":
            "pick1",

        "filename":
            "02-pick-1",

        "text":
            clean_text(
                pick1_text
            )
    },

    {
        "id":
            "pick2",

        "filename":
            "03-pick-2",

        "text":
            clean_text(
                pick2_text
            )
    },

    {
        "id":
            "pick3",

        "filename":
            "04-pick-3",

        "text":
            clean_text(
                pick3_text
            )
    },

    {
        "id":
            "outro",

        "filename":
            "05-outro",

        "text":
            clean_text(
                outro_text
            )
    }
]


# ============================================================
# PREPARAR CARPETA
# ============================================================

if OUTPUT_DIR.exists():
    shutil.rmtree(
        OUTPUT_DIR
    )

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# GUARDAR GUION COMPLETO
# ============================================================

narration_text_path = (
    OUTPUT_DIR /
    "narration.txt"
)

full_script = "\n\n".join(
    block["text"]
    for block in blocks
)

narration_text_path.write_text(
    full_script,
    encoding="utf-8"
)


# ============================================================
# GENERAR AUDIO POR BLOQUES
# ============================================================

timeline = []

current_start = 0.0

transition_padding = 0.35


for block in blocks:

    mp3_path = (
        OUTPUT_DIR /
        f"{block['filename']}.mp3"
    )

    srt_path = (
        OUTPUT_DIR /
        f"{block['filename']}.srt"
    )

    generate_tts(
        block["text"],
        mp3_path,
        srt_path
    )

    duration = get_srt_duration(
        srt_path
    )

    start_time = (
        current_start
    )

    end_time = (
        start_time +
        duration
    )

    timeline.append(
        {
            "id":
                block["id"],

            "text":
                block["text"],

            "audio":
                mp3_path.name,

            "subtitles":
                srt_path.name,

            "startSeconds":
                round(
                    start_time,
                    3
                ),

            "durationSeconds":
                round(
                    duration,
                    3
                ),

            "endSeconds":
                round(
                    end_time,
                    3
                )
        }
    )

    current_start = (
        end_time +
        transition_padding
    )


# ============================================================
# DURACIÓN TOTAL
# ============================================================

if timeline:

    total_audio_duration = (
        timeline[-1]["endSeconds"]
    )

else:

    total_audio_duration = 0


video_end_padding = 1.0

total_video_duration = (
    total_audio_duration +
    video_end_padding
)


# ============================================================
# MANIFEST
# ============================================================

manifest = {
    "voice":
        VOICE,

    "rate":
        RATE,

    "sourceData":
        "parlay-data.json",

    "blocks":
        timeline,

    "transitionPaddingSeconds":
        transition_padding,

    "videoEndPaddingSeconds":
        video_end_padding,

    "totalAudioDurationSeconds":
        round(
            total_audio_duration,
            3
        ),

    "totalVideoDurationSeconds":
        round(
            total_video_duration,
            3
        )
}


manifest_path = (
    OUTPUT_DIR /
    "narration-manifest.json"
)

manifest_path.write_text(
    json.dumps(
        manifest,
        ensure_ascii=False,
        indent=2
    ),
    encoding="utf-8"
)


# ============================================================
# RESULTADO
# ============================================================

print("")
print("========================================")
print(" DATAFUT PARLAY VOICE READY")
print("========================================")
print("")

print(
    f"Voz: {VOICE}"
)

print(
    f"Velocidad: {RATE}"
)

print("")

for block in timeline:

    print(
        f"{block['id']}: "
        f"{block['durationSeconds']:.2f}s "
        f"({block['startSeconds']:.2f}s → "
        f"{block['endSeconds']:.2f}s)"
    )

print("")

print(
    "Duración total de narración: "
    f"{total_audio_duration:.2f}s"
)

print(
    "Duración sugerida del video: "
    f"{total_video_duration:.2f}s"
)

print("")

print(
    f"Carpeta: {OUTPUT_DIR}"
)

print("")

print(
    "Guion generado:"
)

print("")

for block in blocks:

    print(
        f"[{block['id']}]"
    )

    print(
        block["text"]
    )

    print("")

print(
    "Archivos generados:"
)

print(
    "  narration.txt"
)

print(
    "  narration-manifest.json"
)

for block in blocks:

    print(
        f"  {block['filename']}.mp3"
    )

    print(
        f"  {block['filename']}.srt"
    )

print("")