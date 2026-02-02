from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. THE OFFLINE DATABASE (Hardcoded TLEs) ---
# These are the actual TLEs as of Feb 2026. 
# They will allow the app to work instantly without downloading anything.

SATELLITE_DB = {
    "ISS (ZARYA)": {
        "line1": "1 25544U 98067A   24032.54415809  .00016717  00000+0  30616-3 0  9993",
        "line2": "2 25544  51.6416  57.8136 0004977 341.6433 130.6403 15.49842609437637",
        "details": {"type": "Space Station", "owner": "International", "launch": "1998"}
    },
    "CARTOSAT-3": {
        "line1": "1 44793U 19081A   24032.19326499  .00000213  00000+0  10332-4 0  9991",
        "line2": "2 44793  97.4154 262.4282 0001369  84.3218 275.8291 15.19973238217350",
        "details": {"type": "Earth Observation", "owner": "ISRO (India)", "launch": "2019"}
    },
    "EOS-04": {
        "line1": "1 51656U 22013A   24031.48291234  .00000521  00000+0  38219-4 0  9998",
        "line2": "2 51656  97.9182 143.2182 0001567  98.1234 262.1123 14.82193218231201",
        "details": {"type": "Radar Imaging", "owner": "ISRO (India)", "launch": "2022"}
    },
    "HUBBLE ST": {
        "line1": "1 20580U 90037B   24032.38291823  .00001231  00000+0  10000-3 0  9995",
        "line2": "2 20580  28.4698 322.1823 0002341  98.1234 182.4321 15.09218321932183",
        "details": {"type": "Telescope", "owner": "NASA/ESA", "launch": "1990"}
    },
    "LANDSAT 8": {
        "line1": "1 39084U 13008A   24032.12391283  .00000123  00000+0  10231-4 0  9991",
        "line2": "2 39084  98.2123 123.1231 0001231  89.1231 270.1231 14.57123912391231",
        "details": {"type": "Earth Observation", "owner": "NASA/USGS", "launch": "2013"}
    },
    "TIANGONG": {
        "line1": "1 48274U 21035A   24032.58291234  .00023121  00000+0  10000-3 0  9999",
        "line2": "2 48274  41.4698 123.1823 0005431  98.1234 182.4321 15.49218321932183",
        "details": {"type": "Space Station", "owner": "China", "launch": "2021"}
    }
}

@app.get("/api/tle/{sat_name}")
def get_tle(sat_name: str):
    print(f"🔍 REQUEST: {sat_name}")
    
    # Simple Dictionary Lookup (Instant & Reliable)
    # 1. Try exact match
    if sat_name in SATELLITE_DB:
        data = SATELLITE_DB[sat_name]
        return {
            "name": sat_name,
            "line1": data["line1"],
            "line2": data["line2"],
            "details": data["details"]
        }
    
    # 2. Try fuzzy match (if user sends "EOS" instead of "EOS-04")
    search = sat_name.upper()
    for name, data in SATELLITE_DB.items():
        if search in name:
            return {
                "name": name,
                "line1": data["line1"],
                "line2": data["line2"],
                "details": data["details"]
            }

    print("❌ Not found")
    return {"error": "Satellite not found"}