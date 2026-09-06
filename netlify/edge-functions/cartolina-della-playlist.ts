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
const LARGHEZZE = {"display":{"predefinita":0.6191,"larghezze":{"32":0.2188,"33":0.3584,"34":0.5864,"35":0.6553,"36":0.6602,"37":1.0293,"38":0.6831,"39":0.3545,"40":0.3823,"41":0.3823,"42":0.5825,"43":0.6855,"44":0.3525,"45":0.4712,"46":0.3525,"47":0.3999,"48":0.6919,"49":0.4414,"50":0.6377,"51":0.6567,"52":0.6885,"53":0.6338,"54":0.6616,"55":0.5879,"56":0.6641,"57":0.6616,"58":0.3525,"59":0.3599,"60":0.6855,"61":0.6855,"62":0.6855,"63":0.5791,"64":1.0361,"65":0.7695,"66":0.6646,"67":0.7437,"68":0.7227,"69":0.6099,"70":0.5854,"71":0.7524,"72":0.7485,"73":0.2856,"74":0.5898,"75":0.7383,"76":0.5654,"77":0.9434,"78":0.7656,"79":0.7729,"80":0.6519,"81":0.7817,"82":0.6621,"83":0.6602,"84":0.6768,"85":0.7271,"86":0.7695,"87":1.0586,"88":0.7612,"89":0.752,"90":0.6787,"91":0.3823,"92":0.3999,"93":0.3823,"94":0.4932,"95":0.4844,"96":0.3823,"97":0.5884,"98":0.6377,"99":0.5952,"100":0.6377,"101":0.6006,"102":0.4097,"103":0.6392,"104":0.6353,"105":0.2832,"106":0.2832,"107":0.5928,"108":0.2832,"109":0.9272,"110":0.6353,"111":0.6191,"112":0.6377,"113":0.6377,"114":0.4199,"115":0.5732,"116":0.3818,"117":0.6353,"118":0.6152,"119":0.8628,"120":0.5942,"121":0.6182,"122":0.5811,"123":0.4863,"124":0.3877,"125":0.4863,"126":0.6855,"160":0.2188,"161":0.3584,"162":0.5952,"163":0.6499,"164":0.7764,"165":0.5786,"166":0.3667,"167":0.5684,"168":0.6353,"169":0.9141,"170":0.4678,"171":0.6914,"172":0.6855,"174":0.6606,"175":0.4233,"176":0.4609,"177":0.6855,"178":0.4673,"179":0.4824,"180":0.3823,"181":0.6455,"182":0.5972,"183":0.3525,"184":0.4033,"185":0.3452,"186":0.4927,"187":0.6914,"188":0.8633,"189":0.895,"190":0.9351,"191":0.5791,"192":0.7695,"193":0.7695,"194":0.7695,"195":0.7695,"196":0.7695,"197":0.7695,"198":1.0347,"199":0.7437,"200":0.6099,"201":0.6099,"202":0.6099,"203":0.6099,"204":0.2856,"205":0.2856,"206":0.2856,"207":0.2856,"208":0.77,"209":0.7656,"210":0.7729,"211":0.7729,"212":0.7729,"213":0.7729,"214":0.7729,"215":0.6855,"216":0.7729,"217":0.7271,"218":0.7271,"219":0.7271,"220":0.7271,"221":0.752,"222":0.6826,"223":0.6743,"224":0.5884,"225":0.5884,"226":0.5884,"227":0.5884,"228":0.5884,"229":0.5884,"230":0.9072,"231":0.5952,"232":0.6006,"233":0.6006,"234":0.6006,"235":0.6006,"236":0.2832,"237":0.2832,"238":0.2832,"239":0.2832,"240":0.606,"241":0.6353,"242":0.6191,"243":0.6191,"244":0.6191,"245":0.6191,"246":0.6191,"247":0.6855,"248":0.6191,"249":0.6353,"250":0.6353,"251":0.6353,"252":0.6353,"253":0.6182,"254":0.6377,"255":0.6182,"305":0.2832,"338":1.0229,"339":0.9834,"699":0.3042,"700":0.3311,"710":0.479,"730":0.3921,"732":0.501,"768":0.0,"769":0.0,"771":0.0,"772":0.0,"776":0.0,"777":0.0,"803":0.3066,"8194":0.5,"8201":0.1475,"8203":0.0,"8211":0.5,"8212":1.0,"8216":0.3311,"8217":0.3311,"8218":0.3076,"8220":0.5806,"8221":0.5693,"8222":0.5459,"8226":0.438,"8230":1.0581,"8242":0.2954,"8243":0.5898,"8249":0.4502,"8250":0.4502,"8260":0.2183,"8364":0.6919,"8482":0.6519,"8593":0.9341,"8595":0.9341,"8722":0.6855}},"corpo":{"predefinita":0.604,"larghezze":{"32":0.2666,"33":0.3042,"34":0.4941,"35":0.6387,"36":0.646,"37":0.9932,"38":0.6533,"39":0.313,"40":0.3687,"41":0.3687,"42":0.5205,"43":0.6675,"44":0.3032,"45":0.4624,"46":0.3032,"47":0.3696,"48":0.6455,"49":0.415,"50":0.6162,"51":0.627,"52":0.6562,"53":0.603,"54":0.6299,"55":0.5713,"56":0.6294,"57":0.6299,"58":0.3032,"59":0.3154,"60":0.6675,"61":0.6675,"62":0.6675,"63":0.5273,"64":0.9824,"65":0.709,"66":0.6567,"67":0.7334,"68":0.7217,"69":0.603,"70":0.5894,"71":0.7476,"72":0.7446,"73":0.2725,"74":0.5752,"75":0.6875,"76":0.5654,"77":0.9126,"78":0.7563,"79":0.7666,"80":0.6416,"81":0.7686,"82":0.6479,"83":0.646,"84":0.6528,"85":0.7402,"86":0.709,"87":1.0029,"88":0.7007,"89":0.6963,"90":0.6406,"91":0.3687,"92":0.3696,"93":0.3687,"94":0.4766,"95":0.4629,"96":0.3369,"97":0.5679,"98":0.6182,"99":0.5771,"100":0.6182,"101":0.5874,"102":0.3794,"103":0.6196,"104":0.6016,"105":0.252,"106":0.252,"107":0.5591,"108":0.252,"109":0.8882,"110":0.6016,"111":0.604,"112":0.6182,"113":0.6182,"114":0.3867,"115":0.5386,"116":0.3403,"117":0.6016,"118":0.5747,"119":0.8291,"120":0.5571,"121":0.5752,"122":0.5591,"123":0.4404,"124":0.3457,"125":0.4404,"126":0.6675,"160":0.2666,"161":0.3042,"162":0.5771,"163":0.6201,"164":0.7368,"165":0.5566,"166":0.293,"167":0.5684,"168":0.6016,"169":0.9141,"170":0.457,"171":0.6084,"172":0.6675,"174":0.6646,"175":0.4648,"176":0.457,"177":0.6675,"178":0.4478,"179":0.4546,"180":0.3369,"181":0.6001,"182":0.6011,"183":0.3032,"184":0.3003,"185":0.314,"186":0.4849,"187":0.6084,"188":0.8169,"189":0.8584,"190":0.8945,"191":0.5273,"192":0.709,"193":0.709,"194":0.709,"195":0.709,"196":0.709,"197":0.709,"198":1.0034,"199":0.7334,"200":0.603,"201":0.603,"202":0.603,"203":0.603,"204":0.2725,"205":0.2725,"206":0.2725,"207":0.2725,"208":0.7432,"209":0.7563,"210":0.7666,"211":0.7666,"212":0.7666,"213":0.7666,"214":0.7666,"215":0.6675,"216":0.7666,"217":0.7402,"218":0.7402,"219":0.7402,"220":0.7402,"221":0.6963,"222":0.647,"223":0.6299,"224":0.5679,"225":0.5679,"226":0.5679,"227":0.5679,"228":0.5679,"229":0.5679,"230":0.915,"231":0.5771,"232":0.5874,"233":0.5874,"234":0.5874,"235":0.5874,"236":0.252,"237":0.252,"238":0.252,"239":0.252,"240":0.5879,"241":0.6016,"242":0.604,"243":0.604,"244":0.604,"245":0.604,"246":0.604,"247":0.6675,"248":0.604,"249":0.6016,"250":0.6016,"251":0.6016,"252":0.6016,"253":0.5752,"254":0.6182,"255":0.5752,"305":0.252,"338":1.0093,"339":0.9956,"699":0.2764,"700":0.2773,"710":0.4287,"730":0.3203,"732":0.5039,"768":0.0,"769":0.0,"771":0.0,"772":0.0,"776":0.0,"777":0.0,"803":0.2568,"8194":0.5,"8201":0.1733,"8203":0.0,"8211":0.5,"8212":1.0,"8216":0.2773,"8217":0.2773,"8218":0.2568,"8220":0.4736,"8221":0.4707,"8222":0.4507,"8226":0.5332,"8230":0.9102,"8242":0.2397,"8243":0.4775,"8249":0.3999,"8250":0.3999,"8260":0.1982,"8364":0.6724,"8482":0.6206,"8593":0.8579,"8595":0.8579,"8722":0.6675}}} as {
  display: { predefinita: number; larghezze: Record<string, number> };


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

/**
 * Il sigillo della verifica: il tondo dentellato di Instagram e X, non un
 * cerchio.

 * Chiesto cosi': *"il verificato non farlo a cerchio ma la classica roba
 * spigolosa di Instagram ecc"*. Ed e' la forma giusta per la ragione per cui
 * esiste: un tondo liscio con dentro un segno somiglia a un tasto, a una
 * notifica, a mille altre cose. Quella dentellata non somiglia a niente
 * tranne che a se stessa — e' un sigillo, e si legge come un sigillo anche a
 * venticinque punti in mezzo a un nome.
 *
 * Dodici punte, quelle di X: sei sarebbe una stella, venti tornerebbe un
 * cerchio. Il raggio interno all'85% del suo perche' la dentellatura si veda
 * senza che le punte diventino spine, e le punte si arrotondano con un filo
 * dello stesso colore invece che con dei raccordi disegnati a mano.
 */
function sigillo(cx, cy, raggio) {
  const punte = 12;
  const dentro = raggio * 0.855;
  const angoli = [];
  for (let i = 0; i < punte * 2; i += 1) {
    const r = i % 2 === 0 ? raggio : dentro;
    const angolo = (Math.PI / punte) * i - Math.PI / 2;
    angoli.push(`${(cx + Math.cos(angolo) * r).toFixed(2)} ${(cy + Math.sin(angolo) * r).toFixed(2)}`);
  }
  return `M${angoli.join(" L")} Z`;
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
  autoreFoto,
  autoreVerificato,
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

  /*
    La riga di chi l'ha fatta: faccia, nome, spunta, e quante canzoni.

    =========================================================================
    Quando non c'e' nessun nome
    =========================================================================

    Chiesto cosi': *"i brani non hanno un creatore (adesso esce Founder), ma
    non va bene: quello sono io che li ho pubblicati e non devo uscire da
    nessuna parte. Devono uscire solo nelle playlist o brani pubblicati da
    persone che non sono admin"*.

    Ed e' una distinzione vera, non una preferenza. Una playlist del catalogo e'
    dell'app: dire "di Founder" non aggiunge un'informazione, mette il nome di
    una persona su una cosa che quella persona non ha fatto — ha solo premuto
    "pubblica". Una playlist di qualcuno invece **e'** di qualcuno, e li' il nome
    e' meta' del motivo per cui la si apre.

    Quindi qui non si sceglie fra due nomi: si sceglie fra una riga che ha un
    autore e una che non ce l'ha. Senza autore resta il conto dei brani, che e'
    l'unica cosa vera che quella riga aveva da dire.
  */
  const MISURA_SOTTO = 27;
  const conto = `${quanti} ${quanti === 1 ? "track" : "tracks"}`;
  const LATO_FACCIA = 32;
  const SPUNTA = 25;

  let rigaAutore = "";
  const baseSotto = y + 26;

  if (autorePulito) {
    /*
      Si misura, poi si mette. La faccia e la spunta sono figure e non lettere:
      il testo non le scavalca da solo, e ogni pezzo deve sapere dove finisce
      quello prima. Con il nome tagliato al punto giusto, la riga sta dentro la
      colonna anche con un nome lungo il doppio della cartolina.
    */
    const conFaccia = Boolean(autoreFoto);
    const inizioNome = COLONNA.x + (conFaccia ? LATO_FACCIA + 12 : 0);
    /*
      Lo stacco prima del conto dei brani.

      Serve un numero e non uno spazio scritto nel testo: dentro un SVG lo
      spazio in testa a una riga viene mangiato, ed e' il motivo per cui il
      punto risultava appiccicato alla spunta — *"il · 19 tracks leggermente
      piu' staccato dal verificato"*.
    */
    const STACCO = 14;
    const dopoIlNome =
      (autoreVerificato ? SPUNTA + 7 : 0) + STACCO + larghezza(`· ${conto}`, corpo, MISURA_SOTTO);
    const spazioNome = COLONNA.larghezza - (inizioNome - COLONNA.x) - dopoIlNome;
    const nomeCorto = accorcia(autorePulito, corpo, MISURA_SOTTO, Math.max(60, spazioNome));
    const fineNome = inizioNome + larghezza(nomeCorto, corpo, MISURA_SOTTO);

    if (conFaccia) {
      rigaAutore +=
        `<clipPath id="tondoFaccia"><circle cx="${COLONNA.x + LATO_FACCIA / 2}" cy="${baseSotto - 9}" r="${LATO_FACCIA / 2}"/></clipPath>` +
        `<image x="${COLONNA.x}" y="${baseSotto - 9 - LATO_FACCIA / 2}" width="${LATO_FACCIA}" height="${LATO_FACCIA}" href="${autoreFoto}" preserveAspectRatio="xMidYMid slice" clip-path="url(#tondoFaccia)"/>` +
        `<circle cx="${COLONNA.x + LATO_FACCIA / 2}" cy="${baseSotto - 9}" r="${LATO_FACCIA / 2}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>`;
    }

    rigaAutore += `<text x="${inizioNome}" y="${baseSotto}" font-family="MW Body" font-size="${MISURA_SOTTO}" fill="#ffffff">${pulisci(nomeCorto)}</text>`;

    if (autoreVerificato) {
      /*
        La spunta e' disegnata e non scritta: un carattere qualunque non ce
        l'ha, e i due che ce l'hanno la disegnano ognuno a modo suo.

        Blu con il segno bianco, chiesto cosi'. Ed e' anche l'unico colore che
        qui puo' stare fermo: tutto il resto della cartolina cambia tinta con la
        playlist, ma una spunta che cambia colore non si legge piu' come "questo
        e' verificato" — si legge come decorazione. Il blu della verifica e' un
        segno che la gente conosce gia' da altrove, e vale proprio perche' e'
        sempre lo stesso.
      */
      const BLU = "#1d9bf0";
      const cx = fineNome + 7 + SPUNTA / 2;
      const cy = baseSotto - 9;
      const r = SPUNTA / 2;
      rigaAutore +=
        `<path d="${sigillo(cx, cy, r)}" fill="${BLU}" stroke="${BLU}" stroke-width="${r * 0.16}" stroke-linejoin="round"/>` +
        `<path d="M${cx - r * 0.44} ${cy + r * 0.03} l${r * 0.32} ${r * 0.34} l${r * 0.6} -${r * 0.62}" fill="none" stroke="#ffffff" stroke-width="${r * 0.34}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }

    const dopo = fineNome + (autoreVerificato ? SPUNTA + 7 : 0) + STACCO;
    rigaAutore += `<text x="${dopo}" y="${baseSotto}" font-family="MW Body" font-size="${MISURA_SOTTO}" fill="${tinta}">· ${pulisci(conto)}</text>`;
  } else {
    rigaAutore = `<text x="${COLONNA.x}" y="${baseSotto}" font-family="MW Body" font-size="${MISURA_SOTTO}" fill="${tinta}">${pulisci(conto)}</text>`;
  }
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

    /*
      ======================================================================
      Chi l'ha fatta — e quando invece non lo dice nessuno
      ======================================================================

      Chiesto cosi': *"i brani non hanno un creatore (adesso esce Founder), ma
      non va bene: quello sono io che li ho pubblicati e non devo uscire da
      nessuna parte. Devono uscire solo nelle playlist pubblicate da persone
      che non sono admin"*.

      La distinzione ce l'ha gia' il database: `playlist.type` vale `admin` per
      le playlist del catalogo e qualcos'altro per quelle delle persone. Non si
      guarda il nome — "Founder" oggi, un altro domani — si guarda **cosa e'**
      quella playlist. Una del catalogo e' dell'app: metterci sopra il nome di
      chi ha premuto "pubblica" non aggiunge niente e attribuisce a una persona
      una cosa che non ha fatto.
    */
    const dellApp = String(playlist.type ?? "") === "admin";
    const autore = dellApp ? "" : String(playlist.creator_name ?? "");
    /*
      `creator_verified` arriva dalla funzione del database solo dopo la
      migrazione che la aggiunge; finche' non c'e', `creator_is_official` dice
      gia' la stessa cosa per quasi tutti. Cosi' la cartolina funziona prima e
      dopo, senza un giorno in cui e' rotta.
    */
    const verificato =
      !dellApp &&
      Boolean(playlist.creator_verified ?? playlist.creator_is_official);

    const { display, corpo, logo } = await prepara();

    /*
      La faccia di chi l'ha fatta, se ce n'e' una. Come la copertina va messa
      dentro il disegno: chi trasforma un SVG in PNG non va in rete.

      Un secondo e mezzo di attesa e non tre: e' un tondo da trentadue punti, e
      non vale la pena far aspettare l'anteprima intera per la faccia. Se non
      arriva, restano nome e spunta.
    */
    let autoreFoto: string | null = null;
    const indirizzoFoto = playlist.creator_avatar_url;
    if (autore && typeof indirizzoFoto === "string" && indirizzoFoto.startsWith("http")) {
      try {
        const faccia = await scarica(indirizzoFoto, 1500);
        if (faccia.byteLength <= 3_000_000) {
          const tipo = indirizzoFoto.match(/\.png(\?|$)/i) ? "png" : "jpeg";
          autoreFoto = `data:image/${tipo};base64,${inBase64(faccia)}`;
        }
      } catch {
        /* Nessuna faccia: la riga resta nome e spunta. */
      }
    }

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
      autore,
      autoreFoto,
      autoreVerificato: verificato,
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
