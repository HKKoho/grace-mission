# Google Drive — Auth Reference

This file is for the agent to read when it needs to explain authentication options to the user in more detail. Do not show this whole file to the user — extract only what is relevant to their situation.

---

## What is an OAuth access token?

A temporary password that proves to Google "this person has given permission to access their Drive." It lasts about 1 hour. It is NOT the user's Google password — it cannot be used to change account settings, send emails, or do anything outside Drive (when scoped to Drive only).

---

## Option A — OAuth Playground (recommended for most users, no setup)

Best for: anyone who just needs to grab files once or occasionally.

Steps:
1. Open `https://developers.google.com/oauthplayground/` (no login required to open the page)
2. Left panel → scroll to **Drive API v3** → expand → tick:
   - `https://www.googleapis.com/auth/drive.readonly` (read-only — safest)
3. Click **Authorize APIs** (blue button top-right of left panel)
4. Google sign-in page opens → sign in with the Google account the file was shared with
5. Review permissions → click **Allow**
6. Back in Playground → click **Exchange authorization code for tokens**
7. Copy the value next to **Access token** — it starts with `ya29.`

Paste that token into the chat. The agent will use it immediately.

Note: the token expires in ~1 hour. If you need to download files in a later session, repeat these steps.

---

## Option B — gcloud CLI (for users who already have Google Cloud SDK)

Best for: developers who already have `gcloud` installed.

```bash
gcloud auth login                          # sign in once
gcloud auth print-access-token            # paste this output into the chat
```

Run `gcloud auth print-access-token` each time you need a fresh token.

---

## Option C — Service Account JSON key (for recurring automated access)

Best for: ongoing automation where a human cannot manually approve each session.

Setup (done once by an admin):
1. Go to `https://console.cloud.google.com/`
2. Create a project (or use an existing one)
3. Enable the **Google Drive API** for the project
4. Go to **IAM & Admin → Service Accounts → Create Service Account**
5. Download the JSON key file
6. The owner of the Drive file/folder must share it with the service account's email address (it looks like `name@project-id.iam.gserviceaccount.com`)

Using the key:
- Store the JSON key content as a Clawix encrypted secret named `GDRIVE_SERVICE_ACCOUNT_KEY`
- The agent reads it, extracts the `client_email` and `private_key`, generates a JWT, and exchanges it for a Bearer token via:
  ```
  web.fetch("https://oauth2.googleapis.com/token", method=POST, body={
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: {signed JWT}
  })
  ```
- This gives a Bearer token valid for 1 hour, which the agent uses exactly like Option A/B

When to use: nightly imports, recurring data pulls, or any agent that runs on a schedule without a human present. Not needed for one-off downloads — use Option A instead.

---

## Scopes — what to request

| Scope | Access level | When to use |
|---|---|---|
| `drive.readonly` | Read any file in Drive | Standard choice — can read but not modify |
| `drive.file` | Only files created by this app | Too restrictive for shared files — avoid |
| `drive` | Full read/write | Only if the agent also needs to write back to Drive |

Always use `drive.readonly` unless there is a specific reason to write back to Drive.
