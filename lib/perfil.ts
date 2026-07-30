/** Perfil tal y como sale de las notas del agente. Los campos que las notas no
 *  dicen quedan a null y se declaran en `no_consta`: no se rellenan. */
export type PerfilExtraido = {
  adultos: number | null;
  ninos: number[];
  presupuesto_total: number | null;
  presupuesto_es_por_persona: boolean | null;
  flexible: boolean | null;
  mes: number | null;
  dias: number | null;
  motivacion: string | null;
  intensidad: number | null;
  restricciones: string[];
  destinos_mencionados: string[];
  tension: string | null;
  no_consta: string[];
  literales: Record<string, string>;
};
