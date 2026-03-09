# Recipe: Add ElevenLabs Voice Agent

Add a conversational AI voice interface to an AppyStack app using ElevenLabs Conversational AI. The voice agent connects **directly from the browser to ElevenLabs via WebRTC** — your AppyStack server provides only a single token endpoint. Socket.io plays no role in voice communication.

---

## Architecture — Read This First

This is the most important thing to understand before writing any code:

```
Browser <──── WebRTC ────> ElevenLabs Cloud
   |
   |  (client tools — browser JS functions)
   |
   +── fetch -> Your AppyStack server (localhost:PORT/api/...)
   +── fetch -> Any other localhost API
```

**Your server's only job:**
```
POST /api/voice/token  ->  calls ElevenLabs API  ->  returns a short-lived WebRTC token
```

**Socket.io is not involved.** The ElevenLabs WebRTC connection is a completely separate channel from your app's Socket.io. Do not route audio or voice events through Socket.io — it adds failure points and fights the SDK.

**Client tools** are plain async browser functions that `fetch()` your APIs. They are registered when the session starts and called by the ElevenLabs agent during conversation. They run entirely in the browser.

---

## Recipe Anatomy

**Intent**
Add voice conversation to an existing AppyStack app with minimal server changes. The agent can query your app's data via client tools you define.

**Type**: Additive. Safe to apply to any AppyStack app. Does not touch existing routes, Socket.io, or shared types.

**Stack Assumptions**
- AppyStack RVETS template (Express 5, TypeScript, React 19)
- An ElevenLabs account with a configured Conversational AI agent
- Microphone access available in the browser

**Idempotency Check**
Does `server/src/routes/voice.ts` exist? If yes, token endpoint already installed.
Does `client/src/hooks/useVoiceAgent.ts` exist? If yes, hook already installed.

**Does Not Touch**
- `server/src/index.ts` Socket.io setup
- `shared/src/types.ts` (no shared types needed for voice)
- Any existing routes or socket handlers
- The AppyStack Socket.io singleton

**Composes With**
- Any data recipe — client tools can call any of your app's APIs
- `nav-shell` — add a Voice tab to the sidebar

---

## Step 0: ElevenLabs Dashboard Setup (Do This Before Writing Code)

Configuration mistakes cause silent disconnections that look like code bugs. Set these up first, verify once, then touch the codebase.

**In your ElevenLabs agent settings:**

1. **Security tab -> Allowlist** — add your client URL, e.g. `http://localhost:5500`. Without this the browser connection is rejected. For production add your domain.

2. **Security tab -> Overrides** — enable "First message" and "System prompt" overrides. Without this the agent may connect and then immediately disconnect with a generic "interruption" message. This is the single most common cause of unexplained disconnections.

3. **Tools tab** — for each client tool you register, mark it as **blocking** (the agent waits for the result before speaking). If not blocking, the agent speaks before the data returns.

4. **Call History** — after any test connection, check here for specific error messages. The browser console shows generic disconnect events; the dashboard shows the actual reason.

**Environment variables you need:**
```bash
ELEVENLABS_API_KEY=sk_...         # 64 chars, starts with sk_
ELEVENLABS_AGENT_ID=agent_...     # from your agent's Settings page
```

---

## Step 1: Install Dependencies

```bash
# Server workspace
cd server && npm install @elevenlabs/elevenlabs-js

# Client workspace — always latest
cd client && npm install @elevenlabs/react@latest
```

Always install `@latest` explicitly. The ElevenLabs SDK moves fast — v0.12.2 fixed a WebSocket race condition, v0.14.0 reduced audio latency from 250ms to 100ms. A pinned old version misses months of stability fixes.

---

## Step 2: Environment

Add to `server/.env` and `server/.env.example`:
```bash
ELEVENLABS_API_KEY=sk_your_key_here
ELEVENLABS_AGENT_ID=your_agent_id_here
```

Add to `server/src/config/env.ts` Zod schema:
```typescript
ELEVENLABS_API_KEY: z.string().min(1).refine(
  (val) => val.length === 64 && val.startsWith('sk_'),
  'ELEVENLABS_API_KEY must be 64 chars starting with sk_'
),
ELEVENLABS_AGENT_ID: z.string().min(1),
```

**Use `dotenv.config({ override: true })`** in your env loader. Without `override: true`, dotenv silently keeps a previously-set shell variable and you get a clipped or wrong key, which produces a 401 from ElevenLabs with no obvious cause.

---

