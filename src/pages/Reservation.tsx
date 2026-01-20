import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import jsPDF from "jspdf";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useReservation, type LatestReservation } from "@/contexts/ReservationContext";
import { useAuth } from "@/contexts/AuthContext";

type TimeSlot = "Morning" | "Afternoon" | "Evening" | "Night";
type DemandLevel = "High" | "Medium" | "Low";

interface Station {
  station_id: string;
  station_name: string;
  lat: number;
  lng: number;
  available_bikes: number;
  demand_level: DemandLevel;
}

interface Reservation {
  reservation_id: string;
  station_id: string;
  station: string;
  date: string;
  time_slot: TimeSlot;
  predicted_demand: DemandLevel;
  price: number;
  status: string;
}

// Pricing rules (frontend mirrors backend; backend is source of truth)
function calculatePrice(demand: DemandLevel, timeSlot: TimeSlot): number {
  // Updated pricing: Low ₹200, Medium ₹300, High ₹400 (+₹100 Night surcharge)
  const demandPrice = demand === "High" ? 400 : demand === "Medium" ? 300 : 200;
  const nightSurcharge = timeSlot === "Night" ? 100 : 0;
  return demandPrice + nightSurcharge;
}

// Time slot options requested
const TIME_SLOTS: { value: TimeSlot; label: string }[] = [
  { value: "Morning", label: "Morning (6–10)" },
  { value: "Afternoon", label: "Afternoon (10–16)" },
  { value: "Evening", label: "Evening (16–20)" },
  { value: "Night", label: "Night (20–24)" },
];

