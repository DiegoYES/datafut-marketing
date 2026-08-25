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

DATA_FILE = PROJECT_DIR / "promo-data.json"

OUTPUT_DIR = PROJECT_DIR / "promo-audio"

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


def clean_text(text: str) -> str:
    return re.sub(
        r"\s+",
        " ",
        str(text)
    ).strip()


def speech_number(value) -> str:
    """
    Convierte números y porcentajes a texto
    más natural para Edge TTS.

    73.1
    ->
    73 punto 1

    0.11
    ->
    0 punto 11
    """

    text = str(
        value
    ).strip()

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

    return text


def build_evidence_sentence(
    evidence: dict
) -> str:

    team = clean_text(
        evidence.get(
            "team",
            ""
        )
    )

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

    if team:
        return clean_text(
            f"{team}: "
            f"{value} "
            f"{label.lower()}."
        )

    return clean_text(
        f"{value} "
        f"{label.lower()}."
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
# CARGAR PROMO DATA
# ============================================================

ensure_file_exists(
    DATA_FILE,
    "promo-data.json"
)

validation = subprocess.run(
    ["node", "scripts/validate-certified-content.js", "promo-data.json"],
    cwd=PROJECT_DIR,
    capture_output=True,
    text=True,
)
if validation.returncode != 0:
    raise RuntimeError(
        "VOZ BLOQUEADA: promo-data.json no tiene procedencia certificada.\n"
        + validation.stdout
        + validation.stderr
    )

with DATA_FILE.open(
    "r",
    encoding="utf-8"
) as file:

    promo_data = json.load(
        file
    )


# ============================================================
# VALIDACIÓN
# ============================================================

required_fields = [
    "homeTeam",
    "awayTeam",
    "market",
    "percentage",
    "evidence"
]


for field in required_fields:

    if field not in promo_data:

        raise ValueError(
            f"Falta el campo obligatorio: {field}"
        )


evidence = promo_data.get(
    "evidence"
)


if (
    not isinstance(
        evidence,
        list
    )
    or
    len(evidence) != 2
):

    raise ValueError(
        "promo-data.json debe contener exactamente 2 evidencias."
    )


# ============================================================
# VARIABLES
# ============================================================

home_team = clean_text(
    promo_data[
        "homeTeam"
    ]
)

away_team = clean_text(
    promo_data[
        "awayTeam"
    ]
)

market = speech_market(
    promo_data[
        "market"
    ]
)

percentage = speech_number(
    promo_data[
        "percentage"
    ]
)


# ============================================================
# GUION
# ============================================================

intro_text = (
    f"Ojo con este partido. "
    f"{home_team} contra {away_team}."
)


market_text = (
    f"DataFut detecta "
    f"{percentage} por ciento de respaldo "
    f"para {market}."
)


evidence_text = (
    f"Los datos que respaldan la tendencia: "
    f"{build_evidence_sentence(evidence[0])} "
    f"{build_evidence_sentence(evidence[1])}"
)


outro_text = (
    "Son estimaciones basadas en estadísticas históricas "
    "y no garantizan resultados. "
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
            "market",

        "filename":
            "02-market",

        "text":
            clean_text(
                market_text
            )
    },

    {
        "id":
            "evidence",

        "filename":
            "03-evidence",

        "text":
            clean_text(
                evidence_text
            )
    },

    {
        "id":
            "outro",

        "filename":
            "04-outro",

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
# NARRATION.TXT
# ============================================================

full_script = "\n\n".join(
    block["text"]
    for block in blocks
)


narration_path = (
    OUTPUT_DIR /
    "narration.txt"
)


narration_path.write_text(
    full_script,
    encoding="utf-8"
)


# ============================================================
# GENERAR BLOQUES
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
    timeline[-1][
        "endSeconds"
    ]
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
        "ojo-con-este-partido",

    "voice":
        VOICE,

    "rate":
        RATE,

    "sourceData":
        "promo-data.json",

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
print(" DATAFUT PROMO VOICE READY")
print("========================================")
print("")

print(
    f"Partido: {home_team} vs {away_team}"
)

print(
    f"Mercado: {promo_data['market']}"
)

print(
    f"Respaldo: {promo_data['percentage']}%"
)

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
    "Duración narración: "
    f"{total_audio_duration:.2f}s"
)

print(
    "Duración video sugerida: "
    f"{total_video_duration:.2f}s"
)

print("")

print(
    "Guion:"
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
    f"Carpeta: {OUTPUT_DIR}"
)

print("")
