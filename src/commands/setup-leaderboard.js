const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../utils/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-leaderboard')
        .setDescription('Configura los canales de leaderboard de tier tests.')
        .addChannelOption(option =>
            option.setName('canal_resultados')
                .setDescription('Canal para mostrar todos los resultados de tier tests')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('canal_resultados_altos')
                .setDescription('Canal para mostrar solo resultados altos (>LT1)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const normalChannel = interaction.options.getChannel('canal_resultados');
            const highChannel = interaction.options.getChannel('canal_resultados_altos');

            // Verificar que sean canales de texto
            if (normalChannel.type !== 0 || highChannel.type !== 0) {
                return interaction.editReply({
                    content: '❌ Ambos canales deben ser canales de texto.',
                    ephemeral: true
                });
            }

            // Guardar la configuración en la base de datos
            await pool.query(`
                INSERT INTO leaderboard_config (guild_id, normal_channel_id, high_channel_id)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    normal_channel_id = VALUES(normal_channel_id),
                    high_channel_id = VALUES(high_channel_id)
            `, [interaction.guild.id, normalChannel.id, highChannel.id]);

            // Enviar mensaje inicial a ambos canales
            await this.initializeLeaderboardChannel(normalChannel, false);
            await this.initializeLeaderboardChannel(highChannel, true);

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Leaderboard Configurado')
                .setDescription('Los canales de leaderboard han sido configurados correctamente.')
                .addFields(
                    { name: '📊 Resultados Normales', value: `${normalChannel}`, inline: true },
                    { name: '🏆 Resultados Altos', value: `${highChannel}`, inline: true }
                )
                .setFooter({ text: 'Los leaderboards se actualizarán automáticamente cada vez que se complete un tier test.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /setup-leaderboard command:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al configurar los canales de leaderboard.',
                ephemeral: true
            });
        }
    },

    async initializeLeaderboardChannel(channel, isHighOnly) {
        const title = isHighOnly ? '🏆 TIER TEST - RESULTADOS ALTOS' : '📊 TIER TEST - TODOS LOS RESULTADOS';
        const description = isHighOnly
            ? 'Este canal muestra los mejores resultados de Tier Tests (mayores a LT1).\nSe actualiza automáticamente cuando se completan tier tests.'
            : 'Este canal muestra todos los resultados de Tier Tests.\nSe actualiza automáticamente cuando se completan tier tests.';

        const embed = new EmbedBuilder()
            .setColor(isHighOnly ? 0xFF6B35 : 0x7289DA)
            .setTitle(title)
            .setDescription(description)
            .addFields({
                name: '📌 Información',
                value: 'Los resultados se mostrarán aquí cuando los jugadores completen sus tier tests.\nCada resultado mostrará el jugador, su tier alcanzado y estadísticas del test.'
            })
            .setFooter({ text: 'Sistema de Leaderboard Automático' })
            .setTimestamp();

        try {
            // Limpiar mensajes antiguos del canal
            const messages = await channel.messages.fetch({ limit: 100 });
            if (messages.size > 0) {
                await channel.bulkDelete(messages).catch(console.error);
            }

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`Error initializing leaderboard channel ${channel.id}:`, error);
        }
    }
};
