import type { Config, Context } from "@netlify/edge-functions";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

/**
 * La cartolina di una playlist: l'immagine che si vede quando si manda il link.
 *
 * ===========================================================================
 * Perche' un'immagine disegnata, e non dei tag
 * ===========================================================================
 *
 * Chiesto con la fotografia di come lo fa Spotify, e poi: *"fallo uguale"*.
 *
 * Nel riquadro di Spotify ci sono la copertina, il nome, l'elenco dei primi
 * brani e il logo in basso a sinistra. Sembrano cose che compone WhatsApp: non
 * lo sono. WhatsApp da un link prende **tre** cose — un titolo, una frase e
 * **un'immagine sola** — e le mette in fila sempre allo stesso modo. L'elenco e
 * il logo stanno *dentro* quell'immagine, disegnati da Spotify prima di
 * mandarla.
 *
 * Quindi per averlo uguale bisogna disegnarla noi, una per playlist. E' quello
 * che fa questo file: risponde a `/cartolina/<id>.png` con un PNG 1200x630
 * costruito sul momento, e `anteprima-del-link.ts` lo mette in `og:image`.
 *
 * ===========================================================================
 * Perche' un SVG scritto a mano e non satori
 * ===========================================================================
 *
 * La strada battuta sarebbe satori (quella di Vercel): si scrive la cartolina
 * come una pagina web e lei la disegna. Ma per disporre il testo deve
 * misurarlo, per misurarlo vuole i font caricati, e tutto insieme in una Edge
 * Function e' un peso morto a ogni avvio a freddo.
 *
 * Qui la disposizione la conosco: e' sempre la stessa. Un SVG scritto a mano la
 * dice in duemila caratteri, e l'unica cosa che serviva davvero da una libreria
 * — sapere quanto e' largo un titolo per tagliarlo al punto giusto — sta nella
 * tabella `LARGHEZZE` qui sotto, i numeri veri presi dai due font una volta
 * sola.
 *
 * ===========================================================================
 * Cosa succede se qualcosa non va
 * ===========================================================================
 *
 * Si rimanda alla copertina della playlist, che e' quello che l'anteprima
 * mostrava prima che questo file esistesse. Un riquadro meno bello e' un
 * peccato; un riquadro **vuoto** perche' il disegnatore ha singhiozzato e' un
 * link che nessuno apre.
 */

/* Le larghezze vere dei caratteri nei due font, in frazioni di em: sono anche
   l'elenco di cosa i font sanno disegnare, e per questo servono due volte — a
   misurare dove tagliare, e a decidere cosa non si puo' nemmeno scrivere. */
