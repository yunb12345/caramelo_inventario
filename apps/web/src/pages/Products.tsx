import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CategoryDTO, Paginated, ProductDTO } from "@caramelo/shared";
import { api, qs } from "../lib/api";
import { formatMoney } from "../lib/format";
import { errorMessage } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from "../components/ui";

export default function Products() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lowStock, setLowStock] = useState(searchParams.get("lowStock") === "true");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSearchParams(lowStock ? { lowStock: "true" } : {}, { replace: true });
  }, [lowStock, setSearchParams]);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryDTO[]>("/categories"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", debounced, categoryId, lowStock, page],
    queryFn: () =>
      api.get<Paginated<ProductDTO>>(
        `/products${qs({
          search: debounced,
          categoryId,
          lowStock: lowStock || undefined,
          page,
          pageSize: 15,
        })}`,
      ),
    placeholderData: (previous) => previous,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Producto desactivado");
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function handleDelete(product: ProductDTO) {
    const confirmed = window.confirm(
      `Desactivar "${product.name}"? Dejara de aparecer en el punto de venta.`,
    );
    if (confirmed) remove.mutate(product.id);
  }

  return (
    <>
      <PageHeader
        title="Productos"
        description="Catalogo con variantes por talle y color"
        actions={
          <Link to="/productos/nuevo">
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          </Link>
        }
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              placeholder="Buscar por nombre, marca o descripcion..."
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select
            className="w-full sm:w-52"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas las categorias</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              checked={lowStock}
              onChange={(event) => {
                setLowStock(event.target.checked);
                setPage(1);
              }}
            />
            Solo stock bajo
          </label>
        </div>
      </Card>

      <Card>
        {isLoading || !data ? (
          <div className="flex h-60 items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title="No hay productos"
            description="Proba con otro filtro o crea tu primer producto."
            action={
              <Link to="/productos/nuevo">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Crear producto
                </Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Producto</Th>
                <Th>Categoria</Th>
                <Th className="text-center">Variantes</Th>
                <Th className="text-center">Stock</Th>
                <Th className="text-right">Precio</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((product) => (
                <tr key={product.id} className="transition hover:bg-stone-50/70">
                  <Td>
                    <div className="min-w-[180px]">
                      <Link
                        to={`/productos/${product.id}`}
                        className="font-medium text-stone-900 hover:text-brand-700"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs text-stone-500">
                        {product.brand ? `${product.brand} · ` : ""}
                        {product.variants.length} variantes
                      </p>
                    </div>
                  </Td>
                  <Td>
                    {product.category ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-stone-600">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: product.category.color ?? "#a8a29e" }}
                        />
                        {product.category.name}
                      </span>
                    ) : (
                      <span className="text-sm text-stone-400">Sin categoria</span>
                    )}
                  </Td>
                  <Td className="text-center text-stone-600">{product.variants.length}</Td>
                  <Td className="text-center">
                    <span
                      className={
                        product.totalStock === 0
                          ? "font-semibold text-rose-600"
                          : "font-medium text-stone-700"
                      }
                    >
                      {product.totalStock}
                    </span>
                  </Td>
                  <Td className="text-right font-medium text-stone-800">
                    {formatMoney(product.basePrice)}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {product.lowStock && (
                        <Badge tone="warning">
                          <AlertTriangle className="h-3 w-3" />
                          Reponer
                        </Badge>
                      )}
                      {!product.active && <Badge tone="neutral">Inactivo</Badge>}
                      {product.active && !product.lowStock && (
                        <Badge tone="success">OK</Badge>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Link
                        to={`/productos/${product.id}`}
                        className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(product)}
                        className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                        title="Desactivar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <p className="text-xs text-stone-500">
              {data.meta.total} productos · pagina {data.meta.page} de {data.meta.totalPages}
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
