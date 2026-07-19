import { writeFile } from "node:fs/promises";

const [url, output, widthArg = "1440", heightArg = "960", port = "9238", mode = "viewport", waitArg = "9000"] = process.argv.slice(2);
if (!url || !output) {
  throw new Error("Usage: node tools/capture-page.mjs <url> <output> [width] [height] [port] [viewport|full] [waitMs]");
}

const width = Number(widthArg);
const height = Number(heightArg);
const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
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

await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: false,
});
await command("Page.navigate", { url });
await new Promise((resolve) => setTimeout(resolve, Number(waitArg)));
await command("Runtime.evaluate", {
  expression: "(() => { if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: 'start' }); })()",
});
await new Promise((resolve) => setTimeout(resolve, 500));
const format = output.toLowerCase().endsWith(".webp") ? "webp" : "png";
const result = await command("Page.captureScreenshot", {
  format,
  fromSurface: true,
  ...(mode === "full" ? { captureBeyondViewport: true } : {}),
  ...(format === "webp" ? { quality: 84 } : {}),
});
await writeFile(output, Buffer.from(result.data, "base64"));
await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`, { method: "PUT" });
socket.close();
