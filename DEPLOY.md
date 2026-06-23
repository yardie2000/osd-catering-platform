# OSD Catering Platform — Internes Deployment (Docker)

Selbst gehostet, im LAN, kostenlos. Frontend + API laufen im Container; die
Datenbank bleibt das (kostenlose) Supabase-Cloud-Projekt.

> **Zugriff:** nur im lokalen Netzwerk. Nicht ins offene Internet weiterleiten
> (Port-Forwarding), solange es kein Login + verschärfte Supabase-Regeln gibt.

---

## Voraussetzungen
- Docker (Synology **Container Manager** ab DSM 7.2, oder Docker auf dem Mac Mini).
- Den Code auf dem Host: `git clone https://github.com/yardie2000/osd-catering-platform.git`
  (privates Repo → GitHub-Login/Token nötig) **oder** den Projektordner dorthin kopieren
  (ohne `node_modules` und `.next`).

## 1. Umgebungsvariablen anlegen
Im Projektordner `.env.docker.example` nach **`.env`** kopieren und die echten Werte
aus Deiner `.env.local` eintragen (`.env` ist gitignored, wird nie hochgeladen):

```
cp .env.docker.example .env      # dann .env editieren
```

## 2a. Mac Mini (Terminal)
```
cd <projektordner>
docker compose up -d --build
```
Öffnen: `http://<mac-mini-ip>:3000`

## 2b. Synology (Container Manager, GUI)
1. Projektordner (mit `docker-compose.yml` **und** der ausgefüllten `.env`) in eine
   Freigabe legen, z. B. `/docker/osd-catering`.
2. **Container Manager → Projekt → Erstellen**.
3. Projektname `osd-catering`, Pfad auf den Ordner zeigen, `docker-compose.yml` wählen.
4. **Erstellen/Build** starten (dauert beim ersten Mal einige Minuten).
5. Öffnen: `http://<synology-ip>:3000`

## Aktualisieren (neue Version einspielen)
```
git pull                         # oder neuen Ordner kopieren
docker compose up -d --build
```

## Host-IP herausfinden (für den Team-Zugriff)
- Synology: DSM → Systemsteuerung → Netzwerk (oder im Router nachsehen).
- Mac Mini: Systemeinstellungen → Netzwerk, oder `ipconfig getifaddr en0`.

Den Link `http://<host-ip>:3000` kann das Team als Lesezeichen speichern.

## Hinweise
- **Port:** Standard 3000. Falls belegt, in `docker-compose.yml` `"3001:3000"` setzen.
- **Supabase Free-Tier** pausiert nach ~1 Woche ohne Nutzung; erster Aufruf weckt es
  (~30 Sek.). Bei täglicher Nutzung kein Thema.
- **Migrationen:** Schema-Änderungen (inkl. der DROP-Migration in `supabase/migrations/`)
  im Supabase-SQL-Editor ausführen — der Container ändert die DB nicht selbst.
- **Kein Geld nötig:** Docker + Supabase-Free reichen für den internen Betrieb.
