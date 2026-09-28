# JoqniX Cookie Sync

JoqniX Cookie Sync is a Manifest V3 browser extension for synchronizing browser cookies from selected services to a Cloudflare Worker.

It is designed primarily for JoqniX's automated media archiving workflows, where tools such as `yt-dlp` need access to an up-to-date Netscape-format cookie file.

## Supported Services

The extension currently supports:

- YouTube
- Google
- Twitch
- Kick

Cookies from supported root domains and their subdomains are collected.

Examples:

- `youtube.com`
- `.youtube.com`
- `music.youtube.com`
- `twitch.tv`
- `help.twitch.tv`
- `kick.com`

## Features

- Collect all accessible cookies for supported domains
- Preserve complete cookie information
- Generate Netscape HTTP Cookie File format
- Store local cookie snapshots
- Synchronize cookie snapshots with a Cloudflare Worker
- View cookie counts by service
- View generated Netscape cookie data
- Download Netscape cookie files
- Cloudflare Worker health checking
- Automatic synchronization
- Cookie-change detection with debouncing
- Periodic automatic synchronization using Chrome alarms
- Manifest V3 service worker architecture
- Token-based authentication for Cloudflare synchronization

## Architecture

```text
Browser
   │
   │ Chrome Cookies API
   ▼
JoqniX Cookie Sync
   │
   ├── Structured cookie data
   │
   └── Netscape cookie files
   │
   ▼
Cloudflare Worker
   │
   ▼
Cloudflare KV
   │
   ├── cookie-sync:youtube.com
   ├── cookie-sync:google.com
   ├── cookie-sync:twitch.tv
   ├── cookie-sync:kick.com
   └── cookie-sync:meta
