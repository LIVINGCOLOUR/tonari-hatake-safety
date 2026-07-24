export class SupabaseStorageError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "SupabaseStorageError";
    this.code = code;
  }
}

const BUCKET_LIMITS = Object.freeze({
  "report-assets": 10 * 1024 * 1024,
  "flight-logs": 25 * 1024 * 1024,
});

const OWNER_TYPES = new Set(["work_record", "flight_log", "field", "plan"]);
const ASSET_KINDS = new Set(["report_photo", "flight_track", "boundary", "other"]);

function required(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new SupabaseStorageError("missing-value", `${label}が設定されていません。`);
  return normalized;
}

function safeSegment(value) {
  return required(value, "保存先").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resultData(result, operation) {
  if (result?.error) {
    throw new SupabaseStorageError(
      `${operation}-failed`,
      "添付データをクラウドへ保存できませんでした。",
      { cause: result.error },
    );
  }
  return result?.data || null;
}

function bytesFromDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) throw new SupabaseStorageError("invalid-data-url", "写真データの形式を確認してください。");
  const binary = atob(match[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, mimeType: match[1] };
}

function extensionFor(mimeType) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/json": "json",
    "application/geo+json": "geojson",
  };
  return extensions[mimeType] || "bin";
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) return "";
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function reportPhotoAsset(dataUrl) {
  const { bytes, mimeType } = bytesFromDataUrl(dataUrl);
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new SupabaseStorageError("invalid-photo-type", "JPEG、PNG、WebPの写真を選択してください。");
  }
  return { bytes, mimeType };
}

export function flightTrackAsset(points) {
  if (!Array.isArray(points) || !points.length) {
    throw new SupabaseStorageError("missing-flight-track", "飛行ログの点列がありません。");
  }
  const bytes = new TextEncoder().encode(JSON.stringify({
    format: "tonari-hatake-flight-track",
    version: 1,
    points,
  }));
  return { bytes, mimeType: "application/json" };
}

export function createSupabaseStorageService({ client } = {}) {
  if (!client?.storage || typeof client.from !== "function") {
    throw new SupabaseStorageError("missing-client", "クラウド添付サービスを利用できません。");
  }

  return Object.freeze({
    async upload({
      bucketId,
      workspaceId,
      userId,
      ownerType,
      ownerId,
      assetKind,
      bytes,
      mimeType,
      metadata = {},
    } = {}) {
      const bucket = required(bucketId, "保存領域");
      const limit = BUCKET_LIMITS[bucket];
      if (!limit) throw new SupabaseStorageError("invalid-bucket", "保存領域を確認してください。");
      if (!OWNER_TYPES.has(ownerType)) {
        throw new SupabaseStorageError("invalid-owner-type", "添付先の種類を確認してください。");
      }
      if (!ASSET_KINDS.has(assetKind)) {
        throw new SupabaseStorageError("invalid-asset-kind", "添付データの種類を確認してください。");
      }
      const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      if (!body.byteLength || body.byteLength > limit) {
        throw new SupabaseStorageError("invalid-size", `添付データは${Math.round(limit / 1024 / 1024)}MB以下にしてください。`);
      }
      const workspace = safeSegment(workspaceId);
      const user = safeSegment(userId);
      const owner = safeSegment(ownerId);
      const mime = String(mimeType || "application/octet-stream");
      const objectPath = `${workspace}/${user}/${ownerType}/${owner}/${assetKind}.${extensionFor(mime)}`;
      resultData(
        await client.storage.from(bucket).upload(objectPath, body, {
          contentType: mime,
          upsert: true,
          cacheControl: "3600",
        }),
        "asset-upload",
      );
      const row = {
        workspace_id: workspaceId,
        owner_user_id: userId,
        owner_type: ownerType,
        owner_id: ownerId,
        asset_kind: assetKind,
        bucket_id: bucket,
        object_path: objectPath,
        mime_type: mime,
        byte_size: body.byteLength,
        sha256: await sha256(body),
        asset_data: metadata,
      };
      const asset = resultData(
        await client.from("app_assets")
          .upsert(row, { onConflict: "bucket_id,object_path" })
          .select()
          .single(),
        "asset-record-save",
      );
      return { ...asset, object_path: objectPath };
    },

    async signedUrl(asset, expiresIn = 900) {
      const bucket = required(asset?.bucket_id, "保存領域");
      const path = required(asset?.object_path, "保存場所");
      const seconds = Math.min(3600, Math.max(60, Number(expiresIn) || 900));
      const data = resultData(
        await client.storage.from(bucket).createSignedUrl(path, seconds),
        "signed-url",
      );
      return data?.signedUrl || "";
    },
  });
}
