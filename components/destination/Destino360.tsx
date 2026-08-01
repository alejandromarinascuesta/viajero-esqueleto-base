"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import type { DestinoConScore } from "@/components/layout/Shell";
import { Anillo, Kpi, Panel, Vacio } from "@/components/ui";
import { accionRecomendada, pulso } from "@/lib/pulso";
import { senalMomentum, senalesActuales } from "@/lib/signals";

/** Cada fuente con su cadencia real. La frescura no es uniforme, y decirlo vale
 *  mas que fingir que todo es de hace una hora. */
const FUENTE: Record<string, { nombre: string; cadencia: string }> = {
  trends: { nombre: "Demanda Â· Google Trends", cadencia: "CSV real importado Â· 4 semanas vs 4" },
  clima: { nombre: "Clima Â· Open-Meteo", cadencia: "archivo histÃ³rico Â· estable" },
  interes: { nombre: "InterÃ©s Â· Wikimedia", cadencia: "vistas diarias Â· 28 dÃ­as vs 28" },
  divisa: { nombre: "Divisa Â· Banco Central Europeo", cadencia: "cada dÃ­a laborable" },
  ine: { nombre: "Viajeros Â· INE", cadencia: "mensual Â· dos meses de retraso" },
  vuelos: { nombre: "Precio de vuelo Â· Amadeus", cadencia: "diaria Â· requiere producciÃ³n" },
  reservas: { nombre: "Reservas Â· Amadeus", cadencia: "mensual Â· requiere producciÃ³n" },
  eventos: { nombre: "Eventos Â· Ticketmaster", cadencia: "diaria Â· requiere clave" },
  calendario: { nombre: "Calendario escolar", cadencia: "anual" },
  catalogo: { nombre: "CatÃ¡logo de la agencia", cadencia: "interna Â· manual" },
};

type Clima = { estado: string; temperatura: number | null; fuente: string; observadoEn?: string | null; mensaje?: string };

export default function Destino360({
  destino,
  destinos,
  mes,
  onSeleccionar,
  onAbrirCopiloto,
}: {
  destino: DestinoConScore;
  destinos: DestinoConScore[];
  mes: number;
  onSeleccionar: (id: string) => void;
  onAbrirCopiloto: (id: string) => void;
}) {
  // El estado de carga se DERIVA de si lo que hay guardado corresponde al
  // destino abierto. Asi no hace falta un segundo estado que mantener en
  // sincronia, y no se puede quedar colgado en Â«cargandoÂ».
  const [climaDe, setClimaDe] = useState<{ id: string; datos: Clima | null } | null>(null);
  const cargandoClima = climaDe?.id !== destino.id;m:Ó»h‘éì¶»§q«^u]\Ë›[™İBˆİ\\š]šY[\ÎˆBˆ›ÜY\İ\Îˆ™[Z˜X›\ÔÛÛË›X\

JHOˆT›ÜY\İJK™\İ[›Ë\œÛÛ˜\Ë[Kœ™[Z˜X›\Ë\™š[™™XÚTØ[YHÏÈ[
JKBˆY[œØZ™Nˆ“š[™İ[˜HÜÚpìÛˆİ[\HÙËˆ\İ\ÈÛÛˆ\È]YHY[›ÜÈ[˜İ[\[‹ÛÛˆÈ]YHÙH\Ø[‹ˆ‹Bˆ]š\ÛÜÎˆ×KBˆ˜^˜Nˆ˜^˜P˜\ÙKBˆNÃBˆCBƒBˆÛÛœİX\™Ù[™\ÈHØ[™Y]\Ë›X\


HOˆ›X\™Ù[”İ
NÃBˆÛÛœİ˜[™ÛÈHÃBˆX\™Ù[“Z[ˆX]›Z[Š‹‹›X\™Ù[™\ÊKBˆX\™Ù[“X^ˆX]›X^
‹‹›X\™Ù[™\ÊKBˆİ\ÓX^ˆX]›X^
‹‹˜Ø[™Y]\Ë›X\


HOˆ˜İ\ÊJKBˆNÃBƒBˆÛÛœİÜ™[˜Y\ÈHİ\\š]šY[\ÃBˆ›X\

JHOˆ
È\İ[›ÎˆK™\İ[›Ë[XXÚ[Ûˆ[X\ŠK™\İ[›Ë\™š[\ÛÜË˜[™ÛËØ[\[˜\ÊHJJCBˆœÛÜ

KŠHOˆ‹œ[XXÚ[ÛˆHKœ[XXÚ[ÛŠCBˆœÛXÙJŠNÃBƒBˆ™]\›ˆÃBˆ[ÙÎˆœ™XÛÛY[™Y\È‹BˆØ[™Y]\ÎˆØ[™Y]\Ë›[™İBˆİ\\š]šY[\Îˆİ\\š]šY[\Ë›[™İBˆ›ÜY\İ\ÎˆÜ™[˜Y\Ë›X\

ÊHOˆT›ÜY\İJË™\İ[›Ë\œÛÛ˜\ËËœ[XXÚ[Û‹×K\™š[™™XÚTØ[YHÏÈ[
JKBˆY[œØZ™Nˆ[Bˆ]š\ÛÜÎˆ×KBˆ˜^˜Nˆ˜^˜P˜\ÙKBˆNÃBŸCB