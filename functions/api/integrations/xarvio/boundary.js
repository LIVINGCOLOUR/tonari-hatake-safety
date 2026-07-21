import {
  authorizeBff,
  byteLimitedStream,
  contentLengthExceeds,
  errorResponse,
  fetchWithTimeout,
  providerResponseTooLarge,
  requiredSecret,
  responseByteLimit,
  upstreamFailure,
  uuidIsValid,
} from "../../../_shared/bff.js";

const DEFAULT_MAX_BOUNDARY_BYTES = 10 * 1024 * 1024;
const ARCHIVE_CONTENT_TYPES = [
  "application/zip",
  "application/octet-stream",
  "application/x-zip-compressed",
];

function archiveResponseIsUsable(response) {
  if (!response.body) return false;
  const contentType = String(response.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return !contentType || ARCHIVE_CONTENT_TYPES.includes(contentType);
}

export async function onRequestGet({ request, env }) {
  const denied = authorizeBff(request, env);
  if (denied) return denied;
  const accessToken = requiredSecret(env, "XARVIO_ACCESS_TOKEN", "xarvio");
  if (!accessToken.ok) return accessToken.response;
  const fieldUuid = new URL(request.url).searchParams.get("fieldUuid");
  if (!uuidIsValid(fieldUuid)) {
    return errorResponse(400, "invalid-field-uuid", "xarvio圃場UUIDを確認してください。");
  }

  const upstream = new URL("https://fm-api.xarvio.com/api/farms/v2/fields/boundaries");
  upstream.searchParams.set("format", "shp");
  upstream.searchParams.append("fieldUuid", fieldUuid);
  const fetcher = env.__FETCH__ || fetch;
  let response;
  try {
    response = await fetchWithTimeout(fetcher, new Request(upstream, {
      headers: { Authorization: `Bearer ${accessToken.value}`, Accept: "application/zip, application/octet-stream" },
    }));
  } catch {
    return upstreamFailure("xarvio境界API");
  }
  if (!response.ok) return upstreamFailure("xarvio境界API", response.status);
  if (!archiveResponseIsUsable(response)) return upstreamFailure("xarvio境界API", response.status);
  const maxBytes = responseByteLimit(env, "XARVIO_MAX_BOUNDARY_BYTES", DEFAULT_MAX_BOUNDARY_BYTES);
  if (contentLengthExceeds(response, maxBytes)) {
    response.body?.cancel("provider-response-too-large").catch(() => {});
    return providerResponseTooLarge("xarvio境界API", maxBytes);
  }
  return new Response(byteLimitedStream(response.body, maxBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="xarvio-${fieldUuid}.zip"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Tonari-Provider": "xarvio",
      "X-Tonari-Field-Uuid": fieldUuid,
      "X-Tonari-Max-Bytes": String(maxBytes),
    },
  });
}
