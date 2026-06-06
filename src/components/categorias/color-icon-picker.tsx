import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ShoppingCart, Utensils, Car, Home, Heart, GraduationCap,
  Plane, Gamepad2, Shirt, Zap, Wifi, Phone, Coffee,
  Music, Film, Gift, Dumbbell, Pill, PiggyBank, Tag,
  Briefcase, Bus, Fuel, Baby, Dog, Wrench, CreditCard,
} from "lucide-react";
import * as LucideIcons from "lucide-react";

export const CATEGORY_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
];

export const CATEGORY_ICONS = [
  { name: "tag", icon: Tag, label: "Geral" },
  { name: "shopping-cart", icon: ShoppingCart, label: "Compras" },
  { name: "utensils", icon: Utensils, label: "Alimentação" },
  { name: "car", icon: Car, label: "Carro" },
  { name: "home", icon: Home, label: "Casa" },
  { name: "heart", icon: Heart, label: "Saúde" },
  { name: "graduation-cap", icon: GraduationCap, label: "Educação" },
  { name: "plane", icon: Plane, label: "Viagem" },
  { name: "gamepad-2", icon: Gamepad2, label: "Lazer" },
  { name: "shirt", icon: Shirt, label: "Roupas" },
  { name: "zap", icon: Zap, label: "Energia" },
  { name: "wifi", icon: Wifi, label: "Internet" },
  { name: "phone", icon: Phone, label: "Telefone" },
  { name: "coffee", icon: Coffee, label: "Café" },
  { name: "music", icon: Music, label: "Música" },
  { name: "film", icon: Film, label: "Cinema" },
  { name: "gift", icon: Gift, label: "Presente" },
  { name: "dumbbell", icon: Dumbbell, label: "Academia" },
  { name: "pill", icon: Pill, label: "Remédio" },
  { name: "piggy-bank", icon: PiggyBank, label: "Poupança" },
  { name: "briefcase", icon: Briefcase, label: "Trabalho" },
  { name: "bus", icon: Bus, label: "Transporte" },
  { name: "fuel", icon: Fuel, label: "Combustível" },
  { name: "baby", icon: Baby, label: "Bebê" },
  { name: "dog", icon: Dog, label: "Pet" },
  { name: "wrench", icon: Wrench, label: "Manutenção" },
  { name: "credit-card", icon: CreditCard, label: "Cartão" },
];

// Helper para renderizar ícone pelo nome
export function CategoryIcon({
  iconName,
  color,
  size = 20,
  className,
}: {
  iconName: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const found = CATEGORY_ICONS.find((i) => i.name === iconName);
  const Icon = found?.icon ?? Tag;
  return <Icon size={size} color={color} className={className} />;
}

interface ColorIconPickerProps {
  selectedColor: string;
  selectedIcon: string;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string) => void;
}

export function ColorIconPicker({
  selectedColor,
  selectedIcon,
  onColorChange,
  onIconChange,
}: ColorIconPickerProps) {
  const [tab, setTab] = useState<"color" | "icon">("color");

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: selectedColor }}
        >
          <CategoryIcon iconName={selectedIcon} color="white" size={22} />
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Prévia</p>
          <p>Escolha uma cor e um ícone</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {(["color", "icon"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "color" ? "Cor" : "Ícone"}
          </button>
        ))}
      </div>

      {/* Paleta de cores */}
      {tab === "color" && (
        <div className="grid grid-cols-6 gap-2">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
            >
              {selectedColor === color && (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white/30">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Grade de ícones */}
      {tab === "icon" && (
        <div className="grid grid-cols-5 gap-1.5">
          {CATEGORY_ICONS.map(({ name, icon: Icon, label }) => (
            <button
              key={name}
              type="button"
              onClick={() => onIconChange(name)}
              title={label}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl p-2 transition-colors",
                selectedIcon === name
                  ? "bg-primary/10 text-primary ring-1 ring-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] leading-tight">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