## Step 3: Server — Token Endpoint

One route file, one endpoint. No Socket.io.

```typescript
// server/src/routes/voice.ts
import { Router } from 'express';
import { env } from '../config/env.js';

const router = Router();

/**
 * POST /api/voice/token
 * Returns a short-lived WebRTC token for direct browser -> ElevenLabs connection.
 * The API key never leaves the server.
 */
router.post('/token', async (req, res) => {
  try {
    const url = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${env.ELEVENLABS_AGENT_ID}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ElevenLabs API ${response.status}: ${body}`);
    }

    const { token } = await response.json() as { token: string };
    res.json({ token });
  } catch (err) {
    console.error('[voice/token]', err);
    res.status(500).json({ error: 'Failed to generate voice token' });
  }
});

export default router;
```

Mount in `server/src/index.ts`:
```typescript
import voiceRouter from './routes/voice.js';
app.use('/api/voice', voiceRouter);
```

**Endpoint note:** The correct ElevenLabs endpoint is `GET /v1/convai/conversation/token?agent_id=...`, not a POST to `/get_signed_url`. Earlier docs showed a different endpoint — the token endpoint above is current.

---

## Step 4: Client Tools

Client tools are browser functions the ElevenLabs agent calls during conversation. Each tool must return a `string` — serialize your data as JSON.

```typescript
// client/src/voice/clientTools.ts

/**
 * Define one function per capability you want the voice agent to have.
 * Each function must return Promise<string> — serialize result as JSON.
 *
 * These are registered at session start. The agent calls them by name
 * based on its tool configuration in the ElevenLabs dashboard.
 */

export const clientTools = {
  // Example: query your app's API
  listItems: async (): Promise<string> => {
    const res = await fetch('/api/items');
    const data = await res.json();
    return JSON.stringify(data);
  },

  // Example: parameterised lookup
  getItem: async (params: { id: string }): Promise<string> => {
    const res = await fetch(`/api/items/${params.id}`);
    const data = await res.json();
    return JSON.stringify(data);
  },
};
```

**Tool design rules:**
- Return `JSON.stringify(result)` not raw objects. The SDK expects strings.
- Keep results concise — the agent reads them aloud. Don't return large arrays.
- Match tool names exactly to what you configure in the ElevenLabs dashboard.
- Mark each tool as **blocking** in the dashboard or the agent speaks before data arrives.

---

## Step 5: Client Hook

```typescript
// client/src/hooks/useVoiceAgent.ts
import { useState, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';
import { clientTools } from '../voice/clientTools.js';

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'disconnected' | 'error';

export interface VoiceMessage {
  id: string;
  text: string;
  role: 'user' | 'agent';
}

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setStatus('connected');
      setError(null);
    },
    onDisconnect: () => {
      setStatus('disconnected');
    },
    onMessage: (message: any) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: message.message ?? '',
        role: message.source === 'user' ? 'user' : 'agent',
      }]);
    },
    onModeChange: (mode: any) => {
      if (mode.mode === 'speaking') setStatus('speaking');
      else if (mode.mode === 'listening') setStatus('listening');
    },
    onError: (err: any) => {
      setError(typeof err === 'string' ? err : err?.message ?? 'Voice error');
      setStatus('error');
    },
  });

  const start = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);
      setMessages([]);

      // Request mic with echo cancellation before connecting
      await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      // Get WebRTC token from your server
      const res = await fetch('/api/voice/token', { method: 'POST' });
      if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
      const { token } = await res.json();

      // Start session — browser connects directly to ElevenLabs via WebRTC
      await conversation.startSession({
        conversationToken: token,
        connectionType: 'webrtc',  // enables built-in echo cancellation
        clientTools,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start';
      setError(msg);
      setStatus('error');
    }
  }, [conversation]);

  const stop = useCallback(async () => {
    await conversation.endSession();
    setStatus('idle');
  }, [conversation]);

  return { status, messages, error, start, stop };
}
```

---

## Step 6: Voice UI Component

```typescript
// client/src/components/VoiceAgent.tsx
import { useVoiceAgent } from '../hooks/useVoiceAgent.js';

