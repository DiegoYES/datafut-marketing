import json
import math
import random
import struct
import wave
from pathlib import Path


# ============================================================
# CONFIGURACIÓN GENERAL
# ============================================================

PROJECT_DIR = Path(__file__).resolve().parent

MANIFEST_PATH = (
    PROJECT_DIR
    / "parlay-audio"
    / "narration-manifest.json"
)

SAMPLE_RATE = 44100

CHANNELS = 2

SAMPLE_WIDTH = 2

SEED = 42


# ============================================================
# PRESETS
# ============================================================

PRESETS = {
    "analysis": {
        "filename": "datafut-music-analysis.wav",

        "bpm": 102,

        "master_volume": 0.40,

        "kick_volume": 0.42,

        "snare_volume": 0.10,

        "hihat_volume": 0.035,

        "bass_volume": 0.16,

        "pad_volume": 0.16,

        "pulse_volume": 0.035,

        "arp_volume": 0.025,

        "tension_volume": 0.00,

        "description":
            "Electrónica sobria y limpia para análisis individual."
    },

    "energy": {
        "filename": "datafut-music-energy.wav",

        "bpm": 116,

        "master_volume": 0.45,

        "kick_volume": 0.62,

        "snare_volume": 0.18,

        "hihat_volume": 0.070,

        "bass_volume": 0.25,

        "pad_volume": 0.095,

        "pulse_volume": 0.075,

        "arp_volume": 0.055,

        "tension_volume": 0.00,

        "description":
            "Base sport-tech más movida para parlays y contenido dinámico."
    },

    "tension": {
        "filename": "datafut-music-tension.wav",

        "bpm": 96,

        "master_volume": 0.42,

        "kick_volume": 0.42,

        "snare_volume": 0.085,

        "hihat_volume": 0.028,

        "bass_volume": 0.23,

        "pad_volume": 0.13,

        "pulse_volume": 0.028,

        "arp_volume": 0.018,

        "tension_volume": 0.10,

        "description":
            "Base oscura y de suspenso para picks cerrados o combinadas."
    }
}


# ============================================================
# PROGRESIONES
# ============================================================

ANALYSIS_CHORDS = [
    [57, 60, 64],   # Am
    [53, 57, 60],   # F
    [48, 52, 55],   # C
    [55, 59, 62]    # G
]

ANALYSIS_BASS = [
    33,
    29,
    36,
    31
]


ENERGY_CHORDS = [
    [57, 60, 64],   # Am
    [55, 59, 62],   # G
    [53, 57, 60],   # F
    [55, 59, 62]    # G
]

ENERGY_BASS = [
    33,
    31,
    29,
    31
]


TENSION_CHORDS = [
    [45, 48, 52],   # Am grave
    [44, 48, 51],   # G# / tensión
    [41, 45, 48],   # F
    [43, 47, 50]    # G
]

TENSION_BASS = [
    33,
    32,
    29,
    31
]


# ============================================================
# UTILIDADES
# ============================================================

def clamp(
    value,
    minimum=-1.0,
    maximum=1.0
):
    return max(
        minimum,
        min(
            maximum,
            value
        )
    )


def soft_clip(value):
    return math.tanh(
        value * 1.25
    ) / math.tanh(1.25)


def midi_to_frequency(note):
    return (
        440.0
        *
        (
            2.0 **
            (
                (note - 69)
                /
                12.0
            )
        )
    )


def envelope(
    time_in_note,
    note_duration,
    attack=0.01,
    release=0.08
):

    if time_in_note < 0:
        return 0.0

    if time_in_note >= note_duration:
        return 0.0

    if time_in_note < attack:
        return (
            time_in_note
            /
            max(
                attack,
                0.0001
            )
        )

    release_start = (
        note_duration
        -
        release
    )

    if time_in_note > release_start:
        return max(
            0.0,
            (
                note_duration
                -
                time_in_note
            )
            /
            max(
                release,
                0.0001
            )
        )

    return 1.0


def sine_wave(
    frequency,
    time_value
):
    return math.sin(
        2.0
        *
        math.pi
        *
        frequency
        *
        time_value
    )


def triangle_wave(
    frequency,
    time_value
):

    phase = (
        frequency
        *
        time_value
    ) % 1.0

    return (
        4.0
        *
        abs(
            phase
            -
            0.5
        )
        -
        1.0
    )


