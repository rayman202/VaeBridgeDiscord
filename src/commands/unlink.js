const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../utils/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlink')
        .setDescription('Desvincula tu cuenta de Discord de Minecraft.'),
    async execute(interaction) {
        try {
            // Check if user is linked
            const [existingLinks] = await pool.query(
                'SELECT * FROM discord_links WHERE discord_id = ?',
                [interaction.user.id]
            );

            if (existingLinks.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('❌ Cuenta No Vinculada')
                    .setDescription('Tu cuenta de Discord no está vinculada con ninguna cuenta de Minecraft.')
                    .setFooter({ text: 'Usa /link para vincular tu cuenta' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const minecraftUsername = existingLinks[0].minecraft_username;

            // Delete the link
            await pool.query('DELETE FROM discord_links WHERE discord_id = ?', [interaction.user.id]);

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✔ Cuenta Desvinculada')
                .setDescription(`Tu cuenta ha sido desvinculada de **${minecraftUsername}** exitosamente.`)
                .setFooter({ text: 'Usa /link para vincular nuevamente' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in unlink command:', error);
            await interaction.reply({
                content: '❌ Ocurrió un error al desvincular tu cuenta.',
                ephemeral: true
            });
        }
    },
};
