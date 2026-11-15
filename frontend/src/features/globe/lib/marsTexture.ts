/**
 * Mosaico global en color de Marte (Viking MDIM 2.1) servido por NASA Mars Trek (WMTS, proyección
 * equirectangular). El nivel z tiene 2^z filas × 2^(z+1) columnas de teselas; la fila 0 es el norte y
 * la columna 0 empieza en 180°W, que es justo el formato que espera una esfera texturizada.
 * El servidor permite CORS, así que las teselas se pueden pintar en un canvas y usar como textura.
 */
const TREK_MOSAIC =
  "https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm";

export const MARS_TEXTURE_CREDIT =
  "NASA/JPL/USGS · Viking MDIM 2.1 via Mars Trek";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Tile failed: ${url}`));
    img.src = url;
  });
}

/** Une las teselas del nivel `level` en un único canvas (nivel 2 = 8×4 teselas, unos 2048×1024 px). */
export async function loadMarsTexture(level = 2): Promise<HTMLCanvasElement> {
  const rows = 2 ** level;
  const cols = 2 ** (level + 1);
  const jobs: { row: number; col: number; img: Promise<HTMLImageElement> }[] =
    [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      jobs.push({
        row,
        col,
        img: loadImage(`${TREK_MOSAIC}/${level}/${row}/${col}.jpg`),
      });
    }
  }

  const settled = await Promise.allSettled(jobs.map((j) => j.img));
  const first = settled.find(
    (s): s is PromiseFulfilledResult<HTMLImageElement> =>
      s.status === "fulfilled",
  );
  if (!first) {
    // Fallback to local 8K Mars texture bundled in /assets/mars_texture_8k.jpg
    const localImg = await loadImage("/assets/mars_texture_8k.jpg");
    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = localImg.naturalWidth || 2048;
    fallbackCanvas.height = localImg.naturalHeight || 1024;
    const fCtx = fallbackCanvas.getContext("2d");
    if (!fCtx) throw new Error("Canvas 2D is not available");
    fCtx.drawImage(localImg, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
    return fallbackCanvas;
  }

  const tile = first.value.naturalWidth;
  const canvas = document.createElement("canvas");
  canvas.width = cols * tile;
  canvas.height = rows * tile;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.fillStyle = "#9A4A2A"; // color medio de Marte para las teselas que falten
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  settled.forEach((s, i) => {
    if (s.status === "fulfilled")
      ctx.drawImage(
        s.value,
        jobs[i].col * tile,
        jobs[i].row * tile,
        tile,
        tile,
      );
  });
  return canvas;
}
