import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Boxes,
  Info,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  SIZE_SUGGESTIONS,
  type CategoryDTO,
  type ProductDTO,
  type VariantDTO,
} from "@caramelo/shared";
import { api, ApiError } from "../lib/api";
import { formatMoney } from "../lib/format";
import { errorMessage, suggestSku } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Textarea,
  Th,
} from "../components/ui";

type ProductFormState = {
  name: string;
  description: string;
  brand: string;
  categoryId: string;
  basePrice: string;
  baseCost: string;
  active: boolean;
};

type DraftVariant = {
  key: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  price: string;
  cost: string;
  stock: string;
  minStock: string;
};

type VariantFormState = {
  size: string;
  color: string;
  sku: string;
  barcode: string;
  price: string;
  cost: string;
  stock: string;
  minStock: string;
  active: boolean;
};

const emptyProductForm: ProductFormState = {
  name: "",
  description: "",
  brand: "",
  categoryId: "",
  basePrice: "",
  baseCost: "",
  active: true,
};

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyDraft(): DraftVariant {
  return {
    key: newKey(),
    size: "",
    color: "",
    sku: "",
    barcode: "",
    price: "",
    cost: "",
    stock: "0",
    minStock: "0",
  };
}

function emptyVariantForm(price = ""): VariantFormState {
  return {
    size: "",
    color: "",
    sku: "",
    barcode: "",
    price,
    cost: "",
    stock: "0",
    minStock: "0",
    active: true,
  };
}

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [drafts, setDrafts] = useState<DraftVariant[]>([emptyDraft()]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [variantModal, setVariantModal] = useState<{
    open: boolean;
    variant: VariantDTO | null;
  }>({ open: false, variant: null });
  const [variantForm, setVariantForm] = useState<VariantFormState>(emptyVariantForm());
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryDTO[]>("/categories"),
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<ProductDTO>(`/products/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!product) return;

    setForm({
      name: product.name,
      description: product.description ?? "",
      brand: product.brand ?? "",
      categoryId: product.categoryId ?? "",
      basePrice: String(product.basePrice),
      baseCost: String(product.baseCost),
      active: product.active,
    });
  }, [product]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    if (id) void queryClient.invalidateQueries({ queryKey: ["product", id] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  function updateDraft(key: string, patch: Partial<DraftVariant>) {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)),
    );
  }

  function handleProductError(error: unknown) {
    if (error instanceof ApiError && error.issues?.length) {
      const next: Record<string, string> = {};
      for (const issue of error.issues) next[issue.path] = issue.message;
      setErrors(next);
    }
    toast.error(errorMessage(error));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setErrors({});

    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = "Ingresa el nombre del producto";
    if (!form.basePrice || Number(form.basePrice) < 0) {
      nextErrors.basePrice = "Ingresa un precio valido";
    }
    drafts.forEach((draft, index) => {
      if (!draft.size.trim()) nextErrors[`variants.${index}.size`] = "Falta el talle";
      if (!draft.color.trim()) nextErrors[`variants.${index}.color`] = "Falta el color";
      if (!draft.sku.trim()) nextErrors[`variants.${index}.sku`] = "Falta el SKU";
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Revisa los campos marcados");
      return;
    }

    setSaving(true);

    try {
      const created = await api.post<ProductDTO>("/products", {
        name: form.name.trim(),
        description: form.description.trim() || null,
        brand: form.brand.trim() || null,
        categoryId: form.categoryId || null,
        basePrice: Number(form.basePrice),
        baseCost: Number(form.baseCost || 0),
        active: form.active,
        variants: drafts.map((draft) => ({
          size: draft.size.trim(),
          color: draft.color.trim(),
          sku: draft.sku.trim(),
          barcode: draft.barcode.trim() || null,
          price: draft.price.trim() ? Number(draft.price) : null,
          cost: draft.cost.trim() ? Number(draft.cost) : null,
          stock: Number(draft.stock || 0),
          minStock: Number(draft.minStock || 0),
        })),
      });

      toast.success("Producto creado");
      invalidate();
      navigate(`/productos/${created.id}`, { replace: true });
    } catch (error) {
      handleProductError(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event: FormEvent) {
    event.preventDefault();
    if (!id) return;

    setErrors({});
    setSaving(true);

    try {
      await api.patch<ProductDTO>(`/products/${id}`, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        brand: form.brand.trim() || null,
        categoryId: form.categoryId || null,
        basePrice: Number(form.basePrice),
        baseCost: Number(form.baseCost || 0),
        active: form.active,
      });

      toast.success("Producto actualizado");
      invalidate();
    } catch (error) {
      handleProductError(error);
    } finally {
      setSaving(false);
    }
  }

  function openCreateVariant() {
    setVariantForm(emptyVariantForm(product ? String(product.basePrice) : ""));
    setVariantErrors({});
    setVariantModal({ open: true, variant: null });
  }

  function openEditVariant(variant: VariantDTO) {
    setVariantForm({
      size: variant.size,
      color: variant.color,
      sku: variant.sku,
      barcode: variant.barcode ?? "",
      price: String(variant.price),
      cost: String(variant.cost),
      stock: String(variant.stock),
      minStock: String(variant.minStock),
      active: variant.active,
    });
    setVariantErrors({});
    setVariantModal({ open: true, variant });
  }

  async function saveVariant() {
    if (!id) return;

    const nextErrors: Record<string, string> = {};
    if (!variantForm.size.trim()) nextErrors.size = "Falta el talle";
    if (!variantForm.color.trim()) nextErrors.color = "Falta el color";
    if (!variantForm.sku.trim()) nextErrors.sku = "Falta el SKU";

    if (Object.keys(nextErrors).length > 0) {
      setVariantErrors(nextErrors);
      return;
    }

    const base = {
      size: variantForm.size.trim(),
      color: variantForm.color.trim(),
      sku: variantForm.sku.trim(),
      barcode: variantForm.barcode.trim() || null,
      price: variantForm.price.trim() ? Number(variantForm.price) : null,
      cost: variantForm.cost.trim() ? Number(variantForm.cost) : null,
      minStock: Number(variantForm.minStock || 0),
    };

    try {
      if (variantModal.variant) {
        await api.patch(`/products/${id}/variants/${variantModal.variant.id}`, {
          ...base,
          active: variantForm.active,
        });
        toast.success("Variante actualizada");
      } else {
        await api.post(`/products/${id}/variants`, {
          ...base,
          stock: Number(variantForm.stock || 0),
        });
        toast.success("Variante agregada");
      }

      setVariantModal({ open: false, variant: null });
      invalidate();
    } catch (error) {
      if (error instanceof ApiError && error.issues?.length) {
        const next: Record<string, string> = {};
        for (const issue of error.issues) next[issue.path] = issue.message;
        setVariantErrors(next);
      }
      toast.error(errorMessage(error));
    }
  }

  const removeVariant = useMutation({
    mutationFn: (variantId: string) => api.delete(`/products/${id}/variants/${variantId}`),
    onSuccess: () => {
      toast.success("Variante desactivada");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function handleDeleteVariant(variant: VariantDTO) {
    const confirmed = window.confirm(
      `Desactivar la variante ${variant.size} / ${variant.color}?`,
    );
    if (confirmed) removeVariant.mutate(variant.id);
  }

  const autoSku = useMemo(() => {
    return (name: string, size: string, color: string) => suggestSku(name, size, color);
  }, []);

  if (isEdit && isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (isEdit && !product) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-stone-600">No encontramos el producto.</p>
        <Link to="/productos" className="mt-3 inline-block text-sm text-brand-600">
          Volver al listado
        </Link>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={isEdit ? "Editar producto" : "Nuevo producto"}
        description={
          isEdit
            ? product?.name
            : "Carga los datos base y al menos una variante de talle y color"
        }
        actions={
          <Button variant="secondary" onClick={() => navigate("/productos")}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        }
      />

      <form onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-stone-800">Datos del producto</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre *" error={errors.name} className="sm:col-span-2">
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Remera oversize basica"
                  required
                />
              </Field>

              <Field label="Marca">
                <Input
                  value={form.brand}
                  onChange={(event) => setForm({ ...form, brand: event.target.value })}
                  placeholder="Caramelo"
                />
              </Field>

              <Field label="Categoria">
                <Select
                  value={form.categoryId}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                >
                  <option value="">Sin categoria</option>
                  {categories?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Precio de venta *"
                error={errors.basePrice}
                hint="Se usa como precio sugerido de cada variante"
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.basePrice}
                  onChange={(event) => setForm({ ...form, basePrice: event.target.value })}
                  placeholder="14900"
                  required
                />
              </Field>

              <Field label="Costo" hint="Para calcular el valor del stock">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.baseCost}
                  onChange={(event) => setForm({ ...form, baseCost: event.target.value })}
                  placeholder="6200"
                />
              </Field>

              <Field label="Descripcion" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Material, calce, detalles..."
                />
              </Field>

              {isEdit && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                    checked={form.active}
                    onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  />
                  Producto activo (visible en el punto de venta)
                </label>
              )}
            </div>
          </Card>

          <Card className="h-fit p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
              <Info className="h-4 w-4 text-brand-600" />
              Como funciona
            </div>
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-stone-500">
              <li>· Cada producto tiene variantes por talle y color.</li>
              <li>· El SKU identifica la variante en el punto de venta.</li>
              <li>· El codigo de barras es opcional, ideal para lector.</li>
              <li>· El stock se modifica con ventas y movimientos, no editandolo a mano.</li>
              <li>· El stock minimo genera alertas de reposicion.</li>
            </ul>
          </Card>
        </div>

        {!isEdit ? (
          <Card>
            <CardHeader
              title="Variantes"
              description="Talle, color y stock inicial de cada una"
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setDrafts((current) => [...current, emptyDraft()])}
                >
                  <Plus className="h-4 w-4" />
                  Agregar variante
                </Button>
              }
            />

            <div className="space-y-4 p-5">
              {drafts.map((draft, index) => (
                <div
                  key={draft.key}
                  className="rounded-xl border border-stone-200 bg-stone-50/60 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Variante {index + 1}
                    </p>
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((current) =>
                            current.filter((item) => item.key !== draft.key),
                          )
                        }
                        className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                        title="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Talle *" error={errors[`variants.${index}.size`]}>
                      <Input
                        list="size-suggestions"
                        value={draft.size}
                        onChange={(event) => updateDraft(draft.key, { size: event.target.value })}
                        placeholder="M"
                      />
                    </Field>

                    <Field label="Color *" error={errors[`variants.${index}.color`]}>
                      <Input
                        value={draft.color}
                        onChange={(event) => updateDraft(draft.key, { color: event.target.value })}
                        placeholder="Negro"
                      />
                    </Field>

                    <Field
                      label="SKU *"
                      error={errors[`variants.${index}.sku`]}
                      className="sm:col-span-2"
                    >
                      <div className="flex gap-2">
                        <Input
                          value={draft.sku}
                          onChange={(event) => updateDraft(draft.key, { sku: event.target.value })}
                          placeholder="REM-OVR-M-NEG"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          title="Generar SKU automatico"
                          onClick={() =>
                            updateDraft(draft.key, {
                              sku: autoSku(form.name, draft.size, draft.color),
                            })
                          }
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </div>
                    </Field>

                    <Field label="Codigo de barras">
                      <Input
                        value={draft.barcode}
                        onChange={(event) =>
                          updateDraft(draft.key, { barcode: event.target.value })
                        }
                        placeholder="Opcional"
                      />
                    </Field>

                    <Field label="Precio" hint={`Base: ${form.basePrice || "-"}`}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.price}
                        onChange={(event) =>
                          updateDraft(draft.key, { price: event.target.value })
                        }
                        placeholder={form.basePrice || "0"}
                      />
                    </Field>

                    <Field label="Costo">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.cost}
                        onChange={(event) => updateDraft(draft.key, { cost: event.target.value })}
                        placeholder={form.baseCost || "0"}
                      />
                    </Field>

                    <Field label="Stock inicial">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={draft.stock}
                        onChange={(event) => updateDraft(draft.key, { stock: event.target.value })}
                      />
                    </Field>

                    <Field label="Stock minimo">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={draft.minStock}
                        onChange={(event) =>
                          updateDraft(draft.key, { minStock: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}

              <datalist id="size-suggestions">
                {SIZE_SUGGESTIONS.map((size) => (
                  <option key={size} value={size} />
                ))}
              </datalist>
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader
              title="Variantes"
              description={`${product?.variants.length ?? 0} variantes cargadas`}
              action={
                <Button type="button" size="sm" variant="secondary" onClick={openCreateVariant}>
                  <Plus className="h-4 w-4" />
                  Agregar variante
                </Button>
              }
            />

            {product && product.variants.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-stone-500">
                Este producto no tiene variantes.
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Talle</Th>
                    <Th>Color</Th>
                    <Th>SKU</Th>
                    <Th>Barras</Th>
                    <Th className="text-right">Precio</Th>
                    <Th className="text-right">Costo</Th>
                    <Th className="text-center">Stock</Th>
                    <Th className="text-center">Min.</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {product?.variants.map((variant) => (
                    <tr key={variant.id} className="transition hover:bg-stone-50/70">
                      <Td className="font-medium">{variant.size}</Td>
                      <Td>{variant.color}</Td>
                      <Td className="font-mono text-xs text-stone-500">{variant.sku}</Td>
                      <Td className="text-xs text-stone-500">{variant.barcode ?? "-"}</Td>
                      <Td className="text-right">{formatMoney(variant.price)}</Td>
                      <Td className="text-right text-stone-500">{formatMoney(variant.cost)}</Td>
                      <Td className="text-center">
                        <span
                          className={
                            variant.stock <= variant.minStock
                              ? "font-semibold text-rose-600"
                              : "font-medium text-stone-700"
                          }
                        >
                          {variant.stock}
                        </span>
                      </Td>
                      <Td className="text-center text-stone-500">{variant.minStock}</Td>
                      <Td>
                        <Badge tone={variant.active ? "success" : "neutral"}>
                          {variant.active ? "Activa" : "Inactiva"}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditVariant(variant)}
                            className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
                            title="Editar variante"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVariant(variant)}
                            className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Desactivar variante"
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
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <Boxes className="h-4 w-4" />
            {isEdit
              ? "El stock se ajusta desde Movimientos."
              : "El stock inicial se registra como ingreso."}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate("/productos")}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" />
              {isEdit ? "Guardar cambios" : "Crear producto"}
            </Button>
          </div>
        </div>
      </form>

      <Modal
        open={variantModal.open}
        onClose={() => setVariantModal({ open: false, variant: null })}
        title={variantModal.variant ? "Editar variante" : "Nueva variante"}
        description={
          variantModal.variant
            ? "El stock se modifica desde Movimientos"
            : "Se registrara el stock inicial como ingreso"
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setVariantModal({ open: false, variant: null })}
            >
              Cancelar
            </Button>
            <Button onClick={() => void saveVariant()}>
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Talle *" error={variantErrors.size}>
            <Input
              list="size-suggestions-modal"
              value={variantForm.size}
              onChange={(event) => setVariantForm({ ...variantForm, size: event.target.value })}
            />
          </Field>

          <Field label="Color *" error={variantErrors.color}>
            <Input
              value={variantForm.color}
              onChange={(event) => setVariantForm({ ...variantForm, color: event.target.value })}
            />
          </Field>

          <Field label="SKU *" error={variantErrors.sku} className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                value={variantForm.sku}
                onChange={(event) => setVariantForm({ ...variantForm, sku: event.target.value })}
              />
              <Button
                type="button"
                variant="secondary"
                title="Generar SKU automatico"
                onClick={() =>
                  setVariantForm({
                    ...variantForm,
                    sku: suggestSku(form.name, variantForm.size, variantForm.color),
                  })
                }
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          </Field>

          <Field label="Codigo de barras" className="sm:col-span-2">
            <Input
              value={variantForm.barcode}
              onChange={(event) =>
                setVariantForm({ ...variantForm, barcode: event.target.value })
              }
              placeholder="Opcional"
            />
          </Field>

          <Field label="Precio">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={variantForm.price}
              onChange={(event) =>
                setVariantForm({ ...variantForm, price: event.target.value })
              }
            />
          </Field>

          <Field label="Costo">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={variantForm.cost}
              onChange={(event) => setVariantForm({ ...variantForm, cost: event.target.value })}
            />
          </Field>

          {!variantModal.variant && (
            <Field label="Stock inicial">
              <Input
                type="number"
                min="0"
                step="1"
                value={variantForm.stock}
                onChange={(event) =>
                  setVariantForm({ ...variantForm, stock: event.target.value })
                }
              />
            </Field>
          )}

          <Field label="Stock minimo">
            <Input
              type="number"
              min="0"
              step="1"
              value={variantForm.minStock}
              onChange={(event) =>
                setVariantForm({ ...variantForm, minStock: event.target.value })
              }
            />
          </Field>

          {variantModal.variant && (
            <label className="flex items-center gap-2 text-sm text-stone-600 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={variantForm.active}
                onChange={(event) =>
                  setVariantForm({ ...variantForm, active: event.target.checked })
                }
              />
              Variante activa
            </label>
          )}
        </div>

        <datalist id="size-suggestions-modal">
          {SIZE_SUGGESTIONS.map((size) => (
            <option key={size} value={size} />
          ))}
        </datalist>
      </Modal>
    </>
  );
}
