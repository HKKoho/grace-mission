# Talking-Face Window — Build Plan

Synthesized from `talking-face-architecture.md` and `source.md`.

## What we're building
A window (web page) where a user types or speaks, an LLM agent decides what
to say, and a face on screen speaks it back in near-real-time, lips synced
to the audio — streamed so the face starts moving within ~2s of the LLM
starting to respond, rather than waiting for a full generated video clip.

## 1. Architecture

```
User speaks/types
      │
      ▼
Frontend (avatar render, audio playback, mic capture)
      │  WebSocket (SSE for one-way fallback)
      ▼
Backend (session mgmt, TTS orchestration, viseme extraction, streaming relay)
      │  HTTP/SDK
      ▼
Agent Orchestrator (existing engine: LLM + tools + memory/RAG)
```
Backend also talks to **object storage** (S3/GCS/R2 — generated audio/video,
voice-clone samples) and **Postgres** (session state, config, references
only — never binaries).

**The streaming path is the whole trick:**
```
LLM token stream → sentence/phrase buffer → TTS (streaming, with
phoneme/viseme timestamps) → WebSocket push → avatar renderer applies
blendshapes in sync with audio playback
```
Don't wait for the full LLM response — chunk on sentence boundaries, send
each chunk to TTS as it's ready, stream audio+viseme data incrementally.

## 2. Component map (with concrete OSS picks)

| Layer | Responsibility | Pick |
|---|---|---|
| Agent Orchestrator | LLM calls, tools, memory/RAG — decides *what* to say | existing orchestrator |
| STT (optional) | mic → text | [Whisper](https://github.com/openai/whisper) |
| TTS | text chunk → audio + viseme/phoneme timing | [Chatterbox](https://github.com/resemble-ai/chatterbox) (voice cloning, multilingual), [Piper](https://github.com/rhasspy/piper) (CPU-friendly/local), [HeadTTS](https://github.com/met4citizen/HeadTTS) (in-browser, WebGPU), or ElevenLabs (hosted) |
| Lip-sync engine | audio/visemes → face animation | [MuseTalk](https://github.com/TMElyralab/MuseTalk) (photoreal video, needs GPU), [Wav2Lip](https://github.com/Rudrabha/Wav2Lip) (lighter fallback), [SadTalker](https://github.com/OpenTalker/SadTalker) (single portrait+audio→video), [TalkingHead.js](https://github.com/met4citizen/TalkingHead) (3D, browser-side, no GPU server needed) |
| Browser-side viseme detection | fallback if TTS provider doesn't emit visemes | [HeadAudio](https://github.com/met4citizen/HeadAudio) |
| Realtime transport | push audio/viseme chunks to client | WebSocket first; WebRTC later |
| Renderer | draw the face | `<video>` tag (MuseTalk/SadTalker path) or ThreeJS canvas (TalkingHead 3D path) |

Reference full-stack examples worth reading (not dependencies):
[ai-avatar-system](https://github.com/PunithVT/ai-avatar-system)
(Whisper→LLM→Chatterbox→MuseTalk),
[Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)
(agent-to-avatar plumbing).

**License check before shipping commercially**: several of these repos
separate code license from model-weight license (e.g. MIT code,
research-only weights). Check each repo's README/license individually —
don't assume the code license covers the weights.

## 3. Suggested file structure

```
project-root/
├── backend/src/
│   ├── orchestrator/agentClient.ts, streamChunker.ts   # LLM stream → sentence chunks
│   ├── tts/ttsProvider.ts + providers/{chatterbox,headtts,elevenlabs}.ts
│   ├── lipsync/musetalkWorker.ts, visemeMapper.ts       # phoneme → Oculus viseme id
│   ├── realtime/wsGateway.ts, sessionState.ts
│   ├── storage/objectStore.ts, db/models/{AvatarConfig,VoiceProfile,Session,ConversationTurn}.ts
│   └── server.ts
├── frontend/src/
│   ├── components/AvatarStage/{AvatarStage3D.tsx, AvatarStageVideo.tsx, useVisemeSync.ts}
│   ├── components/ChatPanel/, MicInput/
│   └── lib/wsClient.ts, audioQueue.ts, headAudioWorklet.ts
├── frontend/public/assets/{avatars/*.glb, textures/, voice-previews/}
└── infra/docker-compose.yml
```

## 4. Where data lives
- **Postgres** — `AvatarConfig` (avatar id → model/voice refs, system
  prompt), `VoiceProfile` (provider, voice id, ref to clone sample),
  `Session`/`ConversationTurn` (text, timestamps, token usage). Nothing
  binary.
- **Object storage (S3/GCS/R2)** — generated TTS audio, generated
  lip-sync video, voice-clone reference samples, user-uploaded avatar
  photos. DB rows point to these by URL/key.
- **Frontend static/CDN** — `.glb`/`.fbx` avatar rigs, base textures,
  viseme→blendshape mapping JSON, voice-preview clips. Same for every
  user, changes only on deploy — never round-trip through the DB.

## 5. Build order
1. **MVP**: text-only chat → agent → TTS (Piper or Chatterbox) →
   TalkingHead.js 3D avatar in browser, WebSocket transport, blendshapes
   driven by TTS-provided visemes (or HeadAudio as fallback). No GPU
   server needed.
2. **Add voice input**: mic capture → Whisper STT → same pipeline.
3. **Upgrade realism** (optional): swap the 3D avatar for a photoreal
   video path (MuseTalk/SadTalker) if a rigged 3D avatar isn't visually
   acceptable — adds a GPU-backed worker to the backend.
4. **Full-duplex/barge-in** (only if needed): migrate the audio path
   from WebSocket to WebRTC so the user can interrupt mid-response.

## 6. Realtime transport choice
- **WebSocket**: simplest, works well for streaming audio chunks +
  viseme JSON events separately. Good default.
- **WebRTC**: needed for true full-duplex (user talking while avatar is
  mid-response, barge-in) with low latency — more setup cost
  (SFU/TURN).

Start with WebSocket for MVP; migrate the audio path to WebRTC later if
barge-in/interruption becomes a hard requirement.
