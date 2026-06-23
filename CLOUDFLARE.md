# Externer Zugang über Cloudflare Tunnel + Access (kostenlos)

Ziel: Mitarbeiter erreichen die App von überall unter z. B.
`https://catering.deine-domain.de` — aber **nur freigeschaltete E-Mail-Adressen**
kommen rein. Keine Router-Port-Freigabe, kostenlos bis 50 Nutzer.

Der Tunnel-Container (`cloudflared`) steckt schon in `docker-compose.yml`. Du
brauchst nur einen **Token** aus dem Cloudflare-Dashboard.

---

## A. Cloudflare-Konto + Domain (einmalig)
1. Kostenloses Konto: <https://dash.cloudflare.com> → registrieren.
2. **Add a site** → Deine Strato-Domain eingeben → Plan **Free**.
3. Cloudflare zeigt **zwei Nameserver** (z. B. `xyz.ns.cloudflare.com`).
4. Bei **Strato** (Domain-Verwaltung → Nameserver) die Nameserver der Domain auf
   die zwei Cloudflare-Nameserver ändern. Aktivierung dauert bis zu ein paar Stunden.

## B. Zero Trust aktivieren
5. Im Dashboard links **Zero Trust** öffnen → Team-Namen wählen → Plan **Free**
   (ggf. wird einmalig eine Karte abgefragt, es wird **nichts** berechnet).

## C. Tunnel erstellen → Token holen
6. Zero Trust → **Networks → Tunnels → Create a tunnel** → Typ **Cloudflared** →
   Name `osd-catering` → **Save**.
7. Es erscheint ein **Token** (sehr langer String, im „run"-Befehl enthalten als
   `--token eyJ...`). **Nur den Token-Teil** kopieren → in die `.env` auf dem Host:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=eyJ...
   ```
   (Den angezeigten Installationsbefehl brauchst Du NICHT — unser Container nutzt den Token.)
8. Weiter zu **Public Hostnames → Add a public hostname**:
   - **Subdomain:** `catering`
   - **Domain:** Deine Domain
   - **Type:** `HTTP`  · **URL:** `app:3000`
   - **Save**

## D. Access-Regel (nur Mitarbeiter)
9. Zero Trust → **Access → Applications → Add an application → Self-hosted**.
10. **Application domain:** `catering.deine-domain.de`.
11. **Policy** anlegen: Action **Allow**, Include → **Emails** = die Mitarbeiter-Adressen
    (oder **Emails ending in** `@deine-firma.de`).
12. Speichern. Login-Methode bleibt **One-time PIN** (Cloudflare mailt einen Code) —
    kein extra Identity-Provider nötig.

## E. Starten
13. Auf dem Host (Synology/Mac Mini), `.env` mit dem Token ergänzt:
    ```
    docker compose up -d --build
    ```
14. Mitarbeiter öffnen `https://catering.deine-domain.de` → E-Mail eingeben →
    Code aus der Mail → drin. Fremde E-Mails werden abgewiesen.

---

## ⚠️ Wichtig zur Sicherheit (bitte lesen)
Cloudflare Access schützt die **App-Oberfläche**. Die **Supabase-Datenbank** ist aber
ein eigener, direkt erreichbarer Internet-Dienst, und ihre Regeln sind aktuell **offen**
(öffentlicher anon-Schlüssel = Voll-Zugriff). Wer den Schlüssel aus dem Browser eines
eingeloggten Mitarbeiters zieht, könnte die DB **an Cloudflare vorbei** erreichen.

→ Für echten Schutz sollte als **nächster Schritt** „App-Login + DB-Sperre"
(Supabase Auth + RLS auf „nur angemeldet") nachgerüstet werden. Cloudflare Access ist
eine starke erste Schicht, aber nicht der komplette Schutz der Daten.
