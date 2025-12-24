"""
Script de migración de datos desde la API POS Linisco hacia Supabase.

Uso:
    python migrate_to_supabase.py --from-date 01/12/2025 --to-date 24/12/2025
    python migrate_to_supabase.py --from-date 01/12/2025 --to-date 24/12/2025 --shops SC SL
    python migrate_to_supabase.py --list-shops

Requisitos:
    pip install -r requirements.txt

Configuración:
    1. Edita shops_config.json para agregar/modificar locales
    2. Crea .env con las credenciales (ver abajo)

Variables de entorno (.env):
    SUPABASE_URL=https://tu-proyecto.supabase.co
    SUPABASE_KEY=tu-service-role-key
    
    # Credenciales por local (LINISCO_XX donde XX es la key del local)
    LINISCO_SC=tu-password
    LINISCO_SL=tu-password
    ...
"""

import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional

# Fix encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import requests
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

# Configuración de Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

BASE_URL = "https://pos.linisco.com.ar"
CONFIG_FILE = Path(__file__).parent / "shops_config.json"


def load_shops_config() -> dict:
    """Carga la configuración de locales desde el JSON."""
    if not CONFIG_FILE.exists():
        print(f"❌ Error: No se encontró {CONFIG_FILE}")
        print("   Creá el archivo shops_config.json con la configuración de locales")
        return {"shops": []}
    
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def get_shops_dict() -> dict:
    """Convierte la lista de shops a un diccionario por key."""
    config = load_shops_config()
    return {shop["key"]: shop for shop in config.get("shops", [])}


def get_auth_token(email: str, credential: str, debug: bool = False) -> Optional[str]:
    """
    Obtiene el token de autenticación para un local.
    
    credential puede ser:
      - Solo el password: "mi-password"
      - JSON completo: '{"email": "...", "password": "..."}'
    """
    try:
        url = f"{BASE_URL}/users/sign_in"
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
        }
        
        # Limpiar credential de posibles comillas envolventes
        credential_clean = credential.strip()
        if (credential_clean.startswith("'") and credential_clean.endswith("'")) or \
           (credential_clean.startswith('"') and credential_clean.endswith('"')):
            credential_clean = credential_clean[1:-1]
        
        # Intentar parsear como JSON (formato del notebook)
        try:
            cred_data = json.loads(credential_clean)
            if isinstance(cred_data, dict):
                # Es JSON, pasarlo directo (igual que en el notebook)
                data = credential_clean
                if debug:
                    # Mostrar keys sin revelar valores
                    print(f"   [DEBUG] Usando JSON completo, keys: {list(cred_data.keys())}")
            else:
                # No es dict, usar como password
                data = json.dumps({"email": email, "password": credential_clean})
                if debug:
                    print(f"   [DEBUG] JSON no es dict, usando como password")
        except json.JSONDecodeError as e:
            # No es JSON, es solo el password
            data = json.dumps({"email": email, "password": credential_clean})
            if debug:
                print(f"   [DEBUG] No es JSON ({e}), usando email: {email}")
                print(f"   [DEBUG] Valor recibido (primeros 50 chars): {credential_clean[:50]}...")
        
        if debug:
            print(f"   [DEBUG] URL: {url}")
            # Mostrar data sin el password
            try:
                d = json.loads(data)
                print(f"   [DEBUG] Email enviado: {d.get('email', 'N/A')}")
            except:
                pass
        
        response = requests.post(url, headers=headers, data=data)
        
        if response.status_code == 201:
            resp_data = response.json()
            return resp_data.get("authentication_token")
        else:
            print(f"❌ Error de autenticación: {response.status_code}")
            # Mostrar más info para debug
            if response.status_code == 401:
                print(f"   Verifica que las credenciales en .env sean correctas")
                if debug:
                    print(f"   [DEBUG] Response: {response.text[:200]}")
            return None
    except Exception as e:
        print(f"❌ Error en autenticación: {e}")
        return None


def fetch_data(endpoint: str, email: str, token: str, params: dict) -> Optional[pd.DataFrame]:
    """Obtiene datos de un endpoint de la API."""
    try:
        url = f"http://pos.linisco.com.ar/{endpoint}"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-User-Email": email,
            "X-User-Token": token,
        }
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                return pd.DataFrame(data)
            return pd.DataFrame()
        else:
            print(f"❌ Error en {endpoint}: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error obteniendo {endpoint}: {e}")
        return None


