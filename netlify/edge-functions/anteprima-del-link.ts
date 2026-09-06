import type { Config, Context } from "@netlify/edge-functions";

/**
 * L'anteprima di un link condiviso, scritta dal server.
 *
 * ===========================================================================
 * Perche' non si puo' fare dalla pagina
 * ===========================================================================
 *
 * Chiesto cosi', con la fotografia di come lo fa Spotify: *"voglio che quando
 * condividi il link di una playlist si mostri come e' nell'app"*.
 *
 * WhatsApp, Instagram, Telegram e iMessage non aprono davvero la pagina:
 * mandano un programma che scarica l'HTML, legge i tag `og:` e chiude. Quel
 * programma **non esegue JavaScript**. Quindi tutto quello che l'app scrive nel
 * titolo mentre gira — e lo scrive, ogni rotta ha il suo `head` — per loro non
 * esiste: vedono il file `index.html` cosi' com'e' uscito dalla compilazione,
 * uguale per tutte le pagine.
 *
 * Ed e' per questo che una playlist e la home avevano la stessa anteprima: non
 * era un difetto, era un'app a pagina singola che si comporta come tale.
 *
 * ===========================================================================
 * Perche' Netlify va benissimo
 * ===========================================================================
 *
 * Era in dubbio: *"guarda se con Netlify si puo' fare, se non si puo' togli il
 * dominio e lo mettiamo in un altro sito"*. Si puo', e questo file e' la
 * risposta. Una Edge Function sta **davanti** al sito: prende la pagina che
 * sarebbe uscita, ci riscrive dentro i tag, e la manda. Non e' un ripiego ne'
 * un trucco, e' il modo per cui esistono.
 *
 * Costa una lettura al database per ogni anteprima, e solo per gli indirizzi
 * dichiarati in `netlify.toml`: tutto il resto del sito non passa nemmeno di
 * qui.
 *
 * ===========================================================================
 * Chi disegna l'immagine
 * ===========================================================================
 *
 * Non questo file: `cartolina-della-playlist.ts`, che risponde a
 * `/cartolina/<id>.png`. Qui si scrive solo il suo indirizzo dentro
 * `og:image`, perche' i due mestieri sono diversi — questo riscrive una
 * pagina, quello disegna un PNG — e tenerli separati vuol dire che la pagina
 * esce comunque anche se il disegnatore ha una brutta giornata.
 */

