"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

type Project = {
  id: string;
  title: string;
  location_lat: number;
  location_lng: number;
  location_address: string | null;
  status: string;
};

export default function MapPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from("projects")
        .select("id, title, location_lat, location_lng, location_address, status")
        .not("location_lat", "is", null)
        .not("location_lng", "is", null);
      setProjects((data as Project[]) ?? []);
    }

    load();
  }, []);

  if (!mounted) return <div className="text-gray-500">Loading map...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Project Map</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: "600px" }}>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <MapContainer
          center={[14.5, 121.0]}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {projects.map((p) => (
            <Marker key={p.id} position={[p.location_lat, p.location_lng]}>
              <Popup>
                <strong>{p.title}</strong>
                {p.location_address && <br />}
                {p.location_address}
                <br />
                <span className="text-xs">{p.status}</span>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {projects.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">
          No projects with locations yet. Add coordinates to your projects to see them on the map.
        </p>
      )}
    </div>
  );
}
