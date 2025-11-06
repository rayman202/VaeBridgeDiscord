# Database Connection Troubleshooting

## Common Issues

### 1. ETIMEDOUT Error
**Cause**: Bot cannot connect to the database server

**Solutions**:
- ✅ Check that database server is running
- ✅ Verify `.env` file has correct credentials
- ✅ Ensure database allows remote connections (if not localhost)
- ✅ Check firewall settings
- ✅ Verify database port (default: 3306) is open

### 2. ECONNREFUSED Error
**Cause**: Connection actively refused by database server

**Solutions**:
- ✅ Database server may be down
- ✅ Wrong port number
- ✅ Wrong host address

### 3. ER_NO_SUCH_TABLE Error
**Cause**: Required table doesn't exist

**Solutions**:
- ✅ Make sure TheBridge plugin has run at least once
- ✅ Check that both bot and plugin use the SAME database
- ✅ Restart Minecraft server to create missing tables

## Database Setup Checklist

1. **Install TheBridge plugin** on Minecraft server
2. **Start Minecraft server** (creates all tables automatically)
3. **Copy `.env.example` to `.env`** in bot directory
4. **Edit `.env`** with your database credentials:
   - `DB_HOST`: Database server address (e.g., `localhost` or `mysql.example.com`)
   - `DB_PORT`: Database port (usually `3306`)
   - `DB_USER`: Database username
   - `DB_PASSWORD`: Database password
   - `DB_NAME`: Database name (e.g., `s99457_VaeBridge`)
5. **Test connection**: Run bot and check for "✅ Database connection successful"

## Required Tables

The bot requires these tables (created by TheBridge plugin):
- ✅ `players` (or view `player_stats`)
- ✅ `discord_links`
- ✅ `pending_notifications`
- ✅ `tier_test_requests`
- ✅ `tier_test_history`

## Remote Database Configuration

If your database is on a remote server:

1. **Enable remote connections** in MySQL:
   ```sql
   GRANT ALL PRIVILEGES ON database_name.* TO 'username'@'%' IDENTIFIED BY 'password';
   FLUSH PRIVILEGES;
   ```

2. **Update firewall** to allow port 3306

3. **Update `.env`** with remote host address

## Connection Settings

The bot uses these optimized connection settings:
- **Connection timeout**: 30 seconds
- **Query timeout**: 60 seconds
- **Connection pool**: 10 connections
- **Auto-reconnect**: Enabled with 3 retries
- **Keep-alive**: Enabled

## Testing Connection

Run the bot and look for this message:
```
✅ Database connection successful
   Host: localhost
   Database: s99457_VaeBridge
```

If you see an error, check the error message and follow the solutions above.
