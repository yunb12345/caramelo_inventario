import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  MANUAL_MOVEMENT_TYPES,
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  type MovementDTO,
  type MovementType,
  type Paginated,
  type SaleSearchResult,
} from "@caramelo/shared";
import { api, qs } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { errorMessage } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
  Textarea,
} from "../components/ui";

const movementTone = {
  IN: "success",
  OUT: "danger",
  ADJUSTMENT: "warning",
  SALE: "info",
  RETURN: "brand",
} as const;

export default function Movements() {
  const queryClient = useQueryClient();

  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);

  const [selected, setSelected] = useState<SaleSearchResult | null>(null);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [movementType, setMovementType] = useState<(typeof MANUAL_MOVEMENT_TYPES)[number]>("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  const { data, isLoading } = useQuery({
    queryKey: ["movements", type, page],
    queryFn: () =>
      api.get<Paginated<MovementDTO>>(
        `/movements${qs({ type, page, pageSize: 25 })}`,
      ),
    placeholderData: (previous) => previous,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["variant-search", "movements", debounced],
    queryFn: () => api.get<SaleSearchResult[]>(`/variants/search${qs({ q: debounced })}`),
    enabled: debounced.length > 0 && !selected,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<MovementDTO>("/movements", {
        variantId: selected?.variantId,
        type: movementType,
        quantity: Number(quantity || 0),
        reason: reason.trim() || null,
        reference: reference.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Movimiento registrado");
      setOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function resetForm() {
    setSelected(null);
    setTerm("");
    setQuantity("");
    setReason("");
    setReference("");
    setMovementType("IN");
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleSubmit() {
    if (!selected) {
      toast.error("Selecciona una variante");
      return;
    }

    if (quantity === "" || Number(quantity) < 0) {
      toast.error("Ingresa una cantidad valida");
      return;
    }

    create.mutate();
  }

  const quantityLabel =
    movementType === "ADJUSTMENT"
      ? "Stock final real"
      : movementType === "IN"
        ? "Cantidad a ingresar"
        : "Cantidad a egresar";

  return (
    <>
      <PageHeader
        title="Movimientos"
        description="Ingresos, egresos y ajustes de stock"
        actions={
          <Button onClick={handleOpen}>
            <Plus className="h-4 w-4" />
            Registrar movimiento
          </Button>
        }
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Tipo" className="w-full sm:w-52">
            <Select
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los tipos</option>
              {MOVEMENT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {MOVEMENT_TYPE_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="ml-auto text-xs text-stone-500">
            {data ? `${data.meta.total} movimientos` : "Cargando..."}
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
            icon={<ArrowLeftRight className="h-5 w-5" />}
            title="No hay movimientos"
            description="Los ingresos, ajustes y ventas van a aparecer aca."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Producto</Th>
                <Th>Variante</Th>
                <Th>Tipo</Th>
                <Th className="text-center">Cantidad</Th>
                <Th className="text-center">Stock</Th>
                <Th>Detalle</Th>
                <Th>Usuario</Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((movement) => (
                <tr key={movement.id} className="transition hover:bg-stone-50/70">
                  <Td className="whitespace-nowrap text-stone-600">
                    {formatDateTime(movement.createdAt)}
                  </Td>
                  <Td className="font-medium text-stone-800">
                    {movement.variant.product.name}
                  </Td>
                  <Td className="text-stone-600">
                    {movement.variant.color} · {movement.variant.size}
                  </Td>
                  <Td>
                    <Badge tone={movementTone[movement.type]}>
                      {MOVEMENT_TYPE_LABELS[movement.type as MovementType]}
                    </Badge>
                  </Td>
                  <Td className="text-center">
                    <span
                      className={
                        movement.quantity > 0
                          ? "font-semibold text-emerald-600"
                          : "font-semibold text-rose-600"
                      }
                    >
                      {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                    </span>
                  </Td>
                  <Td className="text-center text-stone-600">{movement.resultingStock}</Td>
                  <Td className="max-w-[220px] truncate text-xs text-stone-500">
                    {movement.reason ?? movement.reference ?? "-"}
                  </Td>
                  <Td className="text-stone-600">{movement.user?.name ?? "-"}</Td>
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar movimiento"
        description="Los ajustes quedan registrados con tu usuario"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={create.isPending}>
              Registrar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Variante">
            {selected ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {selected.productName}
                  </p>
                  <p className="text-xs text-stone-500">
                    {selected.color} · Talle {selected.size} · {selected.sku} · Stock:{" "}
                    {selected.stock}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelected(null);
                    setTerm("");
                  }}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar producto, SKU o codigo..."
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    autoFocus
                  />
                </div>

                {debounced.length > 0 && (
                  <ul className="mt-2 max-h-52 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
                    {searchResults && searchResults.length === 0 && (
                      <li className="px-3 py-4 text-center text-xs text-stone-500">
                        Sin resultados
                      </li>
                    )}
                    {searchResults?.map((item) => (
                      <li key={item.variantId}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(item);
                            setTerm("");
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-stone-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-stone-800">
                              {item.productName}
                            </p>
                            <p className="text-xs text-stone-500">
                              {item.color} · Talle {item.size} · {item.sku}
                            </p>
                          </div>
                          <Badge tone={item.stock === 0 ? "danger" : "neutral"}>
                            {item.stock} u.
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de movimiento">
              <Select
                value={movementType}
                onChange={(event) =>
                  setMovementType(event.target.value as typeof movementType)
                }
              >
                {MANUAL_MOVEMENT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {MOVEMENT_TYPE_LABELS[item]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={quantityLabel}
              hint={
                movementType === "ADJUSTMENT"
                  ? "Se registra la diferencia contra el stock actual"
                  : undefined
              }
            >
              <Input
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Field>

            <Field label="Motivo">
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reposicion, rotura, recuento..."
              />
            </Field>

            <Field label="Referencia">
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Factura, remito (opcional)"
              />
            </Field>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
            <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {movementType === "ADJUSTMENT"
                ? "El ajuste fija el stock real contado. La diferencia se guarda en el historial."
                : movementType === "IN"
                  ? "El ingreso suma unidades al stock de la variante."
                  : "El egreso resta unidades. No se permite dejar el stock en negativo."}
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
