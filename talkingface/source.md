# Talking-Face Agent Orchestrator — Architecture Sketch

## 1. High-level flow

```
User speaks/types
      │
      ▼
┌─────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Frontend        │◄────►│  Backend           │◄────►│  Agent Orchestrator│
│  (avatar render, │ WS/  │  (session, TTS,     │ HTTP/ │  (LLM, tools,      │
│  audio playback,  │ SSE  │  viseme extraction, │ SDK   │  memory, RAG)      │
│  mic capture)     │      │  streaming relay)   │      │                    │
└─────────────────┘      └──────────────────┘      └──────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  Object storage    │  (generated audio/video,
                          │  (S3/GCS/R2)       │   voice-clone samples)
                          └──────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  Database (Postgres)│  (metadata, session state,
                          │                     │   config, refs only)
                          └──────────────────┘
```

**Streaming path** (the part that makes it feel "live"):

```
LLM token stream → sentence/phrase buffer → TTS (streaming, with
word/phoneme timestamps or viseme IDs) → viseme track → WebSocket
push to frontend → avatar renderer applies blendshapes in sync
with audio playback
```

Key principle: **don't wait for the full LLM response.** Chunk on
sentence boundaries, send each chunk to TTS as it's ready, and stream
audio + viseme data to the frontend incrementally. This is what gets
you sub-2s time-to-first-video-frame.

---

## 2. Component responsibilities

| Layer                          | Responsibility                                         | Candidate OSS                                                             |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Agent Orchestrator             | LLM calls, tool use, memory/RAG, decides _what_ to say | your existing orchestrator                                                |
| STT (optional, if voice input) | mic audio → text                                       | Whisper                                                                   |
| TTS                            | text chunk → audio + timing data (visemes/phonemes)    | Chatterbox, HeadTTS, Piper, ElevenLabs                                    |
| Lip-sync engine                | audio/visemes → face animation                         | MuseTalk (photoreal video), TalkingHead.js + HeadAudio (3D, browser-side) |
| Realtime transport             | push audio/viseme chunks to client                     | WebSocket (or WebRTC for full-duplex)                                     |
| Renderer                       | draw the face in sync with audio                       | `<video>` tag (MuseTalk) or ThreeJS canvas (TalkingHead 3D)               |

---

## 3. Suggested file structure

```
project-root/
├── backend/
│   ├── src/
│   │   ├── orchestrator/
│   │   │   ├── agentClient.ts        # calls your existing agent orchestrator
│   │   │   └── streamChunker.ts      # splits LLM stream into TTS-ready sentences
│   │   ├── tts/
│   │   │   ├── ttsProvider.ts        # interface: text -> {audio, visemes}
│   │   │   ├── providers/
│   │   │   │   ├── chatterbox.ts
│   │   │   │   ├── headtts.ts
│   │   │   │   └── elevenlabs.ts
│   │   ├── lipsync/
│   │   │   ├── musetalkWorker.ts     # if doing server-side photoreal video
│   │   │   └── visemeMapper.ts       # phoneme -> Oculus viseme id mapping
│   │   ├── realtime/
│   │   │   ├── wsGateway.ts          # WebSocket session handler
│   │   │   └── sessionState.ts       # in-memory per-session buffers
│   │   ├── storage/
│   │   │   ├── objectStore.ts        # S3/GCS client (audio/video blobs)
│   │   │   └── db/
│   │   │       ├── models/
│   │   │       │   ├── AvatarConfig.ts
│   │   │       │   ├── VoiceProfile.ts
│   │   │       │   ├── Session.ts
│   │   │       │   └── ConversationTurn.ts
│   │   │       └── migrations/
│   │   └── server.ts
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AvatarStage/
│   │   │   │   ├── AvatarStage3D.tsx     # ThreeJS canvas (TalkingHead.js)
│   │   │   │   ├── AvatarStageVideo.tsx  # <video> based (MuseTalk stream)
│   │   │   │   └── useVisemeSync.ts      # hook: aligns blendshapes to audio clock
│   │   │   ├── ChatPanel/
│   │   │   └── MicInput/
│   │   ├── lib/
│   │   │   ├── wsClient.ts           # connects to backend realtime gateway
│   │   │   ├── audioQueue.ts         # gapless playback of streamed audio chunks
│   │   │   └── headAudioWorklet.ts   # browser-side viseme detection fallback
│   │   └── App.tsx
│   ├── public/
│   │   └── assets/
│   │       ├── avatars/              # .glb 3D models (see §4)
│   │       ├── textures/
│   │       └── voice-previews/       # short sample clips for voice picker UI
│   └── package.json
│
└── infra/
    ├── docker-compose.yml            # musetalk/tts/db services
    └── terraform/ (optional)
```

---

## 4. What goes in the database vs. frontend assets vs. object storage

**Database (Postgres/etc.) — metadata and small structured data only**

