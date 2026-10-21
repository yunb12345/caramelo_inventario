import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import type { SaleDTO } from "@caramelo/shared";
import { PAYMENT_METHOD_LABELS } from "@caramelo/shared";
import { api } from "../lib/api";
import { formatDateTime, formatMoney } from "../lib/format";
import { Badge, Button, Card, Spinner } from "../components/ui";

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: sale, isLoading } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => api.get<SaleDTO>(`/sales/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!sale) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-stone-600">No encontramos esa venta.</p>
        <Link to="/ventas" className="mt-3 inline-block text-sm text-brand-600">
          Volver al historial
        </Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => navigate("/ventas")}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      <Card className="overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/60 px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              Comprobante
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-stone-900">
              Venta #{sale.number}
            </h1>
            <p className="mt-1 text-sm text-stone-500">{formatDateTime(sale.createdAt)}</p>
          </div>

          <div className="text-right">
            <Badge tone="brand">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</Badge>
            <p className="mt-2 text-xs text-stone-500">
              Atendido por {sale.user?.name ?? "usuario eliminado"}
            </p>
          </div>
        </header>

        <div className="px-6 py-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
                <th className="pb-2">Producto</th>
                <th className="pb-2 text-center">Cant.</th>
                <th className="pb-2 text-right">Precio</th>
                <th className="pb-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-stone-100">
                  <td className="py-3">
                    <p className="font-medium text-stone-800">
                      {item.variant.product.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {item.variant.color} · Talle {item.variant.size} ·{" "}
                      <span className="font-mono">{item.variant.sku}</span>
                    </p>
                  </td>
                  <td className="py-3 text-center text-stone-600">{item.quantity}</td>
                  <td className="py-3 text-right text-stone-600">
                    {formatMoney(item.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-medium text-stone-800">
                    {formatMoney(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-5 w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span>{formatMoney(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Descuento</span>
                <span>-{formatMoney(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-semibold text-stone-900">
              <span>Total</span>
              <span>{formatMoney(sale.total)}</span>
            </div>
          </div>

          {sale.note && (
            <p className="mt-5 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
              Nota: {sale.note}
            </p>
          )}
        </div>
      </Card>

      <p className="no-print mt-4 text-center text-xs text-stone-400">
        Caramelo · Gracias por tu compra
      </p>
    </div>
  );
}
