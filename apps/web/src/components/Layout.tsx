import { NavLink, Outlet } from "react-router-dom";
import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Receipt,
  Shirt,
  ShoppingCart,
  Tags,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/", label: "Panel", icon: LayoutDashboard, end: true },
  { to: "/pos", label: "Punto de venta", icon: ShoppingCart },
  { to: "/productos", label: "Productos", icon: Shirt },
  { to: "/ventas", label: "Ventas", icon: Receipt },
  { to: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { to: "/categorias", label: "Categorias", icon: Tags },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-[68px] shrink-0 flex-col border-r border-stone-200 bg-white lg:w-64">
        <div className="flex h-16 items-center gap-2.5 px-3 lg:px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
            C
          </div>
          <div className="hidden min-w-0 lg:block">
            <p className="text-sm font-semibold leading-tight text-stone-900">Caramelo</p>
            <p className="text-xs text-stone-400">Inventario</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-3 lg:px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-stone-100 p-2 lg:p-3">
          <div className="mb-1 hidden px-2 lg:block">
            <p className="truncate text-sm font-medium text-stone-800">{user?.name}</p>
            <p className="truncate text-xs text-stone-400">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Cerrar sesion"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className="hidden lg:inline">Cerrar sesion</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
