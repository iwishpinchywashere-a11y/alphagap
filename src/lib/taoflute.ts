// taoflute.com Discord message archive client
// taoflute is a public Grafana instance that archives the entire Bittensor Discord.
// We query it to recover content of messages that have since been deleted from Discord.

const TAOFLUTE_BASE = "https://taoflute.com";
const TAOFLUTE_DATASOURCE_ID = 3;

export interface TaofluteMessage {
  messageId: string;  // Discord snowflake ID
  channelId: string;  // Discord channel ID
  content: string;
  username: string;
  timestamp: string;  // ISO timestamp from Discord
}

/**
 * Query taoflute for messages from specific Discord channels within the last N hours.
 * Returns at most 500 rows, newest first.
 */
export async function queryTaofluteMessages(
  channelIds: string[],
  hoursBack = 36
): Promise<TaofluteMessage[]> {
  if (channelIds.length === 0) return [];

  // Build the SQL IN clause (safe — all values are Discord snowflakes, numeric strings)
  const channelList = channelIds.map(id => `'${id.replace(/[^0-9]/g, "")}'`).join(", ");

  const rawSql = [
    "SELECT",
    "  uuid            AS message_id,",
    "  channel_id,",
    "  json->>'message'   AS content,",
    "  json->>'username'  AS username,",
    "  json->>'timestamp' AS timestamp",
    "FROM discord_messages",
    `WHERE created_on > NOW() - INTERVAL '${hoursBack} hours'`,
    `  AND channel_id IN (${channelList})`,
    "  AND json->>'message' IS NOT NULL",
    "  AND length(json->>'message') > 10",
    "ORDER BY created_on DESC",
    "LIMIT 500",
  ].join("\n");

  try {
    const res = await fetch(`${TAOFLUTE_BASE}/api/ds/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        queries: [
          {
            refId: "A",
            datasourceId: TAOFLUTE_DATASOURCE_ID,
            rawSql,
            format: "table",
          },
        ],
        from: `now-${hoursBack}h`,
        to: "now",
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.error(`[taoflute] Query failed: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const frame = data?.results?.A?.frames?.[0];
    if (!frame) return [];

    // Grafana data-frame format: schema.fields + data.values (column-major arrays)
    const fields: Array<{ name: string }> = frame.schema?.fields ?? [];
    const values: unknown[][] = frame.data?.values ?? [];

    const idx = (name: string) => fields.findIndex(f => f.name === name);
    const msgIdx  = idx("message_id");
    const chanIdx = idx("channel_id");
    const conIdx  = idx("content");
    const userIdx = idx("username");
    const tsIdx   = idx("timestamp");

    if (msgIdx === -1 || chanIdx === -1) return [];

    const rowCount = (values[0] ?? []).length;
    const messages: TaofluteMessage[] = [];

    for (let i = 0; i < rowCount; i++) {
      const messageId = String(values[msgIdx]?.[i] ?? "").trim();
      const channelId = String(values[chanIdx]?.[i] ?? "").trim();
      if (!messageId || !channelId) continue;

      messages.push({
        messageId,
        channelId,
        content: conIdx  !== -1 ? String(values[conIdx]?.[i]  ?? "") : "",
        username: userIdx !== -1 ? String(values[userIdx]?.[i] ?? "") : "unknown",
        timestamp: tsIdx  !== -1 ? String(values[tsIdx]?.[i]  ?? "") : "",
      });
    }

    return messages;
  } catch (e) {
    console.error("[taoflute] Query error:", e);
    return [];
  }
}
