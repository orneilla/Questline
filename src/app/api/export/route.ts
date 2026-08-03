import { exporterTout } from "@/app/(app)/reglages/actions";
import { aujourdhui } from "@/lib/dates";

/**
 * Sauvegarde complète, téléchargée depuis le navigateur.
 * Protégée par le middleware au même titre que les écrans.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const sauvegarde = await exporterTout();

  return new Response(JSON.stringify(sauvegarde, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="questline-${aujourdhui()}.json"`,
    },
  });
}
