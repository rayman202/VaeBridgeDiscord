# 🎮 Nuevas Funciones - VaeBridge Discord Bot

## 📋 Resumen de Mejoras

Este documento describe todas las nuevas funciones implementadas en el bot de Discord para VaeBridge.

---

## ✨ 1. Comando `/stats` Mejorado

### 🎨 Mejoras Visuales

- **Personaje 3D**: Ahora muestra un render 3D completo del jugador usando `visage.surgeplay.com`
- **Diseño Premium**: Tarjeta completamente rediseñada con:
  - Colores dinámicos basados en el tier del jugador
  - Secciones organizadas con separadores visuales
  - Emojis específicos por tier (👑 GT, 💎 HT, ⭐ MT, 🔥 LT)
  - Barras de progreso para win rate
  - Formato de números mejorado (1K, 1M, etc.)

### 📊 Secciones del Embed

1. **Rangos y Clasificación**
   - Rango de Victorias
   - Tier Test con emoji dinámico
   - ELO Rating

2. **Rendimiento General**
   - Partidas Jugadas
   - Victorias y Derrotas
   - Win Rate con barra de progreso visual
   - W/L Ratio
   - Racha Actual y Mejor Racha

3. **Estadísticas de Combate**
   - Asesinatos y Muertes
   - K/D Ratio
   - Goles Anotados
   - Nexus Destruidos

### 🎨 Sistema de Colores por Tier

