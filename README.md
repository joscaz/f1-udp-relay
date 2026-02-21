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

## Uso

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
