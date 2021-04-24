const envGet = (name: string, def?: string): string => {
  const out = process.env[name];
  if (out === undefined) {
    if (def !== undefined) return def;

    throw new Error(
      `environment variable ${name} is not defined and no default was given`
    );
  }

  return out;
};

const envGetBool = (name: string, def?: boolean): boolean => {
  const out = process.env[name];
  if (out === undefined) {
    if (def !== undefined) return def;

    throw new Error(
      `environment variable ${name} is not defined and no default was given`
    );
  }

  const trimmed = out.trim();
  return trimmed !== "" && trimmed !== "0" && trimmed.toLowerCase() !== "false";
};

export default {
  BASE_URL: envGet("BASE_URL"),

  GOOGLE_CLIENT_ID: envGet("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: envGet("GOOGLE_CLIENT_SECRET"),

  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_FORCE_PATH_STYLE: envGetBool("S3_FORCE_PATH_STYLE", false),
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT,

  SPACE_TABLE: envGet("SPACE_TABLE"),
  ASSET_BUCKET: envGet("ASSET_BUCKET"),
  ASSET_DATA_TABLE: envGet("ASSET_DATA_TABLE"),
  ITEM_TABLE: envGet("ITEM_TABLE"),
  LOG_TABLE: envGet("LOG_TABLE"),
  SESSION_TABLE: envGet("SESSION_TABLE"),
  TABLE_TABLE: envGet("TABLE_TABLE"),
  USER_TABLE: envGet("USER_TABLE"),
};
