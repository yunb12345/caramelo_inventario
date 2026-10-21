import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Package,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardDTO } from "@caramelo/shared";
import { api } from "../lib/api";
import { formatDayShort, formatMoney, formatNumber } from "../lib/format";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Spinner } from "../components/ui";
import { PAYMENT_METHOD_LABELS } from "@caramelo/shared";

function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "bg-brand-50 text-brand-600",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-stone-900">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardDTO>("/dashboard"),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Panel"
        description="Resumen del local en tiempo real"
        actions={
          <Button onClick={() => navigate("/pos")}>
            <ShoppingCart className="h-4 w-4" />
            Nueva venta
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ventas de hoy"
          value={formatNumber(data.today.sales)}
          hint={`${formatNumber(data.today.units)} unidades vendidas`}
          icon={<ReceiptText className="h-5 w-5" />}
        />
        <KpiCard
          label="Ingresos de hoy"
          value={formatMoney(data.today.revenue)}
          hint={`${formatNumber(data.month.sales)} ventas este mes`}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          label="Productos activos"
          value={formatNumber(data.products)}
          hint={`${formatNumber(data.variants)} variantes en catalogo`}
          icon={<Package className="h-5 w-5" />}
          accent="bg-sky-50 text-sky-600"
        />
        <KpiCard
          label="Requieren reposicion"
          value={formatNumber(data.lowStock)}
          hint={`${formatNumber(data.outOfStock)} variantes sin stock`}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Ventas de los ultimos 7 dias"
            description={`Valor de stock: ${formatMoney(data.stockValue)}`}
          />
          <div className="h-64 px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.last7Days} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b86431" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#b86431" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDayShort}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#a8a29e" }}
                  dy={6}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#a8a29e" }}
                  width={64}
                  tickFormatter={(value) => formatMoney(Number(value))}
                />
                <Tooltip
                  formatter={(value) => [formatMoney(Number(value)), "Ingresos"]}
                  labelFormatter={(label) => formatDayShort(String(label))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e7e5e4",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#b86431"
                  strokeWidth={2.5}
                  fill="url(#revenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Stock bajo"
            description="Variantes en o por debajo del minimo"
            action={
              <button
                onClick={() => navigate("/productos?lowStock=true")}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Ver todo
              </button>
            }
          />
          {data.lowStockVariants.length === 0 ? (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="Todo el stock esta en orden"
              description="No hay variantes por debajo del minimo."
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.lowStockVariants.map((item) => (
                <li key={item.variantId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-800">
                      {item.productName}
                    </p>
                    <p className="text-xs text-stone-500">
                      {item.color} · Talle {item.size} · {item.sku}
                    </p>
                  </div>
                  <Badge tone={item.stock === 0 ? "danger" : "warning"}>
                    {item.stock === 0 ? "Sin stock" : `${item.stock} u.`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Ultimas ventas"
          action={
            <button
              onClick={() => navigate("/ventas")}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Ver historial <ArrowRight className="h-3 w-3" />
            </button>
          }
        />
        {data.recentSales.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-5 w-5" />}
            title="Todavia no hay ventas"
            description="Cuando registres la primera venta va a aparecer aca."
            action={
              <Button size="sm" onClick={() => navigate("/pos")}>
                Registrar venta
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {data.recentSales.map((sale) => (
              <li
                key={sale.id}
                className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3 transition hover:bg-stone-50"
                onClick={() => navigate(`/ventas/${sale.id}`)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-500">
                    #{sale.number}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800">
                      {sale.itemCount} {sale.itemCount === 1 ? "articulo" : "articulos"} ·{" "}
                      {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
                    </p>
                    <p className="text-xs text-stone-500">
                      {new Date(sale.createdAt).toLocaleString("es-AR")} ·{" "}
                      {sale.user?.name ?? "Sin usuario"}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold text-stone-900">
                  {formatMoney(sale.total)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
