#!/bin/bash
# =====================================================
# SCRIPT DE ACTUALIZACIÓN - VAEBRIDGE DISCORD BOT
# =====================================================
# Este script actualiza el bot con todas las nuevas funciones

echo "======================================"
echo "  VaeBridge Discord Bot - Actualización"
echo "======================================"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: No se encuentra package.json${NC}"
    echo "Por favor ejecuta este script desde el directorio /home/isaac/VaeBridgeDiscord"
    exit 1
fi

echo -e "${YELLOW}1. Deteniendo el bot...${NC}"
pm2 stop BridgeStatsBot

echo ""
echo -e "${YELLOW}2. Obteniendo últimos cambios del repositorio...${NC}"
git pull origin claude/minecraft-stats-display-011JBgF6nZLfAwV3CK264Jma

echo ""
echo -e "${YELLOW}3. Instalando dependencias...${NC}"
npm install

echo ""
echo -e "${YELLOW}4. Actualizando base de datos...${NC}"
echo "Ingresa la contraseña de MySQL cuando se te solicite"
mysql -u root -p bridge_stats < DATABASE_UPDATES.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Base de datos actualizada correctamente${NC}"
else
    echo -e "${RED}❌ Error al actualizar la base de datos${NC}"
    echo "Intenta ejecutar manualmente:"
    echo "mysql -u root -p bridge_stats < DATABASE_UPDATES.sql"
fi

echo ""
echo -e "${YELLOW}5. Desplegando comandos de Discord...${NC}"
npm run deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Comandos desplegados correctamente${NC}"
else
    echo -e "${RED}❌ Error al desplegar comandos${NC}"
    echo "Intenta ejecutar manualmente:"
    echo "npm run deploy"
fi

echo ""
echo -e "${YELLOW}6. Reiniciando el bot...${NC}"
pm2 restart BridgeStatsBot

echo ""
echo -e "${YELLOW}7. Mostrando logs...${NC}"
sleep 2
pm2 logs BridgeStatsBot --lines 30 --nostream

echo ""
echo -e "${GREEN}======================================"
echo "  ✅ ACTUALIZACIÓN COMPLETADA"
echo "======================================${NC}"
echo ""
echo "Nuevas funciones disponibles:"
echo "  • /stats rediseñado con mejor aspecto"
echo "  • /setup-leaderboard - Configurar leaderboards automáticos"
echo "  • /setup-tickets - Sistema de tickets de ayuda"
echo ""
echo "Para ver los logs en tiempo real:"
echo "  pm2 logs BridgeStatsBot"
echo ""
echo "Para reiniciar el bot manualmente:"
echo "  pm2 restart BridgeStatsBot"
echo ""
