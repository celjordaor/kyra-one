import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isYesterday, parseISO, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface DatePickerProps {
  value: string; // yyyy-MM-dd
  onChange: (value: string) => void;
  label?: string;
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  const selected = value ? parseISO(value) : new Date();
  const [viewMonth, setViewMonth] = useState(selected);
  const [open, setOpen] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const yesterdayStr = format(subMonths(new Date(), 0), "yyyy-MM-dd");

  // Calcula ontem corretamente
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayFmt = format(yesterday, "yyyy-MM-dd");

  const isSelectedToday = value === todayStr;
  const isSelectedYesterday = value === yesterdayFmt;

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Offset para alinhar com dia da semana (0=Dom)
  const startOffset = getDay(monthStart);

  const handleDayClick = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"));
    setOpen(false);
  };

  const displayLabel = () => {
    if (!value) return "Selecionar data";
    if (isSelectedToday) return "Hoje";
    if (isSelectedYesterday) return "Ontem";
    const d = parseISO(value);
    return format(d, "dd 'de' MMM. yyyy", { locale: ptBR });
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      {/* Botões rápidos */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(todayStr)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            isSelectedToday
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-foreground hover:bg-accent"
          )}
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={() => onChange(yesterdayFmt)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            isSelectedYesterday
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-foreground hover:bg-accent"
          )}
        >
          Ontem
        </button>

        {/* Botão Outros — abre calendário */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                !isSelectedToday && !isSelectedYesterday
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground hover:bg-accent"
              )}
            >
              {!isSelectedToday && !isSelectedYesterday ? (
                displayLabel()
              ) : (
                <>
                  <Calendar className="h-3.5 w-3.5" />
                  Outros...
                </>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            {/* Header do mês */}
            <div className="flex items-center justify-between bg-primary px-4 py-3">
              <div>
                <p className="text-xs font-medium text-primary-foreground/70">
                  {format(viewMonth, "yyyy")}
                </p>
                <p className="text-lg font-bold text-primary-foreground capitalize">
                  {format(viewMonth, "EEE., d 'de' MMM.", { locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Navegação */}
            <div className="flex items-center justify-between px-4 py-2">
              <button
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold capitalize text-foreground">
                {format(viewMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Grade de dias */}
            <div className="px-3 pb-3">
              <div className="mb-1 grid grid-cols-7 text-center">
                {WEEKDAYS.map((d, i) => (
                  <span key={i} className="py-1 text-[11px] font-medium text-muted-foreground">
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5 text-center">
                {/* Células vazias para offset */}
                {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {days.map((day) => {
                  const isSelected = isSameDay(day, selected);
                  const todayDay = isToday(day);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                        isSelected
                          ? "bg-primary font-bold text-primary-foreground"
                          : todayDay
                          ? "border border-primary font-semibold text-primary"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-2 border-t border-border px-4 py-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-primary"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-primary"
              >
                OK
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
