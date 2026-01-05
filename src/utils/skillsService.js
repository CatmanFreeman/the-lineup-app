// src/utils/skillsService.js

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    query,
    where,
    serverTimestamp,
  } from "firebase/firestore";
  import { db } from "../hooks/services/firebase";
  
  /**
   * Skills Service
   * 
   * Manages employee skills, certifications, and specializations
   * Stored at: users/{userId}/resume/skills
   */
  
  /**
   * Get employee's skills, certifications, and specializations
   */
  export async function getEmployeeSkills(employeeId) {
    try {
      const skillsRef = doc(db, "users", employeeId, "resume", "skills");
      const skillsSnap = await getDoc(skillsRef);
      
      if (skillsSnap.exists()) {
        return skillsSnap.data();
      }
      
      return {
        skills: [],
        certifications: [],
        specializations: [],
        lastUpdated: null,
      };
    } catch (error) {
      console.error("Error getting employee skills:", error);
      return {
        skills: [],
        certifications: [],
        specializations: [],
        lastUpdated: null,
      };
    }
  }
  
  /**
   * Update employee's skills
   */
  export async function updateEmployeeSkills(employeeId, skillsData) {
    try {
      const skillsRef = doc(db, "users", employeeId, "resume", "skills");
      
      await setDoc(
        skillsRef,
        {
          ...skillsData,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
      
      return true;
    } catch (error) {
      console.error("Error updating employee skills:", error);
      throw error;
    }
  }
  
  /**
   * Add a skill
   */
  export async function addSkill(employeeId, skill) {
    try {
      const current = await getEmployeeSkills(employeeId);
      const updatedSkills = [...(current.skills || []), skill];
      
      await updateEmployeeSkills(employeeId, {
        skills: updatedSkills,
        certifications: current.certifications || [],
        specializations: current.specializations || [],
      });
      
      return true;
    } catch (error) {
      console.error("Error adding skill:", error);
      throw error;
    }
  }
  
  /**
   * Update a skill
   */
  export async function updateSkill(employeeId, skillIndex, updatedSkill) {
    try {
      const current = await getEmployeeSkills(employeeId);
      const updatedSkills = [...(current.skills || [])];
      updatedSkills[skillIndex] = updatedSkill;
      
      await updateEmployeeSkills(employeeId, {
        skills: updatedSkills,
        certifications: current.certifications || [],
        specializations: current.specializations || [],
      });
      
      return true;
    } catch (error) {
      console.error("Error updating skill:", error);
      throw error;
    }
  }
  
  /**
   * Delete a skill
   */
  export async function deleteSkill(employeeId, skillIndex) {
    try {
      const current = await getEmployeeSkills(employeeId);
      const updatedSkills = (current.skills || []).filter((_, index) => index !== skillIndex);
      
      await updateEmployeeSkills(employeeId, {
        skills: updatedSkills,
        certifications: current.certifications || [],
        specializations: current.specializations || [],
      });
      
      return true;
    } catch (error) {
      console.error("Error deleting skill:", error);
      throw error;
    }
  }
  
  /**
   * Add a certification
   */
  export async function addCertification(employeeId, certification) {
    try {
      const current = await getEmployeeSkills(employeeId);
      const updatedCerts = [...(current.certifications || []), certification];
      
      await updateEmployeeSkills(employeeId, {
        skills: current.skills || [],
        certifications: updatedCerts,
        specializations: current.specializations || [],
      });
      
      return true;
    } catch (error) {
      console.error("Error adding certification:", error);
      throw error;
    }
  }
  
  /**
   * Update a certification
   */
  export async function updateCertification(employeeId, certIndex, updatedCert) {
    try {
      const current = await getEmployeeSkills(employeeId);
      const updatedCerts = [...(current.certifications || [])];
      updatedCerts[certIndex] = updatedCert;
      
      await updateEmployeeSkills(employeeId, {
        skills: current.skills || [],
        certifications: updatedCerts,
        specializations: current.specializations || [],
      });
      
      return true;
    } catch (error) {
      console.error("Error updating certification:", error);
      throw error;
    }
  }
  
  /**
   * Delete a certification
   */
  export async function deleteCertification(employeeId, certIndex) {
    try {
      const current = await getEmployeeSkills(employeeId);
      const updatedCerts = (current.certifications || []).filter((_, index) => index !== certIndex);
      
      await updateEmployeeSkills(employeeId, {
        skills: current.skills || [],
        certifications: updatedCerts,
        specializations: current.specializations || [],
      });
      
      return true;
    } catch (error) {
      console.error("Error deleting certification:", error);
      throw error;
    }
  }
  
  /**
   * Add a specialization
   */
  export async function addSpecialization(employeeId, specialization) {
    try {
      const current = await getEmployeeSkills(employeeId);
      const updatedSpecs = [...(current.specializations || []), specialization];
      
      await updateEmployeeSkills(employeeId, {
        skills: current.skills || [],
        certifications: current.certifications || [],
        specializations: updatedSpecs,
      });
      
      return true;
    } catch (error) {
      console.error("Error adding specialization:", error);
      throw error;
    }
  }
  
  /**
   * Update a specialization
   */
  export async function updateSpecialization(employeeId, specIndex, updatedSpec) {
    try {
      const current = await getEmployeeSkills(employeeId);
      const updatedSpecs = [...(current.specializations || [])];
      updatedSpecs[specIndex] = updatedSpec;
      
      await updateEmployeeSkills(employeeId, {
        skills: current.skills || [],
        certifications: current.certifications || [],
        specializations: updatedSpecs,
      });
      
      return true;
    } catch (error) {
      console.error("Error updating specialization:", error);
      throw error;
    }
  }
  
  /**
   * Delete a specialization
   */
  export async function deleteSpecialization(employeeId, specIndex) {
    try {
      const current = await getEmployeeSkills(employeeId);
      const updatedSpecs = (current.specializations || []).filter((_, index) => index !== specIndex);
      
      await updateEmployeeSkills(employeeId, {
        skills: current.skills || [],
        certifications: current.certifications || [],
        specializations: updatedSpecs,
      });
      
      return true;
    } catch (error) {
      console.error("Error deleting specialization:", error);
      throw error;
    }
  }