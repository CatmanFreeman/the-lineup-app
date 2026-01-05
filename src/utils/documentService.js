import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../hooks/services/firebase";
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../hooks/services/firebase";

/**
 * Document Types
 */
export const DOCUMENT_TYPES = {
  I9: "i9_form",
  W4: "w4_form",
  DIRECT_DEPOSIT: "direct_deposit_form",
  EMERGENCY_CONTACT: "emergency_contact_form",
  LEGAL_ID: "legal_id",
  SOCIAL_SECURITY_CARD: "social_security_card",
  ORIENTATION_VIDEO: "orientation_video_completion",
  SAFETY_TRAINING: "safety_training_completion",
  SERVSAFE: "servsafe_certification",
  LIQUOR_CLASS: "liquor_class_certification",
  FOOD_HANDLING: "food_handling_certification"
};

/**
 * Document Status
 */
export const DOCUMENT_STATUS = {
  MISSING: "missing",
  UPLOADED: "uploaded",
  VERIFYING: "verifying",
  APPROVED: "approved",
  REJECTED: "rejected",
  NEEDS_UPDATE: "needs_update"
};

/**
 * Upload a document to Firebase Storage
 */
export async function uploadDocument({
  file,
  employeeId,
  restaurantId,
  companyId,
  documentType,
  uploadedBy = "employee" // "employee" or "manager"
}) {
  if (!file) throw new Error("No file provided");

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Invalid file type. Only JPG, PNG, and PDF are allowed.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const timestamp = Date.now();
  const storagePath = [
    "companies",
    companyId,
    "restaurants",
    restaurantId,
    "employees",
    employeeId,
    "documents",
    documentType,
    `${timestamp}_${safeName}`
  ].join("/");

  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);

  // Save document metadata to Firestore
  const documentId = `${documentType}_${timestamp}`;
  const documentRef = doc(
    db,
    "companies",
    companyId,
    "restaurants",
    restaurantId,
    "employees",
    employeeId,
    "documents",
    documentId
  );

  await setDoc(documentRef, {
    documentType,
    storagePath,
    downloadURL,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    uploadedBy,
    status: uploadedBy === "manager" ? DOCUMENT_STATUS.APPROVED : DOCUMENT_STATUS.UPLOADED,
    uploadedAt: new Date().toISOString(),
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null
  });

  return {
    id: documentId,
    downloadURL,
    storagePath,
    status: uploadedBy === "manager" ? DOCUMENT_STATUS.APPROVED : DOCUMENT_STATUS.UPLOADED
  };
}

/**
 * Verify document (AI/system verification)
 */
export async function verifyDocument({
  employeeId,
  restaurantId,
  companyId,
  documentId,
  documentType
}) {
  // TODO: Integrate with AI/document verification service
  // For now, simulate verification
  const documentRef = doc(
    db,
    "companies",
    companyId,
    "restaurants",
    restaurantId,
    "employees",
    employeeId,
    "documents",
    documentId
  );

  const docSnap = await getDoc(documentRef);
  if (!docSnap.exists()) {
    throw new Error("Document not found");
  }

  // Simulate verification delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Update document status
  await updateDoc(documentRef, {
    status: DOCUMENT_STATUS.APPROVED,
    verifiedAt: new Date().toISOString(),
    verifiedBy: "system"
  });

  return { status: DOCUMENT_STATUS.APPROVED };
}

/**
 * Get all documents for an employee
 */
export async function getEmployeeDocuments(employeeId, restaurantId, companyId) {
  const documentsRef = collection(
    db,
    "companies",
    companyId,
    "restaurants",
    restaurantId,
    "employees",
    employeeId,
    "documents"
  );

  const snapshot = await getDocs(documentsRef);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Get document status for all required documents
 */
export async function getDocumentStatus(employeeId, restaurantId, companyId, requiredTypes) {
  const documents = await getEmployeeDocuments(employeeId, restaurantId, companyId);
  const statusMap = {};

  requiredTypes.forEach(type => {
    const doc = documents.find(d => d.documentType === type && d.status === DOCUMENT_STATUS.APPROVED);
    statusMap[type] = doc ? DOCUMENT_STATUS.APPROVED : DOCUMENT_STATUS.MISSING;
  });

  return statusMap;
}