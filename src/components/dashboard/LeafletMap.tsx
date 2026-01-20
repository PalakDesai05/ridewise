import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L, { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";

// Student-friendly: define the TypeScript shape for a bike station
export interface BikeStation {
  station_id: string;
  station_name: string;
  lat: number;
  lng: number;
  available_bikes: number;
  demand_level: "High" | "Medium" | "Low";
}

interface LeafletMapProps {
  // Optional: allow parent to override height if needed
  heightClassName?: string;
}

// Fix for default Leaflet icon imports not working well in bundlers (like Vite)
// We create our own simple colored circle markers using Leaflet divIcons.
function createDemandIcon(color: string): Icon {
  return L.divIcon({
    className: "",
    html: `
      <div
        style="
          background-color: ${color};
          border-radius: 50%;
          width: 18px;
          height: 18px;
          border: 2px solid white;
          box-shadow: 0 0 4px rgba(0,0,0,0.6);
        "
      ></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

// Pre-create icons for each demand level (so they are not recreated on every render)
const highDemandIcon = createDemandIcon("#dc2626"); // red
const mediumDemandIcon = createDemandIcon("#eab308"); // yellow
const lowDemandIcon = createDemandIcon("#16a34a"); // green

// Student-friendly helper to pick the right icon based on demand
function getIconForDemand(demand: BikeStation["demand_level"]): Icon {
  switch (demand) {
    case "High":
      return highDemandIcon;
    case "Medium":
      return mediumDemandIcon;
    case "Low":
    default:
      return lowDemandIcon;
  }
}

export const LeafletMap: React.FC<LeafletMapProps> = ({ heightClassName }) => {
  const navigate = useNavigate();
  const [stations, setStations] = useState<BikeStation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Default center on India as requested
  const indiaCenter: [number, number] = useMemo(
    () => [20.5937, 78.9629],
    []
  );

  useEffect(() => {
    const fetchStations = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Student-friendly note:
        // We call the backend API as specified in the instructions.
        const response = await fetch("http://localhost:5000/api/stations");

        if (!response.ok) {
          throw new Error(`Failed to load stations (status ${response.status})`);
        }

        const data = await response.json();

        // Basic validation to avoid runtime errors if backend changes
        if (!Array.isArray(data)) {
          throw new Error("Invalid stations response format");
        }

        setStations(data);
      } catch (err) {
        console.error("[Map] Error fetching stations:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load bike stations"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchStations();
  }, []);

  // Simple Reserve button handler (placeholder, since no API is specified yet)
  const handleReserve = (station: BikeStation) => {
    // Navigate to Reservation page and pre-fill station + demand.
    navigate("/reservation", {
      state: {
        station_id: station.station_id,
        demand_level: station.demand_level,
      },
    });
  };

  return (
    <div className="map-layout flex w-full gap-4">
      <div className={`relative flex-1 ${heightClassName ?? "h-[420px]"}`}>
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
            <div className="flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm shadow-md">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span>Loading bike stations...</span>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p>Unable to load stations: {error}</p>
            <p className="mt-1 text-xs">
              Please make sure the backend is running at{" "}
              <code>http://localhost:5000</code> and the{" "}
              <code>/api/stations</code> endpoint is available.
            </p>
          </div>
        )}

        {/* Main Leaflet map */}
        <MapContainer
          center={indiaCenter}
          zoom={6}
          scrollWheelZoom={true}
          className="h-full w-full rounded-lg border"
        >
          {/* OpenStreetMap tiles as requested */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Dynamic station markers */}
          {stations.map((station) => (
            <Marker
              key={station.station_id}
              position={[station.lat, station.lng]}
              icon={getIconForDemand(station.demand_level)}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{station.station_name}</p>
                  <p>
                    <span className="font-medium">Available Bikes:</span>{" "}
                    {station.available_bikes}
                  </p>
                  <p>
                    <span className="font-medium">Demand Level:</span>{" "}
                    {station.demand_level}
                  </p>
                  <button
                    onClick={() => handleReserve(station)}
                    className="mt-2 w-full rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Reserve Bike
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend outside the map, on the right */}
      <div className="demand-legend w-48 shrink-0 self-start rounded-lg border bg-white p-3 text-sm shadow-card">
        <p className="mb-2 text-base font-semibold">Demand Levels</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg" role="img" aria-label="Low Demand">
              🟢
            </span>
            <span>Low Demand</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg" role="img" aria-label="Medium Demand">
              🟡
            </span>
            <span>Medium Demand</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg" role="img" aria-label="High Demand">
              🔴
            </span>
            <span>High Demand</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeafletMap;

