import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CategoryDTO } from "@caramelo/shared";
import { api } from "../lib/api";
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
  Spinner,
  Table,
  Td,
  Th,
} from "../components/ui";

export default function Categories() {
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDTO | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#b86431");

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryDTO[]>("/categories"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.patch<CategoryDTO>(`/categories/${editing.id}`, {
            name: name.trim(),
            color,
          })
        : api.post<CategoryDTO>("/categories", { name: name.trim(), color }),
    onSuccess: () => {
      toast.success(editing ? "Categoria actualizada" : "Categoria creada");
      setOpen(false);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success("Categoria eliminada");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function openCreate() {
    setEditing(null);
    setName("");
    setColor("#b86431");
    setOpen(true);
  }

  function openEdit(category: CategoryDTO) {
    setEditing(category);
    setName(category.name);
    setColor(category.color ?? "#b86431");
    setOpen(true);
  }

  function handleDelete(category: CategoryDTO) {
    const confirmed = window.confirm(
      `Eliminar la categoria "${category.name}"? Los productos quedan sin categoria.`,
    );
    if (confirmed) remove.mutate(category.id);
  }

  function handleSubmit() {
    if (name.trim().length < 2) {
      toast.error("Ingresa un nombre de al menos 2 caracteres");
      return;
    }
    save.mutate();
  }

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Organiza el catalogo por tipo de prenda"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva categoria
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="flex h-60 items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : !categories || categories.length === 0 ? (
          <EmptyState
            icon={<Tags className="h-5 w-5" />}
            title="Todavia no hay categorias"
            description="Crea categorias para agrupar tus productos."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Crear categoria
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Categoria</Th>
                <Th className="text-center">Productos</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="transition hover:bg-stone-50/70">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.color ?? "#a8a29e" }}
                      />
                      <span className="font-medium text-stone-800">{category.name}</span>
                    </div>
                  </Td>
                  <Td className="text-center">
                    <Badge tone={category.productCount ? "brand" : "neutral"}>
                      {category.productCount ?? 0}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(category)}
                        className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category)}
                        className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                        title="Eliminar"
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar categoria" : "Nueva categoria"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={save.isPending}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Camisetas"
              autoFocus
            />
          </Field>

          <Field label="Color" hint="Se usa para identificar la categoria en el catalogo">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border border-stone-300 bg-white p-1"
              />
              <Input
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="font-mono"
              />
            </div>
          </Field>
        </div>
      </Modal>
    </>
  );
}
