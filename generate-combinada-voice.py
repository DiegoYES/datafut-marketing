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

DATA_FILE = (
    PROJECT_DIR
    / "combinada-data.json"
)

OUTPUT_DIR = (
    PROJECT_DIR
    / "combinada-audio"
)

VOICE = "es-MX-JorgeNeural"

RATE = "+11%"


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def ensure_file_exists(
    path: Path,
    description: str
):
    if not path.exists():
        raise FileNotFoundError(
            f"No existe {description}: {path}"
        )


def clean_text(
    text
) -> str:
    return re.sub(
        r"\s+",
        " ",
        str(text)
    ).strip()


def speech_number(
    value
) -> str:
    """
    Convierte decimales y porcentajes
    a una forma más natural para Edge TTS.

    82.6 -> 82 punto 6
    1.86 -> 1 punto 86
    65.2% -> 65 punto 2 por ciento
    """

    text = clean_text(
        value
    )

    text = text.replace(
        "%",
        " por ciento"
    )

    text = re.sub(
        r"(-?\d+)\.(\d+)",
        r"\1 punto \2",
        text
    )

    return clean_text(
        text
    )


def speech_market(
    market: str
) -> str:

    text = clean_text(
        market
    ).lower()

    text = re.sub(
        r"(\d+)\.(\d+)",
        r"\1 punto \2",
        text
    )

    return clean_text(
        text
    )


def is_low_value_technical_evidence(
    evidence: dict
) -> bool:
    """
    Omite evidencias técnicas que no aportan valor narrativo.

    Ejemplos:
    - cobertura
    - muestra
    - partidos analizados
    - 7+7
    """

    label = clean_text(
        evidence.get(
            "label",
            ""
        )
    ).lower()

    detail = clean_text(
        evidence.get(
            "detail",
            ""
        )
    ).lower()

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
        "muestra",
        "partidos analizados",
        "fuentes validadas",
        "datos disponibles"
    ]

    for term in blocked_terms:
        if term in combined:
            return True

    if re.fullmatch(
        r"\s*\d+\s*\+\s*\d+\s*",
        value
    ):
        return True

    return False


def build_evidence_sentence(
    evidence: dict
) -> str:

    label = clean_text(
        evidence.get(
            "label",
            ""
        )
    )

    value = speech_number(
        evidence.get(
            "value",
            ""
        )
    )

    detail = clean_text(
        evidence.get(
            "detail",
            ""
        )
    )

    return clean_text(
        f"{label}, "
        f"{value} "
        f"{detail}."
    )


def get_narratable_evidence(
    selection: dict
) -> list:

    result = []

    for evidence in selection.get(
        "evidence",
        []
    ):

        if is_low_value_technical_evidence(
            evidence
        ):
            continue

        result.append(
            evidence
        )

    return result


def build_selection_narration(
    ordinal_text: str,
    selection: dict
) -> str:

    market = speech_market(
        selection["market"]
    )

    percentage = speech_number(
        selection["percentage"]
    )

    parts = [
        (
            f"{ordinal_text}, "
            f"{market}, "
            f"con "
            f"{percentage} "
            f"por ciento de respaldo individual."
        )
    ]

    evidence_list = (
        get_narratable_evidence(
            selection
        )
    )

    for evidence in evidence_list:
        parts.append(
            build_evidence_sentence(
                evidence
            )
        )

    if not evidence_list:
        parts.append(
            "Este mercado también aparece con respaldo estadístico "
            "dentro del análisis de DataFut."
        )

    return clean_text(
        " ".join(
            parts
        )
    )


def parse_srt_timestamp(
    timestamp: str
) -> float:

    hours, minutes, rest = (
        timestamp.split(
            ":"
        )
    )

    seconds, milliseconds = (
        rest.split(
            ","
        )
    )

    return (
        int(hours) * 3600
        +
        int(minutes) * 60
        +
        int(seconds)
        +
        int(milliseconds) / 1000
    )


def get_srt_duration(
    srt_path: Path
) -> float:

    content = (
        srt_path.read_text(
            encoding="utf-8"
        )
    )

    timestamps = re.findall(
        r"\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+"
        r"(\d{2}:\d{2}:\d{2},\d{3})",
        content
    )

    if not timestamps:
        raise RuntimeError(
            f"No se encontraron timestamps en {srt_path}"
        )

    return parse_srt_timestamp(
        timestamps[-1]
    )


def generate_tts(
    text: str,
    mp3_path: Path,
    srt_path: Path
):

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

    ensure_file_exists(
        mp3_path,
        "audio generado"
    )

    ensure_file_exists(
        srt_path,
        "subtítulos generados"
    )


# ============================================================
# CARGAR DATOS
# ============================================================

ensure_file_exists(
    DATA_FILE,
    "combinada-data.json"
)

validation = subprocess.run(
    ["node", "scripts/validate-certified-content.js", "combinada-data.json"],
    cwd=PROJECT_DIR,
    capture_output=True,
    text=True,
)
if validation.returncode != 0:
    raise RuntimeError(
        "VOZ BLOQUEADA: combinada-data.json no tiene procedencia certificada.\n"
        + validation.stdout
        + validation.stderr
    )

with DATA_FILE.open(
    "r",
    encoding="utf-8"
) as file:

    data = json.load(
        file
    )


# ============================================================
# VALIDACIÓN
# ============================================================

required_root_fields = [
    "homeTeam",
    "awayTeam",
    "league",
    "selections",
    "probabilityNotice",
    "disclaimer"
]


