const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../utils/db.js');

// Helper function to get a color based on tier test rank
function getTierColor(tierRank) {
    if (!tierRank || tierRank === 'N/A') return 0x7289DA; // Discord Blurple por defecto

    const tier = tierRank.toUpperCase();

    // God Tiers
    if (tier.includes('GT')) return 0xFF0000; // Rojo brillante

    // High Tiers
    if (tier.includes('HT')) return 0xFF6B35; // Naranja rojizo

    // Mid Tiers
    if (tier.includes('MT')) return 0xFFD700; // Dorado

    // Low Tiers
    if (tier.includes('LT')) {
        const num = parseInt(tier.match(/\d+/)?.[0] || '0');
        if (num <= 3) return 0x00FF88; // Verde brillante
        if (num <= 6) return 0x00D9FF; // Cian
        return 0x9D4EDD; // Púrpura
    }

    return 0x7289DA; // Por defecto
}

// Helper function to get tier emoji
function getTierEmoji(tierRank) {
    if (!tierRank || tierRank === 'N/A') return '❓';

    const tier = tierRank.toUpperCase();
    if (tier.includes('GT')) return '👑';
    if (tier.includes('HT')) return '💎';
    if (tier.includes('MT')) return '⭐';
    if (tier.includes('LT')) return '🔥';
    return '🎯';
}

// Helper function to format large numbers
function formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

// Helper function to create a progress bar
function createProgressBar(value, maxValue, length = 10) {
    const percentage = Math.min(Math.max(value / maxValue, 0), 1);
    const filled = Math.round(percentage * length);
    const empty = length - filled;

    const fillChar = '█';
    const emptyChar = '░';

    return fillChar.repeat(filled) + emptyChar.repeat(empty);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Muestra las estadísticas de un jugador.')
        .addUserOption(option =>
            option.setName('discord_user')
                .setDescription('Usuario de Discord (debe tener cuenta vinculada)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('minecraft_nick')
                .setDescription('Nickname de Minecraft del jugador')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();

        const discordUser = interaction.options.getUser('discord_user');
        const minecraftNick = interaction.options.getString('minecraft_nick');

        if (discordUser && minecraftNick) {
            return interaction.editReply({
                content: '❌ Solo puedes usar **uno** de los parámetros: `discord_user` o `minecraft_nick`, no ambos.',
                ephemeral: true
            });
        }

        const targetUser = discordUser || interaction.user;
        const useMinecraftNick = minecraftNick && !discordUser;

        try {
            let uuid;
            let playerName;

            if (useMinecraftNick) {
                const [playerData] = await pool.query('SELECT uuid, name FROM player_stats WHERE name = ?', [minecraftNick]);
                if (playerData.length === 0) {
                    return interaction.editReply({
                        content: `❌ No se encontró al jugador **${minecraftNick}** en la base de datos.`,
                        ephemeral: true
                    });
                }
                uuid = playerData[0].uuid;
                playerName = playerData[0].name;
            } else {
                const [link] = await pool.query('SELECT minecraft_uuid, minecraft_username FROM discord_links WHERE discord_id = ?', [targetUser.id]);
                if (link.length === 0) {
                    const userMention = targetUser.id === interaction.user.id ? 'Tu cuenta' : `${targetUser.tag}`;
                    return interaction.editReply({
                        content: `❌ ${userMention} no tiene su cuenta de Minecraft vinculada. Usa \`/link\` para vincularla.`,
                        ephemeral: true
                    });
                }
                uuid = link[0].minecraft_uuid;
                playerName = link[0].minecraft_username;
            }

            const [stats] = await pool.query('SELECT * FROM player_stats WHERE uuid = ?', [uuid]);
            if (stats.length === 0) {
                return interaction.editReply({ content: '❌ No se encontraron estadísticas para este jugador.', ephemeral: true });
            }

            const playerStats = stats[0];

            // Calcular ratios
            const kdRatio = playerStats.deaths > 0 ? (playerStats.kills / playerStats.deaths).toFixed(2) : playerStats.kills.toFixed(2);
            const wlRatio = playerStats.losses > 0 ? (playerStats.wins / playerStats.losses).toFixed(2) : playerStats.wins.toFixed(2);
            const winRate = playerStats.games_played > 0 ? ((playerStats.wins / playerStats.games_played) * 100).toFixed(1) : 0;

            // Crear barra de progreso para winrate
            const winRateBar = createProgressBar(parseFloat(winRate), 100, 12);

            // Obtener rango/prefix si existe
            const rankPrefix = playerStats.rank_prefix || playerStats.victory_rank || '';
            const displayName = rankPrefix ? `${rankPrefix} ${playerName}` : playerName;

            // Construir el embed con diseño premium
            const tierEmoji = getTierEmoji(playerStats.tier_test_rank);
            const embed = new EmbedBuilder()
                .setColor(getTierColor(playerStats.tier_test_rank))
                .setAuthor({
                    name: displayName,
                    iconURL: `https://crafatar.com/avatars/${uuid}?overlay&size=64`
                })
                .setTitle(`${tierEmoji} ESTADÍSTICAS DE THE BRIDGE`)
                .setThumbnail(`https://visage.surgeplay.com/full/512/${uuid}`)
                .setDescription(
                    `> **${playerStats.tier_test_rank || 'Sin Tier'}** • ELO: **${playerStats.elo || 1000}**\n` +
                    `> Rango: **${playerStats.victory_rank || 'Novato'}**\n` +
                    `\`\`\`ansi\n[2;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m\n\`\`\``
                )
                .addFields(
                    // RENDIMIENTO GENERAL
                    {
                        name: '🏆 RENDIMIENTO GENERAL',
                        value:
                            `**Victorias:** \`${formatNumber(playerStats.wins || 0)}\` • ` +
                            `**Derrotas:** \`${formatNumber(playerStats.losses || 0)}\`\n` +
                            `**Partidas:** \`${formatNumber(playerStats.games_played || 0)}\` • ` +
                            `**W/L:** \`${wlRatio}\`\n` +
                            `**Win Rate:** ${winRateBar} \`${winRate}%\``,
                        inline: false
                    },

                    // RACHAS
                    {
                        name: '🔥 RACHAS',
                        value:
                            `**Racha Actual:** \`${playerStats.win_streak || 0}\` victorias\n` +
                            `**Mejor Racha:** \`${playerStats.best_win_streak || 0}\` victorias`,
                        inline: true
                    },

                    // COMBATE
                    {
                        name: '⚔️ COMBATE',
                        value:
                            `**Asesinatos:** \`${formatNumber(playerStats.kills || 0)}\`\n` +
                            `**Muertes:** \`${formatNumber(playerStats.deaths || 0)}\`\n` +
                            `**K/D Ratio:** \`${kdRatio}\``,
                        inline: true
                    },

                    // OBJETIVOS
                    {
                        name: '⚽ OBJETIVOS',
                        value:
                            `**Goles:** \`${formatNumber(playerStats.goals || 0)}\`\n` +
                            `**Puntos:** \`${formatNumber(playerStats.points || 0)}\``,
                        inline: true
                    }
                )
                .setFooter({
                    text: `ID: ${uuid.split('-')[0]}... • Actualizado`,
                    iconURL: `https://crafatar.com/avatars/${uuid}?overlay&size=16`
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /stats command:', error);
            await interaction.editReply({ content: '❌ Ocurrió un error al obtener las estadísticas.', ephemeral: true });
        }
    },
};
