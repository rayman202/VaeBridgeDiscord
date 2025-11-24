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
                // Search by name in 'players' table
                const [playerData] = await pool.query('SELECT uuid, name FROM players WHERE name = ?', [minecraftNick]);
                if (playerData.length === 0) {
                    return interaction.editReply({
                        content: `❌ No se encontró al jugador **${minecraftNick}** en la base de datos.`,
                        ephemeral: true
                    });
                }
                uuid = playerData[0].uuid;
                playerName = playerData[0].name;
            } else {
                // Search by discord_id in 'discord_links'
                // The table structure in migration was: discord_id, minecraft_uuid, minecraft_username
                // But deploy-commands was creating: discord_id, uuid.
                // We should support both or prefer the one from migration (minecraft_uuid)
                // Let's try to select both uuid columns to be safe or just 'minecraft_uuid' as per migration
                const [link] = await pool.query('SELECT minecraft_uuid, minecraft_username FROM discord_links WHERE discord_id = ?', [targetUser.id]);
                if (link.length === 0) {
                    // Fallback check for old table structure just in case
                    const [oldLink] = await pool.query('SELECT uuid FROM discord_links WHERE discord_id = ?', [targetUser.id]);
                    if (oldLink.length > 0) {
                         uuid = oldLink[0].uuid;
                         // We need to fetch name from players
                         const [pData] = await pool.query('SELECT name FROM players WHERE uuid = ?', [uuid]);
                         playerName = pData.length > 0 ? pData[0].name : 'Desconocido';
                    } else {
                        const userMention = targetUser.id === interaction.user.id ? 'Tu cuenta' : `${targetUser.tag}`;
                        return interaction.editReply({
                            content: `❌ ${userMention} no tiene su cuenta de Minecraft vinculada. Usa \`/link\` para vincularla.`,
                            ephemeral: true
                        });
                    }
                } else {
                    uuid = link[0].minecraft_uuid;
                    playerName = link[0].minecraft_username;
                }
            }

            // ... (previous code for getting uuid/name)

            // Query stats from 'players' table
            // We try to get 'elo' if it exists, otherwise we'll handle it
            let stats;
            try {
                [stats] = await pool.query(`
                    SELECT 
                        wins, losses, draws, games_played, 
                        kills, deaths, 
                        goals, 
                        best_winstreak, winstreak,
                        blocks_placed, blocks_broken, 
                        victory_rank, victory_rank_level,
                        elo
                    FROM players WHERE uuid = ?`, [uuid]);
            } catch (err) {
                // If 'elo' column is missing, try without it
                [stats] = await pool.query(`
                    SELECT 
                        wins, losses, draws, games_played, 
                        kills, deaths, 
                        goals, 
                        best_winstreak, winstreak,
                        blocks_placed, blocks_broken, 
                        victory_rank, victory_rank_level
                    FROM players WHERE uuid = ?`, [uuid]);
            }

            if (stats.length === 0) {
                return interaction.editReply({ content: '❌ No se encontraron estadísticas para este jugador.', ephemeral: true });
            }

            const playerStats = stats[0];

            // Helper to strip ANSI codes
            const stripAnsi = (str) => {
                if (!str) return '';
                return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
            };

            // Calculations
            const wins = playerStats.wins || 0;
            const losses = playerStats.losses || 0;
            const draws = playerStats.draws || 0;
            const games = playerStats.games_played > 0 ? playerStats.games_played : (wins + losses + draws);
            const kills = playerStats.kills || 0;
            const deaths = playerStats.deaths || 0;
            
            const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills;
            const wlRatio = losses > 0 ? (wins / losses).toFixed(2) : wins;
            const winRate = games > 0 ? ((wins / games) * 100).toFixed(1) : 0;
            
            const currentStreak = playerStats.winstreak || 0;
            // If best_winstreak is 0 in DB, assume current streak if it's higher, or just 0
            const bestStreak = playerStats.best_winstreak || (currentStreak > 0 ? currentStreak : 0);

            const rank = stripAnsi(playerStats.victory_rank || 'Unranked');
            const elo = playerStats.elo || 1000;

            // Determine Tier from Discord Roles
            let tierRank = 'Sin Rango';
            // Only check roles if we found a discord user
            let memberToCheck = null;
            
            if (discordUser) {
                try {
                    memberToCheck = await interaction.guild.members.fetch(discordUser.id);
                } catch (e) { /* User not in guild */ }
            } else if (!useMinecraftNick) {
                // If checking self
                memberToCheck = interaction.member;
            } else {
                // If checking by nick, try to find if they are linked to get roles
                try {
                    const [link] = await pool.query('SELECT discord_id FROM discord_links WHERE minecraft_uuid = ?', [uuid]);
                    if (link.length > 0) {
                        memberToCheck = await interaction.guild.members.fetch(link[0].discord_id).catch(() => null);
                    }
                } catch (e) { }
            }

            if (memberToCheck) {
                // Look for roles with "Tier" or "Tester"
                const tierRole = memberToCheck.roles.cache.find(r => 
                    r.name.includes('Tier') || 
                    r.name.includes('Tester') ||
                    r.name.includes('HT') || 
                    r.name.includes('LT')
                );
                if (tierRole) {
                    tierRank = tierRole.name;
                }
            }

            // Build Embed
            const embed = new EmbedBuilder()
                .setColor(getEloColor(elo))
                .setTitle(`Estadísticas de ${playerName}`)
                .setThumbnail(`https://crafatar.com/avatars/${uuid}?overlay&size=128`)
                .addFields(
                    // Row 1: Main Ranks
                    { name: '🏆 Rango', value: `**${rank}**`, inline: true },
                    { name: '⚔️ Tier', value: `**${tierRank}**`, inline: true },
                    { name: '🧠 ELO', value: `**${elo}**`, inline: true },

                    // Row 2: Streaks & Goals
                    { name: '🔥 Racha Actual', value: `${currentStreak}`, inline: true },
                    { name: '⭐ Mejor Racha', value: `${bestStreak}`, inline: true },
                    { name: '⚽ Goles', value: `${playerStats.goals || 0}`, inline: true },

                    // Row 3: Combat
                    { name: '⚔️ K/D Ratio', value: `${kdRatio}`, inline: true },
                    { name: '🎯 Kills', value: `${kills}`, inline: true },
                    { name: '💀 Muertes', value: `${deaths}`, inline: true },

                    // Row 4: Game Results
                    { name: '📊 W/L Ratio', value: `${wlRatio}`, inline: true },
                    { name: '✅ Victorias', value: `${wins} (${winRate}%)`, inline: true },
                    { name: '🎲 Partidas', value: `${games}`, inline: true },
                    
                    // Row 5: Blocks
                    { name: '🧱 Bloques Puestos', value: `${playerStats.blocks_placed || 0}`, inline: true },
                    { name: '⛏️ Bloques Rotos', value: `${playerStats.blocks_broken || 0}`, inline: true }
                )
                .setFooter({ text: `UUID: ${uuid}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /stats command:', error);
            await interaction.editReply({ content: '❌ Ocurrió un error al obtener las estadísticas.', ephemeral: true });
        }
    },
};
