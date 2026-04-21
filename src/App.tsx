import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup } from "firebase/auth";

type AuthMode = "signin" | "signup";

type UserRecord = {
  email: string;
  password: string;
  provider: "local" | "google";
  createdAt: number;
};

type UsersDB = Record<string, UserRecord>;

type Progress = {
  currentLevel: number;
  startedAt: number;
  fails: number;
  seed: number;
  completedAt?: number;
};

type ChallengeKind =
  | "arithmetic"
  | "image"
  | "randomfall"
  | "luck"
  | "reverse"
  | "count"
  | "minmax"
  | "binary";

type Challenge = {
  kind: ChallengeKind;
  prompt: string;
  answer?: string;
  options?: number[];
  imageCode?: string;
  targetSymbol?: string;
  targetClicks?: number;
  luckySlot?: number;
};

type LeaderboardEntry = {
  username: string;
  displayName: string;
  avatar: string;
  currentLevel: number;
  startedAt: number;
  fails: number;
  completedAt?: number;
};

type ThemeStyle = "classic" | "grid" | "noise";
type ColorMode = "light" | "dark";

type UserProfile = {
  displayName: string;
  avatar: string;
  themeStyle: ThemeStyle;
  colorMode: ColorMode;
};

type ProfilesDB = Record<string, UserProfile>;

type FallToken = {
  id: number;
  x: number;
  symbol: string;
  durationMs: number;
};

const TOTAL_LEVELS = 50;
const USERS_KEY = "uu_users_v1";
const SESSION_KEY = "uu_session_user_v1";
const PROFILES_KEY = "uu_profiles_v1";
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

function getFirebaseAuth() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  const app =
    getApps()[0] ??
    initializeApp({
      apiKey,
      authDomain,
      projectId,
      appId
    });

  return getAuth(app);
}

function readUsers(): UsersDB {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "{}") as UsersDB;
  } catch {
    return {};
  }
}

function writeUsers(users: UsersDB): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function readProfiles(): ProfilesDB {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? "{}") as ProfilesDB;
  } catch {
    return {};
  }
}

function writeProfiles(profiles: ProfilesDB): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function defaultProfile(handle: string): UserProfile {
  return {
    displayName: handle,
    avatar: "",
    themeStyle: "classic",
    colorMode: "light"
  };
}

function avatarFallback(name: string): string {
  const safe = name.trim();
  return safe ? safe.slice(0, 1).toUpperCase() : "U";
}

function progressKey(username: string): string {
  return `uu_progress_${username}`;
}

function readProgress(username: string): Progress {
  try {
    const raw = localStorage.getItem(progressKey(username));
    if (!raw) {
      return {
        currentLevel: 1,
        startedAt: Date.now(),
        fails: 0,
        seed: Math.floor(Math.random() * 1_000_000)
      };
    }
    const parsed = JSON.parse(raw) as Progress;
    return {
      currentLevel: Math.max(1, parsed.currentLevel || 1),
      startedAt: parsed.startedAt || Date.now(),
      fails: parsed.fails || 0,
      seed: Number.isFinite(parsed.seed) ? parsed.seed : Math.floor(Math.random() * 1_000_000),
      completedAt: parsed.completedAt
    };
  } catch {
    return {
      currentLevel: 1,
      startedAt: Date.now(),
      fails: 0,
      seed: Math.floor(Math.random() * 1_000_000)
    };
  }
}

function writeProgress(username: string, progress: Progress): void {
  localStorage.setItem(progressKey(username), JSON.stringify(progress));
}

function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pick<T>(items: T[], seed: number): T {
  return items[Math.floor(rand(seed) * items.length) % items.length];
}

function noisyString(level: number): string {
  const chars = "A23456789BCDEFGHJKLMNPQRSTUVWXYZ";
  const len = 5;
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(rand(level * 100 + i) * chars.length)];
  }
  return out;
}