- `AvatarConfig`: avatar id, display name, which 3D model/video-source it maps to (a _reference_, not the file), voice_profile_id, default LLM/system-prompt config
- `VoiceProfile`: TTS provider, voice id, language, reference to a voice-clone sample in object storage (not the audio itself)
- `Session` / `ConversationTurn`: chat history, timestamps, which avatar/voice was used, token usage — text only
- User preferences, feature flags, org/tenant config
- Rule of thumb: if it's under a few KB and queried/filtered often, it's DB. If it's a binary blob, it's not.

**Object storage (S3/GCS/R2) — generated or user-uploaded binaries**

- Generated TTS audio clips (if you cache/replay them)
- Generated lip-sync video segments (if using server-side MuseTalk/SadTalker rendering)
- User-uploaded photos for photoreal avatar creation
- Voice-cloning reference audio samples
- Store the URL/key in the DB row that references it (e.g. `VoiceProfile.sample_url`)

**Frontend static assets (`/public/assets` or CDN) — things shipped with the app, not user/session-specific**

- 3D avatar `.glb`/`.fbx` models and rig data for TalkingHead.js
- Base textures, idle animations, default poses
- Viseme-to-blendshape mapping tables (static JSON, rarely changes)
- Short voice-preview clips used only in a "pick a voice" UI selector
- App shell UI assets (icons, static images)
- Rule of thumb: if every user gets the same file and it changes only on deploy, it's a frontend/CDN asset — don't round-trip it through the DB or your API.

**Do NOT put in the database**

- Audio/video binaries (even small ones bloat row size and backups fast)
- 3D model files or textures
- Full LLM conversation embeddings if you're doing RAG — those belong in a vector store, referenced by id from `ConversationTurn`

---

## 5. Where to get each component

| Component                       | Repo / package                                                                                   | Notes                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Reference full-stack platform   | [github.com/PunithVT/ai-avatar-system](https://github.com/PunithVT/ai-avatar-system)             | Whisper → LLM → Chatterbox → MuseTalk, read as reference, not a dependency |
| Lip-sync (photoreal)            | [github.com/TMElyralab/MuseTalk](https://github.com/TMElyralab/MuseTalk)                         | pip-installable, needs GPU for real-time                                   |
| Lip-sync (lightweight fallback) | [github.com/Rudrabha/Wav2Lip](https://github.com/Rudrabha/Wav2Lip)                               | Older, lower GPU requirement                                               |
| Talking-head video generation   | [github.com/OpenTalker/SadTalker](https://github.com/OpenTalker/SadTalker)                       | Single portrait + audio → video                                            |
| Expression/motion transfer      | [github.com/KwaiVGI/LivePortrait](https://github.com/KwaiVGI/LivePortrait)                       | Often paired with MuseTalk                                                 |
| 3D avatar renderer (browser)    | [github.com/met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead)                 | JS class, ThreeJS/WebGL, npm-installable                                   |
| Browser-side viseme detection   | [github.com/met4citizen/HeadAudio](https://github.com/met4citizen/HeadAudio)                     | Audio worklet, no LLM/text needed                                          |
| In-browser TTS w/ visemes       | [github.com/met4citizen/HeadTTS](https://github.com/met4citizen/HeadTTS)                         | WebGPU, phoneme-timestamped output                                         |
| TTS (self-hosted)               | [github.com/resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox)                   | Voice cloning, multilingual                                                |
| TTS (lightweight/local)         | [github.com/rhasspy/piper](https://github.com/rhasspy/piper)                                     | CPU-friendly, good for edge/local                                          |
| STT                             | [github.com/openai/whisper](https://github.com/openai/whisper)                                   | Also available via `openai-whisper` on PyPI                                |
| LLM-driven VTuber framework     | [github.com/Open-LLM-VTuber/Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | Reference for agent-to-avatar plumbing                                     |

Most of the Python-side pieces (MuseTalk, Wav2Lip, SadTalker, LivePortrait, Whisper, Chatterbox) also have model weights hosted on **Hugging Face** — check each repo's README for the exact HF model id, since weights are usually pulled separately from the code via `huggingface_hub` or `git lfs`.

Before adopting any of these into a commercial product, check the license file in each repo individually — model weights and code are sometimes licensed differently (e.g. research-only weights bundled with MIT-licensed code), which matters for AIbyML's commercial use case.

---

## 6. A note on realtime transport choice

- **WebSocket**: simplest, works well for streaming audio chunks + viseme JSON events separately. Good default.
- **WebRTC**: needed if you want true full-duplex (user talking while avatar is mid-response, barge-in) with low latency — more setup cost (SFU/TURN), but `ai-avatar-system` and similar projects lean this way for production.

Start with WebSocket for MVP; migrate the audio path to WebRTC later if barge-in/interruption becomes a hard requirement.
