import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../hooks/services/firebase";

/**
 * Uploads image to Firebase Storage and returns download URL
 */
export async function uploadImage(file, userId) {
  if (!file) throw new Error("No file provided");

  const safeName = file.name.replace(/\s+/g, "_");
  const path = `users/${userId}/${Date.now()}_${safeName}`;

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);

  return await getDownloadURL(storageRef);
}
