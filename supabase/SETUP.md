# Configuración de Supabase - Linisco Dashboard

## 📋 Pasos de Configuración

### 1. Ejecutar el Schema de Base de Datos

1. Ve a tu proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor**
3. Ejecuta el contenido de `schema-v2.sql`

### 2. Configurar Tablas de Migración Automática

1. En **SQL Editor**, ejecuta el contenido de `cron-setup.sql`
2. Esto creará:
   - Tabla `migration_logs` para registro de migraciones
   - Tabla `migration_checkpoints` para tracking por local
   - Vistas útiles para monitoreo

### 3. Configurar la Edge Function

1. Ve a **Edge Functions** en el menú lateral
2. Click en "Create a new function"
3. Nombre: `migrate-sales`
4. Pega el contenido de `edge-function-code.ts`
5. Click en **Deploy**
6. Ve a **Settings > Edge Functions > migrate-sales**
7. **Desactiva** "Enforce JWT Verification"

### 4. Agregar Secrets (Credenciales de Locales)

En **Settings > Edge Functions > Secrets**, agrega:

```
LINISCO_SC = {"user":{"email":"66220@linisco.com.ar","password":"TU_PASSWORD"}}
LINISCO_SL = {"user":{"email":"63953@linisco.com.ar","password":"TU_PASSWORD"}}
LINISCO_SO = {"user":{"email":"72267@linisco.com.ar","password":"TU_PASSWORD"}}
LINISCO_DO = {"user":{"email":"10019@linisco.com.ar","password":"TU_PASSWORD"}}
LINISCO_DL = {"user":{"email":"30036@linisco.com.ar","password":"TU_PASSWORD"}}
LINISCO_DC = {"user":{"email":"30038@linisco.com.ar","password":"TU_PASSWORD"}}
LINISCO_SE = {"user":{"email":"10020@linisco.com.ar","password":"TU_PASSWORD"}}
LINISCO_SJ = {"user":{"email":"75248@linisco.com.ar","password":"TU_PASSWORD"}}
```

### 5. Configurar el Cron Job (Sync cada 15 min)

#### Opción A: Usando Supabase Cron (Recomendado para Pro)

1. Ve a **SQL Editor**
2. Ejecuta:

```sql
-- Habilitar pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Crear el cron job
SELECT cron.schedule(
    'migrate-sales-every-15min',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://TU-PROYECTO.supabase.co/functions/v1/migrate-sales',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer TU_ANON_KEY"}'::jsonb,
        body := '{"mode": "auto"}'::jsonb
    );
    $$
);
```

Reemplaza:
- `TU-PROYECTO` con tu ID de proyecto
- `TU_ANON_KEY` con tu anon key (Settings > API)

#### Opción B: Usando un servicio externo (Free tier)

Si estás en el free tier, podés usar:
- [cron-job.org](https://cron-job.org) (gratis)
- [EasyCron](https://www.easycron.com/) 
- GitHub Actions

Configurar para hacer POST cada 15 minutos a:
```
https://TU-PROYECTO.supabase.co/functions/v1/migrate-sales
```
Con body: `{"mode": "auto"}`

### 6. Configurar Autenticación (Login)

1. Ve a **Authentication > Providers > Email**
2. Asegurate que esté habilitado
3. **Desactiva** "Allow new users to sign up" (para que solo vos puedas crear usuarios)
4. Ve a **Authentication > Users**
5. Click en **Add user**
6. Crea tu usuario con email y contraseña

### 7. Variables de Entorno del Dashboard

En tu archivo `.env` del dashboard (o en Vercel):

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

---

## 🔄 Modos de Migración

### Modo Automático (Cron cada 15 min)
- Se ejecuta automáticamente
- Sincroniza la última hora de datos
- Solo órdenes y productos (no sesiones)
- Usa upsert para evitar duplicados
- Registra en `migration_logs`

### Modo Manual (Desde el dashboard)
- Especificás rango de fechas
- Sincroniza órdenes, productos Y sesiones
- Útil para migraciones históricas

---

## 📊 Monitoreo

### Ver últimas migraciones
```sql
SELECT * FROM ultimas_migraciones;
```

### Ver estado por local
```sql
SELECT * FROM estado_sincronizacion;
```

### Ver errores recientes
```sql
SELECT * FROM migration_logs 
WHERE status = 'error' 
ORDER BY started_at DESC 
LIMIT 10;
```

---

## 🏪 Locales Configurados

| Key | Código | Nombre |
|-----|--------|--------|
| SC | 66220 | Subway Corrientes |
| SL | 63953 | Subway Lacroze |
| SO | 72267 | Subway Ortiz |
| DO | 10019 | Daniel Ortiz |
| DL | 30036 | Daniel Lacroze |
| DC | 30038 | Daniel Corrientes |
| SE | 10020 | Seitu Juramento |
| SJ | 75248 | Subway Juramento |

---

## ❓ Troubleshooting

### La migración automática no funciona
1. Verificá que la Edge Function esté deployada
2. Verificá que JWT verification esté desactivado
3. Revisá los logs en Edge Functions > Logs

### Error de autenticación en un local
1. Verificá el secret `LINISCO_XX` correspondiente
2. Asegurate que el JSON esté bien formado
3. Probá las credenciales en la API directamente

### Los datos no aparecen en el dashboard
1. Verificá que el usuario tenga sesión activa
2. Revisá las políticas RLS de las tablas
3. Chequeá el rango de fechas seleccionado

