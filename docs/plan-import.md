# Format für den Plan-Import

Athlete Reboot übernimmt Pläne und Programme als JSON (Pläne-Tab → „Pläne importieren“), als Text eingefügt oder als `.json`-Datei. Nichts Bestehendes wird überschrieben: Alles kommt neu dazu, doppelte Plannamen bekommen eine Nummer.

Die vollständige Anleitung, die die App für Claude in die Zwischenablage kopiert, erzeugt `claudeInstructions()` in `src/core/planImport.ts`. Das Einlesen macht `parsePlanImport()` (Tests: `src/core/planImport.test.ts`).

## Aufbau

```json
{
  "plans": [
    { "id": "beine-a", "name": "Beine A", "type": "gym",
      "exercises": [
        { "name": "Kniebeuge", "sets": 3, "reps": "6-8", "rest": 150 },
        { "name": "Wandsitzen", "sets": 3, "seconds": "30-45", "rest": 60 },
        { "name": "Farmer's Walk", "sets": 3, "meters": "20-30", "rest": 90 }
      ] },
    { "id": "intervalle", "name": "6 × 400 m", "type": "cardio", "sport": "laufen",
      "blocks": [
        { "label": "Aufwärmen", "minutes": 10 },
        { "label": "Schnell", "meters": 400, "repeat": 6, "rest": { "seconds": 90 }, "restLabel": "Gehpause" },
        { "label": "Auslaufen", "minutes": 5 }
      ] }
  ],
  "programs": [
    { "name": "Dunken", "weeks": 8, "start": "naechste-woche",
      "days": { "mo": "beine-a", "mi": "intervalle", "fr": "beine-a" },
      "progressCardio": true, "extraSets": false }
  ]
}
```

- Gym: `reps`, `seconds` oder `meters` (Zahl oder Bereich „6-8“), `sets`, `rest` in Sekunden. Übungen werden über Name oder ID zugeordnet (Groß-/Kleinschreibung und Umlaute egal); unbekannte Namen werden eigene Übungen in „Sonstiges“.
- Ausdauer: `sport` = `laufen` | `rad` | `schwimmen`; Abschnitte mit `minutes`, `seconds`, `meters` oder `km`; `repeat` > 1 mit `rest` und `restLabel`.
- Programme: `weeks` 1–16; `start` = `diese-woche`, `naechste-woche` oder `JJJJ-MM-TT` (wird auf den Montag gelegt); `days` ordnet `mo`…`so` einem Plan zu, über dessen `id` im selben Import oder den Namen eines vorhandenen Plans.
- Unklares erzeugt Warnungen in der Vorschau statt eines Fehlers; nur unlesbarer Text oder ein Import ohne Pläne und Programme bricht ab.
