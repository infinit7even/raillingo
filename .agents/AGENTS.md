# RF - Rail Focus - Regole e Linee Guida per Agenti AI

## Panoramica Progetto
**RF - Rail Focus** è una PWA (Progressive Web App) sviluppata in SvelteKit 5 e TypeScript per l'apprendimento e la memorizzazione di acronimi, termini e concetti del settore ferroviario (RFI, segnalamento, normativa, trazione, ecc.).

## Tecnologie Utilizzate
- **Framework**: SvelteKit 5 (con Svelte Runes `$state`, `$derived`, `$props`, ecc.)
- **Linguaggio**: TypeScript
- **Styling**: CSS Vanilla moderno con variabili CSS (Design Tokens, Tema Scuro/Chiaro)
- **Stoccaggio Dati**: JSON statico (`/static/data/cards.json`) pronto per la migrazione futura a un DB (PostgreSQL / SQLite / Supabase)
- **Autenticazione Admin**: Discord OAuth2 (Restretto all'ID utente Discord: `691289686093725736`)
- **PWA**: Web App Manifest (`static/manifest.webmanifest`) e Service Worker (`src/service-worker.ts`) per il supporto offline.

## Regole di Sviluppo e Comandi
1. **Comandi Dev/Build**: MAI eseguire `bun dev`, `bun build` o `vite`. L'utente gestisce manualmente l'ambiente locale.
2. **Controllo Tipi**: L'unico comando di verifica da eseguire al termine dei compiti è `bun check`.
3. **Gestione Git**:
   - Ogni modifica o gruppo di modifiche logiche DEVE essere accompagnato da un commit in italiano. Esempio: `git commit -m "feat: aggiunta modalità ripasso foto e animazioni 3d"`
   - Non effettuare `git push` ad ogni step, ma solo alla fine del lavoro verso `git@github.com:infinit7even/rf.git`.
4. **Lingua**: L'interfaccia utente, i messaggi, le etichette e le descrizioni devono essere rigorosamente in **Italiano**.
5. **Design System & UX**:
   - Design ultra-moderno, responsive per smartphone e desktop.
   - Transizioni ed effetti micro-interattivi al tocco.
   - Pulsanti di grandi dimensioni ottimizzati per il touch sui dispositivi mobili.
   - Supporto sia per il **Tema Scuro** che per il **Tema Chiaro**.

## Struttura delle Card (`src/lib/types/cards.ts`)
```typescript
export interface Card {
	id: string;
	title: string;          // Acronimo o termine (es. "RFI", "SCMT")
	description: string;    // Definizione e utilizzo (es. "Rete Ferroviaria Italiana...")
	category?: string;     // Categoria (es. "Segnalamento", "Trazione", "Normativa")
	tags?: string[];        // Etichette secondarie
	images?: string[];      // Array di URL o percorsi immagine (es. ["/uploads/img1.webp"])
	createdAt: string;
	updatedAt: string;
}
```

## Modalità di Studio
1. **Ripasso**: Mostra Acronimo -> Tap mostra Descrizione e Foto -> Avanti
2. **Ripasso Foto**: Mostra Foto -> Tap 1 mostra Titolo -> Tap 2 mostra Descrizione
3. **Ripasso Inverso**: Mostra Descrizione -> Tap mostra Acronimo
4. **Quiz**: Domanda a scelta multipla con 5 opzioni e retry infinito
5. **Scrittura Libera**: Esercizio di digitazione senza blocco severo per incentivare la memorizzazione visiva e motoria.
