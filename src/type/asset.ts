import * as t from "zod";

export const Kind = t.enum(["image", "video", "audio", "pdf", "other"]);
export type Kind = t.infer<typeof Kind>;

export const AssetData = t.object({
  spaceId: t.string().uuid(),
  assetId: t.string().uuid(),
  size: t.number().int(),
  contentType: t.string(),
  filename: t.string(),
  kind: Kind,
});
export type AssetData = t.infer<typeof AssetData>;

export const AssetDatas = t.array(AssetData);
export type AssetDatas = t.infer<typeof AssetDatas>;
