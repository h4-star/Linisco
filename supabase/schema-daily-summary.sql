-- =============================================
-- TABLA DE RESUMEN DIARIO DE VENTAS
-- Soluciona el límite de 1000 registros de Supabase
-- =============================================

-- Crear tabla de resumen diario
CREATE TABLE IF NOT EXISTS daily_sales_summary (
    id BIGSERIAL PRIMARY KEY,
    sale_date DATE NOT NULL,
    shop_name TEXT NOT NULL,
    total_sales DECIMAL(12, 2) DEFAULT 0,
    total_tickets INTEGER DEFAULT 0,
    total_cash DECIMAL(12, 2) DEFAULT 0,
    total_card DECIMAL(12, 2) DEFAULT 0,
    total_mercadopago DECIMAL(12, 2) DEFAULT 0,
    total_other DECIMAL(12, 2) DEFAULT 0,
    avg_ticket DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sale_date, shop_name)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_sales_summary(sale_date);
CREATE INDEX IF NOT EXISTS idx_daily_summary_shop ON daily_sales_summary(shop_name);
CREATE INDEX IF NOT EXISTS idx_daily_summary_shop_date ON daily_sales_summary(shop_name, sale_date);

-- Función para actualizar el resumen diario
CREATE OR REPLACE FUNCTION update_daily_sales_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Extraer la fecha de orderDate (puede ser TEXT o TIMESTAMP)
    DECLARE
        order_date DATE;
        date_str TEXT;
    BEGIN
        -- Si orderDate es TEXT, extraer la fecha
        IF NEW."orderDate" IS NOT NULL THEN
            date_str := NEW."orderDate"::TEXT;
            -- Intentar parsear como fecha ISO
            IF date_str ~ '^\d{4}-\d{2}-\d{2}' THEN
                order_date := date_str::DATE;
            ELSIF date_str ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
                -- Formato dd/mm/yyyy
                order_date := TO_DATE(date_str, 'DD/MM/YYYY');
            ELSE
                -- Intentar parsear como timestamp
                BEGIN
                    order_date := NEW."orderDate"::TIMESTAMP::DATE;
                EXCEPTION WHEN OTHERS THEN
                    RETURN NEW;
                END;
            END IF;
        ELSE
            RETURN NEW;
        END IF;

        -- Determinar método de pago
        DECLARE
            payment_cash DECIMAL(12, 2) := 0;
            payment_card DECIMAL(12, 2) := 0;
            payment_mp DECIMAL(12, 2) := 0;
            payment_other DECIMAL(12, 2) := 0;
        BEGIN
            IF NEW.paymentmethod ILIKE '%efectivo%' OR NEW.paymentmethod ILIKE '%cash%' THEN
                payment_cash := NEW.total;
            ELSIF NEW.paymentmethod ILIKE '%tarjeta%' OR NEW.paymentmethod ILIKE '%card%' OR 
                  NEW.paymentmethod ILIKE '%visa%' OR NEW.paymentmethod ILIKE '%master%' THEN
                payment_card := NEW.total;
            ELSIF NEW.paymentmethod ILIKE '%mercado%pago%' OR NEW.paymentmethod ILIKE '%mp%' THEN
                payment_mp := NEW.total;
            ELSE
                payment_other := NEW.total;
            END IF;

            -- Insertar o actualizar el resumen
            INSERT INTO daily_sales_summary (
                sale_date,
                shop_name,
                total_sales,
                total_tickets,
                total_cash,
                total_card,
                total_mercadopago,
                total_other,
                avg_ticket,
                updated_at
            )
            VALUES (
                order_date,
                NEW."shopName",
                NEW.total,
                1,
                payment_cash,
                payment_card,
                payment_mp,
                payment_other,
                NEW.total,
                NOW()
            )
            ON CONFLICT (sale_date, shop_name)
            DO UPDATE SET
                total_sales = daily_sales_summary.total_sales + NEW.total,
                total_tickets = daily_sales_summary.total_tickets + 1,
                total_cash = daily_sales_summary.total_cash + payment_cash,
                total_card = daily_sales_summary.total_card + payment_card,
                total_mercadopago = daily_sales_summary.total_mercadopago + payment_mp,
                total_other = daily_sales_summary.total_other + payment_other,
                avg_ticket = (daily_sales_summary.total_sales + NEW.total) / (daily_sales_summary.total_tickets + 1),
                updated_at = NOW();
        END;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar automáticamente el resumen cuando se inserta una orden
DROP TRIGGER IF EXISTS trigger_update_daily_summary ON sale_orders;
CREATE TRIGGER trigger_update_daily_summary
    AFTER INSERT ON sale_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_sales_summary();

