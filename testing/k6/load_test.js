// testing/k6/load_test.js
// Run: k6 run testing/k6/load_test.js
// Install: brew install k6

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 5  },  // ramp up to 5 users
    { duration: '20s', target: 10 },  // ramp up to 10 users
    { duration: '10s', target: 0  },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    http_req_failed:   ['rate<0.01'],   // less than 1% errors
  },
};

const BASE = 'https://gyangrit.onrender.com';

// Replace with a real session cookie from browser DevTools
const SESSION = 'YOUR_SESSION_COOKIE_HERE';

const headers = {
  Cookie: `gyangrit_sessionid=${SESSION}`,
  'Content-Type': 'application/json',
};

export default function () {
  // 1. Health check (public endpoint)
  const health = http.get(`${BASE}/api/v1/health/`);
  check(health, { 'health 200': (r) => r.status === 200 });

  // 2. List chat rooms (authenticated)
  const rooms = http.get(`${BASE}/api/v1/chat/rooms/`, { headers });
  check(rooms, { 'rooms 200': (r) => r.status === 200 });

  // 3. Notifications
  const notifs = http.get(`${BASE}/api/v1/notifications/`, { headers });
  check(notifs, { 'notifs 200': (r) => r.status === 200 });

  sleep(1);
}
