import { useState, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DatePickerProps {
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
  label?: string;
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                 "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEKDAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function formatDisplay(iso: string): string {
  if (!iso) return "Selecione a data";
  const [y, m, d] = iso.split("-").map(Number);
  const today = new Date();
  const sel   = new Date(y, m - 1, d);
  const todayIso = toIso(today);
  const yestIso  = toIso(new Date(today.getTime() - 86400000));
  if (iso === todayIso) return `Hoje, ${d} de ${MONTHS[m-1]}`;
  if (iso === yestIso)  return `Ontem, ${d} de ${MONTHS[m-1]}`;
  return `${String(d).padStart(2,"0")} de ${MONTHS[m-1]} de ${y}`;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(value ? parseInt(value.split("-")[0]) : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value ? parseInt(value.split("-")[1]) - 1 : today.getMonth());

  const todayIso = toIso(today);
  const yestIso  = toIso(new Date(today.getTime() - 86400000));

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    onChange(iso);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center gap-2.5 rounded-lg border bg-background px-3 text-left text-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {formatDisplay(value)}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-base">Selecionar data</DialogTitle>
          </DialogHeader>

          {/* Atalhos rápidos */}
          <div className="flex gap-2 px-5 pt-3">
            {[["Hoje", todayIso], ["Ontem", yestIso]].map(([label, iso]) => (
              <button key={label} type="button" onClick={() => { onChange(iso); setOpen(false); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  value === iso
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >{label}</button>
            ))}
          </div>

          {/* Navegação do mês */}
          <div className="flex items-center justify-between px-5 py-3">
            <button type="button" onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Grade de dias */}
          <div className="px-4 pb-5">
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(w => (
                <div key={w} className="py-1 text-center text-[10px] font-medium text-muted-foreground">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const iso = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const isSelected = iso === value;
                const isToday    = iso === todayIso;
                return (
                  <button key={day} type="button" onClick={() => selectDay(day)}
                    className={`flex h-9 w-full items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : isToday
                        ? "border border-primary text-primary"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >{day}</button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
