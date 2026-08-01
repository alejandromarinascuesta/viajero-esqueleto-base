-- Esquema y datos semilla · plataforma de recomendacion
-- Pegar entero en el editor SQL de Supabase

create table if not exists experiencias (
  id                 text primary key,
  nombre             text not null,
  destino            text not null,
  pais               text not null,
  lat                numeric not null,
  lon                numeric not null,
  tipo               text not null,
  precio_desde_pp    integer not null,
  noches             integer not null,
  temporada_agencia  text not null,
  horas_vuelo        numeric not null,
  visado             text not null,
  apto_ninos         text not null,
  intensidad         integer not null,
  margen_pct         integer not null,
  cupo               integer not null,
  motivo_1           text,
  motivo_2           text,
  motivo_3           text,
  no_recomendado_si  text,
  iata               text,
  creado_en          timestamptz default now()
);

-- Todas las fuentes externas aterrizan aqui con la misma forma.
create table if not exists senales (
  id           bigserial primary key,
  fuente       text not null check (fuente in ('catalogo','trends','interes','clima','divisa','ine','vuelos','reservas','eventos','calendario')),
  destino_id   text not null references experiencias(id) on delete cascade,
  periodo      text not null,
  metrica      text not null,
  valor        numeric,
  valor_bruto  jsonb,
  obtenido_en  timestamptz not null default now(),
  estado       text not null default 'ok' check (estado in ('ok','obsoleta','no_disponible')),
  unique (fuente, destino_id, periodo, metrica)
);
create index if not exists idx_senales_destino_periodo on senales (destino_id, periodo);

create table if not exists pesos (
  clave      text primary key,
  valor      integer not null,
  editado_en timestamptz default now()
);

create table if not exists vetos (
  id         bigserial primary key,
  destino_id text references experiencias(id) on delete cascade,
  mes        integer,
  motivo     text,
  activo     boolean default true
);

create table if not exists recomendaciones (
  id            bigserial primary key,
  perfil        jsonb not null,
  candidatas    integer not null,
  supervivientes integer not null,
  propuestas    jsonb not null,
  traza         jsonb,
  creado_en     timestamptz default now()
);

create table if not exists descartes (
  id                bigserial primary key,
  recomendacion_id  bigint references recomendaciones(id) on delete cascade,
  destino_id        text references experiencias(id),
  motivo_agente     text,
  creado_en         timestamptz default now()
);

insert into pesos (clave, valor) values
  ('encaje_cliente', 5), ('demanda', 2), ('margen', 3), ('campana', 2), ('cupo', 1)
on conflict (clave) do nothing;

