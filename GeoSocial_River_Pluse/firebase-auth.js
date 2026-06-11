// firebase-auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyAfijpHSFrfM_OTwsnwxRIkw_TOh1Ucako",
    authDomain: "taipei-river-pulse.firebaseapp.com",
    projectId: "taipei-river-pulse",
    storageBucket: "taipei-river-pulse.firebasestorage.app",
    messagingSenderId: "1030768798443",
    appId: "1:1030768798443:web:f5cc7b6c01ffe02f81acae",
    measurementId: "G-D9BWQEFRV1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

window.currentUser = null;
window.db = db;

window.loginWithGoogle = async function () {
    try {
        await signInWithPopup(auth, provider);
    } catch (err) {
        console.error("Google 登入失敗：", err);
        alert("登入失敗，請看 Console。");
    }
};

window.logoutGoogle = async function () {
    await signOut(auth);
};

window.logout = window.logoutGoogle;

window.loadUserData = async function () {
    if (!window.currentUser || !window.state) return;

    const ref = doc(db, "users", window.currentUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const data = snap.data();

    if (typeof data.showNameOnLeaderboard === "boolean") {
        localStorage.setItem(
            "showNameOnLeaderboard",
            data.showNameOnLeaderboard
        );
    }

    if (data.badges) {
        window.state.badges = data.badges;
        localStorage.setItem("riverBadges", JSON.stringify(window.state.badges));
    }

    if (data.stats) {
        window.state.stats = data.stats;
        localStorage.setItem("riverStats", JSON.stringify(window.state.stats));
    }

    if (window.appReady && typeof window.renderAll === "function") {
        window.renderAll();
    }

    console.log("已載入雲端紀錄");
};

window.saveUserData = async function () {
    if (!window.currentUser || !window.state) return;

    await setDoc(
        doc(db, "users", window.currentUser.uid),
        {
            displayName: window.currentUser.displayName || "匿名探索者",
            email: window.currentUser.email || "",
            photoURL: window.currentUser.photoURL || "",

            showNameOnLeaderboard:
                localStorage.getItem("showNameOnLeaderboard") === "true",

            badges: window.state.badges,
            stats: window.state.stats,

            updatedAt: new Date().toISOString()
        },
        { merge: true }
    );

    console.log("已同步到 Firestore");
};

window.loadLeaderboard = async function (mode = "total") {
    const snap = await getDocs(collection(db, "users"));

    const rows = snap.docs.map((docSnap) => {

        const data = docSnap.data();

        const badgeCount = Object.keys(data.badges ?? {}).length;
        const riverCount = Object.keys(data.stats?.visitedRivers ?? {}).length;
        const quizScore = Number(data.stats?.quizScore ?? 0);

        // 綜合分數（可自行調整權重）
        const totalScore =
            quizScore +
            badgeCount * 20 +
            riverCount * 50;

        return {

            uid: docSnap.id,

            displayName: data.showNameOnLeaderboard
                ? (data.displayName || "匿名探索者")
                : "匿名探索者",

            photoURL: data.showNameOnLeaderboard
                ? (data.photoURL || "")
                : "",

            quizScore,
            badgeCount,
            riverCount,
            totalScore,

            showNameOnLeaderboard:
                !!data.showNameOnLeaderboard

        };
    });

    rows.sort((a, b) => {

        // 綜合排行榜
        if (mode === "total") {

            if (b.totalScore !== a.totalScore)
                return b.totalScore - a.totalScore;

            if (b.quizScore !== a.quizScore)
                return b.quizScore - a.quizScore;

            if (b.badgeCount !== a.badgeCount)
                return b.badgeCount - a.badgeCount;

            return b.riverCount - a.riverCount;
        }

        // 徽章排行榜
        if (mode === "badge") {

            if (b.badgeCount !== a.badgeCount)
                return b.badgeCount - a.badgeCount;

            return b.quizScore - a.quizScore;
        }

        // 河流排行榜
        if (mode === "river") {

            if (b.riverCount !== a.riverCount)
                return b.riverCount - a.riverCount;

            return b.quizScore - a.quizScore;
        }

        // 分數排行榜（score）
        if (b.quizScore !== a.quizScore)
            return b.quizScore - a.quizScore;

        if (b.badgeCount !== a.badgeCount)
            return b.badgeCount - a.badgeCount;

        return b.riverCount - a.riverCount;

    });

    return rows.slice(0, 10);
};

onAuthStateChanged(auth, async (user) => {
    window.currentUser = user;

    if (user) {
        console.log("已登入：", user.displayName, user.email);

        if (window.appReady) {
            await window.loadUserData();
        }
    } else {
        console.log("尚未登入");
    }
});