- **GT (God Tier)**: Rojo brillante (#FF0000) - 👑
- **HT (High Tier)**: Naranja rojizo (#FF6B35) - 💎
- **MT (Mid Tier)**: Dorado (#FFD700) - ⭐
- **LT (Low Tier)**:
  - LT1-LT3: Verde brillante (#00FF88) - 🔥
  - LT4-LT6: Cian (#00D9FF) - 🔥
  - LT7+: Púrpura (#9D4EDD) - 🔥

---

## 🔗 2. Auto-Renombrado en Discord

### ⚡ Función Automática

Cuando un jugador vincula su cuenta de Minecraft con Discord usando `/link`, el bot automáticamente:

1. ✅ Cambia su nickname en Discord a su nombre de Minecraft
2. ✅ Aplica en todos los servidores donde está el bot
3. ✅ Respeta permisos (no cambia el nickname del dueño del servidor)

### 🔧 Implementación

- Se ejecuta automáticamente al completar el comando `/link` en Minecraft
- Usa el sistema de notificaciones (`notificationHandler.js`)
- Requiere permiso "Manage Nicknames" en el servidor

---

## 📊 3. Sistema de Leaderboards Automáticos

### 🎯 Características

El sistema de leaderboards muestra automáticamente los resultados de tier tests en canales específicos.

### 📝 Comandos

#### `/setup-leaderboard`
Configura los canales de leaderboard (solo administradores).

**Parámetros:**
- `canal_resultados`: Canal para TODOS los resultados de tier tests
- `canal_resultados_altos`: Canal solo para resultados ALTOS (>LT1)

**Ejemplo de uso:**
```
/setup-leaderboard canal_resultados:#resultados canal_resultados_altos:#resultados-altos
```

### 🏆 Tipos de Leaderboard

#### 📊 Resultados Normales
- Muestra **todos** los tier test completados
- Incluye todos los tiers (LT1+, MT, HT, GT)
- Se actualiza automáticamente cada vez que alguien completa un tier test

#### 🏆 Resultados Altos
- Muestra **solo** resultados altos (mayores a LT1)
- Incluye: LT2, LT3, LT4+, MT, HT, GT
- Ideal para destacar los mejores jugadores

### 🎨 Formato del Embed

Cada resultado muestra:
- 👤 Nombre del jugador con avatar
- 🎯 Tier alcanzado
- 🏆 División (God Tier, High Tier, etc.)
- 📅 Fecha del test (formato relativo)
- 📊 Rango de victorias actual
- 🧠 ELO actual
- ✅ Total de victorias

### ⚙️ Sistema Automático

- Se actualiza cada **20 segundos**
- No requiere intervención manual
- Se activa cuando se completa un tier test en el servidor de Minecraft

---

## 🎫 4. Sistema de Tickets de Soporte

### 🔧 Configuración

#### `/setup-tickets`
Configura el sistema de tickets (solo administradores).

**Parámetros:**
- `canal`: Canal donde se mostrará el botón para crear tickets

**Ejemplo de uso:**
```
/setup-tickets canal:#soporte
```

### 📩 Cómo Funciona

1. **Usuario crea ticket**:
   - Hace clic en el botón "📩 Crear Ticket de Ayuda"
   - Se crea automáticamente un canal privado

2. **Permisos del canal**:
   - ✅ Usuario que creó el ticket
   - ✅ Administradores
   - ✅ Moderadores
   - ✅ Dueños del servidor
   - ❌ Otros usuarios (no pueden ver el canal)

3. **Cierre del ticket**:
   - Botón "🔒 Cerrar Ticket"
   - Solo puede cerrar: staff o el usuario que lo creó
   - Se elimina el canal automáticamente después de 5 segundos

### 📋 Casos de Uso

- Reportar bugs o problemas
- Solicitar ayuda con comandos
- Hacer preguntas al staff
- Reportar jugadores
- Sugerencias o feedback

---

## 🗄️ 5. Actualizaciones de Base de Datos

### 📊 Nuevas Tablas

#### `leaderboard_config`
Almacena la configuración de canales de leaderboard por servidor.

```sql
CREATE TABLE leaderboard_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL UNIQUE,
    normal_channel_id VARCHAR(20),
    high_channel_id VARCHAR(20),
    updated_at TIMESTAMP,
    created_at TIMESTAMP
);
```

#### `tier_test_results`
Almacena resultados de tier tests para el leaderboard.

```sql
CREATE TABLE tier_test_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    minecraft_uuid VARCHAR(36) NOT NULL,
    tier_rank VARCHAR(10) NOT NULL,
    tier_division VARCHAR(20),
    completed_at TIMESTAMP,
    posted_to_leaderboard TINYINT(1) DEFAULT 0
);
```

### 🔄 Migración

Para aplicar las actualizaciones de base de datos:

```bash
mysql -u tu_usuario -p tu_base_de_datos < DATABASE_UPDATES.sql
```

---

## 🚀 Instalación y Configuración

### 1. Actualizar Base de Datos
```bash
mysql -u root -p bridge_stats < DATABASE_UPDATES.sql
```

### 2. Desplegar Nuevos Comandos
```bash
npm run deploy
```

### 3. Reiniciar el Bot
```bash
npm start
```

### 4. Configurar en Discord

1. **Leaderboards**:
   ```
   /setup-leaderboard canal_resultados:#resultados canal_resultados_altos:#resultados-altos
   ```

2. **Tickets**:
   ```
   /setup-tickets canal:#soporte
   ```

---

## 📝 Notas Técnicas

### Sistemas Automáticos

El bot ejecuta dos sistemas en segundo plano:

1. **NotificationHandler** (cada 15 segundos):
   - Procesa vinculaciones de cuentas
   - Cambia nicknames automáticamente
   - Asigna roles de rango

2. **LeaderboardHandler** (cada 20 segundos):
   - Busca nuevos resultados de tier tests
   - Publica en canales configurados
   - Diferencia entre resultados normales y altos

### Archivos Modificados

- ✅ `src/commands/stats.js` - Comando mejorado
- ✅ `src/commands/setup-leaderboard.js` - Nuevo
- ✅ `src/commands/setup-tickets.js` - Nuevo
- ✅ `src/utils/leaderboardHandler.js` - Nuevo
- ✅ `src/utils/notificationHandler.js` - Ya existía
- ✅ `src/index.js` - Actualizado con nuevos handlers

---

## 🎉 Resumen de Funciones

| Función | Descripción | Automática |
|---------|-------------|------------|
| 📊 Stats Mejorado | Render 3D y diseño premium | ❌ |
| 🔗 Auto-Rename | Cambia nickname a nombre MC | ✅ |
| 📊 Leaderboard Normal | Todos los tier tests | ✅ |
| 🏆 Leaderboard Alto | Solo resultados >LT1 | ✅ |
| 🎫 Sistema Tickets | Soporte con canales privados | ❌ |

---

## 🔧 Troubleshooting

### El bot no cambia nicknames
- Verificar que tenga permiso "Manage Nicknames"
- Verificar que el rol del bot esté por encima del rol del usuario

### Los leaderboards no se actualizan
- Verificar que exista la tabla `tier_test_results`
- Verificar que el plugin de Minecraft esté insertando datos correctamente
- Revisar logs del bot para errores

### Los tickets no se crean
- Verificar que el bot tenga permiso "Manage Channels"
- Verificar que existan roles con "admin" o "mod" en el nombre

---

## 📞 Soporte

Si tienes problemas con las nuevas funciones, revisa:
1. Logs del bot (`npm start`)
2. Permisos del bot en Discord
3. Configuración de base de datos
4. Que hayas ejecutado `/setup-leaderboard` y `/setup-tickets`

¡Disfruta de las nuevas funciones! 🎮
