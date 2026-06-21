# Wedding Uploader

Statisches Frontend (HTML/CSS/JS) + Google Apps Script Backend.
Gäste scannen QR-Code → öffnen Seite → laden Fotos hoch → Dateien landen in deinem **privaten** Google Drive.

---

## Setup-Schritte

> ⚠️ **Alles unten mit deinem PRIVATEN Google-Account machen, nicht mit syte.**

### 1. Drive-Ordner anlegen
1. In deinem privaten Drive einen Ordner anlegen, z.B. `Hochzeit – Gästefotos`.
2. Ordner öffnen → die ID aus der URL kopieren:
   `drive.google.com/drive/folders/<DAS IST DIE FOLDER_ID>`

### 2. Apps Script anlegen
1. https://script.google.com → "Neues Projekt".
2. Inhalt aus `apps-script.gs` reinkopieren.
3. Oben in der Datei eintragen:
   - `FOLDER_ID` → ID aus Schritt 1
   - `UPLOAD_KEY` → eine zufällige Zeichenkette, z.B. mit
     ```bash
     openssl rand -hex 16
     ```
4. Speichern (💾-Icon oder ⌘S).

### 3. Web App deployen
1. Rechts oben "Deploy" → "New deployment".
2. Zahnrad → Typ "Web app".
3. Einstellen:
   - **Execute as:** Me (dein privater Account)
   - **Who has access:** Anyone
4. "Deploy" → Apps Script fragt nach Berechtigungen für Drive → erlauben.
5. **Web App URL** kopieren — sieht aus wie
   `https://script.google.com/macros/s/AKfycb…/exec`.

### 4. Frontend konfigurieren
In `app.js` oben im `CONFIG`-Block eintragen:
```js
scriptUrl: "https://script.google.com/macros/s/AKfycb…/exec",
uploadKey: "DER GLEICHE STRING WIE IN APPS-SCRIPT.GS",
partnerName: "Name der*des Partner*in",
weddingDate: "15. August 2026",
```

### 5. Lokal testen
```bash
cd ~/Documents/wedding-uploader
python3 -m http.server 8000
```
→ http://localhost:8000 öffnen, ein paar Fotos hochladen, in Drive checken.

### 6. Auf GitHub Pages hosten
1. Neues **privates GitHub-Repo** unter deinem privaten GitHub-Account anlegen
   (nicht via `syte-tech`!), z.B. `wedding-uploader`.
2. ```bash
   cd ~/Documents/wedding-uploader
   git init
   git add .
   git commit -m "Initial wedding uploader"
   git branch -M main
   git remote add origin git@github.com:<dein-private-user>/wedding-uploader.git
   git push -u origin main
   ```
3. Im Repo: **Settings → Pages → Source: Deploy from a branch → Branch: main / root → Save**.
4. Nach 1–2 Minuten ist die Seite live unter
   `https://<dein-private-user>.github.io/wedding-uploader/`.

> Da `app.js` den `uploadKey` und die `scriptUrl` enthält, kann theoretisch
> jeder, der die GitHub-Pages-URL kennt, hochladen. Für eine Hochzeit ist das
> i.d.R. okay (du verteilst die URL ja eh als QR-Code an die Gäste). Wenn das
> Repo öffentlich ist, sieht man die Werte natürlich auch ohne QR. Drei Optionen:
> - Repo privat halten (GitHub Pages funktioniert nur mit Pro/Team auf privaten Repos)
> - Domain unauffällig wählen
> - Zusätzliches Rate-Limit / Token im Apps Script einbauen (siehe unten)

### 7. QR-Code generieren
- https://qrcode-monkey.com/ oder
- Terminal:
  ```bash
  brew install qrencode
  qrencode -o wedding-qr.png "https://<dein-private-user>.github.io/wedding-uploader/"
  ```
- Drucken, auf Tischkarten / Programmheft / Eingangs-Schild kleben.

---

## Updates am Code

- Frontend-Änderungen: einfach `git push`, GitHub Pages aktualisiert automatisch.
- Apps-Script-Änderungen: nach jedem Speichern in
  **Deploy → Manage deployments → ⚙️ Edit → Version: New version → Deploy**.
  Sonst läuft die alte Version weiter.

---

## Erweiterungs-Ideen (optional, nicht für den Prototyp)

- **Foto-Wall**: Apps Script schreibt zusätzlich Dateinamen + Link in ein
  Google Sheet, eine zweite statische Seite liest das Sheet als JSON aus und
  zeigt eine Live-Galerie auf dem Beamer.
- **Absender erfassen**: Optionales Namensfeld vor dem Upload, wird mit ins
  Apps Script geschickt und als Dateipräfix oder Metadaten gespeichert.
- **Komprimierung**: vor dem Upload im Browser ein `canvas`-Resize auf
  z.B. max. 4000px lange Kante, halbiert die Upload-Zeit deutlich.
- **Rate-Limit**: in Apps Script via `PropertiesService` einfache IP-/Zeit-Limits einbauen.
