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
                : 'N/A';

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

            // Generate result image
            const canvas = createCanvas(1000, 600);
            const ctx = canvas.getContext('2d');

            // Background gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Decorative elements
            ctx.strokeStyle = '#0f3460';
            ctx.lineWidth = 3;
            ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

            // Title
            ctx.fillStyle = '#e94560';
            ctx.font = 'bold 48px Arial';
            ctx.fillText('BRIDGE TEST RESULTS', 80, 80);

            // Player skin
            // Usamos Visage que suele ser más estable para renders completos
            const skinUrl = `https://visage.surgeplay.com/full/512/${uuid}`;
            
            try {
                // Intentamos cargar la skin con un timeout
                const skin = await loadImage(skinUrl);
                ctx.drawImage(skin, 70, 130, 200, 350);
            } catch (error) {
                console.error('Failed to load player skin from Visage:', error.message);
                
                // Fallback: Intentar con Crafatar si Visage falla
                try {
                    const fallbackUrl = `https://crafatar.com/renders/body/${uuid}?overlay`;
                    const skinFallback = await loadImage(fallbackUrl);
                    ctx.drawImage(skinFallback, 70, 130, 200, 350);
                } catch (fallbackError) {
                    console.error('Failed to load player skin from Crafatar (fallback):', fallbackError.message);
                    
                    // Si todo falla, dibujar un placeholder
                    ctx.fillStyle = '#333';
                    ctx.fillRect(70, 130, 200, 350);
                    ctx.fillStyle = '#fff';
                    ctx.font = '20px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Skin no', 170, 300);
                    ctx.fillText('disponible', 170, 330);
                    ctx.textAlign = 'start'; // Reset alignment
                }
            }

            // Player info
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Arial';
            ctx.fillText('Minecraft Username:', 320, 180);
            ctx.font = '32px Arial';
            ctx.fillStyle = '#00d9ff';
            ctx.fillText(ign, 320, 220);

            // Tier Update
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Arial';
            ctx.fillText('Tier Update:', 320, 280);

            // Previous -> New Tier
            ctx.font = 'bold 32px Arial';
            if (previousTier === 'N/A') {
                ctx.fillStyle = '#888';
                ctx.fillText('Unranked', 320, 320);
            } else {
                ctx.fillStyle = getTierColor(previousTier);
                ctx.fillText(previousTier, 320, 320);
            }

            ctx.fillStyle = '#ffffff';
            ctx.fillText('→', 450, 320);

            ctx.fillStyle = getTierColor(tier);
            ctx.fillText(tier, 520, 320);

            // Tested by
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px Arial';
            ctx.fillText('Tested by:', 320, 380);
            ctx.font = '26px Arial';
            ctx.fillStyle = '#00d9ff';
            ctx.fillText(interaction.user.tag, 320, 415);

            // Tester note
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('Tester Note:', 320, 465);
            ctx.font = '20px Arial';
            ctx.fillStyle = '#ddd';

            // Word wrap for note
            const maxWidth = 600;
            const words = nota.split(' ');
            let line = '';
            let y = 495;
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && n > 0) {
                    ctx.fillText(line, 320, y);
                    line = words[n] + ' ';
                    y += 25;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, 320, y);

            const buffer = canvas.toBuffer('image/png');
            const attachment = new AttachmentBuilder(buffer, { name: 'tiertest-result.png' });

            // Send to results channel
            const resultsChannel = interaction.guild.channels.cache.find(
                c => c.name === 'resultados-tier-test' || c.name === 'tier-test-results'
            );

            if (resultsChannel) {
                await resultsChannel.send({
                    content: `🏆 **Nuevo Tier Test Completado** 🏆\n${discordUser} ha sido evaluado!`,
                    files: [attachment]
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

            // Close ticket after 1 minute
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