export default function ReservationPage() {
  const location = useLocation();
  const { setLatestReservation } = useReservation();
  const { user } = useAuth();

  const [stations, setStations] = useState<Station[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [date, setDate] = useState<string>(today);
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("Morning");
  const [stationId, setStationId] = useState<string>("");
  const [predictedDemand, setPredictedDemand] = useState<DemandLevel>("Low");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastResponse, setLastResponse] = useState<ReserveResponse | null>(null);

  const [userReservations, setUserReservations] = useState<Reservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [editDate, setEditDate] = useState<string>(today);
  const [editTimeSlot, setEditTimeSlot] = useState<TimeSlot>("Morning");
  const [editStationId, setEditStationId] = useState<string>("");
  const [editPredictedDemand, setEditPredictedDemand] = useState<DemandLevel>("Low");

  // Fetch user reservations
  const fetchUserReservations = async () => {
    if (!user?.email) return;
    try {
      setLoadingReservations(true);
      const res = await fetch(`http://localhost:5000/api/reservations?user_email=${encodeURIComponent(user.email)}`);
      if (!res.ok) throw new Error(`Failed to fetch reservations (status ${res.status})`);
      const data = await res.json();
      setUserReservations(data.reservations || []);
    } catch (e) {
      console.error("Failed to fetch reservations:", e);
    } finally {
      setLoadingReservations(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserReservations();
    }
  }, [user]);

  const handleCancelReservation = async (reservationId: string) => {
    if (!user?.email) return;
    try {
      const res = await fetch(`http://localhost:5000/api/reservations/${reservationId}?user_email=${encodeURIComponent(user.email)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Failed to cancel reservation (status ${res.status})`);
      await fetchUserReservations(); // Refresh list
    } catch (e) {
      console.error("Failed to cancel reservation:", e);
    }
  };

  const openEditDialog = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setEditDate(reservation.date);
    setEditTimeSlot(reservation.time_slot);
    setEditStationId(reservation.station_id);
    setEditPredictedDemand(reservation.predicted_demand);
    setEditDialogOpen(true);
  };

  const handleEditReservation = async () => {
    if (!user?.email || !editingReservation) return;

    if (!editDate) {
      setSubmitError("Please select a date.");
      return;
    }
    if (!editTimeSlot) {
      setSubmitError("Please select a time slot.");
      return;
    }
    if (!editStationId) {
      setSubmitError("Please select a pickup station.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const res = await fetch(`http://localhost:5000/api/reservations/${editingReservation.reservation_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: user.email,
          date: editDate,
          time_slot: editTimeSlot,
          station_id: editStationId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to update reservation (status ${res.status})`);
      }
      setEditDialogOpen(false);
      setEditingReservation(null);
      await fetchUserReservations(); // Refresh list
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to update reservation");
    } finally {
      setIsSubmitting(false);
    }
  };

  // When edit station changes, auto-fill predicted demand
  useEffect(() => {
    if (editDialogOpen && editStationId) {
      const selected = stations.find((s) => s.station_id === editStationId);
      if (selected) setEditPredictedDemand(selected.demand_level);
    }
  }, [editStationId, stations, editDialogOpen]);

  // Load stations for dropdown (dynamic)
  useEffect(() => {
    const loadStations = async () => {
      try {
        setStationsLoading(true);
        setStationsError(null);
        const res = await fetch("http://localhost:5000/api/stations");
        if (!res.ok) throw new Error(`Failed to load stations (status ${res.status})`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid stations response format");
        setStations(data);
      } catch (e) {
        setStationsError(e instanceof Error ? e.message : "Failed to load stations");
      } finally {
        setStationsLoading(false);
      }
    };
    loadStations();
  }, []);

  // Prefill from Map -> Reservation navigation state
  useEffect(() => {
    const state = location.state as
      | { station_id?: string; demand_level?: DemandLevel }
      | null
      | undefined;

    if (state?.station_id) setStationId(state.station_id);
    if (state?.demand_level) setPredictedDemand(state.demand_level);
  }, [location.state]);

  // When station changes, auto-fill predicted demand (read-only field)
  useEffect(() => {
    const selected = stations.find((s) => s.station_id === stationId);
    if (selected) setPredictedDemand(selected.demand_level);
  }, [stationId, stations]);

  const stationName = useMemo(() => {
    return stations.find((s) => s.station_id === stationId)?.station_name ?? "";
  }, [stations, stationId]);

  const price = useMemo(() => calculatePrice(predictedDemand, timeSlot), [predictedDemand, timeSlot]);

  const downloadReceiptPdf = (reservation: ReserveResponse, demand: DemandLevel) => {
    // Student-friendly PDF generation using jsPDF
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("RideWise", 14, 18);

    doc.setFontSize(12);
    doc.text(`Reservation ID: ${reservation.reservation_id}`, 14, 32);
    doc.text(`Station: ${reservation.station}`, 14, 40);
    doc.text(`Date: ${reservation.date}`, 14, 48);
    doc.text(`Time Slot: ${reservation.time_slot}`, 14, 56);
    doc.text(`Demand Level: ${demand}`, 14, 64);
    doc.text(`Price Paid: ₹${reservation.price}`, 14, 72);
    doc.text(`Status: ${reservation.status}`, 14, 80);

    doc.save(`RideWise_Receipt_${reservation.reservation_id}.pdf`);
  };

  const handleReserve = async () => {
    setSubmitError(null);

    if (!date) {
      setSubmitError("Please select a date.");
      return;
    }
    if (!timeSlot) {
      setSubmitError("Please select a time slot.");
      return;
    }
    if (!stationId) {
      setSubmitError("Please select a pickup station.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("http://localhost:5000/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          time_slot: timeSlot,
          station_id: stationId,
          predicted_demand: predictedDemand,
          user_email: user?.email,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as Partial<ReserveResponse> & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Reservation failed (status ${res.status})`);
      }

      const confirmed = data as ReserveResponse;
      setLastResponse(confirmed);
      setReceiptOpen(true);

      // Update Dashboard immediately via shared context + localStorage
      const latest: LatestReservation = {
        reservation_id: confirmed.reservation_id,
        station: confirmed.station,
        date: confirmed.date,
        time_slot: confirmed.time_slot,
        price: confirmed.price,
        status: confirmed.status,
        predicted_demand: predictedDemand,
        station_id: stationId,
      };
      setLatestReservation(latest);
      
      // Refresh user reservations
      await fetchUserReservations();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to reserve bike");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bike Reservation</h1>
          <p className="mt-1 text-muted-foreground">
            Reserve a bike with dynamic pricing based on demand and time slot.
          </p>
        </div>

        {(stationsError || submitError) && (
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{submitError || stationsError}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Reserve a Bike</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select value={timeSlot} onValueChange={(v) => setTimeSlot(v as TimeSlot)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Pickup Station</Label>
                <Select
                  value={stationId}
                  onValueChange={(v) => setStationId(v)}
                  disabled={stationsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={stationsLoading ? "Loading stations..." : "Select station"} />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map((s) => (
                      <SelectItem key={s.station_id} value={s.station_id}>
                        {s.station_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Predicted Demand</Label>
                <Input value={predictedDemand} readOnly />
              </div>

              <div className="space-y-2">
                <Label>Price</Label>
                <Input value={`₹${price}`} readOnly />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleReserve}
              className="w-full sm:w-auto"
              disabled={isSubmitting || stationsLoading}
            >
              {isSubmitting ? "Reserving..." : "Reserve Bike"}
            </Button>
          </CardContent>
        </Card>

        {/* User Reservations */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Your Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingReservations ? (
              <p>Loading reservations...</p>
            ) : userReservations.length === 0 ? (
              <p>No reservations found. Make your first reservation above!</p>
            ) : (
              <div className="space-y-4">
                {userReservations.map((reservation) => (
                  <div key={reservation.reservation_id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{reservation.station}</p>
                        <p className="text-sm text-muted-foreground">
                          {reservation.date} - {reservation.time_slot}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">₹{reservation.price}</p>
                        <p className={`text-sm ${reservation.status === 'Confirmed' ? 'text-green-600' : 'text-red-600'}`}>
                          {reservation.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {reservation.status === 'Confirmed' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(reservation)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm("Are you sure you want to cancel this reservation?")) {
                                handleCancelReservation(reservation.reservation_id);
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Reservation Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Reservation</DialogTitle>
              <DialogDescription>Update your reservation details below.</DialogDescription>
            </DialogHeader>

            {submitError && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={editDate} 
                  onChange={(e) => setEditDate(e.target.value)}
                  min={today}
                />
              </div>

              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select value={editTimeSlot} onValueChange={(v) => setEditTimeSlot(v as TimeSlot)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pickup Station</Label>
                <Select
                  value={editStationId}
                  onValueChange={(v) => setEditStationId(v)}
                  disabled={stationsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={stationsLoading ? "Loading stations..." : "Select station"} />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map((s) => (
                      <SelectItem key={s.station_id} value={s.station_id}>
                        {s.station_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Predicted Demand</Label>
                <Input value={editPredictedDemand} readOnly />
              </div>

              <div className="space-y-2">
                <Label>Updated Price</Label>
                <Input value={`₹${calculatePrice(editPredictedDemand, editTimeSlot)}`} readOnly />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingReservation(null);
                  setSubmitError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleEditReservation}
                disabled={isSubmitting || stationsLoading}
              >
                {isSubmitting ? "Updating..." : "Update Reservation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation + Receipt */}
        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reservation Confirmed</DialogTitle>
              <DialogDescription>Your bike reservation has been created successfully.</DialogDescription>
            </DialogHeader>

            {lastResponse && (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Reservation ID:</span> {lastResponse.reservation_id}
                </p>
                <p>
                  <span className="font-medium">Station:</span> {lastResponse.station}
                </p>
                <p>
                  <span className="font-medium">Date:</span> {lastResponse.date}
                </p>
                <p>
                  <span className="font-medium">Time Slot:</span> {lastResponse.time_slot}
                </p>
                <p>
                  <span className="font-medium">Demand Level:</span> {predictedDemand}
                </p>
                <p>
                  <span className="font-medium">Price Paid:</span> ₹{lastResponse.price}
                </p>
                <p>
                  <span className="font-medium">Status:</span> {lastResponse.status}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReceiptOpen(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (lastResponse) downloadReceiptPdf(lastResponse, predictedDemand);
                }}
                disabled={!lastResponse}
              >
                Download Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

