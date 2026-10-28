# LIFEapp

Persönliche App zur Lebensführung – optimiert fürs Handy, dunkles Design.

**Bereiche:** Kalender (Monat + Tagesblatt) · To-Dos · Aktivitäten · Habits · Abstinenz (mit Monats-Bildmosaik) ·
Ideen & Notizen (mit Foto/Audio) · Projekte · Gefühlsbuch · Traumbuch · Einstellungen mit Export & Sicherung.
Das Finanzbuch, das Belohnungssystem (km/Credits) und eine Statistikseite folgen später.

## Technik

- Web-App (PWA): React + TypeScript + Vite, lässt sich auf Android „zum Startbildschirm hinzufügen“ und läuft offline.
- **Alle Daten liegen nur auf dem Gerät** (IndexedDB im Browser). Kein Server, kein Konto.
  Deshalb in den Einstellungen regelmäßig eine **Vollständige Sicherung (JSON)** anlegen.

## Entwickeln

```bash
npm install
npm run dev        # lokaler Entwicklungsserver
npm run build      # Typprüfung + Produktions-Build nach dist/
```

## Aufs Handy bringen

Der Workflow `.github/workflows/deploy.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie über GitHub Pages.

1. In GitHub unter **Settings → Pages → Build and deployment → Source** „GitHub Actions“ wählen.
   (GitHub Pages für private Repositories setzt einen kostenpflichtigen Plan voraus. Alternativ das Repository öffentlich
   machen – es enthält nur den Code, keine persönlichen Daten.)
2. Den Stand nach `main` mergen; danach ist die App unter `https://<benutzer>.github.io/LIFEapp/` erreichbar.
3. Auf dem Android-Handy in Chrome öffnen → Menü ⋮ → **„Zum Startbildschirm hinzufügen“ / „App installieren“**.

## Bedienung in Kürze

- **Startseite:** Text eingeben und einem Bereich zuordnen (To-Do, Aktivität, Notiz, Idee, Traum, Gefühl).
  Ohne Text führen die Knöpfe direkt in den Bereich.
- **Tagesspalten** (Heute/Morgen/Übermorgen): Eintrag antippen = erledigt/unerledigt. Nach rechts wischen = zurückblättern.
- **Datumsbanner** öffnet den Monatskalender, ein Tag öffnet das Tagesblatt (Inhalt in den Einstellungen wählbar).
- **+ / −** oben auf den Bereichsseiten: neuer Eintrag / Löschen-Modus.
- **Abstinenz:** Substanzen, Startdatum und Mosaik-Bilder (mit Tags) in den Einstellungen festlegen.
  Vergessene Tage lassen sich über die Pfeile oder die Tageskreise nachtragen.
