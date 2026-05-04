// Mock vehicle data shaped to match Tesla Fleet API response structures.
// Real Fleet API docs: https://developer.tesla.com/docs/fleet-api
// Replace this with real API calls once Tesla developer access is approved.

export const mockVehicles = [
  {
    id: 100021266,
    vehicle_id: 1492931566,
    vin: "5YJSA1E47PF000001",
    display_name: "Plaid Rocket",
    model: "model-s-plaid",
    state: "online",
    color: "Red Multi-Coat",
    api_version: 71,
    charge_state: {
      battery_level: 87,
      battery_range: 348.2,
      charging_state: "Disconnected",
      charge_limit_soc: 90,
      time_to_full_charge: 0,
    },
    climate_state: {
      inside_temp: 22.5,
      outside_temp: 18.0,
      driver_temp_setting: 21.0,
      passenger_temp_setting: 21.0,
      is_climate_on: false,
      is_auto_conditioning_on: false,
    },
    drive_state: {
      latitude: 35.6266,
      longitude: -120.6907,
      speed: 0,
      shift_state: "P",
    },
    vehicle_state: {
      odometer: 4521.3,
      locked: true,
      sentry_mode: true,
      software_update: { status: "", version: "2024.20.1" },
    },
  },
  {
    id: 100021267,
    vehicle_id: 1492931567,
    vin: "5YJ3E1EA4PF000002",
    display_name: "Daily Driver",
    model: "model-3",
    state: "asleep",
    color: "Pearl White Multi-Coat",
    api_version: 71,
    charge_state: {
      battery_level: 64,
      battery_range: 172.8,
      charging_state: "Disconnected",
      charge_limit_soc: 80,
      time_to_full_charge: 0,
    },
    climate_state: {
      inside_temp: 19.5,
      outside_temp: 18.0,
      driver_temp_setting: 20.0,
      passenger_temp_setting: 20.0,
      is_climate_on: false,
      is_auto_conditioning_on: false,
    },
    drive_state: {
      latitude: 35.6266,
      longitude: -120.6907,
      speed: 0,
      shift_state: "P",
    },
    vehicle_state: {
      odometer: 12483.7,
      locked: true,
      sentry_mode: false,
      software_update: { status: "", version: "2024.20.1" },
    },
  },
];

export function getVehicleById(id) {
  return mockVehicles.find((v) => String(v.id) === String(id));
}
