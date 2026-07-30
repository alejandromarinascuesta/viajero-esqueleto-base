import Shell from "@/components/layout/Shell";
import { cargarDestinos } from "@/lib/data";
import { opportunityScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function Page() {
  const mes = new Date().getMonth() + 1;
  const { destinos, origen } = await cargarDestinos();
  const conScore = destinos.map((d) => ({ ...d, oportunidad: opportunityScore(d) }));
  return <Shell destinos={conScore} origen={origen} mes={mes} />;
}