const LARGHEZZE = {"display":{"predefinita":0.612,"larghezze":{"32":0.254,"33":0.298,"34":0.514,"35":0.636,"36":0.606,"37":0.758,"38":0.591,"39":0.294,"40":0.398,"41":0.39,"42":0.54,"43":0.62,"44":0.294,"45":0.432,"46":0.298,"47":0.388,"48":0.648,"49":0.452,"50":0.594,"51":0.608,"52":0.636,"53":0.6,"54":0.618,"55":0.554,"56":0.6,"57":0.618,"58":0.298,"59":0.298,"60":0.62,"61":0.62,"62":0.62,"63":0.578,"64":1.014,"65":0.634,"66":0.664,"67":0.644,"68":0.666,"69":0.554,"70":0.534,"71":0.662,"72":0.656,"73":0.264,"74":0.61,"75":0.626,"76":0.542,"77":0.882,"78":0.67,"79":0.676,"80":0.604,"81":0.676,"82":0.632,"83":0.606,"84":0.588,"85":0.672,"86":0.618,"87":0.898,"88":0.644,"89":0.624,"90":0.576,"91":0.358,"92":0.388,"93":0.358,"94":0.62,"95":0.62,"96":0.296,"97":0.578,"98":0.638,"99":0.586,"100":0.638,"101":0.577,"102":0.436,"103":0.638,"104":0.616,"105":0.266,"106":0.268,"107":0.564,"108":0.266,"109":0.854,"110":0.616,"111":0.612,"112":0.638,"113":0.638,"114":0.396,"115":0.524,"116":0.456,"117":0.616,"118":0.548,"119":0.784,"120":0.592,"121":0.616,"122":0.518,"123":0.466,"124":0.258,"125":0.466,"126":0.62,"160":0.254,"161":0.298,"162":0.598,"163":0.638,"164":0.62,"165":0.62,"166":0.258,"167":0.474,"168":0.448,"169":0.72,"170":0.419,"171":0.72,"172":0.62,"173":0.432,"174":0.516,"175":0.408,"176":0.394,"177":0.62,"178":0.364,"179":0.363,"180":0.296,"181":0.624,"182":0.614,"183":0.218,"184":0.328,"185":0.262,"186":0.436,"187":0.72,"188":0.83,"189":0.824,"190":0.891,"191":0.578,"192":0.634,"193":0.634,"194":0.634,"195":0.634,"196":0.634,"197":0.634,"198":0.821,"199":0.644,"200":0.554,"201":0.554,"202":0.554,"203":0.554,"204":0.264,"205":0.264,"206":0.264,"207":0.264,"208":0.666,"209":0.67,"210":0.676,"211":0.676,"212":0.676,"213":0.676,"214":0.676,"215":0.62,"216":0.676,"217":0.672,"218":0.672,"219":0.672,"220":0.672,"221":0.624,"222":0.604,"223":0.651,"224":0.578,"225":0.578,"226":0.578,"227":0.578,"228":0.578,"229":0.578,"230":0.874,"231":0.586,"232":0.577,"233":0.577,"234":0.577,"235":0.577,"236":0.266,"237":0.266,"238":0.266,"239":0.266,"240":0.616,"241":0.616,"242":0.612,"243":0.612,"244":0.612,"245":0.612,"246":0.612,"247":0.62,"248":0.612,"249":0.616,"250":0.616,"251":0.616,"252":0.616,"253":0.616,"254":0.638,"255":0.616,"305":0.266,"338":0.836,"339":0.984,"699":0.294,"700":0.294,"710":0.464,"730":0.288,"732":0.436,"768":0.0,"769":0.0,"771":0.0,"772":0.0,"776":0.0,"777":0.0,"803":0.0,"8201":0.184,"8203":0.0,"8211":0.584,"8212":0.888,"8216":0.294,"8217":0.294,"8218":0.294,"8220":0.514,"8221":0.514,"8222":0.514,"8226":0.4,"8230":0.798,"8242":0.232,"8243":0.416,"8249":0.48,"8250":0.48,"8260":0.638,"8364":0.678,"8482":0.552,"8593":0.62,"8595":0.62,"8722":0.62,"8725":0.409}},"corpo":{"predefinita":0.604,"larghezze":{"32":0.2666,"33":0.3042,"34":0.4941,"35":0.6387,"36":0.646,"37":0.9932,"38":0.6533,"39":0.313,"40":0.3687,"41":0.3687,"42":0.5205,"43":0.6675,"44":0.3032,"45":0.4624,"46":0.3032,"47":0.3696,"48":0.6455,"49":0.415,"50":0.6162,"51":0.627,"52":0.6562,"53":0.603,"54":0.6299,"55":0.5713,"56":0.6294,"57":0.6299,"58":0.3032,"59":0.3154,"60":0.6675,"61":0.6675,"62":0.6675,"63":0.5273,"64":0.9824,"65":0.709,"66":0.6567,"67":0.7334,"68":0.7217,"69":0.603,"70":0.5894,"71":0.7476,"72":0.7446,"73":0.2725,"74":0.5752,"75":0.6875,"76":0.5654,"77":0.9126,"78":0.7563,"79":0.7666,"80":0.6416,"81":0.7686,"82":0.6479,"83":0.646,"84":0.6528,"85":0.7402,"86":0.709,"87":1.0029,"88":0.7007,"89":0.6963,"90":0.6406,"91":0.3687,"92":0.3696,"93":0.3687,"94":0.4766,"95":0.4629,"96":0.3369,"97":0.5679,"98":0.6182,"99":0.5771,"100":0.6182,"101":0.5874,"102":0.3794,"103":0.6196,"104":0.6016,"105":0.252,"106":0.252,"107":0.5591,"108":0.252,"109":0.8882,"110":0.6016,"111":0.604,"112":0.6182,"113":0.6182,"114":0.3867,"115":0.5386,"116":0.3403,"117":0.6016,"118":0.5747,"119":0.8291,"120":0.5571,"121":0.5752,"122":0.5591,"123":0.4404,"124":0.3457,"125":0.4404,"126":0.6675,"160":0.2666,"161":0.3042,"162":0.5771,"163":0.6201,"164":0.7368,"165":0.5566,"166":0.293,"167":0.5684,"168":0.6016,"169":0.9141,"170":0.457,"171":0.6084,"172":0.6675,"174":0.6646,"175":0.4648,"176":0.457,"177":0.6675,"178":0.4478,"179":0.4546,"180":0.3369,"181":0.6001,"182":0.6011,"183":0.3032,"184":0.3003,"185":0.314,"186":0.4849,"187":0.6084,"188":0.8169,"189":0.8584,"190":0.8945,"191":0.5273,"192":0.709,"193":0.709,"194":0.709,"195":0.709,"196":0.709,"197":0.709,"198":1.0034,"199":0.7334,"200":0.603,"201":0.603,"202":0.603,"203":0.603,"204":0.2725,"205":0.2725,"206":0.2725,"207":0.2725,"208":0.7432,"209":0.7563,"210":0.7666,"211":0.7666,"212":0.7666,"213":0.7666,"214":0.7666,"215":0.6675,"216":0.7666,"217":0.7402,"218":0.7402,"219":0.7402,"220":0.7402,"221":0.6963,"222":0.647,"223":0.6299,"224":0.5679,"225":0.5679,"226":0.5679,"227":0.5679,"228":0.5679,"229":0.5679,"230":0.915,"231":0.5771,"232":0.5874,"233":0.5874,"234":0.5874,"235":0.5874,"236":0.252,"237":0.252,"238":0.252,"239":0.252,"240":0.5879,"241":0.6016,"242":0.604,"243":0.604,"244":0.604,"245":0.604,"246":0.604,"247":0.6675,"248":0.604,"249":0.6016,"250":0.6016,"251":0.6016,"252":0.6016,"253":0.5752,"254":0.6182,"255":0.5752,"305":0.252,"338":1.0093,"339":0.9956,"699":0.2764,"700":0.2773,"710":0.4287,"730":0.3203,"732":0.5039,"768":0.0,"769":0.0,"771":0.0,"772":0.0,"776":0.0,"777":0.0,"803":0.2568,"8194":0.5,"8201":0.1733,"8203":0.0,"8211":0.5,"8212":1.0,"8216":0.2773,"8217":0.2773,"8218":0.2568,"8220":0.4736,"8221":0.4707,"8222":0.4507,"8226":0.5332,"8230":0.9102,"8242":0.2397,"8243":0.4775,"8249":0.3999,"8250":0.3999,"8260":0.1982,"8364":0.6724,"8482":0.6206,"8593":0.8579,"8595":0.8579,"8722":0.6675}}} as {
  display: { predefinita: number; larghezze: Record<string, number> };
  corpo: { predefinita: number; larghezze: Record<string, number> };
};

