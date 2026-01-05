import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";

/**
 * CREATE USER
 */
export async function signupUser({
  fullName,
  email,
  password,
}) {
  const auth = getAuth();

  // 1. Create auth user
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  const user = userCredential.user;

  // 2. Create Firestore user document
  await setDoc(doc(db, "users", user.uid), {
    fullName,
    email,
    imageURL: "",
    favorites: [],
    preferences: [],
    addresses: [],
    createdAt: serverTimestamp(),
  });

  return user;
}

/**
 * LOGIN USER
 */
export async function loginUser(email, password) {
  const auth = getAuth();
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
  return userCredential.user;
}

/**
 * LOGOUT USER
 */
export async function logoutUser() {
  const auth = getAuth();
  await signOut(auth);
}
