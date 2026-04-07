require("dotenv").config();
const {
  Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField,
  REST, Routes, SlashCommandBuilder, InteractionType
} = require("discord.js");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;       // Your bot's Application ID
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || null;
// ─────────────────────────────────────────────────────────────────────────────

// ─── SLASH COMMAND DEFINITIONS ───────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption(o => o.setName("user").setDescription("The user to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for kick")),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .addUserOption(o => o.setName("user").setDescription("The user to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for ban")),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by their ID")
    .addStringOption(o => o.setName("userid").setDescription("The user's ID").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member")
    .addUserOption(o => o.setName("user").setDescription("The user to timeout").setRequired(true))
    .addStringOption(o => o.setName("duration").setDescription("Duration e.g. 10s, 5m, 2h, 1d").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for timeout")),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove a timeout from a member")
    .addUserOption(o => o.setName("user").setDescription("The user to untimeout").setRequired(true)),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute a member (adds Muted role)")
    .addUserOption(o => o.setName("user").setDescription("The user to mute").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for mute")),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Unmute a member")
    .addUserOption(o => o.setName("user").setDescription("The user to unmute").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption(o => o.setName("user").setDescription("The user to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for warning").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete a number of messages in this channel")
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages to delete (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode for this channel")
    .addIntegerOption(o => o.setName("seconds").setDescription("Slowmode in seconds (0 to disable)").setRequired(true).setMinValue(0).setMaxValue(21600)),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock the current channel"),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock the current channel"),

  new SlashCommandBuilder()
    .setName("nick")
    .setDescription("Set or reset a member's nickname")
    .addUserOption(o => o.setName("user").setDescription("The user").setRequired(true))
    .addStringOption(o => o.setName("nickname").setDescription("New nickname (leave blank to reset)")),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("Add or remove a role from a member")
    .addStringOption(o => o.setName("action").setDescription("add or remove").setRequired(true).addChoices({ name: "add", value: "add" }, { name: "remove", value: "remove" }))
    .addUserOption(o => o.setName("user").setDescription("The user").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("The role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View info about a user")
    .addUserOption(o => o.setName("user").setDescription("The user (defaults to you)")),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View info about this server"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("View a user's avatar")
    .addUserOption(o => o.setName("user").setDescription("The user (defaults to you)")),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement to a channel")
    .addChannelOption(o => o.setName("channel").setDescription("The channel to announce in").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("The announcement message").setRequired(true)),

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Send a DM to a specific user (Admin only)")
    .addUserOption(o => o.setName("user").setDescription("The user to DM").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("The message to send").setRequired(true)),

  new SlashCommandBuilder()
    .setName("dmall")
    .setDescription("DM all server members (Admin only)")
    .addStringOption(o => o.setName("message").setDescription("The message to send").setRequired(true)),

  new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll")
    .addStringOption(o => o.setName("question").setDescription("The poll question").setRequired(true))
    .addStringOption(o => o.setName("options").setDescription("Options separated by | e.g. Yes | No | Maybe")),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make the bot say something")
    .addStringOption(o => o.setName("message").setDescription("What to say").setRequired(true)),

  new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Send a custom embed")
    .addStringOption(o => o.setName("title").setDescription("Embed title").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Embed description").setRequired(true))
    .addStringOption(o => o.setName("color").setDescription("Hex color e.g. #ff0000")),

  new SlashCommandBuilder()
    .setName("banlist")
    .setDescription("View all banned users"),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("List all server roles"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),
].map(cmd => cmd.toJSON());

// ─── REGISTER COMMANDS ───────────────────────────────────────────────────────
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
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[match[2]];
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function modEmbed(title, description, color = 0x5865f2) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
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
    GatewayIntentBits.GuildPresences,
  ],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("the server 🛡️", { type: 3 });
  await registerCommands();
});

// ─── INTERACTION HANDLER ─────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, guild } = interaction;
  await interaction.deferReply({ ephemeral: false }).catch(() => {});

  // ── /kick ──────────────────────────────────────────────────────────────────
  if (commandName === "kick") {
    if (!member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return interaction.editReply("❌ You need the **Kick Members** permission.");

    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason provided";

    if (!target) return interaction.editReply("❌ User not found.");
    if (!target.kickable) return interaction.editReply("❌ I cannot kick that user.");

    await target.kick(reason);
    const embed = modEmbed("👢 Member Kicked", `**${target.user.tag}** has been kicked.\n**Reason:** ${reason}`, 0xff6600);
    embed.addFields({ name: "Moderator", value: member.user.tag });
    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  // ── /ban ───────────────────────────────────────────────────────────────────
  else if (commandName === "ban") {
    if (!member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.editReply("❌ You need the **Ban Members** permission.");

    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason provided";

    if (!target) return interaction.editReply("❌ User not found.");
    if (!target.bannable) return interaction.editReply("❌ I cannot ban that user.");

    await target.ban({ reason });
    const embed = modEmbed("🔨 Member Banned", `**${target.user.tag}** has been banned.\n**Reason:** ${reason}`, 0xff0000);
    embed.addFields({ name: "Moderator", value: member.user.tag });
    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  // ── /unban ─────────────────────────────────────────────────────────────────
  else if (commandName === "unban") {
    if (!member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.editReply("❌ You need the **Ban Members** permission.");

    const userId = interaction.options.getString("userid");
    try {
      await guild.members.unban(userId);
      const embed = modEmbed("✅ Member Unbanned", `User \`${userId}\` has been unbanned.`, 0x00cc66);
      embed.addFields({ name: "Moderator", value: member.user.tag });
      interaction.editReply({ embeds: [embed] });
      await logAction(guild, embed);
    } catch {
      interaction.editReply("❌ Could not unban. Make sure the ID is correct.");
    }
  }

  // ── /timeout ───────────────────────────────────────────────────────────────
  else if (commandName === "timeout") {
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return interaction.editReply("❌ You need the **Timeout Members** permission.");

    const target = interaction.options.getMember("user");
    const durationStr = interaction.options.getString("duration");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const durationMs = parseDuration(durationStr);

    if (!target) return interaction.editReply("❌ User not found.");
    if (!durationMs) return interaction.editReply("❌ Invalid duration. Use: `10s`, `5m`, `2h`, `1d`");
    if (durationMs > 28 * 24 * 60 * 60 * 1000) return interaction.editReply("❌ Max timeout is 28 days.");

    await target.timeout(durationMs, reason);
    const embed = modEmbed("⏱️ Member Timed Out", `**${target.user.tag}** timed out for **${formatDuration(durationMs)}**.\n**Reason:** ${reason}`, 0xffaa00);
    embed.addFields({ name: "Moderator", value: member.user.tag });
    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  // ── /untimeout ─────────────────────────────────────────────────────────────
  else if (commandName === "untimeout") {
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return interaction.editReply("❌ You need the **Timeout Members** permission.");

    const target = interaction.options.getMember("user");
    if (!target) return interaction.editReply("❌ User not found.");

    await target.timeout(null);
    const embed = modEmbed("✅ Timeout Removed", `**${target.user.tag}**'s timeout has been removed.`, 0x00cc66);
    embed.addFields({ name: "Moderator", value: member.user.tag });
    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  // ── /mute ──────────────────────────────────────────────────────────────────
  else if (commandName === "mute") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return interaction.editReply("❌ You need the **Manage Messages** permission.");

    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason provided";
    if (!target) return interaction.editReply("❌ User not found.");

    let muteRole = guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) {
      muteRole = await guild.roles.create({ name: "Muted", color: 0x808080, permissions: [] });
      guild.channels.cache.forEach(async (ch) => {
        await ch.permissionOverwrites.create(muteRole, { SendMessages: false, AddReactions: false, Speak: false }).catch(() => {});
      });
    }

    if (target.roles.cache.has(muteRole.id)) return interaction.editReply("⚠️ That user is already muted.");
    await target.roles.add(muteRole, reason);

    const embed = modEmbed("🔇 Member Muted", `**${target.user.tag}** has been muted.\n**Reason:** ${reason}`, 0x808080);
    embed.addFields({ name: "Moderator", value: member.user.tag });
    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  // ── /unmute ────────────────────────────────────────────────────────────────
  else if (commandName === "unmute") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return interaction.editReply("❌ You need the **Manage Messages** permission.");

    const target = interaction.options.getMember("user");
    if (!target) return interaction.editReply("❌ User not found.");

    const muteRole = guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole || !target.roles.cache.has(muteRole.id))
      return interaction.editReply("⚠️ That user is not muted.");

    await target.roles.remove(muteRole);
    const embed = modEmbed("🔊 Member Unmuted", `**${target.user.tag}** has been unmuted.`, 0x00cc66);
    embed.addFields({ name: "Moderator", value: member.user.tag });
    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  // ── /warn ──────────────────────────────────────────────────────────────────
  else if (commandName === "warn") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return interaction.editReply("❌ You need the **Manage Messages** permission.");

    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason");
    if (!target) return interaction.editReply("❌ User not found.");

    const embed = modEmbed("⚠️ Member Warned", `**${target.user.tag}** has been warned.\n**Reason:** ${reason}`, 0xffcc00);
    embed.addFields({ name: "Moderator", value: member.user.tag });

    try {
      await target.send({ embeds: [modEmbed("⚠️ You have been warned", `You were warned in **${guild.name}**.\n**Reason:** ${reason}`, 0xffcc00)] });
    } catch {}

    interaction.editReply({ embeds: [embed] });
    await logAction(guild, embed);
  }

  // ── /purge ─────────────────────────────────────────────────────────────────
  else if (commandName === "purge") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return interaction.editReply("❌ You need the **Manage Messages** permission.");

    const amount = interaction.options.getInteger("amount");
    try {
      await interaction.channel.bulkDelete(amount, true);
      const confirm = await interaction.editReply(`🗑️ Deleted **${amount}** messages.`);
      setTimeout(() => confirm.delete().catch(() => {}), 3000);
    } catch {
      interaction.editReply("❌ Could not delete messages. They may be older than 14 days.");
    }
  }

  // ── /slowmode ──────────────────────────────────────────────────────────────
  else if (commandName === "slowmode") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return interaction.editReply("❌ You need the **Manage Channels** permission.");

    const seconds = interaction.options.getInteger("seconds");
    await interaction.channel.setRateLimitPerUser(seconds);
    interaction.editReply(seconds === 0 ? "✅ Slowmode disabled." : `✅ Slowmode set to **${seconds} seconds**.`);
  }

  // ── /lock ──────────────────────────────────────────────────────────────────
  else if (commandName === "lock") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return interaction.editReply("❌ You need the **Manage Channels** permission.");

    await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
    interaction.editReply("🔒 Channel locked.");
  }

  // ── /unlock ────────────────────────────────────────────────────────────────
  else if (commandName === "unlock") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return interaction.editReply("❌ You need the **Manage Channels** permission.");

    await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
    interaction.editReply("🔓 Channel unlocked.");
  }

  // ── /nick ──────────────────────────────────────────────────────────────────
  else if (commandName === "nick") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageNicknames))
      return interaction.editReply("❌ You need the **Manage Nicknames** permission.");

    const target = interaction.options.getMember("user");
    const nick = interaction.options.getString("nickname");
    if (!target) return interaction.editReply("❌ User not found.");

    await target.setNickname(nick || null);
    interaction.editReply(nick ? `✅ Set nickname to **${nick}**.` : `✅ Reset **${target.user.tag}**'s nickname.`);
  }

  // ── /role ──────────────────────────────────────────────────────────────────
  else if (commandName === "role") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles))
      return interaction.editReply("❌ You need the **Manage Roles** permission.");

    const action = interaction.options.getString("action");
    const target = interaction.options.getMember("user");
    const role = interaction.options.getRole("role");

    if (!target) return interaction.editReply("❌ User not found.");

    if (action === "add") {
      await target.roles.add(role);
      interaction.editReply(`✅ Added **${role.name}** to **${target.user.tag}**.`);
    } else {
      await target.roles.remove(role);
      interaction.editReply(`✅ Removed **${role.name}** from **${target.user.tag}**.`);
    }
  }

  // ── /userinfo ──────────────────────────────────────────────────────────────
  else if (commandName === "userinfo") {
    const target = interaction.options.getMember("user") || member;
    const user = target.user;
    const roles = target.roles.cache.filter(r => r.id !== guild.id).map(r => r.toString()).join(", ") || "None";

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👤 User Info — ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "ID", value: user.id, inline: true },
        { name: "Nickname", value: target.nickname || "None", inline: true },
        { name: "Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Joined Server", value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: "Bot", value: user.bot ? "Yes" : "No", inline: true },
        { name: `Roles (${target.roles.cache.size - 1})`, value: roles.length > 1024 ? "Too many to display" : roles }
      )
      .setTimestamp();
    interaction.editReply({ embeds: [embed] });
  }

  // ── /serverinfo ────────────────────────────────────────────────────────────
  else if (commandName === "serverinfo") {
    await guild.members.fetch();
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = guild.members.cache.size - bots;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🏠 Server Info — ${guild.name}`)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
        { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Members", value: `${humans} humans, ${bots} bots`, inline: true },
        { name: "Channels", value: String(guild.channels.cache.size), inline: true },
        { name: "Roles", value: String(guild.roles.cache.size), inline: true },
        { name: "Boosts", value: String(guild.premiumSubscriptionCount || 0), inline: true },
      )
      .setTimestamp();
    interaction.editReply({ embeds: [embed] });
  }

  // ── /avatar ────────────────────────────────────────────────────────────────
  else if (commandName === "avatar") {
    const target = interaction.options.getUser("user") || interaction.user;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ Avatar — ${target.tag}`)
      .setImage(target.displayAvatarURL({ size: 512 }));
    interaction.editReply({ embeds: [embed] });
  }

  // ── /announce ──────────────────────────────────────────────────────────────
  else if (commandName === "announce") {
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.editReply("❌ You need the **Administrator** permission.");

    const channel = interaction.options.getChannel("channel");
    const msg = interaction.options.getString("message");

    const embed = new EmbedBuilder()
      .setColor(0x00cc66)
      .setTitle("📢 Announcement")
      .setDescription(msg)
      .setFooter({ text: `From ${member.user.tag}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    interaction.editReply(`✅ Announcement sent to ${channel}.`);
  }

  // ── /dm ────────────────────────────────────────────────────────────────────
  else if (commandName === "dm") {
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.editReply("❌ You need the **Administrator** permission.");

    const target = interaction.options.getUser("user");
    const msg = interaction.options.getString("message");

    try {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📨 Message from ${guild.name}`)
        .setDescription(msg)
        .setFooter({ text: `Sent by ${member.user.tag}` })
        .setTimestamp();
      await target.send({ embeds: [embed] });
      interaction.editReply(`✅ DM sent to **${target.tag}**.`);
    } catch {
      interaction.editReply("❌ Could not DM that user. They may have DMs disabled.");
    }
  }

  // ── /dmall ─────────────────────────────────────────────────────────────────
  else if (commandName === "dmall") {
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.editReply("❌ You need the **Administrator** permission.");

    const msg = interaction.options.getString("message");
    await interaction.editReply("📨 Sending DMs to all members...");
    await guild.members.fetch();
    const members = guild.members.cache.filter(m => !m.user.bot);

    let sent = 0, failed = 0;
    for (const [, m] of members) {
      try {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`📢 Message from ${guild.name}`)
          .setDescription(msg)
          .setFooter({ text: `Sent by ${member.user.tag}` })
          .setTimestamp();
        await m.send({ embeds: [embed] });
        sent++;
      } catch { failed++; }
    }
    interaction.editReply(`✅ Done! **${sent}** delivered, **${failed}** failed.`);
  }

  // ── /poll ──────────────────────────────────────────────────────────────────
  else if (commandName === "poll") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return interaction.editReply("❌ You need the **Manage Messages** permission.");

    const question = interaction.options.getString("question");
    const optionsStr = interaction.options.getString("options");
    const options = optionsStr ? optionsStr.split("|").map(s => s.trim()) : [];
    const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];

    let description = options.length === 0
      ? "React with 👍 or 👎"
      : options.map((opt, i) => `${emojis[i]} ${opt}`).join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 Poll: ${question}`)
      .setDescription(description)
      .setFooter({ text: `Poll by ${member.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    const pollMsg = await interaction.fetchReply();

    if (options.length === 0) {
      await pollMsg.react("👍");
      await pollMsg.react("👎");
    } else {
      for (let i = 0; i < Math.min(options.length, 10); i++) {
        await pollMsg.react(emojis[i]);
      }
    }
  }

  // ── /say ───────────────────────────────────────────────────────────────────
  else if (commandName === "say") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return interaction.editReply("❌ You need the **Manage Messages** permission.");

    const text = interaction.options.getString("message");
    await interaction.channel.send(text);
    await interaction.deleteReply().catch(() => {});
  }

  // ── /embed ─────────────────────────────────────────────────────────────────
  else if (commandName === "embed") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return interaction.editReply("❌ You need the **Manage Messages** permission.");

    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const colorStr = interaction.options.getString("color");
    const color = colorStr ? parseInt(colorStr.replace("#", ""), 16) : 0x5865f2;

    const embed = new EmbedBuilder()
      .setColor(isNaN(color) ? 0x5865f2 : color)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    await interaction.deleteReply().catch(() => {});
  }

  // ── /banlist ───────────────────────────────────────────────────────────────
  else if (commandName === "banlist") {
    if (!member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.editReply("❌ You need the **Ban Members** permission.");

    const bans = await guild.bans.fetch();
    if (bans.size === 0) return interaction.editReply("✅ No banned users.");

    const list = bans.map(b => `**${b.user.tag}** (\`${b.user.id}\`) — ${b.reason || "No reason"}`).slice(0, 20).join("\n");
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`🔨 Ban List (${bans.size})`)
      .setDescription(list + (bans.size > 20 ? `\n...and ${bans.size - 20} more.` : ""))
      .setTimestamp();
    interaction.editReply({ embeds: [embed] });
  }

  // ── /roles ─────────────────────────────────────────────────────────────────
  else if (commandName === "roles") {
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `${r.toString()} — ${r.members.size} members`)
      .slice(0, 20)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 Server Roles (${guild.roles.cache.size - 1})`)
      .setDescription(roles || "No roles found.")
      .setTimestamp();
    interaction.editReply({ embeds: [embed] });
  }

  // ── /ping ──────────────────────────────────────────────────────────────────
  else if (commandName === "ping") {
    interaction.editReply(`🏓 Pong! Latency: **${client.ws.ping}ms**`);
  }
});

client.on("error", (err) => console.error("Client error:", err));
client.login(BOT_TOKEN);
