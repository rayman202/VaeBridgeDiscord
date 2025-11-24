const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../utils/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlink')
        .setDescription('Desvincula una cuenta de Discord de Minecraft (Solo Administradores).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario a desvincular')
                .setRequired(true)),
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('usuario');

            // Check if user is linked
            const [existingLinks] = await pool.query(
                'SELECT * FROM discord_links WHERE discord_id = ?',
                [targetUser.id]
            );

            if (existingLinks.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('❌ Cuenta No Vinculada')
                    .setDescription(`La cuenta de ${targetUser} no está vinculada con ninguna cuenta de Minecraft.`)
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const minecraftUsername = existingLinks[0].minecraft_username;

            // Delete the link
            await pool.query('DELETE FROM discord_links WHERE discord_id = ?', [targetUser.id]);

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✔ Cuenta Desvinculada')
                .setDescription(`La cuenta de ${targetUser} ha sido desvinculada de **${minecraftUsername}** exitosamente por un administrador.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in unlink command:', error);
            await interaction.reply({
                content: '❌ Ocurrió un error al desvincular la cuenta.',
                ephemeral: true
            });
        }
    },
};
