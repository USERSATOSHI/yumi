# Copyright 2022 David Scripka. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Hotword Detection WebSocket Server for Yumi

This server listens for wake words and broadcasts detection events
to connected WebSocket clients (like the deck PWA).

Usage:
    python server.py --host 0.0.0.0 --port 8765 --model_path ./hai_yoo_mee.onnx
"""

import asyncio
import json
import threading
import argparse
from datetime import datetime
from typing import Set


import pyaudio
import numpy as np
from openwakeword.model import Model
import requests
try:
    from vosk import Model as VoskModel, KaldiRecognizer
except ImportError:
    print("Please install vosk: pip install vosk")
    exit(1)

# WebSocket server
try:
    import websockets
    from websockets.server import serve, WebSocketServerProtocol
except ImportError:
    print("Please install websockets: pip install websockets")
    exit(1)

# Configuration
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8765
DETECTION_THRESHOLD = 0.5

COOLDOWN_SECONDS = 2.0  # Prevent multiple triggers in quick succession
STT_TIMEOUT_SECONDS = 2.5  # Silence timeout for end of speech
CORE_API_URL = "http://localhost:11000/api/speak"
CORE_API_SPEAKER = 47

# Audio settings
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
DEFAULT_CHUNK_SIZE = 1280

# Global state
connected_clients: Set[WebSocketServerProtocol] = set()
last_detection_time = 0.0
is_listening = True


class HotwordServer:
    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        model_path: str = "",
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        inference_framework: str = "onnx",
        threshold: float = DETECTION_THRESHOLD,
    ):
        self.host = host
        self.port = port
        self.model_path = model_path
        self.chunk_size = chunk_size
        self.inference_framework = inference_framework
        self.threshold = threshold
        self.last_detection_time = 0.0
        self.running = False
        self.oww_model = None
        self.audio = None
        self.mic_stream = None
        self.vosk_model = None
        self.recognizer = None
        self.mode = "hotword"  # or "stt"

    def init_audio(self):
        """Initialize PyAudio and microphone stream."""
        self.audio = pyaudio.PyAudio()
        self.mic_stream = self.audio.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=RATE,
            input=True,
            frames_per_buffer=self.chunk_size,
        )
        print(f"[Audio] Microphone stream initialized (chunk_size={self.chunk_size})")

    def init_model(self):
        """Load the OpenWakeWord model."""
        if self.model_path:
            self.oww_model = Model(
                wakeword_models=[self.model_path],
                inference_framework=self.inference_framework,
            )
            print(f"[Model] Loaded custom model: {self.model_path}")
        else:
            self.oww_model = Model()  # Do NOT pass inference_framework here
            print("[Model] Loaded default models")

        print(f"[Model] Available wake words: {list(self.oww_model.models.keys())}")
        # Load Vosk model for STT
        try:
            self.vosk_model = VoskModel("model/vosk-model-en-us-0.22-lgraph")  # expects ./model/vosk-model-en-us-0.22-lgraph directory with Vosk model
            self.recognizer = KaldiRecognizer(self.vosk_model, RATE)
            print("[STT] Vosk model loaded.")
        except Exception as e:
            print(f"[STT] Could not load Vosk model: {e}")
            self.vosk_model = None

    async def broadcast(self, message: dict):
        """Send message to all connected WebSocket clients."""
        if not connected_clients:
            return

        payload = json.dumps(message)
        disconnected = set()

        for client in connected_clients:
            try:
                await client.send(payload)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)

        # Clean up disconnected clients
        for client in disconnected:
            connected_clients.discard(client)

    async def handle_detection(self, model_name: str, score: float):
        """Handle a wake word detection event."""
        current_time = asyncio.get_event_loop().time()

        # Cooldown to prevent rapid-fire detections
        if current_time - self.last_detection_time < COOLDOWN_SECONDS:
            return

        self.last_detection_time = current_time

        event = {
            "type": "hotword_detected",
            "model": model_name,
            "score": round(score, 4),
            "timestamp": datetime.now().isoformat(),
            "action": "start_listening",
        }

        print(f"\n🎤 WAKE WORD DETECTED: {model_name} (score: {score:.4f})")
        print(f"   Broadcasting to {len(connected_clients)} client(s)...")

        await self.broadcast(event)
        # Switch to STT mode
        print("[MODE] Switching to STT mode")
        self.mode = "stt"

    def audio_loop(self, loop: asyncio.AbstractEventLoop):
        """Continuous audio capture and prediction loop (runs in separate thread)."""
        print("\n" + "#" * 60)
        print("🎧 Listening for wake words...")
        print("#" * 60 + "\n")

        silence_start = None
        last_mode = self.mode
        while self.running:
            try:
                audio_data = np.frombuffer(
                    self.mic_stream.read(self.chunk_size, exception_on_overflow=False),
                    dtype=np.int16,
                )

                if self.mode != last_mode:
                    print(f"[MODE] Switched to {self.mode.upper()} mode")
                    last_mode = self.mode

                if self.mode == "hotword":
                    prediction = self.oww_model.predict(audio_data)
                    for model_name in self.oww_model.prediction_buffer.keys():
                        scores = list(self.oww_model.prediction_buffer[model_name])
                        current_score = scores[-1]
                        if current_score > self.threshold:
                            asyncio.run_coroutine_threadsafe(
                                self.handle_detection(model_name, current_score), loop
                            )
                elif self.mode == "stt" and self.vosk_model:
                    if self.recognizer.AcceptWaveform(audio_data.tobytes()):
                        result = self.recognizer.Result()
                        text = json.loads(result).get("text", "").strip()
                        print(f"[STT] Vosk transcript: '{text}'")
                        if text:
                            print(f"[STT] Recognized: {text}")
                            # Send to deck and core
                            asyncio.run_coroutine_threadsafe(
                                self.handle_stt_result(text), loop
                            )
                            print("[MODE] Switching to HOTWORD mode")
                            self.mode = "hotword"
                            self.recognizer.Reset()
                            silence_start = None
                    else:
                        # Check for silence (no partial result)
                        partial = json.loads(self.recognizer.PartialResult()).get("partial", "")
                        if not partial:
                            if silence_start is None:
                                silence_start = datetime.now()
                            elif (datetime.now() - silence_start).total_seconds() > STT_TIMEOUT_SECONDS:
                                # Timeout, treat as end of speech
                                result = self.recognizer.Result()
                                text = json.loads(result).get("text", "").strip()
                                print(f"[STT] Vosk transcript (timeout): '{text}'")
                                if text:
                                    print(f"[STT] Recognized (timeout): {text}")
                                    asyncio.run_coroutine_threadsafe(
                                        self.handle_stt_result(text), loop
                                    )
                                print("[MODE] Switching to HOTWORD mode")
                                self.mode = "hotword"
                                self.recognizer.Reset()
                                silence_start = None
                        else:
                            silence_start = None
            except Exception as e:
                print(f"[Error] Audio loop: {e}")
                continue

    async def handle_stt_result(self, text: str):
        # Send to deck clients
        event = {
            "type": "stt_result",
            "text": text,
            "timestamp": datetime.now().isoformat(),
        }
        await self.broadcast(event)
        # Send to core
        try:
            resp = requests.post(
                CORE_API_URL,
                json={"text": text, "speaker": CORE_API_SPEAKER},
                timeout=2,
            )
            print(f"[Core] Sent to core, status: {resp.status_code}")
            # Echo core response to deck clients
            try:
                core_result = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else resp.text
            except Exception:
                core_result = resp.text
            await self.broadcast({
                "type": "core_response",
                "text": text,
                "core_result": core_result,
                "status": resp.status_code,
                "timestamp": datetime.now().isoformat(),
            })
        except Exception as e:
            print(f"[Core] Error sending to core: {e}")

    async def handle_client(self, websocket: WebSocketServerProtocol):
        """Handle a new WebSocket client connection."""
        connected_clients.add(websocket)
        client_addr = websocket.remote_address
        print(f"[WS] Client connected: {client_addr} (total: {len(connected_clients)})")

        # Send welcome message
        welcome = {
            "type": "connected",
            "message": "Connected to Yumi Hotword Server",
            "models": list(self.oww_model.models.keys()) if self.oww_model else [],
            "threshold": self.threshold,
        }
        await websocket.send(json.dumps(welcome))

        try:
            async for message in websocket:
                # Handle incoming messages from clients
                try:
                    data = json.loads(message)
                    msg_type = data.get("type", "")

                    if msg_type == "ping":
                        await websocket.send(json.dumps({"type": "pong"}))
                    elif msg_type == "status":
                        await websocket.send(
                            json.dumps(
                                {
                                    "type": "status",
                                    "listening": self.running,
                                    "clients": len(connected_clients),
                                    "models": list(self.oww_model.models.keys()),
                                }
                            )
                        )
                except json.JSONDecodeError:
                    pass

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            connected_clients.discard(websocket)
            print(
                f"[WS] Client disconnected: {client_addr} (total: {len(connected_clients)})"
            )

    async def start(self):
        """Start the hotword detection server."""
        print("\n" + "=" * 60)
        print("🚀 Yumi Hotword Detection Server")
        print("=" * 60)

        # Initialize components
        self.init_model()
        self.init_audio()

        self.running = True

        # Get the current event loop
        loop = asyncio.get_event_loop()

        # Start audio processing in a separate thread
        audio_thread = threading.Thread(
            target=self.audio_loop, args=(loop,), daemon=True
        )
        audio_thread.start()

        # Start WebSocket server
        print(f"\n[Server] WebSocket server starting on ws://{self.host}:{self.port}")
        print(f"[Server] Connect your deck app to this address\n")

        async with serve(self.handle_client, self.host, self.port):
            await asyncio.Future()  # Run forever

    def stop(self):
        """Stop the server and clean up resources."""
        self.running = False
        if self.mic_stream:
            self.mic_stream.stop_stream()
            self.mic_stream.close()
        if self.audio:
            self.audio.terminate()
        print("\n[Server] Shutdown complete")


def main():
    parser = argparse.ArgumentParser(
        description="Yumi Hotword Detection WebSocket Server"
    )
    parser.add_argument(
        "--host",
        type=str,
        default=DEFAULT_HOST,
        help=f"Host to bind to (default: {DEFAULT_HOST})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Port to listen on (default: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--model_path",
        type=str,
        default="",
        help="Path to a custom wake word model (.onnx or .tflite)",
    )
    parser.add_argument(
        "--chunk_size",
        type=int,
        default=DEFAULT_CHUNK_SIZE,
        help=f"Audio chunk size in samples (default: {DEFAULT_CHUNK_SIZE})",
    )
    parser.add_argument(
        "--inference_framework",
        type=str,
        default="onnx",
        choices=["onnx", "tflite"],
        help="Inference framework to use (default: onnx)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DETECTION_THRESHOLD,
        help=f"Detection threshold 0-1 (default: {DETECTION_THRESHOLD})",
    )

    args = parser.parse_args()

    server = HotwordServer(
        host=args.host,
        port=args.port,
        model_path=args.model_path,
        chunk_size=args.chunk_size,
        inference_framework=args.inference_framework,
        threshold=args.threshold,
    )

    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        print("\n[Server] Interrupted by user")
        server.stop()


if __name__ == "__main__":
    main()
