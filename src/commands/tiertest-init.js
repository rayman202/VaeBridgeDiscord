const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tiertest-init')
        .setDescription('Inicializa el sistema de Tier Test en el canal actual.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x00d9ff)
            .setTitle('🏆 TIER TEST - BRIDGE PVP 🏆')
            .setDescription(
                '¡Mide tu habilidad en The Bridge!\n\n' +
                '¿Crees que tienes lo necesario para alcanzar el top?\n' +
                'Haz clic en el botón de abajo para solicitar tu **Tier Test**.\n\n' +
                'Un **Tester oficial** se pondrá en contacto contigo en un canal privado.'
            )
            .addFields(
                {
                    name: '📋 ¿Qué es un Tier Test?',
                    value: 'Una prueba oficial donde un Tester evalúa tu nivel de habilidad en The Bridge PVP.',
                    inline: false
                },
                {
                    name: '🎯 Tiers Disponibles',
                    value: '`LT5` `HT5` `LT4` `HT4` `LT3` `HT3` `LT2` `HT2` `LT1` `HT1`\n' +
                           '*(LT = Low Tier, HT = High Tier)*',
                    inline: false
                },
                {
                    name: '✅ Requisitos',
                    value: '• Cuenta de Discord vinculada con Minecraft (`/link`)\n' +
                           '• Disponibilidad para jugar cuando el Tester esté libre\n' +
                           '• Actitud respetuosa y deportiva',
                    inline: false
                }
            )
            .setFooter({ text: 'Buena suerte en tu prueba!' })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setCustomId('request-tier-test')
            .setLabel('📝 Solicitar Tier Test')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(button);

        await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        await interaction.reply({
            content: '✅ Sistema de Tier Test inicializado en este canal.',
            ephemeral: true
        });
    },
};
