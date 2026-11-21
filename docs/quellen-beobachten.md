# Neue Meldungen automatisch finden

Für die Beispielausgabe Orbitbrief soll ein Rechercheagent werktags die Nachrichten von ESA und DLR lesen. Er liefert kurze Meldungen mit Originalquelle. Für deine eigene Ausgabe nennst du dein Thema, deine Quellen und deine Website.

## So richtest du die Recherche in ChatGPT ein

1. Gib ChatGPT Zugriff auf deine Ausgabe und den aktuellen Meldungsbestand. Bitte es im Websitechat, dir die passenden Dateien oder Links für den Rechercheauftrag zu nennen. Bei einer privaten Ausgabe braucht auch die geplante Aufgabe Zugriff auf diese Quellen.
2. Starte im Agentenmodus einen Chat, füge den Auftrag unten ein und lass ihn einmal ausführen. Öffne bei einem Treffer die Originalquelle und vergleiche Datum und Aussage. So kannst du die Auswahl vor dem ersten regelmäßigen Lauf anpassen.
3. Wähle nach dem Probelauf das **Uhrsymbol**. Stelle die Wiederholung auf **Montag bis Freitag um 08:30 Uhr, Zeitzone Europe/Berlin**. Prüfe den gespeicherten Zeitplan in der Aufgabenübersicht. [Aufgabenübersicht in ChatGPT](https://chatgpt.com/schedules) · [OpenAI-Anleitung zu geplanten Aufgaben](https://help.openai.com/en/articles/11752874-chatgpt-agent)

## Auftrag zum Kopieren

```text
Recherchiere für Orbitbrief neue Ergebnisse europäischer Raumfahrtmissionen,
Starts und veröffentlichte Messdaten. Lass Werbung und Terminankündigungen aus.

Quellen
ESA (RSS): https://www.esa.int/rss/latest-news-homepage.rss
DLR (Nachrichtenseite): https://www.dlr.de/de/aktuelles/nachrichten

Lies das Profil meiner Ausgabe und den aktuellen Meldungsbestand. Nutze die
Dateien oder Links, die ich dir für diesen Auftrag mitgebe. Melde fehlenden Zugriff.

Prüfe beim ersten Lauf die letzten 14 Tage. Beginne danach für jede Quelle
14 Tage vor ihrem letzten erfolgreichen Lauf, damit du Nachträge findest.
Folge aus dem RSS-Feed oder der Nachrichtenübersicht zum Originalbeitrag.
Prüfe dort die Aussage und das Veröffentlichungsdatum.

Prüfe anhand des Originallinks, ob die Meldung schon auf meiner Website steht
oder bereits vorgeschlagen wurde. Stelle Korrekturen als Änderung zur bestehenden
Meldung vor. Überspringe unveränderte Beiträge.

Zeige mir zu jedem neuen Fund Titel, kurze Zusammenfassung in eigenen Worten,
Veröffentlichungsdatum, Bereich, Thema und Originalquelle. Bereite die Einträge
passend zur Vorlage vor, damit ich sie nach meiner Prüfung übernehmen lassen kann.

Halte für den nächsten Lauf pro Quelle Prüfdatum, geprüften Zeitraum,
neue und geänderte Treffer sowie Fehler im Laufprotokoll fest. Melde auch
null Treffer. War eine Quelle nicht vollständig prüfbar, nenne die Lücke,
behalte ihren letzten Erfolgszeitpunkt und hole den Zeitraum später nach.
```

## So kommt ein Fund auf die Website

Prüfe den vorgeschlagenen Text und die Originalquelle. Gib die ausgewählte Meldung in den Chat deiner Website und bitte ChatGPT, sie in die bestehende Ausgabe zu übernehmen und diese mit denselben Zugriffseinstellungen zu aktualisieren. [Eine Meldung veröffentlichen](eigene-ausgabe.md#die-erste-meldung-veröffentlichen)

Öffne **Alle Meldungen** auf deiner Website. Suche den neuen Titel und folge **Zur Quelle**. Für einen Test auf doppelte Treffer kannst du denselben Auftrag anschließend erneut ausführen.
