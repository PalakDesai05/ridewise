import { AppLayout } from "@/components/layout/AppLayout";
import LeafletMap from "@/components/dashboard/LeafletMap";

// Separate Map page so users can access the live map directly,
// similar to Prediction, Upload, and Chatbot pages.
export default function MapPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Live Bike Availability Map
          </h1>
          <p className="mt-1 text-muted-foreground">
            Explore real-time bike availability and demand levels across stations.
          </p>
        </div>

        <LeafletMap />
      </div>
    </AppLayout>
  );
}

