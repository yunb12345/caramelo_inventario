import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ReceiptText } from "lucide-react";
import type { Paginated, SaleSummaryDTO } from "@caramelo/shared";
import { PAYMENT_METHOD_LABELS } from "@caramelo/shared";
import { api, qs } from "../lib/api";
import { formatDateTime, formatMoney } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
} from "../components/ui";

const paymentTone = {
  CASH: "success",
  CARD: "info",
  TRANSFER: "brand",
  OTHER: "neutral",
} as const;

export default function Sales() {
  const navigate = useNavigate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["sales", from, to, page],
    queryFn: () =>
      api.get<Paginated<SaleSummaryDTO>>(
        `/sales${qs({ from, to, page, pageSize: 20 })}`,
      ),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PageHeader
        title="Ventas"
        description="Historial de ventas registradas"
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde" className="w-full sm:w-44">
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field label="Hasta" className="w-full sm:w-44">
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </Field>

          {(from || to) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              Limpiar
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2 text-xs text-stone-500">
            <CalendarDays className="h-4 w-4" />
            {data ? `${data.meta.total} ventas` : "Cargando..."}
          </div>
        </div>
      </Card>

      <Card>
        {isLoading || !data ? (
          <div className="flex h-60 items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-5 w-5" />}
            title="No hay ventas en el periodo"
            description="Proba con otro rango de fechas."
            action={
              <Button size="sm" onClick={() => navigate("/pos")}>
                Ir al punto de venta
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Comprobante</Th>
                <Th>Fecha</Th>
                <Th className="text-center">Articulos</Th>
                <Th>Pago</Th>
                <Th>Usuario</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((sale) => (
                <tr
                  key={sale.id}
                  className="cursor-pointer transition hover:bg-stone-50/70"
                  onClick={() => navigate(`/ventas/${sale.id}`)}
                >
                  <Td className="font-medium text-stone-900">#{sale.number}</Td>
                  <Td className="text-stone-600">{formatDateTime(sale.createdAt)}</Td>
                  <Td className="text-center text-stone-600">{sale.itemCount}</Td>
                  <Td>
                    <Badge tone={paymentTone[sale.paymentMethod]}>
                      {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
                    </Badge>
                  </Td>
                  <Td className="text-stone-600">{sale.user?.name ?? "-"}</Td>
                  <Td className="text-right font-semibold text-stone-900">
                    {formatMoney(sale.total)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <p className="text-xs text-stone-500">
              Pagina {data.meta.page} de {data.meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