/** Le lettere che in HTML non possono restare se stesse dentro un attributo. */
function pulisci(testo: string): string {
  return testo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Toglie dalla pagina i tag che stiamo per rimpiazzare.
 *
 * Se restassero, la pagina ne avrebbe due dello stesso nome: alcuni programmi
 * leggono il primo, altri l'ultimo, e l'anteprima diventerebbe una lotteria fra
 * il ripiego del sito e quello vero della playlist.
 */
function togliIVecchi(html: string): string {
  return html.replace(
    /[ \t]*<(?:meta|link)[^>]*(?:property="og:[^"]*"|name="twitter:[^"]*"|rel="canonical")[^>]*>\r?\n?/g,
    "",
  );
}

type Brano = { title?: string | null };

/** Le tre cose che un motore di anteprima sa mostrare, gia' pronte. */
type Anteprima = { titolo: string; descrizione: string; immagine: string; tipo: string };

/**
 * Chiede al database, con la chiave pubblica e un tempo massimo.
 *
 * Sono funzioni `security definer` concesse ad `anon`: rispondono solo per
 * quello che e' davvero pubblico. Il controllo di chi puo' vedere cosa resta
 * uno solo, nel database, e non ne nasce un secondo qui dentro.
 */
async function chiedi(
  base: string,
  chiave: string,
  funzione: string,
  argomenti: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const risposta = await fetch(`${base}/rest/v1/rpc/${funzione}`, {
    method: "POST",
    headers: {
      apikey: chiave,
      Authorization: `Bearer ${chiave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(argomenti),
    signal: AbortSignal.timeout(2500),
  });
  if (!risposta.ok) return null;
  return (await risposta.json()) ?? null;
}

/**
 * L'anteprima di una playlist: la cartolina disegnata.
 *
 * L'immagine non e' la copertina: e' il PNG 1200x630 costruito da
 * `cartolina-della-playlist.ts`, con dentro copertina, nome, primi brani e
 * logo. Deve essere disegnata perche' WhatsApp da un link prende **tre** cose —
 * un titolo, una frase e un'immagine sola — e l'elenco dei brani, nel riquadro
 * di Spotify, sta dentro l'immagine.
 */
async function anteprimaDiUnaPlaylist(
  base: string,
  chiave: string,
  id: string,
): Promise<Anteprima | null> {
  const corpo = await chiedi(base, chiave, "get_shared_playlist", { p_playlist_id: id });
  const playlist = corpo?.playlist as Record<string, unknown> | undefined;
  if (!playlist) return null;

  const brani: Brano[] = Array.isArray(corpo?.tracks) ? (corpo!.tracks as Brano[]) : [];
  const nome = String(playlist.playlist_name ?? "Playlist");
  const autore = String(playlist.creator_name ?? "MuslyWave");
  const quante = brani.length;
  const primi = brani
    .slice(0, 2)
    .map((brano) => String(brano?.title ?? "").trim())
    .filter(Boolean)
    .join(" · ");

  /*
    "Playlist by ..." solo quando c'e' davvero un qualcuno.

    Le playlist del catalogo hanno `type = 'admin'`: le pubblica chi amministra
    l'app, e il suo nome non c'entra niente con loro. Chiesto cosi': *"quello
    sono io che li ho pubblicati e non devo uscire da nessuna parte"*.
  */
  const dellApp = String(playlist.type ?? "") === "admin";

  return {
    tipo: "music.playlist",
    titolo: `${nome} — MuslyWave`,
    descrizione: [
      dellApp ? "" : `Playlist by ${autore}`,
      quante ? `${quante} ${quante === 1 ? "track" : "tracks"}` : "",
      primi,
    ]
      .filter(Boolean)
      .join(" · "),
    immagine: `https://muslywave.com/cartolina/${encodeURIComponent(id)}.png`,
  };
}

/**
 * L'anteprima di un brano singolo: la copertina, e basta.
 *
 * ===========================================================================
 * Perche' qui **non** si disegna niente
 * ===========================================================================
 *
 * Per le playlist si disegna una cartolina larga. Per un brano no, ed e' una
 * differenza voluta, mostrata con la fotografia di come lo fa Spotify: *"per i
 * brani singoli non mettere neanche il colore, metti direttamente la foto della
 * canzone e basta, piu' grande"*.
 *
 * E ha ragione lui e ha ragione Spotify. Una playlist ha qualcosa da
 * **elencare** — quattro titoli che dicono cosa c'e' dentro — e quell'elenco
 * puo' stare solo dentro un'immagine disegnata. Un brano non ha niente da
 * elencare: ha una copertina, che e' gia' la cosa che lo racconta. Disegnarci
 * intorno un riquadro colorato vorrebbe dire rimpicciolire l'unica cosa che
 * conta per far posto a delle decorazioni.
 *
 * Quadrata e grande, quindi: WhatsApp e Instagram con un'immagine quadrata
 * abbastanza grande fanno il riquadro alto, con la copertina sopra e sotto
 * titolo, artista e dominio — che e' esattamente la fotografia mandata.
 *
 * Il logo accanto a "muslywave.com", in quel riquadro, non e' una cosa che si
 * mette qui: e' la **favicon** del sito, e sta dichiarata in `index.html` e in
 * `open.html`.
 */
async function anteprimaDiUnBrano(
  base: string,
  chiave: string,
  id: string,
): Promise<Anteprima | null> {
  const brano = await chiedi(base, chiave, "get_shared_track", { p_track_id: id });
  if (!brano) return null;

  const titolo = String(brano.title ?? "").trim() || "Track";
  /*
    Chi c'e' sotto al titolo. Per un brano del catalogo e' l'artista scritto sul
    brano; per uno caricato e' la persona che l'ha caricato — che e' il nome del
    profilo vero, non la casella scritta a mano, per la stessa ragione per cui
    l'app mostra quello (vedi `nomeDiChiCanta`).
  */
  const chi =
    String(brano.creator_name ?? "").trim() || String(brano.artist ?? "").trim();

  const copertina =
    typeof brano.cover_url === "string" && brano.cover_url.startsWith("http")
      ? brano.cover_url
      : "https://muslywave.com/anteprima-sito.png";

  return {
    tipo: "music.song",
    titolo: `${titolo} — MuslyWave`,
    descrizione: [chi, "Song"].filter(Boolean).join(" · "),
    immagine: copertina,
  };
}

export default async function anteprimaDelLink(richiesta: Request, contesto: Context) {
  const risposta = await contesto.next();

  /*
    Solo le pagine vere. Se quello che sta uscendo non e' HTML — un'immagine, un
    foglio di stile, un file di dati — non c'e' niente da riscrivere, e provarci
    vorrebbe dire rovinarlo.
  */
  const tipoRisposta = risposta.headers.get("content-type") ?? "";
  if (!tipoRisposta.includes("text/html")) return risposta;

  const indirizzo = new URL(richiesta.url);
  const pezzi = indirizzo.pathname.split("/").filter(Boolean);
  const cosa = pezzi[0];
  const id = pezzi[1];
  if (!id) return risposta;

  const base = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const chiave = Deno.env.get("VITE_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!base || !chiave) return risposta;

  try {
    const dati =
      cosa === "brano"
        ? await anteprimaDiUnBrano(base, chiave, id)
        : await anteprimaDiUnaPlaylist(base, chiave, id);
    if (!dati) return risposta;

    const url = `https://muslywave.com/${cosa}/${id}`;
    /*
      Le misure si dichiarano solo per la cartolina, che e' sempre 1200x630. La
      copertina di un brano e' quadrata ma non si sa quanto: dichiarare misure
      sbagliate e' peggio che non dichiararne — chi legge l'anteprima si fida di
      quello che c'e' scritto e lascia un buco della forma sbagliata.
    */
    const misure =
      cosa === "brano"
        ? ""
        : `\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />`;
    const scheda = cosa === "brano" ? "summary_large_image" : "summary_large_image";

    const tag = `
    <link rel="canonical" href="${pulisci(url)}" />
    <meta property="og:site_name" content="MuslyWave" />
    <meta property="og:type" content="${pulisci(dati.tipo)}" />
    <meta property="og:url" content="${pulisci(url)}" />
    <meta property="og:title" content="${pulisci(dati.titolo)}" />
    <meta property="og:description" content="${pulisci(dati.descrizione)}" />
    <meta property="og:image" content="${pulisci(dati.immagine)}" />${misure}
    <meta property="og:image:alt" content="${pulisci(dati.titolo)}" />
    <meta name="twitter:card" content="${scheda}" />
    <meta name="twitter:title" content="${pulisci(dati.titolo)}" />
    <meta name="twitter:description" content="${pulisci(dati.descrizione)}" />
    <meta name="twitter:image" content="${pulisci(dati.immagine)}" />
`;

    const pagina = togliIVecchi(await risposta.text()).replace("</head>", `${tag}  </head>`);

    return new Response(pagina, {
      status: risposta.status,
      headers: {
        ...Object.fromEntries(risposta.headers),
        "content-type": "text/html; charset=utf-8",
        /*
          Un'ora nella cache di Netlify, e nessuna nel browser di chi la apre. I
          motori di anteprima ripassano di rado; la persona che tocca il link
          deve vedere l'app aggiornata.
        */
        "cache-control": "public, max-age=0, must-revalidate",
        "netlify-cdn-cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    /*
      Qualunque cosa vada storta — il database lento, una risposta strana, un
      campo che non c'e' — si manda la pagina come sarebbe uscita. Un'anteprima
      generica e' un difetto; un sito che non si apre perche' il database ci ha
      messo tre secondi e' un guasto.
    */
    return risposta;
  }
}

export const config: Config = {
  path: ["/playlist/*", "/brano/*"],
};
