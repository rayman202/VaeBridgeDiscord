/**
 * Database Connection Diagnostic Tool
 * Run this to test your database connection before starting the bot
 *
 * Usage: node test-connection.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const REQUIRED_TABLES = [
    'players',
    'discord_links',
    'pending_notifications',
    'tier_test_requests',
    'tier_test_history',
    'victory_ranks'
];

async function testConnection() {
    console.log('\n🔍 Database Connection Diagnostic Tool\n');
    console.log('=' .repeat(50));

    // Step 1: Validate environment variables
    console.log('\n1️⃣  Checking environment variables...');
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missingVars = requiredVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
        console.error('   ❌ Missing variables:', missingVars.join(', '));
        console.error('   Please check your .env file');
        return;
    }

    console.log('   ✅ All required environment variables are set');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Port: ${process.env.DB_PORT || 3306}`);
    console.log(`   User: ${process.env.DB_USER}`);
    console.log(`   Database: ${process.env.DB_NAME}`);

    // Step 2: Test connection
    console.log('\n2️⃣  Testing database connection...');
    let pool;
    try {
        pool = mysql.createPool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectTimeout: 10000
        });

        const connection = await pool.getConnection();
        console.log('   ✅ Connection successful!');
        connection.release();
    } catch (error) {
        console.error('   ❌ Connection failed:', error.message);
        console.error('\n   Common causes:');
        console.error('   - Database server is not running');
        console.error('   - Wrong credentials in .env file');
        console.error('   - Firewall blocking connection');
        console.error('   - Database server not allowing remote connections');
        return;
    }

    // Step 3: Check required tables
    console.log('\n3️⃣  Checking required tables...');
    try {
        for (const table of REQUIRED_TABLES) {
            const [rows] = await pool.query(
                `SELECT COUNT(*) as count FROM information_schema.tables
                 WHERE table_schema = ? AND table_name = ?`,
                [process.env.DB_NAME, table]
            );

            if (rows[0].count > 0) {
                console.log(`   ✅ ${table}`);
            } else {
                console.error(`   ❌ ${table} (missing)`);
            }
        }
    } catch (error) {
        console.error('   ❌ Error checking tables:', error.message);
    }

    // Step 4: Check player_stats view
    console.log('\n4️⃣  Checking player_stats view...');
    try {
        const [rows] = await pool.query(
            `SELECT COUNT(*) as count FROM information_schema.views
             WHERE table_schema = ? AND table_name = 'player_stats'`,
            [process.env.DB_NAME]
        );

        if (rows[0].count > 0) {
            console.log('   ✅ player_stats view exists');
        } else {
            console.warn('   ⚠️  player_stats view not found');
            console.warn('   This is okay if you just set up the database');
            console.warn('   Start TheBridge plugin once to create it');
        }
    } catch (error) {
        console.error('   ❌ Error checking view:', error.message);
    }

    // Step 5: Test query
    console.log('\n5️⃣  Testing sample query...');
    try {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM players');
        console.log(`   ✅ Query successful - ${rows[0].count} players in database`);
    } catch (error) {
        console.error('   ❌ Query failed:', error.message);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Diagnostic complete!\n');
    console.log('If all checks passed, your bot should work correctly.');
    console.log('If any checks failed, fix the issues and run this test again.\n');

    await pool.end();
}

testConnection().catch(console.error);
