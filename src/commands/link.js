const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../utils/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Genera un código para vincular tu cuenta de Discord con Minecraft.'),
    async execute(interaction) {
        try {
            // Check if user is already linked
            const [existingLinks] = await pool.query(
                'SELECT * FROM discord_links WHERE discord_id = ?',
                [interaction.user.id]
            );

            if (existingLinks.length > 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✔ Cuenta Ya Vinculada')
                    .setDescription('Tu cuenta de Discord ya está vinculada con Minecraft.')
                    .addFields(
                        { name: 'Usuario de Minecraft', value: existingLinks[0].minecraft_username, inline: true }
                    )
                    .setFooter({ text: 'Usa /unlink para desvincular tu cuenta' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Generate a random 6-character code
            const code = generateCode();

            // IMPORTANT: Use explicit timestamp to avoid timezone issues
            // Calculate expiration time (5 minutes from now)
            const currentTimeMillis = Date.now();
            const expirationTimeMillis = currentTimeMillis + (5 * 60 * 1000); // 5 minutes in milliseconds

            // Convert to MySQL DATETIME format in UTC to avoid timezone issues
            const expiresAt = new Date(expirationTimeMillis);

            console.log(`[LINK] Generating code for user ${interaction.user.username} (${interaction.user.id})`);
            console.log(`[LINK] Current time: ${new Date(currentTimeMillis).toISOString()}`);
            console.log(`[LINK] Expiration time: ${expiresAt.toISOString()}`);
            console.log(`[LINK] Code: ${code}`);

            // Delete any existing codes for this user
            await pool.query('DELETE FROM linking_codes WHERE discord_id = ?', [interaction.user.id]);

            // Insert the new code - use TIMESTAMP type to avoid timezone conversion
            await pool.query(
                'INSERT INTO linking_codes (code, discord_id, discord_username, expires_at) VALUES (?, ?, ?, FROM_UNIXTIME(?))',
                [code, interaction.user.id, interaction.user.username, expirationTimeMillis / 1000]
            );

            const embed = new EmbedBuilder()
                .setColor(0xffaa00)
                .setTitle('🔗 Código de Vinculación Generado')
                .setDescription('Sigue estos pasos para vincular tu cuenta:')
                .addFields(
                    { name: '1️⃣ Únete al Servidor', value: 'Conéctate al servidor de Minecraft', inline: false },
                    { name: '2️⃣ Usa el Comando', value: `Ejecuta: \`/link ${code}\``, inline: false },
                    { name: '⏰ Código', value: `\`${code}\``, inline: true },
                    { name: '⏱ Expira en', value: '5 minutos', inline: true }
                )
                .setFooter({ text: 'El código expirará automáticamente después de 5 minutos' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in link command:', error);
            await interaction.reply({
                content: '❌ Ocurrió un error al generar el código de vinculación.',
                ephemeral: true
            });
        }
    },
};

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
