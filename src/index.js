
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}


// Notification Handler System
const NotificationHandler = require('./utils/notificationHandler.js');
const notificationHandler = new NotificationHandler(client);

// 1. AÑADE ESTO: Un "listener" para el evento 'ready'
// Esto se ejecutará DESPUÉS de que el login sea exitoso.
client.on(Events.ClientReady, () => {
    console.log(`¡ÉXITO! Bot conectado como ${client.user.tag}`);
    console.log(`¡El bot ya está en línea y listo en tu servidor!`);

    // Start notification handler system
    notificationHandler.start();
});

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: 64 });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: 64 });
            }
        }
    } else if (interaction.isButton()) {
        if (interaction.customId === 'request-tier-test') {
            const member = interaction.member;
            const guild = interaction.guild;
            const pool = require('./utils/db.js');

            // Check if user has linked account
            try {
                const [link] = await pool.query(
                    'SELECT * FROM discord_links WHERE discord_id = ?',
                    [member.id]
                );

                if (link.length === 0) {
                    return interaction.reply({
                        content: '❌ Debes vincular tu cuenta de Minecraft primero. Usa `/link` para obtener un código.',
                        flags: 64
                    });
                }

                // Find Tester role
                const testerRole = guild.roles.cache.find(role => role.name === 'Tester' || role.name === 'Tier Tester');

                if (!testerRole) {
                    return interaction.reply({
                        content: '❌ El rol "Tester" no existe en el servidor.',
                        flags: 64
                    });
                }

                // Create private channel (thread or text channel)
                const channel = await guild.channels.create({
                    name: `test-${member.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: member.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                        },
                        {
                            id: testerRole.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                        },
                    ],
                });

                // Record request in database
                await pool.query(
                    `INSERT INTO tier_test_requests (discord_id, minecraft_uuid, thread_id, status)
                     VALUES (?, ?, ?, 'pending')`,
                    [member.id, link[0].minecraft_uuid, channel.id]
                );

                const embed = new EmbedBuilder()
                    .setColor(0x00d9ff)
                    .setTitle('📋 Solicitud de Tier Test')
                    .setDescription(
                        `Hola ${member}, has solicitado un Tier Test.\n\n` +
                        `Un ${testerRole} disponible se pondrá en contacto contigo pronto.\n` +
                        `Por favor, coordina con el tester para realizar tu partida en el servidor.`
                    )
                    .addFields(
                        { name: 'Usuario de Minecraft', value: link[0].minecraft_username, inline: true },
                        { name: 'Estado', value: '⏳ Esperando Tester', inline: true }
                    )
                    .setFooter({ text: 'Buena suerte!' })
                    .setTimestamp();

                const closeButton = new ButtonBuilder()
                    .setCustomId('close-ticket')
                    .setLabel('Cerrar Ticket')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(closeButton);

                await channel.send({ content: `${member} ${testerRole}`, embeds: [embed], components: [row] });

                await interaction.reply({
                    content: `✅ Tu solicitud de Tier Test ha sido creada: ${channel}`,
                    flags: 64
                });

            } catch (error) {
                console.error('Error creating tier test request:', error);
                await interaction.reply({
                    content: '❌ Ocurrió un error al crear tu solicitud. Inténtalo de nuevo.',
                    flags: 64
                });
            }

        } else if (interaction.customId === 'close-ticket') {
            const channel = interaction.channel;
            await channel.send('⏳ Cerrando ticket en 5 segundos...');
            setTimeout(async () => {
                await channel.delete();
            }, 5000);
        }
    }
});

// 2. AÑADE ESTO: Un log para verificar el Token ANTES de iniciar sesión
console.log("Cargando variables... Intentando iniciar sesión...");
// Verifica que el token no esté vacío (undefined)
if (!process.env.DISCORD_TOKEN) {
    console.error("ERROR: ¡DISCORD_TOKEN no se encontró! Revisa tu archivo .env");
} else {
    // 3. LA LÍNEA MÁS IMPORTANTE: Inicia sesión
    client.login(process.env.DISCORD_TOKEN);
}
