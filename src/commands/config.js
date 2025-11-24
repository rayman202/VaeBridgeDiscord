const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const pool = require('../utils/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configuración del bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('Configura los canales para notificaciones')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Tipo de canal')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Resultados Generales', value: 'general' },
                            { name: 'High Scores / Récords', value: 'highscores' }
                        ))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('El canal a configurar')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setchannel') {
            const type = interaction.options.getString('type');
            const channel = interaction.options.getChannel('channel');

            try {
                // Upsert configuration
                // We assume a table 'bot_settings' exists. Columns: guild_id, setting_key, setting_value
                // Actually, let's use a row per guild: guild_id, general_channel_id, highscores_channel_id
                
                // Check if row exists
                const [rows] = await pool.query('SELECT * FROM bot_settings WHERE guild_id = ?', [interaction.guildId]);
                
                let query;
                let params;

                if (rows.length === 0) {
                    // Insert
                    const col = type === 'general' ? 'general_channel_id' : 'highscores_channel_id';
                    query = `INSERT INTO bot_settings (guild_id, ${col}) VALUES (?, ?)`;
                    params = [interaction.guildId, channel.id];
                } else {
                    // Update
                    const col = type === 'general' ? 'general_channel_id' : 'highscores_channel_id';
                    query = `UPDATE bot_settings SET ${col} = ? WHERE guild_id = ?`;
                    params = [channel.id, interaction.guildId];
                }

                await pool.query(query, params);

                await interaction.reply({
                    content: `✅ Canal de **${type === 'general' ? 'Resultados Generales' : 'High Scores'}** establecido en ${channel}`,
                    ephemeral: true
                });

            } catch (error) {
                console.error(error);
                await interaction.reply({ content: '❌ Error al guardar la configuración.', ephemeral: true });
            }
        }
    },
};
