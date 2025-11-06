const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../utils/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Muestra la tabla de clasificación de los mejores jugadores.')
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('El tipo de clasificación a mostrar.')
                .setRequired(true)
                .addChoices(
                    { name: '🏆 Victorias', value: 'wins' },
                    { name: '⚔️ Asesinatos', value: 'kills' },
                    { name: '📊 ELO', value: 'elo' },
                    { name: '⭐ Nivel', value: 'level' },
                )),
    async execute(interaction) {
        const type = interaction.options.getString('tipo');

        try {
            const [rows] = await pool.query(
                `SELECT name, ${type}, victory_rank FROM players
                 WHERE ${type} > 0
                 ORDER BY ${type} DESC LIMIT 10`
            );

            if (rows.length === 0) {
                return interaction.reply({
                    content: '❌ No se encontraron jugadores en la clasificación.',
                    ephemeral: true
                });
            }

            // Determine title and icon based on type
            let titleIcon = '';
            let titleText = '';
            let fieldName = '';

            switch (type) {
                case 'wins':
                    titleIcon = '🏆';
                    titleText = 'Victorias';
                    fieldName = 'Victorias';
                    break;
                case 'kills':
                    titleIcon = '⚔️';
                    titleText = 'Asesinatos';
                    fieldName = 'Kills';
                    break;
                case 'elo':
                    titleIcon = '📊';
                    titleText = 'ELO';
                    fieldName = 'ELO';
                    break;
                case 'level':
                    titleIcon = '⭐';
                    titleText = 'Nivel';
                    fieldName = 'Nivel';
                    break;
            }

            const embed = new EmbedBuilder()
                .setTitle(`${titleIcon} Top 10 Jugadores - ${titleText}`)
                .setColor(0x00d9ff)
                .setTimestamp()
                .setFooter({ text: 'Estadísticas actualizadas' });

            let description = '';

            for (let i = 0; i < rows.length; i++) {
                let medal = '';
                if (i === 0) medal = '🥇';
                else if (i === 1) medal = '🥈';
                else if (i === 2) medal = '🥉';
                else medal = `**${i + 1}.**`;

                const rank = rows[i].victory_rank || 'N/A';
                const value = rows[i][type];

                description += `${medal} **${rows[i].name}** - ${value} ${fieldName}\n`;
                description += `└ ${rank}\n\n`;
            }

            embed.setDescription(description);

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in top command:', error);
            await interaction.reply({
                content: '❌ Ocurrió un error al obtener la clasificación.',
                ephemeral: true
            });
        }
    },
};