function makeChallenge(level: number, seed: number): Challenge {
  const kinds: ChallengeKind[] = [
    "arithmetic",
    "image",
    "randomfall",
    "luck",
    "reverse",
    "count",
    "minmax",
    "binary"
  ];
  const kind = kinds[(level + seed) % kinds.length];
  const pressure = Math.max(1, Math.floor(level / 8));

  if (kind === "arithmetic") {
    const a = Math.floor(rand(seed + level) * (30 + pressure * 12));
    const b = Math.floor(rand(seed + level + 1) * (30 + pressure * 12));
    const c = Math.floor(rand(seed + level + 2) * (5 + pressure));
    const d = Math.floor(rand(seed + level + 3) * (6 + pressure));
    return {
      kind,
      prompt: `CAPTCHA ${level}: Solve (((${a} + ${b}) x ${c}) - ${d}) exactly.`,
      answer: String((a + b) * c - d)
    };
  }

  if (kind === "image") {
    const imageCode = noisyString(level + seed);
    return {
      kind,
      imageCode,
      prompt: "Image captcha: type the exact characters shown below (case sensitive).",
      answer: imageCode
    };
  }

  if (kind === "randomfall") {
    const symbols = ["@", "#", "$", "%", "&", "*", "?"];
    const targetSymbol = pick(symbols, seed + level * 4.3);
    const targetClicks = 3 + Math.floor(rand(seed + level * 91) * 3);
    return {
      kind,
      targetSymbol,
      targetClicks,
      prompt: `Random-fall captcha: click '${targetSymbol}' exactly ${targetClicks} times, then verify.`
    };
  }

  if (kind === "luck") {
    const luckySlot = 1 + Math.floor(rand(seed + level * 17.5) * 6);
    return {
      kind,
      luckySlot,
      prompt: "Luck captcha: pick one slot (1-6). Only one slot is valid this round."
    };
  }

  if (kind === "reverse") {
    const source = noisyString(level + seed).slice(0, 4 + pressure);
    return {
      kind,
      prompt: `Reverse captcha: type this token backwards exactly -> ${source}`,
      answer: source.split("").reverse().join("")
    };
  }

  if (kind === "count") {
    const source = `${noisyString(level + seed + 77)}${noisyString(level + seed + 15)}`;
    const needle = pick(["A", "2", "7", "B", "Q", "8"], seed + level * 3.1);
    const count = source.split("").filter((c) => c === needle).length;
    return {
      kind,
      prompt: `Count captcha: how many '${needle}' are in this token stream?\n${source}`,
      answer: String(count)
    };
  }

  if (kind === "minmax") {
    const opts = Array.from({ length: 6 }, (_, idx) =>
      Math.floor(rand(seed + level * (idx + 3)) * 90) + pressure
    );
    const target = level % 2 === 0 ? Math.min(...opts) : Math.max(...opts);
    return {
      kind,
      prompt: `Selection captcha: choose the ${level % 2 === 0 ? "SMALLEST" : "LARGEST"} number only.`,
      answer: String(target),
      options: opts
    };
  }

  const n = 13 + ((level * 7 + seed) % 230);
  return {
    kind,
    prompt: `Binary captcha: write ${n} in binary (no spaces).`,
    answer: n.toString(2)
  };
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const hours = Math.floor(s / 3600)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = (s % 60).toString().padStart(2, "0");
  return `${hours}:${mins}:${secs}`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };
    img.src = objectUrl;
  });
}

async function createAvatarDataUrl(file: File): Promise<string> {
  const image = await loadImageFromFile(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.floor((image.naturalWidth - side) / 2);
  const sourceY = Math.floor((image.naturalHeight - side) / 2);
  const targetSize = 512;

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas not available");
  }

  // Keep a neutral background for transparent formats before export.
  ctx.fillStyle = "#f3f6fb";
  ctx.fillRect(0, 0, targetSize, targetSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sourceX, sourceY, side, side, 0, 0, targetSize, targetSize);

  return canvas.toDataURL("image/jpeg", 0.9);
}

