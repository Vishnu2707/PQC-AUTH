import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import * as jwksClient from "jwks-rsa";
import crypto, {
  generateKeyPairSync,
  KeyObject,
  randomUUID,
} from "crypto";
import multer from "multer";

// --- Expose PQC functions (Node/OpenSSL PQC build required) ---
const encapsulate = (crypto as any).encapsulate;
const decapsulate = (crypto as any).decapsulate;

// ---------- CONFIG ----------

const TENANT_ID = "278039d5-6d9e-4356-824d-6da7c24a97fe";
const ISSUER_V1 = `https://sts.windows.net/${TENANT_ID}/`;
const ISSUER_V2 = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;
const JWKS_URI = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;
const EXPECTED_AUDIENCE = "api://db729997-0598-48d0-9fc2-7ac368e8da81";

// ---------- TYPES & STORES ----------

type ChallengeRecord = {
  upn: string;
  sharedKey: string; // base64
  createdAt: number;
  used: boolean;
};

type SessionRecord = {
  user: string;
  secret: string;
  exp: number;
};

const challengeStore = new Map<string, ChallengeRecord>();
const sessionStore = new Map<string, SessionRecord>();

// ---------- PQC KEYS ----------

let kemPublicKey: KeyObject;
let kemPrivateKey: KeyObject;

function initKemKeys() {
  console.log("🔐 Generating ML-KEM-1024 key pair...");
  const { publicKey, privateKey } = generateKeyPairSync("ml-kem-1024" as any);
  kemPublicKey = publicKey;
  kemPrivateKey = privateKey;
  console.log("✅ ML-KEM-1024 keys ready");
}

// ---------- JWKS ----------

const client = jwksClient.default({ jwksUri: JWKS_URI });

function getKey(header: any, callback: (err: Error | null, key?: string) => void) {
  client.getSigningKey(header.kid, (err: Error | null, key: any) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// ---------- EXPRESS ----------

const app = express();
app.use(cors());
app.use(express.json());

// ---------- MULTER ----------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // ✅ 50MB
});

// ---------- HEALTH ----------

app.get("/health", (_req, res) => {
  res.json({ status: "ok", kem: kemPublicKey ? "ready" : "missing" });
});

// ---------- /pqc/start ----------

app.post("/pqc/start", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).send("Missing Bearer token");
    }

    const token = authHeader.substring("Bearer ".length);

    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        issuer: [ISSUER_V1, ISSUER_V2],
        audience: EXPECTED_AUDIENCE,
      },
      (err, decoded: any) => {
        if (err || !decoded) {
          console.error("JWT verify error:", err);
          return res.status(401).send("Invalid Entra token");
        }

        const upn =
          decoded.preferred_username || decoded.upn || decoded.oid;

        const { sharedKey, ciphertext } = encapsulate(kemPublicKey);

        const challengeId = `chl_${Date.now()}_${Math.floor(
          Math.random() * 1e6
        )}`;

        challengeStore.set(challengeId, {
          upn,
          sharedKey: sharedKey.toString("base64"),
          createdAt: Date.now(),
          used: false,
        });

        return res.json({
          challengeId,
          user: upn,
          kemAlg: "ML-KEM-1024",
          kemCiphertext: ciphertext.toString("base64"),
          sharedKeyPreview: sharedKey.subarray(0, 8).toString("hex"),
        });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error");
  }
});

// ---------- /pqc/verify ----------

app.post(
  "/pqc/verify",
  upload.single("video"),
  async (req, res) => {
    try {
      const { challengeId } = req.body;

      if (!challengeId) {
        return res.status(400).json({ error: "Missing challengeId" });
      }

      const record = challengeStore.get(challengeId);

      if (!record) {
        return res
          .status(400)
          .json({ error: "Invalid or expired challenge" });
      }

      if (record.used) {
        return res.status(400).json({ error: "Challenge already used" });
      }

      const ageMs = Date.now() - record.createdAt;
      if (ageMs > 5 * 60 * 1000) {
        challengeStore.delete(challengeId);
        return res.status(400).json({ error: "Challenge expired" });
      }

      if (!req.file || !req.file.buffer || req.file.size === 0) {
        return res.status(400).json({ error: "No video uploaded" });
      }

      // ✅ Stub biometric approval
      if (!req.file || req.file.size < 200000) {
        return res.status(400).json({ error: "Invalid or too small video" });
      }


      // ✅ Derive session secret from PQC shared key
      const sharedKey = Buffer.from(record.sharedKey, "base64");
      const sessionSecret = crypto
        .createHash("sha256")
        .update(sharedKey)
        .digest("base64");

      const sessionId = `sess_${randomUUID()}`;
      const now = Math.floor(Date.now() / 1000);
      const ttlSeconds = 5 * 60;

      const payload = {
        sub: record.upn,
        sid: sessionId,
        iat: now,
        exp: now + ttlSeconds,
        amr: ["pqc-video"],
      };

      const sessionToken = jwt.sign(payload, sessionSecret, {
        algorithm: "HS256",
      });

      sessionStore.set(sessionId, {
        user: record.upn,
        secret: sessionSecret,
        exp: now + ttlSeconds,
      });

      record.used = true;
      challengeStore.set(challengeId, record);

      return res.json({
        sessionToken,
        sessionId,
        expiresInSeconds: ttlSeconds,
        user: record.upn,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Verification failed" });
    }
  }
);

// ---------- MULTER + GLOBAL ERROR HANDLER ----------

app.use(
  (err: any, _req: express.Request, res: express.Response, _next: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Video file too large" });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }

    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
);

// ---------- SERVER ----------

const PORT = 4000;

initKemKeys();
app.listen(PORT, () => {
  console.log(`✅ PQC Gateway running on http://localhost:${PORT}`);
});
