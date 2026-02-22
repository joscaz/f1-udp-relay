# Formula Delta Relay

Programa que transmite la telemetría de EA F1 25 al servidor de Formula Delta.

## Requisitos

- Node.js 16 o superior
- EA F1 25 corriendo en esta PC

## Configuración del juego (HACER ANTES DE CADA CARRERA)

1. Abre EA F1 25
2. Ve a **Game Options → Settings → UDP Telemetry Settings**
3. Configura:
   - UDP Telemetry: **On**
   - UDP Broadcast Mode: **Off**
   - UDP IP Address: **127.0.0.1**
   - UDP Port: **20777**
   - UDP Send Rate: **20Hz**
   - Your Telemetry: **Public** ← IMPORTANTE
   - Show online Names: **On** ← IMPORTANTE

## Instalación (solo la primera vez)

```bash
pnpm install
cp .env.example .env
# Edita .env con los valores que te dio el admin del torneo
```

## Uso en producción

Antes de que empiece la carrera, abre una terminal y corre:

```bash
pnpm start
```

Verás esto cuando esté funcionando:
```
[WS] ✅ Conectado al server
[UDP] Escuchando en 0.0.0.0:20777
[UDP] Esperando datos de EA F1 25...
```

Para detener: `Ctrl+C`

## Desarrollo local

Para probar sin conectarte al server de producción necesitas **dos terminales**.

### 1. Levantar el servidor local de prueba (puerto 3003)

```bash
pnpm local-server
```

```
╔════════════════════════════════════════╗
║    Local Test Server                   ║
║    ws://localhost:3003                  ║
╚════════════════════════════════════════╝
```

### 2. Correr el relay con hot-reload (puerto 3004 no aplica, escucha UDP en 20777)

```bash
pnpm dev
```

```
[WS] ✅ Conectado al server
[UDP] Escuchando en 0.0.0.0:20777
```

### .env para desarrollo local

```
SERVER_URL=ws://localhost:3003
RELAY_TOKEN=tu_token
UDP_PORT=20777
```

### Flujo

```
EA F1 25 → UDP :20777 → [relay (pnpm dev)] → WS → [local-server :3003] → logs en consola
```

### Scripts disponibles

| Comando | Descripción |
|---|---|
| `pnpm start` | Relay en producción (conecta al server de Railway) |
| `pnpm dev` | Relay con hot-reload via nodemon |
| `pnpm local-server` | Servidor WebSocket local para pruebas (puerto 3003) |
| `pnpm test` | Test básico del header parser |
