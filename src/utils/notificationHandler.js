const pool = require('./db.js');
const { EmbedBuilder } = require('discord.js');

class NotificationHandler {
    constructor(client) {
        this.client = client;
        this.checkInterval = 10 * 1000; // 10 seconds
    }

    start() {
        console.log('✅ NotificationHandler started');
        this.interval = setInterval(() => this.checkNotifications(), this.checkInterval);
    }

    stop() {
        clearInterval(this.interval);
    }

    async checkNotifications() {
        try {
            const [notifications] = await pool.query(
                'SELECT * FROM pending_notifications WHERE processed = 0 ORDER BY created_at ASC LIMIT 10'
            );

            for (const notification of notifications) {
                await this.processNotification(notification);
            }
        } catch (error) {
            console.error('Error checking notifications:', error);
        }
    }

    async processNotification(notification) {
        try {
            const { id, discord_id, notification_type, notification_data, minecraft_uuid } = notification;
            let data = {};
            try {
                data = JSON.parse(notification_data);
            } catch (e) {
                console.error(`Invalid JSON in notification ${id}:`, notification_data);
                data = {};
            }

            // Ensure UUID is available in data if needed
            data.uuid = minecraft_uuid || data.uuid;

            switch (notification_type) {
                case 'LINK_SUCCESS':
                case 'new_link':
                    await this.handleLinkSuccess(discord_id, data);
                    break;
                case 'GAME_RESULT':
                case 'game_result':
                    await this.handleGameResult(discord_id, 'general', data);
                    break;
                case 'HIGHSCORE':
                case 'highscore':
                    await this.handleGameResult(discord_id, 'highscores', data);
                    break;
                case 'RANK_UP':
                case 'rank_up':
                    await this.handleRankUp(discord_id, data);
                    break;
                default:
                    console.log(`Unknown notification type: ${notification_type}`);
            }

            // Mark as processed
            await pool.query('UPDATE pending_notifications SET processed = 1, processed_at = NOW() WHERE id = ?', [id]);

        } catch (error) {
            console.error(`Error processing notification ${notification.id}:`, error);
        }
    }

    async handleLinkSuccess(discordId, data) {
        try {
            const nickname = data.minecraft_username;
            console.log(`[LINK] Processing nickname change for ${discordId} -> ${nickname}`);
            
            for (const [guildId, guild] of this.client.guilds.cache) {
                try {
                    const member = await guild.members.fetch(discordId).catch(() => null);
                    if (member) {
                        const botMember = guild.members.me;
                        
                        // Check if bot has permission AND if the user is manageable (bot role > user role)
                        if (!botMember.permissions.has('ManageNicknames')) {
                            console.warn(`[LINK] ⚠️ Missing 'Manage Nicknames' permission in guild: ${guild.name}`);
                            continue;
                        }

                        if (member.id === guild.ownerId) {
                            console.warn(`[LINK] ⚠️ Cannot change nickname of server owner in ${guild.name}`);
                            continue;
                        }

                        if (!member.manageable) {
                            console.warn(`[LINK] ⚠️ Cannot change nickname of ${member.user.tag} in ${guild.name} (User role is higher than Bot role)`);
                            continue;
                        }

                        await member.setNickname(nickname);
                        console.log(`[LINK] ✅ Changed nickname for ${member.user.tag} to "${nickname}" in ${guild.name}`);
                    }
                } catch (err) {
                    console.error(`[LINK] ❌ Error changing nickname in guild ${guild.name}:`, err);
                }
            }
        } catch (error) {
            console.error('Error handling link success:', error);
        }
    }

    async handleGameResult(discordId, type, data) {
        // type is 'general' or 'highscores'
        try {
            const [configs] = await pool.query('SELECT * FROM bot_settings');

            for (const config of configs) {
                const guild = this.client.guilds.cache.get(config.guild_id);
                if (!guild) continue;

                const channelId = type === 'highscores' ? config.highscores_channel_id : config.general_channel_id;
                if (!channelId) continue;

                const channel = guild.channels.cache.get(channelId);
                if (channel) {
                    const embed = this.createResultEmbed(type, data);
                    await channel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error('Error handling game result:', error);
        }
    }

    async handleRankUp(discordId, data) {
        try {
            // Similar to game result but maybe specific channel or just general
            // For now send to general
             const [configs] = await pool.query('SELECT * FROM bot_settings');

            for (const config of configs) {
                const guild = this.client.guilds.cache.get(config.guild_id);
                if (!guild) continue;

                // Try highscores channel for rankups as they are achievements, or general
                const channelId = config.highscores_channel_id || config.general_channel_id;
                if (!channelId) continue;

                const channel = guild.channels.cache.get(channelId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor(getRankColor(data.new_rank_name))
                        .setTitle('🎉 ¡SUBIDA DE RANGO! 🎉')
                        .setDescription(`¡**${data.player_name}** ha alcanzado el rango **${data.new_rank_name}**!`)
                        .setThumbnail(`https://visage.surgeplay.com/bust/128/${data.uuid}`)
                        .addFields(
                            { name: 'Rango Anterior', value: data.old_rank_name || 'Desconocido', inline: true },
                            { name: 'Nuevo Rango', value: data.new_rank_name, inline: true }
                        )
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
             console.error('Error handling rank up:', error);
        }
    }

    createResultEmbed(type, data) {
        const isHighscore = type === 'highscores';
        const color = isHighscore ? 0xFFD700 : 0x0099FF;
        const title = isHighscore ? '🏆 ¡Nuevo Récord!' : '📊 Resultado de Partida';

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setThumbnail(`https://visage.surgeplay.com/bust/128/${data.uuid}`)
            .setTimestamp();

        if (data.player_name) {
            embed.setAuthor({ name: data.player_name, iconURL: `https://visage.surgeplay.com/face/64/${data.uuid}` });
        }
        
        if (data.message) {
             embed.setDescription(data.message);
        }

        // Stats
        if (data.stats) {
             for (const [key, value] of Object.entries(data.stats)) {
                 // Format key
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                embed.addFields({ name: formattedKey, value: String(value), inline: true });
             }
        }

        // Comments/Extra info
        if (data.extra_info) {
             embed.addFields({ name: 'Información', value: data.extra_info, inline: false });
        }

        return embed;
    }
}

function getRankColor(rankName) {
    // ... (colors)
    if (!rankName) return 0x808080;
    if (rankName.includes('Deidad')) return 0xff0000;
    if (rankName.includes('Maestro')) return 0xffd700;
    if (rankName.includes('Experto')) return 0x00ff00;
    return 0x0099ff;
}

module.exports = NotificationHandler;