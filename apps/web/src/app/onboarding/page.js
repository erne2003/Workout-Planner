"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
    const router = useRouter();
    const [years, setYears] = useState("");
    const [weight, setWeight] = useState("");
    const [gender, setGender] = useState("male");
    
    // Explicit Height Metrics constraints
    const [hUnit, setHUnit] = useState("ft"); // "ft" or "cm"
    const [feet, setFeet] = useState("");
    const [inches, setInches] = useState("");
    const [cm, setCm] = useState("");
    
    const [bodyFat, setBodyFat] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        let finalHeight = "Not Selected";
        if (hUnit === "ft" && (feet || inches)) {
            finalHeight = `${feet || 0}'${inches || 0}"`;
        } else if (hUnit === "cm" && cm) {
            finalHeight = `${cm}cm`;
        }

        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/metrics`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({
                    trainingYears: parseFloat(years) || 0,
                    weight: parseFloat(weight),
                    height: finalHeight,
                    bodyFat: bodyFat ? parseFloat(bodyFat) : null,
                    gender: gender
                })
            });
            // Complete layout and forward to dashboard!
            router.replace("/");
        } catch (err) {
            console.error(err);
            alert("Failed saving profile.");
            setLoading(false);
        }
    };

    const inputStyle = {
        padding: "14px 16px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.5)",
        color: "#fff",
        fontSize: "15px",
        fontWeight: 600,
        outline: "none",
        width: "100%",
        fontFamily: "var(--font-display)",
        transition: "border-color 0.2s"
    };

    const labelStyle = {
        display: "block",
        fontSize: "11px",
        fontWeight: 700,
        color: "rgba(255,255,255,0.4)",
        textTransform: "uppercase",
        letterSpacing: "1px",
        marginBottom: "6px"
    };

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "var(--bg-base, #07070f)"
        }}>
            <div className="glass-card animate-fade-up" style={{ width: "100%", maxWidth: "400px", padding: "32px 28px" }}>
                <div style={{ textAlign: "center", marginBottom: "28px" }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: "14px",
                        background: "linear-gradient(135deg, #0A84FF, #BF5AF2)",
                        margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                    <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 800, margin: "0 0 6px" }}>Complete Profile</h1>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>Establish your physical baseline constraints.</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                        <label style={labelStyle}>Gender</label>
                        <div style={{ display: "flex", background: "rgba(0,0,0,0.4)", borderRadius: "12px", padding: "4px", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <button type="button" onClick={() => setGender("male")} style={{ flex: 1, background: gender === "male" ? "rgba(255,255,255,0.15)" : "transparent", color: gender === "male" ? "#fff" : "rgba(255,255,255,0.4)", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, padding: "10px", cursor: "pointer", transition: "all 0.2s" }}>
                                Male
                            </button>
                            <button type="button" onClick={() => setGender("female")} style={{ flex: 1, background: gender === "female" ? "rgba(255,255,255,0.15)" : "transparent", color: gender === "female" ? "#fff" : "rgba(255,255,255,0.4)", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, padding: "10px", cursor: "pointer", transition: "all 0.2s" }}>
                                Female
                            </button>
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Training Age (Years)</label>
                        <input type="number" step="0.5" placeholder="e.g. 2.5" value={years} onChange={e => setYears(e.target.value)} style={inputStyle} required />
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ position: "relative", display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: "8px", minHeight: "24px" }}>
                                <label style={{ ...labelStyle, marginBottom: 0, textAlign: "left" }}>Height</label>
                                <div style={{ position: "absolute", right: 0, display: "flex", background: "rgba(0,0,0,0.4)", borderRadius: "6px", padding: "2px" }}>
                                    <button type="button" onClick={() => setHUnit("ft")} style={{ background: hUnit === "ft" ? "rgba(255,255,255,0.15)" : "transparent", color: hUnit === "ft" ? "#fff" : "rgba(255,255,255,0.3)", border: "none", borderRadius: "4px", fontSize: "9px", fontWeight: 700, padding: "3px 8px", cursor: "pointer", transition: "all 0.2s" }}>
                                        FT / IN
                                    </button>
                                    <button type="button" onClick={() => setHUnit("cm")} style={{ background: hUnit === "cm" ? "rgba(255,255,255,0.15)" : "transparent", color: hUnit === "cm" ? "#fff" : "rgba(255,255,255,0.3)", border: "none", borderRadius: "4px", fontSize: "9px", fontWeight: 700, padding: "3px 8px", cursor: "pointer", transition: "all 0.2s" }}>
                                        CM
                                    </button>
                                </div>
                            </div>
                            
                            {hUnit === "ft" ? (
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <div style={{ flex: 1, position: "relative" }}>
                                        <input type="number" placeholder="5" value={feet} onChange={e => setFeet(e.target.value)} style={{ ...inputStyle, paddingRight: "35px" }} />
                                        <span style={{ position: "absolute", right: "10px", top: "11px", fontSize: "20px", color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>ft</span>
                                    </div>
                                    <div style={{ flex: 1, position: "relative" }}>
                                        <input type="number" placeholder="11" value={inches} onChange={e => setInches(e.target.value)} style={{ ...inputStyle, paddingRight: "35px" }} />
                                        <span style={{ position: "absolute", right: "10px", top: "11px", fontSize: "20px", color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>in</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ position: "relative" }}>
                                    <input type="number" placeholder="180" value={cm} onChange={e => setCm(e.target.value)} style={{ ...inputStyle, paddingRight: "45px" }} />
                                    <span style={{ position: "absolute", right: "12px", top: "11px", fontSize: "20px", color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>cm</span>
                                </div>
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Weight (lbs)</label>
                            <input type="number" placeholder="e.g. 185" value={weight} onChange={e => setWeight(e.target.value)} style={inputStyle} required />
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Body Fat % (Optional)</label>
                        <input type="number" placeholder="e.g. 14" value={bodyFat} onChange={e => setBodyFat(e.target.value)} style={inputStyle} />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: "12px",
                            padding: "16px",
                            borderRadius: "14px",
                            background: "linear-gradient(135deg, #0A84FF, #BF5AF2)",
                            border: "none",
                            color: "#fff",
                            fontFamily: "var(--font-display)",
                            fontSize: "15px",
                            fontWeight: 800,
                            cursor: loading ? "wait" : "pointer",
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? "Saving..." : "Enter Dashboard"}
                    </button>
                </form>
            </div>
        </div>
    );
}
