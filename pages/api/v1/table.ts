import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { requestLogger, asAWSLogger } from "logger";
import { NextApiRequest, NextApiResponse } from "next";
import { ApiInternalServerError, ApiNotFoundError } from "type/error";
import { GetTableQuery, Table, UpdateTableBody } from "type/table";
import { envGet } from "util/env";
import { ApiError, parseRequest } from "util/parseRequest";

export default async function handle_table(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const [logger, requestId] = requestLogger(req, res);
  const db = new DynamoDBClient({
    endpoint: process.env.DYNAMODB_ENDPOINT,
    logger: asAWSLogger("DynamoDB", logger),
  });

  async function getTable(spaceId: string): Promise<Table> {
    const cmd = new GetItemCommand({
      TableName: envGet("TABLE_TABLE"),
      Key: marshall({ spaceId }),
    });

    const res = await db.send(cmd);
    if (res.Item === undefined)
      throw new ApiNotFoundError(requestId, `table not found for space ${spaceId}`);

    const parsed = Table.safeParse(unmarshall(res.Item));
    if (!parsed.success) throw new ApiInternalServerError(requestId);

    return parsed.data;
  }

  async function updateTable(table: UpdateTableBody): Promise<Table | null> {
    const now = new Date().toISOString();

    const cmd = new UpdateItemCommand({
      TableName: envGet("TABLE_TABLE"),
      Key: marshall({ spaceId: table.spaceId }),
      UpdateExpression: "SET updated = :updated, assetId = :assetId",
      ExpressionAttributeValues: marshall({
        ":updated": now,
        ":assetId": table.assetId,
      }),
      ReturnValues: "ALL_NEW",
    });

    try {
      const res = await db.send(cmd);

      if (res.Attributes === undefined) {
        throw new ApiInternalServerError(requestId);
      }

      const parsed = Table.safeParse(res.Attributes);
      if (!parsed.success) return null;

      return parsed.data;
    } catch (error) {
      if (error?.name === "ResourceNotFoundException") {
        const out = { ...table, updated: now };
        const cmd = new PutItemCommand({
          TableName: envGet("TABLE_TABLE"),
          Item: marshall(out),
        });

        await db.send(cmd);

        return out;
      }

      throw error;
    }
  }

  const allow = "OPTIONS, GET, POST, PUT, DELETE";

  try {
    switch (req.method) {
      case "OPTIONS":
        res.setHeader("Allow", allow);
        return res.status(204).end();

      case "GET": {
        const { query } = parseRequest({ query: GetTableQuery })(req, requestId);
        const table = await getTable(query.spaceId);
        return res.status(200).json({ table });
      }

      case "POST": {
        const { body } = parseRequest({ body: UpdateTableBody })(req, requestId);
        const table = await updateTable(body);
        return res.status(200).json({ table });
      }

      default:
        res.setHeader("Allow", allow);
        return res.status(405).end();
    }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error instanceof ApiInternalServerError) {
        logger.error(error, "internal server error");
      }
      res.status(error.code).json(error.json());
    } else {
      logger.error(error, "internal server error");
      res.status(500).end();
    }
  }
}