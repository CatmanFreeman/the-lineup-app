// src/pages/Dashboards/RestaurantDashboard/tabs/OrientationManager.jsx

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import "./OrientationManager.css";

/**
 * OrientationManager
 * - Manages FOH + BOH orientation configuration
 * - Supports AI vs Custom mode
 * - Supports video/PDF entries
 * - Assigns to Employment Packages
 * - Now wired to Firestore
 */

const COMPANY_ID = "company-demo";

export default function OrientationManager() {
  const { restaurantId } = useParams();
  const { currentUser } = useAuth();
  const companyId = COMPANY_ID;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fohOrientation, setFohOrientation] = useState(null);
  const [bohOrientation, setBohOrientation] = useState(null);
  const [packages, setPackages] = useState([]);

  const [activeDept, setActiveDept] = useState("FOH");
  const [showEditor, setShowEditor] = useState(false);

  // Editor state
  const [type, setType] = useState("CUSTOM");
  const [tone, setTone] = useState("Professional");
  const [emphasis, setEmphasis] = useState("Guest experience");
  const [duration, setDuration] = useState(12);
  const [mustAcknowledge, setMustAcknowledge] = useState(true);
  const [quizRequired, setQuizRequired] = useState(true);

  const [videos, setVideos] = useState([{ title: "Welcome", url: "" }]);
  const [pdfs, setPdfs] = useState([{ title: "Handbook", url: "" }]);

  const [assignedPackages, setAssignedPackages] = useState({
    FOH: null,
    BOH: null,
  });

  // Load orientations and packages
  useEffect(() => {
    const loadData = async () => {
      if (!restaurantId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Load FOH orientation
        const fohRef = doc(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "orientations",
          "foh"
        );
        const fohSnap = await getDoc(fohRef);
        if (fohSnap.exists()) {
          const data = fohSnap.data();
          setFohOrientation(data);
          if (data.assignedPackageId) {
            setAssignedPackages(prev => ({
              ...prev,
              FOH: data.assignedPackageId,
            }));
          }
        }

        // Load BOH orientation
        const bohRef = doc(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "orientations",
          "boh"
        );
        const bohSnap = await getDoc(bohRef);
        if (bohSnap.exists()) {
          const data = bohSnap.data();
          setBohOrientation(data);
          if (data.assignedPackageId) {
            setAssignedPackages(prev => ({
              ...prev,
              BOH: data.assignedPackageId,
            }));
          }
        }

        // Load employment packages
        const packagesRef = collection(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "employmentPackages"
        );
        const packagesSnap = await getDocs(packagesRef);
        const loadedPackages = packagesSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        setPackages(loadedPackages);
      } catch (err) {
        console.error("Error loading orientations:", err);
        setError("Failed to load orientations");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [restaurantId, companyId]);

  // Load orientation data when opening editor
  useEffect(() => {
    if (!showEditor) return;

    const orientation = activeDept === "FOH" ? fohOrientation : bohOrientation;
    
    if (orientation) {
      setType(orientation.type || "CUSTOM");
      setTone(orientation.tone || "Professional");
      setEmphasis(orientation.emphasis || "Guest experience");
      setDuration(orientation.duration || 12);
      setMustAcknowledge(orientation.mustAcknowledge !== false);
      setQuizRequired(orientation.quizRequired !== false);
      setVideos(orientation.videos && orientation.videos.length > 0 
        ? orientation.videos 
        : [{ title: "Welcome", url: "" }]);
      setPdfs(orientation.pdfs && orientation.pdfs.length > 0 
        ? orientation.pdfs 
        : [{ title: "Handbook", url: "" }]);
    } else {
      // Reset to defaults
      setType("CUSTOM");
      setTone("Professional");
      setEmphasis("Guest experience");
      setDuration(12);
      setMustAcknowledge(true);
      setQuizRequired(true);
      setVideos([{ title: "Welcome", url: "" }]);
      setPdfs([{ title: "Handbook", url: "" }]);
    }
  }, [showEditor, activeDept, fohOrientation, bohOrientation]);

  const deptLabel = activeDept === "FOH" ? "Front of House" : "Back of House";

  function openEditor(dept) {
    setActiveDept(dept);
    setShowEditor(true);
    setError(null);
  }

  function addVideo() {
    setVideos((prev) => [...prev, { title: "New Video", url: "" }]);
  }

  function addPdf() {
    setPdfs((prev) => [...prev, { title: "New PDF", url: "" }]);
  }

  function updateVideo(index, patch) {
    setVideos((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function updatePdf(index, patch) {
    setPdfs((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removeVideo(index) {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  }

  function removePdf(index) {
    setPdfs((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveDraft() {
    if (!restaurantId) return;
    
    setSaving(true);
    setError(null);

    try {
      const orientationData = {
        type,
        tone: type === "AI" ? tone : null,
        emphasis: type === "AI" ? emphasis : null,
        duration,
        mustAcknowledge,
        quizRequired,
        videos: videos.filter(v => v.title.trim() || v.url.trim()),
        pdfs: pdfs.filter(p => p.title.trim() || p.url.trim()),
        assignedPackageId: assignedPackages[activeDept] || null,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || currentUser?.displayName || "system",
      };

      const orientationRef = doc(
        db,
        "companies",
        companyId,
        "restaurants",
        restaurantId,
        "orientations",
        activeDept.toLowerCase()
      );

      await setDoc(orientationRef, orientationData, { merge: true });

      // Update local state
      if (activeDept === "FOH") {
        setFohOrientation(orientationData);
      } else {
        setBohOrientation(orientationData);
      }

      setShowEditor(false);
    } catch (err) {
      console.error("Error saving orientation:", err);
      setError("Failed to save orientation. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function savePackageAssignment() {
    if (!restaurantId) return;
    
    try {
      // Update FOH orientation
      if (assignedPackages.FOH) {
        const fohRef = doc(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "orientations",
          "foh"
        );
        await setDoc(fohRef, {
          assignedPackageId: assignedPackages.FOH,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // Update BOH orientation
      if (assignedPackages.BOH) {
        const bohRef = doc(
          db,
          "companies",
          companyId,
          "restaurants",
          restaurantId,
          "orientations",
          "boh"
        );
        await setDoc(bohRef, {
          assignedPackageId: assignedPackages.BOH,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    } catch (err) {
      console.error("Error saving package assignment:", err);
      setError("Failed to save package assignment");
    }
  }

  const packageOptions = useMemo(() => {
    if (packages.length > 0) {
      return packages;
    }
    // Fallback to default options if no packages loaded
    return [
      { id: "pkg_foh_server", name: "FOH Server Package" },
      { id: "pkg_foh_host", name: "FOH Host Package" },
      { id: "pkg_boh_grill", name: "BOH Grill Package" },
      { id: "pkg_boh_dish", name: "BOH Dishwasher Package" },
    ];
  }, [packages]);

  const currentFohData = fohOrientation || {};
  const currentBohData = bohOrientation || {};

  if (loading) {
    return (
      <div className="om-wrap">
        <div style={{ padding: "2rem", textAlign: "center", color: "#aaa" }}>
          Loading orientations...
        </div>
      </div>
    );
  }

  return (
    <div className="om-wrap">
      {error && !showEditor && (
        <div style={{ 
          background: "#d32f2f", 
          color: "#fff", 
          padding: "0.75rem 1rem", 
          borderRadius: 6, 
          marginBottom: 16 
        }}>
          {error}
        </div>
      )}

      <div className="om-grid">
        {/* FOH card */}
        <div className="om-card">
          <div className="om-card-top">
            <div>
              <div className="om-card-title">FOH Orientation</div>
              <div className="om-card-sub">Hosts, Servers, Bartenders</div>
            </div>
            <div className="om-badge om-badge--active">
              {currentFohData.type || "Not Configured"}
            </div>
          </div>

          <div className="om-metrics">
            <div className="om-metric">
              <div className="om-metric-label">Type</div>
              <div className="om-metric-value">{currentFohData.type || "—"}</div>
            </div>
            <div className="om-metric">
              <div className="om-metric-label">Duration</div>
              <div className="om-metric-value">{currentFohData.duration || "—"} min</div>
            </div>
            <div className="om-metric">
              <div className="om-metric-label">Quiz</div>
              <div className="om-metric-value">
                {currentFohData.quizRequired ? "Required" : currentFohData.quizRequired === false ? "Off" : "—"}
              </div>
            </div>
          </div>

          <div className="om-actions">
            <button type="button" className="om-btn" onClick={() => openEditor("FOH")}>
              Create / Edit
            </button>
            <button
              type="button"
              className="om-btn om-btn--ghost"
              onClick={() => setActiveDept("FOH")}
            >
              Preview
            </button>
          </div>
        </div>

        {/* BOH card */}
        <div className="om-card">
          <div className="om-card-top">
            <div>
              <div className="om-card-title">BOH Orientation</div>
              <div className="om-card-sub">Stations, prep, safety, dish</div>
            </div>
            <div className="om-badge om-badge--active">
              {currentBohData.type || "Not Configured"}
            </div>
          </div>

          <div className="om-metrics">
            <div className="om-metric">
              <div className="om-metric-label">Type</div>
              <div className="om-metric-value">{currentBohData.type || "—"}</div>
            </div>
            <div className="om-metric">
              <div className="om-metric-label">Duration</div>
              <div className="om-metric-value">{currentBohData.duration || "—"} min</div>
            </div>
            <div className="om-metric">
              <div className="om-metric-label">Quiz</div>
              <div className="om-metric-value">
                {currentBohData.quizRequired ? "Required" : currentBohData.quizRequired === false ? "Off" : "—"}
              </div>
            </div>
          </div>

          <div className="om-actions">
            <button type="button" className="om-btn" onClick={() => openEditor("BOH")}>
              Create / Edit
            </button>
            <button
              type="button"
              className="om-btn om-btn--ghost"
              onClick={() => setActiveDept("BOH")}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Assign to packages */}
      <div className="om-assign">
        <div className="om-assign-title">Assign Orientation to Employment Packages</div>
        <div className="om-assign-grid">
          <div className="om-assign-row">
            <div className="om-assign-label">FOH Package</div>
            <select
              className="om-select"
              value={assignedPackages.FOH || ""}
              onChange={(e) => {
                setAssignedPackages((p) => ({ ...p, FOH: e.target.value || null }));
                setTimeout(() => savePackageAssignment(), 500);
              }}
            >
              <option value="">None</option>
              {packageOptions
                .filter((p) => p.id.startsWith("pkg_foh") || !p.id.startsWith("pkg_"))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="om-assign-row">
            <div className="om-assign-label">BOH Package</div>
            <select
              className="om-select"
              value={assignedPackages.BOH || ""}
              onChange={(e) => {
                setAssignedPackages((p) => ({ ...p, BOH: e.target.value || null }));
                setTimeout(() => savePackageAssignment(), 500);
              }}
            >
              <option value="">None</option>
              {packageOptions
                .filter((p) => p.id.startsWith("pkg_boh") || !p.id.startsWith("pkg_"))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="om-assign-note">
          Orientations are assigned to employment packages. When an employee is assigned a package,
          they will automatically receive the associated orientation.
        </div>
      </div>

      {/* Editor modal */}
      {showEditor && (
        <div className="om-modal-overlay" role="dialog" aria-modal="true">
          <div className="om-modal">
            <div className="om-modal-header">
              <div>
                <div className="om-modal-title">{deptLabel} Orientation</div>
                <div className="om-modal-sub">Create / edit content + rules</div>
              </div>
              <button
                type="button"
                className="om-x"
                onClick={() => {
                  setShowEditor(false);
                  setError(null);
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="om-modal-body">
              {error && (
                <div style={{ 
                  color: "#ef4444", 
                  marginBottom: 12, 
                  padding: 8, 
                  background: "rgba(239, 68, 68, 0.1)", 
                  borderRadius: 6 
                }}>
                  {error}
                </div>
              )}

              {/* Type */}
              <div className="om-form-row">
                <div className="om-form-label">Orientation Type</div>
                <div className="om-chip-row">
                  <button
                    type="button"
                    className={`om-chip ${type === "CUSTOM" ? "active" : ""}`}
                    onClick={() => setType("CUSTOM")}
                  >
                    Custom (Upload/Record)
                  </button>
                  <button
                    type="button"
                    className={`om-chip ${type === "AI" ? "active" : ""}`}
                    onClick={() => setType("AI")}
                  >
                    AI-Generated
                  </button>
                </div>
              </div>

              {/* AI controls */}
              {type === "AI" && (
                <div className="om-ai">
                  <div className="om-ai-grid">
                    <div>
                      <div className="om-form-label">Tone</div>
                      <select
                        className="om-select"
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                      >
                        <option>Professional</option>
                        <option>Casual</option>
                        <option>High-energy</option>
                      </select>
                    </div>

                    <div>
                      <div className="om-form-label">Emphasis</div>
                      <select
                        className="om-select"
                        value={emphasis}
                        onChange={(e) => setEmphasis(e.target.value)}
                      >
                        <option>Guest experience</option>
                        <option>Safety</option>
                        <option>Culture</option>
                        <option>Performance</option>
                      </select>
                    </div>

                    <div>
                      <div className="om-form-label">Estimated Duration (min)</div>
                      <input
                        className="om-input"
                        type="number"
                        min="1"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="om-ai-note">
                    AI generation will be implemented in a future update. For now, use Custom mode.
                  </div>
                </div>
              )}

              {/* Videos */}
              <div className="om-form-row">
                <div className="om-form-label">Videos</div>
                <div className="om-list">
                  {videos.map((v, idx) => (
                    <div key={idx} className="om-list-row">
                      <input
                        className="om-input"
                        value={v.title}
                        onChange={(e) => updateVideo(idx, { title: e.target.value })}
                        placeholder="Video title"
                      />
                      <input
                        className="om-input"
                        value={v.url}
                        onChange={(e) => updateVideo(idx, { url: e.target.value })}
                        placeholder="Video URL (Storage URL later)"
                      />
                      <button
                        type="button"
                        className="om-icon-btn"
                        onClick={() => removeVideo(idx)}
                        aria-label="Remove video"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                  <button type="button" className="om-btn om-btn--small" onClick={addVideo}>
                    + Add Video
                  </button>
                </div>
              </div>

              {/* PDFs */}
              <div className="om-form-row">
                <div className="om-form-label">PDFs</div>
                <div className="om-list">
                  {pdfs.map((p, idx) => (
                    <div key={idx} className="om-list-row">
                      <input
                        className="om-input"
                        value={p.title}
                        onChange={(e) => updatePdf(idx, { title: e.target.value })}
                        placeholder="PDF title"
                      />
                      <input
                        className="om-input"
                        value={p.url}
                        onChange={(e) => updatePdf(idx, { url: e.target.value })}
                        placeholder="PDF URL (Storage URL later)"
                      />
                      <button
                        type="button"
                        className="om-icon-btn"
                        onClick={() => removePdf(idx)}
                        aria-label="Remove pdf"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                  <button type="button" className="om-btn om-btn--small" onClick={addPdf}>
                    + Add PDF
                  </button>
                </div>
              </div>

              {/* Rules */}
              <div className="om-form-row">
                <div className="om-form-label">Completion Rules</div>
                <div className="om-rule-row">
                  <label className="om-check">
                    <input
                      type="checkbox"
                      checked={mustAcknowledge}
                      onChange={(e) => setMustAcknowledge(e.target.checked)}
                    />
                    Must acknowledge completion
                  </label>

                  <label className="om-check">
                    <input
                      type="checkbox"
                      checked={quizRequired}
                      onChange={(e) => setQuizRequired(e.target.checked)}
                    />
                    Quiz required after orientation
                  </label>
                </div>
              </div>
            </div>

            <div className="om-modal-footer">
              <button
                type="button"
                className="om-btn om-btn--ghost"
                onClick={() => {
                  setShowEditor(false);
                  setError(null);
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button 
                type="button" 
                className="om-btn" 
                onClick={saveDraft}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}