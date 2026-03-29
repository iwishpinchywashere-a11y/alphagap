// === ALPHAGAP: Follow All Subnet Accounts on X ===
//
// HOW TO USE:
// 1. Open x.com in Chrome, make sure you're logged in as @PinchyAlpha
// 2. Open Developer Tools (Cmd+Option+J)
// 3. Paste this entire script into the Console and press Enter
// 4. It will follow 10 accounts at a time with delays to avoid rate limits
// 5. If rate limited, wait 15 minutes and run again — it skips already-followed accounts
//
// Already followed: macrocosmosai, inference_labs, tplr_ai

(async () => {
  const ct0 = document.cookie.split(';').map(c => c.trim().split('=')).find(c => c[0] === 'ct0')?.[1];
  if (!ct0) { console.error('Not logged in — no CSRF token found'); return; }

  const hdrs = {
    'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
    'x-csrf-token': ct0,
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'content-type': 'application/x-www-form-urlencoded',
  };

  const allHandles = [
    "macrocosmosai", "inference_labs", "tplr_ai", "targoncompute", "manifoldlabs",
    "numinous_ai", "taoshiio", "trajectoryrl", "oroagents", "bitkoop",
    "404gen_", "zeussubnet", "blockmachine_", "groundlayerhq", "ppcrebel",
    "quasarmodels", "nodex0_", "ai_detection", "0x_Markets", "autoppiaai",
    "aureliusaligned", "graphitesubnet", "webuildscore", "wearetalisman", "resilabsai",
    "qbittensorlabs", "nepher_robotics", "synthdataco", "lium_io", "yanez__ai",
    "handshake_58", "babelbit", "ridges_ai", "chutes_ai", "tpn_labs",
    "harnyx_ai", "metanova_labs", "natixnetwork", "metahashsn73", "gittensor_io",
    "hippius_subnet", "loosh_ai", "taos_im", "layer_doge", "hermessubnet",
    "tatsuecosystem", "investing88ai", "bitstarterai", "bitsota", "forevermoney_ai",
    "platform_tao", "djinn_gg", "b1m_ai", "theminos_ai", "minotaursubnet",
    "tensorusd", "somasubnet", "shiftlayer_ai", "affine_io", "sundae_bar_",
    "bitrecs", "swarmsubnet", "poker44subnet",
    // Influencers & ecosystem
    "opentensor", "const_tao", "taostats", "bittloser", "SimpleTAO_io"
  ];

  let followed = 0, skipped = 0, failed = 0, rateLimited = false;

  for (const handle of allHandles) {
    if (rateLimited) break;

    try {
      const r = await fetch('https://x.com/i/api/1.1/friendships/create.json', {
        method: 'POST', headers: hdrs, credentials: 'include',
        body: `screen_name=${handle}`
      });

      if (r.status === 429) {
        console.warn(`⚠️ Rate limited after ${followed} follows. Wait 15 min and run again.`);
        rateLimited = true;
        break;
      }

      const data = await r.json();
      if (data.following) {
        if (data.name) {
          console.log(`✅ ${handle} (${data.name}) — already following or just followed`);
        }
        skipped++;
      } else if (r.ok) {
        console.log(`✅ Followed: ${handle} (${data.name})`);
        followed++;
      } else {
        console.log(`❌ Failed: ${handle} — ${data.errors?.[0]?.message || 'unknown error'}`);
        failed++;
      }

      // 2 second delay between follows
      await new Promise(r => setTimeout(r, 2000));

    } catch(e) {
      console.error(`❌ Error following ${handle}:`, e.message);
      failed++;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Followed: ${followed} | Skipped/Already: ${skipped} | Failed: ${failed}`);
  if (rateLimited) console.log(`Rate limited — run again in 15 minutes to continue.`);
})();
