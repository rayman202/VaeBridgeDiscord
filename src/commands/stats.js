const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../utils/db.js');

// Helper function to get a color based on ELO
function getEloColor(elo) {
    if (elo >= 2000) return 0xff0080; // Rosa neón (Master)
    if (elo >= 1800) return 0xffd700; // Dorado (Diamond)
    if (elo >= 1600) return 0x00ffff; // Cyan (Platinum)
    if (elo >= 1400) return 0x9d4edd; // Púrpura (Gold)
    if (elo >= 1200) return 0x00d9ff; // Azul claro (Silver)
    return 0x90cdf4; // Azul pálido (Bronze/Novato)
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
            const kdRatio = playerStats.deaths > 0 ? (playerStats.kills / playerStats.deaths).toFixed(2) : playerStats.kills;
            const wlRatio = playerStats.losses > 0 ? (playerStats.wins / playerStats.losses).toFixed(2) : playerStats.wins;
            const winRate = playerStats.games_played > 0 ? ((playerStats.wins / playerStats.games_played) * 100).toFixed(1) : 0;

            // Construir el embed
            const embed = new EmbedBuilder()
                .setColor(getEloColor(playerStats.elo))
                .setTitle(`Estadísticas de ${playerName}`)
                .setThumbnail(`https://crafatar.com/avatars/${uuid}?overlay&size=128`)
                .addFields(
                    // Fila 1: Rango y Tier
                    { name: '🏆 Rango de Victorias', value: `**${playerStats.victory_rank || 'N/A'}**`, inline: true },
                    { name: '⚔️ Tier Test', value: `**${playerStats.tier_test_rank || 'N/A'}**`, inline: true },
                    { name: '🧠 ELO', value: `**${playerStats.elo || '1000'}**`, inline: true },

                    // Fila 2: W/L
                    { name: '✅ Victorias', value: `${playerStats.wins || 0}`, inline: true },
                    { name: '❌ Derrotas', value: `${playerStats.losses || 0}`, inline: true },
                    { name: '📊 W/L Ratio', value: `${wlRatio}`, inline: true },

                    // Fila 3: K/D
                    { name: '🎯 Asesinatos', value: `${playerStats.kills || 0}`, inline: true },
                    { name: '💀 Muertes', value: `${playerStats.deaths || 0}`, inline: true },
                    { name: '📈 K/D Ratio', value: `${kdRatio}`, inline: true },

                    // Fila 4: Rachas y Goles
                    { name: '🔥 Racha Actual', value: `${playerStats.win_streak || 0}`, inline: true },
                    { name: '⭐ Mejor Racha', value: `${playerStats.best_win_streak || 0}`, inline: true },
                    { name: '⚽ Goles', value: `${playerStats.goals || 0}`, inline: true }
                )
                .setFooter({ text: `ID: ${uuid}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /stats command:', error);
            await interaction.editReply({ content: '❌ Ocurrió un error al obtener las estadísticas.', ephemeral: true });
        }
    },
};
