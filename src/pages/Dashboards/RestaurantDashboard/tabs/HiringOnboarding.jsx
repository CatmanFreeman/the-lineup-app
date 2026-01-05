// src/pages/Dashboards/RestaurantDashboard/tabs/HiringOnboarding.jsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../../hooks/services/firebase";
import "./HiringOnboarding.css";
import { DOCUMENT_TYPES, getEmployeeDocuments, uploadDocument } from "../../../../utils/documentService";
import { createNotification, NOTIFICATION_PRIORITY, NOTIFICATION_TYPES } from "../../../../utils/notificationService";

const COMPANY_ID = "company-demo";
/**
 * Predefined Checklist Items with Document Type Mapping
 */
const PREDEFINED_CHECKLIST_ITEMS = {
    I9_FORM: {
      id: "i9_form",
      title: "I-9 Form",
      required: true,
      documentType: DOCUMENT_TYPES.I9,
      description: "Employment Eligibility Verification"
    },
    W4_FORM: {
      id: "w4_form",
      title: "W-4 Form",
      required: true,
      documentType: DOCUMENT_TYPES.W4,
      description: "Employee's Withholding Certificate"
    },
    DIRECT_DEPOSIT: {
      id: "direct_deposit",
      title: "Direct Deposit Form",
      required: false,
      documentType: DOCUMENT_TYPES.DIRECT_DEPOSIT,
      description: "Bank account information for payroll"
    },
    EMERGENCY_CONTACT: {
      id: "emergency_contact",
      title: "Emergency Contact Form",
      required: true,
      documentType: DOCUMENT_TYPES.EMERGENCY_CONTACT,
      description: "Emergency contact information"
    },
    LEGAL_ID: {
      id: "legal_id",
      title: "Legal ID",
      required: true,
      documentType: DOCUMENT_TYPES.LEGAL_ID,
      description: "Government-issued photo identification"
    },
    SOCIAL_SECURITY_CARD: {
      id: "social_security_card",
      title: "Social Security Card",
      required: true,
      documentType: DOCUMENT_TYPES.SOCIAL_SECURITY_CARD,
      description: "Social Security card or document"
    },
    ORIENTATION_VIDEO: {
      id: "orientation_video",
      title: "Orientation Video Completion",
      required: true,
      documentType: DOCUMENT_TYPES.ORIENTATION_VIDEO,
      description: "Complete orientation video training"
    },
    SAFETY_TRAINING: {
      id: "safety_training",
      title: "Safety Training Completion",
      required: true,
      documentType: DOCUMENT_TYPES.SAFETY_TRAINING,
      description: "Complete safety training course"
    },
    SERVSAFE: {
      id: "servsafe",
      title: "ServSafe Certification",
      required: false,
      documentType: DOCUMENT_TYPES.SERVSAFE,
      description: "ServSafe food safety certification"
    },
    LIQUOR_CLASS: {
      id: "liquor_class",
      title: "Liquor Class Certification",
      required: false,
      documentType: DOCUMENT_TYPES.LIQUOR_CLASS,
      description: "State-required liquor service certification"
    },
    FOOD_HANDLING: {
      id: "food_handling",
      title: "Food Handling Certification",
      required: false,
      documentType: DOCUMENT_TYPES.FOOD_HANDLING,
      description: "Food handling safety certification"
    }
  };
  
  /**
   * Role-specific template presets
   */
  const ROLE_TEMPLATES = {
    "FOH Server": {
      name: "FOH Server Onboarding",
      description: "Standard onboarding package for front-of-house servers",
      checklist: [
        PREDEFINED_CHECKLIST_ITEMS.I9_FORM,
        PREDEFINED_CHECKLIST_ITEMS.W4_FORM,
        PREDEFINED_CHECKLIST_ITEMS.DIRECT_DEPOSIT,
        PREDEFINED_CHECKLIST_ITEMS.EMERGENCY_CONTACT,
        PREDEFINED_CHECKLIST_ITEMS.LEGAL_ID,
        PREDEFINED_CHECKLIST_ITEMS.SOCIAL_SECURITY_CARD,
        PREDEFINED_CHECKLIST_ITEMS.ORIENTATION_VIDEO,
        PREDEFINED_CHECKLIST_ITEMS.SAFETY_TRAINING,
        PREDEFINED_CHECKLIST_ITEMS.LIQUOR_CLASS,
        PREDEFINED_CHECKLIST_ITEMS.FOOD_HANDLING
      ]
    },
    "FOH Host": {
      name: "FOH Host Onboarding",
      description: "Standard onboarding package for front-of-house hosts",
      checklist: [
        PREDEFINED_CHECKLIST_ITEMS.I9_FORM,
        PREDEFINED_CHECKLIST_ITEMS.W4_FORM,
        PREDEFINED_CHECKLIST_ITEMS.DIRECT_DEPOSIT,
        PREDEFINED_CHECKLIST_ITEMS.EMERGENCY_CONTACT,
        PREDEFINED_CHECKLIST_ITEMS.LEGAL_ID,
        PREDEFINED_CHECKLIST_ITEMS.SOCIAL_SECURITY_CARD,
        PREDEFINED_CHECKLIST_ITEMS.ORIENTATION_VIDEO,
        PREDEFINED_CHECKLIST_ITEMS.SAFETY_TRAINING,
        PREDEFINED_CHECKLIST_ITEMS.FOOD_HANDLING
      ]
    },
    "BOH Cook": {
      name: "BOH Cook Onboarding",
      description: "Standard onboarding package for back-of-house cooks",
      checklist: [
        PREDEFINED_CHECKLIST_ITEMS.I9_FORM,
        PREDEFINED_CHECKLIST_ITEMS.W4_FORM,
        PREDEFINED_CHECKLIST_ITEMS.DIRECT_DEPOSIT,
        PREDEFINED_CHECKLIST_ITEMS.EMERGENCY_CONTACT,
        PREDEFINED_CHECKLIST_ITEMS.LEGAL_ID,
        PREDEFINED_CHECKLIST_ITEMS.SOCIAL_SECURITY_CARD,
        PREDEFINED_CHECKLIST_ITEMS.ORIENTATION_VIDEO,
        PREDEFINED_CHECKLIST_ITEMS.SAFETY_TRAINING,
        PREDEFINED_CHECKLIST_ITEMS.SERVSAFE,
        PREDEFINED_CHECKLIST_ITEMS.FOOD_HANDLING
      ]
    },
    "BOH Prep": {
      name: "BOH Prep Onboarding",
      description: "Standard onboarding package for back-of-house prep staff",
      checklist: [
        PREDEFINED_CHECKLIST_ITEMS.I9_FORM,
        PREDEFINED_CHECKLIST_ITEMS.W4_FORM,
        PREDEFINED_CHECKLIST_ITEMS.DIRECT_DEPOSIT,
        PREDEFINED_CHECKLIST_ITEMS.EMERGENCY_CONTACT,
        PREDEFINED_CHECKLIST_ITEMS.LEGAL_ID,
        PREDEFINED_CHECKLIST_ITEMS.SOCIAL_SECURITY_CARD,
        PREDEFINED_CHECKLIST_ITEMS.ORIENTATION_VIDEO,
        PREDEFINED_CHECKLIST_ITEMS.SAFETY_TRAINING,
        PREDEFINED_CHECKLIST_ITEMS.SERVSAFE,
        PREDEFINED_CHECKLIST_ITEMS.FOOD_HANDLING
      ]
    }
  };
