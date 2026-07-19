import { writeFile } from "node:fs/promises";

const [inputUrl, output, qualityArg = "82", port = "9238"] = process.argv.slice(2);
if (!inputUrl || !output) {
  throw new Error("Usage: node tools/convert-image.mjs <input-url> <output.webp> [quality] [port]");
}

const pageUrl = new URL("/", inputUrl).href;
const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(pageUrl)}`, { method: "PUT" });
if (!targetResponse.ok) throw new Error(`Could not create browser target: ${targetResponse.status}`);
const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let messageId = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function command(method, params = {}) {
  const id = ++messageId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await command("Runtime.enable");
await new Promise((resolve) => setTimeout(resolve, 800));
const expression = `(async () => {
  const image = new Image();
  image.src = ${JSON.stringify(inputUrl)};
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas.toDataURL('image/webp', ${Number(qualityArg) / 100});
})()`;
const evaluated = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
if (evaluated.exceptionDetails || !evaluated.result.value) throw new Error("Browser image conversion failed");
const base64 = evaluated.result.value.replace(/^data:image\/webp;base64,/, "");
await writeFile(output, Buffer.from(base64, "base64"));
await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`, { method: "PUT" });
socket.close();
