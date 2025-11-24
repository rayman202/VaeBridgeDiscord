const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../utils/db.js');

// Helper function to get a color based on tier test rank
function getTierColor(tierRank) {
    if (!tierRank || tierRank === 'N/A' || tierRank === 'Sin Rango' || tierRank === 'Sin Tier') return 0x7289DA; // Discord Blurple por defecto

    const tier = tierRank.toUpperCase();

    // God Tiers
    if (tier.includes('GT') || tier.includes('DIOS')) return 0xFF0000; // Rojo brillante

    // High Tiers
    if (tier.includes('HT') || tier.includes('ALTO')) return 0xFF6B35; // Naranja rojizo

    // Mid Tiers
    if (tier.includes('MT') || tier.includes('MEDIO')) return 0xFFD700; // Dorado

    // Low Tiers
    if (tier.includes('LT') || tier.includes('BAJO')) {
        const num = parseInt(tier.match(/\d+/)?.[0] || '0'); // Extract number if exists (e.g., LT1 -> 1)
        if (num <= 3) return 0x00FF88; // Verde brillante
        if (num <= 6) return 0x00D9FF; // Cian
        return 0x9D4EDD; // Púrpura
    }
    
    // Fallback for general Tester roles or other custom tiers
    if (tier.includes('TESTER')) return 0x00FFFF;

    return 0x7289DA; // Por defecto
}

