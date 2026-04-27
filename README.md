# Travel Blog Platform

Self-hosted, interaktiver Reiseblog. Wegpunkte, Routen und Medien werden unterwegs per Flutter-App erfasst, mit einem eigenen Node.js-Server synchronisiert und auf einer passwortgeschützten React-Website auf einer interaktiven Karte angezeigt.

![Flutter](https://img.shields.io/badge/Flutter-02569B?style=flat&logo=flutter&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat&logo=leaflet&logoColor=white)

![](demo%20images/mapPopup.png)

## Architektur

```
Flutter App  ──sync──▶  fileserver.js  ◀──fetch──  React Website
(Erfassung)             (Node.js)                  (Anzeige)
```

| Verzeichnis     | Stack          | Zweck                                                 |
| --------------- | -------------- | ----------------------------------------------------- |
| `flutter_app/`  | Flutter / Dart | Mobile App zum Erfassen von Wegpunkten und Routen     |
| `website/`      | React          | Öffentliches Frontend mit Karte und Blog-Einträgen    |
| `fileserver.js` | Node.js        | API für Sync, Auth und Datei-Hosting                  |
| `scripts/`      | Node.js        | Setup, Migrationen, Wartung                           |

## Website (React + Leaflet)

<div align="center">
<table>
  <tr>
    <th>Mobile Map</th>
    <th>Detail-View</th>
    <th>Galerie (Teil der Detailview)</th>
  </tr>
  <tr>
    <td><img src="demo%20images/mobileMap.jpeg" height="480"></td>
    <td><img src="demo%20images/DetailView.jpeg" height="480"></td>
    <td><img src="demo%20images/galleryView.jpeg" height="480"></td>
  </tr>
</table>
</div>

- Wegpunkte als Marker, Routen farblich nach Verkehrsmittel
- Sidebar mit Reiseverlauf, Distanz und Transport-Icons pro Etappe
- Detail-Ansicht mit Hero-Bild, Volltext, Koordinaten und Galerie
- Lazy Loading: zunächst werden nur Vorschaubilder geladen; Originale, Videos und Detail-Inhalte erst on-demand, um Datenvolumen zu sparen
- Vollständig responsive
- Zugang über Passwort

```bash
cd website
npm install
npm run dev
```

## Flutter App

<div align="center">
<table>
  <tr>
    <th>Menü</th>
    <th>Wegpunkte verwalten</th>
    <th>Wegpunkt bearbeiten</th>
  </tr>
  <tr>
    <td><img src="demo%20images/appMenu.jpeg" height="480"></td>
    <td><img src="demo%20images/managePoints.jpeg" height="480"></td>
    <td><img src="demo%20images/editPoint.jpeg" height="480"></td>
  </tr>
</table>
</div>

- Wegpunkte mit Beschreibung, Datum, Koordinaten, Bildern und Videos
- Koordinaten optional automatisch aus EXIF-Daten der Fotos
- Routen-Editor mit Verkehrsmittel pro Etappe (Flugzeug, Boot, Bus, Wohnmobil, Auto, zu Fuß, Sonstiges)
- Offline-first: lokale Änderungen, Hintergrund-Sync sobald online

```bash
cd flutter_app
flutter pub get
flutter run
```

## Fileserver

`fileserver.js` ist das Backend für beide Clients:

- Speichert Wegpunkte, Routen und Medien
- API für Sync (App) und Read-Only (Website)
- Passwort-Auth, Medien-Auslieferung

### Setup

Der Server erwartet beim Start zwei Passwörter als Environment-Variablen — ein **Read**-Passwort für die Website und ein **Write**-Passwort für die App. Eine `.env` im Projekt-Root reicht:

```env
READ_PASSWORD=...
WRITE_PASSWORD=...
```

```bash
node fileserver.js
```

## Quick Start

1. `node fileserver.js`
2. Server-URL und Passwort in den App-Einstellungen eintragen, `flutter run`
3. `website/` deployen, Server-URL konfigurieren
4. Punkte in der App erfassen → Sync läuft automatisch → Website öffnen
