# Configuración de Tabla de Resumen Diario

Esta tabla soluciona el límite de 1000 registros de Supabase al crear un resumen diario de ventas que se actualiza automáticamente.

## Pasos para Configurar

### 1. Ejecutar el Schema SQL

1. Ve a tu proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor**
3. Copia y pega el contenido de `schema-daily-summary.sql`
4. Ejecuta el script

### 2. Recalcular el Resumen Histórico

Después de crear la tabla, necesitas recalcular el resumen con los datos existentes:

```sql
-- Recalcular todo el historial
SELECT recalculate_daily_sales_summary();

-- O recalcular un rango específico de fechas
SELECT recalculate_daily_sales_summary('2025-01-01'::DATE, '2025-12-31'::DATE);
```

### 3. Verificar que Funciona

```sql
-- Ver algunos registros del resumen
SELECT * FROM daily_sales_summary 
ORDER BY sale_date DESC 
LIMIT 10;

-- Verificar que los totales coinciden
SELECT 
    sale_date,
    shop_name,
    total_tickets,
    total_sales
FROM daily_sales_summary
WHERE sale_date >= '2025-01-01'
ORDER BY sale_date DESC;
```

## ¿Cómo Funciona?

1. **Trigger Automático**: Cada vez que se inserta una orden en `sale_orders`, se actualiza automáticamente el resumen diario.

2. **Uso en el Dashboard**: El hook `useSalesData` ahora:
   - Primero intenta usar `daily_sales_summary` (sin límite de registros)
   - Si no existe, usa `sale_orders` con paginación
   - Reconstruye las órdenes desde el resumen para compatibilidad con los gráficos

3. **Ventajas**:
   - ✅ Sin límite de 1000 registros
   - ✅ Consultas más rápidas
   - ✅ Datos agregados listos para usar
   - ✅ Se actualiza automáticamente

## Mantenimiento

Si necesitas recalcular el resumen después de una migración masiva:

```sql
SELECT recalculate_daily_sales_summary();
```

## Notas

- La tabla se actualiza automáticamente cuando se insertan nuevas órdenes
- Los datos históricos necesitan ser recalculados manualmente la primera vez
- El resumen incluye: total de ventas, tickets, métodos de pago, y ticket promedio por día y local
