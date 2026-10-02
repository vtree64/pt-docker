# PT Tracker self-hosted setup

## Design

- `server.js` is a Node/Express server that serves the existing static frontend and a REST API from one container.
- SQLite is stored with `better-sqlite3` in `/data/pt-tracker.sqlite` inside the container.
- API shape mirrors the old `db.js` calls:
  - `GET /api/:store`
  - `GET /api/:store/:id`
  - `PUT /api/:store/:id`
  - `POST /api/:store/bulk`
  - `DELETE /api/:store/:id`
  - `POST /api/save-exercise-and-templates`
  - `POST /api/admin/delete-exercise` (deletes an exercise and removes it from all routines atomically)
- Valid stores are `exercises`, `templates`, and `workout_logs`.
- `db.js` is now a fetch-based client with the same exported function names/signatures used by `app.js`, `editor.js`, and `seed.js`.

## Run locally or on a NAS/Raspberry Pi

```bash
cd PT
docker compose up -d --build
```

Open:

```text
http://SERVER_LAN_IP:3000/
```

Examples:

```text
http://192.168.1.50:3000/
http://raspberrypi.local:3000/
```

Data survives rebuilds in `PT/data` because `docker-compose.yml` mounts `./data:/data`.

For a local hostname, enable mDNS/Avahi on the host and use its `.local` name, or add a DHCP/static DNS entry on your router.

## Desktop admin page

A desktop-oriented page for editing exercises and routines is served at:

```text
http://SERVER_LAN_IP:3000/admin.html
```

It is best used from a PC/laptop. Features:

- Select an existing exercise from an alphabetized list, or add a new one.
- Edit the exercise name, instructions, PT category checkboxes (stretch/load per category), and muscle groups.
- Toggle which routines include the exercise, and set per-routine default sets/reps.
- Rename or delete an exercise (deleting also removes it from every routine).
- Select a routine from a second dropdown, or add a new one; this opens a dialog to rename, edit its exercises, or delete the routine.

There is also a small “Open desktop admin →” link in the Routines tab of the mobile app.

## Unraid without CLI access

Unraid's Docker UI normally pulls prebuilt images; it does not build this local `Dockerfile` from source. Publish the image to a registry first, then use the Unraid template or manual Add Container form.

### Option A: GitHub Container Registry + included template

1. Create a GitHub repo for the contents of this `PT` folder.
2. Push it to the repo's `main` branch.
3. The included workflow `.github/workflows/docker-publish.yml` builds and publishes:

   ```text
   ghcr.io/YOUR_GITHUB_USERNAME/pt-tracker:latest
   ```

4. In GitHub, make the package public if your Unraid server will pull anonymously.
5. Edit `unraid/pt-tracker.xml` and replace `YOUR_GITHUB_USERNAME` with your GitHub username.
6. In Unraid, use either:
   - Docker tab → Add Container, manually enter the image and mappings below, or
   - add/use the XML template if your Unraid setup supports custom template repositories.

Manual Unraid settings:

```text
Repository: ghcr.io/YOUR_GITHUB_USERNAME/pt-tracker:latest
Network: bridge
WebUI: http://[IP]:[PORT:3000]/
Port: host 3000 -> container 3000/tcp
Path: /mnt/user/appdata/pt-tracker -> /data
Variable: DATA_DIR=/data
```

The SQLite DB will live in `/mnt/user/appdata/pt-tracker` on Unraid.

### Option B: Docker Hub

Build/publish the image to Docker Hub instead, then use the same Unraid settings with:

```text
yourdockerhubuser/pt-tracker:latest
```

## One-time migration from IndexedDB

Open `migration.html`:

```text
http://SERVER_LAN_IP:3000/migration.html
```

Options:

1. If the page is running on the same browser origin that has your old IndexedDB data, click **Export IndexedDB JSON**, then **Import JSON to SQLite backend**.
2. If your old app used a different origin (for example `file://`, `localhost`, or a previous LAN IP), first open `migration.html` from that old origin to export the JSON file, then open the Docker-hosted `migration.html` and import it.

IndexedDB is origin-scoped, so a browser will not let `http://192.168.x.x:3000` read data stored under a different origin.

## Service worker / PWA notes

`sw.js` still caches the app shell, but bypasses cache for `/api/*` so shared backend data stays current.

Service workers generally require a secure context: HTTPS or `localhost`. Plain `http://LAN-IP` may work as a normal web app but can have degraded PWA/install behavior, especially on iOS Safari.

Practical options:

- Use it as a normal browser bookmark on `http://LAN-IP:3000`.
- Use a local reverse proxy with a trusted/self-signed certificate.
- Use a local DNS name plus LAN-only TLS if you want better installability.

## Freshness strategy

The app refetches server data on tab/view switches and when the page becomes visible again. This avoids relying on stale in-memory data when another device logs or edits workouts.

## Trade-offs versus on-device IndexedDB

- Pros: one shared history across phone/PC, easy server backup, durable container volume.
- Cons: LAN/server must be available; offline logging is no longer supported; concurrent edits are last-write-wins at the row level.
