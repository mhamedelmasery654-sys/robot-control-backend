# Portfolio robot simulator WebSocket

The public portfolio uses a visual simulator at `wss://robot-control-backend.onrender.com/api/v1/demo/ws`. This endpoint moves only the browser-rendered 3D model. It is intentionally separate from the authenticated `/api/v1/ws` event stream and does not send commands to Arduino, ESP32, Bluetooth, or a physical robot.

The server accepts the GitHub Pages origin `https://mhamedelmasery654-sys.github.io` and local portfolio origins listed in `render.yaml`. Each open demo connection joins a FIFO queue. One visitor at a time holds a 120-second lease. Disconnect or release stops motion and advances the queue. A visitor can rejoin the end of the queue with `{"type":"join"}`.

## Client messages

All messages are JSON and limited to 2 KiB. Motion values are clamped to `[-1, 1]`; device and screen indexes are validated. Only the current lease holder may change the shared simulation.

| Type | Fields | Effect |
| --- | --- | --- |
| `drive` | `forward`, `turn` numbers | Sets the shared differential-drive input; zero stops. |
| `lights` | `enabled` boolean | Toggles the simulated robot lights. |
| `device` | `index` integer `0..2` | Selects gamepad, TV remote, or laptop for everyone. |
| `screen` | `index` integer `0..3` | Changes the shared laptop image. |
| `release` | none | Releases the lease and leaves the queue. |
| `join` | none | Joins the end of the queue after releasing. |

## Server messages

The server sends a `snapshot` on connection and then about ten times per second. It contains `self` (`id`, `isHolder`, and `queuePosition`), `visitorCount`, `queueLength`, `holderRemainingMs`, and `control` (`x`, `z`, `yaw`, `forward`, `turn`, `speed`, `lights`, `device`, and `screenIndex`). Error frames use `{ "type": "error", "code": "NOT_YOUR_TURN" }` or a specific validation code.

The queue and simulation live in this Render process's memory. They are shared across browsers connected to the current single service instance; horizontal scaling requires a shared lease/state store before enabling multiple instances.

