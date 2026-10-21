import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Banknote,
  Check,
  CreditCard,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type SaleDTO,
  type SaleSearchResult,
} from "@caramelo/shared";
import { api, qs } from "../lib/api";
import { formatMoney } from "../lib/format";
import { errorMessage } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
} from "../components/ui";

type CartItem = {
  variantId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  stock: number;
  quantity: number;
};

const paymentOptions: { value: PaymentMethod; label: string; icon: typeof Wallet }[] = [
  { value: "CASH", label: "Efectivo", icon: Banknote },
  { value: "CARD", label: "Tarjeta", icon: CreditCard },
  { value: "TRANSFER", label: "Transferencia", icon: Smartphone },
  { value: "OTHER", label: "Otro", icon: Wallet },
];

export default function Pos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [lastSale, setLastSale] = useState<SaleDTO | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["variant-search", debounced],
    queryFn: () =>
      api.get<SaleSearchResult[]>(`/variants/search${qs({ q: debounced })}`),
    enabled: debounced.length > 0,
  });

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart],
  );

  const discountValue = Math.min(Number(discount) || 0, subtotal);
  const total = Math.max(0, subtotal - discountValue);

  const units = cart.reduce((count, item) => count + item.quantity, 0);

  function addToCart(item: SaleSearchResult) {
    if (item.stock <= 0) {
      toast.error("Esa variante no tiene stock");
      return;
    }

    setCart((current) => {
      const existing = current.find((line) => line.variantId === item.variantId);

      if (existing) {
        if (existing.quantity >= item.stock) {
          toast.warning(`Solo hay ${item.stock} unidades disponibles`);
          return current;
        }

        return current.map((line) =>
          line.variantId === item.variantId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }

      return [
        ...current,
        {
          variantId: item.variantId,
          productName: item.productName,
          sku: item.sku,
          size: item.size,
          color: item.color,
          price: item.price,
          stock: item.stock,
          quantity: 1,
        },
      ];
    });

    setTerm("");
  }

  function handleSearchSubmit() {
    const first = results?.[0];
    if (first) addToCart(first);
  }

  function changeQuantity(variantId: string, delta: number) {
    setCart((current) =>
      current
        .map((line) => {
          if (line.variantId !== variantId) return line;
          const next = line.quantity + delta;
          if (next > line.stock) {
            toast.warning(`Solo hay ${line.stock} unidades disponibles`);
            return line;
          }
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0),
    );
  }

  function changePrice(variantId: string, value: string) {
    const price = Number(value);
    if (Number.isNaN(price) || price < 0) return;

    setCart((current) =>
      current.map((line) => (line.variantId === variantId ? { ...line, price } : line)),
    );
  }

  const checkout = useMutation({
    mutationFn: () =>
      api.post<SaleDTO>("/sales", {
        items: cart.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: line.price,
        })),
        paymentMethod,
        discount: discountValue,
      }),
    onSuccess: (sale) => {
      setLastSale(sale);
      setCart([]);
      setDiscount("0");
      setPaymentMethod("CASH");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <>
      <PageHeader
        title="Punto de venta"
        description="Busca por nombre, SKU o codigo de barras"
        actions={
          <Badge tone="brand" className="h-8 px-3 text-sm">
            <ShoppingBag className="h-4 w-4" />
            {units} {units === 1 ? "unidad" : "unidades"}
          </Badge>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              autoFocus
              className="h-12 pl-9 text-base"
              placeholder="Escanea un codigo o busca un producto..."
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearchSubmit();
                }
              }}
            />
            {isFetching && (
              <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            )}
          </div>

          <div className="mt-4">
            {debounced.length === 0 ? (
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="Busca un producto"
                description="Podes escribir el nombre, el SKU o usar un lector de codigos."
              />
            ) : results && results.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="h-5 w-5" />}
                title="Sin resultados"
                description="Proba con otro nombre, SKU o codigo de barras."
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {results?.map((item) => (
                  <li
                    key={item.variantId}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-stone-50"
                    onClick={() => addToCart(item)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {item.productName}
                      </p>
                      <p className="text-xs text-stone-500">
                        {item.color} · Talle {item.size} ·{" "}
                        <span className="font-mono">{item.sku}</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={item.stock === 0 ? "danger" : item.stock <= 3 ? "warning" : "neutral"}>
                        {item.stock === 0 ? "Sin stock" : `${item.stock} u.`}
                      </Badge>
                      <p className="w-24 text-right text-sm font-semibold text-stone-900">
                        {formatMoney(item.price)}
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={item.stock === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          addToCart(item);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="flex h-fit flex-col lg:sticky lg:top-6">
          <header className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-800">Venta actual</h2>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs font-medium text-stone-500 hover:text-rose-600"
              >
                Vaciar
              </button>
            )}
          </header>

          {cart.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="h-5 w-5" />}
              title="El carrito esta vacio"
              description="Agrega productos desde el buscador."
            />
          ) : (
            <ul className="divide-y divide-stone-100">
              {cart.map((line) => (
                <li key={line.variantId} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {line.productName}
                      </p>
                      <p className="text-xs text-stone-500">
                        {line.color} · Talle {line.size}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCart((current) =>
                          current.filter((item) => item.variantId !== line.variantId),
                        )
                      }
                      className="rounded-lg p-1 text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Quitar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center rounded-lg border border-stone-200">
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.variantId, -1)}
                        className="flex h-8 w-8 items-center justify-center text-stone-500 hover:bg-stone-100"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.variantId, 1)}
                        className="flex h-8 w-8 items-center justify-center text-stone-500 hover:bg-stone-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-xs text-stone-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.price}
                        onChange={(event) => changePrice(line.variantId, event.target.value)}
                        className="h-8 w-24 rounded-lg border border-stone-200 px-2 text-right text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 border-t border-stone-100 px-4 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">Subtotal</span>
              <span className="font-medium text-stone-800">{formatMoney(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-stone-500">Descuento</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className="h-9 w-28 rounded-lg border border-stone-200 px-2 text-right text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="flex items-center justify-between border-t border-dashed border-stone-200 pt-3">
              <span className="text-sm font-medium text-stone-700">Total</span>
              <span className="text-xl font-semibold text-stone-900">{formatMoney(total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentMethod(option.value)}
                  className={
                    paymentMethod === option.value
                      ? "flex items-center justify-center gap-2 rounded-lg border border-brand-500 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700"
                      : "flex items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                  }
                >
                  <option.icon className="h-4 w-4" />
                  {option.label}
                </button>
              ))}
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={cart.length === 0}
              loading={checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              <Check className="h-5 w-5" />
              Cobrar {cart.length > 0 ? formatMoney(total) : ""}
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(lastSale)}
        onClose={() => setLastSale(null)}
        title="Venta registrada"
        description={lastSale ? `Comprobante #${lastSale.number}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLastSale(null)}>
              Nueva venta
            </Button>
            {lastSale && (
              <Button onClick={() => navigate(`/ventas/${lastSale.id}`)}>
                Ver comprobante
              </Button>
            )}
          </>
        }
      >
        {lastSale && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 px-4 py-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Total cobrado
              </p>
              <p className="mt-1 text-3xl font-semibold text-emerald-800">
                {formatMoney(lastSale.total)}
              </p>
            </div>

            <ul className="divide-y divide-stone-100 text-sm">
              {lastSale.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-800">
                      {item.variant.product.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {item.variant.color} · Talle {item.variant.size} · {item.quantity} u.
                    </p>
                  </div>
                  <span className="font-medium text-stone-700">
                    {formatMoney(item.subtotal)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-center text-xs text-stone-500">
              Pagado con {PAYMENT_METHOD_LABELS[lastSale.paymentMethod]}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