export function VoiceAgent() {
  const { status, messages, error, start, stop } = useVoiceAgent();

  const isActive = status === 'connected' || status === 'listening' || status === 'speaking';
  const isConnecting = status === 'connecting';

  return (
    <div>
      <div>Status: {status}</div>

      {error && <div>{error}</div>}

      <button onClick={start} disabled={isActive || isConnecting}>
        {isConnecting ? 'Connecting...' : 'Start'}
      </button>

      <button onClick={stop} disabled={!isActive}>
        Stop
      </button>

      <div>
        {messages.map(msg => (
          <div key={msg.id}>
            <strong>{msg.role === 'user' ? 'You' : 'Agent'}:</strong> {msg.text}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Button state rule:** Start is disabled when `connecting`, `connected`, `listening`, or `speaking`. It is enabled when `idle`, `disconnected`, or `error`. Do not disable on `idle` — that is the default state on page load.

---

## Files Created by This Recipe

```
project-root/
+-- server/src/routes/
|   +-- voice.ts              <- token endpoint (mount in index.ts)
+-- client/src/
    +-- voice/
    |   +-- clientTools.ts    <- browser tool functions
    +-- hooks/
    |   +-- useVoiceAgent.ts  <- conversation state + session management
    +-- components/
        +-- VoiceAgent.tsx    <- UI (replace with your design)
```

---

## Anti-Patterns (From Real Production Experience — FliVoice)

**Never relay audio through Socket.io.**
```typescript
// WRONG — attempting to pipe voice through your app's Socket.io
socket.emit('voice:audio', audioBuffer);

// CORRECT — ElevenLabs WebRTC handles audio directly, no relay needed
```
This was the central mistake in the FliVoice build. Socket.io relay adds complexity, failure points, and disables the SDK's built-in echo cancellation.

**Never create a server-side Conversation instance.**
```typescript
// WRONG — server-side audio relay architecture
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
const client = new ElevenLabsClient({ apiKey });
await client.conversationalAI.createConversation(...); // don't do this for browser apps

// CORRECT — server fetches a token only, browser drives everything
```

**Never use shell aliases inside exec() for server-side tool calls.**
```typescript
// WRONG — aliases don't exist in child processes
exec('jump search "query"'); // "command not found"

// CORRECT — absolute path
exec('/absolute/path/to/tool search "query"');
```

**Always use `connectionType: 'webrtc'`.**
```typescript
// Without this, echo cancellation is disabled and the agent hears itself speak
await conversation.startSession({
  conversationToken: token,
  connectionType: 'webrtc', // required
  clientTools,
});
```

**Always return `JSON.stringify()` from client tools.**
```typescript
// WRONG — SDK expects string, not object
return { items: [...] };

// CORRECT
return JSON.stringify({ items: [...] });
```

**Never pin to an old SDK version.**
```bash
# WRONG — locks to a version with known WebSocket race conditions
npm install @elevenlabs/react@0.2.1

# CORRECT
npm install @elevenlabs/react@latest
```

---

## Debugging Checklist

When the agent connects then immediately disconnects:

1. **Dashboard -> Security -> Overrides** — are "First message" and "System prompt" overrides enabled? This is the #1 cause of immediate silent disconnection.
2. **Dashboard -> Tools** — is each client tool marked as **blocking**?
3. **Dashboard -> Security -> Allowlist** — is your client URL listed (e.g. `http://localhost:5500`)?
4. **Dashboard -> Call History** — check here for the actual error reason. Browser console shows generic events only.
5. **SDK version** — run `npm list @elevenlabs/react`. If below 0.12.0, upgrade.
6. **API key length** — log `ELEVENLABS_API_KEY.length` on server start. Should be 64. If shorter, dotenv is picking up a shell variable — add `override: true` to `dotenv.config()`.
7. **CORS** — is `CLIENT_URL` set correctly in server env? The token endpoint needs CORS allowed for your client origin.

---

## When to Use This Recipe

- You want users to talk to your app instead of (or alongside) clicking buttons
- You want an AI agent that can query your app's data via spoken questions
- You are building a voice-controlled dashboard, assistant, or kiosk interface
- You want to add voice to an existing AppyStack app without restructuring it

**Not appropriate for:**
- Real-time transcription only (use Whisper or ElevenLabs STT API directly)
- Push-to-talk with no AI conversation (simpler microphone + STT setup)
- Server-side speech synthesis without conversation (use ElevenLabs TTS API directly)

---

## What to Collect Before Building

1. **ElevenLabs agent ID** — from the agent's Settings page in the dashboard
2. **Client tools** — what can the agent do? List each tool: name, parameters, which API it calls
3. **Tool data shape** — what does each API return? The agent summarises it verbally, so keep results concise
4. **Voice persona** — what is the agent's name and personality? Configured in dashboard, not in code
