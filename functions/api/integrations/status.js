import { authorizeBff, jsonResponse } from "../../_shared/bff.js";

export function onRequestGet({ request, env }) {
  const denied = authorizeBff(request, env);
  if (denied) return denied;
  return jsonResponse({
    ok: true,
    mode: "read-only-poc",
    providers: {
      wagri: Boolean(env.WAGRI_CLIENT_ID && env.WAGRI_CLIENT_SECRET),
      xarvio: Boolean(env.XARVIO_ACCESS_TOKEN),
    },
  });
}
