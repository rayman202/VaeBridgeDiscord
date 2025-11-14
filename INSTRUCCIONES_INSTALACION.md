# 🚀 Instrucciones de Instalación - VaeBridge Discord Bot

## ⚡ Método Rápido (Recomendado)

Ejecuta estos comandos en tu servidor (`/home/isaac/VaeBridgeDiscord`):

```bash
# Dar permisos de ejecución al script
chmod +x update.sh

# Ejecutar el script de actualización
./update.sh
```

El script hará todo automáticamente. Cuando te pida la contraseña de MySQL, ingrésala.

---

## 🔧 Método Manual (Paso a Paso)

Si prefieres hacerlo manualmente o si el script automático falla:

### 1. Detener el Bot

```bash
pm2 stop BridgeStatsBot
```

### 2. Actualizar el Código

```bash
cd /home/isaac/VaeBridgeDiscord
git pull origin claude/minecraft-stats-display-011JBgF6nZLfAwV3CK264Jma
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Actualizar Base de Datos

**IMPORTANTE:** Este paso crea las nuevas tablas necesarias.

```bash
mysql -u root -p bridge_stats < DATABASE_UPDATES.sql
```

Cuando te pida la contraseña, ingresa tu contraseña de MySQL root.

**Si usas otro usuario de MySQL:**
```bash
mysql -u TU_USUARIO -p bridge_stats < DATABASE_UPDATES.sql
```

### 5. Desplegar Comandos de Discord

**CRÍTICO:** Este paso registra los nuevos comandos `/setup-leaderboard` y `/setup-tickets` en Discord.

```bash
npm run deploy
```

Deberías ver algo como:
```
Started refreshing application (/) commands.
Successfully reloaded application (/) commands.
```

### 6. Reiniciar el Bot

```bash
pm2 restart BridgeStatsBot
```

### 7. Verificar que Funciona

```bash
# Ver los logs
pm2 logs BridgeStatsBot --lines 50

# Deberías ver:
# ✅ Notification handler system started
# ✅ Leaderboard handler system started
# ¡ÉXITO! Bot conectado como [nombre del bot]
```

---

## ✅ Verificación

### En Discord:

1. **Verifica que los comandos aparezcan:**
   - Escribe `/` en cualquier canal
   - Deberías ver: `/setup-leaderboard` y `/setup-tickets`

2. **Prueba el comando `/stats` mejorado:**
   - `/stats` (tus propias stats)
   - Deberías ver el nuevo diseño sin "###" y más bonito

### Configura los Nuevos Sistemas:

#### Leaderboards:
```
/setup-leaderboard canal_resultados:#resultados canal_resultados_altos:#resultados-altos
```

#### Tickets:
```
/setup-tickets canal:#soporte
```

---

## ❌ Solución de Problemas

### Problema 1: "Comandos no aparecen al escribir /"

**Solución:**
```bash
# Ejecuta de nuevo
npm run deploy

# Espera 1-2 minutos (Discord puede tardar en actualizar)
# También prueba en modo incógnito o recarga Discord (Ctrl+R)
```

### Problema 2: "Table 'tier_test_results' doesn't exist"

**Solución:**
```bash
# Ejecuta el SQL de nuevo
mysql -u root -p bridge_stats < DATABASE_UPDATES.sql

# Verifica que se creó
mysql -u root -p bridge_stats -e "SHOW TABLES;"

# Deberías ver tier_test_results y leaderboard_config
```

### Problema 3: "Invalid ELF header" o errores con canvas

**Solución:**
```bash
# Reinstalar canvas
cd /home/isaac/VaeBridgeDiscord
rm -rf node_modules/canvas
npm install canvas

# Si sigue fallando, instala dependencias del sistema:
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm rebuild canvas
```

### Problema 4: El bot no inicia

**Solución:**
```bash
# Ver los logs completos
pm2 logs BridgeStatsBot --lines 100

# Si hay errores, copia el error y búscalo
```

### Problema 5: "Ignoring invalid configuration option"

Esto es solo un **warning**, no un error. El bot funcionará correctamente.

---

## 🎯 Nuevas Funciones Disponibles

Después de la instalación tendrás:

### ✨ `/stats` Mejorado
- Diseño completamente renovado
- Sin "###" que se veían mal
- Personaje 3D del jugador
- Colores dinámicos según tier
- Soporte para prefix de LuckPerms
- Eliminado "Nexus Destruidos"
- Mejor organización de estadísticas

### 📊 `/setup-leaderboard`
- Configura canales para mostrar resultados de tier tests
- Actualización automática cada 20 segundos
- Dos tipos: resultados normales y resultados altos

### 🎫 `/setup-tickets`
- Sistema de tickets privados de ayuda
- Botones para crear/cerrar tickets
- Permisos automáticos para staff

---

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs: `pm2 logs BridgeStatsBot`
2. Verifica que la base de datos se actualizó: `mysql -u root -p bridge_stats -e "SHOW TABLES;"`
3. Verifica que los comandos se desplegaron: `npm run deploy`

---

## 🔄 Comandos Útiles

```bash
# Ver estado del bot
pm2 status

# Ver logs en tiempo real
pm2 logs BridgeStatsBot

# Reiniciar bot
pm2 restart BridgeStatsBot

# Detener bot
pm2 stop BridgeStatsBot

# Iniciar bot
pm2 start BridgeStatsBot
```

---

¡Disfruta las nuevas funciones! 🎉
