import requests
import json
import jwt

url = "https://gyangrit-ld2s7sp2.livekit.cloud/twirp/livekit.Egress/StartRoomCompositeEgress"
room_name = "test-room"
api_key = "APIaYnaw5R7oGaM"
api_secret = "WcbjFatmePCw17vRbNm6RMa7e3RdXnruJtcUEOqoAib"

token = jwt.encode(
    {"video": {"room": room_name, "roomRecord": True}, "iss": api_key, "sub": "recording-bot"},
    api_secret, algorithm="HS256"
)

payload = {
    "room_name": "test-room",
    "file": {
        "filepath": "foo/bar/baz.mp4",
        "s3": {
            "access_key":  "foo",
            "secret":      "bar",
            "region":      "auto",
            "endpoint":    "https://foo.r2.cloudflarestorage.com",
            "bucket":      "qux",
            "force_path_style": True
        }
    },
    "layout": "speaker",
    "options": {
        "preset": "H264_1080P_30"
    }
}
resp = requests.post(url, json=payload, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
print("Status:", resp.status_code)
print("Body:", resp.text)