def fade_gain(
    current_time,
    total_duration
):

    fade_in_duration = 1.5

    fade_out_duration = 2.2

    gain = 1.0

    if current_time < fade_in_duration:
        gain *= (
            current_time
            /
            fade_in_duration
        )

    fade_out_start = (
        total_duration
        -
        fade_out_duration
    )

    if current_time > fade_out_start:
        gain *= max(
            0.0,
            (
                total_duration
                -
                current_time
            )
            /
            fade_out_duration
        )

    return gain


# ============================================================
# GENERADOR DE RUIDO DETERMINISTA
# ============================================================

def noise_sample(
    frame_index,
    salt=0
):
    """
    Ruido pseudoaleatorio determinista.

    Así cada pista suena igual cada vez que se genera,
    pero sigue teniendo ruido suficiente para percusión.
    """

    value = (
        frame_index
        * 1103515245
        +
        12345
        +
        salt
        * 2654435761
    )

    value &= 0x7FFFFFFF

    normalized = (
        value
        /
        0x7FFFFFFF
    )

    return (
        normalized
        * 2.0
        -
        1.0
    )


# ============================================================
# INSTRUMENTOS
# ============================================================

def kick_sound(
    time_since_hit,
    frame_index
):

    if (
        time_since_hit < 0
        or
        time_since_hit > 0.38
    ):
        return 0.0

    decay = math.exp(
        -time_since_hit
        * 10.5
    )

    frequency = (
        110.0
        *
        math.exp(
            -time_since_hit
            * 18.0
        )
        +
        42.0
    )

    body = sine_wave(
        frequency,
        time_since_hit
    )

    click = (
        noise_sample(
            frame_index,
            1
        )
        *
        math.exp(
            -time_since_hit
            * 70.0
        )
    )

    return (
        body * 0.92
        +
        click * 0.08
    ) * decay


def snare_sound(
    time_since_hit,
    frame_index
):

    if (
        time_since_hit < 0
        or
        time_since_hit > 0.30
    ):
        return 0.0

    noise = noise_sample(
        frame_index,
        2
    )

    tonal = sine_wave(
        180.0,
        time_since_hit
    )

    decay = math.exp(
        -time_since_hit
        * 15.0
    )

    return (
        noise * 0.80
        +
        tonal * 0.20
    ) * decay


def hihat_sound(
    time_since_hit,
    frame_index
):

    if (
        time_since_hit < 0
        or
        time_since_hit > 0.085
    ):
        return 0.0

    noise = noise_sample(
        frame_index,
        3
    )

    decay = math.exp(
        -time_since_hit
        * 46.0
    )

    return (
        noise
        *
        decay
    )


def bass_sound(
    frequency,
    time_since_note,
    note_duration
):

    env = envelope(
        time_since_note,
        note_duration,
        attack=0.015,
        release=0.12
    )

    fundamental = sine_wave(
        frequency,
        time_since_note
    )

    harmonic = triangle_wave(
        frequency * 2.0,
        time_since_note
    )

    return (
        fundamental * 0.82
        +
        harmonic * 0.18
    ) * env


def pad_sound(
    chord_notes,
    time_value,
    bar_phase
):

    value = 0.0

    for note in chord_notes:

        frequency = midi_to_frequency(
            note
        )

        fundamental = sine_wave(
            frequency,
            time_value
        )

        octave = sine_wave(
            frequency * 2.0,
            time_value
        )

        value += (
            fundamental * 0.78
            +
            octave * 0.22
        )

    value /= max(
        len(chord_notes),
        1
    )

    movement = (
        0.72
        +
        0.28
        *
        math.sin(
            2.0
            *
            math.pi
            *
            bar_phase
        )
    )

    return (
        value
        *
        movement
    )


def pulse_sound(
    frequency,
    time_since_note,
    note_duration
):

    env = envelope(
        time_since_note,
        note_duration,
        attack=0.005,
        release=0.07
    )

    sine = sine_wave(
        frequency,
        time_since_note
    )

    triangle = triangle_wave(
        frequency,
        time_since_note
    )

    return (
        sine * 0.55
        +
        triangle * 0.45
    ) * env


