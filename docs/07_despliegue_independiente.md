# Desplegar sin Lovable

El repositorio no depende de Lovable. Es una aplicación estándar de TanStack
Start con Postgres detrás: `npm install && npm run build` produce una salida
nitro que corre en Vercel, Cloudflare, Netlify o un servidor propio.

Lovable se usa como editor y como host de conveniencia, no como dependencia.
Esto importa en la entrevista: la portabilidad no es una promesa, se comprueba.

## Las cuatro variables de entorno

| Variable | Para qué | De dónde sale |
|---|---|---|
| `SUPABASE_URL` | base de datos | panel del proyecto → API |
| `SUPABASE_SERVICE_ROLE_KEY` | acceso servidor, salta RLS | panel del proyecto → API (**secreta**) |
| `VITE_SUPABASE_URL` | cliente | la misma URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | cliente | clave publicable, no es secreta |

Y opcionalmente, para el modelo de lenguaje:

| Variable | Para qué |
|---|---|
| `IA_API_KEY` | clave propia de cualquier proveedor compatible con OpenAI |
| `IA_URL` | endpoint de chat completions, si no es OpenAI |
| `IA_MODELO` | identificador del modelo |

**El proveedor del modelo es intercambiable por diseño.** Si existe
`IA_API_KEY`, se usa esa. Si no, se usa la pasarela del host. Si no hay
ninguna, las tres funciones que llaman al modelo devuelven null y la aplicación
**sigue funcionando**: el motor recomienda igual y los argumentos caen a los
tres motivos del catálogo.

Eso es lo que quiere decir que la IA está en los bordes y no en el centro: se
puede desenchufar y el producto no se cae. Lo único que se pierde es la
redacción y la extracción de notas.

## Pasos

1. Base de datos: ejecutar `data/seed_catalogo.sql` en un proyecto Postgres
   nuevo. Crea las seis tablas y carga las 30 experiencias.
2. Configurar las cuatro variables en el host.
3. Conectar el repositorio y desplegar. Sin pasos manuales.

## Qué NO se lleva consigo

- La ingesta programada. En Lovable la dispara un botón; en producción debería
  ser un trabajo nocturno del propio host (cron de Vercel, Workers Cron).
- El histórico de recomendaciones y descartes, que vive en la base de datos y
  se migra con ella.
