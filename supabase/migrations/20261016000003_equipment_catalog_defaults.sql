-- ============================================================
-- FILE: 20261016000003_equipment_catalog_defaults.sql
-- PURPOSE: Initialize default survey equipment & subparts catalog
--          in system_settings (Drone with battery/charger, Total Station, DGPS, etc.)
-- ============================================================

INSERT INTO public.system_settings (key, value, updated_at)
VALUES (
  'equipment_catalog',
  '{
    "items": [
      {
        "id": "eq-drone",
        "name": "Survey Drone / UAV",
        "category": "Aerial Survey",
        "code": "UAV-01",
        "description": "Multi-rotor mapping drone for aerial photogrammetry & terrain inspection",
        "subparts": [
          { "id": "sub-drone-bat", "name": "Intelligent Flight Battery", "defaultQuantity": 2, "isRequired": true },
          { "id": "sub-drone-chg", "name": "Battery Charging Hub & Power Cable", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-drone-rc", "name": "Remote Controller (with Screen / iPad)", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-drone-prop", "name": "Propellers (Pair)", "defaultQuantity": 4, "isRequired": true },
          { "id": "sub-drone-sd", "name": "High-Speed MicroSD Card", "defaultQuantity": 1, "isRequired": false },
          { "id": "sub-drone-case", "name": "Hard Shell Transport Case", "defaultQuantity": 1, "isRequired": false }
        ]
      },
      {
        "id": "eq-total-station",
        "name": "Total Station",
        "category": "Optical Survey",
        "code": "TS-01",
        "description": "High-precision electronic total station for boundary and topographic survey",
        "subparts": [
          { "id": "sub-ts-bat", "name": "Rechargeable Li-Ion Battery", "defaultQuantity": 2, "isRequired": true },
          { "id": "sub-ts-chg", "name": "Battery Charger & Adapter", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-ts-tripod", "name": "Heavy Duty Wooden / Aluminum Tripod", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-ts-tribrach", "name": "Tribrach with Optical Plummet", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-ts-pole", "name": "Telescopic Prism Pole", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-ts-prism", "name": "Prism Target & Holder", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-ts-case", "name": "Carrying Case & Rain Cover", "defaultQuantity": 1, "isRequired": false }
        ]
      },
      {
        "id": "eq-dgps-rover",
        "name": "DGPS Rover Unit",
        "category": "GNSS / Satellite",
        "code": "DGPS-R01",
        "description": "RTK GNSS rover receiver for real-time kinematic field positioning",
        "subparts": [
          { "id": "sub-rover-ant", "name": "GNSS Rover Antenna Receiver", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-rover-ctr", "name": "Handheld Data Collector / Controller", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-rover-bracket", "name": "Pole Bracket & Clamp Mount", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-rover-pole", "name": "Carbon Fiber Rover Pole (2m)", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-rover-bat", "name": "Li-Ion Receiver Batteries", "defaultQuantity": 2, "isRequired": true },
          { "id": "sub-rover-chg", "name": "Dual-Bay Battery Charger", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-rover-radio", "name": "UHF Radio Antenna", "defaultQuantity": 1, "isRequired": false }
        ]
      },
      {
        "id": "eq-dgps-base",
        "name": "DGPS Base Station",
        "category": "GNSS / Satellite",
        "code": "DGPS-B01",
        "description": "Static / RTK base station receiver with radio transmitter",
        "subparts": [
          { "id": "sub-base-ant", "name": "GNSS Base Receiver Unit", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-base-tripod", "name": "Heavy Wooden Survey Tripod", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-base-tribrach", "name": "Tribrach with Optical Plummet & Adapter", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-base-battery", "name": "External 12V Battery Pack", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-base-tape", "name": "Height Measuring Tape (Hi-Tape)", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-base-extradio", "name": "External High-Power Radio Transmitter", "defaultQuantity": 1, "isRequired": false },
          { "id": "sub-base-cable", "name": "Radio Connecting & Data Cables", "defaultQuantity": 1, "isRequired": false }
        ]
      },
      {
        "id": "eq-auto-level",
        "name": "Auto Level",
        "category": "Optical Survey",
        "code": "AL-01",
        "description": "Automatic optical leveling instrument for elevation and leveling",
        "subparts": [
          { "id": "sub-al-unit", "name": "Auto Level Optical Unit", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-al-tripod", "name": "Aluminum Tripod", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-al-staff", "name": "Telescopic Leveling Staff (5m)", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-al-plumb", "name": "Plumb Bob", "defaultQuantity": 1, "isRequired": false },
          { "id": "sub-al-case", "name": "Carrying Case", "defaultQuantity": 1, "isRequired": false }
        ]
      },
      {
        "id": "eq-tripod-tribrach",
        "name": "Tripod & Tribrach",
        "category": "Accessories",
        "code": "ACC-TT01",
        "description": "Mounting tripod and leveling tribrach assembly",
        "subparts": [
          { "id": "sub-tt-tripod", "name": "Survey Tripod", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-tt-tribrach", "name": "Tribrach Base", "defaultQuantity": 1, "isRequired": true }
        ]
      },
      {
        "id": "eq-prism-pole",
        "name": "Prism Pole & Target",
        "category": "Accessories",
        "code": "ACC-PP01",
        "description": "Telescopic pole with optical retroreflector prism",
        "subparts": [
          { "id": "sub-pp-pole", "name": "Graduated Telescopic Pole", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-pp-target", "name": "Reflector Prism Target & Canopy", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-pp-bipod", "name": "Pole Bipod Stand", "defaultQuantity": 1, "isRequired": false }
        ]
      },
      {
        "id": "eq-measuring-tape",
        "name": "Measuring Tape",
        "category": "Measuring Tools",
        "code": "ACC-MT01",
        "description": "Survey-grade long distance measuring tape",
        "subparts": [
          { "id": "sub-mt-tape", "name": "Steel / Fiberglass Measuring Tape (50m/100m)", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-mt-clip", "name": "End Hook & Tension Grip", "defaultQuantity": 1, "isRequired": false }
        ]
      }
    ]
  }'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;
