# Stats Command Update - Discord Bot

## Cambios Implementados ✅

El comando `/stats` ha sido actualizado para aceptar **dos parámetros opcionales**:

1. **`discord_user`** - Usuario de Discord (debe tener cuenta vinculada)
2. **`minecraft_nick`** - Nickname de Minecraft del jugador

### Reglas de Uso:

- ✅ Se puede usar **UNO** de los dos parámetros
- ❌ No se pueden usar **ambos** a la vez
- Si no se proporciona ninguno, muestra tus propias stats

### Ejemplos de Uso:

```
/stats                                    → Muestra tus propias stats
/stats discord_user:@Usuario             → Stats del usuario de Discord vinculado
/stats minecraft_nick:Player123          → Stats del jugador por su nick de Minecraft
```

## Nuevas Características

1. **XP Display**: Ahora muestra XP en lugar de "Nivel"
2. **Búsqueda por Nickname**: Permite ver stats de jugadores que no tienen Discord vinculado
3. **Mejores Mensajes de Error**: Mensajes más claros cuando algo falla
4. **Indicador de Búsqueda**: Muestra en el footer si se buscó por nickname o Discord

## Cómo Redesplegar el Bot

### Opción 1: Reiniciar el Bot (Si está corriendo)

1. Detén el bot actual:
   ```bash
   # Si está corriendo en terminal:
   Ctrl + C

   # Si está como servicio:
   pm2 stop bridge-bot
   # o
   pm2 restart bridge-bot
   ```

2. Reinicia el bot:
   ```bash
   cd C:\Users\Isaac\IdeaProjects\BridgeStatsBot
   node src/index.js
   # o si usas start.bat:
   start.bat
   ```

### Opción 2: Redesplegar los Comandos Slash

Si el bot ya está corriendo pero los cambios no aparecen:

```bash
cd C:\Users\Isaac\IdeaProjects\BridgeStatsBot
node deploy-commands.js
```

Esto actualizará los comandos en Discord sin necesidad de reiniciar el bot.

### Opción 3: Desde Cero

```bash
cd C:\Users\Isaac\IdeaProjects\BridgeStatsBot

# Instalar dependencias (si es necesario)
npm install

# Redesplegar comandos
node deploy-commands.js

# Iniciar bot
node src/index.js
```

## Verificación

Una vez redesplegado, verifica que:

1. El comando `/stats` ahora muestra dos opciones:
   - `discord_user` (opcional)
   - `minecraft_nick` (opcional)

2. Prueba estos casos:
   - `/stats` - Tus propias stats
   - `/stats discord_user:@UnUsuario` - Stats de usuario vinculado
   - `/stats minecraft_nick:UnJugador` - Stats por nickname
   - `/stats discord_user:@User minecraft_nick:Player` - Debe dar error

## Notas Importantes

- La tabla `player_stats` debe tener la columna `xp` (ya agregada en el plugin)
- Los jugadores deben haber jugado al menos una vez para aparecer en la búsqueda por nickname
- Si un usuario de Discord no está vinculado, el bot sugerirá usar `/link` o buscar por `minecraft_nick`

## Troubleshooting

### Los cambios no aparecen

1. Asegúrate de haber ejecutado `node deploy-commands.js`
2. Espera 1-5 minutos (Discord puede tardar en actualizar)
3. Reinicia Discord (como cliente)

### Error al buscar por nickname

- Verifica que la tabla se llame `player_stats` (no `players`)
- Asegúrate de que el jugador haya jugado al menos una vez

### Canvas/Image errors

Si hay errores con canvas o imágenes:
```bash
npm install canvas --save
# o si falla:
npm rebuild canvas
```
