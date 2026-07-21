import {
  authorizeBff,
  errorResponse,
  fetchWithTimeout,
  requiredSecret,
  upstreamFailure,
  uuidIsValid,
} from "../../../_shared/bff.js";

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
  const body = await response.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="xarvio-${fieldUuid}.zip"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Tonari-Provider": "xarvio",
      "X-Tonari-Field-Uuid": fieldUuid,
    },
  });
}