// Helper function to get tier emoji
function getTierEmoji(tierRank) {
    if (!tierRank || tierRank === 'N/A' || tierRank === 'Sin Rango' || tierRank === 'Sin Tier') return '❓';

    const tier = tierRank.toUpperCase();
    if (tier.includes('GT') || tier.includes('DIOS')) return '👑';
    if (tier.includes('HT') || tier.includes('ALTO')) return '💎';
    if (tier.includes('MT') || tier.includes('MEDIO')) return '⭐';
    if (tier.includes('LT') || tier.includes('BAJO')) return '🔥';
    if (tier.includes('TESTER')) return '🧪';
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

// Helper to strip ANSI codes
const stripAnsi = (str) => {
    if (!str) return '';
    // This regex matches common ANSI escape codes
    return str.replace(/[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};


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
                const [link] = await pool.query('SELECT minecraft_uuid, minecraft_username FROM discord_links WHERE discord_id = ?', [targetUser.id]);
                if (link.length === 0) {
                    const [oldLink] = await pool.query('SELECT uuid FROM discord_links WHERE discord_id = ?', [targetUser.id]);
                    if (oldLink.length > 0) {
                         uuid = oldLink[0].uuid;
                         const [pData] = await pool.query('SELECT name FROM players WHERE uuid = ?', [uuid]);
                         playerName = pData.length > 0 ? pData[0].name : 'Desconocido';
                    } else {
                        const userMention = targetUser.id === interaction.user.id ? 'Tu cuenta' : `${targetUser.tag}`;
                        return interaction.editReply({
                            content: `❌ ${userMention} no tiene su cuenta de Minecraft vinculada. Usa \\\`/link\\\` para vincularla.`, 
                            ephemeral: true
                        });
                    }
                } else {
                    uuid = link[0].minecraft_uuid;
                    playerName = link[0].minecraft_username;
                }
            }

            let playerStats;
            try {
                const [statsResult] = await pool.query(`
                    SELECT 
                        wins, losses, draws, games_played, 
                        kills, deaths, 
                        goals, 
                        best_winstreak, winstreak,
                        blocks_placed, blocks_broken, 
                        victory_rank, victory_rank_level,
                        elo, tier_test_rank
                    FROM players WHERE uuid = ?`, [uuid]);
                playerStats = statsResult[0];
            } catch (err) {
                // Fallback query if 'elo' or 'tier_test_rank' columns do not exist
                console.warn(`Attempting query without ELO/TierTestRank for ${uuid}: ${err.message}`);
                const [statsResult] = await pool.query(`
                    SELECT 
                        wins, losses, draws, games_played, 
                        kills, deaths, 
                        goals, 
                        best_winstreak, winstreak,
                        blocks_placed, blocks_broken, 
                        victory_rank, victory_rank_level
                    FROM players WHERE uuid = ?`, [uuid]);
                playerStats = statsResult[0];
            }

            if (!playerStats) {
                return interaction.editReply({ content: '❌ No se encontraron estadísticas para este jugador.', ephemeral: true });
            }

            // Calculations, handling potential nulls/zeros
            const wins = playerStats.wins || 0;
            const losses = playerStats.losses || 0;
            const draws = playerStats.draws || 0;
            const games = playerStats.games_played > 0 ? playerStats.games_played : (wins + losses + draws);
            const kills = playerStats.kills || 0;
            const deaths = playerStats.deaths || 0;
            
            const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
            const wlRatio = losses > 0 ? (wins / losses).toFixed(2) : wins.toFixed(2);
            const winRate = games > 0 ? ((wins / games) * 100).toFixed(1) : 0;
            const winRateBar = createProgressBar(parseFloat(winRate), 100, 10);
            
            const currentStreak = playerStats.winstreak || 0;
            const bestStreak = playerStats.best_winstreak || (currentStreak > 0 ? currentStreak : 0);

            const victoryRank = stripAnsi(playerStats.victory_rank || 'Sin Rango');
            const elo = playerStats.elo || 1000;

            // Determine Tier from Discord Roles, overriding DB if available
            let finalTierRank = playerStats.tier_test_rank || 'Sin Tier'; // Default to DB value or 'Sin Tier'
            let memberToCheck = null;
            
            if (discordUser) {
                try {
                    memberToCheck = await interaction.guild.members.fetch(discordUser.id);
                } catch (e) { /* User not in guild or fetch failed */ }
            } else if (!useMinecraftNick) {
                memberToCheck = interaction.member;
            } else {
                try {
                    const [link] = await pool.query('SELECT discord_id FROM discord_links WHERE minecraft_uuid = ?', [uuid]);
                    if (link.length > 0) {
                        memberToCheck = await interaction.guild.members.fetch(link[0].discord_id).catch(() => null);
                    }
                } catch (e) { /* DB error or user not linked */ }
            }

            if (memberToCheck) {
                const tierRole = memberToCheck.roles.cache.find(r => 
                    r.name.toLowerCase().includes('tier') || 
                    r.name.toLowerCase().includes('tester') ||
                    r.name.toLowerCase().includes('ht') || 
                    r.name.toLowerCase().includes('lt') ||
                    r.name.toLowerCase().includes('god tier')
                );
                if (tierRole) {
                    finalTierRank = tierRole.name;
                }
            }
            const tierEmoji = getTierEmoji(finalTierRank);


            // Build Embed
            const embed = new EmbedBuilder()
                .setColor(getTierColor(finalTierRank)) // Use tier color
                .setAuthor({
                    name: `${playerName}`,
                    iconURL: `https://visage.surgeplay.com/face/64/${uuid}`
                })
                .setTitle(`📊 Estadísticas de The Bridge`)
                .setThumbnail(`https://visage.surgeplay.com/bust/128/${uuid}`) // Use Visage bust for better quality
                .setDescription('¡Aquí están las estadísticas detalladas de este jugador!')
                .addFields(
                    // SECCIÓN DE RANGOS
                    {
                        name: '🏅 **RANGOS Y CLASIFICACIÓN**',
                        value: '\u200B', // Empty field to create a line break
                        inline: false
                    },
                    {
                        name: '🏆 Rango de Victorias',
                        value: `**${victoryRank}**`,
                        inline: true
                    },
                    {
                        name: `${tierEmoji} Tier`,
                        value: `**${finalTierRank}**`,
                        inline: true
                    },
                    {
                        name: '🧠 ELO',
                        value: `**${elo}**`,
                        inline: true
                    },

                    // SECCIÓN DE RENDIMIENTO GENERAL
                    {
                        name: '📊 **RENDIMIENTO GENERAL**',
                        value: '\u200B', // Empty field for spacing
                        inline: false
                    },
                    {
                        name: '🎮 Partidas Jugadas',
                        value: `**${formatNumber(games)}**`,
                        inline: true
                    },
                    {
                        name: '✅ Victorias',
                        value: `**${formatNumber(wins)}**`,
                        inline: true
                    },
                    {
                        name: '❌ Derrotas',
                        value: `**${formatNumber(losses)}**`,
                        inline: true
                    },
                     {
                        name: '➖ Empates',
                        value: `**${formatNumber(draws)}**`,
                        inline: true
                    },
                    {
                        name: '📈 Win Rate',
                        value: `${winRateBar} **${winRate}%**`,
                        inline: true
                    },
                    {
                        name: '📊 W/L Ratio',
                        value: `**${wlRatio}**`,
                        inline: true
                    },
                    {
                        name: '🔥 Racha Actual',
                        value: `**${formatNumber(currentStreak)}**`,
                        inline: true
                    },
                    {
                        name: '⭐ Mejor Racha',
                        value: `**${formatNumber(bestStreak)}**`,
                        inline: true
                    },

                    // SECCIÓN DE COMBATE
                    {
                        name: '⚔️ **ESTADÍSTICAS DE COMBATE**',
                        value: '\u200B', // Empty field for spacing
                        inline: false
                    },
                    {
                        name: '🎯 Kills',
                        value: `**${formatNumber(kills)}**`,
                        inline: true
                    },
                    {
                        name: '💀 Muertes',
                        value: `**${formatNumber(deaths)}**`,
                        inline: true
                    },
                    {
                        name: '📈 K/D Ratio',
                        value: `**${kdRatio}**`,
                        inline: true
                    },
                    {
                        name: '⚽ Goles',
                        value: `**${formatNumber(playerStats.goals || 0)}**`,
                        inline: true
                    },
                    {
                        name: '🧱 Bloques Puestos',
                        value: `**${formatNumber(playerStats.blocks_placed || 0)}**`,
                        inline: true
                    },
                    {
                        name: '⛏️ Bloques Rotos',
                        value: `**${formatNumber(playerStats.blocks_broken || 0)}**`,
                        inline: true
                    }
                )
                .setFooter({
                    text: `UUID: ${uuid}`,
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /stats command:', error);
            await interaction.editReply({ content: '❌ Ocurrió un error al obtener las estadísticas.', ephemeral: true });
        }
    },
};