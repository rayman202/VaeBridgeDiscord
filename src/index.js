
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

// Leaderboard Handler System
const LeaderboardHandler = require('./utils/leaderboardHandler.js');
const leaderboardHandler = new LeaderboardHandler(client);

// 1. AÑADE ESTO: Un "listener" para el evento 'ready'
// Esto se ejecutará DESPUÉS de que el login sea exitoso.
client.on(Events.ClientReady, () => {
    console.log(`¡ÉXITO! Bot conectado como ${client.user.tag}`);
    console.log(`¡El bot ya está en línea y listo en tu servidor!`);

    // Start notification handler system
    notificationHandler.start();

    // Start leaderboard handler system
    leaderboardHandler.start();
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

        } else if (interaction.customId === 'create-support-ticket') {
            const member = interaction.member;
            const guild = interaction.guild;

            try {
                // Buscar roles de staff
                const adminRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('admin') || r.name.toLowerCase().includes('dueño'));
                const modRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('mod'));

                // Crear canal privado para el ticket
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${member.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: member.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ],
                        },
                        // Permitir a administradores
                        ...(adminRole ? [{
                            id: adminRole.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ],
                        }] : []),
                        // Permitir a moderadores
                        ...(modRole ? [{
                            id: modRole.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ],
                        }] : []),
                    ],
                });

                // Crear embed de bienvenida
                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x00D9FF)
                    .setTitle('🎫 Ticket de Soporte Creado')
                    .setDescription(
                        `¡Hola ${member}! Bienvenido a tu ticket de soporte.\n\n` +
                        `Un miembro del staff ${adminRole || modRole ? `(${adminRole || ''} ${modRole || ''})` : ''} te atenderá pronto.\n\n` +
                        `**Por favor describe tu problema o pregunta con el mayor detalle posible.**\n\n` +
                        `Cuando tu problema esté resuelto, puedes cerrar este ticket haciendo clic en el botón de abajo.`
                    )
                    .addFields(
                        { name: '👤 Usuario', value: member.user.tag, inline: true },
                        { name: '📅 Creado', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                    )
                    .setFooter({ text: 'Gracias por contactarnos' })
                    .setTimestamp();

                const closeButton = new ButtonBuilder()
                    .setCustomId('close-support-ticket')
                    .setLabel('🔒 Cerrar Ticket')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(closeButton);

                // Mencionar al usuario y roles de staff
                let mentions = `${member}`;
                if (adminRole) mentions += ` ${adminRole}`;
                if (modRole) mentions += ` ${modRole}`;

                await ticketChannel.send({
                    content: mentions,
                    embeds: [welcomeEmbed],
                    components: [row]
                });

                // Responder al usuario
                await interaction.reply({
                    content: `✅ Tu ticket ha sido creado: ${ticketChannel}`,
                    flags: 64
                });

            } catch (error) {
                console.error('Error creating support ticket:', error);
                await interaction.reply({
                    content: '❌ Ocurrió un error al crear tu ticket. Inténtalo de nuevo.',
                    flags: 64
                });
            }

        } else if (interaction.customId === 'close-support-ticket') {
            const channel = interaction.channel;

            // Verificar permisos
            const hasPermission = interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
                channel.name.includes(interaction.user.username);

            if (!hasPermission) {
                return interaction.reply({
                    content: '❌ Solo el staff o el creador del ticket pueden cerrarlo.',
                    flags: 64
                });
            }

            await interaction.reply('⏳ Cerrando ticket en 5 segundos...');
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
