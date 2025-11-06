
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const pool = require('../utils/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Muestra las estadísticas de un jugador.')
        .addUserOption(option =>
            option.setName('discord_user')
                .setDescription('Usuario de Discord (debe tener cuenta vinculada)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('minecraft_nick')
                .setDescription('Nickname de Minecraft del jugador')
                .setRequired(false)),
    async execute(interaction) {
        const discordUser = interaction.options.getUser('discord_user');
        const minecraftNick = interaction.options.getString('minecraft_nick');

        // Validar que solo se use uno de los parámetros
        if (discordUser && minecraftNick) {
            return interaction.reply({
                content: '❌ Solo puedes usar **uno** de los parámetros: `discord_user` o `minecraft_nick`, no ambos.',
                flags: 64
            });
        }

        // Si no se proporciona ninguno, usar el usuario que ejecuta el comando
        const targetUser = discordUser || interaction.user;
        const useMinecraftNick = minecraftNick && !discordUser;

        try {
            let uuid;
            let playerName;

            if (useMinecraftNick) {
                // Buscar por nombre de Minecraft en player_stats
                const [playerData] = await pool.query('SELECT uuid, name FROM player_stats WHERE name = ?', [minecraftNick]);

                if (playerData.length === 0) {
                    return interaction.reply({
                        content: `❌ No se encontró al jugador **${minecraftNick}** en la base de datos.\n\n` +
                                `💡 El jugador debe haber jugado al menos una vez en el servidor.`,
                        flags: 64
                    });
                }

                uuid = playerData[0].uuid;
                playerName = playerData[0].name;
            } else {
                // Buscar por Discord user (cuenta vinculada)
                const [link] = await pool.query('SELECT minecraft_uuid, minecraft_username FROM discord_links WHERE discord_id = ?', [targetUser.id]);

                if (link.length === 0) {
                    const userMention = targetUser.id === interaction.user.id ? 'Tu cuenta' : `${targetUser.tag}`;
                    return interaction.reply({
                        content: `❌ ${userMention} no tiene su cuenta de Minecraft vinculada.\n\n` +
                                `💡 Usa \`/link\` para vincular tu cuenta, o usa el parámetro \`minecraft_nick\` para ver stats de jugadores no vinculados.`,
                        flags: 64
                    });
                }

                uuid = link[0].minecraft_uuid;
                playerName = link[0].minecraft_username;
            }

            const [stats] = await pool.query('SELECT * FROM player_stats WHERE uuid = ?', [uuid]);

            if (stats.length === 0) {
                return interaction.reply({ content: '❌ No se encontraron estadísticas para este jugador.', flags: 64 });
            }

            const playerStats = stats[0];

            // Canvas con dimensiones más amplias para mejor diseño
            const canvas = createCanvas(1400, 800);
            const ctx = canvas.getContext('2d');

            // ========== HELPER FUNCTIONS ==========

            // Función para dibujar rectángulos con esquinas redondeadas
            function roundRect(ctx, x, y, width, height, radius) {
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + width - radius, y);
                ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
                ctx.lineTo(x + width, y + height - radius);
                ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                ctx.lineTo(x + radius, y + height);
                ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
            }

            // Función para dibujar paneles con glassmorphism effect
            function drawPanel(ctx, x, y, width, height, glowColor = 'rgba(100, 200, 255, 0.2)') {
                // Sombra externa suave (card shadow)
                ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                ctx.shadowBlur = 25;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 8;

                // Fondo del panel con glassmorphism
                roundRect(ctx, x, y, width, height, 20);
                const panelGradient = ctx.createLinearGradient(x, y, x, y + height);
                panelGradient.addColorStop(0, 'rgba(25, 35, 60, 0.75)');
                panelGradient.addColorStop(1, 'rgba(15, 20, 40, 0.85)');
                ctx.fillStyle = panelGradient;
                ctx.fill();

                // Reset shadow para el borde
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;

                // Borde exterior con glow
                ctx.strokeStyle = 'rgba(100, 150, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Borde interno superior (highlight glassmorphism)
                ctx.save();
                ctx.clip();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 2;
                roundRect(ctx, x + 2, y + 2, width - 4, height / 3, 18);
                ctx.stroke();
                ctx.restore();

                // Glow exterior sutil
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 30;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.strokeStyle = glowColor;
                ctx.lineWidth = 1;
                roundRect(ctx, x, y, width, height, 20);
                ctx.stroke();

                // Reset shadow
                ctx.shadowBlur = 0;
            }

            // Función para obtener color según ELO
            function getEloColor(elo) {
                if (elo >= 2000) return '#ff0080'; // Rosa neón (Master)
                if (elo >= 1800) return '#ffd700'; // Dorado (Diamond)
                if (elo >= 1600) return '#00ffff'; // Cyan (Platinum)
                if (elo >= 1400) return '#9d4edd'; // Púrpura (Gold)
                if (elo >= 1200) return '#00d9ff'; // Azul claro (Silver)
                return '#90cdf4'; // Azul pálido (Bronze/Novato)
            }

            // ========== BACKGROUND CON LIGHTING MEJORADO ==========

            // Degradado radial de fondo más profundo
            const bgGradient = ctx.createRadialGradient(700, 400, 100, 700, 400, 900);
            bgGradient.addColorStop(0, '#1a2332');
            bgGradient.addColorStop(0.4, '#0f1624');
            bgGradient.addColorStop(1, '#080b14');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Efecto de grid con blur sutil
            ctx.globalAlpha = 0.06;
            ctx.strokeStyle = 'rgba(100, 150, 255, 0.8)';
            ctx.lineWidth = 1;
            for (let i = 0; i < canvas.width; i += 40) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, canvas.height);
                ctx.stroke();
            }
            for (let i = 0; i < canvas.height; i += 40) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(canvas.width, i);
                ctx.stroke();
            }
            ctx.globalAlpha = 1.0;

            // Lighting spots (simular HDRI ambient)
            const lightGradient1 = ctx.createRadialGradient(200, 400, 50, 200, 400, 400);
            lightGradient1.addColorStop(0, 'rgba(100, 150, 255, 0.08)');
            lightGradient1.addColorStop(1, 'rgba(100, 150, 255, 0)');
            ctx.fillStyle = lightGradient1;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const lightGradient2 = ctx.createRadialGradient(1100, 300, 50, 1100, 300, 350);
            lightGradient2.addColorStop(0, 'rgba(150, 100, 255, 0.06)');
            lightGradient2.addColorStop(1, 'rgba(150, 100, 255, 0)');
            ctx.fillStyle = lightGradient2;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // ========== PLAYER SKIN CON ILUMINACIÓN Y EFECTOS MEJORADOS ==========

            const skinWidth = 250;
            const skinHeight = 550;
            const skinX = 70;
            const skinY = 220;

            // Sombra difusa en el suelo (debajo del personaje)
            ctx.save();
            const floorShadow = ctx.createRadialGradient(skinX + skinWidth / 2, skinY + skinHeight + 20, 20, skinX + skinWidth / 2, skinY + skinHeight + 20, 140);
            floorShadow.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
            floorShadow.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
            floorShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = floorShadow;
            ctx.fillRect(skinX - 60, skinY + skinHeight, skinWidth + 120, 40);
            ctx.restore();

            // Glow ambiental alrededor del personaje (rim light)
            ctx.save();
            const characterGlow = ctx.createRadialGradient(skinX + skinWidth / 2, skinY + skinHeight / 2, 80, skinX + skinWidth / 2, skinY + skinHeight / 2, 200);
            characterGlow.addColorStop(0, 'rgba(100, 180, 255, 0)');
            characterGlow.addColorStop(0.7, 'rgba(100, 180, 255, 0.15)');
            characterGlow.addColorStop(1, 'rgba(100, 180, 255, 0)');
            ctx.fillStyle = characterGlow;
            ctx.fillRect(skinX - 80, skinY - 40, skinWidth + 160, skinHeight + 120);
            ctx.restore();

            // Usar la API de renders isométricos para mejor perspectiva 3D
            const skinUrl = `https://visage.surgeplay.com/full/512/${uuid}`;
            try {
                const skin = await loadImage(skinUrl);

                // Sombra principal del personaje (más suave y difusa)
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 40;
                ctx.shadowOffsetX = -5;
                ctx.shadowOffsetY = 20;
                ctx.drawImage(skin, skinX, skinY, skinWidth, skinHeight);
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                // Key light reflection (luz cálida lateral derecha)
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = 0.08;
                const keyLight = ctx.createLinearGradient(skinX + skinWidth, skinY, skinX, skinY + skinHeight);
                keyLight.addColorStop(0, 'rgba(255, 240, 200, 1)');
                keyLight.addColorStop(1, 'rgba(255, 240, 200, 0)');
                ctx.fillStyle = keyLight;
                ctx.fillRect(skinX + skinWidth * 0.6, skinY, skinWidth * 0.4, skinHeight);
                ctx.restore();

                // Fill light (luz azul tenue lateral izquierda)
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = 0.06;
                const fillLight = ctx.createLinearGradient(skinX, skinY, skinX + skinWidth * 0.4, skinY + skinHeight);
                fillLight.addColorStop(0, 'rgba(100, 180, 255, 1)');
                fillLight.addColorStop(1, 'rgba(100, 180, 255, 0)');
                ctx.fillStyle = fillLight;
                ctx.fillRect(skinX, skinY, skinWidth * 0.4, skinHeight);
                ctx.restore();

            } catch (error) {
                console.error('Failed to load player skin:', error);
                // Fallback a crafatar si visage falla
                try {
                    const fallbackSkin = await loadImage(`https://crafatar.com/renders/body/${uuid}?scale=15&overlay`);
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    ctx.shadowBlur = 40;
                    ctx.shadowOffsetX = -5;
                    ctx.shadowOffsetY = 20;
                    ctx.drawImage(fallbackSkin, skinX, skinY, skinWidth, skinHeight);
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                } catch (err) {
                    ctx.fillStyle = '#1a1f3a';
                    roundRect(ctx, skinX, skinY, skinWidth, skinHeight, 15);
                    ctx.fill();
                }
            }

            // ========== HEADER PANEL (Player Name & Rank) ==========

            const eloColor = getEloColor(playerStats.elo || 1000);
            drawPanel(ctx, 50, 50, 1300, 150, `${eloColor}33`);

            // ===== LÍNEA SUPERIOR: USERNAME CON EFECTO NEÓN MEJORADO =====
            const userName = playerName || playerStats.name;

            // Outer glow (más intenso)
            ctx.shadowColor = eloColor;
            ctx.shadowBlur = 25;
            ctx.fillStyle = eloColor;
            ctx.font = 'bold 68px Arial, sans-serif';
            ctx.fillText(userName, 360, 115);

            // Second layer glow (borde suave)
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffffff';
            ctx.fillText(userName, 360, 115);

            // Inner bright core
            ctx.shadowBlur = 5;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(userName, 360, 115);

            ctx.shadowBlur = 0;

            // ===== LÍNEA INFERIOR: VICTORY RANK | TIER =====
            let xPosition = 360;

            // Victory Rank (rango de nivel) - con mejor contraste
            ctx.shadowColor = 'rgba(200, 220, 255, 0.6)';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#e0f0ff';
            ctx.font = 'bold 32px Arial, sans-serif';
            ctx.fillText(playerStats.victory_rank || 'Bridge Novato', xPosition, 165);
            ctx.shadowBlur = 0;

            // Medir el ancho del victory rank para posicionar el tier
            const victoryRankWidth = ctx.measureText(playerStats.victory_rank || 'Bridge Novato').width;
            xPosition += victoryRankWidth + 40; // 40px de espacio

            // Tier Test Rank (si existe) - con efecto dorado brillante
            if (playerStats.tier_test_rank && playerStats.tier_test_rank !== 'N/A') {
                const tierText = `[${playerStats.tier_test_rank}]`;

                // Outer gold glow
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 15;
                ctx.fillStyle = '#ffd700';
                ctx.font = 'bold 32px Arial, sans-serif';
                ctx.fillText(tierText, xPosition, 165);

                // Inner bright
                ctx.shadowBlur = 5;
                ctx.fillStyle = '#ffed4e';
                ctx.fillText(tierText, xPosition, 165);

                ctx.shadowBlur = 0;
            }

            // ========== ELO & RANK PANEL (Top Right Corner) CON DEGRADADO ==========

            // Panel especial para ELO con degradado azulado
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 25;
            ctx.shadowOffsetY = 8;

            roundRect(ctx, 1150, 70, 180, 110, 20);
            const eloGradient = ctx.createLinearGradient(1150, 70, 1150, 180);
            eloGradient.addColorStop(0, 'rgba(30, 60, 100, 0.85)');
            eloGradient.addColorStop(1, 'rgba(15, 30, 60, 0.9)');
            ctx.fillStyle = eloGradient;
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // Borde con glow
            ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner shadow (sombra interior)
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            roundRect(ctx, 1152, 72, 176, 30, 18);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            ctx.restore();

            // ELO número grande con glow
            ctx.textAlign = 'center';
            ctx.shadowColor = eloColor;
            ctx.shadowBlur = 15;
            ctx.fillStyle = eloColor;
            ctx.font = 'bold 48px Arial, sans-serif';
            ctx.fillText(playerStats.elo || 1000, 1240, 125);

            ctx.shadowBlur = 5;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(playerStats.elo || 1000, 1240, 125);
            ctx.shadowBlur = 0;

            // Label "ELO" con mejor contraste
            ctx.fillStyle = '#a0b8d0';
            ctx.font = '20px Arial, sans-serif';
            ctx.fillText('ELO', 1240, 160);
            ctx.textAlign = 'left';

            // ========== STATS PANELS (Grid Layout) ==========

            // Calcular ratios
            const kdRatio = playerStats.deaths > 0 ? (playerStats.kills / playerStats.deaths).toFixed(2) : playerStats.kills;
            const wlRatio = playerStats.losses > 0 ? (playerStats.wins / playerStats.losses).toFixed(2) : playerStats.wins;
            const winRate = playerStats.games_played > 0 ? ((playerStats.wins / playerStats.games_played) * 100).toFixed(1) : 0;

            // Panel 1: Victorias y Derrotas
            drawPanel(ctx, 420, 250, 280, 200);
            ctx.fillStyle = '#00ff88';
            ctx.font = 'bold 56px Arial, sans-serif';
            ctx.fillText(playerStats.wins || 0, 440, 315);
            ctx.fillStyle = '#b0c8e0';
            ctx.font = '22px Arial, sans-serif';
            ctx.fillText('VICTORIAS', 440, 345);

            ctx.fillStyle = '#ff4757';
            ctx.font = 'bold 40px Arial, sans-serif';
            ctx.fillText(playerStats.losses || 0, 440, 405);
            ctx.fillStyle = '#a8c0d8';
            ctx.font = '20px Arial, sans-serif';
            ctx.fillText('Derrotas', 440, 430);

            // Panel 2: W/L Ratio
            drawPanel(ctx, 730, 250, 280, 200);
            ctx.fillStyle = '#00d9ff';
            ctx.font = 'bold 56px Arial, sans-serif';
            ctx.fillText(wlRatio, 750, 315);
            ctx.fillStyle = '#b0c8e0';
            ctx.font = '22px Arial, sans-serif';
            ctx.fillText('W/L RATIO', 750, 345);

            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 40px Arial, sans-serif';
            ctx.fillText(`${winRate}%`, 750, 405);
            ctx.fillStyle = '#c0d5e8';
            ctx.font = '20px Arial, sans-serif';
            ctx.fillText('Win Rate', 750, 430);

            // Panel 3: K/D y Kills
            drawPanel(ctx, 1040, 250, 280, 200);
            ctx.fillStyle = '#ff6b9d';
            ctx.font = 'bold 56px Arial, sans-serif';
            ctx.fillText(kdRatio, 1060, 315);
            ctx.fillStyle = '#b0c8e0';
            ctx.font = '22px Arial, sans-serif';
            ctx.fillText('K/D RATIO', 1060, 345);

            ctx.fillStyle = '#ff9999';
            ctx.font = 'bold 40px Arial, sans-serif';
            ctx.fillText(playerStats.kills || 0, 1060, 405);
            ctx.fillStyle = '#a8c0d8';
            ctx.font = '20px Arial, sans-serif';
            ctx.fillText('Asesinatos', 1060, 430);

            // Panel 4: Goles y Muertes
            drawPanel(ctx, 420, 480, 280, 200);
            ctx.fillStyle = '#00ffff';
            ctx.font = 'bold 56px Arial, sans-serif';
            ctx.fillText(playerStats.goals || 0, 440, 545);
            ctx.fillStyle = '#b0c8e0';
            ctx.font = '22px Arial, sans-serif';
            ctx.fillText('GOLES', 440, 575);

            ctx.fillStyle = '#b0b0b0';
            ctx.font = 'bold 40px Arial, sans-serif';
            ctx.fillText(playerStats.deaths || 0, 440, 635);
            ctx.fillStyle = '#a8c0d8';
            ctx.font = '20px Arial, sans-serif';
            ctx.fillText('Muertes', 440, 660);

            // Panel 5: Racha y XP
            drawPanel(ctx, 730, 480, 280, 200);

            if (playerStats.win_streak && playerStats.win_streak > 0) {
                ctx.fillStyle = '#ffdd00';
                ctx.font = 'bold 56px Arial, sans-serif';
                ctx.fillText(`${playerStats.win_streak}`, 750, 545);
                ctx.fillStyle = '#b0c8e0';
                ctx.font = '22px Arial, sans-serif';
                ctx.fillText('RACHA ACTUAL', 750, 575);
            } else {
                ctx.fillStyle = '#888';
                ctx.font = 'bold 40px Arial, sans-serif';
                ctx.fillText('0', 750, 545);
                ctx.fillStyle = '#a8c0d8';
                ctx.font = '22px Arial, sans-serif';
                ctx.fillText('RACHA ACTUAL', 750, 575);
            }

            ctx.fillStyle = '#9d4edd';
            ctx.font = 'bold 40px Arial, sans-serif';
            ctx.fillText(playerStats.xp || 0, 750, 635);
            ctx.fillStyle = '#c0d5e8';
            ctx.font = '20px Arial, sans-serif';
            ctx.fillText('Experiencia', 750, 660);

            // Panel 6: Mejor Racha y Partidas
            drawPanel(ctx, 1040, 480, 280, 200);

            if (playerStats.best_win_streak && playerStats.best_win_streak > 0) {
                ctx.fillStyle = '#ff9500';
                ctx.font = 'bold 56px Arial, sans-serif';
                ctx.fillText(`${playerStats.best_win_streak}`, 1060, 545);
                ctx.fillStyle = '#b0c8e0';
                ctx.font = '22px Arial, sans-serif';
                ctx.fillText('MEJOR RACHA', 1060, 575);
            } else {
                ctx.fillStyle = '#888';
                ctx.font = 'bold 40px Arial, sans-serif';
                ctx.fillText('0', 1060, 545);
                ctx.fillStyle = '#a8c0d8';
                ctx.font = '22px Arial, sans-serif';
                ctx.fillText('MEJOR RACHA', 1060, 575);
            }

            ctx.fillStyle = '#00d9ff';
            ctx.font = 'bold 40px Arial, sans-serif';
            ctx.fillText(playerStats.games_played || 0, 1060, 635);
            ctx.fillStyle = '#c0d5e8';
            ctx.font = '20px Arial, sans-serif';
            ctx.fillText('Partidas', 1060, 660);

            // ========== FOOTER ==========

            ctx.fillStyle = '#4a5568';
            ctx.font = '18px Arial, sans-serif';

            if (!useMinecraftNick && discordUser) {
                ctx.fillText(`Vinculado a: ${discordUser.tag}`, 50, 760);
            } else if (useMinecraftNick) {
                ctx.fillText(`Consultado por nickname`, 50, 760);
            }

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'stats.png' });

            await interaction.reply({ files: [attachment] });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'An error occurred while fetching the stats.', flags: 64 });
        }
    },
};
