import React, { useEffect, useState, useRef } from "react";
import { Viewer, Entity, PointGraphics, PathGraphics } from "resium";
import { Cartesian3, Color, JulianDate, SampledPositionProperty } from "cesium";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import * as satellite from "satellite.js";
import axios from "axios";
import "./App.css"; 

// --- Leaflet Icon Fix ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- Helper: Keeps the 2D Map Centered on Satellite ---
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom()); 
  }, [center, map]);
  return null;
}

function App() {
  const [selectedSat, setSelectedSat] = useState("ISS (ZARYA)"); 
  const [tleData, setTleData] = useState(null);
  const [positionProperty, setPositionProperty] = useState(null);
  const [satInfo, setSatInfo] = useState({ lat: 0, long: 0, alt: 0, vel: 0 });
  const [satRec, setSatRec] = useState(null); // Store the math model for live updates

  const [activeTab, setActiveTab] = useState("3D"); 
  const [viewMode, setViewMode] = useState("GLOBAL"); 
  const [statusMsg, setStatusMsg] = useState("Initializing...");
  const [statusColor, setStatusColor] = useState("orange");

  const viewerRef = useRef(null);
  const entityRef = useRef(null);
  const satList = ["ISS (ZARYA)", "CARTOSAT-3", "EOS-04", "HUBBLE ST", "LANDSAT 8", "TIANGONG"];

  // 1. FETCH DATA
  useEffect(() => {
    setStatusMsg(`Requesting ${selectedSat}...`);
    setStatusColor("yellow");
    setTleData(null);
    setPositionProperty(null);
    setSatRec(null);

    axios.get(`http://127.0.0.1:8000/api/tle/${encodeURIComponent(selectedSat)}`)
      .then((res) => {
        if (res.data.error) {
           setStatusMsg(`Backend Error: ${res.data.error}`);
           setStatusColor("red");
        } else {
           setStatusMsg(`TRACKING LIVE: ${res.data.name}`);
           setStatusColor("#00ff00"); // Green
           setTleData(res.data);
           initializeOrbit(res.data.line1, res.data.line2);
        }
      })
      .catch((err) => {
          setStatusMsg(`Network Error: Backend Offline`);
          setStatusColor("red");
      });
  }, [selectedSat]);

  // 2. INITIALIZE PATH (Visual Blue Line)
  const initializeOrbit = (line1, line2) => {
    const rec = satellite.twoline2satrec(line1, line2);
    setSatRec(rec); // Save for the heartbeat timer

    const property = new SampledPositionProperty();
    const now = JulianDate.now();
    
    // Calculate path for next 2 hours
    for (let i = 0; i < 7200; i += 20) { 
      const time = JulianDate.addSeconds(now, i, new JulianDate());
      const jsDate = JulianDate.toDate(time);
      const positionAndVelocity = satellite.propagate(rec, jsDate);
      
      if (!positionAndVelocity.position) continue;

      const gmst = satellite.gstime(jsDate);
      const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
      const position = Cartesian3.fromRadians(positionGd.longitude, positionGd.latitude, positionGd.height * 1000);
      
      property.addSample(time, position);
    }
    setPositionProperty(property);
  };

  // 3. THE HEARTBEAT (Updates Numbers & Map every 1 second)
  useEffect(() => {
    if (!satRec) return;

    const interval = setInterval(() => {
      const now = new Date(); // Current Real Time
      const positionAndVelocity = satellite.propagate(satRec, now);
      
      if (positionAndVelocity.position) {
        const gmst = satellite.gstime(now);
        const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

        setSatInfo({
          lat: (positionGd.latitude * 180 / Math.PI),
          long: (positionGd.longitude * 180 / Math.PI),
          alt: positionGd.height.toFixed(2),
          vel: Math.sqrt(Math.pow(positionAndVelocity.velocity.x, 2) + Math.pow(positionAndVelocity.velocity.y, 2) + Math.pow(positionAndVelocity.velocity.z, 2)).toFixed(2)
        });
      }
    }, 1000); // Run every 1000ms (1 second)

    return () => clearInterval(interval);
  }, [satRec]);

  // 4. POV TOGGLE
  const toggleCameraMode = () => {
    if (!viewerRef.current || !viewerRef.current.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;

    if (viewMode === "GLOBAL") {
      setViewMode("POV");
      if (entityRef.current) {
        viewer.trackedEntity = entityRef.current.cesiumElement;
      }
    } else {
      setViewMode("GLOBAL");
      viewer.trackedEntity = undefined;
    }
  };

  return (
    <div className="mission-control">
      <div className="dashboard">
        <div className="header"><span className="live-dot"></span> ORBITEYE LIVE</div>
        
        <select className="sat-selector" value={selectedSat} onChange={(e) => setSelectedSat(e.target.value)}>
          {satList.map(sat => <option key={sat} value={sat}>{sat}</option>)}
        </select>

        <div className="tab-container">
          <button className={`tab-btn ${activeTab === "3D" ? "active" : ""}`} onClick={() => setActiveTab("3D")}>3D GLOBE</button>
          <button className={`tab-btn ${activeTab === "2D" ? "active" : ""}`} onClick={() => setActiveTab("2D")}>2D MAP</button>
        </div>

        <div style={{borderLeft: `4px solid ${statusColor}`, paddingLeft: '10px', marginBottom: '15px', background: 'rgba(255,255,255,0.05)'}}>
            <small style={{color: '#aaa', fontSize: '10px'}}>SYSTEM STATUS</small><br/>
            <span style={{color: statusColor, fontWeight: 'bold', fontSize: '12px'}}>{statusMsg}</span>
        </div>

        {tleData && (
          <div className="data-grid">
            <div className="data-item">
               {activeTab === "3D" && (
                <button className="view-btn" onClick={toggleCameraMode} style={viewMode === "POV" ? {background: "#00e5ff", color: "black"} : {}}>
                  {viewMode === "GLOBAL" ? "📺 ENABLE SATELLITE POV" : "🌍 RESET TO GLOBAL VIEW"}
                </button>
              )}
            </div>

            <div className="data-item">
              <label>LIVE ALTITUDE</label>
              <h2>{satInfo.alt} <small>km</small></h2>
            </div>
            
            <div className="data-item">
              <label>LIVE VELOCITY</label>
              <h2>{satInfo.vel} <small>km/s</small></h2>
            </div>

            <div className="data-item">
              <label>GROUND TRACK</label>
              <p style={{fontFamily: 'monospace', color: '#00e5ff'}}>
                 LAT: {satInfo.lat.toFixed(4)}°<br/>
                 LNG: {satInfo.long.toFixed(4)}°
              </p>
            </div>
          </div>
        )}
      </div>

      {activeTab === "3D" && (
        <Viewer ref={viewerRef} timeline animation style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}>
          {positionProperty && (
            <Entity 
              key={selectedSat} 
              ref={entityRef} 
              name={selectedSat} 
              position={positionProperty} 
              selected
            >
              <PointGraphics pixelSize={15} color={Color.CYAN} outlineColor={Color.BLACK} outlineWidth={2} />
              <PathGraphics width={2} material={Color.CYAN.withAlpha(0.5)} leadTime={0} trailTime={5000} />
            </Entity>
          )}
        </Viewer>
      )}

      {activeTab === "2D" && (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}>
          <MapContainer center={[satInfo.lat, satInfo.long]} zoom={4} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            <Marker position={[satInfo.lat, satInfo.long]}><Popup><b>{selectedSat}</b><br/>{satInfo.alt} km</Popup></Marker>
            <MapUpdater center={[satInfo.lat, satInfo.long]} />
          </MapContainer>
        </div>
      )}
    </div>
  );
}

export default App;