-- Registro de consumo de IA. Es el histórico que la ventana en memoria no puede
-- guardar: en serverless el proceso muere entre peticiones.
create table if not exists consumo_ia (
  id bigserial primary key,
  traza text not null,
  tipo text not null check (tipo in ('perfil','argumento','guion','voz')),
  modelo text not null,
  ok boolean not null,
  ms integer not null,
  tokens_entrada integer,
  tokens_salida integer,
  caracteres integer,
  coste numeric(12,6) not null,
  error text,
  momento timestamptz not null default now()
);
create index if not exists consumo_ia_momento on consumo_ia (momento desc);
create index if not exists consumo_ia_tipo on consumo_ia (tipo, momento desc);
