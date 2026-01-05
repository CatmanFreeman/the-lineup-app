// src/components/SkillsExperience.jsx

import React, { useState, useEffect } from "react";
import {
  getEmployeeSkills,
  addSkill,
  updateSkill,
  deleteSkill,
  addCertification,
  updateCertification,
  deleteCertification,
  addSpecialization,
  updateSpecialization,
  deleteSpecialization,
} from "../utils/skillsService";
import "./SkillsExperience.css";

export default function SkillsExperience({ employeeId, viewMode = "edit" }) {
  const [skills, setSkills] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit states
  const [editingSkill, setEditingSkill] = useState(null);
  const [editingCert, setEditingCert] = useState(null);
  const [editingSpec, setEditingSpec] = useState(null);
  
  // Form states
  const [newSkill, setNewSkill] = useState({ name: "", level: "intermediate", years: "" });
  const [newCert, setNewCert] = useState({ name: "", issuer: "", issueDate: "", expiryDate: "", credentialId: "" });
  const [newSpec, setNewSpec] = useState({ area: "", description: "" });

  useEffect(() => {
    if (employeeId) {
      loadSkills();
    }
  }, [employeeId]);

  const loadSkills = async () => {
    if (!employeeId) return;
    
    setLoading(true);
    setError("");
    try {
      const data = await getEmployeeSkills(employeeId);
      setSkills(data.skills || []);
      setCertifications(data.certifications || []);
      setSpecializations(data.specializations || []);
    } catch (err) {
      console.error("Error loading skills:", err);
      setError("Failed to load skills data");
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 3000);
  };

  // Skills handlers
  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkill.name.trim()) {
      setError("Please enter a skill name");
      return;
    }

    try {
      const skill = {
        name: newSkill.name.trim(),
        level: newSkill.level,
        years: newSkill.years ? Number(newSkill.years) : null,
        addedAt: new Date().toISOString(),
      };
      
      await addSkill(employeeId, skill);
      await loadSkills();
      setNewSkill({ name: "", level: "intermediate", years: "" });
      showSuccess("Skill added successfully");
    } catch (err) {
      setError(err.message || "Failed to add skill");
    }
  };

  const handleUpdateSkill = async (index, updatedSkill) => {
    try {
      await updateSkill(employeeId, index, updatedSkill);
      await loadSkills();
      setEditingSkill(null);
      showSuccess("Skill updated successfully");
    } catch (err) {
      setError(err.message || "Failed to update skill");
    }
  };

  const handleDeleteSkill = async (index) => {
    if (!window.confirm("Delete this skill?")) return;
    
    try {
      await deleteSkill(employeeId, index);
      await loadSkills();
      showSuccess("Skill deleted successfully");
    } catch (err) {
      setError(err.message || "Failed to delete skill");
    }
  };

  // Certification handlers
  const handleAddCertification = async (e) => {
    e.preventDefault();
    if (!newCert.name.trim()) {
      setError("Please enter a certification name");
      return;
    }

    try {
      const cert = {
        name: newCert.name.trim(),
        issuer: newCert.issuer.trim() || null,
        issueDate: newCert.issueDate || null,
        expiryDate: newCert.expiryDate || null,
        credentialId: newCert.credentialId.trim() || null,
        addedAt: new Date().toISOString(),
      };
      
      await addCertification(employeeId, cert);
      await loadSkills();
      setNewCert({ name: "", issuer: "", issueDate: "", expiryDate: "", credentialId: "" });
      showSuccess("Certification added successfully");
    } catch (err) {
      setError(err.message || "Failed to add certification");
    }
  };

  const handleUpdateCertification = async (index, updatedCert) => {
    try {
      await updateCertification(employeeId, index, updatedCert);
      await loadSkills();
      setEditingCert(null);
      showSuccess("Certification updated successfully");
    } catch (err) {
      setError(err.message || "Failed to update certification");
    }
  };

  const handleDeleteCertification = async (index) => {
    if (!window.confirm("Delete this certification?")) return;
    
    try {
      await deleteCertification(employeeId, index);
      await loadSkills();
      showSuccess("Certification deleted successfully");
    } catch (err) {
      setError(err.message || "Failed to delete certification");
    }
  };

  // Specialization handlers
  const handleAddSpecialization = async (e) => {
    e.preventDefault();
    if (!newSpec.area.trim()) {
      setError("Please enter a specialization area");
      return;
    }

    try {
      const spec = {
        area: newSpec.area.trim(),
        description: newSpec.description.trim() || null,
        addedAt: new Date().toISOString(),
      };
      
      await addSpecialization(employeeId, spec);
      await loadSkills();
      setNewSpec({ area: "", description: "" });
      showSuccess("Specialization added successfully");
    } catch (err) {
      setError(err.message || "Failed to add specialization");
    }
  };

  const handleUpdateSpecialization = async (index, updatedSpec) => {
    try {
      await updateSpecialization(employeeId, index, updatedSpec);
      await loadSkills();
      setEditingSpec(null);
      showSuccess("Specialization updated successfully");
    } catch (err) {
      setError(err.message || "Failed to update specialization");
    }
  };

  const handleDeleteSpecialization = async (index) => {
    if (!window.confirm("Delete this specialization?")) return;
    
    try {
      await deleteSpecialization(employeeId, index);
      await loadSkills();
      showSuccess("Specialization deleted successfully");
    } catch (err) {
      setError(err.message || "Failed to delete specialization");
    }
  };

  const isCertExpiring = (expiryDate) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
  };

  const isCertExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  if (loading) {
    return <div className="skills-loading">Loading skills...</div>;
  }

  return (
    <div className="skills-experience">
      {error && <div className="skills-error">{error}</div>}
      {success && <div className="skills-success">{success}</div>}

      {/* Skills Section */}
      <div className="skills-section">
        <div className="skills-section-header">
          <h3 className="skills-section-title">Skills</h3>
          {viewMode === "edit" && (
            <button
              type="button"
              className="skills-add-btn"
              onClick={() => setEditingSkill({ name: "", level: "intermediate", years: "" })}
            >
              + Add Skill
            </button>
          )}
        </div>

        {viewMode === "edit" && editingSkill && (
          <form onSubmit={(e) => {
            e.preventDefault();
            if (editingSkill.name.trim()) {
              handleAddSkill(e);
            }
          }} className="skills-form">
            <input
              type="text"
              placeholder="Skill name (e.g., Customer Service, Food Safety)"
              value={editingSkill.name}
              onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
              className="skills-input"
              required
            />
            <select
              value={editingSkill.level}
              onChange={(e) => setEditingSkill({ ...editingSkill, level: e.target.value })}
              className="skills-select"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
            <input
              type="number"
              placeholder="Years of experience (optional)"
              value={editingSkill.years || ""}
              onChange={(e) => setEditingSkill({ ...editingSkill, years: e.target.value })}
              className="skills-input"
              min="0"
            />
            <div className="skills-form-actions">
              <button type="submit" className="skills-btn skills-btn-primary">Add</button>
              <button
                type="button"
                className="skills-btn skills-btn-secondary"
                onClick={() => setEditingSkill(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {skills.length === 0 ? (
          <div className="skills-empty">No skills added yet</div>
        ) : (
          <div className="skills-list">
            {skills.map((skill, index) => (
              <div key={index} className="skills-item">
                <div className="skills-item-content">
                  <div className="skills-item-name">{skill.name}</div>
                  <div className="skills-item-meta">
                    <span className={`skills-level skills-level-${skill.level}`}>
                      {skill.level.charAt(0).toUpperCase() + skill.level.slice(1)}
                    </span>
                    {skill.years && (
                      <span className="skills-years">{skill.years} {skill.years === 1 ? "year" : "years"}</span>
                    )}
                  </div>
                </div>
                {viewMode === "edit" && (
                  <div className="skills-item-actions">
                    <button
                      type="button"
                      className="skills-edit-btn"
                      onClick={() => setEditingSkill({ ...skill, index })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="skills-delete-btn"
                      onClick={() => handleDeleteSkill(index)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Certifications Section */}
      <div className="skills-section">
        <div className="skills-section-header">
          <h3 className="skills-section-title">Certifications</h3>
          {viewMode === "edit" && (
            <button
              type="button"
              className="skills-add-btn"
              onClick={() => setEditingCert({ name: "", issuer: "", issueDate: "", expiryDate: "", credentialId: "" })}
            >
              + Add Certification
            </button>
          )}
        </div>

        {viewMode === "edit" && editingCert && (
          <form onSubmit={handleAddCertification} className="skills-form">
            <input
              type="text"
              placeholder="Certification name (e.g., ServSafe, TIPS)"
              value={editingCert.name}
              onChange={(e) => setEditingCert({ ...editingCert, name: e.target.value })}
              className="skills-input"
              required
            />
            <input
              type="text"
              placeholder="Issuing organization (optional)"
              value={editingCert.issuer}
              onChange={(e) => setEditingCert({ ...editingCert, issuer: e.target.value })}
              className="skills-input"
            />
            <input
              type="text"
              placeholder="Credential ID (optional)"
              value={editingCert.credentialId}
              onChange={(e) => setEditingCert({ ...editingCert, credentialId: e.target.value })}
              className="skills-input"
            />
            <div className="skills-form-row">
              <input
                type="date"
                placeholder="Issue date"
                value={editingCert.issueDate}
                onChange={(e) => setEditingCert({ ...editingCert, issueDate: e.target.value })}
                className="skills-input"
              />
              <input
                type="date"
                placeholder="Expiry date (optional)"
                value={editingCert.expiryDate}
                onChange={(e) => setEditingCert({ ...editingCert, expiryDate: e.target.value })}
                className="skills-input"
              />
            </div>
            <div className="skills-form-actions">
              <button type="submit" className="skills-btn skills-btn-primary">Add</button>
              <button
                type="button"
                className="skills-btn skills-btn-secondary"
                onClick={() => setEditingCert(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {certifications.length === 0 ? (
          <div className="skills-empty">No certifications added yet</div>
        ) : (
          <div className="skills-list">
            {certifications.map((cert, index) => {
              const expiring = isCertExpiring(cert.expiryDate);
              const expired = isCertExpired(cert.expiryDate);
              
              return (
                <div key={index} className={`skills-item ${expired ? "skills-item-expired" : ""} ${expiring ? "skills-item-expiring" : ""}`}>
                  <div className="skills-item-content">
                    <div className="skills-item-name">{cert.name}</div>
                    <div className="skills-item-meta">
                      {cert.issuer && <span>{cert.issuer}</span>}
                      {cert.credentialId && <span>ID: {cert.credentialId}</span>}
                      {cert.issueDate && (
                        <span>Issued: {new Date(cert.issueDate).toLocaleDateString()}</span>
                      )}
                      {cert.expiryDate && (
                        <span className={expired ? "skills-expired" : expiring ? "skills-expiring" : ""}>
                          Expires: {new Date(cert.expiryDate).toLocaleDateString()}
                          {expired && " (Expired)"}
                          {expiring && !expired && " (Expiring Soon)"}
                        </span>
                      )}
                    </div>
                  </div>
                  {viewMode === "edit" && (
                    <div className="skills-item-actions">
                      <button
                        type="button"
                        className="skills-edit-btn"
                        onClick={() => setEditingCert({ ...cert, index })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="skills-delete-btn"
                        onClick={() => handleDeleteCertification(index)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Specializations Section */}
      <div className="skills-section">
        <div className="skills-section-header">
          <h3 className="skills-section-title">Specializations</h3>
          {viewMode === "edit" && (
            <button
              type="button"
              className="skills-add-btn"
              onClick={() => setEditingSpec({ area: "", description: "" })}
            >
              + Add Specialization
            </button>
          )}
        </div>

        {viewMode === "edit" && editingSpec && (
          <form onSubmit={handleAddSpecialization} className="skills-form">
            <input
              type="text"
              placeholder="Area of specialization (e.g., Wine Pairing, Vegan Cuisine)"
              value={editingSpec.area}
              onChange={(e) => setEditingSpec({ ...editingSpec, area: e.target.value })}
              className="skills-input"
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={editingSpec.description}
              onChange={(e) => setEditingSpec({ ...editingSpec, description: e.target.value })}
              className="skills-textarea"
              rows={3}
            />
            <div className="skills-form-actions">
              <button type="submit" className="skills-btn skills-btn-primary">Add</button>
              <button
                type="button"
                className="skills-btn skills-btn-secondary"
                onClick={() => setEditingSpec(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {specializations.length === 0 ? (
          <div className="skills-empty">No specializations added yet</div>
        ) : (
          <div className="skills-list">
            {specializations.map((spec, index) => (
              <div key={index} className="skills-item">
                <div className="skills-item-content">
                  <div className="skills-item-name">{spec.area}</div>
                  {spec.description && (
                    <div className="skills-item-description">{spec.description}</div>
                  )}
                </div>
                {viewMode === "edit" && (
                  <div className="skills-item-actions">
                    <button
                      type="button"
                      className="skills-edit-btn"
                      onClick={() => setEditingSpec({ ...spec, index })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="skills-delete-btn"
                      onClick={() => handleDeleteSpecialization(index)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}