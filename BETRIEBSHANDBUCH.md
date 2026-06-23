# OSD Catering Platform — Betriebshandbuch & Übergabe

**Version 5.0.0 · Stand 2026-06-23**
Übergabe an Chef & Team. Dieses Dokument erklärt: *Was liegt wo, was wird wie/wann
aktualisiert, wo arbeiten die Mitarbeiter, wer sichert was, und wie geht es weiter.*

---

## 1. Was ist das?

Eine Web-Anwendung zur **Kalkulation entlang der Kette „verkaufte Menüs → Produktion →
Einkauf"**: Rezepte, Zutaten, Einheiten, Menüs und wiederverwendbare **Positionen**
pflegen; daraus Produktions- und Einkaufsmengen berechnen; Daten per Excel importieren.

Die App läuft **selbst-gehostet** (eigene Hardware, keine laufenden Cloud-Kosten); die
Daten liegen in einer **Supabase-Cloud-Datenbank** (kostenloser Tarif).

---

## 2. Überblick — was liegt wo (Skizze)

```
   MITARBEITER                                  ENTWICKLER (lokaler PC)
   Browser, von überall                         D:\...\catering-platform-v4_2
        │  https://catering.osd.events                │  git push
        ▼                                              ▼
  ┌──────────────┐                               ┌──────────────┐
  │  CLOUDFLARE  │   verschlüsselter Tunnel      │   GITHUB     │  Code-Backup,
  │ DNS·SSL·     │◄──────────────────────────┐   │   (master)   │  Historie, v5.0.0
  │ Tunnel       │                           │   └──────┬───────┘
  └──────────────┘                           │          │ git pull + Build (manuell)
                                             │          ▼
                                      ┌──────────────────────────┐
                                      │      SYNOLOGY NAS        │  ← läuft 24/7
                                      │  Docker (Container Mgr)  │
                                      │  ┌────────────────────┐  │
                                      │  │ App-Container :3000 │  │ ← intern:
                                      │  │ cloudflared        │  │   http://NAS-IP:3000
                                      │  └─────────┬──────────┘  │
                                      └────────────┼─────────────┘
                                                   │ liest / schreibt Daten
                                                   ▼
                                          ┌──────────────────┐
                                          │     SUPABASE     │  Datenbank (Cloud):
                                          │  (Cloud-DB, frei)│  Rezepte, Menüs,
                                          └──────────────────┘  Positionen, Zutaten …
```

| System | Wofür | Wo / Zugang |
|---|---|---|
| **Lokaler PC** (Nik) | Entwicklung, Quellcode-Arbeitskopie, Tests | `D:\Downloads\files\catering-platform-v4_2` · enthält `.env.local` (Geheimschlüssel) |
| **GitHub** | Quellcode-**Backup** + Versionshistorie | `github.com/yardie2000/osd-catering-platform` (privat) · Branch `master` · Tag `v5.0.0` |
| **Supabase** | Die **Datenbank** (alle Daten) | Cloud-Projekt `gvafnynabiplaoxphpbm` · kostenloser Tarif |
| **Synology NAS** | **Server**, betreibt die App 24/7 (Docker) | Container Manager → Projekt `osd-catering` · Ordner `/volume3/docker/osd-catering-platform-master` (enthält `.env`) |
| **Cloudflare** | **Öffentliche Adresse + HTTPS + Tunnel** | Konto `Office@osd.events` · Tunnel `osd-catering` · Domain `osd.events` |

---

## 3. Wo arbeiten die Mitarbeiter?

**Nur in der Web-App im Browser** — keine Installation nötig:

- **Von überall:** `https://catering.osd.events`
- **Intern im Büro-/NAS-Netz (alternativ):** `http://<NAS-IP>:3000`

Dort pflegen sie: **Menüs, Positionen, Rezepte, Zutaten, Einheiten**, nutzen das
**Importcenter**, **Validierung/Datenqualität** und die **Produktions-/Einkaufsausgabe**.

> ⚠️ **Sicherheit:** Die App ist aktuell **ohne Login öffentlich** erreichbar (bewusste
> Entscheidung für maximale Einfachheit). Das bedeutet: **jeder, der die Adresse kennt,
> kann alle Daten sehen und ändern.** Bei Bedarf lässt sich ein Login nachrüsten
> (siehe §8).

---

## 4. Updates — was, wie, wann, wer

Updates passieren **manuell** durch die Person, die den Code pflegt (aktuell Nik) —
nichts aktualisiert sich von allein.

### 4a. Code-Update (neues Feature / Fehlerbehebung)
1. **Lokaler PC:** Code ändern, testen (`npm run dev`), dann `git commit` + `git push`.
2. → landet auf **GitHub** (`master`).
3. **Auf der NAS einspielen:** neuen Code in den Projektordner holen
   (`git pull` **oder** neuen Stand kopieren) → **Container Manager → Projekt
   `osd-catering` → Action → Build**. Der neue Stand ist dann live.

### 4b. Datenbank-Änderung (Schema/Migration)
- SQL-Dateien aus `supabase/migrations/` im **Supabase → SQL-Editor** ausführen.
- ⚠️ Vor strukturellen Änderungen **immer erst ein Daten-Backup** (siehe §5).

### 4c. Migrationsstand
- Alle Migrationen inkl. **Phase-5-Cutover** (`20260617000000_drop_legacy_menu_items.sql`,
  Alt-Tabellen entfernt) sind **ausgeführt**. Stand aktuell.

---

