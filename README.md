# Fieldnotes Dashboard

An objective learning and tracking dashboard designed to coordinate study, monthly reviews, and milestone progress between two users (e.g., a student and a peer/mentor).

## Features

* **Structured Curriculum:** 12 months of structured tasks, resources, and weekly habit tracking.
* **Shared Progress:** Real-time synchronization and status updates secured via access-code authentication.
* **Dual Views:** Student and Sibling/Mentor view modes with consolidated monthly review agendas.
* **Data Management:** Local browser storage fallback with JSON backup export and import functionality.

## Setup & Deployment

1. Set the `DASHBOARD_ACCESS_CODE` environment variable in your host environment.
2. Build and serve:
```bash
npm run build

```


3. Authenticate on the deployed site using your configured access code.