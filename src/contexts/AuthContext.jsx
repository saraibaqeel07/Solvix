import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext(null);

export const CEO_EMAIL = 'saraibaqeel07@gmail.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        if (firebaseUser.email === CEO_EMAIL) {
          setUserProfile({ role: 'ceo', email: firebaseUser.email, name: 'CEO' });
        } else {
          const snap = await getDoc(doc(db, 'tenants', firebaseUser.uid));
          if (snap.exists()) {
            setUserProfile({ ...snap.data(), uid: firebaseUser.uid });
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  // Re-reads the tenant doc (e.g. after the CEO extends a demo or records a payment).
  const refreshProfile = async () => {
    const u = auth.currentUser;
    if (!u || u.email === CEO_EMAIL) return;
    const snap = await getDoc(doc(db, 'tenants', u.uid));
    if (snap.exists()) setUserProfile({ ...snap.data(), uid: u.uid });
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
