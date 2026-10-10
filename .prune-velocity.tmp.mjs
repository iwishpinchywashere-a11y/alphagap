import { list, del } from "@vercel/blob";
import fs from "fs";
const token = fs.readFileSync("/Users/pinchy/Documents/Claude Code/alphagap/.env.local","utf8").match(/BLOB_READ_WRITE_TOKEN=(.+)/)[1].trim().replace(/^["']|["']$/g,"");
const sleep = ms => new Promise(r => setTimeout(r, ms));
let total=0;
while (true) {
  let r;
  try { r = await list({ prefix: "social-velocity/", limit: 1000, token }); }
  catch (e) { console.log("list err, waiting 65s:", String(e).slice(0,80)); await sleep(65000); continue; }
  if (!r.blobs.length) break;
  const urls = r.blobs.map(b => b.url);
  for (let i=0;i<urls.length;i+=100) {
    try { await del(urls.slice(i,i+100), { token }); total += Math.min(100, urls.length - i); }
    catch (e) { console.log("del err, waiting 65s:", String(e).slice(0,80)); await sleep(65000); i -= 100; }
    await sleep(1500);
  }
  console.log("deleted", total);
}
console.log("DONE", total);
