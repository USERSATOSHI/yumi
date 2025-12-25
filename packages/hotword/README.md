# Yumi Hotword Detection Server

A WebSocket-based hotword detection server designed to run on mobile (Termux) and broadcast wake word events to connected clients like the deck PWA.

## Setup on Termux

```bash
# Update packages
pkg update && pkg upgrade

# Install Python and audio dependencies
pkg install python portaudio

# Install pip packages
pip install -r requirements.txt
```

## Usage

### Basic (with default models)
```bash
python server.py
```

### With custom wake word model
```bash
python server.py --model_path ./hai_yoo_mee.onnx
```

### Full options
```bash
python server.py \
  --host 0.0.0.0 \
  --port 8765 \
  --model_path ./hai_yoo_mee.onnx \
  --inference_framework onnx \
  --threshold 0.5 \
  --chunk_size 1280
```

## WebSocket API

### Connection
Connect to `ws://<phone-ip>:8765`

### Messages from Server

#### On Connection
```json
{
  "type": "connected",
  "message": "Connected to Yumi Hotword Server",
  "models": ["hai_yoo_mee"],
  "threshold": 0.5
}
```

#### On Hotword Detection
```json
{
  "type": "hotword_detected",
  "model": "hai_yoo_mee",
  "score": 0.8523,
  "timestamp": "2025-12-22T10:30:00.123456",
  "action": "start_listening"
}
```

### Messages to Server

#### Ping
```json
{"type": "ping"}
```
Response: `{"type": "pong"}`

#### Status
```json
{"type": "status"}
```
Response:
```json
{
  "type": "status",
  "listening": true,
  "clients": 2,
  "models": ["hai_yoo_mee"]
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile (Termux)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Hotword Server (server.py)              │   │
│  │  ┌───────────┐    ┌──────────┐    ┌─────────────┐   │   │
│  │  │   Mic     │───▶│OpenWakeWd│───▶│ WS Broadcast│   │   │
│  │  │  Input    │    │  Model   │    │   Server    │   │   │
│  │  └───────────┘    └──────────┘    └──────┬──────┘   │   │
│  └──────────────────────────────────────────│──────────┘   │
└─────────────────────────────────────────────│───────────────┘
                                              │ WebSocket
                                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Mobile Browser                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Deck PWA                           │   │
│  │                                                      │   │
│  │   On "hotword_detected" → Start voice recording      │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Finding Your Phone IP

In Termux:
```bash
ifconfig wlan0 | grep 'inet '
```

Use this IP to connect from the deck PWA.
