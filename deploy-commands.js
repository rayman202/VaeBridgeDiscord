
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

        // Create tier_test_results table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tier_test_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                minecraft_uuid VARCHAR(36) NOT NULL,
                tier_rank VARCHAR(64),
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                posted_to_leaderboard TINYINT(1) DEFAULT 0,
                INDEX idx_posted (posted_to_leaderboard)
            );
        `);

        // Create leaderboard_config table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leaderboard_config (
                guild_id VARCHAR(64) PRIMARY KEY,
                normal_channel_id VARCHAR(64),
                high_channel_id VARCHAR(64)
            );
        `);
        
        console.log('Tables created successfully.');

    } catch (error) {
        console.error(error);
    }
})();
