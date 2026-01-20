import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface LatestReservation {
  reservation_id: string;
  station: string;
  date: string; // YYYY-MM-DD
  time_slot: "Morning" | "Afternoon" | "Evening" | "Night";
  price: number;
  status: "Confirmed";
  // Optional extra fields for receipt/UI
  predicted_demand?: "High" | "Medium" | "Low";
  station_id?: string;
}

const STORAGE_KEY = "ridewise_latest_reservation";

interface ReservationContextValue {
  latestReservation: LatestReservation | null;
  setLatestReservation: (r: LatestReservation | null) => void;
}

const ReservationContext = createContext<ReservationContextValue | undefined>(
  undefined
);

export function ReservationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [latestReservation, setLatestReservationState] =
    useState<LatestReservation | null>(null);

  // Load from localStorage on mount (so refresh doesn't lose the latest reservation)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLatestReservationState(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const setLatestReservation = (r: LatestReservation | null) => {
    setLatestReservationState(r);
    try {
      if (r) localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  };

  const value = useMemo(
    () => ({ latestReservation, setLatestReservation }),
    [latestReservation]
  );

  return (
    <ReservationContext.Provider value={value}>
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservation() {
  const ctx = useContext(ReservationContext);
  if (!ctx) {
    throw new Error("useReservation must be used within ReservationProvider");
  }
  return ctx;
}

