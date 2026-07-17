require("dotenv").config();
const {
  Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField,
  REST, Routes, SlashCommandBuilder
} = require("discord.js");
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, getVoiceConnection, entersState, VoiceConnectionStatus
} = require("@discordjs/voice");
const googleTTS = require("google-tts-api");
const fs = require("fs");
const path = require("path");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || null;

// Economy settings
const COINS_PER_MESSAGE = 5;
const EARN_COOLDOWN_MS = 10000;
const DAILY_REWARD = 100;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// GYG Menu
const SHOP = {
  burrito:      { name: "Burrito 🌯",       price: 150 },
  bowl:         { name: "Burrito Bowl 🥗",   price: 140 },
  nachos:       { name: "Nachos 🧀",         price: 120 },
  nachofries:   { name: "Nacho Fries 🍟",    price: 90  },
};

// TTS language (Google TTS codes: en, en-au, en-gb, es, fr, etc.)
const TTS_LANG = "en-au";
// ─────────────────────────────────────────────────────────────────────────────

// ─── ECONOMY STORAGE ─────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, "economy.json");
function loadEconomy() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}
function saveEconomy(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
  catch (e) { console.error("Failed to save economy:", e.message); }
}
let economy = loadEconomy();
function getUser(userId) {
  if (!economy[userId]) economy[userId] = { coins: 0, lastEarn: 0, lastDaily: 0, inventory: {} };
  const u = economy[userId];
  if (u.coins === undefined) u.coins = 0;
  if (u.lastEarn === undefined) u.lastEarn = 0;
  if (u.lastDaily === undefined) u.lastDaily = 0;
  if (!u.inventory) u.inventory = {};
  return u;
}

// ─── VOICE / TTS ─────────────────────────────────────────────────────────────
// One audio player per guild
const players = new Map();

function getPlayer(guildId) {
  if (!players.has(guildId)) {
    players.set(guildId, createAudioPlayer());
  }
  return players.get(guildId);
}

// Speak text in a given voice connection
async function speak(connection, guildId, text) {
  // Google TTS caps each URL at 200 chars — split long text
  const urls = googleTTS.getAllAudioUrls(text, {
    lang: TTS_LANG,
    slow: false,
    host: "https://translate.google.com",
  });

  const player = getPlayer(guildId);
  connection.subscribe(player);

  // Play each chunk in sequence
  for (const { url } of urls) {
    const resource = createAudioResource(url);
    player.play(resource);
    // Wait until this chunk finishes before playing the next
    await new Promise((resolve) => {
      const onIdle = () => { player.off(AudioPlayerStatus.Idle, onIdle); resolve(); };
      player.on(AudioPlayerStatus.Idle, onIdle);
    });
  }
}

