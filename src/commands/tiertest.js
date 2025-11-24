const { SlashCommandBuilder, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const pool = require('../utils/db.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tiertest')
        .setDescription('Registra el resultado de un Tier Test.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario que fue evaluado.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ign')
                .setDescription('Nombre de usuario en Minecraft.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('Tier asignado.')
                .setRequired(true)
                .addChoices(
                    { name: 'LT5 (Low Tier 5)', value: 'LT5' },
                    { name: 'HT5 (High Tier 5)', value: 'HT5' },
                    { name: 'LT4 (Low Tier 4)', value: 'LT4' },
                    { name: 'HT4 (High Tier 4)', value: 'HT4' },
                    { name: 'LT3 (Low Tier 3)', value: 'LT3' },
                    { name: 'HT3 (High Tier 3)', value: 'HT3' },
                    { name: 'LT2 (Low Tier 2)', value: 'LT2' },
                    { name: 'HT2 (High Tier 2)', value: 'HT2' },
                    { name: 'LT1 (Low Tier 1)', value: 'LT1' },
                    { name: 'HT1 (High Tier 1)', value: 'HT1' }
                ))
        .addStringOption(option =>
            option.setName('nota')
                .setDescription('Nota del tester sobre el rendimiento.')
                .setRequired(false)),
    async execute(interaction) {
        const discordUser = interaction.options.getUser('usuario');
        const ign = interaction.options.getString('ign');
        const tier = interaction.options.getString('tier');
        const nota = interaction.options.getString('nota') || 'Sin comentarios adicionales.';

        try {
            // Get linked account
            const [link] = await pool.query(
                'SELECT minecraft_uuid FROM discord_links WHERE discord_id = ?',
                [discordUser.id]
            );

            if (link.length === 0) {
                return interaction.reply({
                    content: '❌ Este usuario no ha vinculado su cuenta de Minecraft.',
                    ephemeral: true
                });
            }

            const uuid = link[0].minecraft_uuid;

            // Get previous tier from database
            const [playerData] = await pool.query(
                'SELECT tier_test_rank FROM player_stats WHERE uuid = ?',
                [uuid]
            );

            const previousTier = (playerData.length > 0 && playerData[0].tier_test_rank)
                ? playerData[0].tier_test_rank
                : 'Unranked';

            // Update player tier in database
            await pool.query(
                'UPDATE player_stats SET tier_test_rank = ? WHERE uuid = ?',
                [tier, uuid]
            );

            // Record tier test result for leaderboard
            await pool.query(
                `INSERT INTO tier_test_results (minecraft_uuid, tier_rank, completed_at)
                VALUES (?, ?, NOW())`,
                [uuid, tier]
            );

            // Generate Embed instead of Canvas Image
            const tierColor = getTierColor(tier);
            const skinUrl = `https://visage.surgeplay.com/full/512/${uuid}`;

            const embed = new EmbedBuilder()
                .setColor(tierColor)
                .setTitle('🏆 BRIDGE TIER TEST RESULTS')
                .setDescription(`Resultados del test para **${ign}**`)
                .setThumbnail(`https://crafatar.com/avatars/${uuid}?overlay`)
                .setImage(skinUrl) // Show full body render directly in embed
                .addFields(
                    { name: '👤 Jugador', value: `${discordUser} (\`${ign}\`)`, inline: true },
                    { name: '👮 Tester', value: `${interaction.user}`, inline: true },
                    { name: '📈 Progreso de Tier', value: `\`${previousTier}\` ➔ \`${tier}\``, inline: false },
                    { name: '📝 Notas del Tester', value: `\`\`\`${nota}\`\`\``, inline: false }
                )
                .setFooter({ text: 'VaeBridge Tier System', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            // Send to results channel
            const resultsChannel = interaction.guild.channels.cache.find(
                c => c.name === 'resultados-tier-test' || c.name === 'tier-test-results'
            );

            if (resultsChannel) {
                await resultsChannel.send({
                    content: `🏆 **Nuevo Tier Test Completado**`,
                    embeds: [embed]
                });
            }

            // Update roles
            const member = await interaction.guild.members.fetch(discordUser.id);

            // Remove all tier roles
            const allTierRoles = ['LT5', 'HT5', 'LT4', 'HT4', 'LT3', 'HT3', 'LT2', 'HT2', 'LT1', 'HT1'];
            for (const roleName of allTierRoles) {
                const role = interaction.guild.roles.cache.find(r => r.name === roleName);
                if (role && member.roles.cache.has(role.id)) {
                    await member.roles.remove(role);
                }
            }

            // Add new tier role
            const newTierRole = interaction.guild.roles.cache.find(r => r.name === tier);
            if (newTierRole) {
                await member.roles.add(newTierRole);
            }

            await interaction.reply({
                content: `✅ Tier Test registrado exitosamente para ${discordUser} (${ign}): **${tier}**`,
                ephemeral: true
            });

            // Close ticket logic
            if (interaction.channel.name.startsWith('test-')) {
                setTimeout(async () => {
                    try {
                        await interaction.channel.send('Este canal se cerrará en 10 segundos...');
                        setTimeout(async () => {
                            await interaction.channel.delete();
                        }, 10000);
                    } catch (err) {
                        console.error('Error closing ticket:', err);
                    }
                }, 50000);
            }

        } catch (error) {
            console.error('Error in tiertest command:', error);
            await interaction.reply({
                content: '❌ Ocurrió un error al registrar el Tier Test.',
                ephemeral: true
            });
        }
    },
};

function getTierColor(tier) {
    if (tier.startsWith('HT1')) return '#ff0000'; // Red - Highest
    if (tier.startsWith('LT1')) return '#ff4500'; // Orange Red
    if (tier.startsWith('HT2')) return '#ff8c00'; // Dark Orange
    if (tier.startsWith('LT2')) return '#ffa500'; // Orange
    if (tier.startsWith('HT3')) return '#ffd700'; // Gold
    if (tier.startsWith('LT3')) return '#ffff00'; // Yellow
    if (tier.startsWith('HT4')) return '#7fff00'; // Chartreuse
    if (tier.startsWith('LT4')) return '#00ff00'; // Green
    if (tier.startsWith('HT5')) return '#00bfff'; // Deep Sky Blue
    if (tier.startsWith('LT5')) return '#808080'; // Gray - Lowest
    return '#ffffff'; // White - Default
}

function getTierDivision(tier) {
    if (tier.startsWith('HT') || tier.startsWith('LT')) {
        return tier.startsWith('HT') ? 'High Tier' : 'Low Tier';
    }
    return 'Unranked';
}
