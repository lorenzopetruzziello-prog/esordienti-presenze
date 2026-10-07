# Vasca Esordienti

Registro allenamenti (sedute, obiettivi, gare) e **presenze** di Esordienti A, B, C e Preagonisti.
Un solo sito (`index.html`) e un solo Foglio Google, che è l'unica fonte dei dati.

```
index.html              l'app (sito statico, funziona anche da telefono come app)
apps-script/Code.gs     lo script da incollare nel Foglio Google (sedute + presenze)
manifest.webmanifest    icone e nome dell'app
```

Nel repository **non ci sono dati**: i nomi delle atlete stanno solo nel Foglio Google e arrivano all'app
solo con la parola d'ordine. Per questo `*.xlsx` e i backup sono nel `.gitignore`.

## Progetto separato dal vecchio sito

Questo è un progetto **nuovo**: il vecchio sito `…github.io/esordienti/`, il suo Foglio Google e il suo
Apps Script non vengono toccati e continuano a funzionare come prima. Qui tutto è nuovo:

- **nuovo repository** GitHub (non `esordienti`; suggerito: `esordienti-presenze`);
- **nuovo Foglio Google**, con un **nuovo progetto Apps Script** e un nuovo indirizzo `/exec`
  (non incollare mai questo script nel vecchio foglio);
- una parola d'ordine propria;
- nel browser l'app usa chiavi `vp_*`, diverse da quelle del vecchio sito (`esord_*`): anche se i due siti
  stanno sullo stesso dominio `github.io`, sullo stesso telefono non si scambiano dati.

Per riportare le sedute del vecchio sito (facoltativo, è una copia, il vecchio resta com'è): nel vecchio sito
Impostazioni → Esporta backup; in questo → Impostazioni → Importa backup.

## 1. Il Foglio Google (una volta sola)

1. Google Drive → Nuovo → Caricamento di file → `PRESENZE 26_27.xlsx`, poi aprilo con Fogli Google.
   Si crea un foglio nuovo: non sostituire nessun foglio esistente.
2. Elimina le schede `CAT` e `CAT PALESTRA`: restano `ESORDIENTI A`, `ESORDIENTI B`, `ESORDIENTI C`, `PREAGONISTI`.
   I nomi devono restare identici: lo script li cerca per nome.
3. Estensioni → Apps Script. Cancella tutto, incolla il contenuto di `apps-script/Code.gs`
   e cambia `PAROLA` (la parola d'ordine).
4. Esegui il deployment → Nuovo deployment → App web. Esegui come: **Me**. Chi ha accesso: **Chiunque**.
   Autorizza con il tuo account ("Google non ha verificato questa app" → Avanzate → Vai al progetto).
5. Copia l'indirizzo che finisce con `/exec`.

Le schede Serie, Sedute, Obiettivi, Gare e Archivio (nascosta) le crea lo script da solo alla prima sincronizzazione.

> Se modifichi `Code.gs` devi fare un **nuovo deployment** (Gestisci deployment → modifica → Nuova versione),
> altrimenti l'indirizzo `/exec` continua a servire la versione vecchia.

## 2. Il sito su GitHub Pages

1. Su github.com: **+ → New repository**, nome `esordienti-presenze`, Public, senza README né .gitignore (la cartella li ha già). **Create repository**.
2. Dalla cartella del progetto:
   ```
   git add .
   git commit -m "Primo caricamento"
   git remote add origin https://github.com/lorenzopetruzziello-prog/esordienti-presenze.git
   git push -u origin main
   ```
3. Settings → Pages → Source: *Deploy from a branch* → Branch `main`, cartella `/ (root)` → Save.
   Dopo 1-2 minuti il sito è su `https://lorenzopetruzziello-prog.github.io/esordienti-presenze/`.
4. Apri il sito, vai in **Impostazioni**, incolla indirizzo `/exec` e parola d'ordine, tocca **Collega**.

Ogni dispositivo si collega una volta; poi l'app tiene tutto allineato.

## Come funzionano le presenze

- Una scheda del foglio per gruppo: `Sett. | Data | Giorno | Allenamento | atleti… | Note`.
  Celle `PRESENTE` / `ASSENTE`; vuoto = non segnato. `Allenamento = PRESENTE` significa che quel giorno
  l'allenamento c'è stato (solo quelli contano nelle percentuali).
- Nell'app: scheda **Presenze** → scegli il gruppo e il giorno → spunta o croce per ogni atleta.
  Se segni qualcuna, "Allenamento svolto" si accende da solo.
- Ogni tocco parte dopo meno di un secondo e invia solo ciò che è cambiato, atleta per atleta:
  due telefoni che lavorano sullo stesso giorno non si sovrascrivono.
  Senza rete le modifiche restano sul telefono e partono appena torna il collegamento.
- La percentuale è presenze / allenamenti svolti fino a oggi, come le formule in fondo alle schede.
- La malattia (1/3) non c'è più: si segna solo presente o assente.
- Aggiungere un'atleta: scrivi il nome nella prima colonna libera della riga 1 (prima di `Note`).
  Colonne con intestazione vuota vengono ignorate.
- "Guardo" (Impostazioni) rende l'app di sola consultazione su quel dispositivo.