def migrate_shop(
    shop_key: str,
    shop_info: dict,
    params: dict,
    supabase: Client
) -> tuple[int, int, int]:
    """Migra datos de un local a Supabase."""
    orders_count = 0
    products_count = 0
    sessions_count = 0
    
    # Obtener credenciales desde variable de entorno
    env_key = f"LINISCO_{shop_key}"
    credential = os.getenv(env_key)
    
    if not credential:
        print(f"⚠️ No hay credenciales para {shop_info['name']}")
        print(f"   Agregá {env_key}=tu-password en el archivo .env")
        print(f"   O en formato JSON: {env_key}='{{\"email\": \"...\", \"password\": \"...\"}}'")
        return 0, 0, 0
    
    email = shop_info["email"]
    
    # Autenticación
    print(f"🔐 Autenticando {shop_info['name']}...")
    # Activar debug si hay variable de entorno DEBUG=1
    debug_mode = os.getenv("DEBUG", "0") == "1"
    token = get_auth_token(email, credential, debug=debug_mode)
    if not token:
        return 0, 0, 0
    
    print(f"✅ Autenticado en {shop_info['name']}")
    
    # Obtener órdenes de venta
    print(f"📦 Obteniendo órdenes de {shop_info['name']}...")
    orders_df = fetch_data("sale_orders", email, token, params)
    
    if orders_df is not None and not orders_df.empty:
        # Agregar información del local
        orders_df["shopNumber"] = shop_info["code"]
        orders_df["shopName"] = shop_info["name"]
        
        # Convertir columnas de fecha a string ISO
        for col in orders_df.columns:
            if 'date' in col.lower() or 'Date' in col:
                orders_df[col] = pd.to_datetime(orders_df[col], errors='coerce').dt.strftime('%Y-%m-%dT%H:%M:%S')
        
        # Preparar datos para inserción
        orders_data = orders_df.to_dict(orient="records")
        
        # Limpiar valores NaN
        for record in orders_data:
            for key in list(record.keys()):
                if pd.isna(record[key]):
                    record[key] = None
        
        # Insertar en Supabase (upsert para evitar duplicados)
        try:
            supabase.table("sale_orders").upsert(
                orders_data,
                on_conflict="idSaleOrder"
            ).execute()
            orders_count = len(orders_data)
            print(f"   ✅ {orders_count} órdenes insertadas")
        except Exception as e:
            print(f"   ❌ Error insertando órdenes: {e}")
    else:
        print(f"   ℹ️ Sin órdenes para este período")
    
    # Obtener productos vendidos
    print(f"🛒 Obteniendo productos de {shop_info['name']}...")
    products_df = fetch_data("sale_products", email, token, params)
    
    if products_df is not None and not products_df.empty:
        products_df["shopName"] = shop_info["name"]
        
        # Quitar columna 'id' si existe (Supabase la genera automáticamente)
        if 'id' in products_df.columns:
            products_df = products_df.drop(columns=['id'])
        
        products_data = products_df.to_dict(orient="records")
        
        # Limpiar valores NaN
        for record in products_data:
            for key in list(record.keys()):
                if pd.isna(record[key]):
                    record[key] = None
        
        try:
            supabase.table("sale_products").insert(
                products_data
            ).execute()
            products_count = len(products_data)
            print(f"   ✅ {products_count} productos insertados")
        except Exception as e:
            print(f"   ❌ Error insertando productos: {e}")
    else:
        print(f"   ℹ️ Sin productos para este período")
    
    # Obtener sesiones POS
    print(f"💰 Obteniendo sesiones de {shop_info['name']}...")
    sessions_df = fetch_data("psessions", email, token, params)
    
    if sessions_df is not None and not sessions_df.empty:
        sessions_df["shopName"] = shop_info["name"]
        
        # Quitar columna 'id' si existe (Supabase la genera automáticamente)
        if 'id' in sessions_df.columns:
            sessions_df = sessions_df.drop(columns=['id'])
        
        # Convertir columnas de fecha
        for col in sessions_df.columns:
            if 'date' in col.lower() or 'Date' in col:
                sessions_df[col] = pd.to_datetime(sessions_df[col], errors='coerce').dt.strftime('%Y-%m-%dT%H:%M:%S')
        
        sessions_data = sessions_df.to_dict(orient="records")
        
        # Limpiar valores NaN
        for record in sessions_data:
            for key in list(record.keys()):
                if pd.isna(record[key]):
                    record[key] = None
        
        try:
            supabase.table("psessions").insert(
                sessions_data
            ).execute()
            sessions_count = len(sessions_data)
            print(f"   ✅ {sessions_count} sesiones insertadas")
        except Exception as e:
            print(f"   ❌ Error insertando sesiones: {e}")
    else:
        print(f"   ℹ️ Sin sesiones para este período")
    
    return orders_count, products_count, sessions_count