def arpeggio_sound(
    frequency,
    time_since_note,
    note_duration
):

    env = envelope(
        time_since_note,
        note_duration,
        attack=0.004,
        release=0.055
    )

    main = triangle_wave(
        frequency,
        time_since_note
    )

    high = sine_wave(
        frequency * 2.0,
        time_since_note
    )

    return (
        main * 0.70
        +
        high * 0.30
    ) * env


def tension_drone(
    root_frequency,
    time_value
):

    fundamental = sine_wave(
        root_frequency,
        time_value
    )

    fifth = sine_wave(
        root_frequency * 1.5,
        time_value
    )

    detuned = sine_wave(
        root_frequency * 1.007,
        time_value
    )

    slow_motion = (
        0.72
        +
        0.28
        *
        math.sin(
            2.0
            *
            math.pi
            *
            0.12
            *
            time_value
        )
    )

    return (
        (
            fundamental * 0.48
            +
            fifth * 0.22
            +
            detuned * 0.30
        )
        *
        slow_motion
    )


# ============================================================
# CONFIGURACIÓN MUSICAL SEGÚN PRESET
# ============================================================

def get_music_configuration(
    preset_name
):

    if preset_name == "analysis":
        return (
            ANALYSIS_CHORDS,
            ANALYSIS_BASS
        )

    if preset_name == "energy":
        return (
            ENERGY_CHORDS,
            ENERGY_BASS
        )

    if preset_name == "tension":
        return (
            TENSION_CHORDS,
            TENSION_BASS
        )

    raise ValueError(
        f"Preset desconocido: {preset_name}"
    )


# ============================================================
# GENERACIÓN DE SAMPLE
# ============================================================

