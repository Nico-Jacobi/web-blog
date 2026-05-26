# Plan 04: i18n-Integration (Strings ersetzen)

## Ziel
Alle hardcodierten Strings in den Komponenten durch `t('key')`-Aufrufe ersetzen.

## Geänderte Dateien (7)
- `website/src/components/Header.jsx`
- `website/src/components/Sidebar.jsx`
- `website/src/components/StopCard.jsx`
- `website/src/components/PointDetail.jsx`
- `website/src/components/PasswortGate.jsx`
- `website/src/components/GalleryGrid.jsx`
- `website/src/components/HeroSection.jsx`

## Abhängigkeiten
- Plan 01 muss fertig sein (`useSettings` und `t()` verfügbar)

---

## Implementierungsschritte

Jede Komponente braucht am Anfang:
```jsx
import { useSettings } from '../context/SettingsContext';
// ...innerhalb der Komponente:
const { t } = useSettings();
```

---

### Schritt 1: Header.jsx

```jsx
// Alt:
"Laden…"
// Neu:
{t('header.loading')}
```

---

### Schritt 2: Sidebar.jsx

```jsx
// Alt:
"Reiseverlauf"
"Stopps"
// Neu:
{t('sidebar.journey')}
{t('sidebar.stops')}
```

---

### Schritt 3: StopCard.jsx

```jsx
// Alt:
"Neu"
// Neu:
{t('stopCard.new')}
```

---

### Schritt 4: PointDetail.jsx

```jsx
// Alt:
"Loslassen zum Neuladen"
"Zum Neuladen ziehen"
"Was hier passiert ist"
"Reisetag"
"Standort"
"Breitengrad:"
"Längengrad:"

// Neu:
{t('pointDetail.releaseToRefresh')}
{t('pointDetail.pullToRefresh')}
{t('pointDetail.whatHappened')}
{t('pointDetail.travelDay')}
{t('pointDetail.location')}
{t('pointDetail.latitude')}
{t('pointDetail.longitude')}
```

---

### Schritt 5: PasswortGate.jsx

```jsx
// Alt:
"🔒 Passwort:"
placeholder="Passwort"
"Zugriff verweigert!"
"Freischalten"

// Neu:
{t('passwordGate.title')}
placeholder={t('passwordGate.placeholder')}
{t('passwordGate.denied')}
{t('passwordGate.unlock')}
```

---

### Schritt 6: GalleryGrid.jsx

```jsx
// Alt:
"Galerie"
"DATEI"
"DATEIEN"

// Neu:
{t('gallery.title')}
// Plural-Logik:
{count === 1 ? t('gallery.file') : t('gallery.files')}
```

---

### Schritt 7: HeroSection.jsx

```jsx
// Alt:
"Bild wird geladen..."
// Neu:
{t('hero.loading')}
```

---

## Hinweis: Locale-abhängige Datumsformatierung

In Header.jsx und anderen Stellen wird `toLocaleString('de-DE')` genutzt.
Ersetzen mit:
```jsx
const { locale } = useSettings();
// ...
date.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', options)
```

---

## Schnittstellen

| Output | Konsumenten |
|--------|-------------|
| Alle UI-Strings dynamisch via `t()` | Kein weiterer Aufrufer |
| `locale`-State aus SettingsContext | Datums-Formatierung |
