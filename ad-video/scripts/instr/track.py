"""
מעקב פר־פריים על סרטון ההנחיות:
  1. מסכת גוף (selfie segmentation)  -> כתוביות מאחוריך + חיתוך רקע
  2. מיקום וגודל הפנים                -> כתוביות שעוקבות אחרי הראש
  3. תנועת המצלמה (זרימה אופטית על הרקע בלבד) -> פצצה נעולה לחלל

פלט: PNG של הגוף עם שקיפות לכל פריים + tracking.json
"""
import json, os, sys
import cv2, numpy as np
import mediapipe as mp

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(f"{OUT}/person", exist_ok=True)

cap = cv2.VideoCapture(SRC)
fps = cap.get(cv2.CAP_PROP_FPS)
seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0)
fd = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.4)

prev_gray = None
prev_bgmask = None
cam_x = cam_y = 0.0
cam_s = 1.0
mask_ema = None
frames = []
i = 0
while True:
    ok, frame = cap.read()
    if not ok:
        break
    h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # ── 1 · מסכת גוף, מוחלקת בזמן כדי למנוע ריצוד בשוליים ──
    m = seg.process(rgb).segmentation_mask.astype(np.float32)
    mask_ema = m if mask_ema is None else 0.55 * m + 0.45 * mask_ema
    soft = np.clip((mask_ema - 0.35) / 0.3, 0, 1)
    soft = cv2.GaussianBlur(soft, (5, 5), 0)
    rgba = np.dstack([frame, (soft * 255).astype(np.uint8)])
    cv2.imwrite(f"{OUT}/person/{i:05d}.png", rgba)

    # ── 2 · פנים ──
    face = None
    r = fd.process(rgb)
    if r.detections:
        d = max(r.detections, key=lambda d: d.score[0])
        b = d.location_data.relative_bounding_box
        face = {"cx": b.xmin + b.width / 2, "cy": b.ymin + b.height / 2,
                "w": b.width, "h": b.height, "score": float(d.score[0])}

    # ── 3 · תנועת מצלמה: רק נקודות מהרקע (מחוץ לגוף) ──
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    bgmask = ((soft < 0.15) * 255).astype(np.uint8)
    bgmask = cv2.erode(bgmask, np.ones((15, 15), np.uint8))
    dx = dy = 0.0
    ds = 1.0
    nmatch = 0
    if prev_gray is not None:
        pts = cv2.goodFeaturesToTrack(prev_gray, 300, 0.01, 8, mask=prev_bgmask)
        if pts is not None and len(pts) >= 8:
            nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev_gray, gray, pts, None,
                                                   winSize=(21, 21), maxLevel=3)
            good = st.reshape(-1) == 1
            p0, p1 = pts[good], nxt[good]
            nmatch = int(len(p0))
            if len(p0) >= 8:
                M, inl = cv2.estimateAffinePartial2D(p0, p1, method=cv2.RANSAC,
                                                     ransacReprojThreshold=2.0)
                if M is not None:
                    dx, dy = float(M[0, 2]), float(M[1, 2])
                    ds = float(np.hypot(M[0, 0], M[1, 0]))
    cam_x += dx
    cam_y += dy
    cam_s *= ds

    frames.append({"i": i, "face": face,
                   "cam": {"x": cam_x, "y": cam_y, "s": cam_s, "n": nmatch}})
    prev_gray, prev_bgmask = gray, bgmask
    i += 1
    if i % 200 == 0:
        print(f"  {i} frames", flush=True)

json.dump({"fps": fps, "w": w, "h": h, "count": i, "frames": frames},
          open(f"{OUT}/tracking.json", "w"))
print(f"done: {i} frames @ {fps:.2f}fps, {w}x{h}")
