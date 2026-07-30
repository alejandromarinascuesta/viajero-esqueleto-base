# Desplegar sin Lovable

El repositorio no depende de Lovable. Es una aplicación estándar de TanStack
Start con Postgres detrás: `npm install && npm run build` produce una salida que
corre en Vercel, Cloudflare, Netlify o un servidor propio.

Lovable se usa como editor y como host de conveniencia, no como dependencia.
Esto importa en la entrevista: la portabilidad no es una promesa, se comprueba.

## El objetivo de compilación se elige por configuración, no por código

La configuración de Lovable fija nitro en **Cloudflare** por defecto. Para
Vercel basta con una variable de entorno de compilación, que ya viene puesta en
`vercel.json`:

```json
{ "buildCommand": "NITRO_PRESET=vercel npm run build", "framework": null }
```

Con ella, la compilación genera `.vercel/output`, que es la estructura nativa de
Vercel (Build Output API v3). Sin ella, genera un Worker de Cloudflare. **El
mismo repositorio sirve para los dos hosts a la vez** y `vercel.json` no afecta
a Lovable, que lo ignora.

## Variables de entorno

| Variable | Para qué | Secreta |
|---|---|---|
| `SUPABASE_URL` | base de datos, lado servidor | no |
| `SUPABASE_SERVICE_ROLE_KEY` | acceso de servidor, salta RLS | **sí** |

El cliente de navegador de Supabase no se usa: todo el acceso a datos pasa por
funciones de servidor. Por eso las variables `VITE_SUPABASE_*` son irrelevantes
en este despliegue.

Y opcionalmente, para el modelo de lenguaje:

| Variable | Para qué |
|---|---|
| `IA_API_KEY` | clave propia de cualquier proveedor compatible con OpenAI |
| `IA_URL` | endpoint de chat completions, si no es OpenAI |
| `IA_MODELO` | identificador del modelo |

**El proveedor del modelo es intercambiable por diseño.** Si existe
`IA_API_KEY`, se usa esa. Si no, la pasarela del host. Si no hay ninguna, las
tres funciones que llaman al modelo devuelven null y la aplicación **sigue
funcionando**: el motor recomienda igual y los argumentos caen a los tres
motivos del catálogo.

Eso es lo que quiere decir que la IA está en los bordes y no en el centro: se
puede desenchufar y el producto no se cae. Lo único que se pierde es la
redacción del argumento y la extracción de notas.

## Pasos

1. **Base de datos**: ejecutar `data/seed_catalogo.sql` en un proyecto Postgres
   nuevo. Crea las seis tablas y carga las 30 experiencias.
2. **Importar el repositorio** en el host. En Vercel no hay que configurar
   nada: `vercel.json` ya fija el comando de compilación y el framework.
3. **Configurar las variables** de la tabla de arriba.
4. Desplegar. Sin pasos manuales.

## Qué NO se lleva consigo

- La ingesta programada. Aquí la dispara un botón; en producción debería ser un
  trabajo nocturno del propio host (cron de Vercel, Workers Cron).
- El histórico de recomendaciones y descartes vive en la base de datos y se
  migra con ella.