/**
 * =====================================================
 * Hiring & Onboarding — Production-Grade HR System
 * =====================================================
 * 
 * Features:
 * - Employment package templates
 * - Create/edit/send packages
 * - Track completion status
 * - Document management (I-9, W-4, etc.)
 * - Onboarding checklist
 * - Employee assignment
 */

export default function HiringOnboarding({ onClose, staff = [] }) {
  const { restaurantId: routeRestaurantId } = useParams();
  const restaurantId = routeRestaurantId || "123";

  const [view, setView] = useState("packages"); // packages | templates | pending | documents
  const [packages, setPackages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [pendingOnboarding, setPendingOnboarding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreatePackage, setShowCreatePackage] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // ================= LOAD DATA =================
  const loadPackages = useCallback(async () => {
    try {
      const packagesRef = collection(
        db,
        "restaurants",
        restaurantId,
        "employmentPackages"
      );
      
      // Try with orderBy, but handle errors gracefully
      let snap;
      try {
        snap = await getDocs(query(packagesRef, orderBy("createdAt", "desc")));
      } catch (orderError) {
        // If orderBy fails (e.g., no createdAt field), just get all docs
        console.warn("OrderBy failed, fetching without order:", orderError);
        snap = await getDocs(packagesRef);
      }
      
      setPackages(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
      setError(null);
    } catch (err) {
      console.error("Failed to load packages:", err);
      setError(`Failed to load packages: ${err.message}`);
      setPackages([]);
    }
  }, [restaurantId]);

  const loadTemplates = useCallback(async () => {
    try {
      const templatesRef = collection(
        db,
        "restaurants",
        restaurantId,
        "employmentPackageTemplates"
      );
      
      let snap;
      try {
        snap = await getDocs(query(templatesRef, orderBy("name")));
      } catch (orderError) {
        console.warn("OrderBy failed, fetching without order:", orderError);
        snap = await getDocs(templatesRef);
      }
      
      setTemplates(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplates([]);
    }
  }, [restaurantId]);

  const loadPendingOnboarding = useCallback(async () => {
    try {
      const packagesRef = collection(
        db,
        "restaurants",
        restaurantId,
        "employmentPackages"
      );
      
      let snap;
      try {
        snap = await getDocs(
          query(
            packagesRef,
            where("status", "in", ["sent", "in_progress"]),
            orderBy("sentAt", "desc")
          )
        );
      } catch (queryError) {
        // If query fails, try simpler query
        console.warn("Complex query failed, trying simpler query:", queryError);
        try {
          snap = await getDocs(
            query(packagesRef, where("status", "==", "sent"))
          );
        } catch (simpleError) {
          // If that fails too, just get all and filter client-side
          console.warn("Simple query failed, fetching all:", simpleError);
          const allSnap = await getDocs(packagesRef);
          snap = {
            docs: allSnap.docs.filter(
              (d) => {
                const data = d.data();
                return data.status === "sent" || data.status === "in_progress";
              }
            ),
          };
        }
      }

      const pending = [];
      for (const docSnap of snap.docs) {
        const pkg = { id: docSnap.id, ...docSnap.data() };
        if (pkg.assignedTo) {
          try {
            const employeeRef = doc(
              db,
              "restaurants",
              restaurantId,
              "staff",
              pkg.assignedTo
            );
            const empSnap = await getDoc(employeeRef);
            if (empSnap.exists()) {
              pending.push({
                ...pkg,
                employee: { id: empSnap.id, ...empSnap.data() },
              });
            } else {
              // Employee not found, but still include package
              pending.push({ ...pkg, employee: null });
            }
          } catch (empError) {
            console.error(`Failed to load employee ${pkg.assignedTo}:`, empError);
            pending.push({ ...pkg, employee: null });
          }
        }
      }
      setPendingOnboarding(pending);
    } catch (err) {
      console.error("Failed to load pending onboarding:", err);
      setPendingOnboarding([]);
    }
  }, [restaurantId]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      await Promise.all([loadPackages(), loadTemplates()]);
      setLoading(false);
    };
    loadAll();
  }, [loadPackages, loadTemplates]);

  useEffect(() => {
    if (view === "pending") {
      loadPendingOnboarding();
    }
  }, [view, loadPendingOnboarding]);

  // ================= RENDER =================
  return (
    <div className="hiring-onboarding">
      {/* HEADER */}
      <div className="ho-header">
        <h2>Hiring & Onboarding</h2>
        {onClose && (
          <button className="ho-close-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      {/* NAVIGATION */}
      <div className="ho-nav">
        <button
          className={`ho-nav-btn ${view === "packages" ? "active" : ""}`}
          onClick={() => setView("packages")}
        >
          Employment Packages
        </button>
        <button
          className={`ho-nav-btn ${view === "templates" ? "active" : ""}`}
          onClick={() => setView("templates")}
        >
          Templates
        </button>
        <button
          className={`ho-nav-btn ${view === "pending" ? "active" : ""}`}
          onClick={() => setView("pending")}
        >
          Pending Onboarding ({pendingOnboarding.length})
        </button>
        <button
          className={`ho-nav-btn ${view === "documents" ? "active" : ""}`}
          onClick={() => setView("documents")}
        >
          Documents
        </button>
      </div>

      {/* CONTENT */}
      <div className="ho-content">
        {loading ? (
          <div className="ho-loading">Loading...</div>
        ) : error ? (
          <div className="ho-error" style={{ padding: 20, color: "#ef4444" }}>
            {error}
          </div>
        ) : view === "packages" ? (
          <PackagesView
            packages={packages}
            staff={staff}
            restaurantId={restaurantId}
            onRefresh={loadPackages}
            onCreateNew={() => {
              console.log("Create package clicked");
              setShowCreatePackage(true);
            }}
            onSelect={(pkg) => {
              console.log("Package selected:", pkg);
              setSelectedPackage(pkg);
            }}
          />
        ) : view === "templates" ? (
          <TemplatesView
            templates={templates}
            restaurantId={restaurantId}
            onRefresh={loadTemplates}
            onCreateNew={() => {
              console.log("Create template clicked");
              setShowCreateTemplate(true);
            }}
          />
        ) : view === "pending" ? (
          <PendingView
            pending={pendingOnboarding}
            restaurantId={restaurantId}
            onRefresh={loadPendingOnboarding}
          />
        ) : (
          <DocumentsView restaurantId={restaurantId} staff={staff} />
        )}
      </div>

      {/* MODALS */}
      {showCreatePackage && (
        <PackageEditor
          restaurantId={restaurantId}
          staff={staff}
          templates={templates}
          onClose={() => {
            console.log("Closing package editor");
            setShowCreatePackage(false);
            loadPackages();
          }}
        />
      )}

      {selectedPackage && !showCreatePackage && (
        <PackageDetail
          pkg={selectedPackage}
          restaurantId={restaurantId}
          staff={staff}
          onClose={() => {
            console.log("Closing package detail");
            setSelectedPackage(null);
            loadPackages();
            loadPendingOnboarding();
          }}
        />
      )}

      {showCreateTemplate && (
        <TemplateEditor
          restaurantId={restaurantId}
          onClose={() => {
            console.log("Closing template editor");
            setShowCreateTemplate(false);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}

/* =====================================================
   PACKAGES VIEW
   ===================================================== */

function PackagesView({
  packages,
  staff,
  restaurantId,
  onRefresh,
  onCreateNew,
  onSelect,
}) {
  const [filter, setFilter] = useState("all"); // all | sent | completed | draft

  const filteredPackages = useMemo(() => {
    if (filter === "all") return packages;
    return packages.filter((p) => p.status === filter);
  }, [packages, filter]);

  return (
    <div className="ho-view">
      <div className="ho-view-header">
        <div>
          <h3>Employment Packages</h3>
          <p>Create and manage employment packages for new hires</p>
        </div>
        <button 
          className="ho-btn-primary" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Create Package button clicked");
            if (onCreateNew) {
              onCreateNew();
            }
          }}
        >
          + Create Package
        </button>
      </div>

      <div className="ho-filters">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All ({packages.length})
        </button>
        <button
          className={filter === "draft" ? "active" : ""}
          onClick={() => setFilter("draft")}
        >
          Draft ({packages.filter((p) => p.status === "draft").length})
        </button>
        <button
          className={filter === "sent" ? "active" : ""}
          onClick={() => setFilter("sent")}
        >
          Sent ({packages.filter((p) => p.status === "sent").length})
        </button>
        <button
          className={filter === "completed" ? "active" : ""}
          onClick={() => setFilter("completed")}
        >
          Completed ({packages.filter((p) => p.status === "completed").length})
        </button>
      </div>

      <div className="ho-packages-grid">
        {filteredPackages.length === 0 ? (
          <div className="ho-empty">No packages found. Click "Create Package" to get started!</div>
        ) : (
          filteredPackages.map((pkg) => (
            <PackageCard 
              key={pkg.id} 
              pkg={pkg} 
              staff={staff} 
              onClick={() => {
                console.log("Package card clicked:", pkg.id);
                if (onSelect) {
                  onSelect(pkg);
                }
              }} 
            />
          ))
        )}
      </div>
    </div>
  );
}

function PackageCard({ pkg, staff, onClick }) {
  const employee = staff.find((s) => s.uid === pkg.assignedTo || s.id === pkg.assignedTo);
  const statusColors = {
    draft: "#9ca3af",
    sent: "#3b82f6",
    in_progress: "#f59e0b",
    completed: "#10b981",
    expired: "#ef4444",
  };

  const completionPercent = pkg.checklist
    ? Math.round(
        (pkg.checklist.filter((item) => item.completed).length /
          pkg.checklist.length) *
          100
      )
    : 0;

  return (
    <div 
      className="ho-package-card" 
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onClick) onClick();
      }}
      style={{ cursor: "pointer" }}
    >
      <div className="ho-package-header">
        <div>
          <h4>{pkg.name || "Untitled Package"}</h4>
          {employee && (
            <p className="ho-package-employee">{employee.name}</p>
          )}
        </div>
        <span
          className="ho-status-badge"
          style={{ background: statusColors[pkg.status] || "#9ca3af" }}
        >
          {pkg.status?.replace("_", " ") || "draft"}
        </span>
      </div>

      {pkg.checklist && (
        <div className="ho-progress">
          <div className="ho-progress-bar">
            <div
              className="ho-progress-fill"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <span className="ho-progress-text">
            {completionPercent}% Complete
          </span>
        </div>
      )}

      <div className="ho-package-meta">
        {pkg.sentAt && (
          <span>
            Sent: {pkg.sentAt.toDate?.().toLocaleDateString() || "N/A"}
          </span>
        )}
        {pkg.dueDate && (
          <span>
            Due: {pkg.dueDate.toDate?.().toLocaleDateString() || "N/A"}
          </span>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   PACKAGE EDITOR
   ===================================================== */

   function PackageEditor({ restaurantId, staff, templates, onClose }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [checklist, setChecklist] = useState([]);
    const [saving, setSaving] = useState(false);
    const [showPredefinedItems, setShowPredefinedItems] = useState(false);
  
    // Load template when selected
    useEffect(() => {
      if (selectedTemplate) {
        const template = templates.find(t => t.id === selectedTemplate);
        if (template && template.checklist) {
          // Copy template checklist with fresh IDs
          const templateChecklist = template.checklist.map((item, idx) => ({
            ...item,
            id: Date.now() + idx,
            completed: false
          }));
          setChecklist(templateChecklist);
        }
      }
    }, [selectedTemplate, templates]);
  
    // Load role template when employee selected
    useEffect(() => {
      if (assignedTo && !selectedTemplate) {
        const employee = staff.find(s => (s.uid || s.id) === assignedTo);
        if (employee && employee.role && ROLE_TEMPLATES[employee.role]) {
          const roleTemplate = ROLE_TEMPLATES[employee.role];
          const roleChecklist = roleTemplate.checklist.map((item, idx) => ({
            ...item,
            id: Date.now() + idx,
            completed: false
          }));
          setChecklist(roleChecklist);
          setName(roleTemplate.name);
          setDescription(roleTemplate.description);
        }
      }
    }, [assignedTo, staff, selectedTemplate]);
  
    const handleSave = async () => {
      if (!name.trim()) {
        alert("Please enter a package name");
        return;
      }
  
      setSaving(true);
      try {
        const packageData = {
          name: name.trim(),
          description: description.trim(),
          assignedTo: assignedTo || null,
          status: assignedTo ? "draft" : "draft",
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          checklist: checklist.map(item => ({
            id: item.id,
            title: item.title,
            required: item.required,
            documentType: item.documentType || null,
            description: item.description || null,
            completed: false
          })),
          templateId: selectedTemplate || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
  
        const packageRef = doc(
          collection(db, "restaurants", restaurantId, "employmentPackages")
        );
        await setDoc(packageRef, packageData);
  
        alert("Package saved successfully!");
        onClose();
      } catch (err) {
        console.error("Failed to save package:", err);
        alert(`Failed to save package: ${err.message}`);
      } finally {
        setSaving(false);
      }
    };
  
    const handleSend = async () => {
      if (!assignedTo) {
        alert("Please assign this package to an employee");
        return;
      }
  
      setSaving(true);
      try {
        const employee = staff.find(s => (s.uid || s.id) === assignedTo);
        
        const packageData = {
          name: name.trim(),
          description: description.trim(),
          assignedTo: assignedTo,
          status: "sent",
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          checklist: checklist.map(item => ({
            id: item.id,
            title: item.title,
            required: item.required,
            documentType: item.documentType || null,
            description: item.description || null,
            completed: false
          })),
          templateId: selectedTemplate || null,
          sentAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
  
        const packageRef = doc(
          collection(db, "restaurants", restaurantId, "employmentPackages")
        );
        await setDoc(packageRef, packageData);
  
        // Send notification to employee
        if (employee && employee.uid) {
          try {
            await createNotification({
              userId: employee.uid,
              restaurantId: restaurantId,
              companyId: COMPANY_ID,
              type: NOTIFICATION_TYPES.DOCUMENTS_SUBMITTED,
              priority: NOTIFICATION_PRIORITY.HIGH,
              title: "New Onboarding Package",
              message: `You have a new onboarding package: ${name.trim()}`,
              actionUrl: `/dashboard/employee?package=${packageRef.id}`,
              metadata: {
                packageId: packageRef.id,
                packageName: name.trim()
              }
            });
          } catch (notifError) {
            console.error("Failed to send notification:", notifError);
          }
        }
  
        alert("Package sent successfully!");
        onClose();
      } catch (err) {
        console.error("Failed to send package:", err);
        alert(`Failed to send package: ${err.message}`);
      } finally {
        setSaving(false);
      }
    };
  
    const addPredefinedItem = (itemKey) => {
      const predefined = PREDEFINED_CHECKLIST_ITEMS[itemKey];
      if (predefined) {
        const newItem = {
          id: Date.now(),
          title: predefined.title,
          required: predefined.required,
          documentType: predefined.documentType,
          description: predefined.description,
          completed: false
        };
        setChecklist([...checklist, newItem]);
        setShowPredefinedItems(false);
      }
    };
  
    const addCustomChecklistItem = () => {
      setChecklist([
        ...checklist,
        {
          id: Date.now(),
          title: "",
          required: false,
          documentType: null,
          completed: false,
        },
      ]);
    };
  
    const updateChecklistItem = (id, updates) => {
      setChecklist(
        checklist.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    };
  
    const removeChecklistItem = (id) => {
      setChecklist(checklist.filter((item) => item.id !== id));
    };
  
    const availablePredefinedItems = Object.keys(PREDEFINED_CHECKLIST_ITEMS).filter(
      key => !checklist.some(item => item.documentType === PREDEFINED_CHECKLIST_ITEMS[key].documentType)
    );
  
    return (
      <div className="ho-modal-overlay" onClick={onClose}>
        <div className="ho-modal ho-modal-large" onClick={(e) => e.stopPropagation()}>
          <div className="ho-modal-header">
            <h3>Create Employment Package</h3>
            <button className="ho-close-btn" onClick={onClose}>×</button>
          </div>
  
          <div className="ho-modal-body">
            <div className="ho-form-group">
              <label>Package Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., FOH Server Onboarding Package"
              />
            </div>
  
            <div className="ho-form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />
            </div>
  
            <div className="ho-form-group">
              <label>Assign To Employee</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Select employee...</option>
                {staff.map((s) => (
                  <option key={s.uid || s.id} value={s.uid || s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
              {assignedTo && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#4ade80" }}>
                  Role-based template will auto-populate when employee is selected
                </div>
              )}
            </div>
  
            <div className="ho-form-group">
              <label>Use Template (Optional)</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <option value="">None</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
  
            <div className="ho-form-group">
              <label>Due Date (Optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
  
            <div className="ho-form-group">
              <div className="ho-form-group-header">
                <label>Onboarding Checklist</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {availablePredefinedItems.length > 0 && (
                    <button
                      type="button"
                      className="ho-btn-small"
                      onClick={() => setShowPredefinedItems(!showPredefinedItems)}
                    >
                      + Add Predefined
                    </button>
                  )}
                  <button
                    type="button"
                    className="ho-btn-small"
                    onClick={addCustomChecklistItem}
                  >
                    + Add Custom
                  </button>
                </div>
              </div>
  
              {showPredefinedItems && availablePredefinedItems.length > 0 && (
                <div className="ho-predefined-items-dropdown">
                  {availablePredefinedItems.map((key) => {
                    const item = PREDEFINED_CHECKLIST_ITEMS[key];
                    return (
                      <div
                        key={key}
                        className="ho-predefined-item"
                        onClick={() => addPredefinedItem(key)}
                      >
                        <div className="ho-predefined-item-title">{item.title}</div>
                        <div className="ho-predefined-item-desc">{item.description}</div>
                        {item.required && (
                          <span className="ho-required-badge">Required</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
  
              <div className="ho-checklist">
                {checklist.map((item) => (
                  <div key={item.id} className="ho-checklist-item">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) =>
                        updateChecklistItem(item.id, { required: e.target.checked })
                      }
                      title="Required"
                    />
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) =>
                          updateChecklistItem(item.id, { title: e.target.value })
                        }
                        placeholder="Checklist item title"
                        className="ho-checklist-input"
                      />
                      {item.documentType && (
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                          📄 Auto-linked to {item.documentType}
                        </div>
                      )}
                      {item.description && (
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ho-btn-remove"
                      onClick={() => removeChecklistItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {checklist.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>
                    No checklist items. Add predefined items or create custom ones.
                  </div>
                )}
              </div>
            </div>
          </div>
  
          <div className="ho-modal-footer">
            <button className="ho-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="ho-btn-secondary" onClick={handleSave} disabled={saving}>
              Save Draft
            </button>
            <button
              className="ho-btn-primary"
              onClick={handleSend}
              disabled={saving || !assignedTo}
            >
              {saving ? "Sending..." : "Send Package"}
            </button>
          </div>
        </div>
      </div>
    );
  }
/* =====================================================
   PACKAGE DETAIL VIEW
   ===================================================== */

function PackageDetail({ pkg, restaurantId, staff, onClose }) {
  const [updating, setUpdating] = useState(false);
  const employee = staff.find((s) => s.uid === pkg.assignedTo || s.id === pkg.assignedTo);

  const handleMarkComplete = async () => {
    if (!window.confirm("Mark this package as completed?")) return;

    setUpdating(true);
    try {
      const packageRef = doc(
        db,
        "restaurants",
        restaurantId,
        "employmentPackages",
        pkg.id
      );
      await updateDoc(packageRef, {
        status: "completed",
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert("Package marked as completed!");
      onClose();
    } catch (err) {
      console.error("Failed to update package:", err);
      alert(`Failed to update package: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleResend = async () => {
    setUpdating(true);
    try {
      const packageRef = doc(
        db,
        "restaurants",
        restaurantId,
        "employmentPackages",
        pkg.id
      );
      await updateDoc(packageRef, {
        status: "sent",
        sentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert("Package resent!");
      onClose();
    } catch (err) {
      console.error("Failed to resend package:", err);
      alert(`Failed to resend package: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const completionPercent = pkg.checklist
    ? Math.round(
        (pkg.checklist.filter((item) => item.completed).length /
          pkg.checklist.length) *
          100
      )
    : 0;

  return (
    <div className="ho-modal-overlay" onClick={onClose}>
      <div className="ho-modal ho-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ho-modal-header">
          <h3>{pkg.name || "Employment Package"}</h3>
          <button className="ho-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="ho-modal-body">
          <div className="ho-detail-section">
            <h4>Package Information</h4>
            <div className="ho-detail-grid">
              <div>
                <label>Status</label>
                <span className="ho-status-badge">{pkg.status || "draft"}</span>
              </div>
              {employee && (
                <div>
                  <label>Assigned To</label>
                  <span>{employee.name} ({employee.role})</span>
                </div>
              )}
              {pkg.sentAt && (
                <div>
                  <label>Sent Date</label>
                  <span>
                    {pkg.sentAt.toDate?.().toLocaleDateString() || "N/A"}
                  </span>
                </div>
              )}
              {pkg.dueDate && (
                <div>
                  <label>Due Date</label>
                  <span>
                    {pkg.dueDate.toDate?.().toLocaleDateString() || "N/A"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {pkg.checklist && (
            <div className="ho-detail-section">
              <h4>Onboarding Checklist</h4>
              <div className="ho-progress">
                <div className="ho-progress-bar">
                  <div
                    className="ho-progress-fill"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <span className="ho-progress-text">
                  {completionPercent}% Complete
                </span>
              </div>
              <div className="ho-checklist-detail">
                {pkg.checklist.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`ho-checklist-item-detail ${
                      item.completed ? "completed" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.completed || false}
                      disabled
                    />
                    <span>{item.title}</span>
                    {item.required && (
                      <span className="ho-required-badge">Required</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pkg.documents && pkg.documents.length > 0 && (
            <div className="ho-detail-section">
              <h4>Documents</h4>
              <div className="ho-documents-list">
                {pkg.documents.map((doc, idx) => (
                  <div key={idx} className="ho-document-item">
                    <span>{doc.name || "Document"}</span>
                    <span className="ho-document-status">
                      {doc.status || "pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="ho-modal-footer">
          <button className="ho-btn-secondary" onClick={onClose}>
            Close
          </button>
          {pkg.status === "sent" && (
            <button
              className="ho-btn-secondary"
              onClick={handleResend}
              disabled={updating}
            >
              Resend
            </button>
          )}
          {pkg.status !== "completed" && (
            <button
              className="ho-btn-primary"
              onClick={handleMarkComplete}
              disabled={updating}
            >
              {updating ? "Updating..." : "Mark as Completed"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATES VIEW
   ===================================================== */

function TemplatesView({ templates, restaurantId, onRefresh, onCreateNew }) {
  return (
    <div className="ho-view">
      <div className="ho-view-header">
        <div>
          <h3>Package Templates</h3>
          <p>Create reusable templates for employment packages</p>
        </div>
        <button 
          className="ho-btn-primary" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Create Template button clicked");
            if (onCreateNew) {
              onCreateNew();
            }
          }}
        >
          + Create Template
        </button>
      </div>

      <div className="ho-templates-grid">
        {templates.length === 0 ? (
          <div className="ho-empty">No templates found. Create your first template!</div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="ho-template-card">
              <h4>{template.name}</h4>
              <p>{template.description || "No description"}</p>
              <div className="ho-template-meta">
                <span>{template.checklist?.length || 0} checklist items</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* =====================================================
   TEMPLATE EDITOR
   ===================================================== */

   function TemplateEditor({ restaurantId, onClose }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [role, setRole] = useState("");
    const [checklist, setChecklist] = useState([]);
    const [saving, setSaving] = useState(false);
    const [showPredefinedItems, setShowPredefinedItems] = useState(false);
  
    // Load role template when role selected
    useEffect(() => {
      if (role && ROLE_TEMPLATES[role]) {
        const roleTemplate = ROLE_TEMPLATES[role];
        setName(roleTemplate.name);
        setDescription(roleTemplate.description);
        setChecklist(roleTemplate.checklist.map((item, idx) => ({
          ...item,
          id: Date.now() + idx
        })));
      }
    }, [role]);
  
    const handleSave = async () => {
      if (!name.trim()) {
        alert("Please enter a template name");
        return;
      }
  
      setSaving(true);
      try {
        const templateData = {
          name: name.trim(),
          description: description.trim(),
          role: role || null,
          checklist: checklist.map(item => ({
            id: item.id,
            title: item.title,
            required: item.required,
            documentType: item.documentType || null,
            description: item.description || null
          })),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
  
        const templateRef = doc(
          collection(db, "restaurants", restaurantId, "employmentPackageTemplates")
        );
        await setDoc(templateRef, templateData);
  
        alert("Template saved successfully!");
        onClose();
      } catch (err) {
        console.error("Failed to save template:", err);
        alert(`Failed to save template: ${err.message}`);
      } finally {
        setSaving(false);
      }
    };
  
    const addPredefinedItem = (itemKey) => {
      const predefined = PREDEFINED_CHECKLIST_ITEMS[itemKey];
      if (predefined) {
        const newItem = {
          id: Date.now(),
          title: predefined.title,
          required: predefined.required,
          documentType: predefined.documentType,
          description: predefined.description
        };
        setChecklist([...checklist, newItem]);
        setShowPredefinedItems(false);
      }
    };
  
    const addCustomChecklistItem = () => {
      setChecklist([
        ...checklist,
        {
          id: Date.now(),
          title: "",
          required: false,
          documentType: null,
        },
      ]);
    };
  
    const updateChecklistItem = (id, updates) => {
      setChecklist(
        checklist.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    };
  
    const removeChecklistItem = (id) => {
      setChecklist(checklist.filter((item) => item.id !== id));
    };
  
    const availablePredefinedItems = Object.keys(PREDEFINED_CHECKLIST_ITEMS).filter(
      key => !checklist.some(item => item.documentType === PREDEFINED_CHECKLIST_ITEMS[key].documentType)
    );
  
    return (
      <div className="ho-modal-overlay" onClick={onClose}>
        <div className="ho-modal ho-modal-large" onClick={(e) => e.stopPropagation()}>
          <div className="ho-modal-header">
            <h3>Create Template</h3>
            <button className="ho-close-btn" onClick={onClose}>×</button>
          </div>
  
          <div className="ho-modal-body">
            <div className="ho-form-group">
              <label>Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., FOH Server Template"
              />
            </div>
  
            <div className="ho-form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />
            </div>
  
            <div className="ho-form-group">
              <label>Role (Optional - Auto-populates template)</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">Select role...</option>
                <option value="FOH Server">FOH Server</option>
                <option value="FOH Host">FOH Host</option>
                <option value="BOH Cook">BOH Cook</option>
                <option value="BOH Prep">BOH Prep</option>
              </select>
              {role && ROLE_TEMPLATES[role] && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#4ade80" }}>
                  ✓ Template auto-populated for {role}
                </div>
              )}
            </div>
  
            <div className="ho-form-group">
              <div className="ho-form-group-header">
                <label>Checklist Items</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {availablePredefinedItems.length > 0 && (
                    <button
                      type="button"
                      className="ho-btn-small"
                      onClick={() => setShowPredefinedItems(!showPredefinedItems)}
                    >
                      + Add Predefined
                    </button>
                  )}
                  <button
                    type="button"
                    className="ho-btn-small"
                    onClick={addCustomChecklistItem}
                  >
                    + Add Custom
                  </button>
                </div>
              </div>
  
              {showPredefinedItems && availablePredefinedItems.length > 0 && (
                <div className="ho-predefined-items-dropdown">
                  {availablePredefinedItems.map((key) => {
                    const item = PREDEFINED_CHECKLIST_ITEMS[key];
                    return (
                      <div
                        key={key}
                        className="ho-predefined-item"
                        onClick={() => addPredefinedItem(key)}
                      >
                        <div className="ho-predefined-item-title">{item.title}</div>
                        <div className="ho-predefined-item-desc">{item.description}</div>
                        {item.required && (
                          <span className="ho-required-badge">Required</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
  
              <div className="ho-checklist">
                {checklist.map((item) => (
                  <div key={item.id} className="ho-checklist-item">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) =>
                        updateChecklistItem(item.id, { required: e.target.checked })
                      }
                      title="Required"
                    />
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) =>
                          updateChecklistItem(item.id, { title: e.target.value })
                        }
                        placeholder="Checklist item title"
                        className="ho-checklist-input"
                      />
                      {item.documentType && (
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                          📄 Auto-linked to {item.documentType}
                        </div>
                      )}
                      {item.description && (
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ho-btn-remove"
                      onClick={() => removeChecklistItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
  
          <div className="ho-modal-footer">
            <button className="ho-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="ho-btn-primary"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>
      </div>
    );
  }

/* =====================================================
   PENDING VIEW
   ===================================================== */

function PendingView({ pending, restaurantId, onRefresh }) {
  return (
    <div className="ho-view">
      <div className="ho-view-header">
        <div>
          <h3>Pending Onboarding</h3>
          <p>Track employees who are currently completing their onboarding</p>
        </div>
      </div>

      <div className="ho-pending-list">
        {pending.length === 0 ? (
          <div className="ho-empty">No pending onboarding packages</div>
        ) : (
          pending.map((item) => (
            <div key={item.id} className="ho-pending-card">
              <div className="ho-pending-header">
                <div>
                  <h4>{item.name || "Employment Package"}</h4>
                  <p>{item.employee?.name || "Unknown Employee"}</p>
                </div>
                <span className="ho-status-badge">{item.status}</span>
              </div>
              {item.checklist && (
                <div className="ho-progress">
                  <div className="ho-progress-bar">
                    <div
                      className="ho-progress-fill"
                      style={{
                        width: `${
                          Math.round(
                            (item.checklist.filter((i) => i.completed).length /
                              item.checklist.length) *
                              100
                          )
                        }%`,
                      }}
                    />
                  </div>
                  <span className="ho-progress-text">
                    {
                      item.checklist.filter((i) => i.completed).length
                    } / {item.checklist.length} items completed
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* =====================================================
   DOCUMENTS VIEW - Grid View (Employees × Document Types)
   ===================================================== */

   function DocumentsView({ restaurantId, staff }) {
    const [employeeDocuments, setEmployeeDocuments] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedDocumentType, setSelectedDocumentType] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [filterRole, setFilterRole] = useState("all"); // "all" | "FOH" | "BOH"
    const [groupByRole, setGroupByRole] = useState(true);
  
    const COMPANY_ID = "company-demo";
  
    // All required document types
    const REQUIRED_DOCUMENT_TYPES = [
      { key: DOCUMENT_TYPES.I9, label: "I-9 Form", required: true },
      { key: DOCUMENT_TYPES.W4, label: "W-4 Form", required: true },
      { key: DOCUMENT_TYPES.DIRECT_DEPOSIT, label: "Direct Deposit", required: false },
      { key: DOCUMENT_TYPES.EMERGENCY_CONTACT, label: "Emergency Contact", required: true },
      { key: DOCUMENT_TYPES.LEGAL_ID, label: "Legal ID", required: true },
      { key: DOCUMENT_TYPES.SOCIAL_SECURITY_CARD, label: "Social Security Card", required: true },
      { key: DOCUMENT_TYPES.ORIENTATION_VIDEO, label: "Orientation Video", required: true },
      { key: DOCUMENT_TYPES.SAFETY_TRAINING, label: "Safety Training", required: true },
      { key: DOCUMENT_TYPES.SERVSAFE, label: "ServSafe", required: false },
      { key: DOCUMENT_TYPES.LIQUOR_CLASS, label: "Liquor Class", required: false },
      { key: DOCUMENT_TYPES.FOOD_HANDLING, label: "Food Handling", required: false }
    ];
  
    // Load all employee documents
    useEffect(() => {
      loadAllDocuments();
    }, [restaurantId, staff]);
  
    const loadAllDocuments = async () => {
      setLoading(true);
      const documentsMap = {};
  
      for (const employee of staff) {
        const employeeId = employee.uid || employee.id;
        if (!employeeId) continue;
  
        try {
          const documents = await getEmployeeDocuments(
            employeeId,
            restaurantId,
            COMPANY_ID
          );
  
          // Group by document type and get latest approved/uploaded
          const docMap = {};
          documents.forEach(doc => {
            const docType = doc.documentType;
            if (!docMap[docType] || 
                (doc.status === "approved" && docMap[docType].status !== "approved") ||
                (doc.uploadedAt > (docMap[docType].uploadedAt || ""))) {
              docMap[docType] = doc;
            }
          });
  
          documentsMap[employeeId] = docMap;
        } catch (error) {
          console.error(`Failed to load documents for ${employeeId}:`, error);
          documentsMap[employeeId] = {};
        }
      }
  
      setEmployeeDocuments(documentsMap);
      setLoading(false);
    };
  
    const getDocumentStatus = (employeeId, documentType) => {
      const docs = employeeDocuments[employeeId] || {};
      const doc = docs[documentType];
  
      if (!doc) return "missing";
      if (doc.status === "approved") return "approved";
      if (doc.status === "rejected" || doc.status === "needs_update") return "needs_update";
      if (doc.status === "uploaded" || doc.status === "verifying") return "uploaded";
      return "missing";
    };
  
    const getStatusBadge = (status) => {
      switch (status) {
        case "approved":
          return <span className="ho-doc-status-badge ho-doc-status-approved">✓ Done</span>;
        case "uploaded":
          return <span className="ho-doc-status-badge ho-doc-status-pending">⏳ Pending</span>;
        case "needs_update":
          return <span className="ho-doc-status-badge ho-doc-status-needs-update">⚠ Needs Update</span>;
        case "missing":
        default:
          return <span className="ho-doc-status-badge ho-doc-status-missing">— Missing</span>;
      }
    };
  
    const handleUploadClick = (employeeId, documentType) => {
      setSelectedEmployee(employeeId);
      setSelectedDocumentType(documentType);
      setShowUploadModal(true);
    };
  
    const handleUpload = async (file) => {
      if (!file || !selectedEmployee || !selectedDocumentType) return;
  
      setUploading(true);
      try {
        await uploadDocument({
          file,
          employeeId: selectedEmployee,
          restaurantId,
          companyId: COMPANY_ID,
          documentType: selectedDocumentType,
          uploadedBy: "manager"
        });
  
        // Reload documents
        await loadAllDocuments();
        setShowUploadModal(false);
        setSelectedEmployee(null);
        setSelectedDocumentType(null);
      } catch (error) {
        console.error("Upload failed:", error);
        alert(`Upload failed: ${error.message}`);
      } finally {
        setUploading(false);
      }
    };
  
    // Group staff by role
    const fohStaff = staff.filter(s => 
      s.role && (s.role.includes("Server") || s.role.includes("Host") || s.role.includes("FOH"))
    );
    const bohStaff = staff.filter(s => 
      s.role && (s.role.includes("Cook") || s.role.includes("Prep") || s.role.includes("BOH"))
    );
    const otherStaff = staff.filter(s => 
      !fohStaff.includes(s) && !bohStaff.includes(s)
    );
  
    const filteredStaff = filterRole === "FOH" ? fohStaff :
                          filterRole === "BOH" ? bohStaff :
                          staff;
  
    const displayStaff = groupByRole ? 
      [...fohStaff, ...bohStaff, ...otherStaff] : 
      filteredStaff;
  
    if (loading) {
      return (
        <div className="ho-view">
          <div className="ho-loading">Loading documents...</div>
        </div>
      );
    }
  
    return (
      <div className="ho-view">
        <div className="ho-view-header">
          <div>
            <h3>Document Management</h3>
            <p>View and manage employee documents. Click a cell to upload or view documents.</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={groupByRole}
                onChange={(e) => setGroupByRole(e.target.checked)}
              />
              Group by Role
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "white"
              }}
            >
              <option value="all">All Staff</option>
              <option value="FOH">Front of House</option>
              <option value="BOH">Back of House</option>
            </select>
          </div>
        </div>
  
        <div className="ho-documents-grid-container">
          <div className="ho-documents-grid">
            {/* Header Row */}
            <div className="ho-doc-grid-header">
              <div className="ho-doc-grid-cell ho-doc-grid-cell-sticky">Employee</div>
              {REQUIRED_DOCUMENT_TYPES.map((docType) => (
                <div
                  key={docType.key}
                  className="ho-doc-grid-cell ho-doc-grid-cell-header"
                  title={docType.required ? "Required" : "Optional"}
                >
                  {docType.label}
                  {docType.required && <span className="ho-required-indicator">*</span>}
                </div>
              ))}
            </div>
  
            {/* Employee Rows */}
            {displayStaff.length === 0 ? (
              <div className="ho-empty" style={{ gridColumn: "1 / -1", padding: 40 }}>
                No staff members found
              </div>
            ) : (
              displayStaff.map((employee, idx) => {
                const employeeId = employee.uid || employee.id;
                const isFOH = fohStaff.includes(employee);
                const isBOH = bohStaff.includes(employee);
                const isGroupHeader = groupByRole && (
                  (idx === 0 && isFOH) ||
                  (idx === fohStaff.length && isBOH) ||
                  (idx === fohStaff.length + bohStaff.length && otherStaff.length > 0)
                );
                const groupLabel = isFOH && idx === 0 ? "Front of House" :
                                  isBOH && idx === fohStaff.length ? "Back of House" :
                                  !isFOH && !isBOH && idx === fohStaff.length + bohStaff.length ? "Other" :
                                  null;
  
                return (
                  <React.Fragment key={employeeId}>
                    {isGroupHeader && groupLabel && (
                      <div className="ho-doc-group-header" style={{ gridColumn: "1 / -1" }}>
                        {groupLabel}
                      </div>
                    )}
                    <div className="ho-doc-grid-row">
                      <div className="ho-doc-grid-cell ho-doc-grid-cell-sticky ho-doc-employee-name">
                        <div>
                          <strong>{employee.name}</strong>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            {employee.role || "—"}
                          </div>
                        </div>
                      </div>
                      {REQUIRED_DOCUMENT_TYPES.map((docType) => {
                        const status = getDocumentStatus(employeeId, docType.key);
                        return (
                          <div
                            key={docType.key}
                            className={`ho-doc-grid-cell ho-doc-grid-cell-clickable ho-doc-status-${status}`}
                            onClick={() => handleUploadClick(employeeId, docType.key)}
                            title={`Click to ${status === "missing" ? "upload" : "view/update"} ${docType.label}`}
                          >
                            {getStatusBadge(status)}
                          </div>
                        );
                      })}
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
  
        {/* Upload Modal */}
        {showUploadModal && (
          <DocumentUploadModal
            employeeId={selectedEmployee}
            employeeName={staff.find(s => (s.uid || s.id) === selectedEmployee)?.name || "Employee"}
            documentType={selectedDocumentType}
            documentLabel={REQUIRED_DOCUMENT_TYPES.find(d => d.key === selectedDocumentType)?.label || "Document"}
            onClose={() => {
              setShowUploadModal(false);
              setSelectedEmployee(null);
              setSelectedDocumentType(null);
            }}
            onUpload={handleUpload}
            uploading={uploading}
          />
        )}
      </div>
    );
  }
  
  /* =====================================================
     DOCUMENT UPLOAD MODAL
     ===================================================== */
  
  function DocumentUploadModal({
    employeeId,
    employeeName,
    documentType,
    documentLabel,
    onClose,
    onUpload,
    uploading
  }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
  
    const handleFileChange = (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile) {
        // Validate file type
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
        if (!allowedTypes.includes(selectedFile.type)) {
          alert("Invalid file type. Only JPG, PNG, and PDF files are allowed.");
          return;
        }
  
        // Validate file size (max 10MB)
        if (selectedFile.size > 10 * 1024 * 1024) {
          alert("File size must be less than 10MB.");
          return;
        }
  
        setFile(selectedFile);
  
        // Create preview for images
        if (selectedFile.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setPreview(reader.result);
          };
          reader.readAsDataURL(selectedFile);
        } else {
          setPreview(null);
        }
      }
    };
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!file) {
        alert("Please select a file");
        return;
      }
      await onUpload(file);
    };
  
    return (
      <div className="ho-modal-overlay" onClick={onClose}>
        <div className="ho-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ho-modal-header">
            <h3>Upload Document</h3>
            <button className="ho-close-btn" onClick={onClose}>×</button>
          </div>
  
          <div className="ho-modal-body">
            <div className="ho-form-group">
              <label>Employee</label>
              <input type="text" value={employeeName} disabled />
            </div>
  
            <div className="ho-form-group">
              <label>Document Type</label>
              <input type="text" value={documentLabel} disabled />
            </div>
  
            <div className="ho-form-group">
              <label>File *</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Accepted formats: JPG, PNG, PDF (max 10MB)
              </div>
            </div>
  
            {preview && (
              <div className="ho-form-group">
                <label>Preview</label>
                <img
                  src={preview}
                  alt="Preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 300,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8
                  }}
                />
              </div>)}
  
            {file && !preview && (
              <div className="ho-form-group">
                <div style={{ padding: 12, background: "#f3f4f6", borderRadius: 6 }}>
                  📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              </div>
            )}
          </div>
  
          <div className="ho-modal-footer">
            <button className="ho-btn-secondary" onClick={onClose} disabled={uploading}>
              Cancel
            </button>
            <button
              className="ho-btn-primary"
              onClick={handleSubmit}
              disabled={uploading || !file}
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </div>
      </div>
    );
  }