insert into experiencias (id,nombre,destino,pais,lat,lon,tipo,precio_desde_pp,noches,temporada_agencia,horas_vuelo,visado,apto_ninos,intensidad,margen_pct,cupo,motivo_1,motivo_2,motivo_3,no_recomendado_si,iata) values
('EXP01','Mallorca en familia - Playa de Muro','Mallorca','España',39.80,3.13,'playa',690,7,'4-10',1.0,'no','alto',1,18,24,'Playa de arena poco profunda ideal para niños pequeños','Vuelo de una hora sin escalas','Hotel con club infantil y media pensión','','PMI'),
('EXP02','Ibiza sin niños - Cala Llonga','Ibiza','España',38.95,1.43,'playa',620,4,'5-10',1.0,'no','bajo',3,22,12,'Hotel solo adultos con piscina infinita','Calas tranquilas lejos del ruido del centro','Escapada corta que cabe en un puente','familias con niños','IBZ'),
('EXP03','Tenerife Sur todo incluido','Tenerife','España',28.05,-16.72,'playa',750,7,'1-12',3.0,'no','alto',20,20,30,'Buen tiempo garantizado los doce meses del año','Todo incluido sin gastos sorpresa','Parques acuáticos y de animales a veinte minutos','','TCI'),
('EXP04','Gran Canaria en invierno - Maspalomas','Gran Canaria','España',27.75,-15.58,'playa',680,7,'10-4',3.0,'no','alto',1,19,26,'Veintidós grados en pleno enero','Paseo marítimo llano y accesible','Dunas y playa enorme sin masificar en temporada baja','','LPA'),
('EXP05','San Sebastián gastronómico','San Sebastián','España',43.32,-1.98,'ciudad',540,3,'5-9',1.0,'no','medio',2,24,10,'Ruta de pintxos guiada incluida','Ciudad que se recorre andando','Playa urbana en el centro','presupuesto ajustado','EAS'),
('EXP06','Picos de Europa - senderismo','Picos de Europa','España',43.19,-4.85,'naturaleza',590,5,'6-9',0.0,'no','medio',4,21,14,'Rutas señalizadas de dificultad media','Alojamiento rural con cocina local','Se llega en coche sin depender de vuelos','movilidad reducida',null),
('EXP07','Sevilla monumental','Sevilla','España',37.39,-5.99,'cultural',390,3,'3-5',1.0,'no','medio',2,23,18,'Alcázar y Catedral con entradas incluidas','La opción más económica del catálogo','Bien conectada en tren de alta velocidad','julio y agosto por calor extremo','SVQ'),
('EXP08','Costa del Sol en familia - Marbella','Marbella','España',36.51,-4.89,'playa',720,7,'5-10',1.5,'no','alto',1,19,22,'Apartamentos con cocina para familias largas','Paseo marítimo de quince kilómetros','Parques temáticos a media hora','','AGP'),
('EXP09','Lisboa escapada','Lisboa','Portugal',38.72,-9.14,'ciudad',450,3,'1-12',1.5,'no','medio',2,22,20,'Vuelo directo de hora y media','Ciudad barata para comer y moverse','Miradores y tranvía histórico','movilidad reducida por las cuestas','LIS'),
('EXP10','Roma clásica','Roma','Italia',41.90,12.50,'cultural',690,4,'3-6',2.5,'no','medio',3,21,16,'Coliseo y Vaticano con acceso sin cola','Todo el centro histórico se hace andando','Vuelos directos varias veces al día','julio y agosto por calor y masificación','ROM'),
('EXP11','París romántico','París','Francia',48.86,2.35,'ciudad',820,4,'4-10',2.0,'no','medio',2,23,14,'Hotel en el Marais con encanto','Cena en crucero por el Sena incluida','Museos de primer nivel en cualquier época','presupuesto ajustado','PAR'),
('EXP12','Ámsterdam en primavera','Ámsterdam','Países Bajos',52.37,4.90,'ciudad',640,3,'4-9',2.5,'no','medio',2,22,12,'Canales y museos concentrados en poco espacio','Ciudad totalmente llana ideal para caminar','Escapada de tres noches que cunde','','AMS'),
('EXP13','Santorini','Santorini','Grecia',36.42,25.43,'playa',1250,6,'5-10',3.5,'no','bajo',2,26,10,'Hotel con vistas a la caldera','Puestas de sol reconocidas mundialmente','Ambiente tranquilo de pareja','familias con niños pequeños','JTR'),
('EXP14','Creta en familia - Chania','Creta','Grecia',35.51,24.02,'playa',980,7,'5-10',3.5,'no','alto',2,23,18,'Playas de aguas poco profundas y cálidas','Hotel con club infantil y cocina mediterránea','Historia minoica a media hora en coche','','CHQ'),
('EXP15','Praga histórica','Praga','Chequia',50.08,14.44,'cultural',520,4,'4-10',3.0,'no','medio',2,24,16,'Uno de los centros históricos mejor conservados de Europa','Precios bajos en comida y transporte','Mercados navideños en diciembre','','PRG'),
('EXP16','Islandia - auroras y naturaleza','Islandia','Islandia',64.13,-21.90,'naturaleza',1480,5,'9-3',4.5,'no','bajo',4,25,8,'Auroras boreales en temporada','Círculo Dorado y baños geotermales','Paisajes que no existen en ningún otro sitio de Europa','familias con niños pequeños;movilidad reducida','REK'),
('EXP17','Puglia auténtica','Puglia','Italia',40.79,17.10,'cultural',1050,7,'5-9',3.0,'no','alto',3,24,12,'Trulli de Alberobello y pueblos blancos','Cocina italiana lejos del turismo masivo','Playas del Adriático tranquilas','','BRI'),
('EXP18','Madeira - senderismo y flores','Madeira','Portugal',32.75,-16.96,'naturaleza',820,6,'1-12',3.5,'no','medio',3,23,14,'Levadas y rutas de senderismo todo el año','Clima suave los doce meses','Isla pequeña y fácil de recorrer','movilidad reducida','FNC'),
('EXP19','Croacia - islas de Dalmacia','Dalmacia','Croacia',43.51,16.44,'aventura',1320,7,'6-9',3.0,'no','medio',3,25,10,'Navegación entre islas incluida','Aguas transparentes del Adriático','Split y Dubrovnik en el mismo viaje','movilidad reducida','SPU'),
('EXP20','Nueva York esencial','Nueva York','Estados Unidos',40.71,-74.01,'ciudad',1680,6,'1-12',8.0,'esta','medio',3,20,12,'La ciudad funciona igual de bien en cualquier estación','Metro que llega a todas partes','Museos y espectáculos de primer nivel','presupuesto ajustado','NYC'),
('EXP21','Riviera Maya todo incluido','Riviera Maya','México',20.63,-87.07,'playa',1750,8,'11-5',10.0,'no','alto',1,22,16,'Todo incluido de verdad sin extras','Caribe con agua a veintiocho grados','Cenotes y ruinas mayas en excursión','','CUN'),
('EXP22','Marrakech exprés','Marrakech','Marruecos',31.63,-8.01,'cultural',690,4,'10-4',3.0,'no','medio',3,26,14,'Riad tradicional en la medina','Cambio cultural máximo a tres horas de vuelo','Excursión al desierto de un día','julio y agosto por calor extremo','RAK'),
('EXP23','Bali - arrozales y playas','Bali','Indonesia',-8.41,115.19,'naturaleza',2150,10,'4-10',16.0,'no','bajo',3,27,8,'Combina interior de arrozales y costa','Relación calidad precio muy alta una vez allí','Cultura y templos muy distintos a Europa','niños menores de seis años por duración del vuelo','DPS'),
('EXP24','Dubái - lujo y desierto','Dubái','Emiratos',25.20,55.27,'ciudad',1590,5,'11-3',7.0,'no','medio',2,24,10,'Hoteles de gama alta a precio contenido en temporada','Safari por el desierto incluido','Escala cómoda con vuelo directo','julio y agosto por calor extremo','DXB'),
('EXP25','Tailandia - norte y playas','Tailandia','Tailandia',13.76,100.50,'aventura',2290,12,'11-3',14.0,'no','bajo',3,26,8,'Dos viajes en uno entre norte cultural y sur de playa','Coste diario muy bajo sobre el terreno','Itinerario probado con traslados resueltos','niños menores de ocho años','BKK'),
('EXP26','Japón - ruta clásica','Japón','Japón',35.68,139.69,'cultural',3450,12,'3-4',14.0,'no','medio',4,21,6,'Tokio Kioto y Osaka con tren bala incluido','Cerezos en flor en primavera','Destino de una vez en la vida','presupuesto ajustado;movilidad reducida','TYO'),
('EXP27','Costa Rica - naturaleza y volcanes','Costa Rica','Costa Rica',9.75,-83.75,'naturaleza',2480,10,'12-4',12.0,'no','medio',4,25,8,'Volcanes selva y dos océanos en un solo viaje','Guías locales especializados en fauna','Infraestructura turística muy rodada','movilidad reducida','SJO'),
('EXP28','Maldivas - luna de miel','Maldivas','Maldivas',3.20,73.22,'playa',2850,7,'11-4',11.0,'no','bajo',1,28,6,'Villa sobre el agua con acceso directo al mar','Privacidad total para parejas','Snorkel en arrecife desde el propio alojamiento','familias con niños','MLE'),
('EXP29','Zanzíbar - playa y safari','Zanzíbar','Tanzania',-6.16,39.20,'aventura',2400,9,'6-10',10.0,'si','medio',3,26,6,'Safari en Serengeti combinado con playa','Fauna en su mejor temporada de junio a octubre','Combinación difícil de montar por cuenta propia','niños menores de seis años','ZNZ'),
('EXP30','Egipto - Nilo y pirámides','Egipto','Egipto',30.04,31.24,'cultural',1290,8,'10-4',4.5,'si','medio',3,27,10,'Crucero por el Nilo con pensión completa','Guía egiptólogo en español','Historia sin comparación posible','julio y agosto por calor extremo','CAI')
on conflict (id) do nothing;
