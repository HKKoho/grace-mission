# Hetzner Deployment Guide

The cheapest way to run Grace Mission in production: one Hetzner Cloud VPS
running everything (Postgres, Redis, the API, the web dashboard, and every
agent's Docker container) via the installer this repo already ships
(`pnpm run install:clawix`), fronted by Caddy for free automatic TLS.

**Domain used throughout this guide:** `gracemission.aibyml.uk`
(swap in your own if this changes).

**Estimated cost:** ~$5/mo infra (Hetzner CX22 + amortized domain) + variable
LLM API usage. See [Cost recap](#cost-recap) at the end.

---

## Step 1 — Create the Hetzner Server

1. Go to [console.hetzner.cloud](https://console.hetzner.cloud) and sign up /
   log in.
2. Click **New Project** (or reuse an existing one) → name it e.g.
   `grace-mission`.
3. Inside the project, click **Add Server**:
   - **Location:** closest to your users
   - **Image:** Ubuntu 24.04
   - **Type:** Shared vCPU → **CX22** (2 vCPU / 4 GB RAM / 40 GB SSD, ~€3.79/mo)
   - **SSH Key:** click **Add SSH Key**, paste your public key
     (`cat ~/.ssh/id_ed25519.pub` locally if you need to generate one first:
     `ssh-keygen -t ed25519`)
   - Leave networking/firewall defaults — you'll configure `ufw` on the box
     itself in Step 3
   - **Name:** `grace-mission-prod`
4. Click **Create & Buy Now**.
5. Note the server's public IPv4 address once it boots (e.g. `95.216.x.x`).

---

## Step 2 — Point Your Domain

Add an **A record** at wherever you manage the `aibyml.uk` DNS:

```
A   gracemission.aibyml.uk   →   <server IPv4>
```

Verify propagation before continuing (can take a few minutes, up to an hour):

```bash
dig gracemission.aibyml.uk +short
```

It should return the server's IP.

> **Using Cloudflare?** Set the proxy toggle to **DNS only** (grey cloud), not
> orange/proxied — the orange proxy breaks the WebSocket connection the app
> uses for live agent output.

---

## Step 3 — Provision the Server

SSH in as root:

```bash
ssh root@<server IPv4>
```

Create a non-root user and set up the firewall:

```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

> **Write down the password you just set for `adduser deploy`.** There is no
> passwordless sudo configured for this user — every `sudo` command from here
> on (including Caddy config edits in Step 5, and anything you do during
> later maintenance) will prompt for it interactively. You SSH in as `root`
> the first time only; day-to-day work happens as `deploy`, and its password
> is what unlocks `sudo` for that account. Losing it means going back in as
> `root` (`ssh root@<server IPv4>`) to reset it with `passwd deploy`.

```bash
sudo apt-get update -qq && sudo apt-get install -y ufw
sudo ufw allow 22/tcp    # ssh
sudo ufw allow 80/tcp    # Caddy's ACME (Let's Encrypt) challenge
sudo ufw allow 3002/tcp  # web dashboard
sudo ufw allow 3003/tcp  # API / WebSocket
sudo ufw enable
```

Install Docker:

```bash
sudo apt-get install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update -qq
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker deploy   # log out/in once for this to take effect
```

Install Node 20+ and pnpm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
corepack enable
corepack prepare pnpm@10.32.1 --activate
```

Log out and back in (or run `newgrp docker`) so your `deploy` user's Docker
group membership takes effect before continuing.

---

## Step 4 — Clone and Run the Installer

```bash
git clone https://github.com/aibymlsg-jpg/grace-mission.git
cd grace-mission
pnpm run install:clawix
```

The installer is interactive. Answer the prompts like this:

| Prompt                        | Answer                                                         |
| ----------------------------- | -------------------------------------------------------------- |
| Deployment mode               | `1` (production)                                               |
| Provider selection            | pick one or more (e.g. `1` for Anthropic) + paste your API key |
| Default model                 | accept the default, or pick a cheaper one — see cost tip below |
| Public host or IP             | `gracemission.aibyml.uk` (no `https://`, no port)              |
| Use HTTPS?                    | `y`                                                            |
| Extra CORS origins            | leave blank                                                    |
| Admin email / password / name | your admin login                                               |

> **Cost tip:** the installer defaults to `gpt-4o` for OpenAI (or
> `claude-sonnet-4-5` for Anthropic). For most conversational use, a cheaper
> model (e.g. Claude Haiku or `gpt-4o-mini`) will matter far more for your
> monthly bill than which VPS tier you picked. You can change
> `DEFAULT_LLM_MODEL` in `.env` later and re-run
> `node scripts/update.mjs -- --pull` to apply it.

> **Model-access gotcha:** not every OpenAI API key/project actually has
> `gpt-4o` or `gpt-4o-mini` enabled — this depends on your account's billing
> tier and can silently differ from what you'd expect. Before trusting the
> default, check what your key can actually reach:
>
> ```bash
> curl -s https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY" \
>   | python3 -c "import json,sys; print([m['id'] for m in json.load(sys.stdin)['data']])"
> ```
>
> If `gpt-4o`/`gpt-4o-mini` aren't in that list, use whatever your project
> does have (e.g. `gpt-4-turbo`) instead. Importantly: changing
> `DEFAULT_LLM_MODEL` in `.env` only affects agents seeded _after_ the
> change — every agent already created keeps whatever model was baked in at
> creation time in its own `AgentDefinition.model` row. If you fix the
> default after agents already exist, you also need to update each existing
> agent's model (Settings → Agents in the dashboard, or a direct DB update).

This step also builds the `clawix-agent:latest` Docker image and starts
everything via `docker-compose.prod.yml`. First run takes a few minutes —
the installer waits for `http://localhost:3003/health` to go green.

---

## Step 5 — TLS with Caddy

The installer bakes the **port number** into the URLs it generates
(`https://gracemission.aibyml.uk:3002` for the dashboard,
`https://gracemission.aibyml.uk:3003` for the API/WebSocket) — there's no
built-in option for a clean port-less URL, and exposing two raw ports
straight to the internet isn't great either. **Use the port-less, path-based
setup below** — it's what's actually running in production and needs no
`docker-compose.prod.yml` changes, just Caddy in front:

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update -qq && sudo apt-get install -y caddy
```

Edit `/etc/caddy/Caddyfile`:

```caddyfile
gracemission.aibyml.uk {
	handle_path /api/* {
		reverse_proxy localhost:3003
	}
	handle /ws/* {
		reverse_proxy localhost:3003
	}
	reverse_proxy localhost:3002
}
```

```bash
sudo systemctl reload caddy
```

Caddy issues and renews Let's Encrypt certificates automatically on 443 (it
uses port 80 for the ACME challenge — that's why port 80 is open in the
firewall). Everything goes through this one HTTPS port; 3002/3003 stay as
internal Docker port mappings that only `localhost` on the box itself can
reach directly.

> **Two things that are easy to get wrong with this setup, both of which we
> hit in practice:**
>
> 1. **The WebSocket route is easy to forget.** If you only add the
>    `/api/*` block and skip `/ws/*`, the chat WebSocket falls through to the
>    catch-all `reverse_proxy localhost:3002` (the _web_ container, which has
>    no such route) and every `wss://.../ws/chat` connection fails. Symptom:
>    browser console shows `ERR_SSL_PROTOCOL_ERROR` if the frontend was still
>    pointed at a raw port, or a silent connect failure if it's pointed at
>    the bare domain without this block.
> 2. **`handle_path /api/*` _strips_ the `/api` prefix** before forwarding to
>    the API container. Combined with the workspace controller's own
>    `api/v1/workspace` route prefix, this means `NEXT_PUBLIC_API_URL` must
>    be set to `https://gracemission.aibyml.uk/api` (**with** the `/api`
>    suffix) — not the bare domain, and not a separate `api.` subdomain
>    (which has no DNS record or Caddy block of its own). Get this wrong and
>    you'll see 401s and 404s on login/workspace calls that look like an auth
>    bug but are actually a routing mismatch. `NEXT_PUBLIC_WS_URL` stays bare
>    (`wss://gracemission.aibyml.uk`, no path) — the frontend appends
>    `/ws/chat` itself.
>
> Both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are baked into the
> Next.js bundle **at build time** — editing `.env` alone does nothing to a
> already-running container. Always follow an env change with
> `node scripts/update.mjs -- --pull` (or `pnpm run update:clawix` when
> working from a checkout) to rebuild and restart.

---

## Step 6 — Verify

Open `https://gracemission.aibyml.uk` (no port) in a browser and log in with
the admin credentials from Step 4. Confirm the WebSocket connects (the
"connected" dot in `/conversations` should be green, not red).

API health check (through Caddy, path-based):

```bash
curl https://gracemission.aibyml.uk/api/health
```

If that hangs or errors, check directly on the box that the container itself
is healthy before suspecting Caddy:

```bash
curl http://localhost:3003/health
```

---

## Step 7 — Add LLM Provider Keys (if not set during install)

1. Log into the web dashboard with your admin credentials
2. Go to **Settings → Providers**
3. Add/confirm your OpenAI / Anthropic / Gemini API keys
4. Create agents and start conversations

> **Provider keys only auto-seed from `.env` once, ever.** The DB-backed
> `ProviderConfig` table is populated from `OPENAI_API_KEY` /
> `ANTHROPIC_API_KEY` in `.env` on the very first container boot
> (`seedFromEnv()` — it skips entirely if the table already has any row).
> If the key that went in at that moment was wrong — a bad paste, a dropped
> character from a terminal glitch during the interactive installer prompt —
> fixing `.env` afterward does **nothing**; the already-encrypted DB row
> never gets re-synced, and you'll see `401 Incorrect API key` errors on
> every agent run despite `.env` looking correct. The fix is always through
> **Settings → Providers** in the dashboard (re-enter the key there), not by
> editing `.env` and restarting.

---

## Step 8 — Seed the NGO Specialist Agents

The installer only creates a bare "Primary Assistant" and a generic
default-worker. The actual ministry-specific agents (program coordination,
giving/stewardship, pastoral care, finance, outreach, Scripture &
literacy, etc.) are a separate, manual step:

```bash
node scripts/seed-ngo-agents.mjs   # creates the specialist agent roster
node scripts/setup-ngo.mjs         # renames the primary orchestrator + seeds the 28-folder workspace + skills
```

Both are idempotent — safe to re-run; they skip anything that already
exists.

> **Ownership gotcha:** `setup-ngo.mjs` runs as your `deploy` user and writes
> workspace folders under `./data/users/<id>/workspace/`. If `clawix-api`
> (which runs as **root** inside its container) already created that
> directory tree — e.g. from a user logging in and the workspace-seeder
> service running first — the folders on the host end up owned by
> `root:root`, and `setup-ngo.mjs` fails with `EACCES: permission denied`.
> Fix by reclaiming ownership before re-running (no `sudo` on the host
> needed — this uses the `docker` group instead):
>
> ```bash
> docker run --rm -v "$(pwd)/data:/data" alpine chown -R 1000:1000 /data
> node scripts/setup-ngo.mjs
> ```

---

## Ongoing Operations

```bash
# After a git pull or .env change — rebuild and restart
node scripts/update.mjs -- --pull

# Tail logs
docker compose -f docker-compose.prod.yml logs -f

# Container health
docker compose -f docker-compose.prod.yml ps

# Back up the database (cron this — e.g. daily via crontab -e)
docker exec clawix-postgres pg_dump -U clawix clawix | gzip > ~/backups/db-$(date +%F).sql.gz

# Back up workspace data (prayer requests, incidents, pastoral-care records, etc.)
tar czf ~/backups/data-$(date +%F).tar.gz ./data

# Full teardown if ever needed
pnpm run uninstall:clawix              # keeps ./data
pnpm run uninstall:clawix -- --full    # removes .env, ./data, skills/custom too
```

**Auto-start on reboot:** every container is declared `restart:
unless-stopped`, so as long as Docker starts on boot the whole stack comes
back automatically:

```bash
sudo systemctl enable docker
```

---

## Troubleshooting

### API fails to start

```bash
docker compose -f docker-compose.prod.yml logs api
```

Common causes: missing env var, Postgres not ready yet, bad provider API key.

### Agents fail to spawn

Confirm the Docker daemon is reachable and the agent image exists:

```bash
docker image ls clawix-agent:latest
docker ps
```

### WebSocket shows "disconnected" in the dashboard

Usually a proxy/Cloudflare issue — confirm Cloudflare DNS is set to **DNS
only** (grey cloud), not proxied, and that the Caddyfile blocks in Step 5
match your domain exactly. Also check that the Caddyfile actually has the
`/ws/*` block, not just `/api/*` (see the callout in Step 5) — a plain
`curl` to the WebSocket path always 404s regardless (it only upgrades on a
real WS handshake), so that's not a useful test; use:

```bash
curl -i -N --http1.1 -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://gracemission.aibyml.uk/ws/chat
```

`HTTP/1.1 101 Switching Protocols` means routing is fine; anything else
(404, 502, or a TLS error) means Caddy isn't reaching the API on that path.

### Repeated `401 "No refresh token"` errors / users get logged out silently

The refresh-token cookie's `Path` is set server-side, but the browser only
ever honors it against the URL _it_ actually requested. If your reverse
proxy rewrites paths (e.g. this repo's `handle_path /api/*` strips the
prefix before forwarding), a cookie scoped to a path the browser never
calls directly (e.g. bare `/auth`) gets silently dropped and every refresh
fails. Confirm what's actually being set:

```bash
curl -sk -i -X POST https://gracemission.aibyml.uk/api/auth/login \
  -H "Content-Type: application/json" -d '{"email":"...","password":"..."}' \
  | grep -i set-cookie
```

The `Path=` attribute should be `/` (or at minimum match every prefix the
browser actually calls this API through) — this repo's `auth.constants.ts`
already sets `REFRESH_COOKIE_PATH = '/'` for exactly this reason.

### Agent replies fail with `401`/`403` from the LLM provider despite a correct-looking `.env`

Two independent traps, both covered above (Step 4's model-access callout
and Step 7's provider-key callout) — in short: **`.env` is not authoritative
after first boot.** `DEFAULT_LLM_MODEL` only affects newly-seeded agents
(each `AgentDefinition` row keeps its own `model` value once created), and
`OPENAI_API_KEY`/`ANTHROPIC_API_KEY` only seed the DB's `ProviderConfig`
once, ever. If something looks wrong at the LLM-call layer, check the
_database_ state (agent's `model` column, Settings → Providers), not just
`.env`.

---

## Cost recap

| Item                                    | Monthly                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| Hetzner CX22 VPS                        | ~$4                                                       |
| Domain (amortized, if newly registered) | ~$1                                                       |
| Caddy, Docker, TLS                      | $0                                                        |
| **Infra total**                         | **~$5/mo**                                                |
| LLM API usage                           | variable — dominates the bill; pick a cheap default model |