function readLeaderboardEntries(now: number): LeaderboardEntry[] {
  const profiles = readProfiles();
  const items: LeaderboardEntry[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("uu_progress_")) {
      continue;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw) as Progress;
      const handle = key.replace("uu_progress_", "");
      const profile = profiles[handle] ?? defaultProfile(handle);
      items.push({
        username: handle,
        displayName: profile.displayName,
        avatar: profile.avatar,
        currentLevel: parsed.currentLevel || 1,
        startedAt: parsed.startedAt || now,
        fails: parsed.fails || 0,
        completedAt: parsed.completedAt
      });
    } catch {
      // ignore malformed entries
    }
  }

  return items.sort((a, b) => {
    if (b.currentLevel !== a.currentLevel) {
      return b.currentLevel - a.currentLevel;
    }
    const aTime = (a.completedAt ?? now) - a.startedAt;
    const bTime = (b.completedAt ?? now) - b.startedAt;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return a.fails - b.fails;
  });
}

export default function App() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [sessionUser, setSessionUser] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));
  const [progress, setProgress] = useState<Progress | null>(() => {
    const su = localStorage.getItem(SESSION_KEY);
    return su ? readProgress(su) : null;
  });
  const [answerInput, setAnswerInput] = useState("");
  const [fallClicks, setFallClicks] = useState(0);
  const [fallTokens, setFallTokens] = useState<FallToken[]>([]);
  const [luckSelection, setLuckSelection] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("Welcome to your own discomfort.");
  const [now, setNow] = useState(Date.now());
  const [authBusy, setAuthBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [profileDraftName, setProfileDraftName] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const captchaCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const challenge = useMemo(() => {
    if (!progress) {
      return null;
    }
    return makeChallenge(progress.currentLevel, progress.seed);
  }, [progress]);

  useEffect(() => {
    setAnswerInput("");
    setFallClicks(0);
    setFallTokens([]);
    setLuckSelection(null);
  }, [challenge?.kind, challenge?.prompt]);

  useEffect(() => {
    if (!challenge || challenge.kind !== "randomfall") {
      return;
    }
    const symbols = ["@", "#", "$", "%", "&", "*", "?"];
    const timer = window.setInterval(() => {
      setFallTokens((prev) =>
        [
          ...prev,
          {
            id: Date.now() + Math.floor(Math.random() * 1000),
            x: 8 + Math.floor(Math.random() * 84),
            symbol: symbols[Math.floor(Math.random() * symbols.length)],
            durationMs: 2600 + Math.floor(Math.random() * 1600)
          }
        ].slice(-24)
      );
    }, 460);
    return () => window.clearInterval(timer);
  }, [challenge]);

  useEffect(() => {
    if (!challenge || challenge.kind !== "image" || !challenge.imageCode || !captchaCanvasRef.current) {
      return;
    }
    const canvas = captchaCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f6f7ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 7; i += 1) {
      ctx.strokeStyle = `rgba(40,40,40,${0.12 + i * 0.03})`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    for (let i = 0; i < challenge.imageCode.length; i += 1) {
      const ch = challenge.imageCode[i];
      const x = 28 + i * 34;
      const y = 42 + Math.floor(Math.random() * 14);
      const tilt = (Math.random() - 0.5) * 0.6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.font = `${28 + Math.floor(Math.random() * 4)}px monospace`;
      ctx.fillStyle = "#1f2435";
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }

    for (let i = 0; i < 34; i += 1) {
      ctx.fillStyle = `rgba(20,20,20,${Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [challenge]);

  const elapsed = useMemo(() => {
    if (!progress) {
      return 0;
    }
    const end = progress.completedAt ?? now;
    return Math.max(0, end - progress.startedAt);
  }, [progress, now]);

  const leaderboard = useMemo(() => {
    const all = readLeaderboardEntries(now);
    const top5 = all.slice(0, 5);
    const currentIndex = sessionUser ? all.findIndex((entry) => entry.username === sessionUser) : -1;
    return {
      top5,
      currentRank: currentIndex >= 0 ? currentIndex + 1 : null
    };
  }, [now, sessionUser, progress]);

  const canEditUsername = !!progress && progress.currentLevel >= 10;

  useEffect(() => {
    if (!sessionUser) {
      setProfile(null);
      setProfileDraftName("");
      return;
    }

    const profiles = readProfiles();
    const current = profiles[sessionUser] ?? defaultProfile(sessionUser);
    if (!profiles[sessionUser]) {
      profiles[sessionUser] = current;
      writeProfiles(profiles);
    }
    setProfile(current);
    setProfileDraftName(current.displayName);
  }, [sessionUser]);

  useEffect(() => {
    const mode = profile?.colorMode ?? "light";
    const style = profile?.themeStyle ?? "classic";
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.setAttribute("data-theme-style", style);
  }, [profile]);

  function saveProfile(next: UserProfile): void {
    if (!sessionUser) {
      return;
    }
    const profiles = readProfiles();
    profiles[sessionUser] = next;
    writeProfiles(profiles);
    setProfile(next);
  }

  function handleDisplayNameSave(): void {
    if (!profile || !sessionUser || !canEditUsername) {
      return;
    }
    const trimmed = profileDraftName.trim();
    if (trimmed.length < 3) {
      setFeedback("Username needs at least 3 characters.");
      return;
    }
    saveProfile({ ...profile, displayName: trimmed.slice(0, 20) });
    setFeedback("Username updated.");
  }

  function askLogout(): void {
    setShowLogoutPopup(true);
    setProfileOpen(false);
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!profile) {
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFeedback("Please upload a valid image file.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setFeedback("Image too large. Please use a file under 10 MB.");
      event.target.value = "";
      return;
    }

    try {
      const result = await createAvatarDataUrl(file);
      saveProfile({ ...profile, avatar: result });
      setFeedback("Profile picture updated.");
    } catch {
      setFeedback("Could not process this image. Please try another file.");
    }
    event.target.value = "";
  }

  function confirmLogout(): void {
    setShowLogoutPopup(false);
    logout();
  }

  function signInSession(handle: string): void {
    localStorage.setItem(SESSION_KEY, handle);
    const nextProgress = readProgress(handle);
    setSessionUser(handle);
    setProgress(nextProgress);
  }

  function handleAuth(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@") || password.length < 6) {
      setFeedback("Enter a valid email and password (minimum 6 characters).");
      return;
    }
    if (!agreed) {
      setFeedback("Please accept terms to continue.");
      return;
    }

    const localName = cleanEmail.split("@")[0] || "human";

    if (mode === "signup" && password !== confirmPassword) {
      setFeedback("Passwords do not match.");
      return;
    }

    const users = readUsers();
    const registerMode = mode === "signup";
    if (registerMode) {
      if (users[cleanEmail]) {
        setFeedback("An account with this email already exists.");
        return;
      }
      users[cleanEmail] = {
        email: cleanEmail,
        password,
        provider: "local",
        createdAt: Date.now()
      };
      writeUsers(users);
      signInSession(localName);
      setFeedback("Account created. Captcha journey started.");
    } else {
      if (!users[cleanEmail] || users[cleanEmail].password !== password) {
        setFeedback("Invalid email or password.");
        return;
      }
      signInSession(localName);
      setFeedback("Signed in. Resume the captcha run.");
    }
  }

  async function handleGoogleSignIn(): Promise<void> {
    if (authBusy) {
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setFeedback("Google Sign-In requires Firebase keys in .env.local. See .env.example.");
      return;
    }

    try {
      setAuthBusy(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const userEmail = (result.user.email || "guest@google.user").toLowerCase();
      const localName = userEmail.split("@")[0] || "google_human";
      const users = readUsers();

      if (!users[userEmail]) {
        users[userEmail] = {
          email: userEmail,
          password: "oauth-google",
          provider: "google",
          createdAt: Date.now()
        };
        writeUsers(users);
      }

      signInSession(localName);
      setFeedback("Google sign-in successful.");
    } catch {
      setFeedback("Google sign-in canceled or failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  function completeLevel(): void {
    if (!sessionUser || !progress) {
      return;
    }

    const newLevel = progress.currentLevel + 1;
    const nextProgress: Progress = {
      ...progress,
      currentLevel: Math.min(newLevel, TOTAL_LEVELS + 1),
      completedAt: progress.currentLevel >= TOTAL_LEVELS ? Date.now() : undefined
    };

    writeProgress(sessionUser, nextProgress);
    setProgress(nextProgress);
    setAnswerInput("");
    setFallClicks(0);
    setLuckSelection(null);
    setFeedback("congratulation, you are one step closer to be a human");
  }

  function failLevel(): void {
    if (!sessionUser || !progress) {
      return;
    }
    const nextProgress: Progress = {
      ...progress,
      fails: progress.fails + 1
    };
    writeProgress(sessionUser, nextProgress);
    setProgress(nextProgress);
    setFeedback("Captcha failed. Please try again.");
  }

  function submitAnswer(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!challenge) {
      return;
    }

    if (challenge.kind === "randomfall") {
      if (fallClicks === challenge.targetClicks) {
        completeLevel();
      } else {
        failLevel();
      }
      return;
    }

    if (challenge.kind === "luck") {
      if (luckSelection === challenge.luckySlot) {
        completeLevel();
      } else {
        failLevel();
      }
      return;
    }

    const normalized = answerInput.trim();
    if (normalized === (challenge.answer ?? "")) {
      completeLevel();
    } else {
      failLevel();
    }
  }

  function restartJourney(): void {
    if (!sessionUser || !progress) {
      return;
    }
    const reset: Progress = {
      currentLevel: 1,
      startedAt: Date.now(),
      fails: 0,
      seed: Math.floor(Math.random() * 1_000_000)
    };
    writeProgress(sessionUser, reset);
    setProgress(reset);
    setAnswerInput("");
    setFallClicks(0);
    setLuckSelection(null);
    setFeedback("Captcha journey restarted with a new sequence.");
  }

  function logout(): void {
    localStorage.removeItem(SESSION_KEY);
    setSessionUser(null);
    setProgress(null);
    setProfileOpen(false);
    setShowLogoutPopup(false);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFeedback("Logged out.");
  }

  const completed = !!progress && progress.currentLevel > TOTAL_LEVELS;
  const levelProgress =
    progress && progress.currentLevel <= TOTAL_LEVELS
      ? Math.min(100, Math.round((progress.currentLevel / TOTAL_LEVELS) * 100))
      : 0;

  return (
    <main className="page">
      {sessionUser && profile ? (
        <div className="profile-anchor">
          <button
            type="button"
            className="profile-icon"
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Profile settings"
          >
            <svg className="profile-glyph-svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.4 13a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.6 7.6 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.8 7.8 0 0 0-.1 1 7.8 7.8 0 0 0 .1 1l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5a.5.5 0 0 0 .6.2l2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.6a.5.5 0 0 0 .5.4h4a.5.5 0 0 0 .5-.4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.5 1a.5.5 0 0 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z" />
            </svg>
          </button>

          {profileOpen ? (
            <div className="profile-menu">
              <h3>Profile & Theme</h3>

              <label className="profile-field">
                Theme Style
                <select
                  value={profile.themeStyle}
                  onChange={(e) => saveProfile({ ...profile, themeStyle: e.target.value as ThemeStyle })}
                >
                  <option value="classic">Classic Captcha</option>
                  <option value="grid">Grid Paper</option>
                  <option value="noise">Noisy Lab</option>
                </select>
              </label>

              <div className="profile-field">
                Mode
                <div className="mode-toggle">
                  <button
                    type="button"
                    className={profile.colorMode === "light" ? "toggle active" : "toggle"}
                    onClick={() => saveProfile({ ...profile, colorMode: "light" })}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    className={profile.colorMode === "dark" ? "toggle active" : "toggle"}
                    onClick={() => saveProfile({ ...profile, colorMode: "dark" })}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div className="profile-field">
                Profile Picture
                <div className="profile-preview">
                  {profile.avatar.startsWith("data:image") ? (
                    <img src={profile.avatar} alt="Profile preview" className="profile-avatar-img" />
                  ) : (
                    <span>{avatarFallback(profile.displayName)}</span>
                  )}
                </div>
                <div className="profile-upload-row">
                  <label className="upload-btn">
                    Upload From Device
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} />
                  </label>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => saveProfile({ ...profile, avatar: "" })}
                  >
                    Remove Photo
                  </button>
                </div>
              </div>

              <label className="profile-field">
                Username {canEditUsername ? "" : "(locked till level 10)"}
                <input
                  value={profileDraftName}
                  onChange={(e) => setProfileDraftName(e.target.value)}
                  disabled={!canEditUsername}
                  placeholder="Set display name"
                />
              </label>

              <button
                type="button"
                className="ghost"
                onClick={handleDisplayNameSave}
                disabled={!canEditUsername}
              >
                Save Username
              </button>

              <button type="button" className="ghost danger" onClick={askLogout}>
                Log Out
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="shell">
        <header className="top">
          <h1>User Uncomfort</h1>
          <p>Captcha marathon mode. 50 rounds of painful verification.</p>
          <div className="headline-note">The user UnComfort</div>
        </header>

        {!sessionUser || !progress ? (
          <section className="panel auth-wrap">
            <aside className="auth-copy">
              <h2>Professional Entry, Unprofessional Experience.</h2>
              <p>Sign in with Google or continue with email to save your progress.</p>
              <p className="tiny">Yes, this looks clean. No, the next captchas are not.</p>
            </aside>

            <div className="auth-card">
              <div className="mode-grid">
                {(["signin", "signup"] as AuthMode[]).map((m) => (
                  <button
                    key={m}
                    className={m === mode ? "mode active" : "mode"}
                    onClick={() => setMode(m)}
                    type="button"
                  >
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="google"
                onClick={() => void handleGoogleSignIn()}
                disabled={authBusy}
              >
                <span className="g-logo">G</span>
                {authBusy ? "Connecting..." : "Continue with Google"}
              </button>

              <div className="divider">or continue with email</div>

              <form className="auth" onSubmit={handleAuth}>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="minimum 6 characters"
                  />
                </label>

                {mode === "signup" ? (
                  <label>
                    Confirm Password
                    <input
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      type="password"
                      placeholder="re-enter password"
                    />
                  </label>
                ) : null}

                <label className="agree">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  I agree to Terms and Privacy.
                </label>

                <button type="submit" className="primary">
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </button>
              </form>
            </div>
          </section>
        ) : completed ? (
          <section className="panel final">
            <h2>You Cleared All 50 Captchas</h2>
            <p>
              Total time: <strong>{formatDuration(elapsed)}</strong>
            </p>
            <p>
              Final rank snapshot: <strong>{leaderboard.currentRank ? `Rank-${leaderboard.currentRank}` : "N/A"}</strong>
            </p>
            <p>
              Failed attempts: <strong>{progress.fails}</strong>
            </p>
            <div className="actions">
              <button className="primary" type="button" onClick={restartJourney}>
                Restart Journey
              </button>
              <button className="ghost" type="button" onClick={askLogout}>
                Log Out
              </button>
            </div>
          </section>
        ) : (
          <section className="panel play">
            <div className="play-layout">
              <aside className="leaderboard" aria-label="Top players">
                <h3>Leaderboard</h3>
                <div className="leaderboard-list">
                  {leaderboard.top5.map((entry, index) => (
                    <div className="leader-row" key={`${entry.username}-${index}`}>
                      <span className="leader-user">
                        <span className="leader-avatar">
                          {entry.avatar.startsWith("data:image") ? (
                            <img src={entry.avatar} alt="avatar" className="leader-avatar-img" />
                          ) : (
                            avatarFallback(entry.displayName)
                          )}
                        </span>
                        <span>{entry.displayName}</span>
                      </span>
                      <strong>{`Rank-${index + 1}`}</strong>
                    </div>
                  ))}
                  {sessionUser && leaderboard.currentRank && leaderboard.currentRank > 5 ? (
                    <div className="leader-row me">
                      <span className="leader-user">
                        <span className="leader-avatar">
                          {(profile?.avatar ?? "").startsWith("data:image") ? (
                            <img src={profile?.avatar} alt="avatar" className="leader-avatar-img" />
                          ) : (
                            avatarFallback(profile?.displayName ?? sessionUser)
                          )}
                        </span>
                        <span>{profile?.displayName ?? sessionUser}</span>
                      </span>
                      <strong>{`Rank-${leaderboard.currentRank}`}</strong>
                    </div>
                  ) : null}
                </div>
              </aside>

              <div className="play-main">
                <div className="hud">
                  <span>User: {sessionUser}</span>
                  <span>{`Captcha ${progress.currentLevel}/${TOTAL_LEVELS}`}</span>
                  <span>Fails: {progress.fails}</span>
                  <span className="timer-pill">{formatDuration(elapsed)}</span>
                </div>

                <div className="level-progress-wrap" aria-label="Level progress">
                  <div className="level-progress-bar" style={{ width: `${levelProgress}%` }} />
                </div>

                <form className="challenge" onSubmit={submitAnswer}>
                  <h2>{challenge?.prompt}</h2>

                  {challenge?.kind === "image" ? (
                    <div className="captcha-image-wrap">
                      <canvas ref={captchaCanvasRef} width={220} height={72} className="captcha-image" />
                      <input
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        placeholder="Type captcha text"
                        required
                      />
                    </div>
                  ) : null}

                  {challenge?.kind === "randomfall" ? (
                    <div className="fall-zone">
                      {fallTokens.map((token) => (
                        <button
                          key={token.id}
                          type="button"
                          className="fall-token"
                          style={{ left: `${token.x}%`, animationDuration: `${token.durationMs}ms` }}
                          onAnimationEnd={() => setFallTokens((prev) => prev.filter((item) => item.id !== token.id))}
                          onClick={() => {
                            setFallTokens((prev) => prev.filter((item) => item.id !== token.id));
                            if (token.symbol === challenge.targetSymbol) {
                              setFallClicks((v) => v + 1);
                            }
                          }}
                        >
                          {token.symbol}
                        </button>
                      ))}
                      <p>{`Target '${challenge.targetSymbol}' clicks: ${fallClicks}/${challenge.targetClicks}`}</p>
                    </div>
                  ) : null}

                  {challenge?.kind === "luck" ? (
                    <div className="luck-grid">
                      {Array.from({ length: 6 }, (_, idx) => idx + 1).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className={luckSelection === slot ? "luck-slot active" : "luck-slot"}
                          onClick={() => setLuckSelection(slot)}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {challenge?.options ? (
                    <div className="option-grid">
                      {challenge.options.map((opt, idx) => (
                        <button
                          key={`${opt}-${idx}`}
                          type="button"
                          className="option"
                          onClick={() => setAnswerInput(String(opt))}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {challenge && !["image", "randomfall", "luck"].includes(challenge.kind) ? (
                    <input
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      placeholder="your answer"
                      required
                    />
                  ) : null}

                  <div className="actions">
                    <button type="submit" className="primary">
                      Verify Captcha
                    </button>
                    <button type="button" className="ghost" onClick={restartJourney}>
                      Restart
                    </button>
                    <button type="button" className="ghost" onClick={askLogout}>
                      Log Out
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        )}

        {showLogoutPopup ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="logout-modal">
              <h3>LOL, itni jldi haar maan liya!?</h3>
              <p>Captcha warrior banne se pehle hi quit kar rahe ho?</p>
              <div className="actions">
                <button type="button" className="primary" onClick={confirmLogout}>
                  Haan, Log Out
                </button>
                <button type="button" className="ghost" onClick={() => setShowLogoutPopup(false)}>
                  Nahi, Continue
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <footer className="footer">
          <div>{feedback}</div>
          <div className="credit">Powered by stress in collaboration with Prashant</div>
        </footer>
      </section>
    </main>
  );
}
