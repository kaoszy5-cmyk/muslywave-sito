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
 * Cosa NON fa, per adesso
 * ===========================================================================
 *
 * Nella fotografia di Spotify il riquadro contiene anche l'elenco dei primi
 * brani e il logo in basso. Quella non e' una cosa che WhatsApp compone: e'
 * **un'immagine sola**, disegnata da Spotify con dentro copertina, righe e
 * logo, e messa in `og:image`. Per averla uguale serve disegnarla noi allo
 * stesso modo, ed e' il passo dopo.
 *
 * Qui l'immagine e' la copertina della playlist. Il riquadro che ne esce ha
 * gia' copertina grande, nome e autore — cioe' tre quarti di quella fotografia
 * — e soprattutto **esiste**, mentre prima non c'era niente.
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

type Brano = { title?: string | null; artist?: string | null };

export default async function anteprimaDelLink(richiesta: Request, contesto: Context) {
  const risposta = await contesto.next();

  /*
    Solo le pagine vere. Se quello che sta uscendo non e' HTML — un'immagine,
    un foglio di stile, un file di dati — non c'e' niente da riscrivere, e
    provarci vorrebbe dire rovinarlo.
  */
  const tipo = risposta.headers.get("content-type") ?? "";
  if (!tipo.includes("text/html")) return risposta;

  const indirizzo = new URL(richiesta.url);
  const id = indirizzo.pathname.split("/").filter(Boolean)[1];
  if (!id) return risposta;

  const base = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const chiave = Deno.env.get("VITE_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!base || !chiave) return risposta;

  try {
    /*
      La stessa funzione che chiama l'app: `get_shared_playlist`. E' `security
      definer` e concessa ad `anon`, quindi risponde solo per le playlist che
      sono davvero pubbliche — una playlist privata da qui non esce, esattamente
      come non esce dall'app. Il controllo di chi puo' vedere cosa resta uno
      solo, nel database, e non ne nasce un secondo qui dentro.
    */
    const dati = await fetch(`${base}/rest/v1/rpc/get_shared_playlist`, {
      method: "POST",
      headers: {
        apikey: chiave,
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_playlist_id: id }),
      signal: AbortSignal.timeout(2500),
    });
    if (!dati.ok) return risposta;

    const corpo = await dati.json();
    const playlist = corpo?.playlist;
    if (!playlist) return risposta;

    const brani: Brano[] = Array.isArray(corpo?.tracks) ? corpo.tracks : [];
    const nome = String(playlist.playlist_name ?? "Playlist");
    const autore = String(playlist.creator_name ?? "MuslyWave");
    const copertina =
      typeof playlist.cover_url === "string" && playlist.cover_url.startsWith("http")
        ? playlist.cover_url
        : "https://muslywave.com/anteprima-sito.png";

    /*
      La frase sotto al titolo: chi l'ha fatta, quante canzoni, e le prime due.

      Le prime due ci sono per la stessa ragione per cui ci sono nel riquadro di
      Spotify: "Playlist di Eraldo" dice chi, non dice **cosa**. Due titoli lo
      dicono in dieci parole, e sono la sola parte che fa venire voglia di
      aprirla.
    */
    const quante = brani.length;
    const primi = brani
      .slice(0, 2)
      .map((brano) => String(brano?.title ?? "").trim())
      .filter(Boolean)
      .join(" · ");
    const descrizione = [
      `Playlist by ${autore}`,
      quante ? `${quante} ${quante === 1 ? "track" : "tracks"}` : "",
      primi,
    ]
      .filter(Boolean)
      .join(" · ");

    const titolo = `${nome} — MuslyWave`;
    const url = `https://muslywave.com/playlist/${id}`;

    const tag = `
    <link rel="canonical" href="${pulisci(url)}" />
    <meta property="og:site_name" content="MuslyWave" />
    <meta property="og:type" content="music.playlist" />
    <meta property="og:url" content="${pulisci(url)}" />
    <meta property="og:title" content="${pulisci(titolo)}" />
    <meta property="og:description" content="${pulisci(descrizione)}" />
    <meta property="og:image" content="${pulisci(copertina)}" />
    <meta property="og:image:alt" content="${pulisci(nome)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${pulisci(titolo)}" />
    <meta name="twitter:description" content="${pulisci(descrizione)}" />
    <meta name="twitter:image" content="${pulisci(copertina)}" />
`;

    const pagina = togliIVecchi(await risposta.text()).replace(
      "</head>",
      `${tag}  </head>`,
    );

    return new Response(pagina, {
      status: risposta.status,
      headers: {
        ...Object.fromEntries(risposta.headers),
        "content-type": "text/html; charset=utf-8",
        /*
          Un'ora nella cache di Netlify, e nessuna nel browser di chi la apre.
          I motori di anteprima ripassano di rado; la persona che tocca il link
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
  path: "/playlist/*",
};