for field in required_root_fields:

    if field not in data:
        raise ValueError(
            f"Falta el campo obligatorio: {field}"
        )


selections = data.get(
    "selections"
)


if (
    not isinstance(
        selections,
        list
    )
    or
    len(selections) not in (
        2,
        3
    )
):
    raise ValueError(
        "combinada-data.json debe contener 2 o 3 selecciones."
    )


for index, selection in enumerate(
    selections,
    start=1
):

    required_selection_fields = [
        "market",
        "percentage",
        "evidence"
    ]

    for field in required_selection_fields:

        if field not in selection:
            raise ValueError(
                f"Selección {index}: falta {field}"
            )

    if (
        not isinstance(
            selection["percentage"],
            (int, float)
        )
    ):
        raise ValueError(
            f"Selección {index}: percentage debe ser número."
        )

    if (
        not isinstance(
            selection["evidence"],
            list
        )
    ):
        raise ValueError(
            f"Selección {index}: evidence debe ser una lista."
        )


# ============================================================
# VARIABLES
# ============================================================

home_team = clean_text(
    data["homeTeam"]
)

away_team = clean_text(
    data["awayTeam"]
)


# ============================================================
# GUION
# ============================================================

intro_text = clean_text(
    " ".join(
        [
            "Combinada del partido.",
            f"{home_team} contra {away_team}.",
            "Estos mercados tienen respaldo estadístico individual."
        ]
    )
)


selection_blocks = []


ordinal_words = [
    "Primera selección",
    "Segunda selección",
    "Tercera selección"
]


for index, selection in enumerate(
    selections
):

    selection_blocks.append(
        {
            "id":
                f"selection{index + 1}",

            "filename":
                f"{index + 2:02d}-selection-{index + 1}",

            "text":
                build_selection_narration(
                    ordinal_words[index],
                    selection
                )
        }
    )


# ============================================================
# AVISO DE PROBABILIDAD
#
# Se construye con join() para forzar explícitamente
# un espacio entre cada oración.
# ============================================================

notice_sentences = [
    "Importante: los porcentajes corresponden al respaldo individual de cada mercado.",
    "No representan la probabilidad conjunta de que toda la combinada se cumpla."
]

notice_text = clean_text(
    " ".join(
        notice_sentences
    )
)


outro_text = clean_text(
    " ".join(
        [
            "Estas estimaciones se basan en estadísticas históricas y no garantizan resultados.",
            "Consulta cada mercado y su análisis completo en Data Fut."
        ]
    )
)


blocks = [
    {
        "id":
            "intro",

        "filename":
            "01-intro",

        "text":
            intro_text
    },

    *selection_blocks,

    {
        "id":
            "notice",

        "filename":
            f"{len(selections) + 2:02d}-notice",

        "text":
            notice_text
    },

    {
        "id":
            "outro",

        "filename":
            f"{len(selections) + 3:02d}-outro",

        "text":
            outro_text
    }
]


# ============================================================
# VALIDACIÓN EXTRA DEL GUION
# ============================================================

if "Norepresentan" in notice_text:
    raise RuntimeError(
        'Error interno: se detectó "Norepresentan" sin espacio.'
    )

if "No representan" not in notice_text:
    raise RuntimeError(
        'Error interno: el aviso no contiene "No representan".'
    )


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
# GUARDAR NARRATION.TXT
# ============================================================

full_script = "\n\n".join(
    block["text"]
    for block in blocks
)


narration_path = (
    OUTPUT_DIR
    / "narration.txt"
)


narration_path.write_text(
    full_script,
    encoding="utf-8"
)


# ============================================================
# GENERAR AUDIO + SRT
# ============================================================

timeline = []

current_start = 0.0

transition_padding = 0.35


for block in blocks:

    mp3_path = (
        OUTPUT_DIR
        / f"{block['filename']}.mp3"
    )

    srt_path = (
        OUTPUT_DIR
        / f"{block['filename']}.srt"
    )

    generate_tts(
        block["text"],
        mp3_path,
        srt_path
    )

    duration = (
        get_srt_duration(
            srt_path
        )
    )

    start_time = (
        current_start
    )

    end_time = (
        start_time
        +
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
        end_time
        +
        transition_padding
    )


# ============================================================
# DURACIÓN
# ============================================================

total_audio_duration = (
    timeline[-1]["endSeconds"]
)


video_end_padding = 1.0


total_video_duration = (
    total_audio_duration
    +
    video_end_padding
)


# ============================================================
# MANIFEST
# ============================================================

manifest = {
    "format":
        "combinada-del-partido",

    "voice":
        VOICE,

    "rate":
        RATE,

    "sourceData":
        "combinada-data.json",

    "selectionCount":
        len(
            selections
        ),

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
    OUTPUT_DIR
    / "narration-manifest.json"
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
print(" DATAFUT COMBINADA VOICE READY")
print("========================================")
print("")

print(
    f"Partido: {home_team} vs {away_team}"
)

print(
    f"Selecciones: {len(selections)}"
)

print(
    f"Voz: {VOICE}"
)

print(
    f"Velocidad: {RATE}"
)

print("")


for index, selection in enumerate(
    selections,
    start=1
):

    print(
        f"Selección {index}: "
        f"{selection['market']} — "
        f"{selection['percentage']}%"
    )


print("")
print("Timeline:")
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
    "Duración narración: "
    f"{total_audio_duration:.2f}s"
)

print(
    "Duración video sugerida: "
    f"{total_video_duration:.2f}s"
)

print("")
print("Guion:")
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
    f"Carpeta: {OUTPUT_DIR}"
)

print("")