def generate_sample(
    preset_name,
    preset,
    current_time,
    total_duration,
    frame_index
):

    bpm = preset["bpm"]

    seconds_per_beat = (
        60.0
        /
        bpm
    )

    beats_per_bar = 4

    seconds_per_bar = (
        seconds_per_beat
        *
        beats_per_bar
    )

    chords, bass_roots = (
        get_music_configuration(
            preset_name
        )
    )

    beat_position = (
        current_time
        /
        seconds_per_beat
    )

    current_beat = int(
        beat_position
    )

    beat_phase = (
        beat_position
        -
        current_beat
    )

    current_bar = int(
        current_beat
        /
        beats_per_bar
    )

    beat_in_bar = (
        current_beat
        %
        beats_per_bar
    )

    bar_phase = (
        (
            current_time
            %
            seconds_per_bar
        )
        /
        seconds_per_bar
    )

    chord_index = (
        current_bar
        %
        len(chords)
    )

    current_chord = (
        chords[
            chord_index
        ]
    )

    bass_root = (
        bass_roots[
            chord_index
        ]
    )

    # ========================================================
    # KICK
    # ========================================================

    kick = 0.0

    if preset_name == "energy":

        kick_beats = (
            0,
            1,
            2,
            3
        )

    elif preset_name == "tension":

        kick_beats = (
            0,
            2
        )

    else:

        kick_beats = (
            0,
            2
        )

    if beat_in_bar in kick_beats:

        kick_time = (
            beat_phase
            *
            seconds_per_beat
        )

        kick = kick_sound(
            kick_time,
            frame_index
        )

    # ========================================================
    # SNARE
    # ========================================================

    snare = 0.0

    if beat_in_bar in (
        1,
        3
    ):

        snare_time = (
            beat_phase
            *
            seconds_per_beat
        )

        snare = snare_sound(
            snare_time,
            frame_index
        )

    # ========================================================
    # HI-HAT
    # ========================================================

    if preset_name == "energy":

        hihat_division = 4

    else:

        hihat_division = 2

    hihat_step_duration = (
        seconds_per_beat
        /
        hihat_division
    )

    hihat_position = (
        current_time
        /
        hihat_step_duration
    )

    hihat_phase = (
        hihat_position
        -
        int(
            hihat_position
        )
    )

    hihat_time = (
        hihat_phase
        *
        hihat_step_duration
    )

    hihat = hihat_sound(
        hihat_time,
        frame_index
    )

    # ========================================================
    # BASS
    # ========================================================

    bass_note_duration = (
        seconds_per_beat
        *
        (
            0.72
            if preset_name == "energy"
            else 0.84
        )
    )

    bass_time = (
        beat_phase
        *
        seconds_per_beat
    )

    bass_frequency = (
        midi_to_frequency(
            bass_root
        )
    )

    bass = bass_sound(
        bass_frequency,
        bass_time,
        bass_note_duration
    )

    # ========================================================
    # PAD
    # ========================================================

    pad = pad_sound(
        current_chord,
        current_time,
        bar_phase
    )

    # ========================================================
    # PULSE
    # ========================================================

    pulse = 0.0

    if beat_phase >= 0.50:

        shifted_time = (
            (
                beat_phase
                -
                0.50
            )
            *
            seconds_per_beat
        )

        pulse_note = (
            current_chord[
                current_beat
                %
                len(
                    current_chord
                )
            ]
            +
            12
        )

        pulse_frequency = (
            midi_to_frequency(
                pulse_note
            )
        )

        pulse = pulse_sound(
            pulse_frequency,
            shifted_time,
            seconds_per_beat * 0.24
        )

    # ========================================================
    # ARPEGGIO
    # ========================================================

    arp = 0.0

    arp_step_duration = (
        seconds_per_beat
        /
        2.0
    )

    arp_position = (
        current_time
        /
        arp_step_duration
    )

    arp_step = int(
        arp_position
    )

    arp_phase = (
        arp_position
        -
        arp_step
    )

    arp_time = (
        arp_phase
        *
        arp_step_duration
    )

    arp_note = (
        current_chord[
            arp_step
            %
            len(
                current_chord
            )
        ]
        +
        12
    )

    arp_frequency = (
        midi_to_frequency(
            arp_note
        )
    )

    arp = arpeggio_sound(
        arp_frequency,
        arp_time,
        arp_step_duration * 0.70
    )

    # ========================================================
    # TENSION DRONE
    # ========================================================

    drone = 0.0

    if preset_name == "tension":

        drone_frequency = (
            midi_to_frequency(
                bass_root
            )
        )

        drone = tension_drone(
            drone_frequency,
            current_time
        )

    # ========================================================
    # MEZCLA
    # ========================================================

    mix = (
        kick
        *
        preset["kick_volume"]

        +

        snare
        *
        preset["snare_volume"]

        +

        hihat
        *
        preset["hihat_volume"]

        +

        bass
        *
        preset["bass_volume"]

        +

        pad
        *
        preset["pad_volume"]

        +

        pulse
        *
        preset["pulse_volume"]

        +

        arp
        *
        preset["arp_volume"]

        +

        drone
        *
        preset["tension_volume"]
    )

    # ========================================================
    # SIDECHAIN SIMULADO
    # ========================================================

    sidechain = (
        1.0
        -
        min(
            abs(kick)
            *
            (
                0.22
                if preset_name == "energy"
                else 0.14
            ),
            0.22
        )
    )

    mix *= sidechain

    # ========================================================
    # FADE GLOBAL
    # ========================================================

    mix *= fade_gain(
        current_time,
        total_duration
    )

    mix *= (
        preset[
            "master_volume"
        ]
    )

    mix = soft_clip(
        mix
    )

    return clamp(
        mix
    )


# ============================================================
# GENERAR UNA PISTA
# ============================================================

