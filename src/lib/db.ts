import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

// On Vercel (serverless), use /tmp which is writable (ephemeral but functional).
// Locally, use the project root.
const isVercel = !!process.env.VERCEL;
const DB_DIR = isVercel ? "/tmp" : process.cwd();
const DB_PATH = path.join(DB_DIR, "alphagap.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
    runMigrations(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- Subnet registry (core identity from TaoStats)
    CREATE TABLE IF NOT EXISTS subnets (
      netuid INTEGER PRIMARY KEY,
      name TEXT,
      description TEXT,
      github_url TEXT,
      owner_address TEXT,
      image_url TEXT,
      discord TEXT,
      website TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- TaoStats flow/emission/pool snapshots
    CREATE TABLE IF NOT EXISTS subnet_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      -- TAO Flow
      net_flow_24h REAL,
      net_flow_7d REAL,
      net_flow_30d REAL,
      -- Emissions
      emission_rate REAL,
      emission_pct REAL,
      -- Pool
      alpha_reserve REAL,
      tao_reserve REAL,
      alpha_price REAL,
      market_cap REAL,
      -- Volume
      volume_24h REAL,
      -- Price change
      price_change_24h REAL,
      UNIQUE(netuid, timestamp)
    );

    -- GitHub events
    CREATE TABLE IF NOT EXISTS github_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER,
      repo TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_id TEXT UNIQUE,
      title TEXT,
      description TEXT,
      url TEXT,
      author TEXT,
      created_at TEXT NOT NULL,
      significance INTEGER DEFAULT 0
    );

    -- HuggingFace items
    CREATE TABLE IF NOT EXISTS huggingface_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER,
      org TEXT NOT NULL,
      item_type TEXT NOT NULL, -- model, dataset, space
      item_id TEXT UNIQUE,
      name TEXT,
      description TEXT,
      url TEXT,
      downloads INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      detected_at TEXT DEFAULT (datetime('now'))
    );

    -- Unified signal feed
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER NOT NULL,
      signal_type TEXT NOT NULL, -- flow_inflection, dev_spike, release, hf_drop, cross_signal
      strength REAL NOT NULL, -- 0-100
      title TEXT NOT NULL,
      description TEXT,
      source TEXT, -- taostats, github, huggingface, composite
      source_url TEXT,
      metadata TEXT, -- JSON blob for extra data
      analysis TEXT, -- AI-generated rich breakdown
      analysis_status TEXT DEFAULT 'pending', -- pending, analyzing, done, failed
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- GitHub repo registry (maps repos to netuids)
    CREATE TABLE IF NOT EXISTS github_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER,
      org TEXT NOT NULL,
      repo TEXT NOT NULL,
      full_name TEXT NOT NULL UNIQUE,
      last_event_id TEXT,
      last_checked_at TEXT,
      etag TEXT
    );

    -- HuggingFace org registry (maps orgs to netuids)
    CREATE TABLE IF NOT EXISTS hf_orgs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER,
      org_name TEXT NOT NULL UNIQUE,
      last_checked_at TEXT
    );

    -- Collector run log
    CREATE TABLE IF NOT EXISTS collector_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collector TEXT NOT NULL,
      status TEXT NOT NULL,
      items_collected INTEGER DEFAULT 0,
      error TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    -- Social media tracking
    CREATE TABLE IF NOT EXISTS social_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER,
      platform TEXT NOT NULL, -- twitter, reddit
      handle TEXT NOT NULL,
      url TEXT,
      account_type TEXT DEFAULT 'subnet', -- subnet, influencer, community
      follower_count INTEGER,
      last_checked_at TEXT,
      UNIQUE(platform, handle)
    );

    CREATE TABLE IF NOT EXISTS social_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER,
      platform TEXT NOT NULL,
      post_id TEXT UNIQUE,
      author TEXT NOT NULL,
      author_type TEXT DEFAULT 'unknown', -- subnet, influencer, community, user
      content TEXT,
      url TEXT,
      likes INTEGER DEFAULT 0,
      retweets INTEGER DEFAULT 0,
      replies INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      posted_at TEXT,
      detected_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS social_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      mentions_24h INTEGER DEFAULT 0,
      mentions_7d INTEGER DEFAULT 0,
      total_engagement_24h INTEGER DEFAULT 0,
      sentiment_score REAL, -- -1 to 1
      top_post_url TEXT,
      UNIQUE(netuid, timestamp)
    );

    -- Staking & validator data per subnet
    CREATE TABLE IF NOT EXISTS subnet_staking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      total_alpha_staked REAL,        -- total alpha held by validators (in TAO equivalent)
      validator_count INTEGER,         -- number of active validators
      top_validator_share REAL,        -- % of stake held by top validator (concentration)
      registration_cost REAL,          -- cost to register a miner (in TAO)
      miner_count INTEGER,             -- total active miners
      registrations_24h INTEGER,       -- new miners registered in 24h
      deregistrations_24h INTEGER,     -- miners deregistered in 24h
      avg_incentive REAL,              -- average miner incentive score
      avg_trust REAL,                  -- average trust score
      coldkey_concentration REAL,      -- HHI of coldkey distribution (0-1, higher = more concentrated)
      UNIQUE(netuid, timestamp)
    );

    -- Revenue & sustainability data per subnet
    CREATE TABLE IF NOT EXISTS subnet_revenue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      netuid INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      emission_tao REAL,               -- TAO emitted to this subnet per day
      emission_share REAL,             -- % of total network emission
      burned_alpha REAL,               -- alpha burned (deflationary)
      tao_inflow REAL,                 -- TAO flowing in (buy volume)
      tao_outflow REAL,                -- TAO flowing out (sell volume)
      net_revenue REAL,                -- inflow - outflow (profitability proxy)
      coverage_ratio REAL,             -- inflow / outflow (>1 = sustainable)
      liquidity_depth REAL,            -- total liquidity in pool
      emission_trend_7d REAL,          -- % change in emission over 7d
      UNIQUE(netuid, timestamp)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_metrics_netuid_ts ON subnet_metrics(netuid, timestamp);
    CREATE INDEX IF NOT EXISTS idx_signals_netuid ON signals(netuid, created_at);
    CREATE INDEX IF NOT EXISTS idx_signals_strength ON signals(strength DESC);
    CREATE INDEX IF NOT EXISTS idx_github_events_repo ON github_events(repo, created_at);
    CREATE INDEX IF NOT EXISTS idx_hf_items_org ON huggingface_items(org, detected_at);
    CREATE INDEX IF NOT EXISTS idx_social_posts_netuid ON social_posts(netuid, posted_at);
    CREATE INDEX IF NOT EXISTS idx_social_accounts_netuid ON social_accounts(netuid, platform);
  `);
  initReferralSchema(db);
}

function initReferralSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);

    CREATE TABLE IF NOT EXISTS referral_attributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_code TEXT NOT NULL,
      referrer_user_id TEXT NOT NULL,
      referrer_email TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      referred_email TEXT NOT NULL,
      stripe_customer_id TEXT,
      signed_up_at TEXT DEFAULT (datetime('now')),
      first_payment_at TEXT,
      commission_expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_attributions_referrer ON referral_attributions(referrer_user_id);
    CREATE INDEX IF NOT EXISTS idx_attributions_referred ON referral_attributions(referred_user_id);

    CREATE TABLE IF NOT EXISTS affiliate_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      user_email TEXT NOT NULL,
      stripe_connect_account_id TEXT UNIQUE,
      onboarded_at TEXT,
      payouts_enabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS commission_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attribution_id INTEGER NOT NULL,
      stripe_invoice_id TEXT NOT NULL UNIQUE,
      stripe_charge_id TEXT,
      gross_amount INTEGER NOT NULL,
      commission_amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'usd',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      paid_at TEXT,
      stripe_transfer_id TEXT,
      FOREIGN KEY (attribution_id) REFERENCES referral_attributions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_attribution ON commission_ledger(attribution_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_status ON commission_ledger(status);
  `);
}

function runMigrations(db: Database.Database) {
  // Safely add columns that may not exist yet (idempotent)
  const migrations = [
    "ALTER TABLE signals ADD COLUMN analysis TEXT",
    "ALTER TABLE signals ADD COLUMN analysis_status TEXT DEFAULT 'pending'",
    "ALTER TABLE subnet_metrics ADD COLUMN price_change_24h REAL",
  ];

  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists — ignore
    }
  }
}
