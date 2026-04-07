require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, AuditLogEvent } = require("discord.js");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || null; // Optional: set in .env for mod logs
// ─────────────────────────────────────────────────────────────────────────────

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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function isMod(member) {
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages) || isAdmin(member);
}

function hasPermission(member, flag) {
  return member.permissions.has(flag) || isAdmin(member);
}

async function logAction(guild, embed) {
  if (!LOG_CHANNEL_ID) return;
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => {});
}

function modEmbed(title, description, color = 0x5865f2) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
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

// ─── COMMANDS ─────────────────────────────────────────────────────────────────

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  const args = message.content.trim().split(/\s+/);
  const cmd = args[0].toLowerCase();

  // ── !kick <@user> [reason] ────────────────────────────────────────────────
  if (cmd === "!kick") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.KickMembers))
      return message.reply("❌ You need the **Kick Members** permission.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usage: `!kick @user [reason]`");
    if (!target.kickable) return message.reply("❌ I cannot kick that user.");

    const reason = args.slice(2).join(" ") || "No reason provided";
    await target.kick(reason);

    const embed = modEmbed("👢 Member Kicked", `**${target.user.tag}** has been kicked.\n**Reason:** ${reason}`, 0xff6600);
    embed.addFields({ name: "Moderator", value: message.author.tag });
    message.reply({ embeds: [embed] });
    await logAction(message.guild, embed);
  }

  // ── !ban <@user> [reason] ─────────────────────────────────────────────────
  else if (cmd === "!ban") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.BanMembers))
      return message.reply("❌ You need the **Ban Members** permission.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usage: `!ban @user [reason]`");
    if (!target.bannable) return message.reply("❌ I cannot ban that user.");

    const reason = args.slice(2).join(" ") || "No reason provided";
    await target.ban({ reason });

    const embed = modEmbed("🔨 Member Banned", `**${target.user.tag}** has been banned.\n**Reason:** ${reason}`, 0xff0000);
    embed.addFields({ name: "Moderator", value: message.author.tag });
    message.reply({ embeds: [embed] });
    await logAction(message.guild, embed);
  }

  // ── !unban <userId> ───────────────────────────────────────────────────────
  else if (cmd === "!unban") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.BanMembers))
      return message.reply("❌ You need the **Ban Members** permission.");

    const userId = args[1];
    if (!userId) return message.reply("❌ Usage: `!unban <userId>`");

    try {
      await message.guild.members.unban(userId);
      const embed = modEmbed("✅ Member Unbanned", `User \`${userId}\` has been unbanned.`, 0x00cc66);
      embed.addFields({ name: "Moderator", value: message.author.tag });
      message.reply({ embeds: [embed] });
      await logAction(message.guild, embed);
    } catch {
      message.reply("❌ Could not unban that user. Make sure the ID is correct.");
    }
  }

  // ── !timeout <@user> <duration> [reason] ─────────────────────────────────
  // Duration format: 10s, 5m, 2h, 1d
  else if (cmd === "!timeout") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.ModerateMembers))
      return message.reply("❌ You need the **Timeout Members** permission.");

    const target = message.mentions.members.first();
    const durationStr = args[2];
    if (!target || !durationStr) return message.reply("❌ Usage: `!timeout @user <duration> [reason]`\nDuration examples: `10s`, `5m`, `2h`, `1d`");

    const durationMs = parseDuration(durationStr);
    if (!durationMs) return message.reply("❌ Invalid duration. Use format like `10s`, `5m`, `2h`, `1d`");
    if (durationMs > 28 * 24 * 60 * 60 * 1000) return message.reply("❌ Timeout cannot exceed 28 days.");

    const reason = args.slice(3).join(" ") || "No reason provided";
    await target.timeout(durationMs, reason);

    const embed = modEmbed("⏱️ Member Timed Out", `**${target.user.tag}** has been timed out for **${formatDuration(durationMs)}**.\n**Reason:** ${reason}`, 0xffaa00);
    embed.addFields({ name: "Moderator", value: message.author.tag });
    message.reply({ embeds: [embed] });
    await logAction(message.guild, embed);
  }

  // ── !untimeout <@user> ────────────────────────────────────────────────────
  else if (cmd === "!untimeout") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.ModerateMembers))
      return message.reply("❌ You need the **Timeout Members** permission.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usage: `!untimeout @user`");

    await target.timeout(null);
    const embed = modEmbed("✅ Timeout Removed", `**${target.user.tag}**'s timeout has been removed.`, 0x00cc66);
    embed.addFields({ name: "Moderator", value: message.author.tag });
    message.reply({ embeds: [embed] });
    await logAction(message.guild, embed);
  }

  // ── !mute <@user> [reason] ────────────────────────────────────────────────
  // Creates a "Muted" role if it doesn't exist and applies it
  else if (cmd === "!mute") {
    if (!isMod(message.member))
      return message.reply("❌ You need the **Manage Messages** permission.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usage: `!mute @user [reason]`");

    let muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) {
      muteRole = await message.guild.roles.create({
        name: "Muted",
        color: 0x808080,
        permissions: [],
      });
      message.guild.channels.cache.forEach(async (channel) => {
        await channel.permissionOverwrites.create(muteRole, {
          SendMessages: false,
          AddReactions: false,
          Speak: false,
        }).catch(() => {});
      });
    }

    if (target.roles.cache.has(muteRole.id)) return message.reply("⚠️ That user is already muted.");
    const reason = args.slice(2).join(" ") || "No reason provided";
    await target.roles.add(muteRole, reason);

    const embed = modEmbed("🔇 Member Muted", `**${target.user.tag}** has been muted.\n**Reason:** ${reason}`, 0x808080);
    embed.addFields({ name: "Moderator", value: message.author.tag });
    message.reply({ embeds: [embed] });
    await logAction(message.guild, embed);
  }

  // ── !unmute <@user> ───────────────────────────────────────────────────────
  else if (cmd === "!unmute") {
    if (!isMod(message.member))
      return message.reply("❌ You need the **Manage Messages** permission.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usage: `!unmute @user`");

    const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole || !target.roles.cache.has(muteRole.id))
      return message.reply("⚠️ That user is not muted.");

    await target.roles.remove(muteRole);
    const embed = modEmbed("🔊 Member Unmuted", `**${target.user.tag}** has been unmuted.`, 0x00cc66);
    embed.addFields({ name: "Moderator", value: message.author.tag });
    message.reply({ embeds: [embed] });
    await logAction(message.guild, embed);
  }

  // ── !warn <@user> <reason> ────────────────────────────────────────────────
  else if (cmd === "!warn") {
    if (!isMod(message.member))
      return message.reply("❌ You need the **Manage Messages** permission.");

    const target = message.mentions.members.first();
    const reason = args.slice(2).join(" ");
    if (!target || !reason) return message.reply("❌ Usage: `!warn @user <reason>`");

    const embed = modEmbed("⚠️ Member Warned", `**${target.user.tag}** has been warned.\n**Reason:** ${reason}`, 0xffcc00);
    embed.addFields({ name: "Moderator", value: message.author.tag });

    try {
      await target.send({ embeds: [modEmbed("⚠️ You have been warned", `You were warned in **${message.guild.name}**.\n**Reason:** ${reason}`, 0xffcc00)] });
    } catch {}

    message.reply({ embeds: [embed] });
    await logAction(message.guild, embed);
  }

  // ── !purge <amount> ───────────────────────────────────────────────────────
  else if (cmd === "!purge") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.ManageMessages))
      return message.reply("❌ You need the **Manage Messages** permission.");

    const amount = parseInt(args[1]);
    if (!amount || amount < 1 || amount > 100)
      return message.reply("❌ Usage: `!purge <1-100>`");

    try {
      await message.channel.bulkDelete(amount + 1, true);
      const confirm = await message.channel.send(`🗑️ Deleted **${amount}** messages.`);
      setTimeout(() => confirm.delete().catch(() => {}), 3000);
    } catch {
      message.reply("❌ Could not delete messages. They may be older than 14 days.");
    }
  }

  // ── !slowmode <seconds> ───────────────────────────────────────────────────
  else if (cmd === "!slowmode") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.ManageChannels))
      return message.reply("❌ You need the **Manage Channels** permission.");

    const seconds = parseInt(args[1]);
    if (isNaN(seconds) || seconds < 0 || seconds > 21600)
      return message.reply("❌ Usage: `!slowmode <0-21600>` (seconds). Use 0 to disable.");

    await message.channel.setRateLimitPerUser(seconds);
    if (seconds === 0) {
      message.reply("✅ Slowmode disabled.");
    } else {
      message.reply(`✅ Slowmode set to **${seconds} seconds**.`);
    }
  }

  // ── !lock ─────────────────────────────────────────────────────────────────
  else if (cmd === "!lock") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.ManageChannels))
      return message.reply("❌ You need the **Manage Channels** permission.");

    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
    message.reply("🔒 Channel locked. Members can no longer send messages.");
  }

  // ── !unlock ───────────────────────────────────────────────────────────────
  else if (cmd === "!unlock") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.ManageChannels))
      return message.reply("❌ You need the **Manage Channels** permission.");

    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
    message.reply("🔓 Channel unlocked. Members can send messages again.");
  }

  // ── !nick <@user> <nickname> ──────────────────────────────────────────────
  else if (cmd === "!nick") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.ManageNicknames))
      return message.reply("❌ You need the **Manage Nicknames** permission.");

    const target = message.mentions.members.first();
    const nick = args.slice(2).join(" ");
    if (!target) return message.reply("❌ Usage: `!nick @user <nickname>` or `!nick @user reset`");

    if (nick === "reset") {
      await target.setNickname(null);
      message.reply(`✅ Reset **${target.user.tag}**'s nickname.`);
    } else if (!nick) {
      return message.reply("❌ Please provide a nickname or use `reset`.");
    } else {
      await target.setNickname(nick);
      message.reply(`✅ Set **${target.user.tag}**'s nickname to **${nick}**.`);
    }
  }

  // ── !role add/remove <@user> <@role> ─────────────────────────────────────
  else if (cmd === "!role") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.ManageRoles))
      return message.reply("❌ You need the **Manage Roles** permission.");

    const action = args[1];
    const target = message.mentions.members.first();
    const role = message.mentions.roles.first();

    if (!action || !target || !role)
      return message.reply("❌ Usage: `!role add @user @role` or `!role remove @user @role`");

    if (action === "add") {
      await target.roles.add(role);
      message.reply(`✅ Added **${role.name}** to **${target.user.tag}**.`);
    } else if (action === "remove") {
      await target.roles.remove(role);
      message.reply(`✅ Removed **${role.name}** from **${target.user.tag}**.`);
    } else {
      message.reply("❌ Use `add` or `remove`.");
    }
  }

  // ── !userinfo <@user> ─────────────────────────────────────────────────────
  else if (cmd === "!userinfo") {
    const target = message.mentions.members.first() || message.member;
    const user = target.user;
    const roles = target.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.toString()).join(", ") || "None";

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
    message.reply({ embeds: [embed] });
  }

  // ── !serverinfo ───────────────────────────────────────────────────────────
  else if (cmd === "!serverinfo") {
    const guild = message.guild;
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
        { name: "Verification Level", value: String(guild.verificationLevel), inline: true },
      )
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }

  // ── !avatar <@user> ───────────────────────────────────────────────────────
  else if (cmd === "!avatar") {
    const target = message.mentions.users.first() || message.author;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ Avatar — ${target.tag}`)
      .setImage(target.displayAvatarURL({ size: 512 }));
    message.reply({ embeds: [embed] });
  }

  // ── !announce <#channel> <message> ───────────────────────────────────────
  else if (cmd === "!announce") {
    if (!isAdmin(message.member))
      return message.reply("❌ You need the **Administrator** permission.");

    const channel = message.mentions.channels.first();
    const announcement = args.slice(2).join(" ");
    if (!channel || !announcement)
      return message.reply("❌ Usage: `!announce #channel <message>`");

    const embed = new EmbedBuilder()
      .setColor(0x00cc66)
      .setTitle("📢 Announcement")
      .setDescription(announcement)
      .setFooter({ text: `From ${message.author.tag}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    message.reply(`✅ Announcement sent to ${channel}.`);
  }

  // ── !dm <@user> <message> ─────────────────────────────────────────────────
  else if (cmd === "!dm") {
    if (!isAdmin(message.member))
      return message.reply("❌ You need the **Administrator** permission.");

    const target = message.mentions.users.first();
    const dmMessage = args.slice(2).join(" ");
    if (!target || !dmMessage)
      return message.reply("❌ Usage: `!dm @user <message>`");

    try {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📨 Message from ${message.guild.name}`)
        .setDescription(dmMessage)
        .setFooter({ text: `Sent by ${message.author.tag}` })
        .setTimestamp();

      await target.send({ embeds: [embed] });
      message.reply(`✅ DM sent to **${target.tag}**.`);
    } catch {
      message.reply("❌ Could not DM that user. They may have DMs disabled.");
    }
  }

  // ── !dmall <message> ──────────────────────────────────────────────────────
  else if (cmd === "!dmall") {
    if (!isAdmin(message.member))
      return message.reply("❌ You need the **Administrator** permission.");

    const dmMessage = args.slice(1).join(" ");
    if (!dmMessage) return message.reply("❌ Usage: `!dmall <message>`");

    const statusMsg = await message.reply("📨 Sending DMs to all members...");
    await message.guild.members.fetch();
    const members = message.guild.members.cache.filter(m => !m.user.bot);

    let sent = 0, failed = 0;
    for (const [, member] of members) {
      try {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`📢 Message from ${message.guild.name}`)
          .setDescription(dmMessage)
          .setFooter({ text: `Sent by ${message.author.tag}` })
          .setTimestamp();
        await member.send({ embeds: [embed] });
        sent++;
      } catch { failed++; }
    }
    await statusMsg.edit(`✅ Done! **${sent}** delivered, **${failed}** failed.`);
    message.delete().catch(() => {});
  }

  // ── !poll <question> | <option1> | <option2> ... ─────────────────────────
  else if (cmd === "!poll") {
    if (!isMod(message.member))
      return message.reply("❌ You need the **Manage Messages** permission.");

    const parts = message.content.slice(6).split("|").map(s => s.trim());
    const question = parts[0];
    const options = parts.slice(1);

    if (!question) return message.reply("❌ Usage: `!poll <question> | <option1> | <option2>`");

    const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];

    let description = "";
    if (options.length === 0) {
      description = "React with 👍 or 👎";
    } else {
      options.forEach((opt, i) => { description += `${emojis[i]} ${opt}\n`; });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 Poll: ${question}`)
      .setDescription(description)
      .setFooter({ text: `Poll by ${message.author.tag}` })
      .setTimestamp();

    const pollMsg = await message.channel.send({ embeds: [embed] });
    message.delete().catch(() => {});

    if (options.length === 0) {
      await pollMsg.react("👍");
      await pollMsg.react("👎");
    } else {
      for (let i = 0; i < Math.min(options.length, 10); i++) {
        await pollMsg.react(emojis[i]);
      }
    }
  }

  // ── !say <message> ────────────────────────────────────────────────────────
  else if (cmd === "!say") {
    if (!isMod(message.member))
      return message.reply("❌ You need the **Manage Messages** permission.");

    const text = args.slice(1).join(" ");
    if (!text) return message.reply("❌ Usage: `!say <message>`");
    message.delete().catch(() => {});
    message.channel.send(text);
  }

  // ── !embed <title> | <description> ───────────────────────────────────────
  else if (cmd === "!embed") {
    if (!isMod(message.member))
      return message.reply("❌ You need the **Manage Messages** permission.");

    const parts = message.content.slice(7).split("|").map(s => s.trim());
    if (parts.length < 2) return message.reply("❌ Usage: `!embed <title> | <description>`");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(parts[0])
      .setDescription(parts[1])
      .setTimestamp();
    message.delete().catch(() => {});
    message.channel.send({ embeds: [embed] });
  }

  // ── !banlist ──────────────────────────────────────────────────────────────
  else if (cmd === "!banlist") {
    if (!hasPermission(message.member, PermissionsBitField.Flags.BanMembers))
      return message.reply("❌ You need the **Ban Members** permission.");

    const bans = await message.guild.bans.fetch();
    if (bans.size === 0) return message.reply("✅ No banned users.");

    const list = bans.map(b => `**${b.user.tag}** (\`${b.user.id}\`) — ${b.reason || "No reason"}`).slice(0, 20).join("\n");
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`🔨 Ban List (${bans.size})`)
      .setDescription(list + (bans.size > 20 ? `\n...and ${bans.size - 20} more.` : ""))
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }

  // ── !roles ────────────────────────────────────────────────────────────────
  else if (cmd === "!roles") {
    const roles = message.guild.roles.cache
      .filter(r => r.id !== message.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `${r.toString()} — ${r.members.size} members`)
      .slice(0, 20)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 Server Roles (${message.guild.roles.cache.size - 1})`)
      .setDescription(roles || "No roles found.")
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }

  // ── !ping ─────────────────────────────────────────────────────────────────
  else if (cmd === "!ping") {
    message.reply(`🏓 Pong! Latency: **${client.ws.ping}ms**`);
  }

  // ── !help / !cmds ─────────────────────────────────────────────────────────
  else if (cmd === "!help" || cmd === "!cmds") {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🛡️ Moderation Bot — Commands")
      .addFields(
        { name: "🔨 Moderation", value: [
          "`!kick @user [reason]` — Kick a member",
          "`!ban @user [reason]` — Ban a member",
          "`!unban <userId>` — Unban a user",
          "`!timeout @user <duration> [reason]` — Timeout a member (e.g. `10m`, `2h`, `1d`)",
          "`!untimeout @user` — Remove timeout",
          "`!mute @user [reason]` — Mute a member",
          "`!unmute @user` — Unmute a member",
          "`!warn @user <reason>` — Warn a member",
          "`!banlist` — View all banned users",
        ].join("\n") },
        { name: "🔧 Channel Management", value: [
          "`!purge <1-100>` — Delete messages",
          "`!slowmode <seconds>` — Set slowmode (0 to disable)",
          "`!lock` — Lock the current channel",
          "`!unlock` — Unlock the current channel",
        ].join("\n") },
        { name: "👤 Member Management", value: [
          "`!nick @user <nickname|reset>` — Set or reset nickname",
          "`!role add/remove @user @role` — Add or remove a role",
          "`!userinfo [@user]` — View user info",
          "`!avatar [@user]` — View a user's avatar",
        ].join("\n") },
        { name: "📢 Communication", value: [
          "`!announce #channel <message>` — Send an announcement",
          "`!dm @user <message>` — DM a specific user",
          "`!dmall <message>` — DM all server members",
          "`!say <message>` — Make the bot say something",
          "`!embed <title> | <description>` — Send a custom embed",
          "`!poll <question> | <opt1> | <opt2>` — Create a poll",
        ].join("\n") },
        { name: "ℹ️ Info", value: [
          "`!serverinfo` — View server info",
          "`!roles` — List all server roles",
          "`!ping` — Check bot latency",
          "`!help` / `!cmds` — Show this list",
        ].join("\n") },
      )
      .setFooter({ text: "Set LOG_CHANNEL_ID in .env to enable mod logs" });
    message.reply({ embeds: [embed] });
  }
});

// ─── READY ────────────────────────────────────────────────────────────────────
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("the server 🛡️", { type: 3 });
});

client.on("error", (err) => console.error("Client error:", err));
client.login(BOT_TOKEN);
