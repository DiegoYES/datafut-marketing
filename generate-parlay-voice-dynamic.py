import json
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
DATA_FILE = PROJECT_DIR / "parlay-data.json"
OUTPUT_DIR = PROJECT_DIR / "parlay-audio"
VOICE = "es-MX-JorgeNeural"
RATE = "+11%"
# Fallback local cuando Edge TTS esta caido (403): Piper neural local.
PIPER_VOICE = "piper-es_MX-claude-high"
PIPER_RATE = "+0%"
PIPER_MODEL = Path(sys.argv[sys.argv.index("--piper-model") + 1]) if "--piper-model" in sys.argv else (PROJECT_DIR / "piper-voices" / "es_MX-claude-high.onnx")
ENGINE = sys.argv[sys.argv.index("--engine") + 1] if "--engine" in sys.argv else "auto"  # auto|edge|piper

def ensure_file_exists(path: Path, description: str):
    if not path.exists():
        raise FileNotFoundError(f"No existe {description}: {path}")

def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text)).strip()

def speech_number(value) -> str:
    text = str(value).strip()
    text = text.replace("%", " por ciento")
    text = re.sub(r"(-?\d+)\.(\d+)", r"\1 punto \2", text)
    return clean_text(text)

def speech_market(market: str) -> str:
    text = market.strip().lower()
    text = re.sub(r"(\d+)\.(\d+)", r"\1 punto \2", text)
    replacements = {
        "más de": "Más de",
        "menos de": "Menos de",
        "córners totales": "tiros de esquina totales",
        "córners": "tiros de esquina",
        "tarjetas amarillas totales": "tarjetas amarillas totales",
        "tarjetas registradas totales": "tarjetas registradas totales"
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    return clean_text(text)

def parse_srt_timestamp(timestamp: str) -> float:
    hours, minutes, rest = timestamp.split(":")
    seconds, milliseconds = rest.split(",")
    return (
        int(hours) * 3600
        + int(minutes) * 60
        + int(seconds)
        + int(milliseconds) / 1000.0
    )

def get_srt_duration(srt_path: Path) -> float:
    content = srt_path.read_text(encoding="utf-8")
    timestamps = re.findall(
        r"\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})",
        content
    )
    if not timestamps:
        raise RuntimeError(f"No se pudieron encontrar timestamps en {srt_path}")
    return parse_srt_timestamp(timestamps[-1])

def is_low_value_technical_evidence(evidence: dict) -> bool:
    label = str(evidence.get("label", "")).lower()
    detail = str(evidence.get("detail", "")).lower()
    haystack = f"{label} {detail}"
    return any(w in haystack for w in ["muestra", "cobertura", "analizados", "fuentes"])

def build_pick_narration(prefix: str, pick: dict) -> str:
    home_team = clean_text(pick["homeTeam"])
    away_team = clean_text(pick["awayTeam"])
    market = speech_market(pick["market"])
    percentage = speech_number(pick["percentage"])

    parts = [
        f"{prefix}, {home_team} contra {away_team}.",
        f"{market}, con {percentage} por ciento de respaldo."
    ]

    for ev in pick.get("evidence", []):
        if is_low_value_technical_evidence(ev):
            continue
        label = clean_text(ev.get("label", ""))
        val = speech_number(ev.get("value", ""))
        det = clean_text(ev.get("detail", ""))
        parts.append(f"{label}, {val} {det}.")

    return clean_text(" ".join(parts))

def generate_tts(text: str, mp3_path: Path, srt_path: Path):
    cmd = [
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
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Edge TTS terminó con error: {res.stderr}")


def srt_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0.0
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(text: str, duration: float, srt_path: Path):
    # Subtitulos estimados: reparte la duracion real entre frases,
    # proporcional a su longitud (ritmo de Piper es uniforme).
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", text) if p.strip()]
    if not parts:
        parts = [text]
    chunks = []
    for p in parts:
        words = p.split()
        while len(words) > 12:
            chunks.append(" ".join(words[:12]))
            words = words[12:]
        chunks.append(" ".join(words))
    total_chars = sum(len(c) for c in chunks) or 1
    t = 0.0
    cues = []
    for i, c in enumerate(chunks):
        share = len(c) / total_chars
        end = duration if i == len(chunks) - 1 else t + duration * share
        cues.append(f"{i+1}\n{srt_timestamp(t)} --> {srt_timestamp(end)}\n{c}\n")
        t = end
    srt_path.write_text("\n".join(cues), encoding="utf-8")


def wav_duration(wav_path: Path) -> float:
    with wave.open(str(wav_path), "rb") as w:
        frames = w.getnframes()
        rate = w.getframerate()
        if not rate:
            raise RuntimeError(f"WAV sin framerate: {wav_path}")
        return frames / float(rate)


def generate_piper(text: str, wav_path: Path):
    if not PIPER_MODEL.exists():
        raise RuntimeError(
            f"Falta el modelo Piper: {PIPER_MODEL}. Descárgalo de "
            "https://huggingface.co/rhasspy/piper-voices (es/es_MX/claude/high) "
            "a la carpeta piper-voices/ del proyecto."
        )
    cmd = [
        sys.executable,
        "-m",
        "piper",
        "--model",
        str(PIPER_MODEL),
        "--output_file",
        str(wav_path),
    ]
    res = subprocess.run(cmd, input=text, capture_output=True, text=True)
    if res.returncode != 0 or not wav_path.exists():
        raise RuntimeError(f"Piper terminó con error: {res.stderr[-2000:]}")


def synth_block(text: str, filename: str):
    """Sintetiza un bloque con Edge (o Piper según ENGINE/auto) Bola.
    Devuelve (audio_filename, duracion_segundos, motor_usado)."""
    if ENGINE in ("edge", "auto"):
        mp3_path = OUTPUT_DIR / f"{filename}.mp3"
        srt_path = OUTPUT_DIR / f"{filename}.srt"
        try:
            generate_tts(text, mp3_path, srt_path)
            return mp3_path.name, get_srt_duration(srt_path), ("edge", VOICE, RATE)
        except RuntimeError as e:
            if ENGINE == "edge":
                raise
            print(f"  !! Edge fallo ({str(e)[:80]}...). Cambiando a Piper local.")
    wav_path = OUTPUT_DIR / f"{filename}.wav"
    generate_piper(text, wav_path)
    dur = wav_duration(wav_path)
    write_srt(text, dur, OUTPUT_DIR / f"{filename}.srt")
    return wav_path.name, dur, ("piper", PIPER_VOICE, PIPER_RATE)

ensure_file_exists(DATA_FILE, "parlay-data.json")

validation = subprocess.run(
    ["node", "scripts/validate-parlay-data.js", "parlay-data.json"],
    cwd=PROJECT_DIR,
    capture_output=True,
    text=True,
)
if validation.returncode != 0:
    raise RuntimeError(
        "VOZ BLOQUEADA: parlay-data.json no tiene procedencia certificada.\n"
        + validation.stdout
        + validation.stderr
    )

with DATA_FILE.open("r", encoding="utf-8") as f:
    parlay_data = json.load(f)

picks = parlay_data.get("picks", [])
if len(picks) not in (2, 3):
    raise ValueError(f"parlay-data.json debe tener 2 o 3 picks. Llegaron {len(picks)}.")

count_text = "Dos picks respaldados por los datos para hoy." if len(picks) == 2 else "Tres picks respaldados por los datos para hoy."
outro_text = (
    f"{'Dos selecciones' if len(picks) == 2 else 'Tres selecciones'} basadas en estadísticas históricas de DataFut. "
    "Estas estimaciones no garantizan resultados. Consulta el análisis completo en Data Fut."
)

blocks = [
    { "id": "intro", "filename": "01-intro", "text": clean_text(count_text) }
]

prefixes = ["Primero", "Y segundo"] if len(picks) == 2 else ["Primero", "Segundo", "Y tercero"]
for idx, pick in enumerate(picks):
    p_text = build_pick_narration(prefixes[idx], pick)
    blocks.append({
        "id": f"pick{idx+1}",
        "filename": f"0{idx+2}-pick-{idx+1}",
        "text": p_text
    })

blocks.append({
    "id": "outro",
    "filename": f"0{len(picks)+2}-outro",
    "text": clean_text(outro_text)
})

if OUTPUT_DIR.exists():
    shutil.rmtree(OUTPUT_DIR)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

timeline = []
current_time = 0.0
transition_padding = 0.35

print("\n========================================")
print(" GENERANDO NARRACIÓN PRECISA SIN SOLAPAMIENTO")
print("========================================\n")

for b in blocks:
    print(f"Generando TTS [{b['id']}]: {b['text'][:50]}...")
    audio_name, dur, used = synth_block(b["text"], b["filename"])
    if b["id"] == "intro":
        manifest_voice, manifest_rate = used[1], used[2]
        if used[0] == "piper":
            globals()["ENGINE"] = "piper"
        print(f"  Motor de voz: {used[0]} ({used[1]})")
    start_sec = current_time
    end_sec = start_sec + dur

    entry = {
        "id": b["id"],
        "audio": audio_name,
        "text": b["text"],
        "startSeconds": round(start_sec, 3),
        "durationSeconds": round(dur, 3),
        "endSeconds": round(end_sec, 3)
    }
    srt_guess = OUTPUT_DIR / f"{b['filename']}.srt"
    if srt_guess.exists():
        entry["subtitles"] = srt_guess.name
    timeline.append(entry)

    print(f"  -> Duración exacta: {dur:.2f}s (Inicia: {start_sec:.2f}s | Termina: {end_sec:.2f}s)")
    current_time = end_sec + transition_padding

total_audio_duration = timeline[-1]["endSeconds"] if timeline else 0.0
video_end_padding = 1.0
total_video_duration = total_audio_duration + video_end_padding

manifest = {
    "voice": manifest_voice,
    "rate": manifest_rate,
    "sourceData": "parlay-data.json",
    "blocks": timeline,
    "transitionPaddingSeconds": transition_padding,
    "videoEndPaddingSeconds": video_end_padding,
    "totalAudioDurationSeconds": round(total_audio_duration, 3),
    "totalVideoDurationSeconds": round(total_video_duration, 3)
}

with (OUTPUT_DIR / "narration-manifest.json").open("w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print(f"\nNarración completada. Audio total: {total_audio_duration:.2f}s | Video total: {total_video_duration:.2f}s\n")
