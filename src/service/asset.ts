import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import {
  GetObjectCommand,
  GetObjectCommandOutput,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { marshall } from "@aws-sdk/util-dynamodb";
import config from "config";
import { formatRFC7231 } from "date-fns";
import { NextApiResponse } from "next";
import { Readable } from "stream";
import { GetAssetHeaders, GetAssetQuery } from "type/asset";
import { AssetData, AssetDatas, GetAssetDataQuery, getKind } from "type/assetData";
import { ApiInternalServerError } from "type/error";
import { SpaceItem } from "type/space";
import { getItemsFromTable } from "util/dynamodb";
import { dynamoDbConfig, s3Config, Service, ServiceParams } from "./common";

type ApiHeaders = {
  name: string;
  value: string | number | readonly string[];
}[];

class AssetResponse {
  constructor(
    readonly status: number,
    readonly headers: ApiHeaders,
    readonly body: Readable | undefined
  ) {}

  write(res: NextApiResponse): void {
    this.headers.forEach(({ name, value }) => res.setHeader(name, value));

    res.status(this.status);

    if (this.body instanceof Readable) {
      this.body.pipe(res);
    } else {
      res.end();
    }
  }
}

type AssetServiceParams = {
  maxAge?: number;
} & ServiceParams;

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export class AssetService extends Service {
  readonly bucket: string;
  readonly tableName: string;
  readonly maxAge: number = 28 * DAY;

  private readonly s3: S3Client;
  private readonly db: DynamoDBClient;

  constructor(params: AssetServiceParams) {
    super(params, {
      bucket: config.ASSET_BUCKET,
      tableName: config.SPACE_TABLE,
    });

    this.bucket = config.ASSET_BUCKET;
    this.tableName = config.SPACE_TABLE;
    if (params.maxAge) this.maxAge = params.maxAge;

    this.s3 = new S3Client(s3Config(this.logger));
    this.db = new DynamoDBClient(dynamoDbConfig(this.logger));
  }

  private constructHeaders(
    res: HeadObjectCommandOutput | GetObjectCommandOutput
  ): ApiHeaders {
    const vals = [
      { name: "ETag", value: res.ETag },
      { name: "Last-Modified", value: res.LastModified },
      { name: "Accept-Ranges", value: res.AcceptRanges },
      { name: "Content-Type", value: res.ContentType },
      { name: "Content-Length", value: res.ContentLength },
      { name: "Content-Encoding", value: res.ContentEncoding },
      {
        name: "Content-Range",
        value: "ContentRange" in res ? res.ContentRange : undefined,
      },
      {
        name: "Cache-Control",
        value: `immutable, max-age=${this.maxAge}, stale-while-revalidate=${this.maxAge}`,
      },
    ];

    const out = [];
    for (const { name, value } of vals) {
      if (value === undefined) continue;

      let v;
      if (typeof value === "string") v = value;
      else if (typeof value === "number") v = value;
      else v = formatRFC7231(value);

      out.push({
        name,
        value: v,
      });
    }

    return out;
  }

  async headAsset(
    query: GetAssetQuery,
    override?: { status?: number }
  ): Promise<AssetResponse> {
    const cmd = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: query.assetId,
    });

    const data = await this.s3.send(cmd);

    return new AssetResponse(
      override?.status ?? 204,
      this.constructHeaders(data),
      undefined
    );
  }

  async getAsset(
    query: GetAssetQuery,
    headers: GetAssetHeaders
  ): Promise<AssetResponse> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: query.assetId,
      Range: headers.range,
      IfModifiedSince: headers["if-modified-since"],
      IfNoneMatch: headers["if-none-match"],
    });

    let data;
    try {
      data = await this.s3.send(cmd);
    } catch (error) {
      if (error?.$metadata?.httpStatusCode === 304) {
        return this.headAsset(query, { status: 304 });
      }

      throw error;
    }

    if (!data.Body) {
      throw new ApiInternalServerError(
        this.requestId,
        "S3 did not return any data when it should have"
      );
    }

    return new AssetResponse(
      data.ContentRange === undefined ? 200 : 206,
      this.constructHeaders(data),
      data.Body as Readable
    );
  }

  async uploadAsset(
    body: Exclude<PutObjectCommandInput["Body"], undefined>,
    params: Omit<AssetData, "kind" | "sk">
  ): Promise<void> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.assetId,
      Body: body,
      ContentType: params.contentType,
      ContentLength: params.size,
      Metadata: {
        name: params.filename,
      },
    });

    this.logger.info(params, "uploading file to s3");

    await this.s3.send(cmd);

    const kind = getKind(params.contentType);
    const item: AssetData = { ...params, sk: `asset:${params.assetId}`, kind };
    const dbCmd = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(item),
    });

    await this.db.send(dbCmd);
  }

  async getAssetData(query: GetAssetDataQuery): Promise<AssetDatas> {
    const data = await getItemsFromTable(this.db, {
      tableName: this.tableName,
      partition: { key: "spaceId", value: query.spaceId },
      sort: { key: "sk", prefix: "asset:", value: query.assetId },
    });

    return AssetDatas.parse(
      data.map((v) => SpaceItem.parse(v)).filter((v) => v.sk.startsWith("asset:"))
    );
  }
}
