# Backend Dispatch Gateway URLs for On-Field Mobile Reporting & Photo Upload

This document details the backend gateway endpoints, host URLs, and networking configuration used for on-field reporting, GPS telemetry, and incident photo uploading via mobile devices.

---

## 1. Quick Summary of Gateway URLs

| Purpose | Access Mode | Gateway / Endpoint URL | Method |
| :--- | :--- | :--- | :--- |
| **Mobile On-Field Photo & Report Upload** | **Mobile (LAN / Wi-Fi)** | `http://10.109.198.227:5050/api/field-reports` | `POST` |
| **Mobile Dashboard & Web App Interface** | **Mobile (LAN / Wi-Fi)** | `http://10.109.198.227:5050/` | `GET` |
| **Mobile API Gateway Root** | **Mobile (LAN / Wi-Fi)** | `http://10.109.198.227:5050/api` | `GET / POST` |
| **Local Machine Report & Photo Upload** | **Localhost** | `http://localhost:5050/api/field-reports` | `POST` |
| **Local Machine Web App** | **Localhost** | `http://localhost:5050/` | `GET` |
| **Live Incident Feed / Photo Listing** | **Mobile or Local** | `http://10.109.198.227:5050/api/field-reports` | `GET` |
| **Real-Time Dispatch Alert Stream** | **SSE Stream** | `http://10.109.198.227:5050/api/stream/alerts` | `GET` |

---

## 2. Network & Server Configuration

- **Server File**: `frontend/api/app.py`
- **Host Binding**: `0.0.0.0` *(Configured to listen on all network interfaces, allowing external mobile devices to connect)*
- **Port**: `5050`
- **Current Active Machine Wi-Fi IP**: `10.109.198.227`
- **CORS Support**: `CORS(app)` enabled across all routes, allowing cross-origin requests from mobile clients or hybrid apps.

---

## 3. How to Connect from a Mobile Device on the Field

1. **Network Pairing**:
   - Ensure the mobile phone and the server laptop are connected to the same Wi-Fi network or Mobile Hotspot.
   - If using a phone hotspot, connect the laptop to the phone hotspot and update the IP address accordingly.
2. **Access the Mobile Field Reporting Interface**:
   - Open a mobile browser (Chrome / Safari / Firefox) and navigate to:
     ```
     http://10.109.198.227:5050
     ```
   - Tap on **Citizen Field Reports** or click **Submit Field Report**.
   - Tap **📡 GPS** to capture real-time device coordinates via HTML5 Geolocation API.
   - Fill in the hazard details and submit.

---

## 4. API Request Payload Specification

### `POST /api/field-reports`

Endpoint for mobile dispatch devices to submit field hazard data and photo references.

#### Headers
```http
Content-Type: application/json
```

#### JSON Payload Example
```json
{
  "incident_type": "Landslide",
  "severity": "Critical",
  "road_id": "NH-2",
  "description": "Active debris blocking southbound lane near mile marker 42.",
  "lat": 24.8170,
  "lon": 93.9440,
  "photo_url": "https://storage.googleapis.com/sih-field-photos/2026/09/incident_42.jpg",
  "photo_base64": "data:image/jpeg;base64,...",
  "reporter_id": "DISPATCH-MOBILE-01"
}
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "report_id": "RPT-USR-83921",
  "status": "Submitted for Verification"
}
```

---

## 5. Verification & Testing with cURL

You can verify the mobile gateway upload endpoint directly from terminal or mobile terminal (Termux / Shortcuts):

```bash
curl -X POST http://10.109.198.227:5050/api/field-reports \
  -H "Content-Type: application/json" \
  -d '{
    "incident_type": "Road Damage",
    "severity": "High",
    "road_id": "NH-37",
    "description": "Pothole expansion and waterlogging after heavy rain",
    "lat": 24.805,
    "lon": 93.935,
    "photo_url": "https://example.com/field_photos/photo1.jpg"
  }'
```
