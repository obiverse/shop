// Lifted subject → catalogue photo. Colour-matched seamless backdrop with a spotlight, a gentle grade on the
// product (contrast, colour, clarity, feathered edge), a shadow tinted to the backdrop, and an optional
// floor reflection for bottles and boxes.
//   node compose.mjs <cut.png> <out.jpg> [light=#FFE3C7] [deep=#FFB877] [reflect|floor] [tilt°] [cutout.webp]
import sharp from "sharp";

const [inp, out, c0 = "#FFE3C7", c1 = "#FFB877", style = "floor", tilt = "0", cutOut] = process.argv.slice(2);
const W = 1200, H = 1500;
const reflect = style === "reflect";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
const shade = mix(c1, "#140c06", 0.72); // shadows take the backdrop's colour, never flat grey

// 1. Grade the product and feather its cut edge.
const trimmed = await sharp(inp).rotate(+tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).trim({ threshold: 1 }).toBuffer();
const rgb = await sharp(trimmed).removeAlpha()
  .modulate({ saturation: 1.12, brightness: 1.03 })
  .linear(1.07, -8)
  .sharpen({ sigma: 0.8, m1: 0.6, m2: 2.2 })
  .toBuffer();
const alpha = await sharp(trimmed).extractChannel(3).blur(0.7).toBuffer();
const graded = await sharp(rgb).joinChannel(alpha).png().toBuffer();

// 2. Frame it.
const m = await sharp(graded).metadata();
const scale = Math.min((W * 0.8) / m.width, (H * (reflect ? 0.6 : 0.66)) / m.height);
const w = Math.round(m.width * scale), h = Math.round(m.height * scale);
const subject = await sharp(graded).resize(w, h, { kernel: "lanczos3" }).sharpen({ sigma: 0.5 }).png().toBuffer();
const left = Math.round((W - w) / 2);
const top = Math.round(H * (reflect ? 0.43 : 0.47) - h / 2);
const floor = top + h;

// 3. Shadow from the product's own silhouette, tinted.
const sa = await sharp(subject).extractChannel("alpha").linear(0.4, 0).toBuffer();
const pad = 80;
const drop = await sharp({ create: { width: w, height: h, channels: 3, background: shade } }).joinChannel(sa)
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .blur(30).png().toBuffer();

// 4. Reflection: flipped, faded to nothing.
const layers = [];
if (reflect) {
  const rh = Math.round(h * 0.42);
  const flipped = await sharp(subject).flip().extract({ left: 0, top: 0, width: w, height: rh }).toBuffer();
  const fade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${rh}"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${w}" height="${rh}" fill="url(#f)"/></svg>`);
  const mirrored = await sharp(flipped).composite([{ input: fade, blend: "dest-in" }]).png().toBuffer();
  layers.push({ input: mirrored, left, top: floor + 2 });
}

const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs>
  <radialGradient id="g" cx=".5" cy=".4" r=".9"><stop offset="0" stop-color="${c0}"/><stop offset=".55" stop-color="${mix(c0, c1, 0.55)}"/><stop offset="1" stop-color="${c1}"/></radialGradient>
  <radialGradient id="spot" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="c" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${shade}" stop-opacity=".42"/><stop offset="1" stop-color="${shade}" stop-opacity="0"/></radialGradient>
  ${reflect ? `<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".02" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` : ""}
</defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<ellipse cx="${W / 2}" cy="${top + h * 0.45}" rx="${W * 0.46}" ry="${W * 0.46}" fill="url(#spot)"/>
${reflect ? `<rect x="0" y="${floor}" width="${W}" height="${H - floor}" fill="url(#fl)"/>` : ""}
<ellipse cx="${W / 2}" cy="${floor - (reflect ? 2 : -6)}" rx="${w * 0.56}" ry="${Math.max(18, w * (reflect ? 0.035 : 0.07))}" fill="url(#c)"/>
</svg>`;

await sharp(Buffer.from(bg))
  .composite([
    ...(reflect ? [] : [{ input: drop, left: left - pad + 14, top: top - pad + 30 }]),
    ...layers,
    { input: subject, left, top },
  ])
  .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toFile(out);

// Transparent cut-out for banners, stories and the quick-add sheet.
if (cutOut) await sharp(graded).resize(900, 900, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 92 }).toFile(cutOut);
console.log(out);
