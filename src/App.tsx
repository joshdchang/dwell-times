import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { dwellTimeSchema, statesJsonSchema } from "./schema";
import colors from "tailwindcss/colors";

interface Coordinate {
  x: number;
  y: number;
}

interface StateProperties {
  name: string;
  density: number;
}

interface Geometry {
  type: string;
  coordinates: number[][][] | number[][][][];
}

interface Feature {
  type: string;
  id: string;
  properties: StateProperties;
  geometry: Geometry;
}

interface GeoJSON {
  type: string;
  features: Feature[];
}

// Constants for map boundaries (continental US)
const BOUNDS = {
  minLon: -125,
  maxLon: -67,
  minLat: 25,
  maxLat: 49,
  padding: 50,
  aspectRatio: 1.85,
};

const GRADIENT = [
  { value: 75, color: colors.red["500"] },
  { value: 50, color: colors.orange["500"] },
  { value: 35, color: colors.amber["500"] },
  { value: 25, color: colors.yellow["500"] },
  { value: 15, color: colors.lime["500"] },
  { value: 0, color: colors.green["500"] },
];

const railroads = ["CN", "NS", "UP", "CP", "BNSF", "KCS", "CSX"] as const;
type Railroad = (typeof railroads)[number];

function App() {
  let canvasRef: HTMLCanvasElement | undefined;

  const [stateData] = createResource<GeoJSON>(async () => {
    const response = await fetch("/us-states.json");
    return statesJsonSchema.parse(await response.json());
  });

  const [dwellTimeData] = createResource(async () => {
    const response = await fetch("/dwell_times.json");
    return dwellTimeSchema.parse(await response.json());
  });

  const [week, setWeek] = createSignal(43);
  const [year, setYear] = createSignal(2024);
  const [railroad, setRailroad] = createSignal<Railroad>();

  const filteredDwellTimes = createMemo(() => {
    if (dwellTimeData.loading) return [];
    return dwellTimeData()!.filter(
      (dwellTime) =>
        dwellTime.Week === week() &&
        dwellTime.Year === year() &&
        (!railroad() || dwellTime.Railroad === railroad())
    );
  });

  const dateForWeek = createMemo(() => {
    if (filteredDwellTimes().length > 0) {
      return new Date(filteredDwellTimes()[0].Date);
    }
  });

  const initializeCanvas = () => {
    if (!canvasRef) return;

    const container = canvasRef.parentElement;
    if (!container) return;

    // Get container width (accounting for padding)
    const containerWidth = container.clientWidth - 32;

    // Calculate height based on desired aspect ratio
    const desiredHeight = containerWidth / BOUNDS.aspectRatio;

    // Set canvas dimensions
    canvasRef.width = containerWidth;
    canvasRef.height = desiredHeight;
  };

  const projectCoordinates = (coords: number[]): Coordinate => {
    const lon = coords[0];
    const lat = coords[1];

    // Available space for drawing (accounting for padding)
    const mapWidth = canvasRef!.width - BOUNDS.padding * 2;
    const mapHeight = canvasRef!.height - BOUNDS.padding * 2;

    // Calculate scale factors while preserving aspect ratio
    const lonRange = BOUNDS.maxLon - BOUNDS.minLon;
    const latRange = BOUNDS.maxLat - BOUNDS.minLat;

    // Use the smaller scale to maintain aspect ratio
    const xScale = mapWidth / lonRange;
    const yScale = mapHeight / latRange;

    // Calculate centering offsets
    const xOffset = (mapWidth - lonRange * xScale) / 2 + BOUNDS.padding;
    const yOffset = (mapHeight - latRange * yScale) / 2 + BOUNDS.padding;

    // Project coordinates with centering
    const x = (lon - BOUNDS.minLon) * xScale + xOffset;
    const y = (BOUNDS.maxLat - lat) * yScale + yOffset;

    return { x, y };
  };

  const drawStates = (data: GeoJSON) => {
    if (!canvasRef) return;

    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    // Clear canvas with background color
    ctx.fillStyle = colors.sky["300"];
    ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);

    // Draw each state
    data.features.forEach((feature) => {
      ctx.beginPath();

      if (feature.geometry.type === "Polygon") {
        const coords = feature.geometry.coordinates as number[][][];
        coords.forEach((ring) => {
          ring.forEach((coord, i) => {
            const point = projectCoordinates(coord);
            if (i === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
        });
      } else if (feature.geometry.type === "MultiPolygon") {
        const coords = feature.geometry.coordinates as number[][][][];
        coords.forEach((polygon) => {
          polygon.forEach((ring) => {
            ring.forEach((coord, i) => {
              const point = projectCoordinates(coord);
              if (i === 0) {
                ctx.moveTo(point.x, point.y);
              } else {
                ctx.lineTo(point.x, point.y);
              }
            });
          });
        });
      }

      // Style the state
      ctx.strokeStyle = colors.slate["500"];
      ctx.lineWidth = 0.5;
      ctx.fillStyle = colors.white;

      ctx.fill();
      ctx.stroke();
    });
  };

  const drawDwellTimes = () => {
    if (!canvasRef) return;

    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    // Draw each yard
    filteredDwellTimes().forEach((dwellTime) => {
      const point = projectCoordinates([dwellTime.Longitude, dwellTime.Latitude]);

      // Draw a circle for each yard
      ctx.beginPath();
      ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
      for (const stop of GRADIENT) {
        if (dwellTime.Value >= stop.value) {
          ctx.fillStyle = stop.color;
          break;
        }
      }
      ctx.fill();
    });
  };

  const render = () => {
    initializeCanvas();
    if (!stateData.loading) {
      drawStates(stateData()!);
      drawDwellTimes();
    }
  };

  createEffect(() => {
    if (!stateData.loading) {
      render();
    }
  });

  onMount(() => {
    try {
      render();
      window.addEventListener("resize", render);
    } catch (error) {
      console.error("Error loading US states data:", error);
    }
  });

  onCleanup(() => {
    window.removeEventListener("resize", render);
  });

  return (
    <div class="w-full max-w-6xl mx-auto p-10 grid gap-6">
      <h1 class="text-2xl font-semibold text-slate-800">
        Railroad Terminal Dwell Time Map
      </h1>
      <canvas
        ref={canvasRef}
        class="border border-sky-500 rounded-lg shadow-sm max-w-full"
      />

      <div class="flex justify-between items-start flex-col lg:flex-row gap-8">
        <div class="flex gap-4 items-stretch">
          <div>
            <label class="block text-sm font-semibold text-slate-800">Year</label>
            <input
              type="number"
              class="mt-2 block w-28 px-4 h-10 text-slate-700 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:border-sky-500 focus:ring focus:ring-sky-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
              value={year()}
              onInput={(e) => setYear(parseInt(e.currentTarget.value))}
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-800">Week</label>
            <input
              type="number"
              class="mt-2 block w-28 px-4 h-10 text-slate-700 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:border-sky-500 focus:ring focus:ring-sky-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
              value={week()}
              onInput={(e) => setWeek(parseInt(e.currentTarget.value))}
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-800">Railroad</label>
            <div class="relative">
              <select
                class="mt-2 block w-28 px-3 h-10 text-slate-700 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:border-sky-500 focus:ring focus:ring-sky-500 focus:ring-opacity-50 transition duration-150 ease-in-out appearance-none"
                value={""}
                onChange={(e) => setRailroad(e.currentTarget.value as Railroad)}
              >
                <option value="">All</option>
                {railroads.map((rr) => (
                  <option value={rr}>{rr}</option>
                ))}
              </select>
              <div class="absolute right-3 top-0 bottom-0 flex items-center justify-center pointer-events-none">
                <svg
                  class="w-4 h-4 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-5 lg:items-end">
          <p>
            Dwell times for week of{" "}
            {dateForWeek()
              ? dateForWeek()!.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Loading..."}
          </p>
          <div class="flex gap-4">
            {GRADIENT.map((stop) => (
              <div class="flex gap-2 items-center">
                <div
                  class="w-4 h-4 rounded-full"
                  style={{ "background-color": stop.color }}
                />
                <span class="text-slate-500">{stop.value}+ h</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
