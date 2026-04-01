require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require("discord.js");
const https = require("https");
const http = require("http");
const crypto = require("crypto");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CHECK_INTERVAL_MS = 1000;
// ─────────────────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const watchList = new Map();
let monitorInterval = null;

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "Mozilla/5.0 (DiscordBot)" }, timeout: 8000 }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
  });
}

function hashContent(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}

async function runChecks() {
  if (watchList.size === 0) return;
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) return;

  for (const [url, state] of watchList.entries()) {
    try {
      const content = await fetchPage(url);
      const newHash = hashContent(content);
      state.lastChecked = new Date();
      state.failCount = 0;

      if (state.hash === null) {
        state.hash = newHash;
        state.size = content.length;
        console.log(`[BASELINE] ${url} — ${content.length} chars`);
      } else if (newHash !== state.hash) {
        console.log(`[CHANGE] ${url}`);
        const oldSize = state.size ?? 0;
        const sizeDiff = content.length - oldSize;
        state.hash = newHash;
        state.size = content.length;

        const embed = new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("🔔 Website Changed!")
          .setURL(url)
          .setDescription(`A change was detected on the monitored page.`)
          .addFields(
            { name: "🌐 URL", value: `\`${url}\``, inline: false },
            { name: "📏 Size Change", value: `${oldSize.toLocaleString()} → ${content.length.toLocaleString()} chars (${sizeDiff >= 0 ? "+" : ""}${sizeDiff})`, inline: true },
            { name: "🕐 Detected At", value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
          )
          .setFooter({ text: "WebWatch Bot" })
          .setTimestamp();

        await channel.send({ content: "@everyone", embeds: [embed] });
      }
    } catch (err) {
      state.failCount = (state.failCount || 0) + 1;
      if (state.failCount === 1 || state.failCount % 30 === 0) {
        console.error(`[ERROR] ${url}: ${err.message}`);
        const embed = new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle("⚠️ Monitor Error")
          .addFields(
            { name: "URL", value: `\`${url}\`` },
            { name: "Error", value: err.message },
            { name: "Fail Count", value: String(state.failCount) }
          )
          .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  }
}

function startMonitor() {
  if (monitorInterval) return;
  monitorInterval = setInterval(runChecks, CHECK_INTERVAL_MS);
  console.log("Monitor started.");
}

function stopMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("Monitor stopped.");
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const [cmd, ...args] = message.content.trim().split(/\s+/);

  if (cmd === "!watch") {
    const url = args[0];
    if (!url || !url.startsWith("http")) {
      return message.reply("❌ Please provide a valid URL. Example: `!watch https://example.com`");
    }
    if (watchList.has(url)) {
      return message.reply(`⚠️ Already watching \`${url}\``);
    }
    watchList.set(url, { hash: null, lastChecked: null, failCount: 0 });
    if (!monitorInterval) startMonitor();

    const embed = new EmbedBuilder()
      .setColor(0x00cc66)
      .setTitle("✅ Now Watching")
      .setDescription(`\`${url}\``)
      .addFields(
        { name: "Check Interval", value: `Every ${CHECK_INTERVAL_MS / 1000}s`, inline: true },
        { name: "Total Watched", value: String(watchList.size), inline: true }
      )
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }

  else if (cmd === "!unwatch") {
    const url = args[0];
    if (!url || !watchList.has(url)) {
      return message.reply("❌ That URL is not being watched.");
    }
    watchList.delete(url);
    if (watchList.size === 0) stopMonitor();
    message.reply(`🛑 Stopped watching \`${url}\``);
  }

  else if (cmd === "!watchlist") {
    if (watchList.size === 0) {
      return message.reply("📭 No URLs are currently being watched. Use `!watch <url>` to start.");
    }
    const lines = [];
    for (const [url, state] of watchList.entries()) {
      const lastChecked = state.lastChecked ? `<t:${Math.floor(state.lastChecked.getTime() / 1000)}:R>` : "Not yet";
      const status = state.failCount > 0 ? `⚠️ ${state.failCount} errors` : "✅ OK";
      lines.push(`**${url}**\nLast checked: ${lastChecked} | Status: ${status}`);
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 Watch List (${watchList.size})`)
      .setDescription(lines.join("\n\n"))
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }

  else if (cmd === "!clearwatch") {
    watchList.clear();
    stopMonitor();
    message.reply("🧹 Cleared all watched URLs.");
  }

  else if (cmd === "!purge") {
    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) {
      return message.reply("❌ Please provide a number between 1 and 100. Example: `!purge 10`");
    }
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("❌ You don't have permission to delete messages.");
    }
    try {
      await message.channel.bulkDelete(amount + 1, true);
      const confirm = await message.channel.send(`🗑️ Deleted **${amount}** messages.`);
      setTimeout(() => confirm.delete().catch(() => {}), 3000);
    } catch (err) {
      message.reply("❌ Could not delete messages. They may be older than 14 days.");
    }
  }

  else if (cmd === "!ping") {
    message.reply(`🏓 Pong! Latency: **${client.ws.ping}ms**`);
  }

  else if (cmd === "!help" || cmd === "!cmds") {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🤖 WebWatch Bot — Commands")
      .addFields(
        { name: "`!watch <url>`", value: "Start monitoring a URL for changes" },
        { name: "`!unwatch <url>`", value: "Stop monitoring a URL" },
        { name: "`!watchlist`", value: "List all currently monitored URLs" },
        { name: "`!clearwatch`", value: "Stop monitoring all URLs" },
        { name: "`!purge <1-100>`", value: "Delete a number of messages in this channel" },
        { name: "`!ping`", value: "Check bot latency" },
        { name: "`!help` / `!cmds`", value: "Show this command list" },
      )
      .setFooter({ text: `Checks every ${CHECK_INTERVAL_MS / 1000}s` });
    message.reply({ embeds: [embed] });
  }
});

client.on("error", (err) => console.error("Client error:", err));

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("for changes 🔍", { type: 3 });
});

client.login(BOT_TOKEN);