def list_shops():
    """Lista todos los locales configurados."""
    shops = get_shops_dict()
    
    print("\n📍 LOCALES CONFIGURADOS")
    print("=" * 60)
    print(f"{'Key':<6} {'Código':<8} {'Nombre':<25} {'Credencial'}")
    print("-" * 60)
    
    for key, shop in shops.items():
        env_key = f"LINISCO_{key}"
        has_cred = "✅" if os.getenv(env_key) else "❌"
        print(f"{key:<6} {shop['code']:<8} {shop['name']:<25} {has_cred} {env_key}")
    
    print("=" * 60)
    print(f"\nTotal: {len(shops)} locales")
    print("\nPara agregar un nuevo local:")
    print("  1. Editá shops_config.json y agregá el nuevo local")
    print("  2. Agregá LINISCO_XX=password en el .env")


def main():
    parser = argparse.ArgumentParser(
        description="Migrar datos de POS Linisco a Supabase",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python migrate_to_supabase.py --list-shops
  python migrate_to_supabase.py --from-date 01/12/2025 --to-date 24/12/2025
  python migrate_to_supabase.py --from-date 01/12/2025 --to-date 24/12/2025 --shops SC SL
        """
    )
    parser.add_argument(
        "--from-date",
        type=str,
        default=datetime.now().strftime("%d/%m/%Y"),
        help="Fecha inicial (dd/mm/yyyy)"
    )
    parser.add_argument(
        "--to-date",
        type=str,
        default=datetime.now().strftime("%d/%m/%Y"),
        help="Fecha final (dd/mm/yyyy)"
    )
    parser.add_argument(
        "--shops",
        type=str,
        nargs="+",
        default=None,
        help="Locales a migrar (ej: SC SL DO). Si no se especifica, migra todos."
    )
    parser.add_argument(
        "--list-shops",
        action="store_true",
        help="Lista todos los locales configurados y sale"
    )
    
    args = parser.parse_args()
    
    # Si solo quiere listar locales
    if args.list_shops:
        list_shops()
        return
    
    # Cargar configuración de locales
    shops = get_shops_dict()
    
    if not shops:
        print("❌ No hay locales configurados en shops_config.json")
        return
    
    # Filtrar locales si se especificaron
    if args.shops:
        selected_shops = {k: v for k, v in shops.items() if k in args.shops}
        invalid = [s for s in args.shops if s not in shops]
        if invalid:
            print(f"⚠️ Locales no encontrados: {', '.join(invalid)}")
            print(f"   Locales válidos: {', '.join(shops.keys())}")
    else:
        selected_shops = shops
    
    print("=" * 60)
    print("🚀 Migración de datos POS Linisco → Supabase")
    print("=" * 60)
    print(f"📅 Desde: {args.from_date}")
    print(f"📅 Hasta: {args.to_date}")
    print(f"🏪 Locales: {', '.join(selected_shops.keys())}")
    print("=" * 60)
    
    # Validar configuración de Supabase
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Error: Configura SUPABASE_URL y SUPABASE_KEY en el archivo .env")
        return
    
    # Conectar a Supabase
    print("🔗 Conectando a Supabase...")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Conectado a Supabase")
    except Exception as e:
        print(f"❌ Error conectando a Supabase: {e}")
        return
    
    # Parámetros de fecha
    params = {
        "fromDate": args.from_date,
        "toDate": args.to_date
    }
    
    # Contadores totales
    total_orders = 0
    total_products = 0
    total_sessions = 0
    
    # Migrar cada local
    for shop_key, shop_info in selected_shops.items():
        print(f"\n{'─' * 40}")
        print(f"🏪 Procesando: {shop_info['name']} ({shop_key})")
        print(f"{'─' * 40}")
        
        orders, products, sessions = migrate_shop(
            shop_key, shop_info, params, supabase
        )
        
        total_orders += orders
        total_products += products
        total_sessions += sessions
    
    # Resumen
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE MIGRACIÓN")
    print("=" * 60)
    print(f"📦 Órdenes de venta: {total_orders}")
    print(f"🛒 Productos vendidos: {total_products}")
    print(f"💰 Sesiones POS: {total_sessions}")
    print("=" * 60)
    print("✅ Migración completada")


if __name__ == "__main__":
    main()
