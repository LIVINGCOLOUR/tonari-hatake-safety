import assert from "node:assert/strict";
import test from "node:test";

import {
  createSupabaseStorageService,
  flightTrackAsset,
  reportPhotoAsset,
} from "../js/services/supabase-storage.mjs";

test("写真と飛行ログを保存可能なバイナリへ変換する", () => {
  const photo = reportPhotoAsset("data:image/png;base64,aGVsbG8=");
  assert.equal(photo.mimeType, "image/png");
  assert.equal(photo.bytes.byteLength, 5);
  const flight = flightTrackAsset([{ x: 1, y: 2, altitude: 3 }]);
  assert.equal(flight.mimeType, "application/json");
  assert.match(new TextDecoder().decode(flight.bytes), /"altitude":3/);
});

test("非公開パスは地域・利用者・所有記録の順で固定する", async () => {
  const calls = [];
  const storageBucket = {
    async upload(path, bytes, options) {
      calls.push({ path, bytes, options });
      return { data: { path } };
    },
    async createSignedUrl(path) {
      return { data: { signedUrl: `signed:${path}` } };
    },
  };
  const query = {
    upsert(row) {
      calls.push({ row });
      return this;
    },
    select() {
      return this;
    },
    async single() {
      return { data: { id: "asset-id", bucket_id: "report-assets" } };
    },
  };
  const client = {
    storage: { from: () => storageBucket },
    from: () => query,
  };
  const service = createSupabaseStorageService({ client });
  const asset = await service.upload({
    bucketId: "report-assets",
    workspaceId: "workspace-id",
    userId: "user-id",
    ownerType: "work_record",
    ownerId: "record-id",
    assetKind: "report_photo",
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/png",
  });
  assert.equal(calls[0].path, "workspace-id/user-id/work_record/record-id/report_photo.png");
  assert.equal(calls[1].row.object_path, calls[0].path);
  assert.equal(await service.signedUrl(asset), `signed:${calls[0].path}`);
});

test("許可されていない形式と容量ゼロを拒否する", async () => {
  assert.throws(
    () => reportPhotoAsset("data:text/plain;base64,aGVsbG8="),
    /JPEG、PNG、WebP/,
  );
  const client = {
    storage: { from: () => ({ upload: async () => ({ data: {} }) }) },
    from: () => ({}),
  };
  const service = createSupabaseStorageService({ client });
  await assert.rejects(
    service.upload({
      bucketId: "flight-logs",
      workspaceId: "w",
      userId: "u",
      ownerType: "plan",
      ownerId: "p",
      assetKind: "flight_track",
      bytes: new Uint8Array(),
      mimeType: "application/json",
    }),
    /25MB以下/,
  );
});