const RADICE = "https://muslywave.com";

/*
  Il rasterizzatore, i font e il logo si caricano **una volta per macchina**,
  non una volta per richiesta: la promessa vive nel modulo, e chi arriva dopo
  aspetta la stessa. Sono due megabyte e mezzo di WebAssembly; ripresi a ogni
  anteprima sarebbero una fesseria.
*/
let preparazione: Promise<{ display: Uint8Array; corpo: Uint8Array; logo: string }> | null = null;

function inBase64(dati: ArrayBuffer): string {
  const byte = new Uint8Array(dati);
  let stringa = "";
  /* A pezzi da 8k: `String.fromCharCode(...tutto)` su un'immagine intera
     sfonda la pila degli argomenti. */
  for (let i = 0; i < byte.length; i += 8192) {
    stringa += String.fromCharCode(...byte.subarray(i, i + 8192));
  }
  return btoa(stringa);
}

async function scarica(indirizzo: string, millisecondi = 4000): Promise<ArrayBuffer> {
  const risposta = await fetch(indirizzo, { signal: AbortSignal.timeout(millisecondi) });
  if (!risposta.ok) throw new Error(`${indirizzo} ha risposto ${risposta.status}`);
  return await risposta.arrayBuffer();
}

function prepara() {
  if (!preparazione) {
    preparazione = (async () => {
      const [wasm, display, corpo, logo] = await Promise.all([
        scarica(`${RADICE}/risorse/resvg.wasm`, 8000),
        scarica(`${RADICE}/risorse/MWDisplay.ttf`),
        scarica(`${RADICE}/risorse/MWBody.ttf`),
        scarica(`${RADICE}/risorse/logo-cartolina.png`),
      ]);
      await initWasm(wasm);
      return {
        display: new Uint8Array(display),
        corpo: new Uint8Array(corpo),
        logo: `data:image/png;base64,${inBase64(logo)}`,
      };
    })().catch((errore) => {
      /* Se e' andata male, la prossima richiesta riprova invece di ereditare
         una promessa gia' rotta per sempre. */
      preparazione = null;
      throw errore;
    });
  }
  return preparazione;
}

