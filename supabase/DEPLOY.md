# Guía de Despliegue de Edge Function

## Requisitos Previos

1. Tener instalado Supabase CLI:
```bash
npm install -g supabase
```

2. Iniciar sesión en Supabase:
```bash
supabase login
```

3. Vincular con tu proyecto:
```bash
supabase link --project-ref TU_PROJECT_REF
```

Tu project ref está en la URL de Supabase: `https://supabase.com/dashboard/project/TU_PROJECT_REF`

## Configurar Secretos

Las credenciales de Linisco se configuran como secretos en Supabase.

### Opción A: Desde el Dashboard
1. Ve a [supabase.com](https://supabase.com) → Tu proyecto
2. Settings → Edge Functions → Secrets
3. Agrega cada credencial:
   - Name: `LINISCO_SC`
   - Value: `{"user":{"email":"66220@linisco.com.ar","password":"tu-password"}}`
4. Repetir para cada local (SC, SL, SO, DO, DL, DC, SE, SJ)

### Opción B: Desde CLI
```bash
supabase secrets set LINISCO_SC='{"user":{"email":"66220@linisco.com.ar","password":"xxx"}}'
supabase secrets set LINISCO_SL='{"user":{"email":"63953@linisco.com.ar","password":"xxx"}}'
supabase secrets set LINISCO_SO='{"user":{"email":"72267@linisco.com.ar","password":"xxx"}}'
supabase secrets set LINISCO_DO='{"user":{"email":"10019@linisco.com.ar","password":"xxx"}}'
supabase secrets set LINISCO_DL='{"user":{"email":"30036@linisco.com.ar","password":"xxx"}}'
supabase secrets set LINISCO_DC='{"user":{"email":"30038@linisco.com.ar","password":"xxx"}}'
supabase secrets set LINISCO_SE='{"user":{"email":"10020@linisco.com.ar","password":"xxx"}}'
supabase secrets set LINISCO_SJ='{"user":{"email":"75248@linisco.com.ar","password":"xxx"}}'
```

## Desplegar la Función

Desde la carpeta `supabase/`:

```bash
cd supabase
supabase functions deploy migrate-sales
```

## Probar la Función

### Desde curl:
```bash
curl -X POST 'https://TU_PROJECT_REF.supabase.co/functions/v1/migrate-sales' \
  -H 'Authorization: Bearer TU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"fromDate": "01/12/2025", "toDate": "24/12/2025"}'
```

### Desde el Dashboard:
Ve a Edge Functions → migrate-sales → Logs para ver la ejecución.

## Uso desde el Frontend

Una vez desplegada, el botón "Migrar Datos" del dashboard la llamará automáticamente.

## Troubleshooting

### Error: "No credentials for..."
Las credenciales no están configuradas como secrets. Revisa el paso "Configurar Secretos".

### Error: "Auth failed: 401"
La credencial tiene formato incorrecto o el password es inválido.

### Error en inserción
Asegúrate de haber ejecutado el `schema.sql` en el SQL Editor de Supabase.

