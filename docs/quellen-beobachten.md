# Neue Meldungen automatisch finden

Für die Beispielausgabe Orbitbrief soll ein Rechercheagent werktags die Nachrichten von ESA und DLR lesen. Er liefert kurze Meldungen mit Originalquelle. Für eine andere Ausgabe ersetzt du die Quellen, das Thema und den Profilpfad.

## So richtest du die Recherche in ChatGPT ein

1. Gib dem Agenten Lesezugriff auf das Profil deiner Ausgabe und die darin genannte Feeddatei. Bei einer öffentlichen Website kannst du ihm die vollständigen Webadressen beider JSON-Dateien geben.
2. Starte im Agentenmodus einen Chat, füge den Auftrag unten ein und lass ihn einmal ausführen. Öffne bei einem Treffer die Originalquelle und vergleiche Datum und Aussage. So kannst du die Auswahl vor dem ersten regelmäßigen Lauf anpassen.
3. Wähle nach dem Probelauf das **Uhrsymbol**. Stelle die Wiederholung auf **Montag bis Freitag um 08:30 Uhr, Zeitzone Europe/Berlin**. Prüfe den gespeicherten Zeitplan in der Aufgabenübersicht. [Aufgabenübersicht in ChatGPT](https://chatgpt.com/schedules) · [OpenAI-Anleitung zu geplanten Aufgaben](https://help.openai.com/en/articles/11752874-chatgpt-agent)

## Auftrag zum Kopieren

```text
Recherchiere für Orbitbrief neue Ergebnisse europäischer Raumfahrtmissionen,
Starts und veröffentlichte Messdaten. Lass Werbung und Terminankündigungen aus.

Quellen
ESA (RSS): https://www.esa.int/rss/latest-news-homepage.rss
DLR (Nachrichtenseite): https://www.dlr.de/de/aktuelles/nachrichten

Lies profiles/orbit.json und die unter feed angegebene Datei. Im exportierten
Websitepaket liegt das Profil unter profiles/ausgabe.json.

Prüfe beim ersten Lauf die letzten 14 Tage. Beginne danach für jede Quelle
14 Tage vor ihrem letzten erfolgreichen Lauf, damit du Nachträge findest.
Folge aus dem RSS-Feed oder der Nachrichtenübersicht zum Originalbeitrag.
Prüfe dort die Aussage und das Veröffentlichungsdatum.

Vergleiche Originallink und, sofern vorhanden, DOI mit dem Feed und mit
offenen Vorschlägen. Fasse neue Meldungen in eigenen Worten zusammen.
Wurde eine Meldung inhaltlich korrigiert, behalte ihre ID. Überspringe
unveränderte Beiträge. Verwende für date das belegte Veröffentlichungsdatum.

Liefere pro Meldung id, title, summary, body, date (YYYY-MM-DD), section,
topics und source mit name und url. Nutze die Bereichs- und Themenkennungen
aus dem Profil. Erstelle einen Pull Request, wenn du dazu berechtigt bist.
Sonst gib die JSON-Einträge mit Zielpfad und IDs hier im Chat aus.

Halte für den nächsten Lauf pro Quelle Prüfdatum, geprüften Zeitraum,
neue und geänderte Treffer sowie Fehler im Laufprotokoll fest. Melde auch
null Treffer. War eine Quelle nicht vollständig prüfbar, nenne die Lücke,
behalte ihren letzten Erfolgszeitpunkt und hole den Zeitraum später nach.
```

## So kommt ein Fund auf die Website

Ein Pull Request ist ein Änderungsvorschlag auf GitHub. Prüfe ihn und führe ihn mit deinem Hauptbranch zusammen. Liefert der Agent die Einträge im Chat, übernimm sie anhand ihrer ID in die Feeddatei. Stelle die aktualisierte Datei auf deinem Webserver bereit. [Eine Meldung veröffentlichen](eigene-ausgabe.md#die-erste-meldung-veröffentlichen)

Öffne **Alle Meldungen** auf deiner Website. Suche den neuen Titel und folge **Zur Quelle**. Für einen Test auf doppelte Treffer kannst du denselben Auftrag anschließend erneut ausführen.
