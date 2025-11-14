const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Configura el sistema de tickets de ayuda.')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal donde se mostrará el botón para crear tickets')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.options.getChannel('canal');

            // Verificar que sea un canal de texto
            if (channel.type !== 0) {
                return interaction.editReply({
                    content: '❌ El canal debe ser un canal de texto.',
                    ephemeral: true
                });
            }

            // Crear el embed informativo
            const embed = new EmbedBuilder()
                .setColor(0x00D9FF)
                .setTitle('🎫 Sistema de Soporte')
                .setDescription(
                    '¿Necesitas ayuda con algo?\n\n' +
                    '**Cómo funciona:**\n' +
                    '1️⃣ Haz clic en el botón "Crear Ticket" abajo\n' +
                    '2️⃣ Se creará un canal privado solo para ti\n' +
                    '3️⃣ Un miembro del staff te atenderá pronto\n\n' +
                    '**¿Para qué crear un ticket?**\n' +
                    '• Reportar bugs o problemas\n' +
                    '• Solicitar ayuda con comandos\n' +
                    '• Hacer preguntas al staff\n' +
                    '• Reportar jugadores\n' +
                    '• Sugerencias o feedback\n\n' +
                    '¡Estamos aquí para ayudarte!'
                )
                .setFooter({ text: 'Haz clic en el botón para comenzar' })
                .setTimestamp();

            // Crear el botón
            const button = new ButtonBuilder()
                .setCustomId('create-support-ticket')
                .setLabel('📩 Crear Ticket de Ayuda')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);

            // Enviar al canal
            await channel.send({ embeds: [embed], components: [row] });

            // Confirmar al admin
            const confirmEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Sistema de Tickets Configurado')
                .setDescription(`El sistema de tickets ha sido configurado en ${channel}`)
                .addFields({
                    name: '📌 Información',
                    value: 'Los usuarios pueden ahora crear tickets haciendo clic en el botón.\n' +
                        'Los tickets serán visibles para:\n' +
                        '• Administradores\n' +
                        '• Moderadores\n' +
                        '• Dueños del servidor\n' +
                        '• El usuario que creó el ticket'
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('Error in /setup-tickets command:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al configurar el sistema de tickets.',
                ephemeral: true
            });
        }
    }
};
