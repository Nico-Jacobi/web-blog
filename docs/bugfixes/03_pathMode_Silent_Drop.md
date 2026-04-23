# Fix #3: `pathMode`-Silent-Drop in `/me/blog` PATCH

## Symptom
In [server/routes/me.js:70](../../server/routes/me.js#L70):
```js
if (parsed.data.settings !== undefined) {
  delete parsed.data.settings.pathMode;
  ...
}
```
Schema [server/schemas/blogSettings.js:22](../../server/schemas/blogSettings.js#L22) deklariert `pathMode` als optional zulässig. Der Editor-Patch-Handler streicht das Feld aber silent. Clientseitiger Versuch, `pathMode` nachträglich zu ändern, schlägt ohne Fehlermeldung fehl.

## Designfrage
Warum existiert dieser `delete`? Mögliche Absichten:
1. **pathMode soll nur bei Registrierung setzbar sein** — Website erwartet pro Blog einen konstanten Rendering-Mode, Änderung würde Inkonsistenz zwischen bereits gerenderten Tracks und neuen Daten verursachen.
2. **Oversight** — wurde während Development eingebaut und vergessen.

Basierend auf dem Register-Flow in [flutter_app/lib/services/auth_service.dart:124](../../flutter_app/lib/services/auth_service.dart#L124) wird pathMode tatsächlich nur bei Register gesetzt, nirgendwo sonst im Flutter-Client gepatched. Also vermutlich Absicht #1.

## Entscheidung
**Silent-Drop → Explizite Rejection.** Das Schema muss die Wahrheit sagen:
- `blogSettingsPatchSchema` soll `pathMode` **nicht** erlauben.
- Bei Register ist `blogSettingsSchema` (strict, inkl. `pathMode`) ok.
- Der `delete` in me.js fliegt raus.

## Implementation Steps

1. **`server/schemas/blogSettings.js`**:
   - `blogSettingsSchema.partial()` liefert aktuell alle Felder optional inkl. `pathMode`. Stattdessen:
   ```js
   const blogSettingsPatchSchema = blogSettingsSchema
     .omit({ pathMode: true })
     .partial();
   ```
   - `strict()` am Ende behalten → Zod weist unbekannte Felder (inkl. `pathMode`) mit 400 ab.

2. **`server/routes/me.js:70`**:
   - `delete parsed.data.settings.pathMode;` entfernen. Schema schützt jetzt.

3. **Test** in `server/__tests__/settings.test.js`:
   - `PATCH /me/blog` mit `settings.pathMode` → erwartet `400 Bad Request`.
   - `PATCH /me/blog` mit `settings.theme` → erwartet `200` + Wert angewendet (Regression-Check).

4. **Dokumentation**: kurzer JSDoc-Kommentar am Schema, warum `pathMode` Patch-immutable ist.

## Betroffene Dateien
- `server/schemas/blogSettings.js`
- `server/routes/me.js`
- `server/__tests__/settings.test.js`

## Risiken
- **Breaking Change auf Wire-Ebene**: Ein Client, der bisher `pathMode` mitschickt (bewusst oder weil es automatisch aus einem Full-Settings-Payload kommt), bekommt jetzt 400 statt 200. Aktuell tut niemand das → OK. Wenn sich das ändert, muss der Client das Feld auf Patch-Pfaden ausfiltern.
- Tests abdecken.

## Alternative
Falls die Design-Entscheidung "pathMode soll patchbar sein" ist: `delete`-Line in me.js entfernen, keine weiteren Änderungen. Das Schema ist dann schon korrekt.