-- Función para recalcular el resumen desde cero (útil para migraciones)
CREATE OR REPLACE FUNCTION recalculate_daily_sales_summary(from_date DATE DEFAULT NULL, to_date DATE DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    rec_count INTEGER;
BEGIN
    -- Limpiar resumen en el rango de fechas si se especifica
    IF from_date IS NOT NULL AND to_date IS NOT NULL THEN
        DELETE FROM daily_sales_summary 
        WHERE sale_date >= from_date AND sale_date <= to_date;
    ELSE
        TRUNCATE TABLE daily_sales_summary;
    END IF;

    -- Recalcular desde sale_orders
    INSERT INTO daily_sales_summary (
        sale_date,
        shop_name,
        total_sales,
        total_tickets,
        total_cash,
        total_card,
        total_mercadopago,
        total_other,
        avg_ticket
    )
    SELECT
        CASE 
            WHEN "orderDate"::TEXT ~ '^\d{4}-\d{2}-\d{2}' THEN ("orderDate"::TEXT)::DATE
            WHEN "orderDate"::TEXT ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN TO_DATE("orderDate"::TEXT, 'DD/MM/YYYY')
            ELSE "orderDate"::TIMESTAMP::DATE
        END as sale_date,
        "shopName" as shop_name,
        SUM(total) as total_sales,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN paymentmethod ILIKE '%efectivo%' OR paymentmethod ILIKE '%cash%' THEN total ELSE 0 END) as total_cash,
        SUM(CASE WHEN paymentmethod ILIKE '%tarjeta%' OR paymentmethod ILIKE '%card%' OR 
                  paymentmethod ILIKE '%visa%' OR paymentmethod ILIKE '%master%' THEN total ELSE 0 END) as total_card,
        SUM(CASE WHEN paymentmethod ILIKE '%mercado%pago%' OR paymentmethod ILIKE '%mp%' THEN total ELSE 0 END) as total_mercadopago,
        SUM(CASE WHEN NOT (paymentmethod ILIKE '%efectivo%' OR paymentmethod ILIKE '%cash%' OR
                           paymentmethod ILIKE '%tarjeta%' OR paymentmethod ILIKE '%card%' OR
                           paymentmethod ILIKE '%visa%' OR paymentmethod ILIKE '%master%' OR
                           paymentmethod ILIKE '%mercado%pago%' OR paymentmethod ILIKE '%mp%') THEN total ELSE 0 END) as total_other,
        AVG(total) as avg_ticket
    FROM sale_orders
    WHERE 
        (from_date IS NULL OR 
         CASE 
             WHEN "orderDate"::TEXT ~ '^\d{4}-\d{2}-\d{2}' THEN ("orderDate"::TEXT)::DATE >= from_date
             WHEN "orderDate"::TEXT ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN TO_DATE("orderDate"::TEXT, 'DD/MM/YYYY') >= from_date
             ELSE "orderDate"::TIMESTAMP::DATE >= from_date
         END)
        AND
        (to_date IS NULL OR 
         CASE 
             WHEN "orderDate"::TEXT ~ '^\d{4}-\d{2}-\d{2}' THEN ("orderDate"::TEXT)::DATE <= to_date
             WHEN "orderDate"::TEXT ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN TO_DATE("orderDate"::TEXT, 'DD/MM/YYYY') <= to_date
             ELSE "orderDate"::TIMESTAMP::DATE <= to_date
         END)
    GROUP BY sale_date, "shopName"
    ON CONFLICT (sale_date, shop_name)
    DO UPDATE SET
        total_sales = EXCLUDED.total_sales,
        total_tickets = EXCLUDED.total_tickets,
        total_cash = EXCLUDED.total_cash,
        total_card = EXCLUDED.total_card,
        total_mercadopago = EXCLUDED.total_mercadopago,
        total_other = EXCLUDED.total_other,
        avg_ticket = EXCLUDED.avg_ticket,
        updated_at = NOW();

    GET DIAGNOSTICS rec_count = ROW_COUNT;
    RETURN rec_count;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS en la tabla de resumen
ALTER TABLE daily_sales_summary ENABLE ROW LEVEL SECURITY;

-- Política para lectura pública
CREATE POLICY "Permitir lectura pública de daily_sales_summary"
    ON daily_sales_summary FOR SELECT
    USING (true);

-- Comentarios
COMMENT ON TABLE daily_sales_summary IS 'Resumen diario de ventas por local para evitar límites de consulta';
COMMENT ON FUNCTION recalculate_daily_sales_summary IS 'Recalcula el resumen diario desde sale_orders. Útil después de migraciones masivas.';
