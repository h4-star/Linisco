-- =============================================
-- CONFIGURACIÓN DE CRON JOB PARA MIGRACIÓN AUTOMÁTICA
-- Linisco Dashboard - Sincronización cada 15 minutos
-- =============================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Ve a SQL Editor
-- 3. Ejecuta este script
-- =============================================

-- Habilitar la extensión pg_cron si no está habilitada
-- (Supabase ya la tiene habilitada por defecto en proyectos Pro)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================
-- TABLA: migration_logs (Registro de migraciones)
-- =============================================
CREATE TABLE IF NOT EXISTS migration_logs (
    id BIGSERIAL PRIMARY KEY,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'running', -- running, success, error
    migration_type TEXT DEFAULT 'scheduled', -- scheduled, manual
    from_date TEXT,
    to_date TEXT,
    orders_migrated INTEGER DEFAULT 0,
    products_migrated INTEGER DEFAULT 0,
    sessions_migrated INTEGER DEFAULT 0,
    error_message TEXT,
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_migration_logs_date ON migration_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_logs_status ON migration_logs(status);

-- Política RLS para migration_logs
ALTER TABLE migration_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on migration_logs" ON migration_logs;
CREATE POLICY "Allow all on migration_logs" ON migration_logs FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- TABLA: migration_checkpoints
-- Guarda el último punto de sincronización por local
-- =============================================
CREATE TABLE IF NOT EXISTS migration_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    shop_key TEXT UNIQUE NOT NULL,
    shop_name TEXT,
    last_order_date TEXT,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    orders_count INTEGER DEFAULT 0,
    products_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_shop ON migration_checkpoints(shop_key);

ALTER TABLE migration_checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on migration_checkpoints" ON migration_checkpoints;
CREATE POLICY "Allow all on migration_checkpoints" ON migration_checkpoints FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- FUNCIÓN: Llamar a la Edge Function de migración
-- =============================================
-- NOTA: Esta función usa pg_net para llamar a la edge function
-- Primero habilitamos pg_net

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Función que será llamada por el cron
CREATE OR REPLACE FUNCTION trigger_migration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    edge_function_url TEXT;
    service_role_key TEXT;
BEGIN
    -- Obtener la URL del proyecto
    -- Nota: Reemplazar con tu URL real o usar secrets
    edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/migrate-sales';
    
    -- Llamar a la edge function (modo automático, sin parámetros = última hora)
    PERFORM net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('mode', 'auto')
    );
    
    -- Registrar el intento
    INSERT INTO migration_logs (migration_type, status)
    VALUES ('scheduled', 'triggered');
    
END;
$$;

-- =============================================
-- VISTAS ÚTILES
-- =============================================

-- Vista de últimas migraciones
CREATE OR REPLACE VIEW ultimas_migraciones AS
SELECT 
    id,
    started_at,
    finished_at,
    status,
    migration_type,
    from_date,
    to_date,
    orders_migrated,
    products_migrated,
    sessions_migrated,
    CASE 
        WHEN finished_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (finished_at - started_at))::INTEGER 
        ELSE NULL 
    END as duration_seconds,
    error_message
FROM migration_logs
ORDER BY started_at DESC
LIMIT 50;

-- Vista de estado de sincronización por local
CREATE OR REPLACE VIEW estado_sincronizacion AS
SELECT 
    mc.shop_key,
    mc.shop_name,
    mc.last_order_date,
    mc.last_sync_at,
    mc.orders_count,
    mc.products_count,
    NOW() - mc.last_sync_at as tiempo_desde_sync
FROM migration_checkpoints mc
ORDER BY mc.last_sync_at DESC;

-- =============================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =============================================
COMMENT ON TABLE migration_logs IS 'Registro de todas las migraciones ejecutadas (manuales y automáticas)';
COMMENT ON TABLE migration_checkpoints IS 'Último punto de sincronización por cada local';
COMMENT ON FUNCTION trigger_migration IS 'Función que dispara la edge function de migración';

-- =============================================
-- CRON JOB: Ejecutar cada 15 minutos
-- =============================================
-- NOTA: Ejecuta esta parte SOLO si tenés plan Pro de Supabase
-- Si estás en el free tier, usá un servicio externo como cron-job.org
--
-- Antes de ejecutar, reemplazá:
--   - 'tu-proyecto' con tu project ID
--   - 'TU_ANON_KEY' con tu anon key de Supabase
--
-- Para obtener estos valores: Settings > API
-- =============================================

-- Descomentar las siguientes líneas cuando tengas los valores correctos:

-- SELECT cron.schedule(
--     'migrate-sales-cron',
--     '*/15 * * * *',
--     $$
--     SELECT net.http_post(
--         url := 'https://tu-proyecto.supabase.co/functions/v1/migrate-sales',
--         headers := '{"Content-Type": "application/json", "Authorization": "Bearer TU_ANON_KEY"}'::jsonb,
--         body := '{"mode": "auto"}'::jsonb
--     );
--     $$
-- );
