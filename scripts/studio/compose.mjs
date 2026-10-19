// Places a lifted subject on the shop's studio backdrop: warm sweep, soft cast shadow, consistent framing.

import sharp from "sharp";
const [inp, out, tone = "sand"] = process.argv.slice(2);
const W = 1200, H = 1500;
const tones = { sand: ["#FCF8F2", "#EADFCE"], dusk: ["#F8F4F6", "#E2D9E3"] };
const [c0, c1] = tones[tone];
const sub = sharp(inp).trim({ threshold: 1 });
const m = await sub.metadata();
const buf = await sub.toBuffer();
const meta = await sharp(buf).metadata();
const scale = Math.min((W * 0.8) / meta.width, (H * 0.68) / meta.height);
const w = Math.round(meta.width * scale), h = Math.round(meta.height * scale);
const subject = await sharp(buf).resize(w, h, { kernel: "lanczos3" }).sharpen({ sigma: 0.6 }).png().toBuffer();
const left = Math.round((W - w) / 2), top = Math.round(H * 0.47 - h / 2);
// cast shadow from the subject's own alpha
const alpha = await sharp(subject).extractChannel("alpha").toBuffer();
const shadow = await sharp({ create: { width: w, height: h, channels: 3, background: "#3a2a1a" } })
  .joinChannel(await sharp(alpha).linear(0.32, 0).toBuffer()).png().toBuffer();
const pad = 60;
const shadowBlur = await sharp(shadow).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(26).png().toBuffer();
const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
<radialGradient id="g" cx=".5" cy=".38" r=".85"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></radialGradient>
<radialGradient id="f" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2a1d12" stop-opacity=".28"/><stop offset="1" stop-color="#2a1d12" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<ellipse cx="${W / 2}" cy="${top + h + 8}" rx="${w * 0.52}" ry="${Math.max(26, w * 0.06)}" fill="url(#f)"/></svg>`;
await sharp(Buffer.from(bg))
  .composite([{ input: shadowBlur, left: left - pad + 18, top: top - pad + 34 }, { input: subject, left, top }])
  .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(out);
console.log(out, w, h);