## 5. Backups — wer sichert was, wann

| Was | Wichtigkeit | Wie | Wie oft | Wer |
|---|---|---|---|---|
| **Daten (Supabase)** | 🔴 kritisch | Export der Tabellen (CSV/Dump) — Free-Tarif hat **keine** automatischen Downloads | **wöchentlich** | *(festlegen, z. B. Nik)* |
| **Code (GitHub)** | 🟢 automatisch | jeder `git push` ist ein Backup inkl. Historie | bei jeder Änderung | Entwickler |
| **Geheimschlüssel** (`.env` / `.env.local`) | 🔴 kritisch | in einen **Passwort-Manager** kopieren (NICHT in Git!) | einmalig + bei Änderung | *(festlegen)* |
| **NAS** (Server + `.env`) | 🟡 wichtig | Synology **Hyper Backup**, Ordner `/volume3/docker/osd-catering…` mitsichern | wie NAS-Backup-Plan | NAS-Admin |

**Daten sichern — Backup-Skript (eingerichtet):** Der kostenlose Supabase-Tarif erstellt
**keine** herunterladbaren Backups. Dafür gibt es **`scripts/backup-supabase.cjs`** (sichert
alle Tabellen als JSON, abhängigkeitsfrei, räumt Backups > 60 Tage auf):

```
npm run backup        # oder:  node scripts/backup-supabase.cjs
```
→ legt `backups/<datum_zeit>/<tabelle>.json` an (Ordner ist gitignored).

**Wöchentlich planen** (eine Person festlegen):
- *Windows (lokaler PC):* Aufgabenplanung → wöchentlich → Programm `node`,
  Argument `scripts\backup-supabase.cjs`, „Starten in" = Projektordner.
- *Synology NAS:* DSM → Aufgabenplaner → benutzerdef. Skript →
  `node /volume3/docker/osd-catering-platform-master/scripts/backup-supabase.cjs`
  (Node-Paket im Paket-Zentrum installieren, falls nötig). Den `backups/`-Ordner über
  Hyper Backup mitsichern.

> Der **App-Server selbst** muss nicht gesichert werden — er ist aus dem Code (GitHub)
> + der `.env` jederzeit neu aufsetzbar. Entscheidend sind **Daten** und **Schlüssel**.

---

## 6. Zugänge / Konten (wer hat Zugriff?)

Für Betrieb & Weiterentwicklung nötig — bitte ausfüllen und sicher verwahren:

| System | Konto | Wer hat Zugang |
|---|---|---|
| GitHub | `yardie2000` | … |
| Supabase | *(Projekt-Eigentümer)* | … |
| Cloudflare | `Office@osd.events` | … |
| Synology (DSM) | *(NAS-Admin)* | … |
| Geheimschlüssel (.env) | Passwort-Manager | … |

---

## 7. Störung / Notfall — Checkliste

**App nicht erreichbar?**
1. **Supabase pausiert?** Der Free-Tarif pausiert nach ~1 Woche ohne Nutzung. → Erster
   Aufruf weckt sie (ca. 30 Sek.), bei häufigerem Fehler im Supabase-Dashboard prüfen.
2. **Container läuft?** Container Manager → Projekt `osd-catering` → ist `osd-catering`
   **grün**? Sonst **Start** / **Build**.
3. **Tunnel läuft?** Container `osd-cloudflared` grün? In Cloudflare → Zero Trust →
   Networks → Tunnels „connected"? Sonst Container neu starten.
4. **NAS an / im Netz?** Stromausfall/Neustart? NAS muss laufen, damit die App läuft.
5. **Intern testen:** `http://<NAS-IP>:3000` — geht das, liegt es an Cloudflare; geht es
   nicht, am Container/der NAS.

---

## 8. Weiterentwicklung

**Wie entwickeln?** Lokaler PC → ändern/testen → `git push` → auf der NAS neu bauen (§4a).
Wer das macht, braucht Zugang zu **GitHub, Supabase, NAS und Cloudflare** (§6).

**Mögliche nächste Schritte (Roadmap):**
- **Login / Zugriffsschutz nachrüsten** (empfohlen, da aktuell offen): App-Login
  (Supabase Auth) + Datenbank-Sperre, **oder** Cloudflare-Access mit Google-Login,
  **oder** ein einfaches gemeinsames Passwort.
- Größere V5-Roadmap (siehe `OSD_CATERING_PLATFORM_V5_SPEC.md`): Import-Review,
  Matching-Center, Lieferanten-/Bestelllogik, Mausclick-Import.
- **Wöchentliches Daten-Backup einplanen** (Skript vorhanden, siehe §5).

**Weitere Dokumente im Repo:** `DEPLOY.md` (NAS-Deployment), `CLOUDFLARE.md`
(externer Zugang), `OSD_CATERING_PLATFORM_V5_SPEC.md` (Feature-Roadmap),
`README.md` / `INSTALL.md`.

---

## 9. Wichtigste Adressen auf einen Blick

| Zweck | Adresse |
|---|---|
| App (extern, Mitarbeiter) | `https://catering.osd.events` |
| App (intern) | `http://<NAS-IP>:3000` |
| Quellcode | `github.com/yardie2000/osd-catering-platform` |
| Datenbank | Supabase-Dashboard → Projekt `gvafnynabiplaoxphpbm` |
| Server-Verwaltung | Synology DSM → Container Manager → `osd-catering` |
| Tunnel/Domain | Cloudflare → `Office@osd.events` |