def generate_track(
    preset_name,
    preset,
    duration_seconds
):

    output_path = (
        PROJECT_DIR
        /
        preset["filename"]
    )

    total_frames = int(
        duration_seconds
        *
        SAMPLE_RATE
    )

    print("")
    print("----------------------------------------")
    print(
        f"Generando preset: {preset_name.upper()}"
    )
    print("----------------------------------------")

    print(
        f"Archivo: {output_path.name}"
    )

    print(
        f"BPM: {preset['bpm']}"
    )

    print(
        preset["description"]
    )

    print("")

    with wave.open(
        str(
            output_path
        ),
        "wb"
    ) as wav_file:

        wav_file.setnchannels(
            CHANNELS
        )

        wav_file.setsampwidth(
            SAMPLE_WIDTH
        )

        wav_file.setframerate(
            SAMPLE_RATE
        )

        chunk_size = 4096

        frame_index = 0

        next_progress_report = 10

        while (
            frame_index
            <
            total_frames
        ):

            frames_to_generate = min(
                chunk_size,
                total_frames
                -
                frame_index
            )

            frame_buffer = (
                bytearray()
            )

            for offset in range(
                frames_to_generate
            ):

                absolute_frame = (
                    frame_index
                    +
                    offset
                )

                current_time = (
                    absolute_frame
                    /
                    SAMPLE_RATE
                )

                sample = generate_sample(
                    preset_name,
                    preset,
                    current_time,
                    duration_seconds,
                    absolute_frame
                )

                # Estéreo sutil.
                left = (
                    sample
                    *
                    0.995
                )

                right = (
                    sample
                    *
                    0.985
                )

                left_int = int(
                    clamp(
                        left
                    )
                    *
                    32767
                )

                right_int = int(
                    clamp(
                        right
                    )
                    *
                    32767
                )

                frame_buffer.extend(
                    struct.pack(
                        "<hh",
                        left_int,
                        right_int
                    )
                )

            wav_file.writeframes(
                frame_buffer
            )

            frame_index += (
                frames_to_generate
            )

            progress = (
                frame_index
                /
                total_frames
                *
                100.0
            )

            if (
                progress
                >=
                next_progress_report
            ):

                print(
                    f"{next_progress_report}%"
                )

                next_progress_report += 10

    size_mb = (
        output_path
        .stat()
        .st_size
        /
        (
            1024
            *
            1024
        )
    )

    print("")

    print(
        f"Listo: {output_path.name}"
    )

    print(
        f"Tamaño: {size_mb:.2f} MB"
    )

    return {
        "preset":
            preset_name,

        "file":
            output_path.name,

        "bpm":
            preset["bpm"],

        "description":
            preset["description"],

        "durationSeconds":
            round(
                duration_seconds,
                3
            ),

        "sizeMb":
            round(
                size_mb,
                2
            )
    }


# ============================================================
# LEER MANIFEST
# ============================================================

if not MANIFEST_PATH.exists():

    raise FileNotFoundError(
        "No existe narration-manifest.json en: "
        f"{MANIFEST_PATH}"
    )


with MANIFEST_PATH.open(
    "r",
    encoding="utf-8"
) as file:

    manifest = json.load(
        file
    )


duration_seconds = (
    manifest.get(
        "totalVideoDurationSeconds"
    )
)


if (
    not isinstance(
        duration_seconds,
        (
            int,
            float
        )
    )
    or
    duration_seconds <= 0
):

    raise ValueError(
        "totalVideoDurationSeconds no es válido."
    )


duration_seconds = float(
    duration_seconds
)


# ============================================================
# GENERACIÓN
# ============================================================

random.seed(
    SEED
)


print("")
print("========================================")
print(" DATAFUT MUSIC PRESET GENERATOR")
print("========================================")
print("")

print(
    f"Duración objetivo: {duration_seconds:.2f}s"
)

print(
    f"Sample rate: {SAMPLE_RATE} Hz"
)

print("")

print(
    "Se generarán 3 pistas:"
)

print(
    "  1. ANALYSIS"
)

print(
    "  2. ENERGY"
)

print(
    "  3. TENSION"
)

print("")


generated_tracks = []


for preset_name, preset in PRESETS.items():

    generated_track = (
        generate_track(
            preset_name,
            preset,
            duration_seconds
        )
    )

    generated_tracks.append(
        generated_track
    )


# ============================================================
# MANIFEST DE MÚSICA
# ============================================================

music_manifest = {
    "sourceNarrationManifest":
        str(
            MANIFEST_PATH.name
        ),

    "durationSeconds":
        round(
            duration_seconds,
            3
        ),

    "sampleRate":
        SAMPLE_RATE,

    "tracks":
        generated_tracks
}


music_manifest_path = (
    PROJECT_DIR
    /
    "datafut-music-manifest.json"
)


music_manifest_path.write_text(
    json.dumps(
        music_manifest,
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
print(" DATAFUT MUSIC PRESETS READY")
print("========================================")
print("")

for track in generated_tracks:

    print(
        f"{track['preset'].upper()}:"
    )

    print(
        f"  {track['file']}"
    )

    print(
        f"  BPM: {track['bpm']}"
    )

    print(
        f"  {track['description']}"
    )

    print("")


print(
    "Manifest:"
)

print(
    f"  {music_manifest_path.name}"
)

print("")

print(
    "Escucha las tres pistas antes de integrarlas al Reel."
)

print("")