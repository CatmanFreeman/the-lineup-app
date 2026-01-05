// src/pages/Dashboards/RestaurantDashboard/tabs/OrientationTests.jsx

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import { generateTestQuestions, generateOrientationScript, generateRecordingGuidance } from "../../../../utils/aiService";
import "./OrientationTests.css";

const COMPANY_ID = "company-demo";

/**
 * =====================================================
 * Orientation & Tests — Production-Grade Training System
 * =====================================================
 * 
 * Features:
 * - FOH/BOH orientation management
 * - AI-powered test creation
 * - AI-powered orientation script generation
 * - Recording guidance for equipment and locations
 * - Test assignment to employees
 * - Test results tracking
 * - Compliance certificate tracking
 * - Employee completion status
 */

export default function OrientationTests({ onClose, staff = [] }) {
  const { restaurantId: routeRestaurantId } = useParams();
  const restaurantId = routeRestaurantId || "123";

  const [view, setView] = useState("orientations"); // orientations | tests | results | compliance
  const [orientations, setOrientations] = useState([]);
  const [tests, setTests] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOrientationEditor, setShowOrientationEditor] = useState(false);
  const [showTestEditor, setShowTestEditor] = useState(false);
  const [selectedOrientation, setSelectedOrientation] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedDept, setSelectedDept] = useState("FOH"); // FOH | BOH

  // ================= LOAD DATA =================
  const loadOrientations = useCallback(async () => {
    try {
      const orientationsRef = collection(
        db,
        "restaurants",
        restaurantId,
        "orientations"
      );
      const snap = await getDocs(query(orientationsRef, orderBy("department")));
      setOrientations(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (err) {
      console.error("Failed to load orientations:", err);
      setError(`Failed to load orientations: ${err.message}`);
    }
  }, [restaurantId]);

  const loadTests = useCallback(async () => {
    try {
      const testsRef = collection(
        db,
        "restaurants",
        restaurantId,
        "tests"
      );
      const snap = await getDocs(query(testsRef, orderBy("name")));
      setTests(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (err) {
      console.error("Failed to load tests:", err);
    }
  }, [restaurantId]);

  const loadTestResults = useCallback(async () => {
    try {
      const resultsRef = collection(
        db,
        "restaurants",
        restaurantId,
        "testResults"
      );
      const snap = await getDocs(query(resultsRef, orderBy("completedAt", "desc")));
      
      const results = [];
      for (const docSnap of snap.docs) {
        const result = { id: docSnap.id, ...docSnap.data() };
        if (result.employeeId) {
          const employee = staff.find((s) => (s.uid || s.id) === result.employeeId);
          if (employee) {
            results.push({ ...result, employee });
          }
        }
      }
      setTestResults(results);
    } catch (err) {
      console.error("Failed to load test results:", err);
    }
  }, [restaurantId, staff]);

  const loadCompliance = useCallback(async () => {
    try {
      const complianceRef = collection(
        db,
        "restaurants",
        restaurantId,
        "compliance"
      );
      const snap = await getDocs(query(complianceRef, orderBy("employeeName")));
      
      const complianceList = [];
      for (const docSnap of snap.docs) {
        const comp = { id: docSnap.id, ...docSnap.data() };
        const employee = staff.find((s) => (s.uid || s.id) === comp.employeeId);
        if (employee) {
          complianceList.push({ ...comp, employee });
        }
      }
      setCompliance(complianceList);
    } catch (err) {
      console.error("Failed to load compliance:", err);
    }
  }, [restaurantId, staff]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadOrientations(), loadTests()]);
      setLoading(false);
    };
    loadAll();
  }, [loadOrientations, loadTests]);

  useEffect(() => {
    if (view === "results") {
      loadTestResults();
    } else if (view === "compliance") {
      loadCompliance();
    }
  }, [view, loadTestResults, loadCompliance]);

  // ================= RENDER =================
  return (
    <div className="orientation-tests">
      {/* HEADER */}
      <div className="ot-header">
        <h2>Orientation & Tests</h2>
        {onClose && (
          <button className="ot-close-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      {/* NAVIGATION */}
      <div className="ot-nav">
        <button
          className={`ot-nav-btn ${view === "orientations" ? "active" : ""}`}
          onClick={() => setView("orientations")}
        >
          Orientations
        </button>
        <button
          className={`ot-nav-btn ${view === "tests" ? "active" : ""}`}
          onClick={() => setView("tests")}
        >
          Tests
        </button>
        <button
          className={`ot-nav-btn ${view === "results" ? "active" : ""}`}
          onClick={() => setView("results")}
        >
          Test Results
        </button>
        <button
          className={`ot-nav-btn ${view === "compliance" ? "active" : ""}`}
          onClick={() => setView("compliance")}
        >
          Compliance
        </button>
      </div>

      {/* CONTENT */}
      <div className="ot-content">
        {loading ? (
          <div className="ot-loading">Loading...</div>
        ) : view === "orientations" ? (
          <OrientationsView
            orientations={orientations}
            restaurantId={restaurantId}
            onRefresh={loadOrientations}
            onCreateNew={(dept) => {
              setSelectedDept(dept);
              setShowOrientationEditor(true);
            }}
            onSelect={(orientation) => setSelectedOrientation(orientation)}
          />
        ) : view === "tests" ? (
          <TestsView
            tests={tests}
            staff={staff}
            restaurantId={restaurantId}
            onRefresh={loadTests}
            onCreateNew={() => setShowTestEditor(true)}
            onSelect={(test) => setSelectedTest(test)}
          />
        ) : view === "results" ? (
          <TestResultsView
            results={testResults}
            tests={tests}
            restaurantId={restaurantId}
            onRefresh={loadTestResults}
          />
        ) : (
          <ComplianceView
            compliance={compliance}
            staff={staff}
            restaurantId={restaurantId}
            onRefresh={loadCompliance}
          />
        )}
      </div>

      {/* MODALS */}
      {showOrientationEditor && (
        <OrientationEditor
          restaurantId={restaurantId}
          department={selectedDept}
          existingOrientation={selectedOrientation}
          onClose={() => {
            setShowOrientationEditor(false);
            setSelectedOrientation(null);
            loadOrientations();
          }}
        />
      )}

      {selectedOrientation && !showOrientationEditor && (
        <OrientationDetail
          orientation={selectedOrientation}
          restaurantId={restaurantId}
          staff={staff}
          onClose={() => {
            setSelectedOrientation(null);
            loadOrientations();
          }}
        />
      )}

      {showTestEditor && (
        <TestEditor
          restaurantId={restaurantId}
          existingTest={selectedTest}
          onClose={() => {
            setShowTestEditor(false);
            setSelectedTest(null);
            loadTests();
          }}
        />
      )}

      {selectedTest && !showTestEditor && (
        <TestDetail
          test={selectedTest}
          staff={staff}
          restaurantId={restaurantId}
          onClose={() => {
            setSelectedTest(null);
            loadTests();
            loadTestResults();
          }}
        />
      )}
    </div>
  );
}

/* =====================================================
   ORIENTATIONS VIEW
   ===================================================== */

function OrientationsView({
  orientations,
  restaurantId,
  onRefresh,
  onCreateNew,
  onSelect,
}) {
  const fohOrientation = orientations.find((o) => o.department === "FOH");
  const bohOrientation = orientations.find((o) => o.department === "BOH");

  return (
    <div className="ot-view">
      <div className="ot-view-header">
        <div>
          <h3>Orientations</h3>
          <p>Manage FOH and BOH orientation content and requirements</p>
        </div>
      </div>

      <div className="ot-orientations-grid">
        <OrientationCard
          department="FOH"
          orientation={fohOrientation}
          onCreate={() => onCreateNew("FOH")}
          onEdit={() => onSelect(fohOrientation)}
        />
        <OrientationCard
          department="BOH"
          orientation={bohOrientation}
          onCreate={() => onCreateNew("BOH")}
          onEdit={() => onSelect(bohOrientation)}
        />
      </div>
    </div>
  );
}

function OrientationCard({ department, orientation, onCreate, onEdit }) {
  const deptLabel = department === "FOH" ? "Front of House" : "Back of House";
  const hasOrientation = !!orientation;

  return (
    <div className="ot-orientation-card">
      <div className="ot-orientation-header">
        <div>
          <h4>{deptLabel} Orientation</h4>
          <p>
            {department === "FOH"
              ? "Hosts, Servers, Bartenders"
              : "Stations, Prep, Safety, Dish"}
          </p>
        </div>
        {hasOrientation && (
          <span className="ot-status-badge active">Active</span>
        )}
      </div>

      {hasOrientation ? (
        <>
          <div className="ot-orientation-metrics">
            <div className="ot-metric">
              <span className="ot-metric-label">Type</span>
              <span className="ot-metric-value">
                {orientation.type || "Custom"}
              </span>
            </div>
            <div className="ot-metric">
              <span className="ot-metric-label">Duration</span>
              <span className="ot-metric-value">
                {orientation.estimatedDuration || 0} min
              </span>
            </div>
            <div className="ot-metric">
              <span className="ot-metric-label">Quiz Required</span>
              <span className="ot-metric-value">
                {orientation.quizRequired ? "Yes" : "No"}
              </span>
            </div>
          </div>
          <div className="ot-orientation-actions">
            <button className="ot-btn-primary" onClick={onEdit}>
              Edit
            </button>
            <button className="ot-btn-secondary">Preview</button>
          </div>
        </>
      ) : (
        <div className="ot-orientation-empty">
          <p>No orientation created yet</p>
          <button className="ot-btn-primary" onClick={onCreate}>
            Create Orientation
          </button>
        </div>
      )}
    </div>
  );
}

/* =====================================================
   ORIENTATION EDITOR (WITH AI ENHANCEMENTS)
   ===================================================== */

function OrientationEditor({
  restaurantId,
  department,
  existingOrientation,
  onClose,
}) {
  const [type, setType] = useState(existingOrientation?.type || "CUSTOM");
  const [tone, setTone] = useState(existingOrientation?.tone || "Professional");
  const [emphasis, setEmphasis] = useState(
    existingOrientation?.emphasis || "Guest experience"
  );
  const [estimatedDuration, setEstimatedDuration] = useState(
    existingOrientation?.estimatedDuration || 15
  );
  const [mustAcknowledge, setMustAcknowledge] = useState(
    existingOrientation?.mustAcknowledge !== false
  );
  const [quizRequired, setQuizRequired] = useState(
    existingOrientation?.quizRequired !== false
  );
  const [videos, setVideos] = useState(
    existingOrientation?.videos || []
  );
  const [pdfs, setPdfs] = useState(
    existingOrientation?.pdfs || []
  );
  const [saving, setSaving] = useState(false);
  
  // AI Generation State
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiScript, setAiScript] = useState(null);
  const [recordingGuidanceLoading, setRecordingGuidanceLoading] = useState(false);

  const addVideo = () => {
    setVideos([...videos, { title: "", url: "", content: "", recordingGuidance: null }]);
  };

  const updateVideo = (index, updates) => {
    setVideos(videos.map((v, i) => (i === index ? { ...v, ...updates } : v)));
  };

  const removeVideo = (index) => {
    setVideos(videos.filter((_, i) => i !== index));
  };

  const addPdf = () => {
    setPdfs([...pdfs, { title: "", url: "" }]);
  };

  const updatePdf = (index, updates) => {
    setPdfs(pdfs.map((p, i) => (i === index ? { ...p, ...updates } : p)));
  };

  const removePdf = (index) => {
    setPdfs(pdfs.filter((_, i) => i !== index));
  };

  const handleAIGenerateScript = async () => {
    setAiGenerating(true);
    try {
      const script = await generateOrientationScript({
        department,
        tone,
        emphasis,
        duration: estimatedDuration,
        includeRecordingGuidance: true,
      });

      setAiScript(script);
      
      // Convert script sections to video entries with recording guidance
      const scriptVideos = script.sections.map((section, idx) => ({
        title: section.title,
        url: "",
        content: section.content,
        duration: section.duration,
        recordingGuidance: section.recordingGuidance,
        order: idx,
      }));

      if (videos.length === 0) {
        setVideos(scriptVideos);
      } else {
        const confirmReplace = window.confirm(
          "Replace existing videos with AI-generated script sections?"
        );
        if (confirmReplace) {
          setVideos(scriptVideos);
        } else {
          setVideos([...videos, ...scriptVideos]);
        }
      }

      alert("AI script generated successfully! Review and customize the sections below.");
    } catch (error) {
      console.error("AI script generation error:", error);
      alert(`Failed to generate script: ${error.message}`);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleGetRecordingGuidance = async (videoIndex, equipment, location) => {
    setRecordingGuidanceLoading(true);
    
    try {
      const guidance = await generateRecordingGuidance({
        equipment: equipment || "equipment",
        location: location || "restaurant",
        department,
        purpose: "orientation",
      });

      updateVideo(videoIndex, { recordingGuidance: guidance.guidance });
      alert("Recording guidance generated! Check the guidance section below.");
    } catch (error) {
      console.error("Recording guidance error:", error);
      alert(`Failed to generate guidance: ${error.message}`);
    } finally {
      setRecordingGuidanceLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const orientationData = {
        department,
        type,
        tone: type === "AI" ? tone : null,
        emphasis: type === "AI" ? emphasis : null,
        estimatedDuration,
        mustAcknowledge,
        quizRequired,
        videos: videos.filter((v) => v.title || v.url),
        pdfs: pdfs.filter((p) => p.title || p.url),
        status: "active",
        updatedAt: serverTimestamp(),
      };

      if (existingOrientation) {
        const orientationRef = doc(
          db,
          "restaurants",
          restaurantId,
          "orientations",
          existingOrientation.id
        );
        await updateDoc(orientationRef, orientationData);
      } else {
        orientationData.createdAt = serverTimestamp();
        const orientationRef = doc(
          collection(db, "restaurants", restaurantId, "orientations")
        );
        await setDoc(orientationRef, orientationData);
      }

      onClose();
    } catch (err) {
      console.error("Failed to save orientation:", err);
      alert(`Failed to save orientation: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deptLabel = department === "FOH" ? "Front of House" : "Back of House";

  // Equipment suggestions based on department
  const equipmentSuggestions = department === "FOH"
    ? ["POS System", "Coffee Machine", "Tea Station", "Bar Equipment", "Host Station"]
    : ["Grill", "Fryer", "Prep Station", "Dishwasher", "Storage Areas"];

  const locationSuggestions = department === "FOH"
    ? ["Dining Area", "Bar Area", "Host Station", "Service Counter", "Outdoor Seating"]
    : ["Main Kitchen", "Prep Area", "Dish Station", "Storage", "Walk-in Cooler"];

  return (
    <div className="ot-modal-overlay" onClick={onClose}>
      <div className="ot-modal ot-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ot-modal-header">
          <h3>{deptLabel} Orientation</h3>
          <button className="ot-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="ot-modal-body">
          <div className="ot-form-group">
            <label>Orientation Type</label>
            <div className="ot-chip-row">
              <button
                type="button"
                className={`ot-chip ${type === "CUSTOM" ? "active" : ""}`}
                onClick={() => setType("CUSTOM")}
              >
                Custom (Upload/Record)
              </button>
              <button
                type="button"
                className={`ot-chip ${type === "AI" ? "active" : ""}`}
                onClick={() => setType("AI")}
              >
                AI-Generated Script
              </button>
            </div>
          </div>

          {type === "AI" && (
            <div className="ot-ai-section">
              <div className="ot-form-row">
                <div className="ot-form-group">
                  <label>Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="ot-input"
                  >
                    <option>Professional</option>
                    <option>Casual</option>
                    <option>High-energy</option>
                    <option>Friendly</option>
                  </select>
                </div>
                <div className="ot-form-group">
                  <label>Emphasis</label>
                  <select
                    value={emphasis}
                    onChange={(e) => setEmphasis(e.target.value)}
                    className="ot-input"
                  >
                    <option>Guest experience</option>
                    <option>Safety</option>
                    <option>Culture</option>
                    <option>Performance</option>
                    <option>Efficiency</option>
                  </select>
                </div>
                <div className="ot-form-group">
                  <label>Estimated Duration (min)</label>
                  <input
                    type="number"
                    min="1"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(Number(e.target.value))}
                    className="ot-input"
                  />
                </div>
              </div>
              
              <button
                type="button"
                className="ot-btn-primary"
                onClick={handleAIGenerateScript}
                disabled={aiGenerating}
              >
                {aiGenerating ? "Generating Script..." : "Generate AI Script"}
              </button>
              
              {aiGenerating && (
                <div className="ot-ai-loading">
                  <p>AI is creating a comprehensive orientation script with recording guidance...</p>
                </div>
              )}

              {aiScript && (
                <div className="ot-ai-script-preview">
                  <h4>Generated Script: {aiScript.title}</h4>
                  <p>Total Duration: {aiScript.totalDuration} minutes</p>
                  <p>Sections: {aiScript.sections.length}</p>
                </div>
              )}
            </div>
          )}

          <div className="ot-form-group">
            <div className="ot-form-group-header">
              <label>Videos & Recording Scripts</label>
              <button type="button" className="ot-btn-small" onClick={addVideo}>
                + Add Video
              </button>
            </div>
            <div className="ot-media-list">
              {videos.map((video, idx) => (
                <div key={idx} className="ot-video-item-enhanced">
                  <div className="ot-video-header">
                    <input
                      type="text"
                      value={video.title}
                      onChange={(e) => updateVideo(idx, { title: e.target.value })}
                      placeholder="Video title / Section name"
                      className="ot-input"
                    />
                    <button
                      type="button"
                      className="ot-btn-remove"
                      onClick={() => removeVideo(idx)}
                    >
                      ×
                    </button>
                  </div>
                  
                  {video.content && (
                    <div className="ot-script-content">
                      <label>Script Content:</label>
                      <textarea
                        value={video.content}
                        onChange={(e) => updateVideo(idx, { content: e.target.value })}
                        placeholder="What to say in this video..."
                        rows={4}
                        className="ot-input"
                      />
                    </div>
                  )}

                  <div className="ot-recording-guidance-section">
                    <div className="ot-guidance-header">
                      <label>Recording Guidance</label>
                      <button
                        type="button"
                        className="ot-btn-small"
                        onClick={() => {
                          const equipment = prompt("Enter equipment name (e.g., Coffee Machine):");
                          const location = prompt("Enter location (e.g., Bar Area):");
                          if (equipment && location) {
                            handleGetRecordingGuidance(idx, equipment, location);
                          }
                        }}
                        disabled={recordingGuidanceLoading}
                      >
                        {recordingGuidanceLoading ? "Generating..." : "Get AI Recording Guidance"}
                      </button>
                    </div>

                    {video.recordingGuidance && (
                      <div className="ot-guidance-details">
                        <div className="ot-guidance-item">
                          <strong>Location:</strong> {video.recordingGuidance.location || "N/A"}
                        </div>
                        <div className="ot-guidance-item">
                          <strong>Equipment:</strong> {Array.isArray(video.recordingGuidance.equipment) 
                            ? video.recordingGuidance.equipment.join(", ") 
                            : video.recordingGuidance.equipment || "N/A"}
                        </div>
                        {video.recordingGuidance.keyPoints && (
                          <div className="ot-guidance-item">
                            <strong>Key Points:</strong>
                            <ul>
                              {video.recordingGuidance.keyPoints.map((point, pIdx) => (
                                <li key={pIdx}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {video.recordingGuidance.script && (
                          <div className="ot-guidance-item">
                            <strong>Suggested Script:</strong>
                            <p>{video.recordingGuidance.script}</p>
                          </div>
                        )}
                        {video.recordingGuidance.cameraAngles && (
                          <div className="ot-guidance-item">
                            <strong>Camera Angles:</strong>
                            <ul>
                              {video.recordingGuidance.cameraAngles.map((angle, aIdx) => (
                                <li key={aIdx}>{angle}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="ot-quick-suggestions">
                      <small>Quick suggestions:</small>
                      <div className="ot-suggestion-tags">
                        {equipmentSuggestions.slice(0, 3).map((eq) => (
                          <button
                            key={eq}
                            type="button"
                            className="ot-tag"
                            onClick={() => {
                              const location = locationSuggestions[0];
                              handleGetRecordingGuidance(idx, eq, location);
                            }}
                          >
                            {eq}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={video.url}
                    onChange={(e) => updateVideo(idx, { url: e.target.value })}
                    placeholder="Video URL (upload after recording)"
                    className="ot-input"
                    style={{ marginTop: 8 }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="ot-form-group">
            <div className="ot-form-group-header">
              <label>PDFs</label>
              <button type="button" className="ot-btn-small" onClick={addPdf}>
                + Add PDF
              </button>
            </div>
            <div className="ot-media-list">
              {pdfs.map((pdf, idx) => (
                <div key={idx} className="ot-media-item">
                  <input
                    type="text"
                    value={pdf.title}
                    onChange={(e) => updatePdf(idx, { title: e.target.value })}
                    placeholder="PDF title"
                    className="ot-input"
                  />
                  <input
                    type="text"
                    value={pdf.url}
                    onChange={(e) => updatePdf(idx, { url: e.target.value })}
                    placeholder="PDF URL"
                    className="ot-input"
                  />
                  <button
                    type="button"
                    className="ot-btn-remove"
                    onClick={() => removePdf(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="ot-form-group">
            <label>Completion Rules</label>
            <div className="ot-checkbox-row">
              <label className="ot-checkbox">
                <input
                  type="checkbox"
                  checked={mustAcknowledge}
                  onChange={(e) => setMustAcknowledge(e.target.checked)}
                />
                Must acknowledge completion
              </label>
              <label className="ot-checkbox">
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

        <div className="ot-modal-footer">
          <button className="ot-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ot-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Orientation"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   TESTS VIEW
   ===================================================== */

function TestsView({
  tests,
  staff,
  restaurantId,
  onRefresh,
  onCreateNew,
  onSelect,
}) {
  const [filter, setFilter] = useState("all"); // all | required | optional

  const filteredTests = useMemo(() => {
    if (filter === "all") return tests;
    return tests.filter((t) => t.required === (filter === "required"));
  }, [tests, filter]);

  return (
    <div className="ot-view">
      <div className="ot-view-header">
        <div>
          <h3>Tests</h3>
          <p>Create and manage tests for menu knowledge, compliance, and safety</p>
        </div>
        <button className="ot-btn-primary" onClick={onCreateNew}>
          + Create Test
        </button>
      </div>

      <div className="ot-filters">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All ({tests.length})
        </button>
        <button
          className={filter === "required" ? "active" : ""}
          onClick={() => setFilter("required")}
        >
          Required ({tests.filter((t) => t.required).length})
        </button>
        <button
          className={filter === "optional" ? "active" : ""}
          onClick={() => setFilter("optional")}
        >
          Optional ({tests.filter((t) => !t.required).length})
        </button>
      </div>

      <div className="ot-tests-grid">
        {filteredTests.length === 0 ? (
          <div className="ot-empty">No tests found</div>
        ) : (
          filteredTests.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              onClick={() => onSelect(test)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TestCard({ test, onClick }) {
  return (
    <div className="ot-test-card" onClick={onClick}>
      <div className="ot-test-header">
        <div>
          <h4>{test.name || "Untitled Test"}</h4>
          <p>{test.description || "No description"}</p>
        </div>
        {test.required && (
          <span className="ot-status-badge required">Required</span>
        )}
      </div>
      <div className="ot-test-meta">
        <span>{test.questions?.length || 0} questions</span>
        <span>Passing: {test.passingScore || 70}%</span>
        <span>{test.category || "General"}</span>
      </div>
    </div>
  );
}

/* =====================================================
   TEST EDITOR (WITH AI ENHANCEMENTS)
   ===================================================== */

function TestEditor({ restaurantId, existingTest, onClose }) {
  const [name, setName] = useState(existingTest?.name || "");
  const [description, setDescription] = useState(existingTest?.description || "");
  const [category, setCategory] = useState(existingTest?.category || "General");
  const [required, setRequired] = useState(existingTest?.required || false);
  const [passingScore, setPassingScore] = useState(existingTest?.passingScore || 70);
  const [questions, setQuestions] = useState(
    existingTest?.questions || []
  );
  const [saving, setSaving] = useState(false);
  
  // AI Generation State
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    numberOfQuestions: 10,
    difficulty: "medium",
    customContext: "",
  });

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: Date.now(),
        question: "",
        type: "multiple_choice",
        options: ["", "", "", ""],
        correctAnswer: 0,
        points: 1,
      },
    ]);
  };

  const updateQuestion = (id, updates) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const removeQuestion = (id) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleAIGenerate = async () => {
    if (!name.trim()) {
      alert("Please enter a test name first");
      return;
    }

    setAiGenerating(true);
    try {
      const generatedQuestions = await generateTestQuestions({
        category,
        testName: name,
        numberOfQuestions: aiConfig.numberOfQuestions,
        difficulty: aiConfig.difficulty,
        customContext: aiConfig.customContext,
      });

      // Merge with existing questions or replace
      if (questions.length === 0) {
        setQuestions(generatedQuestions);
      } else {
        const confirmReplace = window.confirm(
          `Generate ${generatedQuestions.length} new questions? This will replace your current questions.`
        );
        if (confirmReplace) {
          setQuestions(generatedQuestions);
        } else {
          // Append instead
          setQuestions([...questions, ...generatedQuestions]);
        }
      }

      setShowAIGenerator(false);
      alert(`Successfully generated ${generatedQuestions.length} questions!`);
    } catch (error) {
      console.error("AI generation error:", error);
      alert(`Failed to generate questions: ${error.message}`);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a test name");
      return;
    }

    if (questions.length === 0) {
      alert("Please add at least one question");
      return;
    }

    setSaving(true);
    try {
      const testData = {
        name: name.trim(),
        description: description.trim(),
        category,
        required,
        passingScore,
        questions: questions.filter((q) => q.question.trim()),
        updatedAt: serverTimestamp(),
      };

      if (existingTest) {
        const testRef = doc(
          db,
          "restaurants",
          restaurantId,
          "tests",
          existingTest.id
        );
        await updateDoc(testRef, testData);
      } else {
        testData.createdAt = serverTimestamp();
        const testRef = doc(collection(db, "restaurants", restaurantId, "tests"));
        await setDoc(testRef, testData);
      }

      onClose();
    } catch (err) {
      console.error("Failed to save test:", err);
      alert(`Failed to save test: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ot-modal-overlay" onClick={onClose}>
      <div className="ot-modal ot-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ot-modal-header">
          <h3>{existingTest ? "Edit Test" : "Create Test"}</h3>
          <button className="ot-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="ot-modal-body">
          <div className="ot-form-group">
            <label>Test Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Menu Knowledge Test"
              className="ot-input"
            />
          </div>

          <div className="ot-form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Test description..."
              rows={3}
              className="ot-input"
            />
          </div>

          <div className="ot-form-row">
            <div className="ot-form-group">
              <label>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="ot-input"
              >
                <option>General</option>
                <option>Menu Knowledge</option>
                <option>Alcohol Compliance</option>
                <option>Food Safety</option>
                <option>Service Standards</option>
              </select>
            </div>
            <div className="ot-form-group">
              <label>Passing Score (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="ot-input"
              />
            </div>
            <div className="ot-form-group">
              <label className="ot-checkbox">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                />
                Required Test
              </label>
            </div>
          </div>

          {/* AI GENERATOR SECTION */}
          <div className="ot-ai-generator-section">
            <div className="ot-form-group-header">
              <label>AI Test Generation</label>
              <button
                type="button"
                className="ot-btn-primary"
                onClick={() => setShowAIGenerator(!showAIGenerator)}
              >
                {showAIGenerator ? "Hide AI Generator" : "Generate with AI"}
              </button>
            </div>

            {showAIGenerator && (
              <div className="ot-ai-config">
                <div className="ot-form-row">
                  <div className="ot-form-group">
                    <label>Number of Questions</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={aiConfig.numberOfQuestions}
                      onChange={(e) =>
                        setAiConfig({
                          ...aiConfig,
                          numberOfQuestions: Number(e.target.value),
                        })
                      }
                      className="ot-input"
                    />
                  </div>
                  <div className="ot-form-group">
                    <label>Difficulty</label>
                    <select
                      value={aiConfig.difficulty}
                      onChange={(e) =>
                        setAiConfig({ ...aiConfig, difficulty: e.target.value })
                      }
                      className="ot-input"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
                <div className="ot-form-group">
                  <label>Additional Context (Optional)</label>
                  <textarea
                    value={aiConfig.customContext}
                    onChange={(e) =>
                      setAiConfig({ ...aiConfig, customContext: e.target.value })
                    }
                    placeholder="e.g., Focus on vegetarian options, emphasize wine pairings, etc."
                    rows={2}
                    className="ot-input"
                  />
                </div>
                <button
                  type="button"
                  className="ot-btn-primary"
                  onClick={handleAIGenerate}
                  disabled={aiGenerating || !name.trim()}
                >
                  {aiGenerating ? "Generating Questions..." : "Generate Questions"}
                </button>
                {aiGenerating && (
                  <div className="ot-ai-loading">
                    <p>AI is generating questions based on your test category and requirements...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="ot-form-group">
            <div className="ot-form-group-header">
              <label>Questions ({questions.length})</label>
              <button type="button" className="ot-btn-small" onClick={addQuestion}>
                + Add Question Manually
              </button>
            </div>
            <div className="ot-questions-list">
              {questions.map((q, idx) => (
                <div key={q.id} className="ot-question-item">
                  <div className="ot-question-header">
                    <span className="ot-question-number">Q{idx + 1}</span>
                    <button
                      type="button"
                      className="ot-btn-remove"
                      onClick={() => removeQuestion(q.id)}
                    >
                      ×
                    </button>
                  </div>
                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) =>
                      updateQuestion(q.id, { question: e.target.value })
                    }
                    placeholder="Question text"
                    className="ot-input"
                  />
                  {q.explanation && (
                    <div className="ot-question-explanation">
                      <small>Explanation: {q.explanation}</small>
                    </div>
                  )}
                  <div className="ot-options-list">
                    {q.options.map((opt, optIdx) => (
                      <div key={optIdx} className="ot-option-item">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correctAnswer === optIdx}
                          onChange={() =>
                            updateQuestion(q.id, { correctAnswer: optIdx })
                          }
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOptions = [...q.options];
                            newOptions[optIdx] = e.target.value;
                            updateQuestion(q.id, { options: newOptions });
                          }}
                          placeholder={`Option ${optIdx + 1}`}
                          className="ot-input"
                        />
                        {q.correctAnswer === optIdx && (
                          <span className="ot-correct-badge">✓ Correct</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ot-modal-footer">
          <button className="ot-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ot-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Test"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   TEST DETAIL & ASSIGNMENT
   ===================================================== */

function TestDetail({ test, staff, restaurantId, onClose }) {
  const [assigning, setAssigning] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");

  const handleAssign = async () => {
    if (!selectedEmployee) {
      alert("Please select an employee");
      return;
    }

    setAssigning(true);
    try {
      // Create assignment record
      const assignmentRef = doc(
        collection(db, "restaurants", restaurantId, "testAssignments")
      );
      await setDoc(assignmentRef, {
        testId: test.id,
        testName: test.name,
        employeeId: selectedEmployee,
        status: "assigned",
        assignedAt: serverTimestamp(),
        dueDate: null, // Can add due date later
      });

      alert("Test assigned successfully!");
      setSelectedEmployee("");
    } catch (err) {
      console.error("Failed to assign test:", err);
      alert(`Failed to assign test: ${err.message}`);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="ot-modal-overlay" onClick={onClose}>
      <div className="ot-modal ot-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ot-modal-header">
          <h3>{test.name}</h3>
          <button className="ot-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="ot-modal-body">
          <div className="ot-detail-section">
            <h4>Test Information</h4>
            <div className="ot-detail-grid">
              <div>
                <label>Category</label>
                <span>{test.category || "General"}</span>
              </div>
              <div>
                <label>Passing Score</label>
                <span>{test.passingScore || 70}%</span>
              </div>
              <div>
                <label>Required</label>
                <span>{test.required ? "Yes" : "No"}</span>
              </div>
              <div>
                <label>Questions</label>
                <span>{test.questions?.length || 0}</span>
              </div>
            </div>
          </div>

          {test.description && (
            <div className="ot-detail-section">
              <h4>Description</h4>
              <p>{test.description}</p>
            </div>
          )}

          <div className="ot-detail-section">
            <h4>Assign to Employee</h4>
            <div className="ot-assign-form">
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="ot-input"
              >
                <option value="">Select employee...</option>
                {staff.map((s) => (
                  <option key={s.uid || s.id} value={s.uid || s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
              <button
                className="ot-btn-primary"
                onClick={handleAssign}
                disabled={assigning || !selectedEmployee}
              >
                {assigning ? "Assigning..." : "Assign Test"}
              </button>
            </div>
          </div>
        </div>

        <div className="ot-modal-footer">
          <button className="ot-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   TEST RESULTS VIEW
   ===================================================== */

function TestResultsView({ results, tests, restaurantId, onRefresh }) {
  const [filter, setFilter] = useState("all"); // all | passed | failed

  const filteredResults = useMemo(() => {
    if (filter === "all") return results;
    return results.filter((r) => {
      const passed = r.score >= (r.passingScore || 70);
      return filter === "passed" ? passed : !passed;
    });
  }, [results, filter]);

  return (
    <div className="ot-view">
      <div className="ot-view-header">
        <div>
          <h3>Test Results</h3>
          <p>View employee test completion and scores</p>
        </div>
      </div>

      <div className="ot-filters">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All ({results.length})
        </button>
        <button
          className={filter === "passed" ? "active" : ""}
          onClick={() => setFilter("passed")}
        >
          Passed ({results.filter((r) => r.score >= (r.passingScore || 70)).length})
        </button>
        <button
          className={filter === "failed" ? "active" : ""}
          onClick={() => setFilter("failed")}
        >
          Failed ({results.filter((r) => r.score < (r.passingScore || 70)).length})
        </button>
      </div>

      <div className="ot-results-table">
        <div className="ot-table-header">
          <div>Employee</div>
          <div>Test</div>
          <div>Score</div>
          <div>Status</div>
          <div>Completed</div>
        </div>
        {filteredResults.length === 0 ? (
          <div className="ot-empty">No test results found</div>
        ) : (
          filteredResults.map((result) => (
            <div key={result.id} className="ot-table-row">
              <div>{result.employee?.name || "Unknown"}</div>
              <div>{result.testName || "Unknown Test"}</div>
              <div>
                <span
                  className={
                    result.score >= (result.passingScore || 70)
                      ? "ot-score-pass"
                      : "ot-score-fail"
                  }
                >
                  {result.score}%
                </span>
              </div>
              <div>
                <span
                  className={`ot-status-badge ${
                    result.score >= (result.passingScore || 70)
                      ? "passed"
                      : "failed"
                  }`}
                >
                  {result.score >= (result.passingScore || 70) ? "Passed" : "Failed"}
                </span>
              </div>
              <div>
                {result.completedAt?.toDate?.().toLocaleDateString() || "N/A"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* =====================================================
   COMPLIANCE VIEW
   ===================================================== */

function ComplianceView({ compliance, staff, restaurantId, onRefresh }) {
  return (
    <div className="ot-view">
      <div className="ot-view-header">
        <div>
          <h3>Compliance Tracking</h3>
          <p>Track employee certifications and compliance requirements</p>
        </div>
      </div>

      <div className="ot-compliance-table">
        <div className="ot-table-header">
          <div>Employee</div>
          <div>I-9 Status</div>
          <div>Food Safety</div>
          <div>Alcohol Compliance</div>
          <div>Other Certifications</div>
        </div>
        {staff.length === 0 ? (
          <div className="ot-empty">No staff members found</div>
        ) : (
          staff.map((employee) => {
            const empCompliance = compliance.find(
              (c) => c.employeeId === (employee.uid || employee.id)
            );
            return (
              <div key={employee.uid || employee.id} className="ot-table-row">
                <div>{employee.name}</div>
                <div>
                  <span className="ot-compliance-status">
                    {empCompliance?.i9Status || "Not uploaded"}
                  </span>
                </div>
                <div>
                  <span className="ot-compliance-status">
                    {empCompliance?.foodSafety || "Not certified"}
                  </span>
                </div>
                <div>
                  <span className="ot-compliance-status">
                    {empCompliance?.alcoholCompliance || "Not certified"}
                  </span>
                </div>
                <div>
                  <span className="ot-compliance-status">
                    {empCompliance?.otherCertifications?.length || 0} certifications
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* =====================================================
   ORIENTATION DETAIL
   ===================================================== */

function OrientationDetail({ orientation, restaurantId, staff, onClose }) {
  return (
    <div className="ot-modal-overlay" onClick={onClose}>
      <div className="ot-modal ot-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ot-modal-header">
          <h3>
            {orientation.department === "FOH"
              ? "Front of House"
              : "Back of House"}{" "}
            Orientation
          </h3>
          <button className="ot-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="ot-modal-body">
          <div className="ot-detail-section">
            <h4>Orientation Details</h4>
            <div className="ot-detail-grid">
              <div>
                <label>Type</label>
                <span>{orientation.type || "Custom"}</span>
              </div>
              <div>
                <label>Duration</label>
                <span>{orientation.estimatedDuration || 0} minutes</span>
              </div>
              <div>
                <label>Quiz Required</label>
                <span>{orientation.quizRequired ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          {orientation.videos && orientation.videos.length > 0 && (
            <div className="ot-detail-section">
              <h4>Videos ({orientation.videos.length})</h4>
              <div className="ot-media-list-detail">
                {orientation.videos.map((video, idx) => (
                  <div key={idx} className="ot-media-item-detail">
                    <span>{video.title || "Untitled Video"}</span>
                    {video.url && (
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ot-link"
                      >
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {orientation.pdfs && orientation.pdfs.length > 0 && (
            <div className="ot-detail-section">
              <h4>PDFs ({orientation.pdfs.length})</h4>
              <div className="ot-media-list-detail">
                {orientation.pdfs.map((pdf, idx) => (
                  <div key={idx} className="ot-media-item-detail">
                    <span>{pdf.title || "Untitled PDF"}</span>
                    {pdf.url && (
                      <a
                        href={pdf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ot-link"
                      >
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="ot-modal-footer">
          <button className="ot-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}