// ─── SLASH COMMANDS ──────────────────────────────────────────────────────────
const commands = [
  // Moderation
  new SlashCommandBuilder().setName("kick").setDescription("Kick a member")
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder().setName("ban").setDescription("Ban a member")
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder().setName("unban").setDescription("Unban a user by ID")
    .addStringOption(o => o.setName("userid").setDescription("User ID").setRequired(true)),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a member")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("duration").setDescription("e.g. 10s, 5m, 2h, 1d").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder().setName("untimeout").setDescription("Remove a timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("purge").setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("1-100").setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a member")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),

  // GYG Economy
  new SlashCommandBuilder().setName("balance").setDescription("Check your GYG coin balance")
    .addUserOption(o => o.setName("user").setDescription("Check someone else's balance")),
  new SlashCommandBuilder().setName("daily").setDescription("Claim your daily GYG coins"),
  new SlashCommandBuilder().setName("shop").setDescription("View the GYG menu"),
  new SlashCommandBuilder().setName("buy").setDescription("Buy a GYG meal with coins")
    .addStringOption(o => o.setName("item").setDescription("What to buy").setRequired(true)
      .addChoices(
        { name: "Burrito", value: "burrito" },
        { name: "Burrito Bowl", value: "bowl" },
        { name: "Nachos", value: "nachos" },
        { name: "Nacho Fries", value: "nachofries" },
      )),
  new SlashCommandBuilder().setName("inventory").setDescription("View meals you've bought")
    .addUserOption(o => o.setName("user").setDescription("View someone else's inventory")),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Top GYG coin earners"),
  new SlashCommandBuilder().setName("give").setDescription("Give coins to another member")
    .addUserOption(o => o.setName("user").setDescription("Who to give to").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("How many coins").setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName("addcoins").setDescription("(Admin) Add coins to a member")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

  // Voice / TTS
  new SlashCommandBuilder().setName("join").setDescription("Make Dimo join your voice channel"),
  new SlashCommandBuilder().setName("say").setDescription("Make Dimo speak in the voice channel")
    .addStringOption(o => o.setName("text").setDescription("What Dimo should say").setRequired(true)),
  new SlashCommandBuilder().setName("leave").setDescription("Make Dimo leave the voice channel"),
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Slash commands registered!");
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function parseDuration(str) {
  const m = str.match(/^(\d+)(s|m|h|d)$/);
  if (!m) return null;
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(m[1]) * mult[m[2]];
}
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const mn = Math.floor(s / 60);
  if (mn < 60) return `${mn}m`;
  const h = Math.floor(mn / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function modEmbed(title, desc, color = 0x5865f2) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setTimestamp();
}
async function logAction(guild, embed) {
  if (!LOG_CHANNEL_ID) return;
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

// ─── CLIENT ──────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("you earn GYG coins 🌯", { type: 3 });
  await registerCommands();
});

// ─── EARN COINS ON MESSAGE ───────────────────────────────────────────────────
client.on("messageCreate", (message) => {
  if (message.author.bot || !message.guild) return;
  const user = getUser(message.author.id);
  const now = Date.now();
  if (now - user.lastEarn >= EARN_COOLDOWN_MS) {
    user.coins += COINS_PER_MESSAGE;
    user.lastEarn = now;
    saveEconomy(economy);
  }
});

// ─── SLASH COMMAND HANDLER ───────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, member, guild } = interaction;

  // Voice commands manage their own replies (deferred below individually)
  const voiceCommands = ["join", "say", "leave"];
  if (!voiceCommands.includes(commandName)) {
    await interaction.deferReply().catch(() => {});
  }

  // ══ MODERATION ═════════════════════════════════════════════════════════════
  if (commandName === "kick") {
    if (!member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return interaction.editReply("❌ You need the **Kick Members** permission.");
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason provided";
    if (!target) return interaction.editReply("❌ User not found.");
    if (!target.kickable) return interaction.editReply("❌ I cannot kick that user.");
    await target.kick(reason);
    const embed = modEmbed("👢 Member Kicked", `**${target.user.tag}** kicked.\n**Reason:** ${reason}`, 0xff6600);
    embed.addFields({ name: "Moderator", value: member.user.tag });
    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  else if (commandName === "ban") {
    if (!member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.editReply("❌ You need the **Ban Members** permission.");
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason provided";
    if (!target) return interaction.editReply("❌ User not found.");
    if (!target.bannable) return interaction.editReply("❌ I cannot ban that user.");
    await target.ban({ reason });
    const embed = modEmbed("🔨 Member Banned", `**${target.user.tag}** banned.\n**Reason:** ${reason}`, 0xff0000);
    embed.addFields({ name: "Moderator", value: member.user.tag });
    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  else if (commandName === "unban") {
    if (!member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.editReply("❌ You need the **Ban Members** permission.");
    const userId = interaction.options.getString("userid");
    try {
      await guild.members.unban(userId);
      interaction.editReply(`✅ Unbanned \`${userId}\`.`);
    } catch { interaction.editReply("❌ Could not unban. Check the ID."); }
  }

  else if (commandName === "timeout") {
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return interaction.editReply("❌ You need the **Timeout Members** permission.");
    const target = interaction.options.getMember("user");
    const durationMs = parseDuration(interaction.options.getString("duration"));
    const reason = interaction.options.getString("reason") || "No reason provided";
    if (!target) return interaction.editReply("❌ User not found.");
    if (!durationMs) return interaction.editReply("❌ Invalid duration. Use: 10s, 5m, 2h, 1d");
    if (durationMs > 28 * 86400000) return interaction.editReply("❌ Max timeout is 28 days.");
    await target.timeout(durationMs, reason);
    const embed = modEmbed("⏱️ Member Timed Out", `**${target.user.tag}** timed out for **${formatDuration(durationMs)}**.\n**Reason:** ${reason}`, 0xffaa00);
    embed.addFields({ name: "Moderator", value: member.user.tag });
    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  else if (commandName === "untimeout") {
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return interaction.editReply("❌ You need the **Timeout Members** permission.");
    const target = interaction.options.getMember("user");
    if (!target) return interaction.editReply("❌ User not found.");
    await target.timeout(null);
    interaction.editReply(`✅ Removed timeout from **${target.user.tag}**.`);
  }

  else if (commandName === "purge") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return interaction.editReply("❌ You need the **Manage Messages** permission.");
    const amount = interaction.options.getInteger("amount");
    try {
      await interaction.channel.bulkDelete(amount, true);
      const c = await interaction.editReply(`🗑️ Deleted **${amount}** messages.`);
      setTimeout(() => c.delete().catch(() => {}), 3000);
    } catch { interaction.editReply("❌ Could not delete. Messages may be older than 14 days."); }
  }

  else if (commandName === "warn") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return interaction.editReply("❌ You need the **Manage Messages** permission.");
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason");
    if (!target) return interaction.editReply("❌ User not found.");
    try {
      await target.send({ embeds: [modEmbed("⚠️ You have been warned", `You were warned in **${guild.name}**.\n**Reason:** ${reason}`, 0xffcc00)] });
    } catch {}
    const embed = modEmbed("⚠️ Member Warned", `**${target.user.tag}** warned.\n**Reason:** ${reason}`, 0xffcc00);
    embed.addFields({ name: "Moderator", value: member.user.tag });
    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  else if (commandName === "ping") {
    interaction.editReply(`🏓 Pong! Latency: **${client.ws.ping}ms**`);
  }

  // ══ GYG ECONOMY ════════════════════════════════════════════════════════════
  else if (commandName === "balance") {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const u = getUser(targetUser.id);
    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle(`🪙 ${targetUser.username}'s Wallet`)
      .setDescription(`**${u.coins.toLocaleString()}** GYG coins`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: "Earn coins by chatting! Spend them with /shop" })
      .setTimestamp();
    interaction.editReply({ embeds: [embed] });
  }

  else if (commandName === "daily") {
    const u = getUser(interaction.user.id);
    const now = Date.now();
    const remaining = DAILY_COOLDOWN_MS - (now - u.lastDaily);
    if (remaining > 0) return interaction.editReply(`⏳ You already claimed your daily! Come back in **${formatDuration(remaining)}**.`);
    u.coins += DAILY_REWARD;
    u.lastDaily = now;
    saveEconomy(economy);
    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("🎁 Daily Reward Claimed!")
      .setDescription(`You received **${DAILY_REWARD}** GYG coins!\nNew balance: **${u.coins.toLocaleString()}** 🪙`)
      .setTimestamp();
    interaction.editReply({ embeds: [embed] });
  }

  else if (commandName === "shop") {
    const lines = Object.values(SHOP).map(item => `**${item.name}** — ${item.price} 🪙`).join("\n");
    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle("🌯 Guzman y Gomez Menu")
      .setDescription(lines + "\n\nUse `/buy` to purchase a meal!")
      .setFooter({ text: "Earn coins by sending messages" })
      .setTimestamp();
    interaction.editReply({ embeds: [embed] });
  }

  else if (commandName === "buy") {
    const itemKey = interaction.options.getString("item");
    const item = SHOP[itemKey];
    if (!item) return interaction.editReply("❌ That item doesn't exist.");
    const u = getUser(interaction.user.id);
    if (u.coins < item.price) return interaction.editReply(`❌ You need **${item.price}** 🪙 but only have **${u.coins}** 🪙.\nKeep chatting to earn more!`);
    u.coins -= item.price;
    u.inventory[itemKey] = (u.inventory[itemKey] || 0) + 1;
    saveEconomy(economy);
    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("✅ Purchase Complete!")
      .setDescription(`You bought a **${item.name}** for **${item.price}** 🪙\nRemaining balance: **${u.coins.toLocaleString()}** 🪙`)
      .setFooter({ text: "Check your meals with /inventory" })
      .setTimestamp();
    interaction.editReply({ embeds: [embed] });
  }

  else if (commandName === "inventory") {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const u = getUser(targetUser.id);
    const items = Object.entries(u.inventory).filter(([, qty]) => qty > 0);
    if (items.length === 0) return interaction.editReply(`🍽️ ${targetUser.username} hasn't bought any meals yet.`);
    const lines = items.map(([key, qty]) => `${SHOP[key]?.name || key} × **${qty}**`).join("\n");
    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle(`🍽️ ${targetUser.username}'s Meals`)
      .setDescription(lines)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();
    interaction.editReply({ embeds: [embed] });
  }

  else if (commandName === "leaderboard") {
    const sorted = Object.entries(economy).sort((a, b) => (b[1].coins || 0) - (a[1].coins || 0)).slice(0, 10);
    if (sorted.length === 0) return interaction.editReply("No one has earned coins yet!");
    const medals = ["🥇", "🥈", "🥉"];
    let desc = "";
    for (let i = 0; i < sorted.length; i++) {
      const [userId, data] = sorted[i];
      const rank = medals[i] || `**${i + 1}.**`;
      let name = userId;
      try { name = (await client.users.fetch(userId)).username; } catch {}
      desc += `${rank} ${name} — **${(data.coins || 0).toLocaleString()}** 🪙\n`;
    }
    const embed = new EmbedBuilder()
      .setColor(0xf5a623).setTitle("🏆 GYG Coin Leaderboard").setDescription(desc).setTimestamp();
    interaction.editReply({ embeds: [embed] });
  }

  else if (commandName === "give") {
    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    if (targetUser.id === interaction.user.id) return interaction.editReply("❌ You can't give coins to yourself.");
    if (targetUser.bot) return interaction.editReply("❌ You can't give coins to a bot.");
    const sender = getUser(interaction.user.id);
    if (sender.coins < amount) return interaction.editReply(`❌ You only have **${sender.coins}** 🪙.`);
    const receiver = getUser(targetUser.id);
    sender.coins -= amount;
    receiver.coins += amount;
    saveEconomy(economy);
    interaction.editReply(`✅ You gave **${amount}** 🪙 to **${targetUser.username}**!`);
  }

  else if (commandName === "addcoins") {
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.editReply("❌ You need the **Administrator** permission.");
    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    const u = getUser(targetUser.id);
    u.coins += amount;
    if (u.coins < 0) u.coins = 0;
    saveEconomy(economy);
    interaction.editReply(`✅ ${targetUser.username} now has **${u.coins.toLocaleString()}** 🪙.`);
  }

  // ══ VOICE / TTS ════════════════════════════════════════════════════════════
  else if (commandName === "join") {
    await interaction.deferReply();
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) return interaction.editReply("❌ You need to be in a voice channel first.");

    try {
      joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      });
      interaction.editReply(`✅ Joined **${voiceChannel.name}**! Use \`/say\` to make me speak.`);
    } catch (err) {
      console.error("Join error:", err);
      interaction.editReply("❌ Could not join the voice channel.");
    }
  }

  else if (commandName === "say") {
    await interaction.deferReply();
    const text = interaction.options.getString("text");
    const voiceChannel = member.voice.channel;

    let connection = getVoiceConnection(guild.id);

    // If not already connected, join the user's channel
    if (!connection) {
      if (!voiceChannel) return interaction.editReply("❌ I'm not in a voice channel. Join one and use `/join`, or run this while in a voice channel.");
      try {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
        });
      } catch {
        return interaction.editReply("❌ Could not join the voice channel.");
      }
    }

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 10000);
      interaction.editReply(`🗣️ Speaking: "${text}"`);
      await speak(connection, guild.id, text);
    } catch (err) {
      console.error("Speak error:", err);
      interaction.editReply("❌ Something went wrong trying to speak.");
    }
  }

  else if (commandName === "leave") {
    await interaction.deferReply();
    const connection = getVoiceConnection(guild.id);
    if (!connection) return interaction.editReply("❌ I'm not in a voice channel.");
    connection.destroy();
    players.delete(guild.id);
    interaction.editReply("👋 Left the voice channel.");
  }
});

client.on("error", (err) => console.error("Client error:", err));
client.login(BOT_TOKEN);
