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
 * peccato; un riquadro **vuoto** perche' il disegnatore ha singhiozzato e'
 * un link che nessuno apre.
 */

/* Le larghezze vere dei caratteri nei due font, in frazioni di em. */
const LARGHEZZE = {"display":{"predefinita":0.612,"larghezze":{"32":0.254,"33":0.298,"34":0.514,"35":0.636,"36":0.606,"37":0.758,"38":0.591,"39":0.294,"40":0.398,"41":0.39,"42":0.54,"43":0.62,"44":0.294,"45":0.432,"46":0.298,"47":0.388,"48":0.648,"49":0.452,"50":0.594,"51":0.608,"52":0.636,"53":0.6,"54":0.618,"55":0.554,"56":0.6,"57":0.618,"58":0.298,"59":0.298,"60":0.62,"61":0.62,"62":0.62,"63":0.578,"64":1.014,"65":0.634,"66":0.664,"67":0.644,"68":0.666,"69":0.554,"70":0.534,"71":0.662,"72":0.656,"73":0.264,"74":0.61,"75":0.626,"76":0.542,"77":0.882,"78":0.67,"79":0.676,"80":0.604,"81":0.676,"82":0.632,"83":0.606,"84":0.588,"85":0.672,"86":0.618,"87":0.898,"88":0.644,"89":0.624,"90":0.576,"91":0.358,"92":0.388,"93":0.358,"94":0.62,"95":0.62,"96":0.296,"97":0.578,"98":0.638,"99":0.586,"100":0.638,"101":0.577,"102":0.436,"103":0.638,"104":0.616,"105":0.266,"106":0.268,"107":0.564,"108":0.266,"109":0.854,"110":0.616,"111":0.612,"112":0.638,"113":0.638,"114":0.396,"115":0.524,"116":0.456,"117":0.616,"118":0.548,"119":0.784,"120":0.592,"121":0.616,"122":0.518,"123":0.466,"124":0.258,"125":0.466,"126":0.62,"8217":0.294,"8216":0.294,"8220":0.514,"8221":0.514,"8211":0.584,"8212":0.888,"183":0.218,"8230":0.798,"224":0.578,"232":0.577,"233":0.577,"236":0.266,"242":0.612,"249":0.616}},"corpo":{"predefinita":0.604,"larghezze":{"32":0.2666,"33":0.3042,"34":0.4941,"35":0.6387,"36":0.646,"37":0.9932,"38":0.6533,"39":0.313,"40":0.3687,"41":0.3687,"42":0.5205,"43":0.6675,"44":0.3032,"45":0.4624,"46":0.3032,"47":0.3696,"48":0.6455,"49":0.415,"50":0.6162,"51":0.627,"52":0.6562,"53":0.603,"54":0.6299,"55":0.5713,"56":0.6294,"57":0.6299,"58":0.3032,"59":0.3154,"60":0.6675,"61":0.6675,"62":0.6675,"63":0.5273,"64":0.9824,"65":0.709,"66":0.6567,"67":0.7334,"68":0.7217,"69":0.603,"70":0.5894,"71":0.7476,"72":0.7446,"73":0.2725,"74":0.5752,"75":0.6875,"76":0.5654,"77":0.9126,"78":0.7563,"79":0.7666,"80":0.6416,"81":0.7686,"82":0.6479,"83":0.646,"84":0.6528,"85":0.7402,"86":0.709,"87":1.0029,"88":0.7007,"89":0.6963,"90":0.6406,"91":0.3687,"92":0.3696,"93":0.3687,"94":0.4766,"95":0.4629,"96":0.3369,"97":0.5679,"98":0.6182,"99":0.5771,"100":0.6182,"101":0.5874,"102":0.3794,"103":0.6196,"104":0.6016,"105":0.252,"106":0.252,"107":0.5591,"108":0.252,"109":0.8882,"110":0.6016,"111":0.604,"112":0.6182,"113":0.6182,"114":0.3867,"115":0.5386,"116":0.3403,"117":0.6016,"118":0.5747,"119":0.8291,"120":0.5571,"121":0.5752,"122":0.5591,"123":0.4404,"124":0.3457,"125":0.4404,"126":0.6675,"8217":0.2773,"8216":0.2773,"8220":0.4736,"8221":0.4707,"8211":0.5,"8212":1.0,"183":0.3032,"8230":0.9102,"224":0.5679,"232":0.5874,"233":0.5874,"236":0.252,"242":0.604,"249":0.6016}}} as {
  display: { predefinita: number; larghezze: Record<string, number> };
  corpo: { predefinita: number; larghezze: Record<string, number> };
};

const RADICE = "https://muslywave.com";

/*
  Il rasterizzatore, i font e il logo si caricano **una volta per macchina**,
  non una volta per richiesta: la promessa vive nel modulo, e chi arriva dopo
  aspetta la stessa. Sono due megabyte e mezzo di WebAssembly; presi a ogni
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
  if (scritte.length < String(testo).trim().length) {
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

  /*
    Il titolo si adatta: grande se e' corto, piu' piccolo se e' lungo. Cosi'
    "Gym Nasheeds" riempie il riquadro e un nome di dieci parole ci sta lo
    stesso, invece di uscire dal bordo o restare minuscolo per prudenza.
  */
  const misuraTitolo = String(nome).length > 26 ? 52 : 64;
  const righeTitolo = aCapo(nome, display, misuraTitolo, COLONNA.larghezza, 2);
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
    `${autore} · ${quanti} ${quanti === 1 ? "track" : "tracks"}`,
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
      const titolo = accorcia(brano.titolo, corpo, 25, COLONNA.larghezza - numeroLargo - 8);
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