const LARGHEZZA = 1200;
const ALTEZZA = 630;

/* La copertina, grande e a sinistra: e' la sola cosa che si guarda davvero. */
const COPERTINA = { x: 64, y: 64, lato: 404, raggio: 26 };

/* La colonna delle parole comincia dove finisce la copertina, piu' aria. */
const COLONNA = { x: 528, larghezza: 1200 - 528 - 64 };

/*
  Le coppie di colori sono quelle dei temi dell'app — le stesse dieci fra cui
  si sceglie in Impostazioni. Quale tocca a una playlist lo decide il suo
  identificativo: cosi' la stessa playlist ha sempre la stessa cartolina, e due
  playlist vicine non escono uguali.
*/
const TEMI = [
  ["#f044c7", "#7c3aed"],
  ["#20e3f0", "#2563eb"],
  ["#fbccf8", "#8b5cf6"],
  ["#39FF14", "#00b3a4"],
  ["#FF007F", "#2b6bff"],
  ["#98FF98", "#3ec7a0"],
  ["#ffb347", "#ff5e62"],
  ["#c4b5fd", "#4338ca"],
  ["#ff9a9e", "#a855f7"],
  ["#7dd3fc", "#0ea5e9"],
];

function temaPer(id) {
  let somma = 0;
  for (let i = 0; i < id.length; i += 1) somma = (somma * 31 + id.charCodeAt(i)) >>> 0;
  return TEMI[somma % TEMI.length];
}

/**
 * Riporta un testo a lettere che i font sanno disegnare.
 *
 * Nasce da un titolo vero, trovato in una playlist di prova:
 * "Darbuna Darbun ( 𝕊𝕝𝕠𝕨𝕖𝕕 + ℝ𝕖𝕧𝕖𝕣𝕓 )". Quelle non sono lettere normali in
 * grassetto: sono i "simboli matematici alfanumerici", caratteri diversi con
 * un posto diverso nella tavola di Unicode. Un font che non li ha non li
 * inventa: al loro posto stampa il rettangolo vuoto, e nella cartolina si
 * vedeva una fila di scatolette.
 *
 * `NFKC` li riporta alle lettere che imitano — 𝕊 torna S — e cosi' il titolo
 * si legge invece di sparire. Quello che resta fuori dal font anche dopo
 * (un'emoji, un alfabeto che non e' il nostro) si toglie: uno spazio dice meno
 * di una parola, ma un rettangolo vuoto dice il falso, cioe' che l'app e'
 * rotta.
 *
 * Se togliendo non resta niente — un titolo tutto in arabo, per dire — si
 * rimette com'era: meglio qualcosa che non si legge di una riga bianca con
 * accanto il suo numero.
 */
function ripulisci(testo, tabella) {
  const grezzo = String(testo ?? "").trim();
  if (!grezzo) return "";
  let tenuto = "";
  for (const carattere of grezzo.normalize("NFKC")) {
    if (tabella.larghezze[carattere.codePointAt(0)] !== undefined) tenuto += carattere;
    else if (/\s/.test(carattere)) tenuto += " ";
  }
  const pulito = tenuto.replace(/\s+/g, " ").trim();
  return pulito || grezzo;
}

