
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const pool = require('./src/utils/db.js');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./src/commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');

        console.log('Creating tables...');
        // Create bot_settings table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bot_settings (
                guild_id VARCHAR(64) PRIMARY KEY,
                general_channel_id VARCHAR(64),
                highscores_channel_id VARCHAR(64)
            );
        `);
        console.log('Tables created successfully.');

    } catch (error) {
        console.error(error);
    }
})();
