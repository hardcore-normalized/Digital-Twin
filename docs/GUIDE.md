# Digital Twin: install and user guide

This guide walks you from zero to a working Digital Twin: installing it, trying the demo company, connecting your own Claude Enterprise organization, and using it day to day.

Just want to look around first? Open the **[live demo](https://digital-twin-rose-rho.vercel.app/app/acme)** in your browser. Nothing to install.

**Contents**

1. [What you need](#1-what-you-need)
2. [Install](#2-install)
3. [First run: create your account and zone](#3-first-run-create-your-account-and-zone)
4. [Connect your own keys](#4-connect-your-own-keys)
5. [Using Digital Twin](#5-using-digital-twin)
6. [For the people being tracked](#6-for-the-people-being-tracked)
7. [Inviting your team and signing in](#7-inviting-your-team-and-signing-in)
8. [Running it for your whole company](#8-running-it-for-your-whole-company)
9. [Updating, backing up and starting over](#9-updating-backing-up-and-starting-over)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. What you need

| You need | Why | Where to get it |
|---|---|---|
| A computer with macOS, Windows or Linux | Digital Twin runs on your own machine or server | — |
| **Node.js 20 or newer** | Runs the app | [nodejs.org](https://nodejs.org) (pick the "LTS" version) |
| **Git** (optional) | Downloads the code and makes updating easy | [git-scm.com](https://git-scm.com/downloads). Skip it and use the ZIP download instead. |

To use it with your real company data, you'll also need:

| Key | Required? | Who can create it |
|---|---|---|
| Claude Enterprise **Analytics API key** | Yes, to import your company's usage | The **Primary Owner** of your Claude Enterprise organization |
| An **AI model** key | No. It turns on twin chat and AI-written progress notes. | Anyone: a Claude API key, another provider's key, or a free local model with no key at all |
| **Storage** | No. The built-in database is used by default. | Your own S3 bucket, storage API, or a folder |

You don't need any keys to try the demo company.

To check your Node.js version, open a terminal (Terminal on macOS, PowerShell on Windows) and run:

```bash
node --version
```

It should print `v20` or higher.

## 2. Install

### Option A: with Git (recommended)

```bash
git clone https://github.com/hardcore-normalized/Digital-Twin.git
cd Digital-Twin
npm install
npm run dev
```

### Option B: without Git

1. Open the [GitHub page](https://github.com/hardcore-normalized/Digital-Twin), click the green **Code** button, then **Download ZIP**.
2. Unzip it, then open a terminal in the unzipped folder (`Digital-Twin-main`).
3. Run:

   ```bash
   npm install
   npm run dev
   ```

### What happens on first start

- `npm install` downloads the libraries Digital Twin uses. It takes a minute or two the first time.
- `npm run dev` creates a settings file called **`.env.local`** with fresh secret keys, then starts the app. Keep this file private, and back it up (see [section 9](#9-updating-backing-up-and-starting-over)).
- The terminal prints an address, usually **http://localhost:3000** (or 3001 if 3000 is busy). Open it in your browser.
- No database setup is needed. Data is stored in the `.data/` folder inside the project.

Leave the terminal window open while you use the app. Closing it stops Digital Twin. To start it again later, open a terminal in the same folder and run `npm run dev`.

## 3. First run: create your account and zone

1. Open the address from the terminal and click **Get started**.
2. Create an account with your email and a password (8+ characters).
3. **Verify your email.** Unless you've set up email sending (`SMTP_URL`), the verification email isn't sent. Instead, it's printed in the terminal where the app is running. Look for `[email] SMTP_URL is not set` and open the link below it.
4. **Create your zone.** A zone is the shared space for one company. Enter your company name, then choose:
   - **Explore with demo data**: a fictional 14-person company (Acme) with 45 days of usage, check-ins and twins. This is the best way to learn the app.
   - **Connect Claude Enterprise**: takes you to **Setup** to add your own keys.

You can have both: make a demo zone to play with, then a second zone for your real company. Switch zones by clicking the company name at the top of the sidebar.

## 4. Connect your own keys

Open **Setup (your keys)** in the sidebar. There are three steps. Each key is tested before it's saved and is encrypted at rest. Any usage of a key is billed by the provider that issued it, straight to you. Digital Twin itself is free.

### Step 1: Claude Enterprise Analytics key (required)

This read-only key lets Digital Twin see who uses Claude and how much. It can't read anyone's conversations.

1. The organization's **Primary Owner** signs in at [claude.ai](https://claude.ai).
2. Go to **Organization settings → API**, turn on API access, and create an **Analytics API key** (scope `read:analytics`).
3. Paste it into **Analytics API key** on the Setup page and save.

Good to know:
- Claude publishes a day's activity around 13:00–13:30 UTC the next day. Today's numbers appear tomorrow.
- Costs appear within about 4–24 hours and can be revised until about 7 days after the month ends. Every sync re-reads the last few days to pick up changes.
- People appear once they've used Claude. Someone who has a seat but has never used it may not show up yet. You can add them by hand with **Add a person manually** at the bottom of **People & twins**.

### Step 2: AI model (optional)

The AI model answers questions in twin chat and keeps each person's PROGRESS.md up to date. One key does both. Without a model, everything else still works: usage, spend, USAGE.md and AUDIT_LOG.md are generated by code, and PROGRESS.md gets a plain summary instead of an AI-written one.

Choose a provider in **Setup** or **Settings → AI & privacy**:

| Provider | What to enter |
|---|---|
| **Claude (Anthropic)** | A Claude API key from [platform.claude.com](https://platform.claude.com). Pick Opus (best answers), Sonnet (faster, cheaper) or Haiku (fastest, cheapest). |
| **OpenAI**, **Google Gemini**, **OpenRouter** | That provider's API key and a model name |
| **Ollama** (free, runs on your computer) | No key. Install [Ollama](https://ollama.com), download a model (for example `ollama pull llama3.2`), and enter that model name. The address `http://localhost:11434/v1` is filled in for you. |
| **LM Studio** (free, runs on your computer) | No key. Start LM Studio's local server and enter the model name. The address `http://localhost:1234/v1` is filled in for you. |
| **Other OpenAI-compatible server** | Its address, key (if any) and model name (for example vLLM) |

Models that support **tool calling** give the best twin answers, because the twin looks up exact numbers with tools instead of guessing.

Local models only work while that computer and the model are running. When they're not, twin chat says it can't reach the model and progress notes fall back to plain summaries. Nothing breaks.

### Step 3: File storage (optional)

Twin files are stored in Digital Twin's own database by default. To keep them somewhere you control instead, choose:

- **S3-compatible bucket**: AWS S3, Cloudflare R2 or MinIO.
- **Your own storage API**: four simple endpoints. See the Storage API page on the website, or run the example server in `examples/storage-api/`.
- **A folder on the server**: plain markdown files on disk.

When you switch, Digital Twin tests the new storage first (write, read, delete) and can copy your existing files over.

### Run your first sync

Click **Run first sync** at the end of Setup, or **Sync now** on the Overview page. The first sync imports the last 30 days and creates a twin for everyone it finds.

## 5. Using Digital Twin

The sidebar is split into **Analytics**, **People** and **Settings**.

### Overview

The headline numbers: people tracked, who's active this week, spend this month, lines written with Claude Code, daily spend by product, daily active people, idle seats (no activity for 14+ days), top spenders, and recent activity.

### Usage & spend

Usage and cost for the last 30 days, split by product, by team and by person. Use it to see where the money goes and which seats aren't used.

### People & twins

Everyone in the zone with their 30-day usage. From here you can:

- **Search** by name, email or team.
- **Add a person manually** (at the bottom): track someone by hand, for example someone who hasn't used Claude yet.
- **Export CSV**: download the table.
- Click a person to open their page, which has five tabs:

| Tab | What's there |
|---|---|
| **Ask the twin** | Chat with the person's twin (needs an AI model). Try "What has Priya been working on this week?" or "Summarize her last two weeks for a 1:1". |
| **Twin files** | The four markdown files below, each with a **History** of earlier versions you can restore. |
| **Usage** | Their daily spend and activity |
| **Activity** | Events such as check-ins and usage spikes |
| **Settings** | Name, team, title and status |

**Rebuild PROGRESS.md** (top right) rewrites the progress file from scratch using all of the person's data.

### The four twin files

| File | Written by | What it holds |
|---|---|---|
| **ABOUT.md** | The person (or an admin). AI never edits it. | Role, current projects, how they like to work |
| **PROGRESS.md** | The AI model, after each sync | A running summary of what they've been working on |
| **USAGE.md** | Code, after each sync | Exact usage and cost numbers |
| **AUDIT_LOG.md** | Code, append-only | Every question anyone asked this twin, and when |

The twin answers from these files plus exact numbers it looks up in the database. It never sees anyone's Claude conversations.

### Audit log

Everything that happened in the zone: syncs, keys added or removed, people added, usage spikes (3× someone's usual daily spend, and at least $5), and every question asked to a twin.

### Automatic sync

Each zone syncs once a day automatically, by default at **2:00 PM** in the timezone of whoever created it. To change the time or turn it off, go to **Settings → Connections → Automatic sync**. You can always click **Sync now** for an immediate update.

The app has to be running at that time. If it was off, the sync runs as soon as it's back on. A failed sync is retried every hour.

## 6. For the people being tracked

Each person gets a twin, and Digital Twin is built so they can see what's said about them:

- They sign in with their **work email** (the same one their Claude seat uses). Once the email is verified, they get access to **My twin** automatically.
- **My twin** shows their own files and usage, and nobody else's.
- They can **post check-ins**: short updates such as "Finished the refunds retry logic." These feed into PROGRESS.md at the next sync.
- They can **edit ABOUT.md** to describe their role and projects in their own words.
- They can read their **AUDIT_LOG.md** to see every question anyone asked their twin.

## 7. Inviting your team and signing in

### Giving access

Go to **Settings → Access → Give access**, enter an email and choose **Admin** or **Member**:

| Role | Can see |
|---|---|
| **Owner** | The person who created the zone. Everything an admin can, plus deleting the zone. |
| **Admin** | Everyone's usage and twins, and all settings |
| **Member** | Only their own twin |

People who appear in your usage data don't need an invite: they get Member access to their own twin as soon as they sign in with that work email and verify it.

Invites aren't emailed yet, so tell the person to sign up at your Digital Twin address with that email. Access is only granted to **verified** email addresses, so nobody can claim someone else's access by signing up with their email.

### Sign-in options

Email and password, plus passkeys (Face ID, Touch ID, Windows Hello), always work. You can also turn on:

- **Google, Microsoft, Apple, GitHub or Slack**: add that provider's client ID and secret to `.env.local` (see `.env.example` for names and the redirect URL), then restart the app.
- **Company SSO (Okta, Microsoft Entra, Google Workspace or any OIDC provider)**: set it up in **Settings → Access → Company single sign-on**. It turns on after you prove you own the email domain by adding a DNS TXT record and clicking **Check DNS**.

## 8. Running it for your whole company

`npm run dev` is for trying it out on your own computer. For a team, run Digital Twin on a machine that stays on (a small cloud server or an office computer), so everyone can reach it and the daily sync runs.

1. Install Node.js and the code on the server, as in [section 2](#2-install).
2. Edit `.env.local` (created on first run, or copy `.env.example`):
   - `BETTER_AUTH_URL`: the address people will use, for example `https://twin.yourcompany.com`
   - `DATABASE_URL` (recommended): a PostgreSQL database, for example `postgres://user:password@host:5432/digital_twin`. Leave it empty to keep using the built-in database in `.data/`.
   - `ALLOW_LOCAL_ENDPOINTS=true`: only if you use a local model (Ollama, LM Studio) or folder storage on that server.
   - `SMTP_URL` and `EMAIL_FROM` (optional): to send verification emails for real.
3. Build and start it:

   ```bash
   npm run build
   npm start
   ```

4. Put it behind HTTPS (for example with Caddy, nginx or your cloud provider's load balancer). Passkeys and most sign-in providers require HTTPS.

On serverless hosting (where the app isn't always running), or with more than one server, set `DISABLE_SCHEDULER=true` and have a scheduler call this every 15 minutes:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://twin.yourcompany.com/api/cron/sync
```

## 9. Updating, backing up and starting over

**Update to the latest version**

```bash
git pull
npm install
npm run dev     # or: npm run build && npm start
```

Database changes are applied automatically when the app starts. If you downloaded the ZIP, download it again and copy your `.env.local` and `.data/` folder into the new folder.

**Back up**

- **`.env.local`** holds your secrets, including `ENCRYPTION_KEY`. If you lose it, the saved keys can't be decrypted and you'll need to enter them again.
- **`.data/`** is the built-in database (if you don't use `DATABASE_URL`).

**Start over**

Stop the app, delete the `.data/` folder, and start it again. This deletes all accounts, zones and data in the built-in database.

## 10. Troubleshooting

| Problem | What to do |
|---|---|
| `node: command not found`, or an error about the Node version | Install Node.js 20+ from [nodejs.org](https://nodejs.org), then open a new terminal. |
| The app opened on port 3001 or another port | Something else is using port 3000. Use the address the terminal prints. |
| I didn't get the verification email | Without `SMTP_URL`, it's printed in the terminal running the app. Look for `[email]`. |
| "Claude rejected this key" | It must be an **Analytics** API key (`read:analytics`), created by the Primary Owner at claude.ai → Organization settings → API. A regular Claude API key won't work here. |
| Yesterday's usage is missing | Claude publishes each day's activity around 13:00–13:30 UTC the next day. The default 2 PM sync is timed for that. |
| Someone is missing from People | They haven't used Claude yet. Add them by hand with **Add a person manually** at the bottom of People & twins. |
| "You're not tracked in this zone" on My twin | The email you signed in with doesn't match the one in the usage data. Sign in with your work email, or ask an admin to check your email in People. |
| Twin chat says it can't reach the model | For Ollama or LM Studio, make sure it's running and the model name matches exactly. For cloud providers, check the key and model name in **Settings → AI & privacy**. |
| "Local addresses and folders are turned off on this server" | In production, local models and folders are off by default. Set `ALLOW_LOCAL_ENDPOINTS=true` in `.env.local` and restart. |
| "A sync is already running" | Wait a few minutes. A sync stuck for 30+ minutes is cleared automatically. |
| The automatic sync didn't run | The app must be running at the scheduled time. It catches up when it starts again. Check the time and timezone in **Settings → Connections**. |

Still stuck? [Open an issue](https://github.com/hardcore-normalized/Digital-Twin/issues) and describe what you did and what you saw (leave out any keys).

---

If Digital Twin is useful to you, please ⭐ [star it on GitHub](https://github.com/hardcore-normalized/Digital-Twin). It helps other people find it.