/** Le lettere che dentro un file XML non possono restare se stesse. */
function pulisci(testo) {
  return String(testo ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Quanto e' largo questo testo, in pixel, scritto con questo font a questa
 * misura.
 *
 * Non e' una stima: sono le larghezze vere prese dal font, quindi il taglio
 * cade dove cadrebbe guardandolo. I caratteri che nella tabella non ci sono —
 * un'emoji, un alfabeto che non e' il nostro — valgono quanto una "o", che e'
 * il modo meno sbagliato di sbagliare.
 */
function larghezza(testo, tabella, misura) {
  let somma = 0;
  for (const carattere of String(testo)) {
    const codice = carattere.codePointAt(0);
    somma += tabella.larghezze[codice] ?? tabella.predefinita;
  }
  return somma * misura;
}

/** Taglia con i puntini se non ci sta. */
function accorcia(testo, tabella, misura, disponibile) {
  const pulito = String(testo ?? "").trim();
  if (!pulito) return "";
  if (larghezza(pulito, tabella, misura) <= disponibile) return pulito;
  const puntini = larghezza("…", tabella, misura);
  let dentro = "";
  for (const carattere of pulito) {
    if (larghezza(dentro + carattere, tabella, misura) + puntini > disponibile) break;
    dentro += carattere;
  }
  return dentro.replace(/[\s·,;:-]+$/, "") + "…";
}

/**
 * Manda a capo, al massimo `righe` volte, e taglia l'ultima se avanza roba.
 *
 * Le parole non si spezzano: un titolo tagliato a meta' di una parola si legge
 * come un errore, non come un titolo lungo.
 */
function aCapo(testo, tabella, misura, disponibile, righe) {
  const parole = String(testo ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parole.length) return [];
  const fatte = [];
  let corrente = "";
  for (const parola of parole) {
    const prova = corrente ? `${corrente} ${parola}` : parola;
    if (larghezza(prova, tabella, misura) <= disponibile || !corrente) {
      corrente = prova;
    } else {
      fatte.push(corrente);
      corrente = parola;
      if (fatte.length === righe) break;
    }
  }
  if (fatte.length < righe && corrente) fatte.push(corrente);
  if (fatte.length > righe) fatte.length = righe;

  /* Se e' rimasto fuori qualcosa, l'ultima riga lo dice con i puntini. */
  const scritte = fatte.join(" ");
  if (scritte.length < parole.join(" ").length) {
    fatte[fatte.length - 1] = accorcia(
      `${fatte[fatte.length - 1]}…`,
      tabella,
      misura,
      disponibile,
    );
  }
  return fatte;
}

/**
 * Costruisce il disegno.
 *
 * `copertina` e `logo` arrivano gia' come `data:` — dentro un SVG un indirizzo
 * non si puo' usare: chi lo trasforma in PNG non va in rete, e un'immagine che
 * non c'e' lascia un buco bianco.
 */
function costruisciCartolina({
  nome,
  autore,
  brani,
  quanti,
  copertina,
  logo,
  tema,
  larghezze,
}) {
  const [tinta, seconda] = tema;
  const display = larghezze.display;
  const corpo = larghezze.corpo;

  const titoloPulito = ripulisci(nome, display);
  const autorePulito = ripulisci(autore, corpo);

  /*
    Il titolo si adatta: grande se e' corto, piu' piccolo se e' lungo. Cosi'
    "Gym Nasheeds" riempie il riquadro e un nome di dieci parole ci sta lo
    stesso, invece di uscire dal bordo o restare minuscolo per prudenza.
  */
  const misuraTitolo = titoloPulito.length > 26 ? 52 : 64;
  const righeTitolo = aCapo(titoloPulito, display, misuraTitolo, COLONNA.larghezza, 2);
  const daMostrare = brani.slice(0, 4);
  const restanti = quanti - daMostrare.length;

  /*
    Prima si misura, poi si disegna.

    La colonna cambia altezza — un titolo di una riga o di due, quattro brani o
    nessuno — e se partisse sempre dall'alto la cartolina uscirebbe sbilanciata
    in modo diverso ogni volta. Misurata prima, si centra da sola accanto alla
    copertina, comunque vada.
  */
  const PASSO = 52;
  const altezza =
    30 +
    righeTitolo.length * (misuraTitolo * 1.12) +
    46 +
    (daMostrare.length ? 54 + daMostrare.length * PASSO : 0) +
    (restanti > 0 ? 34 : 0);
  let y = Math.max(58, (ALTEZZA - altezza) / 2);

  const occhiello = `<text x="${COLONNA.x}" y="${y}" font-family="MW Body" font-size="19" fill="${tinta}" letter-spacing="4.6">PLAYLIST</text>`;
  y += 30;

  const pezziTitolo = righeTitolo
    .map((riga, indice) => {
      const base = y + (indice + 1) * (misuraTitolo * 1.12) - misuraTitolo * 0.26;
      return `<text x="${COLONNA.x}" y="${base}" font-family="MW Display" font-size="${misuraTitolo}" fill="#ffffff" letter-spacing="-1.4">${pulisci(riga)}</text>`;
    })
    .join("");
  y += righeTitolo.length * (misuraTitolo * 1.12);

  const sotto = accorcia(
    `${autorePulito} · ${quanti} ${quanti === 1 ? "track" : "tracks"}`,
    corpo,
    27,
    COLONNA.larghezza,
  );
  const rigaAutore = `<text x="${COLONNA.x}" y="${y + 26}" font-family="MW Body" font-size="27" fill="${tinta}">${pulisci(sotto)}</text>`;
  y += 46;

  /*
    I brani, al massimo quattro.

    Sono la parte che fa venire voglia di aprire il link: "playlist di Eraldo"
    dice chi, non dice **cosa**. Quattro titoli lo dicono, e sono la ragione per
    cui un riquadro cosi' si guarda invece di scorrere via.
  */
  let elenco = "";
  if (daMostrare.length) {
    elenco += `<rect x="${COLONNA.x}" y="${y + 26}" width="${COLONNA.larghezza}" height="1.5" fill="#ffffff" opacity="0.12"/>`;
    const numeroLargo = 42;
    daMostrare.forEach((brano, indice) => {
      const base = y + 54 + indice * PASSO + 30;
      const titolo = accorcia(ripulisci(brano.titolo, corpo), corpo, 25, COLONNA.larghezza - numeroLargo - 8);
      elenco +=
        `<text x="${COLONNA.x}" y="${base}" font-family="MW Body" font-size="23" fill="#ffffff" opacity="0.35">${indice + 1}</text>` +
        `<text x="${COLONNA.x + numeroLargo}" y="${base}" font-family="MW Body" font-size="25" fill="#ffffff" opacity="0.88">${pulisci(titolo)}</text>`;
    });
    y += 54 + daMostrare.length * PASSO;
  }

  const coda =
    restanti > 0
      ? `<text x="${COLONNA.x + 42}" y="${y + 26}" font-family="MW Body" font-size="22" fill="#ffffff" opacity="0.42">+ ${restanti} more</text>`
      : "";

  /* Il logo in basso a sinistra, sotto la copertina: chiesto cosi'. */
  const baseLogo = COPERTINA.y + COPERTINA.lato + 62;
  const firma =
    `<image x="${COPERTINA.x}" y="${baseLogo - 40}" width="52" height="52" href="${logo}" clip-path="url(#tondoLogo)"/>` +
    `<text x="${COPERTINA.x + 68}" y="${baseLogo - 3}" font-family="MW Display" font-size="31" fill="#ffffff" letter-spacing="-0.6">MuslyWave</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGHEZZA}" height="${ALTEZZA}" viewBox="0 0 ${LARGHEZZA} ${ALTEZZA}">
  <defs>
    <clipPath id="tondoCopertina"><rect x="${COPERTINA.x}" y="${COPERTINA.y}" width="${COPERTINA.lato}" height="${COPERTINA.lato}" rx="${COPERTINA.raggio}"/></clipPath>
    <clipPath id="tondoLogo"><rect x="${COPERTINA.x}" y="${baseLogo - 40}" width="52" height="52" rx="15"/></clipPath>
    <radialGradient id="alone" cx="0.24" cy="0.28" r="0.9">
      <stop offset="0" stop-color="${tinta}" stop-opacity="0.30"/>
      <stop offset="0.55" stop-color="${seconda}" stop-opacity="0.13"/>
      <stop offset="1" stop-color="${seconda}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${LARGHEZZA}" height="${ALTEZZA}" fill="#08040B"/>
  <rect width="${LARGHEZZA}" height="${ALTEZZA}" fill="url(#alone)"/>
  <rect x="0" y="0" width="${LARGHEZZA}" height="5" fill="${tinta}"/>

  <rect x="${COPERTINA.x + 6}" y="${COPERTINA.y + 12}" width="${COPERTINA.lato}" height="${COPERTINA.lato}" rx="${COPERTINA.raggio}" fill="#000000" opacity="0.5"/>
  <image x="${COPERTINA.x}" y="${COPERTINA.y}" width="${COPERTINA.lato}" height="${COPERTINA.lato}" href="${copertina}" preserveAspectRatio="xMidYMid slice" clip-path="url(#tondoCopertina)"/>
  <rect x="${COPERTINA.x}" y="${COPERTINA.y}" width="${COPERTINA.lato}" height="${COPERTINA.lato}" rx="${COPERTINA.raggio}" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>

  ${occhiello}
  ${pezziTitolo}
  ${rigaAutore}
  ${elenco}
  ${coda}
  ${firma}
</svg>`;
}

type Brano = { title?: string | null };

export default async function cartolinaDellaPlaylist(richiesta: Request, contesto: Context) {
  const indirizzo = new URL(richiesta.url);
  const id = indirizzo.pathname.split("/").filter(Boolean)[1]?.replace(/\.png$/, "");
  if (!id) return new Response("manca l'identificativo", { status: 400 });

  const base = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const chiave = Deno.env.get("VITE_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!base || !chiave) return Response.redirect(`${RADICE}/anteprima-sito.png`, 302);

  let copertinaVera = `${RADICE}/anteprima-sito.png`;

  try {
    /*
      La stessa funzione che chiama l'app: `get_shared_playlist`. E' `security
      definer` e concessa ad `anon`, quindi risponde solo per le playlist
      davvero pubbliche — una playlist privata da qui non esce, esattamente come
      non esce dall'app. Il controllo di chi puo' vedere cosa resta uno solo,
      nel database.
    */
    const dati = await fetch(`${base}/rest/v1/rpc/get_shared_playlist`, {
      method: "POST",
      headers: {
        apikey: chiave,
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_playlist_id: id }),
      signal: AbortSignal.timeout(3000),
    });
    if (!dati.ok) throw new Error(`il database ha risposto ${dati.status}`);

    const risposta = await dati.json();
    const playlist = risposta?.playlist;
    if (!playlist) throw new Error("playlist non pubblica");

    const elenco: Brano[] = Array.isArray(risposta?.tracks) ? risposta.tracks : [];
    if (typeof playlist.cover_url === "string" && playlist.cover_url.startsWith("http")) {
      copertinaVera = playlist.cover_url;
    }

    const { display, corpo, logo } = await prepara();

    /*
      La copertina va messa dentro il disegno come `data:`: chi trasforma un
      SVG in PNG non va in rete, e un indirizzo lascerebbe un buco bianco al
      posto dell'unica cosa che si guarda davvero.
    */
    let copertina = logo;
    try {
      const immagine = await scarica(copertinaVera, 3500);
      if (immagine.byteLength <= 6_000_000) {
        const tipo = copertinaVera.match(/\.png(\?|$)/i) ? "png" : "jpeg";
        copertina = `data:image/${tipo};base64,${inBase64(immagine)}`;
      }
    } catch {
      /* Copertina irraggiungibile: si disegna lo stesso, con il logo al suo
         posto. Meglio una cartolina senza foto che nessuna cartolina. */
    }

    const svg = costruisciCartolina({
      nome: String(playlist.playlist_name ?? "Playlist"),
      autore: String(playlist.creator_name ?? "MuslyWave"),
      quanti: elenco.length,
      brani: elenco.map((brano) => ({ titolo: String(brano?.title ?? "").trim() })).filter((b) => b.titolo),
      copertina,
      logo,
      tema: temaPer(id),
      larghezze: LARGHEZZE,
    });

    const disegno = new Resvg(svg, {
      fitTo: { mode: "width", value: LARGHEZZA },
      font: { fontBuffers: [display, corpo], loadSystemFonts: false, defaultFontFamily: "MW Body" },
    });
    const png = disegno.render().asPng();

    return new Response(png, {
      headers: {
        "content-type": "image/png",
        /*
          Un giorno nella cache di Netlify: i motori di anteprima ripassano di
          rado, e disegnare la stessa cartolina mille volte sarebbe solo
          fatica. Una modifica alla playlist si vede il giorno dopo, che per
          un'anteprima e' abbastanza.
        */
        "cache-control": "public, max-age=3600",
        "netlify-cdn-cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    /* Si torna alla copertina nuda: e' quello che l'anteprima mostrava prima. */
    return Response.redirect(copertinaVera, 302);
  }
}

export const config: Config = {
  path: "/cartolina/*",
  cache: "manual",
};
